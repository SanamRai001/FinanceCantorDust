import mongoose from 'mongoose';

// ── Journal line sub-schema ───────────────
// each journal entry has multiple lines
// sum of all debit lines must equal sum of all credit lines
const journalLineSchema = new mongoose.Schema({

  // which account this line hits
  account: {
    type:     mongoose.Schema.Types.ObjectId,
    ref:      'Account',
    required: true
  },

  // description for this specific line
  // e.g. "Depreciation on computer"
  description: {
    type:  String,
    trim:  true
  },

  debit: {
    type:    Number,
    default: 0,
    min:     0
  },

  credit: {
    type:    Number,
    default: 0,
    min:     0
  }

}, { _id: true });

const journalEntrySchema = new mongoose.Schema({

  // ── Core fields ──────────────────────────
  date: {
    type:     Date,
    required: true
  },

  bs_date: {
    type:  String,
    trim:  true
    // e.g. "2081-04-15"
  },

  // ── Voucher type ─────────────────────────
  // journal — internal adjustment, depreciation, corrections
  // contra  — cash to bank or bank to cash transfer
  voucher_type: {
    type:     String,
    enum:     ['journal', 'contra'],
    required: true,
    default:  'journal'
  },

  // ── Reference number ─────────────────────
  // e.g. JV-2081-001 for journal voucher
  // or   CV-2081-001 for contra voucher
  reference_number: {
    type:  String,
    trim:  true
  },

  // ── Narration ────────────────────────────
  // overall description of the entry
  // e.g. "Depreciation on office equipment for FY 2081-82"
  narration: {
    type:     String,
    required: true,
    trim:     true
  },

  // ── Journal lines ─────────────────────────
  // minimum 2 lines — one debit, one credit
  // total debits must equal total credits
  lines: {
    type:     [journalLineSchema],
    required: true
  },

  // ── Totals — auto calculated ──────────────
  total_debit: {
    type:    Number,
    default: 0
  },
  total_credit: {
    type:    Number,
    default: 0
  },

  // ── Attachment ────────────────────────────
  attachment: {
    type:  String,
    trim:  true
  },

  // ── Tally export ──────────────────────────
  tally_exported: {
    type:    Boolean,
    default: false
  },
  tally_exported_at: {
    type:    Date,
    default: null
  },

  // ── Created by ────────────────────────────
  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref:  'User'
  }

}, { timestamps: true });

// ── Indexes ───────────────────────────────
journalEntrySchema.index({ date: 1 });
journalEntrySchema.index({ voucher_type: 1 });
journalEntrySchema.index({ tally_exported: 1 });

// ── Pre-validate hook ─────────────────────
journalEntrySchema.pre('validate', function (next) {

  if (!this.lines || this.lines.length < 2) {
    return next(new Error('Journal entry must have at least 2 lines'));
  }

  // calculate totals from lines
  let total_debit  = 0;
  let total_credit = 0;

  this.lines.forEach(line => {
    total_debit  += Number(line.debit  || 0);
    total_credit += Number(line.credit || 0);
  });

  this.total_debit  = total_debit;
  this.total_credit = total_credit;

  // validate that debits equal credits
  const difference = Math.abs(total_debit - total_credit);
  if (difference > 0.01) {
    return next(new Error(
      `Journal entry does not balance — debit Rs.${total_debit} ≠ credit Rs.${total_credit}`
    ));
  }

  // validate each line has either debit or credit but not both
  for (const line of this.lines) {
    if (line.debit > 0 && line.credit > 0) {
      return next(new Error(
        'Each journal line can have either debit or credit — not both'
      ));
    }
    if (line.debit === 0 && line.credit === 0) {
      return next(new Error(
        'Each journal line must have either a debit or credit amount'
      ));
    }
  }

  next();
});

export default mongoose.model('JournalEntry', journalEntrySchema);