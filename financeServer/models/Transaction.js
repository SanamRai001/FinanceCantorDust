import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema({

  // ── Core fields ──────────────────────────────────────────────
  date: {
    type: Date,
    required: true
  },
  type: {
    type: String,
    enum: ['income', 'expense'],
    required: true
  },

  // voucher_type maps to Tally's voucher classification
  // auto-set by pre-save hook based on type
  // receipt  → income (money received from party)
  // payment  → expense (money paid to party)
  // journal  → internal adjustment (added later)
  // contra   → cash to bank or bank to cash (added later)
  voucher_type: {
    type: String,
    enum: ['receipt', 'payment', 'journal', 'contra'],
    default: null
  },

  // ── Party ────────────────────────────────────────────────────
  party: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Party',
  },

  description: {
    type: String,
    trim: true
  },

  // ── Amounts ──────────────────────────────────────────────────
  net_amount: {
    type: Number,
    required: true,
    min: 0
  },
  vat_amount: {
    type: Number,
    default: 0,
    min: 0
  },
  gross_amount: {
    type: Number,
    required: true,
    min: 0
  },

  // VAT flag — separates VATable vs exempt in Module 3
  vat_applicable: {
    type: Boolean,
    default: false
  },

  // ── Payment ──────────────────────────────────────────────────
  payment_method: {
    type: String,
    enum: ['cash', 'cheque', 'bank'],
    required: true
  },
  payment_ref: {
    type: String,
    trim: true
  },

  // ── Bill reference ───────────────────────────────────────────
  bill_ref_type: {
    type: String,
    enum: ['bill', 'vat', 'none'],
    default: 'none'
  },
  bill_ref_number: {
    type: String,
    trim: true
  },

  // ── Accounting ───────────────────────────────────────────────
  account_code: {
    type: String,
    trim: true
  },

  // debit and credit — auto-set by pre-save hook
  // user never touches these
  debit: {
    type: Number,
    default: 0
  },
  credit: {
    type: Number,
    default: 0
  },

  // BS date stored as string — MongoDB stores AD internally
  bs_date: {
    type: String,
    trim: true
    // e.g. "2081-04-15"
  },

  // ── Attachment ───────────────────────────────────────────────
  attachment: {
    type: String,
    trim: true
    // e.g. "uploads/bill-1234.pdf"
  },

  // ── Tally export flag ─────────────────────────────────────────
  // tracks whether this transaction has been exported to Tally XML
  // so you never export the same transaction twice
  tally_exported: {
    type: Boolean,
    default: false
  },
  tally_exported_at: {
    type: Date,
    default: null
  }

}, {
  timestamps: true
});

// ── Indexes ───────────────────────────────────────────────────
transactionSchema.index({ date: 1 });
transactionSchema.index({ type: 1 });
transactionSchema.index({ party: 1 });
transactionSchema.index({ voucher_type: 1 });
transactionSchema.index({ tally_exported: 1 }); // fast filter for export

// ── Pre-save hook ─────────────────────────────────────────────
transactionSchema.pre('save', async function () {

  // auto-set gross_amount if not provided
  if (!this.gross_amount) {
    this.gross_amount = this.net_amount + this.vat_amount;
  }

  // auto-set debit and credit based on type
  if (this.type === 'income') {
    this.debit  = this.gross_amount;
    this.credit = 0;
  } else {
    this.debit  = 0;
    this.credit = this.gross_amount;
  }

  // always set voucher_type based on type
  // ignore whatever came from the request — hook decides this
  if (this.type === 'income') {
    this.voucher_type = 'receipt';
  } else {
    this.voucher_type = 'payment';
  }
});

export default mongoose.model('Transaction', transactionSchema);