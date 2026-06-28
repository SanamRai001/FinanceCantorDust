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

  // ── Accounts — two legs ───────────────────
  // account      = income/expense account
  //                e.g. Sales Revenue (4100), Office Rent (5100)
  // cash_account = cash or bank account
  //                e.g. Cash (1110), Bank Account (1120)
  //
  // Together they form a complete double entry:
  //
  // Income Rs. 10,000:
  //   Dr  Bank Account (1120)    10,000   ← cash_account debit
  //   Cr  Sales Revenue (4100)   10,000   ← account credit
  //
  // Expense Rs. 5,000:
  //   Dr  Office Rent (5100)     5,000    ← account debit
  //   Cr  Cash (1110)            5,000    ← cash_account credit

  account: {
    type:    mongoose.Schema.Types.ObjectId,
    ref:     'Account',
    default: null
    // income/expense account — optional for backward compatibility
    // but required for trial balance to work correctly
  },

  cash_account: {
    type:    mongoose.Schema.Types.ObjectId,
    ref:     'Account',
    default: null
    // cash or bank account — optional for backward compatibility
    // should always be set for new transactions
  },

  // kept for backward compatibility with old transactions
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

  // ── Accounting legs ───────────────────────
  // auto-set by pre-validate hook
  // do not touch these manually

  // account leg — income/expense account
  account_debit:  { type: Number, default: 0 },
  account_credit: { type: Number, default: 0 },

  // cash leg — cash/bank account
  cash_debit:  { type: Number, default: 0 },
  cash_credit: { type: Number, default: 0 },

  // legacy fields — kept for ledger display
  // equal to gross_amount, sign depends on type
  debit:  { type: Number, default: 0 },
  credit: { type: Number, default: 0 },

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
transactionSchema.index({ account: 1 });
transactionSchema.index({ cash_account: 1 });
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

  // ── Step 4: set voucher_type ──────────────
  if (this.type === 'income') {
    this.voucher_type = 'receipt';
  } else if (this.type === 'expense') {
    this.voucher_type = 'payment';
  }

  // ── Step 5: set double entry legs ─────────
  //
  // Standard double entry rules:
  // debit-normal accounts  → asset, expense
  // credit-normal accounts → liability, equity, income
  //
  // Income transaction:
  //   cash_account (asset)   → DEBIT  (asset increases)
  //   account (income)       → CREDIT (income increases)
  //
  // Expense transaction:
  //   account (expense)      → DEBIT  (expense increases)
  //   cash_account (asset)   → CREDIT (asset decreases)

  if (this.type === 'income') {
    // account leg — income account gets credited
    this.account_debit  = 0;
    this.account_credit = this.gross_amount;

    // cash leg — cash/bank account gets debited
    this.cash_debit  = this.gross_amount;
    this.cash_credit = 0;

  } else {
    // account leg — expense account gets debited
    this.account_debit  = this.gross_amount;
    this.account_credit = 0;

    // cash leg — cash/bank account gets credited
    this.cash_debit  = 0;
    this.cash_credit = this.gross_amount;
  }

  // ── Step 6: set legacy debit/credit ───────
  // kept for ledger display and running balance
  // income → debit (money in), expense → credit (money out)
  if (this.type === 'income') {
    this.debit  = this.gross_amount;
    this.credit = 0;
  } else {
    this.debit  = 0;
    this.credit = this.gross_amount;
  }

  next();
});

export default mongoose.model('Transaction', transactionSchema);