import Party from '../models/Party.js';
import Transaction from '../models/Transaction.js';

// ── GET all parties ───────────────────────────────────────────
export const getParties = async (req, res) => {
  try {
    const filter = {};

    // filter by type — supplier, client, employee, other
    if (req.query.type) filter.type = req.query.type;

    // filter active only — default true
    // pass ?active=false to get inactive ones too
    if (req.query.active !== 'false') filter.is_active = true;

    // keyword search on name
    if (req.query.keyword) {
      filter.name = { $regex: req.query.keyword, $options: 'i' };
    }

    const parties = await Party.find(filter).sort({ name: 1 });

    res.json({
      success: true,
      count: parties.length,
      data: parties
    });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── GET single party by ID ────────────────────────────────────
export const getSingleParty = async (req, res) => {
  try {
    const party = await Party.findById(req.params.id);

    if (!party) {
      return res.status(404).json({
        success: false,
        error: 'Party not found'
      });
    }

    // ADD: fetch transaction summary for this party
    // total received, total paid, and net balance
    const transactions = await Transaction.find({ party: req.params.id });

    const summary = transactions.reduce(
      (acc, txn) => {
        if (txn.type === 'income') acc.total_received += txn.gross_amount;
        else                       acc.total_paid     += txn.gross_amount;
        return acc;
      },
      { total_received: 0, total_paid: 0 }
    );

    summary.net_balance = summary.total_received - summary.total_paid;

    res.json({
      success: true,
      data: party,
      summary  // useful for party statement in Module 2
    });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── POST create party ─────────────────────────────────────────
export const createParty = async (req, res) => {
  try {
    const {
      name, type, phone, email, address,
      vat_number, pan_number,
      opening_balance, opening_balance_type,
      notes
    } = req.body;

    // check if party with same name already exists
    const exists = await Party.findOne({
      name: { $regex: `^${name}$`, $options: 'i' }
    });

    if (exists) {
      return res.status(400).json({
        success: false,
        error: `Party "${name}" already exists`
      });
    }

    const party = new Party({
      name,
      type,
      phone:        phone        || null,
      email:        email        || null,
      address:      address      || null,
      vat_number:   vat_number   || null,
      pan_number:   pan_number   || null,
      opening_balance:      opening_balance      || 0,
      opening_balance_type: opening_balance_type || 'none',
      notes: notes || null
    });

    await party.save();

    res.status(201).json({ success: true, data: party });

  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

// ── DELETE party ──────────────────────────────────────────────
export const deleteParty = async (req, res) => {
  try {
    const party = await Party.findById(req.params.id);

    if (!party) {
      return res.status(404).json({
        success: false,
        error: 'Party not found'
      });
    }

    // IMPORTANT: check if this party has transactions linked to it
    // hard deleting a party with transactions breaks the ledger
    // so we soft delete instead — set is_active to false
    const txnCount = await Transaction.countDocuments({
      party: req.params.id
    });

    if (txnCount > 0) {
      // soft delete — party stays in DB, just hidden from active list
      party.is_active = false;
      await party.save();

      return res.json({
        success: true,
        message: `Party deactivated — ${txnCount} transaction(s) linked to it so it cannot be permanently deleted`,
        soft_deleted: true
      });
    }

    // no transactions — safe to hard delete
    await party.deleteOne();

    res.json({
      success: true,
      message: 'Party permanently deleted',
      soft_deleted: false
    });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};