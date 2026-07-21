import mongoose from 'mongoose';

const cacheSchema = new mongoose.Schema({
    prompt: {
        type: String,
        required: true,
        trim: true
    },
    promptEmbedding: {
        type: [Number], // Storing our 384-dimensional math vectors here
        required: true
    },
    aiResponse: {
        type: String,
        required: true
    },
    metadata: {
        modelUsed: { type: String, default: 'unknown' },
        executionTimeMs: { type: Number },
        tokensUsed: { type: Number }
    },
    createdAt: {
        type: Date,
        default: Date.now,
        expires: 86400 * 7 // Automatically deletes old cache data after 7 days
    }
});

// Create the model
const Cache = mongoose.model('Cache', cacheSchema);

export default Cache;