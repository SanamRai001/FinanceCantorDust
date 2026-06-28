import JournalEntry from '../models/JournalEntry.js';
import Account      from '../models/Account.js';
import ExcelJS      from 'exceljs';

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

    let parsedLines = lines;
    if (typeof lines === 'string') {
      try {
        parsedLines = JSON.parse(lines);
      } catch (err) {
        return res.status(400).json({
          success: false,
          error:   'Invalid format for lines'
        });
      }
    }

    if (!parsedLines || !Array.isArray(parsedLines) || parsedLines.length < 2) {
      return res.status(400).json({
        success: false,
        error:   'Journal entry must have at least 2 lines'
      });
    }

    // validate all accounts exist
    for (const line of parsedLines) {
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
      lines:            parsedLines,
      created_by:       req.user._id,
      attachment:       req.file ? req.file.path.replace(/\\/g, '/') : null
    });

    await entry.save();
    await entry.populate('lines.account', 'code name type');

    res.status(201).json({ success: true, data: entry });

  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

// ── DELETE journal entry ──────────────────
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

// ── GET /api/journals/export/excel ────────
// exports all journal entries to a formatted Excel file
// each entry gets a header row + one row per line
export const exportJournalsExcel = async (req, res) => {
  try {
    const filter = {};

    if (req.query.from || req.query.to) {
      filter.date = {};
      if (req.query.from) filter.date.$gte = new Date(req.query.from);
      if (req.query.to)   filter.date.$lte = new Date(req.query.to);
    }
    if (req.query.voucher_type) {
      filter.voucher_type = req.query.voucher_type;
    }

    const entries = await JournalEntry.find(filter)
      .populate('lines.account', 'code name type')
      .populate('created_by',    'name email')
      .sort({ date: 1 });

    if (entries.length === 0) {
      return res.status(404).json({
        success: false,
        error:   'No journal entries found for the selected period'
      });
    }

    // ── build workbook ────────────────────────
    const workbook  = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Journal Entries');

    // ── column definitions ────────────────────
    worksheet.columns = [
      { header: 'Date',        key: 'date',        width: 14 },
      { header: 'BS Date',     key: 'bs_date',      width: 14 },
      { header: 'Type',        key: 'type',         width: 10 },
      { header: 'Reference',   key: 'reference',    width: 14 },
      { header: 'Narration',   key: 'narration',    width: 36 },
      { header: 'Account Code',key: 'code',         width: 12 },
      { header: 'Account Name',key: 'account',      width: 24 },
      { header: 'Description', key: 'description',  width: 24 },
      { header: 'Debit (Rs.)', key: 'debit',        width: 14 },
      { header: 'Credit (Rs.)',key: 'credit',        width: 14 },
    ];

    // ── style header row ──────────────────────
    worksheet.getRow(1).eachCell(cell => {
      cell.font      = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F3F7A' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border    = {
        bottom: { style: 'thin', color: { argb: 'FFE0DFDB' } }
      };
    });

    // ── add entries ───────────────────────────
    let totalDebit  = 0;
    let totalCredit = 0;

    entries.forEach((entry, entryIdx) => {
      const dateStr = new Date(entry.date).toLocaleDateString('en-IN');
      const isEven  = entryIdx % 2 === 0;
      const rowBg   = isEven ? 'FFFFFFFF' : 'FFF8F8F6';

      entry.lines.forEach((line, lineIdx) => {
        const row = worksheet.addRow({
          date:        lineIdx === 0 ? dateStr : '',
          bs_date:     lineIdx === 0 ? (entry.bs_date || '') : '',
          type:        lineIdx === 0 ? entry.voucher_type : '',
          reference:   lineIdx === 0 ? (entry.reference_number || '') : '',
          narration:   lineIdx === 0 ? entry.narration : '',
          code:        line.account?.code || '—',
          account:     line.account?.name || '—',
          description: line.description   || '',
          debit:       line.debit  > 0 ? line.debit  : null,
          credit:      line.credit > 0 ? line.credit : null,
        });

        // style the row
        row.eachCell(cell => {
          cell.fill = {
            type: 'pattern', pattern: 'solid',
            fgColor: { argb: rowBg }
          };
          cell.border = {
            bottom: { style: 'hair', color: { argb: 'FFE0DFDB' } }
          };
        });

        // right align debit and credit columns
        row.getCell('debit').alignment  = { horizontal: 'right' };
        row.getCell('credit').alignment = { horizontal: 'right' };

        // number format for amounts
        if (line.debit > 0) {
          row.getCell('debit').numFmt = '#,##0.00';
          totalDebit += line.debit;
        }
        if (line.credit > 0) {
          row.getCell('credit').numFmt = '#,##0.00';
          totalCredit += line.credit;
        }
      });

      // add a blank separator row between entries
      const sepRow = worksheet.addRow({});
      sepRow.height = 6;
    });

    // ── totals row ────────────────────────────
    const totalsRow = worksheet.addRow({
      narration: 'TOTALS',
      debit:     totalDebit,
      credit:    totalCredit,
    });

    totalsRow.eachCell(cell => {
      cell.font = { bold: true };
      cell.fill = {
        type: 'pattern', pattern: 'solid',
        fgColor: { argb: 'FFF1F0EE' }
      };
      cell.border = {
        top:    { style: 'thin', color: { argb: 'FFE0DFDB' } },
        bottom: { style: 'double', color: { argb: 'FF1F3F7A' } }
      };
    });

    totalsRow.getCell('debit').numFmt  = '#,##0.00';
    totalsRow.getCell('credit').numFmt = '#,##0.00';
    totalsRow.getCell('debit').alignment  = { horizontal: 'right' };
    totalsRow.getCell('credit').alignment = { horizontal: 'right' };

    // ── freeze header row ─────────────────────
    worksheet.views = [{ state: 'frozen', ySplit: 1 }];

    // ── send file ─────────────────────────────
    const filename = `journal-entries-${Date.now()}.xlsx`;
    res.setHeader('Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition',
      `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};