import mongoose from 'mongoose';

const leadSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  phone: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  status: {
    type: String,
    enum: ['pending', 'calling', 'completed', 'failed', 'no_answer'],
    default: 'pending'
  },
  attempts: {
    type: Number,
    default: 0
  },
  interest_score: {
    type: Number,
    default: 0
  },
  course_interest: {
    type: String,
    default: ''
  },
  summary: {
    type: String,
    default: ''
  },
  transcript: [{
    role: {
      type: String,
      enum: ['user', 'assistant', 'system']
    },
    text: String,
    timestamp: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

leadSchema.index({ status: 1, attempts: 1 });
leadSchema.index({ email: 1 }, { unique: true });
leadSchema.index({ phone: 1 }, { unique: true });

export default mongoose.model('Lead', leadSchema);
