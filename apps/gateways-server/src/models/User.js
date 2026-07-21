import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true,
    trim: true 
  },
  phone: { 
    type: String, 
    required: true, 
    unique: true, // Prevents duplicate accounts with the same number
    trim: true 
  },
  pin: { 
    type: String, 
    required: true 
  }
}, { timestamps: true });

export default mongoose.model('User', UserSchema);