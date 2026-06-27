import Transaction from '../models/Transaction.js';
import Party       from '../models/Party.js';
import Category    from '../models/Category.js';
import Account from '../models/Account.js';
// ── GET all transactions (with filters) ───────────────────────
export const getTransactions = async (req, res) => {
  try {
    const filter = {};

    if (req.query.type) filter.type = req.query.type;

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
        else return res.json({ success: true, data: [], count: 0 });
      }
    }

    // ADD: category filter
    if (req.query.category) {
      filter.category = req.query.category;
    }

    // date range filter
    if (req.query.from || req.query.to) {
      filter.date = {};
      if (req.query.from) filter.date.$gte = new Date(req.query.from);
      if (req.query.to)   filter.date.$lte = new Date(req.query.to);
    }

    if (req.query.payment_method) {
      filter.payment_method = req.query.payment_method;
    }

    if (req.query.keyword) {
      filter.$or = [
        { description: { $regex: req.query.keyword, $options: 'i' } },
        { bs_date:     { $regex: req.query.keyword, $options: 'i' } }
      ];
    }

    const txns = await Transaction.find(filter)
      .populate('party',    'name vat_number pan_number type')
      .populate('category', 'name color type group')
      
      .sort({ date: 1 });

    let balance = 0;
    const txnsWithBalance = txns.map(txn => {
      const doc = txn.toObject();
      balance += txn.type === 'income' ? txn.gross_amount : -txn.gross_amount;
      doc.running_balance = balance;
      return doc;
    });

    res.json({
      success:         true,
      count:           txns.length,
      closing_balance: balance,
      data:            txnsWithBalance
    });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── GET single transaction by ID ──────────────────────────────
export const getTransactionById = async (req, res) => {
  try {
    const txn = await Transaction.findById(req.params.id)
      .populate('party',    'name vat_number pan_number type')
      .populate('category', 'name color type group');

    if (!txn) {
      return res.status(404).json({
        success: false,
        error:   'Transaction not found'
      });
    }

    res.json({ success: true, data: txn });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── helper: parse line items from FormData ────────────────────
// FormData cannot send nested arrays so we send them as JSON string
// and parse them here
const parseLineItems = (raw) => {
  if (!raw) return [];
  try {
    const items = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!Array.isArray(items)) return [];
    return items.map(item => ({
      name:       String(item.name       || '').trim(),
      quantity:   Number(item.quantity   || 1),
      unit_price: Number(item.unit_price || 0),
      total:      0 // hook calculates this
    })).filter(item => item.name && item.unit_price > 0);
  } catch {
    return [];
  }
};

// ── POST create transaction ───────────────────────────────────
export const createTransaction = async (req, res) => {
  try {
    const {
      date, type, party, description,
      net_amount, vat_applicable, vat_percent, vat_amount,
      payment_method, payment_ref,
      bill_ref_type, bill_ref_number,
      bs_date, category, discount,
      account
    } = req.body;
    if (account) {
  const accountExists = await Account.findById(account);
  if (!accountExists) {
    return res.status(400).json({
      success: false,
      error:   'Account not found'
    });
  }
}
const attachmentPath = req.file 
  ? req.file.path.replace(/\\/g, '/') // fix Windows backslashes
  : null;
    // validate party if provided
    if (party) {
      const partyExists = await Party.findById(party);
      if (!partyExists) {
        return res.status(400).json({
          success: false,
          error:   'Party not found — save the party first'
        });
      }
    }

    // validate category if provided
    if (category) {
      const catExists = await Category.findById(category);
      if (!catExists) {
        return res.status(400).json({
          success: false,
          error:   'Category not found'
        });
      }
    }

    // parse line items from FormData JSON string
    const line_items = parseLineItems(req.body.line_items);

    const txn = new Transaction({
      date,
      type,
      party:           party           || null,
      category:        category        || null,
      description:     description     || '',
      line_items,
      discount:        Number(discount || 0),
      // if line items exist, net_amount is calculated by the hook
      // if no line items, use what was sent
      net_amount:      line_items.length > 0 ? 0 : Number(net_amount || 0),
      vat_applicable:  vat_applicable === 'true' || vat_applicable === true,
      vat_percent:     Number(vat_percent || 0),
      vat_amount:      Number(vat_amount  || 0),
      gross_amount:    0, // hook calculates this
      payment_method,
      payment_ref:     payment_ref     || null,
      bill_ref_type:   bill_ref_type   || 'none',
      bill_ref_number: bill_ref_number || null,
      bs_date:         bs_date         || null,
attachment: attachmentPath,   // voucher_type — hook sets this
account: account || null,
    });

    await txn.save();
    await txn.populate([
      { path: 'party',    select: 'name vat_number type' },
      { path: 'category', select: 'name color type group' },
      { path: 'account',  select: 'code name type group' }
    ]);

    res.status(201).json({ success: true, data: txn });

  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

// ── PUT update transaction ────────────────────────────────────
export const updateTransaction = async (req, res) => {
  try {
    const txn = await Transaction.findById(req.params.id);

    if (!txn) {
      return res.status(404).json({
        success: false,
        error:   'Transaction not found'
      });
    }

   const allowed = [
  'date', 'type', 'party', 'category', 'account', // ADD account
  'description', 'net_amount', 'vat_applicable',
  'vat_percent', 'vat_amount', 'discount',
  'payment_method', 'payment_ref',
  'bill_ref_type', 'bill_ref_number', 'bs_date'
];

    allowed.forEach(field => {
      if (req.body[field] !== undefined) txn[field] = req.body[field];
    });

    // handle line items update
    const line_items = parseLineItems(req.body.line_items);
    if (line_items.length > 0) {
      txn.line_items  = line_items;
      txn.net_amount  = 0; // hook recalculates from line items
    }

    if (req.file) txn.attachment = req.file.path.replace(/\\/g, '/');

    await txn.save();
    await txn.populate([
      { path: 'party',    select: 'name vat_number type' },
      { path: 'category', select: 'name color type group' },
      { path: 'account',  select: 'code name type group' }
    ]);

    res.json({ success: true, data: txn });

  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

// ── DELETE transaction ────────────────────────────────────────
export const deleteTransaction = async (req, res) => {
  try {
    const txn = await Transaction.findById(req.params.id);

    if (!txn) {
      return res.status(404).json({
        success: false,
        error:   'Transaction not found'
      });
    }

    await txn.deleteOne();

    res.json({ success: true, message: 'Transaction deleted' });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};