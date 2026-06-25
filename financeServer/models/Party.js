import mongoose from 'mongoose';

const partySchema = new mongoose.Schema({

  // ── Basic info ───────────────────────────────────────────────
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true       // no duplicate party names
  },
  type: {
    type: String,
    enum: ['supplier', 'client', 'employee', 'other'],
    required: true
  },

  // ── Contact ──────────────────────────────────────────────────
  phone: {
    type: String,
    trim: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true
  },
  address: {
    type: String,
    trim: true
  },

  // ── Tax info (Module 3) ──────────────────────────────────────
  // VAT number — if this party is VAT registered
  vat_number: {
    type: String,
    trim: true
  },
  // PAN number — Permanent Account Number, required in Nepal
  pan_number: {
    type: String,
    trim: true
  },
  // ── Status ───────────────────────────────────────────────────
  is_active: {
    type: Boolean,
    default: true       // soft delete — never hard delete a party
  },                    // that has transactions linked to it

  notes: {
    type: String,
    trim: true
  }

}, {
  timestamps: true
});


partySchema.index({ type: 1 });
partySchema.index({ vat_number: 1 });

export default mongoose.model('Party', partySchema);