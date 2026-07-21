import os
import sys

# 🛠️ Fix Windows PowerShell Unicode / Emoji encoding crashes
if hasattr(sys.stdout, 'reconfigure') and sys.stdout.encoding and sys.stdout.encoding.lower() != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

# 🛑 Force HuggingFace offline so it stops crashing the async HTTP client
os.environ["HF_HUB_OFFLINE"] = "1" 

from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer
import time
import httpx 
import json
import PyPDF2
import io
import re
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv

# 🌟 RAG IMPORTS (MongoDB Atlas)
from langchain_text_splitters import RecursiveCharacterTextSplitter
from pymongo import MongoClient
from langchain_mongodb import MongoDBAtlasVectorSearch
from langchain_core.embeddings import Embeddings
from duckduckgo_search import DDGS  # 🌐 Live Internet Search

# 🚀 GROQ CLOUD LLM IMPORT
from groq import AsyncGroq

# Load environment variables to share the same .env as Node.js
load_dotenv()

app = FastAPI(title="AegisAI Cloud Router & Embedding Engine")

# Add CORS so frontend can communicate directly if needed during dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Groq Async Client
groq_client = AsyncGroq(api_key=os.environ.get("GROQ_API_KEY"))

print("🤖 Loading local embedding model (all-MiniLM-L6-v2)...")
model = SentenceTransformer('all-MiniLM-L6-v2')
print("✅ Local embedding model loaded successfully with zero API dependencies!")

# 🌟 CUSTOM EMBEDDING WRAPPER FOR MONGODB
class LocalEmbeddings(Embeddings):
    def embed_documents(self, texts):
        return model.encode(texts).tolist()
    def embed_query(self, text):
        return model.encode([text])[0].tolist()

local_embeddings = LocalEmbeddings()

# 🔌 GLOBAL MONGODB CONNECTION
MONGO_URI = os.environ.get("MONGODB_URI", "mongodb://localhost:27017")
mongo_client = MongoClient(MONGO_URI)
db_name = "test"  
collection_name = "caches"
collection = mongo_client[db_name][collection_name]
print("✅ Connected to MongoDB Atlas for Vector Search!")

class EmbeddingRequest(BaseModel):
    text: str

class EmbeddingResponse(BaseModel):
    embedding: list[float]
    execution_time_ms: float

@app.post("/embed", response_model=EmbeddingResponse)
async def get_embeddings(payload: EmbeddingRequest):
    try:
        start_time = time.time()
        vector = model.encode(payload.text).tolist()
        duration = (time.time() - start_time) * 1000
        return EmbeddingResponse(
            embedding=vector,
            execution_time_ms=duration
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# 🛠️ ASYNC TOOLS: Non-blocking multi-tool routing

# 1. Web Search Tool
async def perform_web_search(query: str, max_results: int = 3):
    try:
        with DDGS() as ddgs:
            results = list(ddgs.text(query, max_results=max_results))
            
        if not results:
            return "No search results found."
            
        formatted_results = []
        for res in results:
            formatted_results.append(f"Title: {res.get('title')}\nSnippet: {res.get('body')}\nURL: {res.get('href')}\n")
            
        return "\n---\n".join(formatted_results)
    except Exception as e:
        print(f"Search tool error: {str(e)}")
        return f"Error executing live web search: {str(e)}"

# 2. Global Weather Tool
async def get_live_weather(city: str = "Hyderabad"):
    async with httpx.AsyncClient() as client:
        try:
            geocode_url = f"https://geocoding-api.open-meteo.com/v1/search?name={city}&count=1"
            geo_response = await client.get(geocode_url)
            geo_data = geo_response.json()

            if "results" not in geo_data:
                return f"Sorry, I couldn't find coordinates for the location: {city}."

            lat = geo_data["results"][0]["latitude"]
            lon = geo_data["results"][0]["longitude"]
            actual_city = geo_data["results"][0]["name"]
            country = geo_data["results"][0].get("country", "")

            weather_url = f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current_weather=true"
            weather_response = await client.get(weather_url)
            weather_data = weather_response.json()
            
            temp = weather_data['current_weather']['temperature']

            return f"Current temperature in {actual_city}, {country} is {temp}°C."
            
        except Exception as e:
            return f"Error fetching weather data: {str(e)}"


# 🧠 THE STREAMING BRAIN: Cloud Groq Llama 3.3 with RAG & Chat Memory
@app.post("/api/v1/generate")
async def generate_response(
    prompt: str = Form(...),          
    history: str = Form("[]"),        
    file: UploadFile = File(None)     
):
    
    async def event_generator():
        try:
            # 🧠 1. Parse Chat History
            history_context = ""
            try:
                past_messages = json.loads(history)
                if past_messages:
                    history_context = "Previous Conversation Context:\n"
                    for msg in past_messages[-6:]:
                        role = msg.get("role", "User").capitalize()
                        content = msg.get("content", "")
                        history_context += f"{role}: {content}\n"
            except Exception as e:
                print(f"❌ History parsing error: {e}")

            retrieved_context = ""
            
            # 📄 2. TRUE RAG PIPELINE (MongoDB Atlas Vector Search)
            if file:
                yield f"data: {json.dumps({'status': f'Vectorizing document: {file.filename}...'})}\n\n"
                
                file_bytes = await file.read()
                extracted_text = ""
                
                if file.content_type == "application/pdf":
                    try:
                        pdf_reader = PyPDF2.PdfReader(io.BytesIO(file_bytes))
                        for page in pdf_reader.pages:
                            page_text = page.extract_text()
                            if page_text:
                                extracted_text += page_text + "\n"
                    except Exception as e:
                        print(f"❌ PDF Parsing Error: {e}")
                
                if extracted_text.strip():
                    text_splitter = RecursiveCharacterTextSplitter(chunk_size=1500, chunk_overlap=250)
                    chunks = text_splitter.split_text(extracted_text)
                    print(f"🔪 Split document into {len(chunks)} chunks.")
                    
                    vectorstore = MongoDBAtlasVectorSearch.from_texts(
                        texts=chunks,
                        embedding=local_embeddings,
                        collection=collection,
                        index_name="vector_index_1", 
                        text_key="text",
                        embedding_key="embedding"    
                    )
                    
                    docs = vectorstore.similarity_search(prompt, k=8)
                    retrieved_context = "\n\n".join([doc.page_content for doc in docs])
                    print("✅ MongoDB Atlas Vector Retrieval Successful!")
                
                yield f"data: {json.dumps({'status': ''})}\n\n"

            # 🧠 3. Construct Final Prompt & Dynamic Tool Routing
            final_prompt = prompt
            
            if retrieved_context:
                final_prompt = f"You are Aegis. Answer the user's query strictly using the provided Document Context. If the context does not contain the answer, reply 'I do not have enough information to answer that based on the document.'\n\nDocument Context:\n{retrieved_context}\n\nUser Query: {prompt}"
            else:
                prompt_lower = prompt.lower()
                needs_weather = "weather" in prompt_lower
                needs_live_data = any(keyword in prompt_lower for keyword in ["news", "current", "latest", "now"])
                
                if needs_weather:
                    yield f"data: {json.dumps({'status': 'Fetching live global weather data...'})}\n\n"
                    city_target = "Hyderabad"
                    match = re.search(r'weather\s+(?:in|for)\s+([a-zA-Z\s]+)', prompt_lower)
                    if match:
                        city_target = match.group(1).strip().split()[0]
                        
                    live_context = await get_live_weather(city_target)
                    final_prompt = f"Use this real-time weather data to answer the query naturally:\n{live_context}\n\nUser Query: {prompt}"
                    yield f"data: {json.dumps({'status': ''})}\n\n"
                    
                elif needs_live_data:
                    yield f"data: {json.dumps({'status': 'Searching the web for current data...'})}\n\n"
                    print(f"🌍 Live search triggered for: {prompt}")
                    
                    live_context = await perform_web_search(prompt)
                    final_prompt = f"Use this real-time internet context to answer the query:\n{live_context}\n\nUser Query: {prompt}"
                    yield f"data: {json.dumps({'status': ''})}\n\n"
                else:
                    print("🧠 Routing directly to Groq Cloud LLM")

            if history_context:
                final_prompt = f"{history_context}\n{final_prompt}"

            # 🚀 4. Stream response via Groq Cloud (Llama 3.3 70B)
            try:
                stream = await groq_client.chat.completions.create(
                    model="llama-3.3-70b-versatile",
                    messages=[
                        {
                            "role": "system",
                            "content": "You are Aegis, an advanced and highly capable general-purpose AI assistant. You have expert-level knowledge in full-stack web development, generative AI engineering, cybersecurity, and general logic. Your goal is to be universally helpful, providing clear, accurate, and insightful answers to any query the user provides. When writing code, always provide clean, production-ready examples. When provided with live internet context, incorporate it naturally into your response without explicitly saying you are reading a search result."
                        },
                        {
                            "role": "user", 
                            "content": final_prompt
                        }
                    ],
                    stream=True,
                )
                
                async for chunk in stream:
                    text_token = chunk.choices[0].delta.content or ""
                    if text_token:
                        yield f"data: {json.dumps({'token': text_token})}\n\n"
            
            except Exception as e:
                error_details = repr(e)
                print(f"❌ Groq Streaming Engine Error: {error_details}")
                yield f"data: {json.dumps({'error': error_details})}\n\n"
                
        except Exception as e:
            error_details = repr(e)
            print(f"❌ Internal Pipeline Error: {error_details}")
            yield f"data: {json.dumps({'error': error_details})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@app.get("/health")
def health_check():
    return {"status": "healthy", "engine": "MongoDB Atlas Vector Search, Groq Llama 3.3, & DDGS"}