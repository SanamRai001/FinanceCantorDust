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
    // auto-calculated: quantity x unit_price
  }
}, { _id: true });

const transactionSchema = new mongoose.Schema({

  // ── Core fields ──────────────────────────────────────────────
  date: {
    type:     Date,
    required: true
  },
  type: {
    type:     String,
    enum:     ['income', 'expense'],
    required: true
  },

  // voucher_type maps to Tally's voucher classification
  // auto-set by pre-validate hook based on type
  // receipt  → income (money received from party)
  // payment  → expense (money paid to party)
  // journal  → internal adjustment (added later)
  // contra   → cash to bank or bank to cash (added later)
  voucher_type: {
    type:    String,
    enum:    ['receipt', 'payment', 'journal', 'contra'],
    default: null
  },

  // ── Category ─────────────────────────────────────────────────
  category: {
    type:    mongoose.Schema.Types.ObjectId,
    ref:     'Category',
    default: null
  },

  // ── Party ────────────────────────────────────────────────────
  party: {
    type: mongoose.Schema.Types.ObjectId,
    ref:  'Party'
  },

  description: {
    type:  String,
    trim:  true
  },

  // ── Line items ────────────────────────────────────────────────
  // array of items on this transaction
  // e.g. Office Chair x2 @ Rs.5000 = Rs.10,000
  // if line_items exist:
  //   subtotal     = sum of all item totals
  //   discount     = flat discount on whole bill
  //   net_amount   = subtotal - discount
  // if no line_items:
  //   user enters net_amount directly as before
  line_items: {
    type:    [lineItemSchema],
    default: []
  },

  // ── Discount ──────────────────────────────────────────────────
  // flat discount applied on the whole bill subtotal
  discount: {
    type:    Number,
    default: 0,
    min:     0
  },

  // subtotal = sum of all line item totals (before discount)
  subtotal: {
    type:    Number,
    default: 0
  },

  // ── Amounts ──────────────────────────────────────────────────
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

  // VAT flag — separates VATable vs exempt in Module 3
  vat_applicable: {
    type:    Boolean,
    default: false
  },
  vat_percent: {
    type:    Number,
    default: 0,
    min:     0
  },

  // ── Payment ──────────────────────────────────────────────────
  payment_method: {
    type:     String,
    enum:     ['cash', 'cheque', 'bank'],
    required: true
  },
  payment_ref: {
    type:  String,
    trim:  true
  },

  // ── Bill reference ───────────────────────────────────────────
  bill_ref_type: {
    type:    String,
    enum:    ['bill', 'vat', 'none'],
    default: 'none'
  },
  bill_ref_number: {
    type:  String,
    trim:  true
  },

  // ── Accounting ───────────────────────────────────────────────
  account_code: {
    type:  String,
    trim:  true
  },

  // debit and credit — auto-set by pre-validate hook
  // user never touches these
  debit: {
    type:    Number,
    default: 0
  },
  credit: {
    type:    Number,
    default: 0
  },

  // BS date stored as string — MongoDB stores AD internally
  bs_date: {
    type:  String,
    trim:  true
    // e.g. "2081-04-15"
  },

  // ── Attachment ───────────────────────────────────────────────
  attachment: {
    type:  String,
    trim:  true
    // e.g. "uploads/bill-1234.pdf"
  },

  // ── Tally export flag ─────────────────────────────────────────
  // tracks whether this transaction has been exported to Tally XML
  // so you never export the same transaction twice
  tally_exported: {
    type:    Boolean,
    default: false
  },
  tally_exported_at: {
    type:    Date,
    default: null
  }

}, {
  timestamps: true
});

// ── Indexes ───────────────────────────────────────────────────
transactionSchema.index({ date: 1 });
transactionSchema.index({ type: 1 });
transactionSchema.index({ party: 1 });
transactionSchema.index({ category: 1 });
transactionSchema.index({ voucher_type: 1 });
transactionSchema.index({ tally_exported: 1 });

// ── Pre-validate hook ─────────────────────────────────────────
transactionSchema.pre('validate', function (next) {

  // ── Step 1: calculate line items ─────────
  if (this.line_items && this.line_items.length > 0) {
    let subtotal = 0;
    this.line_items.forEach(item => {
      item.total  = Number(item.quantity || 1) * Number(item.unit_price || 0);
      subtotal   += item.total;
    });
    this.subtotal   = subtotal;
    // net = subtotal minus flat discount
    this.net_amount = Math.max(0, subtotal - (this.discount || 0));
  } else {
    // no line items — user entered net_amount directly
    this.subtotal = this.net_amount || 0;
  }

  // ── Step 2: calculate VAT ─────────────────
  if (this.vat_applicable) {
    const net = this.net_amount || 0;

    // calculate vat_percent from vat_amount if not set
    if ((!this.vat_percent || this.vat_percent === 0) && this.vat_amount) {
      this.vat_percent = net > 0
        ? Math.round((this.vat_amount / net) * 100 * 100) / 100
        : 0;
    }

    // default to Nepal standard 13% if no percent set
    if (!this.vat_percent || this.vat_percent === 0) {
      this.vat_percent = 13;
    }

    // recalculate vat_amount
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

  next();
});

export default mongoose.model('Transaction', transactionSchema);