import Transaction from '../models/Transaction.js';
import Party from '../models/Party.js';

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