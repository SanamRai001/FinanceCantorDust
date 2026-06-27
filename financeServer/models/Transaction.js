import mongoose from 'mongoose';

// ── Line item sub-schema ──────────────────
const lineItemSchema = new mongoose.Schema({
  name: {
    type:     String,
    required: true,
    trim:     true
  },
  quantity: {
    type:    Number,
    default: 1,
    min:     0
  },
  unit_price: {
    type:     Number,
    required: true,
    min:      0
  },
  total: {
    type:    Number,
    default: 0
  }
}, { _id: true });

const transactionSchema = new mongoose.Schema({

  // ── Core fields ──────────────────────────
  date: {
    type:     Date,
    required: true
  },
  type: {
    type:     String,
    enum:     ['income', 'expense'],
    required: true
  },

  voucher_type: {
    type:    String,
    enum:    ['receipt', 'payment', 'journal', 'contra'],
    default: null
  },

  // ── Account ───────────────────────────────
  // which account in chart of accounts this hits
  // e.g. income → Sales Revenue (4100)
  //      expense → Office Rent (5100)
  // optional — falls back to category if not set
  account: {
    type:    mongoose.Schema.Types.ObjectId,
    ref:     'Account',
    default: null
  },

  // kept for backward compatibility
  // new transactions should use account reference instead
  account_code: {
    type:  String,
    trim:  true
  },

  // ── Category ─────────────────────────────
  category: {
    type:    mongoose.Schema.Types.ObjectId,
    ref:     'Category',
    default: null
  },

  // ── Party ────────────────────────────────
  party: {
    type: mongoose.Schema.Types.ObjectId,
    ref:  'Party'
  },

  description: {
    type:  String,
    trim:  true
  },

  // ── Line items ────────────────────────────
  line_items: {
    type:    [lineItemSchema],
    default: []
  },

  discount: {
    type:    Number,
    default: 0,
    min:     0
  },

  subtotal: {
    type:    Number,
    default: 0
  },

  // ── Amounts ──────────────────────────────
  net_amount: {
    type:     Number,
    required: true,
    min:      0
  },
  vat_amount: {
    type:    Number,
    default: 0,
    min:     0
  },
  gross_amount: {
    type:     Number,
    required: true,
    min:      0
  },
  vat_applicable: {
    type:    Boolean,
    default: false
  },
  vat_percent: {
    type:    Number,
    default: 0,
    min:     0
  },

  // ── Payment ──────────────────────────────
  payment_method: {
    type:     String,
    enum:     ['cash', 'cheque', 'bank'],
    required: true
  },
  payment_ref: {
    type:  String,
    trim:  true
  },

  // ── Bill reference ────────────────────────
  bill_ref_type: {
    type:    String,
    enum:    ['bill', 'vat', 'none'],
    default: 'none'
  },
  bill_ref_number: {
    type:  String,
    trim:  true
  },

  // ── Accounting ────────────────────────────
  // debit and credit auto-set by pre-validate hook
  debit: {
    type:    Number,
    default: 0
  },
  credit: {
    type:    Number,
    default: 0
  },

  // ── Dates ─────────────────────────────────
  bs_date: {
    type:  String,
    trim:  true
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
  }

}, { timestamps: true });

// ── Indexes ───────────────────────────────
transactionSchema.index({ date: 1 });
transactionSchema.index({ type: 1 });
transactionSchema.index({ party: 1 });
transactionSchema.index({ category: 1 });
transactionSchema.index({ account: 1 });        // ADD
transactionSchema.index({ voucher_type: 1 });
transactionSchema.index({ tally_exported: 1 });

// ── Pre-validate hook ─────────────────────
transactionSchema.pre('validate', function (next) {

  // ── Step 1: calculate line items ─────────
  if (this.line_items && this.line_items.length > 0) {
    let subtotal = 0;
    this.line_items.forEach(item => {
      item.total  = Number(item.quantity || 1) * Number(item.unit_price || 0);
      subtotal   += item.total;
    });
    this.subtotal   = subtotal;
    this.net_amount = Math.max(0, subtotal - (this.discount || 0));
  } else {
    this.subtotal = this.net_amount || 0;
  }

  // ── Step 2: calculate VAT ─────────────────
  if (this.vat_applicable) {
    const net = this.net_amount || 0;

    if ((!this.vat_percent || this.vat_percent === 0) && this.vat_amount) {
      this.vat_percent = net > 0
        ? Math.round((this.vat_amount / net) * 100 * 100) / 100
        : 0;
    }

    if (!this.vat_percent || this.vat_percent === 0) {
      this.vat_percent = 13;
    }

    if (this.isModified('net_amount') || this.isModified('vat_percent') || !this.vat_amount) {
      this.vat_amount = Math.round(net * (this.vat_percent / 100) * 100) / 100;
    }

  } else {
    this.vat_percent = 0;
    this.vat_amount  = 0;
  }

  // ── Step 3: calculate gross ───────────────
  this.gross_amount = (this.net_amount || 0) + (this.vat_amount || 0);

  // ── Step 4: set debit and credit ─────────
  if (this.type === 'income') {
    this.debit  = this.gross_amount;
    this.credit = 0;
  } else {
    this.debit  = 0;
    this.credit = this.gross_amount;
  }

  // ── Step 5: set voucher_type ──────────────
  if (this.type === 'income') {
    this.voucher_type = 'receipt';
  } else if (this.type === 'expense') {
    this.voucher_type = 'payment';
  }

  // ── Step 6: sync account_code from account ref ──
  // if account is set but account_code is not
  // this keeps backward compatibility
  if (this.account && !this.account_code) {
    // account_code will be synced in controller
    // after populate — hook cannot populate refs
  }

  next();
});

export default mongoose.model('Transaction', transactionSchema);