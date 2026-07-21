import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import http from 'http';
import { WebSocketServer } from 'ws';
import mongoose from 'mongoose';
import apiRoutes from './routes/apiRoutes.js';

dotenv.config();

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

// Enable CORS and JSON parsing
app.use(cors());
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
app.use('/api/v1', apiRoutes);
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'UP', gateway: 'AegisAI Active' });
});

// Database Connection
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('Successfully connected to MongoDB Atlas Securely.'))
    .catch((err) => console.error('MongoDB connection fault:', err));

// Start Server
server.listen(PORT, () => {
    console.log(`===================================================`);
    console.log(`🛡️  AegisAI Core Gateway Active on Port: ${PORT}`);
    console.log(`===================================================`);
});