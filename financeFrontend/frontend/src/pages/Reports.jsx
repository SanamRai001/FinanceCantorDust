import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import API from '../services/api';

const Reports = () => {
  const [ledger,  setLedger]  = useState([]);
  const [summary, setSummary] = useState({ total_debit: 0, total_credit: 0, closing_balance: 0 });
  const [parties, setParties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    from: '', to: '', type: '', party: '', keyword: ''
  });

  const fetchLedger = (params = {}) => {
    setLoading(true);
    API.get('/reports/ledger', { params })
      .then(res => {
        setLedger(res.data.data);
        setSummary(res.data.summary);
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchLedger();
    API.get('/party').then(res => setParties(res.data.data));
  }, []);

  const handleFilter = (e) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };

  const handleSearch = (e) => {
    e.preventDefault();
    const params = Object.fromEntries(
      Object.entries(filters).filter(([_, v]) => v !== '')
    );
    fetchLedger(params);
  };

  const handleReset = () => {
    setFilters({ from: '', to: '', type: '', party: '', keyword: '' });
    fetchLedger();
  };

  const fmt = (n) => Number(n || 0).toLocaleString('en-IN');

  // ── Tally XML export ──────────────────────
  const handleExportTally = async () => {
    try {
      const res = await API.get('/export/tally', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a   = document.createElement('a');
      a.href    = url;
      a.download = `tally-export-${Date.now()}.xml`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert('Export failed — ' + (err?.response?.data?.error || err.message));
    }
  };

  // ── Excel export ──────────────────────────
  const handleExportExcel = () => {
    if (ledger.length === 0) {
      alert('No data to export');
      return;
    }

    // build rows for the sheet
    const rows = ledger.map(t => ({
      'Date (BS)':       t.bs_date || new Date(t.date).toLocaleDateString(),
      'Date (AD)':       new Date(t.date).toLocaleDateString(),
      'Party':           t.party?.name  || '—',
      'Description':     t.description  || '—',
      'Voucher Type':    t.voucher_type || '—',
      'Payment Method':  t.payment_method || '—',
      'Bill Reference':  t.bill_ref_number || '—',
      'Debit (Rs.)':     t.debit  || 0,
      'Credit (Rs.)':    t.credit || 0,
      'Balance (Rs.)':   t.running_balance || 0,
    }));

    // add totals row at the bottom
    rows.push({
      'Date (BS)':       '',
      'Date (AD)':       '',
      'Party':           '',
      'Description':     'TOTALS',
      'Voucher Type':    '',
      'Payment Method':  '',
      'Bill Reference':  '',
      'Debit (Rs.)':     summary.total_debit,
      'Credit (Rs.)':    summary.total_credit,
      'Balance (Rs.)':   summary.closing_balance,
    });

    // create workbook
    const worksheet  = XLSX.utils.json_to_sheet(rows);
    const workbook   = XLSX.utils.book_new();

    // set column widths
    worksheet['!cols'] = [
      { wch: 14 }, // Date BS
      { wch: 14 }, // Date AD
      { wch: 20 }, // Party
      { wch: 30 }, // Description
      { wch: 14 }, // Voucher type
      { wch: 14 }, // Payment method
      { wch: 16 }, // Bill ref
      { wch: 14 }, // Debit
      { wch: 14 }, // Credit
      { wch: 14 }, // Balance
    ];

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Ledger');

    // generate filename with date range if filters applied
    const from     = filters.from || 'all';
    const to       = filters.to   || 'time';
    const filename = `ledger-${from}-to-${to}.xlsx`;

    XLSX.writeFile(workbook, filename);
  };

  return (
    <div className="reports">

      {/* Filters */}
      <form className="filter-bar" onSubmit={handleSearch}>
        <div className="form-group">
          <label>From</label>
          <input type="date" name="from" value={filters.from} onChange={handleFilter} />
        </div>
        <div className="form-group">
          <label>To</label>
          <input type="date" name="to" value={filters.to} onChange={handleFilter} />
        </div>
        <div className="form-group">
          <label>Type</label>
          <select name="type" value={filters.type} onChange={handleFilter}>
            <option value="">All</option>
            <option value="income">Income</option>
            <option value="expense">Expense</option>
          </select>
        </div>
        <div className="form-group">
          <label>Party</label>
          <select name="party" value={filters.party} onChange={handleFilter}>
            <option value="">All parties</option>
            {parties.map(p => (
              <option key={p._id} value={p._id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>Keyword</label>
          <input type="text" name="keyword" value={filters.keyword}
            onChange={handleFilter} placeholder="Search description..." />
        </div>
        <div className="filter-bar__actions">
          <button className="btn btn--primary" type="submit">Search</button>
          <button className="btn btn--ghost" type="button" onClick={handleReset}>Reset</button>
        </div>
      </form>

      {/* Summary cards */}
      <div className="summary-grid">
        <div className="card card--income">
          <div className="card__label">Total Debit</div>
          <div className="card__value">Rs. {fmt(summary.total_debit)}</div>
        </div>
        <div className="card card--expense">
          <div className="card__label">Total Credit</div>
          <div className="card__value">Rs. {fmt(summary.total_credit)}</div>
        </div>
        <div className="card card--profit">
          <div className="card__label">Closing Balance</div>
          <div className="card__value">Rs. {fmt(summary.closing_balance)}</div>
        </div>
      </div>

      {/* Export buttons */}
      <div className="export-bar">
        <button className="btn btn--ghost" onClick={() => window.print()}>
          Print Ledger
        </button>
        <button className="btn btn--ghost" onClick={handleExportExcel}>
          Export to Excel
        </button>
        <button className="btn btn--primary" onClick={handleExportTally}>
          Export to Tally XML
        </button>
      </div>

      {/* Ledger table */}
      <div className="table-card">
        {loading ? (
          <div className="table__empty">Loading...</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Party</th>
                <th>Description</th>
                <th>Voucher type</th>
                <th className="text-right">Debit (Rs.)</th>
                <th className="text-right">Credit (Rs.)</th>
                <th className="text-right">Balance (Rs.)</th>
              </tr>
            </thead>
            <tbody>
              {ledger.length === 0 && (
                <tr>
                  <td colSpan={7} className="table__empty">
                    No transactions found
                  </td>
                </tr>
              )}
              {ledger.map((t) => (
                <tr key={t._id} className={`row--${t.type}`}>
                  <td className="muted">
                    {t.bs_date || new Date(t.date).toLocaleDateString()}
                  </td>
                  <td className="bold">{t.party?.name || '—'}</td>
                  <td>{t.description}</td>
                  <td>
                    <span className={`badge badge--${t.voucher_type}`}>
                      {t.voucher_type}
                    </span>
                  </td>
                  <td className="text-right income">
                    {t.debit  ? fmt(t.debit)  : '—'}
                  </td>
                  <td className="text-right expense">
                    {t.credit ? fmt(t.credit) : '—'}
                  </td>
                  <td className={`text-right bold ${t.running_balance >= 0 ? 'income' : 'expense'}`}>
                    Rs. {fmt(t.running_balance)}
                  </td>
                </tr>
              ))}
            </tbody>
            {ledger.length > 0 && (
              <tfoot>
                <tr className="totals-row">
                  <td colSpan={4} className="bold">Totals</td>
                  <td className="text-right bold income">Rs. {fmt(summary.total_debit)}</td>
                  <td className="text-right bold expense">Rs. {fmt(summary.total_credit)}</td>
                  <td className="text-right bold">Rs. {fmt(summary.closing_balance)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        )}
      </div>

    </div>
  );
};

export default Reports;