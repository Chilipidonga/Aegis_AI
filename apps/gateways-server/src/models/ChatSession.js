import mongoose from 'mongoose';

const ChatSessionSchema = new mongoose.Schema({
  // 👇 NEW: We must attach every chat to a specific User ID!
  userId: { 
    type: String, 
    required: true, 
    index: true 
  },
  sessionId: { 
    type: String, 
    required: true, 
    unique: true 
  },
  title: { 
    type: String, 
    default: 'New Chat' 
  },
  messages: [
    {
      role: { type: String, enum: ['user', 'assistant'], required: true },
      content: { type: String, required: true },
      timestamp: { type: Date, default: Date.now }
    }
  ]
}, { timestamps: true });

export default mongoose.model('ChatSession', ChatSessionSchema);