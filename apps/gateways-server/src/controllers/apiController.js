import axios from 'axios';
import PromptCache from '../models/PromptCache.js'; // Adjust the import path to match your model

export const semanticSearch = async (req, res) => {
    try {
        const { query } = req.body;

        if (!query) {
            return res.status(400).json({ error: "Query prompt is required." });
        }

        // 1. Get the 384-dimension embedding for the search query from the Python service
        console.log(`🛰️  Requesting embedding from Python router for: "${query}"`);
        const pythonResponse = await axios.post('http://127.0.0.1:8000/embed', {
            text: query
        });

        const queryEmbedding = pythonResponse.data.embedding;

        // 2. Query the Vector Index in MongoDB Atlas
        console.log('🔍 Running Vector Search on Atlas...');
        const results = await PromptCache.aggregate([
            {
                $vectorSearch: {
                    index: "vector_index",          // Must match your Atlas index name exactly!
                    path: "promptEmbedding",        // The field in your schema
                    queryVector: queryEmbedding,     // The 384-dimension array
                    numCandidates: 10,              // Number of closest vectors to inspect
                    limit: 3                        // Max results to return
                }
            },
            {
                // Project only the fields we care about, plus the calculated search score
                $project: {
                    prompt: 1,
                    aiResponse: 1,
                    score: { $meta: "vectorSearchScore" } // Shows how mathematically close they are!
                }
            }
        ]);

        return res.status(200).json({
            message: "Semantic search completed successfully.",
            results
        });

    } catch (error) {
        console.error("❌ Vector search failed:", error.message);
        return res.status(500).json({ error: "Vector Search pipeline execution failed." });
    }
};