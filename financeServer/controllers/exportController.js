import Transaction from '../models/Transaction.js';
import Party from '../models/Party.js';

// ── GET /api/export/tally ─────────────────────────────────────
// generates a Tally-compatible XML file for import
// query params: from, to, unexported_only
export const exportToTally = async (req, res) => {
  try {
    const filter = {};

    // date range filter
    if (req.query.from || req.query.to) {
      filter.date = {};
      if (req.query.from) filter.date.$gte = new Date(req.query.from);
      if (req.query.to)   filter.date.$lte = new Date(req.query.to);
    }

    // only export transactions not yet exported to Tally
    // pass ?unexported_only=true to use this
    if (req.query.unexported_only === 'true') {
      filter.tally_exported = false;
    }

    const transactions = await Transaction.find(filter)
      .populate('party', 'name vat_number pan_number type')
      .sort({ date: 1 });

    if (transactions.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No transactions found for the selected period'
      });
    }

    // ── Build Tally XML ───────────────────────────────────────
    // Tally Prime XML format for voucher import
    const xmlRows = transactions.map(txn => {

      const date = new Date(txn.date);
      // Tally date format is YYYYMMDD
      const tallyDate = `${date.getFullYear()}${String(date.getMonth()+1).padStart(2,'0')}${String(date.getDate()).padStart(2,'0')}`;

      const partyName    = txn.party?.name     || 'Unknown';
      const voucherType  = txn.voucher_type === 'receipt' ? 'Receipt' : 'Payment';
      const amount       = txn.gross_amount;
      const narration    = txn.description;
      const refNumber    = txn.bill_ref_number || '';

      // debit and credit ledger names for Tally
      // receipt  → debit: Cash/Bank, credit: party name
      // payment  → debit: party name, credit: Cash/Bank
      const cashLedger = txn.payment_method === 'cash' ? 'Cash' : 'Bank Account';

      const debitLedger  = txn.type === 'income' ? cashLedger : partyName;
      const creditLedger = txn.type === 'income' ? partyName  : cashLedger;

      return `
    <VOUCHER REMOTEID="${txn._id}" VCHTYPE="${voucherType}" ACTION="Create">
      <DATE>${tallyDate}</DATE>
      <NARRATION>${narration}</NARRATION>
      <VOUCHERTYPENAME>${voucherType}</VOUCHERTYPENAME>
      <VOUCHERNUMBER>${refNumber}</VOUCHERNUMBER>
      <ALLLEDGERENTRIES.LIST>
        <LEDGERNAME>${debitLedger}</LEDGERNAME>
        <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
        <AMOUNT>-${amount}</AMOUNT>
      </ALLLEDGERENTRIES.LIST>
      <ALLLEDGERENTRIES.LIST>
        <LEDGERNAME>${creditLedger}</LEDGERNAME>
        <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
        <AMOUNT>${amount}</AMOUNT>
      </ALLLEDGERENTRIES.LIST>
    </VOUCHER>`;
    }).join('');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>&#x20;;</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          ${xmlRows}
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;

    // ── Mark transactions as exported ─────────────────────────
    // update tally_exported flag so they are not exported again
    await Transaction.updateMany(
      { _id: { $in: transactions.map(t => t._id) } },
      { tally_exported: true, tally_exported_at: new Date() }
    );

    // ── Send XML file as download ──────────────────────────────
    const filename = `tally-export-${Date.now()}.xml`;
    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(xml);

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};