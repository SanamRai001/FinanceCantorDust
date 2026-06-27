import mongoose from 'mongoose';

const accountSchema = new mongoose.Schema({

  // ── Account code ──────────────────────────
  // standard Nepal chart of accounts numbering
  // 1000s = Assets, 2000s = Liabilities
  // 3000s = Equity, 4000s = Income, 5000s = Expenses
  code: {
    type:     String,
    required: true,
    unique:   true,
    trim:     true
    // e.g. "1100", "4200", "5100"
  },

  name: {
    type:     String,
    required: true,
    trim:     true
    // e.g. "Cash", "Sales Revenue", "Office Rent"
  },

  // ── Account type ──────────────────────────
  // top level classification
  type: {
    type:     String,
    required: true,
    enum:     ['asset', 'liability', 'equity', 'income', 'expense']
  },

  // ── Account group ─────────────────────────
  // sub classification within type
  // e.g. asset → current_asset, fixed_asset
  group: {
    type:    String,
    trim:    true,
    enum:    [
      // asset groups
      'current_asset', 'fixed_asset', 'other_asset',
      // liability groups
      'current_liability', 'long_term_liability',
      // equity groups
      'owners_equity', 'retained_earnings',
      // income groups
      'operating_income', 'other_income',
      // expense groups
      'operating_expense', 'other_expense'
    ]
  },

  // ── Parent account ────────────────────────
  // enables account hierarchy
  // e.g. "Bank Account" is child of "Assets"
  // null means it is a top level account
  parent: {
    type:    mongoose.Schema.Types.ObjectId,
    ref:     'Account',
    default: null
  },

  // ── Opening balance ───────────────────────
  // balance before system start date
  opening_balance: {
    type:    Number,
    default: 0
  },

  // for assets and expenses — opening balance is debit
  // for liabilities, equity, income — opening balance is credit
  opening_balance_type: {
    type:    String,
    enum:    ['debit', 'credit'],
    default: 'debit'
  },

  // ── Description ───────────────────────────
  description: {
    type:  String,
    trim:  true
  },

  // ── Flags ─────────────────────────────────
  is_active: {
    type:    Boolean,
    default: true
  },

  // system accounts cannot be deleted or renamed
  // e.g. Cash, Bank, VAT Payable
  is_system: {
    type:    Boolean,
    default: false
  }

}, { timestamps: true });

// ── Indexes ───────────────────────────────
accountSchema.index({ code: 1 });
accountSchema.index({ type: 1 });
accountSchema.index({ parent: 1 });
accountSchema.index({ is_active: 1 });

export default mongoose.model('Account', accountSchema);