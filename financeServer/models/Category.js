import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema({

  name: {
    type:     String,
    required: true,
    trim:     true,
    unique:   true
  },

  // income, expense, or both
  type: {
    type:    String,
    enum:    ['income', 'expense', 'both'],
    default: 'both'
  },

  // e.g. "project", "department", "general"
  // helps group categories further
  group: {
    type:  String,
    trim:  true,
    default: 'general'
  },

  description: {
    type:  String,
    trim:  true
  },

  // color for UI — shown as a badge color in the frontend
  // store as hex e.g. "#0F6E56"
  color: {
    type:    String,
    trim:    true,
    default: '#2E5EA8'
  },

  is_active: {
    type:    Boolean,
    default: true
  }

}, { timestamps: true });

categorySchema.index({ name: 1 });
categorySchema.index({ type: 1 });

export default mongoose.model('Category', categorySchema);