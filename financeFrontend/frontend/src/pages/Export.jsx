import { useState } from 'react';
import API from '../services/api';
import { useAuth } from '../context/AuthContext';
import * as XLSX from 'xlsx';

const Export = () => {
  const { isAdmin }               = useAuth();
  const [tallyFilters, setTallyFilters] = useState({
    from:             '',
    to:               '',
    unexported_only:  false
  });
  const [excelFilters, setExcelFilters] = useState({
    from: '',
    to:   ''
  });
  const [loading, setLoading] = useState({
    tally:   false,
    ledger:  false,
    journal: false
  });
  const [lastExport, setLastExport] = useState(null);
  const [error,      setError]      = useState('');

  const setLoadingKey = (key, val) => {
    setLoading(prev => ({ ...prev, [key]: val }));
  };

  // ── Tally XML export ──────────────────────
  const handleTallyExport = async () => {
    setError('');
    setLoadingKey('tally', true);
    try {
      const params = {};
      if (tallyFilters.from)            params.from             = tallyFilters.from;
      if (tallyFilters.to)              params.to               = tallyFilters.to;
      if (tallyFilters.unexported_only) params.unexported_only  = 'true';

      const res = await API.get('/export/tally', {
        params,
        responseType: 'blob'
      });

      const url      = window.URL.createObjectURL(new Blob([res.data]));
      const a        = document.createElement('a');
      a.href         = url;
      a.download     = `tally-export-${Date.now()}.xml`;
      a.click();
      window.URL.revokeObjectURL(url);

      setLastExport({
        type: 'Tally XML',
        time: new Date().toLocaleTimeString(),
        date: new Date().toLocaleDateString()
      });
    } catch (err) {
      setError('Tally export failed — ' + (err?.response?.data?.error || err.message));
    } finally {
      setLoadingKey('tally', false);
    }
  };

  // ── Excel ledger export ───────────────────
  const handleLedgerExcel = async () => {
    setError('');
    setLoadingKey('ledger', true);
    try {
      const params = {};
      if (excelFilters.from) params.from = excelFilters.from;
      if (excelFilters.to)   params.to   = excelFilters.to;

      const res = await API.get('/reports/ledger', { params });
      const { data: rows, summary } = res.data;

      if (rows.length === 0) {
        setError('No transactions found for the selected period');
        return;
      }

      const excelRows = rows.map(t => ({
        'Date (BS)':      t.bs_date || new Date(t.date).toLocaleDateString(),
        'Date (AD)':      new Date(t.date).toLocaleDateString(),
        'Party':          t.party?.name     || '—',
        'Category':       t.category?.name  || '—',
        'Account Code':   t.account?.code   || '—',
        'Account Name':   t.account?.name   || '—',
        'Description':    t.description     || '—',
        'Voucher Type':   t.voucher_type    || '—',
        'Payment Method': t.payment_method  || '—',
        'Bill Reference': t.bill_ref_number || '—',
        'Debit (Rs.)':    t.debit           || 0,
        'Credit (Rs.)':   t.credit          || 0,
        'Balance (Rs.)':  t.running_balance || 0,
      }));

      // totals row
      excelRows.push({
        'Date (BS)': '', 'Date (AD)': '', 'Party': '',
        'Category': '', 'Account Code': '', 'Account Name': '',
        'Description': 'TOTALS', 'Voucher Type': '',
        'Payment Method': '', 'Bill Reference': '',
        'Debit (Rs.)':   summary.total_debit,
        'Credit (Rs.)':  summary.total_credit,
        'Balance (Rs.)': summary.closing_balance,
      });

      const worksheet = XLSX.utils.json_to_sheet(excelRows);
      const workbook  = XLSX.utils.book_new();
      worksheet['!cols'] = [
        { wch: 14 }, { wch: 14 }, { wch: 20 }, { wch: 16 },
        { wch: 10 }, { wch: 20 }, { wch: 30 }, { wch: 14 },
        { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 14 }
      ];
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Ledger');
      XLSX.writeFile(workbook,
        `ledger-${excelFilters.from || 'all'}-to-${excelFilters.to || 'time'}.xlsx`
      );

      setLastExport({
        type: 'Ledger Excel',
        time: new Date().toLocaleTimeString(),
        date: new Date().toLocaleDateString()
      });
    } catch (err) {
      setError('Ledger export failed — ' + (err?.response?.data?.error || err.message));
    } finally {
      setLoadingKey('ledger', false);
    }
  };

  // ── Journal Excel export ──────────────────
  const handleJournalExcel = async () => {
    setError('');
    setLoadingKey('journal', true);
    try {
      const params = {};
      if (excelFilters.from) params.from = excelFilters.from;
      if (excelFilters.to)   params.to   = excelFilters.to;

      const res = await API.get('/journals/export/excel', {
        params,
        responseType: 'blob'
      });

      const url  = window.URL.createObjectURL(new Blob([res.data]));
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `journal-entries-${Date.now()}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);

      setLastExport({
        type: 'Journal Excel',
        time: new Date().toLocaleTimeString(),
        date: new Date().toLocaleDateString()
      });
    } catch (err) {
      setError('Journal export failed — ' + (err?.response?.data?.error || err.message));
    } finally {
      setLoadingKey('journal', false);
    }
  };

  if (!isAdmin) return (
    <div className="role-notice">
      Exports are only available to admins.
    </div>
  );

  return (
    <div className="export-page">

      {error && (
        <div className="form-error">{error}</div>
      )}

      {lastExport && (
        <div className="role-notice" style={{ borderLeftColor: 'var(--green)' }}>
          Last export: <strong>{lastExport.type}</strong> at {lastExport.time} on {lastExport.date}
        </div>
      )}

      {/* ── Tally XML export ── */}
      <div className="export-section">
        <div className="export-section__header">
          <div>
            <h3 className="export-section__title">Tally XML Export</h3>
            <p className="export-section__desc">
              Exports all transactions and journal entries to Tally XML format.
              Includes ledger masters, opening balances, receipt vouchers,
              payment vouchers, journal vouchers and contra vouchers.
            </p>
          </div>
        </div>

        <div className="export-section__filters">
          <div className="form-group">
            <label>From Date</label>
            <input type="date" value={tallyFilters.from}
              onChange={e => setTallyFilters(p => ({ ...p, from: e.target.value }))} />
          </div>
          <div className="form-group">
            <label>To Date</label>
            <input type="date" value={tallyFilters.to}
              onChange={e => setTallyFilters(p => ({ ...p, to: e.target.value }))} />
          </div>
          <div className="form-group form-group--center">
            <label>Unexported only</label>
            <input type="checkbox"
              checked={tallyFilters.unexported_only}
              onChange={e => setTallyFilters(p => ({
                ...p, unexported_only: e.target.checked
              }))} />
          </div>
        </div>

        <div className="export-section__what">
          <span className="export-tag">✓ Transactions</span>
          <span className="export-tag">✓ Journal Entries</span>
          <span className="export-tag">✓ Ledger Masters</span>
          <span className="export-tag">✓ Opening Balances</span>
          <span className="export-tag">✓ VAT Split</span>
        </div>

        <button className="btn btn--primary"
          onClick={handleTallyExport}
          disabled={loading.tally}>
          {loading.tally ? 'Generating...' : 'Export to Tally XML'}
        </button>
      </div>

      {/* ── Excel exports ── */}
      <div className="export-section">
        <div className="export-section__header">
          <div>
            <h3 className="export-section__title">Excel Exports</h3>
            <p className="export-section__desc">
              Export ledger or journal entries to Excel.
              Use the same date range for both.
            </p>
          </div>
        </div>

        <div className="export-section__filters">
          <div className="form-group">
            <label>From Date</label>
            <input type="date" value={excelFilters.from}
              onChange={e => setExcelFilters(p => ({ ...p, from: e.target.value }))} />
          </div>
          <div className="form-group">
            <label>To Date</label>
            <input type="date" value={excelFilters.to}
              onChange={e => setExcelFilters(p => ({ ...p, to: e.target.value }))} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>

          {/* Ledger Excel */}
          <div className="export-card">
            <div className="export-card__title">Full Ledger</div>
            <div className="export-card__desc">
              All transactions with account codes, party names,
              categories, debit, credit and running balance.
            </div>
            <div className="export-section__what">
              <span className="export-tag">✓ Account codes</span>
              <span className="export-tag">✓ Running balance</span>
              <span className="export-tag">✓ All filters</span>
            </div>
            <button className="btn btn--ghost"
              onClick={handleLedgerExcel}
              disabled={loading.ledger}>
              {loading.ledger ? 'Generating...' : 'Download Ledger Excel'}
            </button>
          </div>

          {/* Journal Excel */}
          <div className="export-card">
            <div className="export-card__title">Journal Entries</div>
            <div className="export-card__desc">
              All journal and contra vouchers with account lines,
              debit and credit amounts. Formatted for accountants.
            </div>
            <div className="export-section__what">
              <span className="export-tag">✓ Formatted</span>
              <span className="export-tag">✓ Debit = Credit check</span>
              <span className="export-tag">✓ All lines</span>
            </div>
            <button className="btn btn--ghost"
              onClick={handleJournalExcel}
              disabled={loading.journal}>
              {loading.journal ? 'Generating...' : 'Download Journal Excel'}
            </button>
          </div>

        </div>
      </div>

    </div>
  );
};

export default Export;