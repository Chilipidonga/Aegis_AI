import axios from 'axios';
import Cache from '../models/Cache.js'; 

const PYTHON_ROUTER_URL = process.env.PYTHON_ROUTER_URL || 'http://127.0.0.1:8000';

// 🚀 THE MASTER STREAMING RAG PIPELINE (WITH TEMPORAL BYPASS)
export const processPrompt = async (req, res) => {
    try {
        const { prompt } = req.body;

        if (!prompt) {
            return res.status(400).json({ error: "Prompt is required." });
        }

        console.log(`\n=================================================`);
        console.log(`📥 NEW STREAM REQUEST: "${prompt}"`);

        // Prepare response for streaming
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        // 🔍 NEW CRITICAL CHECK: Detect Time-Sensitive/Temporal Queries
        const promptLower = prompt.toLowerCase();
        const isTimeSensitive = ["weather", "today", "yesterday", "news", "current", "latest", "now"].some(keyword => 
            promptLower.includes(keyword)
        );

        let bestMatch = null;
        let queryEmbedding = null;

        // 🛑 STEP 1 & 2: Only fetch embeddings and hit MongoDB Cache if it's NOT time-sensitive
        if (!isTimeSensitive) {
            // STEP 1: Get the 384-dimension embedding for the incoming prompt
            const embedResponse = await axios.post(`${PYTHON_ROUTER_URL}/embed`, { text: prompt });
            queryEmbedding = embedResponse.data.embedding;

            // STEP 2: Search MongoDB Vector Database for Semantic Matches
            const searchResults = await Cache.aggregate([
                {
                    $vectorSearch: {
                        index: "vector_index",          
                        path: "promptEmbedding",        
                        queryVector: queryEmbedding,     
                        numCandidates: 10,              
                        limit: 1                        
                    }
                },
                {
                    $project: { aiResponse: 1, score: { $meta: "vectorSearchScore" } }
                }
            ]);

            bestMatch = searchResults[0];
        } else {
            console.log(`⏳ TEMPORAL BYPASS: Real-time query detected. Skipping database cache check.`);
        }

        // STEP 3: THE ROUTER LOGIC (🛑 98% Strict Match Strategy)
        const CACHE_THRESHOLD = 0.98;

        if (!isTimeSensitive && bestMatch && bestMatch.score >= CACHE_THRESHOLD) {
            console.log(`🟢 CACHE HIT! Match Score: ${(bestMatch.score * 100).toFixed(1)}%`);
            console.log(`⚡ Returning instantly from MongoDB Vector Cache.`);
            
            // Send the entire cached response as a single fast stream event
            const cachePayload = {
                token: bestMatch.aiResponse,
                source: "semantic-cache-database",
                similarityScore: bestMatch.score
            };
            res.write(`data: ${JSON.stringify(cachePayload)}\n\n`);
            res.end();
            return;
        }

        // STEP 4: CACHE MISS - STREAM FROM FASTAPI + LLAMA 3.2
        if (isTimeSensitive) {
            console.log(`🔴 CACHE MISS (Forced by Temporal Bypass). Streaming live data...`);
        } else {
            console.log(`🔴 CACHE MISS. (Best match was ${(bestMatch ? bestMatch.score * 100 : 0).toFixed(1)}% - Below 98% threshold). Streaming Llama 3.2...`);
        }
        
        const llmResponse = await axios({
            method: 'post',
            url: `${PYTHON_ROUTER_URL}/api/v1/generate`,
            data: { prompt: prompt },
            responseType: 'stream' // Crucial: instructs Axios to handle raw streaming data
        });

        let fullGeneratedText = ""; // Accumulator string to catch tokens for DB storage

        // 🛑 Listen to incoming chunks from Python router service
        llmResponse.data.on('data', (chunk) => {
            const lines = chunk.toString().split('\n');
            for (const line of lines) {
                if (line.trim().startsWith('data: ')) {
                    // Forward token event straight out to frontend client browser
                    res.write(`${line}\n\n`);

                    try {
                        // Extract just the raw word/token to rebuild the full text for caching
                        const parsed = JSON.parse(line.replace('data: ', '').trim());
                        if (parsed.token) {
                            fullGeneratedText += parsed.token;
                        }
                    } catch (e) {
                        // Ignore occasional parsing noise during structural framing
                    }
                }
            }
        });

        // 🛑 Handle complete generation event
        llmResponse.data.on('end', async () => {
            res.end(); // Close the network pipe with client browser

            // STEP 5: SAVE TO DATABASE (Only save if it wasn't a real-time temporal query!)
            if (!isTimeSensitive && fullGeneratedText.trim() && queryEmbedding) {
                console.log(`💾 Saving new text compilation to MongoDB Vector Cache...`);
                try {
                    const newCacheEntry = new Cache({
                        prompt: prompt,
                        promptEmbedding: queryEmbedding,
                        aiResponse: fullGeneratedText
                    });
                    await newCacheEntry.save();
                    console.log(`✅ Pipeline and Background Cache Write Complete.`);
                } catch (dbErr) {
                    console.error("❌ Background DB Cache Write Failed:", dbErr.message);
                }
            }
            console.log(`=================================================\n`);
        });

        llmResponse.data.on('error', (err) => {
            console.error("❌ LLM Stream Connection Pipeline Disrupted:", err.message);
            res.write(`data: ${JSON.stringify({ error: "Stream transmission disrupted" })}\n\n`);
            res.end();
        });

   } catch (error) {
        console.error("❌ Gateway Error Details:", error.response?.data || error.message);
        // Ensure we don't send normal JSON if headers were flipped into stream protocol
        if (!res.headersSent) {
            return res.status(500).json({ error: "System failure in the AI routing pipeline." });
        } else {
            res.write(`data: ${JSON.stringify({ error: "System failure mid-flight" })}\n\n`);
            res.end();
        }
    }
};