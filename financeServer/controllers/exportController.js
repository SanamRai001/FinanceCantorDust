import Transaction  from '../models/Transaction.js';
import JournalEntry from '../models/JournalEntry.js';
import Account      from '../models/Account.js';
import Party        from '../models/Party.js';

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

// ── helper: map account type to Tally group ──
// converts our account types to Tally's standard groups
const tallyGroup = (account, partyType) => {
  if (!account) {
    // fall back to party type if no account linked
    if (partyType === 'supplier') return 'Sundry Creditors';
    if (partyType === 'employee') return 'Sundry Creditors';
    if (partyType === 'client')   return 'Sundry Debtors';
    return 'Sundry Debtors';
  }

  const groupMap = {
    // asset groups
    'current_asset':      'Current Assets',
    'fixed_asset':        'Fixed Assets',
    'other_asset':        'Loans & Advances (Asset)',

    // liability groups
    'current_liability':  'Current Liabilities',
    'long_term_liability':'Loans (Liability)',

    // equity groups
    'owners_equity':      'Capital Account',
    'retained_earnings':  'Reserves & Surplus',

    // income groups
    'operating_income':   'Sales Accounts',
    'other_income':       'Indirect Income',

    // expense groups
    'operating_expense':  'Indirect Expenses',
    'other_expense':      'Indirect Expenses',
  };

  // special cases — Tally has specific names for these
  if (account.code === '1110') return 'Cash-in-Hand';
  if (account.code === '1120') return 'Bank Accounts';
  if (account.code === '2120') return 'Duties & Taxes';
  if (account.code === '2130') return 'Duties & Taxes';

  return groupMap[account.group] || 'Indirect Expenses';
};

// ═══════════════════════════════════════════════════════════════
// GET /api/export/tally
// exports transactions + journal entries to Tally XML
// ═══════════════════════════════════════════════════════════════
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

    // fetch transactions and journal entries
    const [transactions, journalEntries, allAccounts] = await Promise.all([
      Transaction.find(filter)
        .populate('party',   'name vat_number pan_number type')
        .populate('account', 'code name type group')
        .sort({ date: 1 }),

      JournalEntry.find(
        req.query.from || req.query.to ? filter : {}
      )
        .populate('lines.account', 'code name type group')
        .sort({ date: 1 }),

      Account.find({ is_active: true }).sort({ code: 1 })
    ]);

    if (transactions.length === 0 && journalEntries.length === 0) {
      return res.status(404).json({
        success: false,
        error:   'No transactions or journal entries found for the selected period'
      });
    }

    // ── Step 1: build master ledger set ──────────────────────
    // collect every unique account name needed across
    // transactions and journal entries
    const ledgerMap = new Map();
    // key = ledger name, value = { name, group }

    // add all chart of accounts
    allAccounts.forEach(acc => {
      ledgerMap.set(acc.name, {
        name:  acc.name,
        group: tallyGroup(acc, null)
      });
    });

    // add party names from transactions
    transactions.forEach(txn => {
      const partyName = txn.party?.name;
      if (partyName && !ledgerMap.has(partyName)) {
        ledgerMap.set(partyName, {
          name:  partyName,
          group: tallyGroup(null, txn.party?.type)
        });
      }

      // add cash or bank if no account linked
      if (!txn.account) {
        const cashLedger = txn.payment_method === 'cash' ? 'Cash' : 'Bank Account';
        if (!ledgerMap.has(cashLedger)) {
          ledgerMap.set(cashLedger, {
            name:  cashLedger,
            group: cashLedger === 'Cash' ? 'Cash-in-Hand' : 'Bank Accounts'
          });
        }
      }
    });

    // ── Step 2: build Ledger Master XML ──────────────────────
    const ledgerMasters = [...ledgerMap.values()].map(ledger => `
          <LEDGER NAME="${escapeXml(ledger.name)}" ACTION="Create">
            <NAME>${escapeXml(ledger.name)}</NAME>
            <PARENT>${escapeXml(ledger.group)}</PARENT>
            <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
            <OPENINGBALANCE>0</OPENINGBALANCE>
          </LEDGER>`
    ).join('');

    // ── Step 3: build opening balance masters ────────────────
    // export accounts with opening balances as Tally ledgers
    const openingBalanceMasters = allAccounts
      .filter(acc => acc.opening_balance > 0)
      .map(acc => {
        const amount = acc.opening_balance_type === 'debit'
          ? -acc.opening_balance  // Tally uses negative for debit opening
          : acc.opening_balance;
        return `
          <LEDGER NAME="${escapeXml(acc.name)}" ACTION="Alter">
            <NAME>${escapeXml(acc.name)}</NAME>
            <OPENINGBALANCE>${amount}</OPENINGBALANCE>
          </LEDGER>`;
      }).join('');

    // ── Step 4: build Transaction Voucher XML ─────────────────
    const transactionVouchers = transactions.map(txn => {
      const partyName   = escapeXml(txn.party?.name || 'Sundry Account');
      const voucherType = txn.voucher_type === 'receipt' ? 'Receipt' : 'Payment';
      const amount      = txn.gross_amount;
      const narration   = escapeXml(txn.description || '');
      const refNumber   = escapeXml(txn.bill_ref_number || '');

      // use linked account name if available, otherwise cash/bank
      const cashLedger  = txn.payment_method === 'cash' ? 'Cash' : 'Bank Account';
      const accountName = txn.account?.name || cashLedger;

      // receipt → debit account, credit party
      // payment → debit party,   credit account
      const debitLedger  = txn.type === 'income'
        ? escapeXml(accountName)
        : partyName;
      const creditLedger = txn.type === 'income'
        ? partyName
        : escapeXml(accountName);

      // add VAT entry if applicable
      const vatEntry = txn.vat_applicable && txn.vat_amount > 0 ? `
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>VAT Payable</LEDGERNAME>
              <ISDEEMEDPOSITIVE>${txn.type === 'income' ? 'No' : 'Yes'}</ISDEEMEDPOSITIVE>
              <AMOUNT>${txn.type === 'income' ? txn.vat_amount : -txn.vat_amount}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>` : '';

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
              <AMOUNT>${txn.type === 'income' ? txn.net_amount : amount}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
            ${vatEntry}
          </VOUCHER>`;
    }).join('');

    // ── Step 5: build Journal Entry Voucher XML ───────────────
    const journalVouchers = journalEntries.map(entry => {
      const voucherType = entry.voucher_type === 'contra' ? 'Contra' : 'Journal';
      const narration   = escapeXml(entry.narration || '');
      const refNumber   = escapeXml(entry.reference_number || '');

      const lines = entry.lines.map(line => {
        const ledgerName  = escapeXml(line.account?.name || 'Sundry Account');
        const isDebit     = line.debit > 0;
        const amount      = isDebit ? line.debit : line.credit;

        return `
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${ledgerName}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>${isDebit ? 'Yes' : 'No'}</ISDEEMEDPOSITIVE>
              <AMOUNT>${isDebit ? -amount : amount}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>`;
      }).join('');

      return `
          <VOUCHER REMOTEID="${entry._id}" VCHTYPE="${voucherType}" ACTION="Create">
            <DATE>${tallyDate(entry.date)}</DATE>
            <NARRATION>${narration}</NARRATION>
            <VOUCHERTYPENAME>${voucherType}</VOUCHERTYPENAME>
            <VOUCHERNUMBER>${refNumber}</VOUCHERNUMBER>
            ${lines}
          </VOUCHER>`;
    }).join('');

    // ── Step 6: wrap in Tally XML envelope ───────────────────
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

        <!-- ── Ledger Masters ── -->
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          ${ledgerMasters}
        </TALLYMESSAGE>

        <!-- ── Opening Balances ── -->
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          ${openingBalanceMasters}
        </TALLYMESSAGE>

        <!-- ── Transaction Vouchers ── -->
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          ${transactionVouchers}
        </TALLYMESSAGE>

        <!-- ── Journal and Contra Vouchers ── -->
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          ${journalVouchers}
        </TALLYMESSAGE>

      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;

    // ── Step 7: mark transactions as exported ─────────────────
    await Promise.all([
      Transaction.updateMany(
        { _id: { $in: transactions.map(t => t._id) } },
        { tally_exported: true, tally_exported_at: new Date() }
      ),
      JournalEntry.updateMany(
        { _id: { $in: journalEntries.map(j => j._id) } },
        { tally_exported: true, tally_exported_at: new Date() }
      )
    ]);

    // ── Step 8: send as file download ─────────────────────────
    const filename = `tally-export-${Date.now()}.xml`;
    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(xml);

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};