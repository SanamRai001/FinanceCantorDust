import Transaction from '../models/Transaction.js';
import Party from '../models/Party.js';
import Account from '../models/Account.js';
import JournalEntry from '../models/JournalEntry.js';
// ── helper: build date filter ─────────────────────────────────
const buildDateFilter = (from, to) => {
  const filter = {};
  if (from || to) {
    filter.date = {};
    if (from) filter.date.$gte = new Date(from);
    if (to)   filter.date.$lte = new Date(to);
  }
  return filter;
};

// ═══════════════════════════════════════════════════════════════
// LEDGER
// ═══════════════════════════════════════════════════════════════
export const getLedger = async (req, res) => {
  try {
    const filter = buildDateFilter(req.query.from, req.query.to);

    if (req.query.type)           filter.type           = req.query.type;
    if (req.query.payment_method) filter.payment_method = req.query.payment_method;
    if (req.query.category)       filter.category       = req.query.category;

    if (req.query.party) {
      const isObjectId = req.query.party.match(/^[0-9a-fA-F]{24}$/);
      if (isObjectId) {
        filter.party = req.query.party;
      } else {
        const party = await Party.findOne({
          name: { $regex: req.query.party, $options: 'i' }
        });
        if (party) filter.party = party._id;
        else return res.json({
          success: true,
          data: [],
          summary: { total_debit: 0, total_credit: 0, closing_balance: 0 }
        });
      }
    }

    if (req.query.keyword) {
      filter.description = { $regex: req.query.keyword, $options: 'i' };
    }

    const transactions = await Transaction.find(filter)
      .populate('party',    'name type vat_number pan_number')
      .populate('category', 'name color type group')
      .sort({ date: 1 });

    let balance      = 0;
    let total_debit  = 0;
    let total_credit = 0;

    const rows = transactions.map(txn => {
      const doc    = txn.toObject();
      total_debit  += txn.debit;
      total_credit += txn.credit;
      balance      += txn.type === 'income' ? txn.gross_amount : -txn.gross_amount;
      doc.running_balance = balance;
      return doc;
    });

    res.json({
      success: true,
      count:   rows.length,
      summary: { total_debit, total_credit, closing_balance: balance },
      data:    rows
    });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ═══════════════════════════════════════════════════════════════
// PROFIT AND LOSS
// ═══════════════════════════════════════════════════════════════
export const getProfitLoss = async (req, res) => {
  try {
    const filter = buildDateFilter(req.query.from, req.query.to);

    const transactions = await Transaction.find(filter)
      .populate('party', 'name type')
      .sort({ date: 1 });

    const incomeList  = transactions.filter(t => t.type === 'income');
    const expenseList = transactions.filter(t => t.type === 'expense');

    const total_income  = incomeList .reduce((sum, t) => sum + t.gross_amount, 0);
    const total_expense = expenseList.reduce((sum, t) => sum + t.gross_amount, 0);
    const net_profit    = total_income - total_expense;

    const monthlyMap = {};
    transactions.forEach(txn => {
      const d   = new Date(txn.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!monthlyMap[key]) monthlyMap[key] = { month: key, income: 0, expense: 0, net: 0 };
      if (txn.type === 'income') monthlyMap[key].income  += txn.gross_amount;
      else                       monthlyMap[key].expense += txn.gross_amount;
      monthlyMap[key].net = monthlyMap[key].income - monthlyMap[key].expense;
    });

    const monthly_breakdown = Object.values(monthlyMap).sort((a, b) =>
      a.month.localeCompare(b.month)
    );

    const incomeByParty  = {};
    const expenseByParty = {};

    incomeList.forEach(txn => {
      const name = txn.party?.name || 'Unknown';
      incomeByParty[name] = (incomeByParty[name] || 0) + txn.gross_amount;
    });
    expenseList.forEach(txn => {
      const name = txn.party?.name || 'Unknown';
      expenseByParty[name] = (expenseByParty[name] || 0) + txn.gross_amount;
    });

    res.json({
      success: true,
      period:  { from: req.query.from || 'all time', to: req.query.to || 'all time' },
      summary: { total_income, total_expense, net_profit, is_profit: net_profit >= 0 },
      monthly_breakdown,
      income_by_party:  incomeByParty,
      expense_by_party: expenseByParty,
      income_list:      incomeList,
      expense_list:     expenseList
    });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ═══════════════════════════════════════════════════════════════
// VAT SUMMARY
// ═══════════════════════════════════════════════════════════════
export const getVATSummary = async (req, res) => {
  try {
    const filter = {
      ...buildDateFilter(req.query.from, req.query.to),
      vat_applicable: true
    };

    const transactions = await Transaction.find(filter)
      .populate('party', 'name vat_number pan_number type')
      .sort({ date: 1 });

    const inputVATList  = transactions.filter(t => t.type === 'expense');
    const outputVATList = transactions.filter(t => t.type === 'income');

    const total_input_vat  = inputVATList .reduce((sum, t) => sum + t.vat_amount, 0);
    const total_output_vat = outputVATList.reduce((sum, t) => sum + t.vat_amount, 0);
    const net_vat_payable  = total_output_vat - total_input_vat;

    const formatRow = (t) => ({
      date:           t.date,
      bs_date:        t.bs_date,
      party:          t.party?.name,
      voucher_type:   t.voucher_type,
      vat_number:     t.party?.vat_number,
      description:    t.description,
      bill_ref:       t.bill_ref_number,
      net_amount:     t.net_amount,
      vat_amount:     t.vat_amount,
      gross_amount:   t.gross_amount,
      payment_method: t.payment_method
    });

    res.json({
      success: true,
      period:  { from: req.query.from || 'all time', to: req.query.to || 'all time' },
      summary: { total_input_vat, total_output_vat, net_vat_payable, is_refund: net_vat_payable < 0 },
      input_vat:  { count: inputVATList.length,  total: total_input_vat,  rows: inputVATList.map(formatRow)  },
      output_vat: { count: outputVATList.length, total: total_output_vat, rows: outputVATList.map(formatRow) }
    });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ═══════════════════════════════════════════════════════════════
// CATEGORY REPORT
// Module 2 — Financial Reporting
// GET /api/reports/category
// query params: from, to, type, party, keyword
// returns transactions grouped by category
// totals visible to admin only — enforced on frontend
// ═══════════════════════════════════════════════════════════════
export const getCategoryReport = async (req, res) => {
  try {
    const filter = buildDateFilter(req.query.from, req.query.to);

    // optional filters — same as ledger
    if (req.query.type)    filter.type    = req.query.type;
    if (req.query.keyword) {
      filter.description = { $regex: req.query.keyword, $options: 'i' };
    }

    // party filter
    if (req.query.party) {
      const isObjectId = req.query.party.match(/^[0-9a-fA-F]{24}$/);
      if (isObjectId) {
        filter.party = req.query.party;
      } else {
        const party = await Party.findOne({
          name: { $regex: req.query.party, $options: 'i' }
        });
        if (party) filter.party = party._id;
        else return res.json({ success: true, data: [] });
      }
    }

    const transactions = await Transaction.find(filter)
      .populate('party',    'name type vat_number')
      .populate('category', 'name color type group')
      .sort({ date: 1 });

    // ── group transactions by category ────────
    const categoryMap = {};

    transactions.forEach(txn => {
      // use category id as key — null goes to Miscellaneous
      const catId    = txn.category?._id?.toString() || 'miscellaneous';
      const catName  = txn.category?.name  || 'Miscellaneous';
      const catColor = txn.category?.color || '#6B7280';
      const catGroup = txn.category?.group || 'general';
      const catType  = txn.category?.type  || 'both';

      if (!categoryMap[catId]) {
        categoryMap[catId] = {
          category_id:    catId,
          category_name:  catName,
          category_color: catColor,
          category_group: catGroup,
          category_type:  catType,
          transactions:   [],
          total_income:   0,
          total_expense:  0,
          net:            0,
          count:          0
        };
      }

      // add transaction to this category group
      categoryMap[catId].transactions.push({
        _id:            txn._id,
        date:           txn.date,
        bs_date:        txn.bs_date,
        type:           txn.type,
        party:          txn.party?.name || '—',
        description:    txn.description || '—',
        payment_method: txn.payment_method,
        gross_amount:   txn.gross_amount,
        debit:          txn.debit,
        credit:         txn.credit,
        voucher_type:   txn.voucher_type,
        attachment:     txn.attachment || null,
      });

      // accumulate totals
      if (txn.type === 'income') {
        categoryMap[catId].total_income += txn.gross_amount;
      } else {
        categoryMap[catId].total_expense += txn.gross_amount;
      }
      categoryMap[catId].net   = categoryMap[catId].total_income - categoryMap[catId].total_expense;
      categoryMap[catId].count += 1;
    });

    // ── sort — named categories first, Miscellaneous last ────
    const groups = Object.values(categoryMap).sort((a, b) => {
      if (a.category_id === 'miscellaneous') return 1;
      if (b.category_id === 'miscellaneous') return -1;
      return a.category_name.localeCompare(b.category_name);
    });

    // ── overall summary ───────────────────────
    const overall = groups.reduce((acc, g) => {
      acc.total_income  += g.total_income;
      acc.total_expense += g.total_expense;
      return acc;
    }, { total_income: 0, total_expense: 0 });

    overall.net_profit = overall.total_income - overall.total_expense;

    res.json({
      success: true,
      count:   transactions.length,
      period:  {
        from: req.query.from || 'all time',
        to:   req.query.to   || 'all time'
      },
      overall, // admin only — enforced on frontend
      data:    groups
    });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
// ═══════════════════════════════════════════════════════════════
// TRIAL BALANCE
// GET /api/reports/trial-balance
// query params: from, to
// shows all accounts with their debit and credit totals
// total debits must equal total credits for books to balance
// ═══════════════════════════════════════════════════════════════

export const getTrialBalance = async (req, res) => {
  try {
    const filter = buildDateFilter(req.query.from, req.query.to);

    // get all active accounts
    const accounts = await Account.find({ is_active: true })
      .sort({ code: 1 });

    // get all transactions in period
    const transactions = await Transaction.find(filter)
      .populate('account', 'code name type group');

    // get all journal entries in period
    const journalEntries = await JournalEntry.find(filter)
      .populate('lines.account', 'code name type');

    // build account balance map
    const balanceMap = {};

    // initialise all accounts with opening balances
    accounts.forEach(acc => {
      balanceMap[acc._id.toString()] = {
        account_id:   acc._id,
        code:         acc.code,
        name:         acc.name,
        type:         acc.type,
        group:        acc.group || '',
        debit:        acc.opening_balance_type === 'debit'  ? acc.opening_balance : 0,
        credit:       acc.opening_balance_type === 'credit' ? acc.opening_balance : 0,
      };
    });

    // add transaction amounts to each account
    transactions.forEach(txn => {
      if (!txn.account) return; // skip transactions with no account linked

      const key = txn.account._id.toString();
      if (!balanceMap[key]) return;

      balanceMap[key].debit  += txn.debit  || 0;
      balanceMap[key].credit += txn.credit || 0;
    });

    // add journal entry amounts to each account
    journalEntries.forEach(entry => {
      entry.lines.forEach(line => {
        if (!line.account) return;

        const key = line.account._id.toString();
        if (!balanceMap[key]) return;

        balanceMap[key].debit  += line.debit  || 0;
        balanceMap[key].credit += line.credit || 0;
      });
    });

    // calculate net balance per account
    // assets and expenses — debit normal balance
    // liabilities, equity, income — credit normal balance
    const rows = Object.values(balanceMap).map(row => {
      const isDebitNormal = ['asset', 'expense'].includes(row.type);
      const net_balance   = isDebitNormal
        ? row.debit - row.credit
        : row.credit - row.debit;

      return { ...row, net_balance };
    });

    // filter out zero balance accounts unless they have opening balance
    const nonZero = rows.filter(r => r.debit > 0 || r.credit > 0);

    // totals — must be equal for balanced books
    const total_debit  = nonZero.reduce((sum, r) => sum + r.debit,  0);
    const total_credit = nonZero.reduce((sum, r) => sum + r.credit, 0);
    const difference   = Math.abs(total_debit - total_credit);
    const is_balanced  = difference < 0.01;

    // group by account type for display
    const grouped = {
      asset:     nonZero.filter(r => r.type === 'asset'),
      liability: nonZero.filter(r => r.type === 'liability'),
      equity:    nonZero.filter(r => r.type === 'equity'),
      income:    nonZero.filter(r => r.type === 'income'),
      expense:   nonZero.filter(r => r.type === 'expense'),
    };

    res.json({
      success: true,
      period:  {
        from: req.query.from || 'all time',
        to:   req.query.to   || 'all time'
      },
      summary: {
        total_debit,
        total_credit,
        difference,
        is_balanced
      },
      data:    nonZero,
      grouped
    });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
// ═══════════════════════════════════════════════════════════════
// BALANCE SHEET
// GET /api/reports/balance-sheet
// query params: as_of (date to calculate balance sheet as of)
// shows assets = liabilities + equity at a point in time
// ═══════════════════════════════════════════════════════════════
export const getBalanceSheet = async (req, res) => {
  try {
    // balance sheet is always as of a specific date
    // default to today
    const asOf = req.query.as_of
      ? new Date(req.query.as_of)
      : new Date();

    // get all active accounts
    const accounts = await Account.find({ is_active: true })
      .sort({ code: 1 });

    // get all transactions up to asOf date
    const transactions = await Transaction.find({
      date: { $lte: asOf }
    }).populate('account', 'code name type group');

    // get all journal entries up to asOf date
    const journalEntries = await JournalEntry.find({
      date: { $lte: asOf }
    }).populate('lines.account', 'code name type');

    // ── build account balance map ─────────────
    const balanceMap = {};

    accounts.forEach(acc => {
      balanceMap[acc._id.toString()] = {
        account_id:   acc._id,
        code:         acc.code,
        name:         acc.name,
        type:         acc.type,
        group:        acc.group || '',
        balance:      acc.opening_balance_type === 'debit'
                        ? acc.opening_balance
                        : -acc.opening_balance
      };
    });

    // add transaction amounts
    transactions.forEach(txn => {
      if (!txn.account) return;
      const key = txn.account._id.toString();
      if (!balanceMap[key]) return;
      balanceMap[key].balance += (txn.debit || 0) - (txn.credit || 0);
    });

    // add journal entry amounts
    journalEntries.forEach(entry => {
      entry.lines.forEach(line => {
        if (!line.account) return;
        const key = line.account._id.toString();
        if (!balanceMap[key]) return;
        balanceMap[key].balance += (line.debit || 0) - (line.credit || 0);
      });
    });

    // ── group by type ─────────────────────────
    const allAccounts = Object.values(balanceMap);

    // assets — positive debit balance
    const assets = allAccounts
      .filter(a => a.type === 'asset' && a.balance !== 0)
      .map(a => ({ ...a, balance: a.balance }));

    // liabilities — positive credit balance (shown as positive)
    const liabilities = allAccounts
      .filter(a => a.type === 'liability' && a.balance !== 0)
      .map(a => ({ ...a, balance: -a.balance }));

    // equity — positive credit balance (shown as positive)
    const equity = allAccounts
      .filter(a => a.type === 'equity' && a.balance !== 0)
      .map(a => ({ ...a, balance: -a.balance }));

    // ── calculate net profit from income and expense ──
    // net profit is part of equity in balance sheet
    const incomeAccounts  = allAccounts.filter(a => a.type === 'income');
    const expenseAccounts = allAccounts.filter(a => a.type === 'expense');

    const total_income  = incomeAccounts .reduce((sum, a) => sum + (-a.balance), 0);
    const total_expense = expenseAccounts.reduce((sum, a) => sum + a.balance,    0);
    const net_profit    = total_income - total_expense;

    // ── totals ────────────────────────────────
    const total_assets      = assets     .reduce((sum, a) => sum + a.balance, 0);
    const total_liabilities = liabilities.reduce((sum, a) => sum + a.balance, 0);
    const total_equity      = equity     .reduce((sum, a) => sum + a.balance, 0) + net_profit;

    // assets should equal liabilities + equity
    const is_balanced = Math.abs(total_assets - (total_liabilities + total_equity)) < 0.01;

    res.json({
      success: true,
      as_of:   asOf,
      summary: {
        total_assets,
        total_liabilities,
        total_equity,
        net_profit,
        is_balanced
      },
      assets,
      liabilities,
      equity,
      net_profit_entry: {
        name:    'Net Profit / Loss (current period)',
        balance: net_profit
      }
    });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
// ═══════════════════════════════════════════════════════════════
// AGING REPORT
// GET /api/reports/aging
// query params: type (receivable/payable), as_of
// shows outstanding balances by party grouped by age
// ═══════════════════════════════════════════════════════════════
export const getAgingReport = async (req, res) => {
  try {
    const asOf = req.query.as_of
      ? new Date(req.query.as_of)
      : new Date();

    // type: receivable = money owed to us (income parties)
    //       payable    = money we owe (expense parties)
    const reportType = req.query.type || 'receivable';

    const txnType = reportType === 'receivable' ? 'income' : 'expense';

    // get all transactions up to asOf
    const transactions = await Transaction.find({
      date: { $lte: asOf },
      type: txnType
    }).populate('party', 'name vat_number pan_number type');

    // ── group by party ────────────────────────
    const partyMap = {};

    transactions.forEach(txn => {
      if (!txn.party) return;

      const partyId   = txn.party._id.toString();
      const partyName = txn.party.name;

      if (!partyMap[partyId]) {
        partyMap[partyId] = {
          party_id:   partyId,
          party_name: partyName,
          vat_number: txn.party.vat_number || null,
          total:      0,
          current:    0, // 0-30 days
          days_30:    0, // 31-60 days
          days_60:    0, // 61-90 days
          days_90:    0, // 90+ days overdue
          transactions: []
        };
      }

      // calculate age of transaction in days
      const txnDate = new Date(txn.date);
      const ageDays = Math.floor((asOf - txnDate) / (1000 * 60 * 60 * 24));

      partyMap[partyId].total += txn.gross_amount;

      // bucket by age
      if      (ageDays <= 30)  partyMap[partyId].current += txn.gross_amount;
      else if (ageDays <= 60)  partyMap[partyId].days_30 += txn.gross_amount;
      else if (ageDays <= 90)  partyMap[partyId].days_60 += txn.gross_amount;
      else                     partyMap[partyId].days_90 += txn.gross_amount;

      partyMap[partyId].transactions.push({
        _id:         txn._id,
        date:        txn.date,
        bs_date:     txn.bs_date,
        description: txn.description,
        amount:      txn.gross_amount,
        age_days:    ageDays
      });
    });

    const rows = Object.values(partyMap)
      .filter(p => p.total > 0)
      .sort((a, b) => b.total - a.total);

    // ── overall totals ────────────────────────
    const totals = rows.reduce((acc, p) => {
      acc.total   += p.total;
      acc.current += p.current;
      acc.days_30 += p.days_30;
      acc.days_60 += p.days_60;
      acc.days_90 += p.days_90;
      return acc;
    }, { total: 0, current: 0, days_30: 0, days_60: 0, days_90: 0 });

    res.json({
      success:     true,
      report_type: reportType,
      as_of:       asOf,
      totals,
      data:        rows
    });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};