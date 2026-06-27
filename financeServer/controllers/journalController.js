import JournalEntry from '../models/JournalEntry.js';
import Account      from '../models/Account.js';

// ── GET all journal entries ───────────────
export const getJournalEntries = async (req, res) => {
  try {
    const filter = {};

    if (req.query.voucher_type) filter.voucher_type = req.query.voucher_type;
    if (req.query.from || req.query.to) {
      filter.date = {};
      if (req.query.from) filter.date.$gte = new Date(req.query.from);
      if (req.query.to)   filter.date.$lte = new Date(req.query.to);
    }
    if (req.query.keyword) {
      filter.narration = { $regex: req.query.keyword, $options: 'i' };
    }

    const entries = await JournalEntry.find(filter)
      .populate('lines.account', 'code name type')
      .populate('created_by',    'name email')
      .sort({ date: -1 });

    res.json({
      success: true,
      count:   entries.length,
      data:    entries
    });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── GET single journal entry ──────────────
export const getJournalEntryById = async (req, res) => {
  try {
    const entry = await JournalEntry.findById(req.params.id)
      .populate('lines.account', 'code name type group')
      .populate('created_by',    'name email');

    if (!entry) {
      return res.status(404).json({
        success: false,
        error:   'Journal entry not found'
      });
    }

    res.json({ success: true, data: entry });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── POST create journal entry ─────────────
export const createJournalEntry = async (req, res) => {
  try {
    const {
      date, bs_date, voucher_type,
      reference_number, narration, lines
    } = req.body;

    if (!lines || lines.length < 2) {
      return res.status(400).json({
        success: false,
        error:   'Journal entry must have at least 2 lines'
      });
    }

    // validate all accounts exist
    for (const line of lines) {
      if (!line.account) {
        return res.status(400).json({
          success: false,
          error:   'Each line must have an account'
        });
      }
      const accountExists = await Account.findById(line.account);
      if (!accountExists) {
        return res.status(400).json({
          success: false,
          error:   `Account not found for line — ${line.account}`
        });
      }
    }

    const entry = new JournalEntry({
      date,
      bs_date:          bs_date          || null,
      voucher_type:     voucher_type     || 'journal',
      reference_number: reference_number || null,
      narration,
      lines,
      created_by:       req.user._id,
      attachment:       req.file ? req.file.path : null
    });

    await entry.save();
    await entry.populate('lines.account', 'code name type');

    res.status(201).json({ success: true, data: entry });

  } catch (err) {
    // catch the balance error from pre-validate hook
    res.status(400).json({ success: false, error: err.message });
  }
};

// ── DELETE journal entry ──────────────────
// journal entries should not be edited — only deleted and re-entered
// this maintains audit trail integrity
export const deleteJournalEntry = async (req, res) => {
  try {
    const entry = await JournalEntry.findById(req.params.id);

    if (!entry) {
      return res.status(404).json({
        success: false,
        error:   'Journal entry not found'
      });
    }

    await entry.deleteOne();

    res.json({
      success: true,
      message: 'Journal entry deleted'
    });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};