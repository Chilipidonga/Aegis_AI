import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import http from 'http';
import { WebSocketServer } from 'ws';
import mongoose from 'mongoose';
import axios from 'axios';
import apiRoutes from './routes/apiRoutes.js';

dotenv.config();

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

// Configured CORS to allow both local development and live Vercel production
const allowedOrigins = [
  'http://localhost:5173',
  'https://aegis-ai-omega-three.vercel.app'
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like server-to-server or Postman)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      return callback(null, true);
    } else {
      return callback(new Error('CORS policy error: Origin not allowed'));
    }
  },
  credentials: true
}));

app.use(express.json());

// Initialize WebSocket server for real-time telemetry streaming
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
    console.log('Telemetry Dashboard client connected via WebSocket.');
    ws.send(JSON.stringify({ status: 'connected', message: 'AegisAI Telemetry Stream Active' }));
    
    ws.on('close', () => console.log('Telemetry Dashboard client disconnected.'));
});

// Middleware placeholder to inject WebSocket into requests for real-time logging later
app.use((req, res, next) => {
    req.wss = wss;
    next();
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'UP', gateway: 'AegisAI Active' });
});

// ==========================================
// AI ROUTER FORWARDING LOGIC
// ==========================================
app.post('/api/ai/ask', async (req, res) => {
    try {
        const { prompt } = req.body;
        
        // Uses Environment Variable on Render, falls back to local Python server port 8000
        const pythonUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000/api/v1/generate';

        const pythonResponse = await axios.post(pythonUrl, 
            new URLSearchParams({ prompt: prompt || '' }),
            { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
        );
        
        res.json(pythonResponse.data);
    } catch (error) {
        console.error("Python service error:", error.message);
        res.status(500).json({ error: "AI Service Unavailable or Offline" });
    }
});

// API Routes
app.use('/api/v1', apiRoutes);

// Database Connection
if (process.env.MONGODB_URI) {
    mongoose.connect(process.env.MONGODB_URI)
        .then(() => console.log('Successfully connected to MongoDB Atlas Securely.'))
        .catch((err) => console.error('MongoDB connection fault:', err));
} else {
    console.warn('⚠️ MONGODB_URI is not defined in .env file. Database connection skipped.');
}

// Start Server
server.listen(PORT, () => {
    console.log(`===================================================`);
    console.log(`🛡️  AegisAI Core Gateway Active on Port: ${PORT}`);
    console.log(`===================================================`);
});