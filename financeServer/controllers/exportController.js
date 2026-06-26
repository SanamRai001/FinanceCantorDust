import Transaction from '../models/Transaction.js';
import Party from '../models/Party.js';

// ── helper: escape XML special characters ─
const escapeXml = (str) => {
  if (!str) return '';
  return String(str)
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&apos;');
};

// ── helper: Tally date format YYYYMMDD ────
const tallyDate = (date) => {
  const d = new Date(date);
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
};

// ── GET /api/export/tally ─────────────────
export const exportToTally = async (req, res) => {
  try {
    const filter = {};

    if (req.query.from || req.query.to) {
      filter.date = {};
      if (req.query.from) filter.date.$gte = new Date(req.query.from);
      if (req.query.to)   filter.date.$lte = new Date(req.query.to);
    }

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

    // ── Step 1: collect all unique ledger names ───────────────
    // Tally needs to know every account before vouchers are posted
    // We collect all party names + cash/bank ledgers used
    const ledgerSet = new Set();

    transactions.forEach(txn => {
      const partyName  = txn.party?.name || 'Sundry Account';
      const cashLedger = txn.payment_method === 'cash' ? 'Cash' : 'Bank Account';
      ledgerSet.add(partyName);
      ledgerSet.add(cashLedger);
    });

    // ── Step 2: build Ledger Master XML ──────────────────────
    // This tells Tally "create these accounts first"
    // before any voucher tries to post into them
    const ledgerMasters = [...ledgerSet].map(name => {

      // determine which Tally group this ledger belongs to
      // Cash → Cash-in-Hand, Bank Account → Bank Accounts
      // party names → Sundry Debtors or Sundry Creditors
      let group = 'Sundry Debtors'; // default for unknown parties

      if (name === 'Cash') {
        group = 'Cash-in-Hand';
      } else if (name === 'Bank Account') {
        group = 'Bank Accounts';
      } else {
        // find the party from transactions to determine type
        const matchedTxn = transactions.find(t => t.party?.name === name);
        if (matchedTxn) {
          const partyType = matchedTxn.party?.type;
          if (partyType === 'supplier') group = 'Sundry Creditors';
          if (partyType === 'client')   group = 'Sundry Debtors';
          if (partyType === 'employee') group = 'Sundry Creditors';
        }
      }

      return `
          <LEDGER NAME="${escapeXml(name)}" ACTION="Create">
            <NAME>${escapeXml(name)}</NAME>
            <PARENT>${escapeXml(group)}</PARENT>
            <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
            <OPENINGBALANCE>0</OPENINGBALANCE>
          </LEDGER>`;
    }).join('');

    // ── Step 3: build Voucher XML ─────────────────────────────
    const vouchers = transactions.map(txn => {
      const partyName    = escapeXml(txn.party?.name || 'Sundry Account');
      const voucherType  = txn.voucher_type === 'receipt' ? 'Receipt' : 'Payment';
      const amount       = txn.gross_amount;
      const narration    = escapeXml(txn.description || '');
      const refNumber    = escapeXml(txn.bill_ref_number || '');
      const cashLedger   = txn.payment_method === 'cash' ? 'Cash' : 'Bank Account';

      // receipt → debit cash/bank, credit party
      // payment → debit party,      credit cash/bank
      const debitLedger  = txn.type === 'income' ? cashLedger : partyName;
      const creditLedger = txn.type === 'income' ? partyName  : cashLedger;

      return `
          <VOUCHER REMOTEID="${txn._id}" VCHTYPE="${voucherType}" ACTION="Create">
            <DATE>${tallyDate(txn.date)}</DATE>
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

    // ── Step 4: wrap in Tally XML envelope ───────────────────
    // Ledger masters come FIRST — vouchers come AFTER
    // This is the fix — Tally creates accounts before posting
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>All Masters and Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>&#x20;</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>

        <!-- ── Ledger Masters — created first ── -->
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          ${ledgerMasters}
        </TALLYMESSAGE>

        <!-- ── Vouchers — posted after masters ── -->
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          ${vouchers}
        </TALLYMESSAGE>

      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;

    // ── Step 5: mark as exported ──────────────────────────────
    await Transaction.updateMany(
      { _id: { $in: transactions.map(t => t._id) } },
      { tally_exported: true, tally_exported_at: new Date() }
    );

    // ── Step 6: send as file download ─────────────────────────
    const filename = `tally-export-${Date.now()}.xml`;
    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(xml);

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};