import express from 'express';
import multer from 'multer';
import FormData from 'form-data';
import axios from 'axios';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// ⚠️ Make sure to create these Mongoose models in your project!
// import User from '../models/User.js'; 
// import ChatSession from '../models/ChatSession.js'; 

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

const JWT_SECRET = process.env.JWT_SECRET || "aegis_super_secret_key";

// ==========================================
// 🔐 AUTHENTICATION ROUTES (Number + PIN)
// ==========================================

router.post('/signup', async (req, res) => {
  try {
    const { name, phone, pin } = req.body;
    
    // 1. Hash the PIN for security
    const salt = await bcrypt.genSalt(10);
    const hashedPin = await bcrypt.hash(pin, salt);

    // 2. Save user to MongoDB (Uncomment when your User model is ready)
    /*
    const newUser = new User({ name, phone, pin: hashedPin });
    await newUser.save();
    */

    // 3. Generate token (For now, we will simulate the user ID for testing)
    const simulatedUserId = "user_" + Date.now(); 
    const token = jwt.sign({ id: simulatedUserId }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({ token, user: { id: simulatedUserId, name, phone } });
  } catch (error) {
    res.status(500).json({ error: "Signup failed." });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { phone, pin } = req.body;

    // 1. Find user (Uncomment when your User model is ready)
    /*
    const user = await User.findOne({ phone });
    if (!user) return res.status(400).json({ error: "User not found." });

    const isMatch = await bcrypt.compare(pin, user.pin);
    if (!isMatch) return res.status(400).json({ error: "Invalid PIN." });
    */

    // Simulated login for testing
    const simulatedUserId = "user_12345"; 
    const token = jwt.sign({ id: simulatedUserId }, JWT_SECRET, { expiresIn: '7d' });

    res.json({ token, user: { id: simulatedUserId, name: "Aegis User", phone } });
  } catch (error) {
    res.status(500).json({ error: "Login failed." });
  }
});


// ==========================================
// 🧠 AEGIS AI GENERATION ROUTE
// ==========================================

router.post('/generate', upload.single('file'), async (req, res) => {
  try {
    const userPrompt = req.body.prompt;
    const chatHistory = req.body.history; 
    const uploadedFile = req.file; 
    
    // 👇 NEW: We now extract the User ID and Session ID from the frontend!
    const userId = req.body.userId;
    const sessionId = req.body.sessionId;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized request." });
    }

    const pythonPayload = new FormData();
    pythonPayload.append('prompt', userPrompt);

    if (chatHistory) {
      pythonPayload.append('history', chatHistory);
    }

    if (uploadedFile) {
      pythonPayload.append('file', uploadedFile.buffer, {
        filename: uploadedFile.originalname,
        contentType: uploadedFile.mimetype,
      });
    }

    const pythonResponse = await axios.post('http://127.0.0.1:8000/api/v1/generate', pythonPayload, {
      responseType: 'stream',
      headers: { ...pythonPayload.getHeaders() }
    });

    pythonResponse.data.pipe(res);

    // 💾 TODO: After the stream finishes, save the chat to MongoDB using the userId and sessionId!

  } catch (error) {
    console.error("Gateway Error:", error.message);
    res.status(500).json({ error: "Gateway engine failure processing request." });
  }
});

export default router;