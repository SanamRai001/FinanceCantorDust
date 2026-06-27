import Account     from '../models/Account.js';
import Transaction from '../models/Transaction.js';
import JournalEntry from '../models/JournalEntry.js';

// ── GET all accounts ──────────────────────
export const getAccounts = async (req, res) => {
  try {
    const filter = {};

    if (req.query.type)   filter.type     = req.query.type;
    if (req.query.group)  filter.group    = req.query.group;
    if (req.query.active !== 'false') filter.is_active = true;

    const accounts = await Account.find(filter)
      .populate('parent', 'code name type')
      .sort({ code: 1 });

    res.json({
      success: true,
      count:   accounts.length,
      data:    accounts
    });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── GET single account ────────────────────
export const getSingleAccount = async (req, res) => {
  try {
    const account = await Account.findById(req.params.id)
      .populate('parent', 'code name type');

    if (!account) {
      return res.status(404).json({
        success: false,
        error:   'Account not found'
      });
    }

    // get child accounts
    const children = await Account.find({ parent: req.params.id })
      .sort({ code: 1 });

    // get transaction count for this account
    const txnCount = await Transaction.countDocuments({
      account: req.params.id
    });

    res.json({
      success:  true,
      data:     account,
      children,
      txn_count: txnCount
    });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── POST create account ───────────────────
export const createAccount = async (req, res) => {
  try {
    const {
      code, name, type, group,
      parent, opening_balance,
      opening_balance_type, description
    } = req.body;

    // check duplicate code
    const exists = await Account.findOne({ code });
    if (exists) {
      return res.status(400).json({
        success: false,
        error:   `Account code ${code} already exists`
      });
    }

    // validate parent exists if provided
    if (parent) {
      const parentAccount = await Account.findById(parent);
      if (!parentAccount) {
        return res.status(400).json({
          success: false,
          error:   'Parent account not found'
        });
      }
    }

    const account = await Account.create({
      code,
      name,
      type,
      group:                group                || null,
      parent:               parent               || null,
      opening_balance:      opening_balance      || 0,
      opening_balance_type: opening_balance_type || 'debit',
      description:          description          || null,
    });

    res.status(201).json({ success: true, data: account });

  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

// ── PUT update account ────────────────────
export const updateAccount = async (req, res) => {
  try {
    const account = await Account.findById(req.params.id);

    if (!account) {
      return res.status(404).json({
        success: false,
        error:   'Account not found'
      });
    }

    // system accounts cannot be renamed or have type changed
    if (account.is_system) {
      const protectedFields = ['code', 'name', 'type'];
      const attemptingChange = protectedFields.some(
        f => req.body[f] !== undefined && req.body[f] !== account[f]
      );
      if (attemptingChange) {
        return res.status(400).json({
          success: false,
          error:   'System accounts cannot have code, name or type changed'
        });
      }
    }

    const allowed = [
      'name', 'group', 'parent', 'description',
      'opening_balance', 'opening_balance_type', 'is_active'
    ];

    // only allow code change for non-system accounts
    if (!account.is_system) allowed.push('code');

    allowed.forEach(field => {
      if (req.body[field] !== undefined) account[field] = req.body[field];
    });

    await account.save();
    await account.populate('parent', 'code name type');

    res.json({ success: true, data: account });

  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

// ── DELETE account ────────────────────────
export const deleteAccount = async (req, res) => {
  try {
    const account = await Account.findById(req.params.id);

    if (!account) {
      return res.status(404).json({
        success: false,
        error:   'Account not found'
      });
    }

    // system accounts cannot be deleted
    if (account.is_system) {
      return res.status(400).json({
        success: false,
        error:   'System accounts cannot be deleted'
      });
    }

    // check if any transactions use this account
    const txnCount = await Transaction.countDocuments({
      account: req.params.id
    });

    // check if any journal entries use this account
    const journalCount = await JournalEntry.countDocuments({
      'lines.account': req.params.id
    });

    if (txnCount > 0 || journalCount > 0) {
      // soft delete — keep for historical data
      account.is_active = false;
      await account.save();
      return res.json({
        success:      true,
        message:      `Account deactivated — ${txnCount + journalCount} transaction(s)/journal(s) linked`,
        soft_deleted: true
      });
    }

    // check if any child accounts exist
    const childCount = await Account.countDocuments({
      parent: req.params.id
    });

    if (childCount > 0) {
      return res.status(400).json({
        success: false,
        error:   `Cannot delete — ${childCount} child account(s) exist under this account`
      });
    }

    await account.deleteOne();

    res.json({
      success:      true,
      message:      'Account permanently deleted',
      soft_deleted: false
    });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── GET account balance ───────────────────
// calculates current balance for an account
// from opening balance + all transactions
export const getAccountBalance = async (req, res) => {
  try {
    const account = await Account.findById(req.params.id);

    if (!account) {
      return res.status(404).json({
        success: false,
        error:   'Account not found'
      });
    }

    const filter = { account: req.params.id };

    if (req.query.from || req.query.to) {
      filter.date = {};
      if (req.query.from) filter.date.$gte = new Date(req.query.from);
      if (req.query.to)   filter.date.$lte = new Date(req.query.to);
    }

    const transactions = await Transaction.find(filter).sort({ date: 1 });

    const journalFilter = { 'lines.account': req.params.id };
    if (req.query.from || req.query.to) {
      journalFilter.date = {};
      if (req.query.from) journalFilter.date.$gte = new Date(req.query.from);
      if (req.query.to)   journalFilter.date.$lte = new Date(req.query.to);
    }
    const journalEntries = await JournalEntry.find(journalFilter);

    let total_debit  = account.opening_balance_type === 'debit'
                       ? account.opening_balance : 0;
    let total_credit = account.opening_balance_type === 'credit'
                       ? account.opening_balance : 0;

    transactions.forEach(txn => {
      total_debit  += txn.debit  || 0;
      total_credit += txn.credit || 0;
    });

    journalEntries.forEach(entry => {
      entry.lines.forEach(line => {
        if (line.account && line.account.toString() === req.params.id) {
          total_debit  += line.debit  || 0;
          total_credit += line.credit || 0;
        }
      });
    });

    // balance depends on account type
    // assets and expenses — debit balance is normal
    // liabilities, equity, income — credit balance is normal
    const isDebitNormal = ['asset', 'expense'].includes(account.type);
    const balance = isDebitNormal
      ? total_debit - total_credit
      : total_credit - total_debit;

    res.json({
      success: true,
      data: {
        account:       account.name,
        code:          account.code,
        type:          account.type,
        total_debit,
        total_credit,
        balance,
        txn_count:     transactions.length + journalEntries.length
      }
    });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── seed default chart of accounts ───────
// creates standard Nepal chart of accounts
// call once when setting up a new company
export const seedDefaultAccounts = async (req, res) => {
  try {
    const existing = await Account.countDocuments();
    if (existing > 0) {
      return res.status(400).json({
        success: false,
        error:   'Accounts already exist — seed only works on empty database'
      });
    }

    const defaults = [
      // ── Assets ──
      { code: '1000', name: 'Assets',              type: 'asset',     group: 'current_asset',   is_system: true  },
      { code: '1100', name: 'Current Assets',      type: 'asset',     group: 'current_asset',   is_system: true  },
      { code: '1110', name: 'Cash',                type: 'asset',     group: 'current_asset',   is_system: true  },
      { code: '1120', name: 'Bank Account',        type: 'asset',     group: 'current_asset',   is_system: true  },
      { code: '1130', name: 'Accounts Receivable', type: 'asset',     group: 'current_asset',   is_system: false },
      { code: '1200', name: 'Fixed Assets',        type: 'asset',     group: 'fixed_asset',     is_system: false },
      { code: '1210', name: 'Equipment',           type: 'asset',     group: 'fixed_asset',     is_system: false },
      { code: '1220', name: 'Furniture',           type: 'asset',     group: 'fixed_asset',     is_system: false },

      // ── Liabilities ──
      { code: '2000', name: 'Liabilities',         type: 'liability', group: 'current_liability', is_system: true  },
      { code: '2100', name: 'Current Liabilities', type: 'liability', group: 'current_liability', is_system: true  },
      { code: '2110', name: 'Accounts Payable',    type: 'liability', group: 'current_liability', is_system: false },
      { code: '2120', name: 'VAT Payable',         type: 'liability', group: 'current_liability', is_system: true  },
      { code: '2130', name: 'TDS Payable',         type: 'liability', group: 'current_liability', is_system: false },

      // ── Equity ──
      { code: '3000', name: 'Equity',              type: 'equity',    group: 'owners_equity',   is_system: true  },
      { code: '3100', name: 'Owner Capital',       type: 'equity',    group: 'owners_equity',   is_system: false },
      { code: '3200', name: 'Retained Earnings',   type: 'equity',    group: 'retained_earnings', is_system: false },

      // ── Income ──
      { code: '4000', name: 'Income',              type: 'income',    group: 'operating_income', is_system: true  },
      { code: '4100', name: 'Sales Revenue',       type: 'income',    group: 'operating_income', is_system: false },
      { code: '4200', name: 'Service Income',      type: 'income',    group: 'operating_income', is_system: false },
      { code: '4300', name: 'Other Income',        type: 'income',    group: 'other_income',     is_system: false },

      // ── Expenses ──
      { code: '5000', name: 'Expenses',            type: 'expense',   group: 'operating_expense', is_system: true  },
      { code: '5100', name: 'Office Rent',         type: 'expense',   group: 'operating_expense', is_system: false },
      { code: '5200', name: 'Salaries',            type: 'expense',   group: 'operating_expense', is_system: false },
      { code: '5300', name: 'Utilities',           type: 'expense',   group: 'operating_expense', is_system: false },
      { code: '5400', name: 'Office Supplies',     type: 'expense',   group: 'operating_expense', is_system: false },
      { code: '5500', name: 'Travel Expenses',     type: 'expense',   group: 'operating_expense', is_system: false },
      { code: '5600', name: 'Other Expenses',      type: 'expense',   group: 'other_expense',     is_system: false },
    ];

    // set parent references
    const created = await Account.insertMany(defaults);

    // now set parents — find by code and link
    const byCode = {};
    created.forEach(a => { byCode[a.code] = a._id; });

    await Account.findOneAndUpdate({ code: '1100' }, { parent: byCode['1000'] });
    await Account.findOneAndUpdate({ code: '1110' }, { parent: byCode['1100'] });
    await Account.findOneAndUpdate({ code: '1120' }, { parent: byCode['1100'] });
    await Account.findOneAndUpdate({ code: '1130' }, { parent: byCode['1100'] });
    await Account.findOneAndUpdate({ code: '1200' }, { parent: byCode['1000'] });
    await Account.findOneAndUpdate({ code: '1210' }, { parent: byCode['1200'] });
    await Account.findOneAndUpdate({ code: '1220' }, { parent: byCode['1200'] });
    await Account.findOneAndUpdate({ code: '2100' }, { parent: byCode['2000'] });
    await Account.findOneAndUpdate({ code: '2110' }, { parent: byCode['2100'] });
    await Account.findOneAndUpdate({ code: '2120' }, { parent: byCode['2100'] });
    await Account.findOneAndUpdate({ code: '2130' }, { parent: byCode['2100'] });
    await Account.findOneAndUpdate({ code: '3100' }, { parent: byCode['3000'] });
    await Account.findOneAndUpdate({ code: '3200' }, { parent: byCode['3000'] });
    await Account.findOneAndUpdate({ code: '4100' }, { parent: byCode['4000'] });
    await Account.findOneAndUpdate({ code: '4200' }, { parent: byCode['4000'] });
    await Account.findOneAndUpdate({ code: '4300' }, { parent: byCode['4000'] });
    await Account.findOneAndUpdate({ code: '5100' }, { parent: byCode['5000'] });
    await Account.findOneAndUpdate({ code: '5200' }, { parent: byCode['5000'] });
    await Account.findOneAndUpdate({ code: '5300' }, { parent: byCode['5000'] });
    await Account.findOneAndUpdate({ code: '5400' }, { parent: byCode['5000'] });
    await Account.findOneAndUpdate({ code: '5500' }, { parent: byCode['5000'] });
    await Account.findOneAndUpdate({ code: '5600' }, { parent: byCode['5000'] });

    res.status(201).json({
      success: true,
      message: `${created.length} default accounts created`,
      data:    created
    });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};