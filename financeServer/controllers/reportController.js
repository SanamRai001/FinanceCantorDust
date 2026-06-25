import Transaction from '../models/Transaction.js';
import Party from '../models/Party.js';

// ── helper: build date filter ─────────────────────────────────
// reused across all three report functions
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
// Module 1 — Accounting and Bookkeeping
// GET /api/reports/ledger
// query params: from, to, type, party, keyword
// ═══════════════════════════════════════════════════════════════
export const getLedger = async (req, res) => {
  try {
    const filter = buildDateFilter(req.query.from, req.query.to);

    // optional filters
    if (req.query.type)    filter.type = req.query.type;
    if (req.query.payment_method) filter.payment_method = req.query.payment_method;

    // party filter — accepts ObjectId or name string
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

    // keyword search on description
    if (req.query.keyword) {
      filter.description = { $regex: req.query.keyword, $options: 'i' };
    }

    const transactions = await Transaction.find(filter)
      .populate('party', 'name type vat_number pan_number')
      .sort({ date: 1 });

    // calculate running balance row by row
    let balance      = 0;
    let total_debit  = 0;
    let total_credit = 0;

    const rows = transactions.map(txn => {
      const doc       = txn.toObject();
      total_debit    += txn.debit;
      total_credit   += txn.credit;
      balance        += txn.type === 'income'
                          ? txn.gross_amount
                          : -txn.gross_amount;
      doc.running_balance = balance;
      return doc;
    });

    res.json({
      success: true,
      count: rows.length,
      summary: {
        total_debit,
        total_credit,
        closing_balance: balance  // positive = money in hand, negative = deficit
      },
      data: rows
    });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ═══════════════════════════════════════════════════════════════
// PROFIT AND LOSS
// Module 2 — Financial Reporting
// GET /api/reports/pl
// query params: from, to
// ═══════════════════════════════════════════════════════════════
export const getProfitLoss = async (req, res) => {
  try {
    const filter = buildDateFilter(req.query.from, req.query.to);

    const transactions = await Transaction.find(filter)
      .populate('party', 'name type')
      .sort({ date: 1 });

    // split into income and expense
    const incomeList  = transactions.filter(t => t.type === 'income');
    const expenseList = transactions.filter(t => t.type === 'expense');

    // total income and expense
    const total_income  = incomeList .reduce((sum, t) => sum + t.gross_amount, 0);
    const total_expense = expenseList.reduce((sum, t) => sum + t.gross_amount, 0);
    const net_profit    = total_income - total_expense;

    // monthly breakdown — useful for charts on the frontend
    // groups transactions by year-month e.g. "2081-04"
    const monthlyMap = {};

    transactions.forEach(txn => {
      const d     = new Date(txn.date);
      const key   = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

      if (!monthlyMap[key]) {
        monthlyMap[key] = { month: key, income: 0, expense: 0, net: 0 };
      }

      if (txn.type === 'income')  monthlyMap[key].income  += txn.gross_amount;
      else                        monthlyMap[key].expense += txn.gross_amount;
      monthlyMap[key].net = monthlyMap[key].income - monthlyMap[key].expense;
    });

    const monthly_breakdown = Object.values(monthlyMap).sort((a, b) =>
      a.month.localeCompare(b.month)
    );

    // income breakdown by party — who paid you the most
    const incomeByParty = {};
    incomeList.forEach(txn => {
      const name = txn.party?.name || 'Unknown';
      incomeByParty[name] = (incomeByParty[name] || 0) + txn.gross_amount;
    });

    // expense breakdown by party — who you paid the most
    const expenseByParty = {};
    expenseList.forEach(txn => {
      const name = txn.party?.name || 'Unknown';
      expenseByParty[name] = (expenseByParty[name] || 0) + txn.gross_amount;
    });

    res.json({
      success: true,
      period: {
        from: req.query.from || 'all time',
        to:   req.query.to   || 'all time'
      },
      summary: {
        total_income,
        total_expense,
        net_profit,
        is_profit: net_profit >= 0  // false means it is a loss
      },
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
// Module 3 — Taxation and Compliance
// GET /api/reports/vat
// query params: from, to
// ═══════════════════════════════════════════════════════════════
export const getVATSummary = async (req, res) => {
  try {
    const filter = {
      ...buildDateFilter(req.query.from, req.query.to),
      vat_applicable: true   // only transactions where VAT was charged
    };

    const transactions = await Transaction.find(filter)
      .populate('party', 'name vat_number pan_number type')
      .sort({ date: 1 });

    // input VAT — VAT paid on purchases (expense transactions)
    // this is what you can claim back from IRD
    const inputVATList = transactions.filter(t => t.type === 'expense');

    // output VAT — VAT collected from clients (income transactions)
    // this is what you owe to IRD
    const outputVATList = transactions.filter(t => t.type === 'income');

    const total_input_vat  = inputVATList .reduce((sum, t) => sum + t.vat_amount, 0);
    const total_output_vat = outputVATList.reduce((sum, t) => sum + t.vat_amount, 0);

    // net VAT payable to IRD
    // positive = you owe IRD this amount
    // negative = IRD owes you a refund
    const net_vat_payable = total_output_vat - total_input_vat;

    // format input VAT rows for the report table
    const input_vat_rows = inputVATList.map(t => ({
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
    }));

    // format output VAT rows for the report table
    const output_vat_rows = outputVATList.map(t => ({
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
    }));

    res.json({
      success: true,
      period: {
        from: req.query.from || 'all time',
        to:   req.query.to   || 'all time'
      },
      summary: {
        total_input_vat,    // VAT you can claim from IRD
        total_output_vat,   // VAT you owe to IRD
        net_vat_payable,    // final amount — positive = pay, negative = refund
        is_refund: net_vat_payable < 0
      },
      input_vat: {
        count: inputVATList.length,
        total: total_input_vat,
        rows:  input_vat_rows
      },
      output_vat: {
        count: outputVATList.length,
        total: total_output_vat,
        rows:  output_vat_rows
      }
    });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};