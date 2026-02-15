import mongoose from 'mongoose';

const callLogSchema = new mongoose.Schema({
  leadId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lead',
    required: true
  },
  duration: {
    type: Number,
    default: 0
  },
  intents: [{
    type: String
  }],
  objection_detected: {
    type: String,
    default: ''
  },
  handoff_required: {
    type: Boolean,
    default: false
  },
  raw_transcript: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

callLogSchema.index({ leadId: 1, createdAt: -1 });

export default mongoose.model('CallLog', callLogSchema);
