import Transaction from '../models/Transaction.js';
import Party from '../models/Party.js';

// ── GET all transactions (with filters) ───────────────────────
export const getTransactions = async (req, res) => {
  try {
    const filter = {};

    // type filter — income or expense
    if (req.query.type) filter.type = req.query.type;

    // FIX: party filter needs to handle both ObjectId and name search
    // if someone passes a party ID it works directly
    // if they pass a name string, find the party first then filter by _id
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

    // date range filter
    if (req.query.from || req.query.to) {
      filter.date = {};
      if (req.query.from) filter.date.$gte = new Date(req.query.from);
      if (req.query.to)   filter.date.$lte = new Date(req.query.to);
    }

    // ADD: payment method filter
    if (req.query.payment_method) {
      filter.payment_method = req.query.payment_method;
    }

    // ADD: keyword search across description and bs_date
    if (req.query.keyword) {
      filter.$or = [
        { description: { $regex: req.query.keyword, $options: 'i' } },
        { bs_date: { $regex: req.query.keyword, $options: 'i' } }
      ];
    }

    const txns = await Transaction.find(filter)
      .populate('party', 'name vat_number pan_number type') // FIX: populate party details
      .sort({ date: 1 });

    // ADD: calculate running balance across the result set
    let balance = 0;
    const txnsWithBalance = txns.map(txn => {
      const doc = txn.toObject();
      balance += txn.type === 'income' ? txn.gross_amount : -txn.gross_amount;
      doc.running_balance = balance;
      return doc;
    });

    res.json({
      success: true,
      count: txns.length,        // ADD: total count useful for frontend
      closing_balance: balance,  // ADD: final balance after all rows
      data: txnsWithBalance
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
};

// ── GET single transaction by ID ──────────────────────────────
export const getTransactionById = async (req, res) => {
  try {
    const txn = await Transaction.findById(req.params.id)
      .populate('party', 'name vat_number pan_number type');

    if (!txn) {
      return res.status(404).json({
        success: false,
        error: 'Transaction not found'
      });
    }

    res.json({ success: true, data: txn });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── POST create transaction ───────────────────────────────────
export const createTransaction = async (req, res) => {
  try {
    const {
      date, type, party, description,
      net_amount, vat_applicable, vat_amount, gross_amount,
      payment_method, payment_ref,
      bill_ref_type, bill_ref_number,
      bs_date,
      voucher_type
    } = req.body;

    // validate party exists before saving
    const partyExists = await Party.findById(party);
    if (!partyExists) {
      return res.status(400).json({
        success: false,
        error: 'Party not found — save the party first'
      });
    }

    const txn = new Transaction({
      date,
      type,
      party,
      description,
      net_amount,
      vat_applicable,
      vat_amount:   vat_amount   || 0,
      gross_amount: gross_amount || net_amount + (vat_amount || 0),
      payment_method,
      payment_ref:  payment_ref  || null,
      bill_ref_type:   bill_ref_type   || 'none',
      bill_ref_number: bill_ref_number || null,
      bs_date: bs_date || null,
      voucher_type: voucher_type || null,
      // attachment path set by multer middleware — not from req.body
      attachment: req.file ? req.file.path : null
    });

    await txn.save(); // pre-save hook sets debit and credit automatically

    // populate party before sending back so frontend gets the name
    await txn.populate({ path: 'party', select: 'name vat_number type' });

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
        error: 'Transaction not found'
      });
    }

    // update only fields that were sent
    const allowed = [
      'date', 'type', 'party', 'description',
      'net_amount', 'vat_applicable', 'vat_amount', 'gross_amount',
      'payment_method', 'payment_ref',
      'bill_ref_type', 'bill_ref_number', 'bs_date', 'voucher_type' 
    ];

    allowed.forEach(field => {
      if (req.body[field] !== undefined) txn[field] = req.body[field];
    });

    // update attachment if a new file was uploaded
    if (req.file) txn.attachment = req.file.path;

    await txn.save(); // pre-save hook recalculates debit, credit, gross
    await txn.populate({ path: 'party', select: 'name vat_number type' });

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
        error: 'Transaction not found'
      });
    }

    await txn.deleteOne();

    res.json({
      success: true,
      message: 'Transaction deleted'
    });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};