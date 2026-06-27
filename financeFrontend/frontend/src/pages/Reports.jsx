import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import API from '../services/api';
import { useAuth } from '../context/AuthContext';
import getFileUrl from '../utils/getFileUrl';

const Reports = () => {
  const { isAdmin }                  = useAuth();
  const [activeTab,   setActiveTab]  = useState('ledger');
const [vat, setVat] = useState(null);
  // ledger state
  const [ledger,      setLedger]     = useState([]);
  const [summary,     setSummary]    = useState({ total_debit: 0, total_credit: 0, closing_balance: 0 });
const [expandedRows, setExpandedRows] = useState({});
const [trialBalance, setTrialBalance] = useState(null);
const [balanceSheet, setBalanceSheet] = useState(null);
const [aging,     setAging]     = useState(null);
const [agingType, setAgingType] = useState('receivable');
const [agingAsOf, setAgingAsOf] = useState('');
const [agingExpanded, setAgingExpanded] = useState({});

const toggleAging = (id) => {
  setAgingExpanded(prev => ({ ...prev, [id]: !prev[id] }));
};
const [asOf, setAsOf] = useState('');
const toggleRow = (id) => {
  setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
};
  // P&L state
  const [pl,          setPL]         = useState(null);

  // category state
  const [catReport,   setCatReport]  = useState([]);
  const [catOverall,  setCatOverall] = useState({ total_income: 0, total_expense: 0, net_profit: 0 });
  const [expanded,    setExpanded]   = useState({});

  // shared
  const [parties,     setParties]    = useState([]);
  const [categories,  setCategories] = useState([]);
  const [loading,     setLoading]    = useState(true);
  const [filters,     setFilters]    = useState({
    from: '', to: '', type: '', party: '', category: '', keyword: ''
  });
  const fetchVAT = (params = {}) => {
  setLoading(true);
  API.get('/reports/vat', { params })
    .then(res => setVat(res.data))
    .catch(err => console.error(err))
    .finally(() => setLoading(false));
};
const fetchTrialBalance = (params = {}) => {
  setLoading(true);
  API.get('/reports/trial-balance', { params })
    .then(res => setTrialBalance(res.data))
    .catch(err => console.error(err))
    .finally(() => setLoading(false));
};
const fetchBalanceSheet = (params = {}) => {
  setLoading(true);
  API.get('/reports/balance-sheet', { params })
    .then(res => setBalanceSheet(res.data))
    .catch(err => console.error(err))
    .finally(() => setLoading(false));
};
const fetchAging = (params = {}) => {
  setLoading(true);
  API.get('/reports/aging', { params })
    .then(res => {
      setAging(res.data);
      const exp = {};
      res.data.data.forEach(p => { exp[p.party_id] = false; });
      setAgingExpanded(exp);
    })
    .catch(err => console.error(err))
    .finally(() => setLoading(false));
};
useEffect(() => {
  const params = Object.fromEntries(
    Object.entries(filters).filter(([_, v]) => v !== '')
  );
  if (activeTab === 'ledger')         fetchLedger(params);
  if (activeTab === 'pl')             fetchPL(params);
  if (activeTab === 'category')       fetchCategoryReport(params);
  if (activeTab === 'vat')            fetchVAT(params);
  if (activeTab === 'trial-balance')  fetchTrialBalance(params);
  if (activeTab === 'balance-sheet')  fetchBalanceSheet(asOf ? { as_of: asOf } : {});
  if (activeTab === 'aging')          fetchAging({ type: agingType, ...(agingAsOf ? { as_of: agingAsOf } : {}) });
}, [activeTab]);

  // ── fetch functions ───────────────────────
  const fetchLedger = (params = {}) => {
    setLoading(true);
    API.get('/reports/ledger', { params })
      .then(res => { setLedger(res.data.data); setSummary(res.data.summary); })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  };

  const fetchPL = (params = {}) => {
    setLoading(true);
    API.get('/reports/pl', { params })
      .then(res => setPL(res.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  };

  const fetchCategoryReport = (params = {}) => {
    setLoading(true);
    API.get('/reports/category', { params })
      .then(res => {
        setCatReport(res.data.data);
        setCatOverall(res.data.overall);
        const exp = {};
        res.data.data.forEach(g => { exp[g.category_id] = true; });
        setExpanded(exp);
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchLedger();
    API.get('/party').then(res => setParties(res.data.data));
    API.get('/categories').then(res => setCategories(res.data.data));
  }, []);

  useEffect(() => {
    const params = Object.fromEntries(
      Object.entries(filters).filter(([_, v]) => v !== '')
    );
    if (activeTab === 'ledger')   fetchLedger(params);
    if (activeTab === 'pl')       fetchPL(params);
    if (activeTab === 'category') fetchCategoryReport(params);
  }, [activeTab]);

  const handleFilter = (e) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };

  const handleSearch = (e) => {
    e.preventDefault();
    const params = Object.fromEntries(
      Object.entries(filters).filter(([_, v]) => v !== '')
    );
    if (activeTab === 'ledger')   fetchLedger(params);
    if (activeTab === 'pl')       fetchPL(params);
    if (activeTab === 'category') fetchCategoryReport(params);
    if (activeTab === 'vat') fetchVAT(params);
    if (activeTab === 'trial-balance') fetchTrialBalance(params);
if (activeTab === 'balance-sheet') fetchBalanceSheet(asOf ? { as_of: asOf } : {});
if (activeTab === 'aging') fetchAging({ type: agingType, ...(agingAsOf ? { as_of: agingAsOf } : {}) });
  };

  const handleReset = () => {
    setFilters({ from: '', to: '', type: '', party: '', category: '', keyword: '' });
    if (activeTab === 'ledger')   fetchLedger();
    if (activeTab === 'pl')       fetchPL();
    if (activeTab === 'category') fetchCategoryReport();
    if (activeTab === 'vat') fetchVAT();
    if (activeTab === 'trial-balance') fetchTrialBalance();
    if (activeTab === 'balance-sheet') { setAsOf(''); fetchBalanceSheet();
      if (activeTab === 'aging') { setAgingAsOf(''); fetchAging({ type: agingType }); }
     }
  };

  const toggleExpand = (id) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const fmt = (n) => Number(n || 0).toLocaleString('en-IN');

  // ── Tally XML export ──────────────────────
  const handleExportTally = async () => {
    try {
      const res = await API.get('/export/tally', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a   = document.createElement('a');
      a.href     = url;
      a.download = `tally-export-${Date.now()}.xml`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Export failed — ' + (err?.response?.data?.error || err.message));
    }
  };

  // ── Excel export — ledger ─────────────────
  const handleExportExcel = () => {
    if (ledger.length === 0) { alert('No data to export'); return; }
    const rows = ledger.map(t => ({
      'Date (BS)':      t.bs_date || new Date(t.date).toLocaleDateString(),
      'Date (AD)':      new Date(t.date).toLocaleDateString(),
      'Party':          t.party?.name     || '—',
      'Category':       t.category?.name  || '—',
      'Description':    t.description     || '—',
      'Voucher Type':   t.voucher_type    || '—',
      'Payment Method': t.payment_method  || '—',
      'Bill Reference': t.bill_ref_number || '—',
      'Debit (Rs.)':    t.debit           || 0,
      'Credit (Rs.)':   t.credit          || 0,
      'Balance (Rs.)':  t.running_balance || 0,
    }));
    rows.push({
      'Date (BS)': '', 'Date (AD)': '', 'Party': '', 'Category': '',
      'Description': 'TOTALS', 'Voucher Type': '', 'Payment Method': '',
      'Bill Reference': '', 'Debit (Rs.)': summary.total_debit,
      'Credit (Rs.)': summary.total_credit, 'Balance (Rs.)': summary.closing_balance,
    });
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook  = XLSX.utils.book_new();
    worksheet['!cols'] = [
      { wch: 14 }, { wch: 14 }, { wch: 20 }, { wch: 16 },
      { wch: 30 }, { wch: 14 }, { wch: 14 }, { wch: 16 },
      { wch: 14 }, { wch: 14 }, { wch: 14 },
    ];
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Ledger');
    XLSX.writeFile(workbook, `ledger-${filters.from || 'all'}-to-${filters.to || 'time'}.xlsx`);
  };

  // ── Excel export — P&L ───────────────────
  const handleExportPLExcel = () => {
    if (!pl) { alert('No P&L data to export'); return; }

    const wb = XLSX.utils.book_new();

    // summary sheet
    const summaryRows = [
      { 'Item': 'Total Income',  'Amount (Rs.)': pl.summary.total_income  },
      { 'Item': 'Total Expense', 'Amount (Rs.)': pl.summary.total_expense },
      { 'Item': 'Net Profit',    'Amount (Rs.)': pl.summary.net_profit    },
    ];
    const summarySheet = XLSX.utils.json_to_sheet(summaryRows);
    summarySheet['!cols'] = [{ wch: 20 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary');

    // monthly breakdown sheet
    const monthlyRows = pl.monthly_breakdown.map(m => ({
      'Month':          m.month,
      'Income (Rs.)':   m.income,
      'Expense (Rs.)':  m.expense,
      'Net (Rs.)':      m.net,
    }));
    const monthlySheet = XLSX.utils.json_to_sheet(monthlyRows);
    monthlySheet['!cols'] = [{ wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, monthlySheet, 'Monthly');

    XLSX.writeFile(wb, `pl-report-${filters.from || 'all'}-to-${filters.to || 'time'}.xlsx`);
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
          <label>Category</label>
          <select name="category" value={filters.category} onChange={handleFilter}>
            <option value="">All categories</option>
            {categories.map(c => (
              <option key={c._id} value={c._id}>{c.name}</option>
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

      {/* Tabs */}
      <div className="report-tabs">
        <button className={`report-tab ${activeTab === 'ledger'   ? 'report-tab--active' : ''}`}
          onClick={() => setActiveTab('ledger')}>Ledger</button>
        <button className={`report-tab ${activeTab === 'pl'       ? 'report-tab--active' : ''}`}
          onClick={() => setActiveTab('pl')}>Profit & Loss</button>
        <button className={`report-tab ${activeTab === 'category' ? 'report-tab--active' : ''}`}
          onClick={() => setActiveTab('category')}>By Category</button>
          <button className={`report-tab ${activeTab === 'vat' ? 'report-tab--active' : ''}`}
  onClick={() => setActiveTab('vat')}>
  VAT Summary
</button>
<button className={`report-tab ${activeTab === 'trial-balance' ? 'report-tab--active' : ''}`}
  onClick={() => setActiveTab('trial-balance')}>
  Trial Balance
</button>
<button className={`report-tab ${activeTab === 'balance-sheet' ? 'report-tab--active' : ''}`}
  onClick={() => setActiveTab('balance-sheet')}>
  Balance Sheet
</button>
<button className={`report-tab ${activeTab === 'aging' ? 'report-tab--active' : ''}`}
  onClick={() => setActiveTab('aging')}>
  Aging Report
</button>
      </div>

     {/* ══ LEDGER TAB ══ */}
{activeTab === 'ledger' && (
  <>
    {/* Summary cards — admin only */}
    {isAdmin && (
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
    )}

    <div className="export-bar">
      <button className="btn btn--ghost" onClick={() => window.print()}>Print Ledger</button>
      <button className="btn btn--ghost" onClick={handleExportExcel}>Export to Excel</button>
      <button className="btn btn--primary" onClick={handleExportTally}>Export to Tally XML</button>
    </div>

    <div className="table-card">
      {loading ? <div className="table__empty">Loading...</div> : (
        <table className="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Party</th>
              <th>Category</th>
              <th>Description</th>
              <th>Voucher type</th>
              {isAdmin && <th className="text-right">Debit (Rs.)</th>}
              {isAdmin && <th className="text-right">Credit (Rs.)</th>}
              {isAdmin && <th className="text-right">Balance (Rs.)</th>}
              <th>Attachment</th>
            </tr>
          </thead>
          <tbody>
            {ledger.length === 0 && (
              <tr>
                <td colSpan={isAdmin ? 9 : 6} className="table__empty">
                  No transactions found
                </td>
              </tr>
            )}
            {ledger.map((t) => (
  <>
    <tr key={t._id} className={`row--${t.type}`}
      style={{ cursor: t.line_items?.length > 0 ? 'pointer' : 'default' }}
      onClick={() => t.line_items?.length > 0 && toggleRow(t._id)}>
      <td className="muted">{t.bs_date || new Date(t.date).toLocaleDateString()}</td>
      <td className="bold">{t.party?.name || '—'}</td>
      <td>
        {t.category ? (
          <span className="badge" style={{ background: t.category.color + '22', color: t.category.color }}>
            {t.category.name}
          </span>
        ) : '—'}
      </td>
      <td>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {t.description || '—'}
          {t.line_items?.length > 0 && (
            <span className="items-badge">
              {expandedRows[t._id] ? '▲' : '▼'} {t.line_items.length} item{t.line_items.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </td>
      <td><span className={`badge badge--${t.voucher_type}`}>{t.voucher_type}</span></td>
      {isAdmin && <td className="text-right income">{t.debit  ? fmt(t.debit)  : '—'}</td>}
      {isAdmin && <td className="text-right expense">{t.credit ? fmt(t.credit) : '—'}</td>}
      {isAdmin && (
        <td className={`text-right bold ${t.running_balance >= 0 ? 'income' : 'expense'}`}>
          Rs. {fmt(t.running_balance)}
        </td>
      )}
      <td>
        {t.attachment ? (
          <a href={getFileUrl(t.attachment)} target="_blank" rel="noreferrer"
            className="attachment-link"
            onClick={e => e.stopPropagation()}>
            View
          </a>
        ) : '—'}
      </td>
    </tr>

    {/* Line items expansion rows */}
    {expandedRows[t._id] && t.line_items?.length > 0 && t.line_items.map((item, i) => (
      <tr key={`${t._id}-item-${i}`} className="line-item-subrow">
        <td></td>
        <td></td>
        <td></td>
        <td style={{ paddingLeft: 40 }} className="muted">↳ {item.name}</td>
        <td></td>
        {isAdmin && <td className="text-right muted">{item.quantity}</td>}
        {isAdmin && <td className="text-right muted">Rs. {fmt(item.unit_price)}</td>}
        {isAdmin && <td className="text-right bold">Rs. {fmt(item.total)}</td>}
        <td></td>
      </tr>
    ))}
    {/* Discount subrow */}
    {expandedRows[t._id] && t.line_items?.length > 0 && t.discount > 0 && (
      <tr key={`${t._id}-discount`} className="line-item-subrow">
        <td></td>
        <td></td>
        <td></td>
        <td style={{ paddingLeft: 40 }} className="muted">↳ Discount</td>
        <td></td>
        {isAdmin && <td></td>}
        {isAdmin && <td></td>}
        {isAdmin && <td className="text-right expense">− Rs. {fmt(t.discount)}</td>}
        <td></td>
      </tr>
    )}
    {/* Net Amount subrow */}
    {expandedRows[t._id] && t.line_items?.length > 0 && (
      <tr key={`${t._id}-net`} className="line-item-subrow line-item-subrow--total">
        <td></td>
        <td></td>
        <td></td>
        <td style={{ paddingLeft: 40 }} className="bold">↳ Net Amount</td>
        <td></td>
        {isAdmin && <td></td>}
        {isAdmin && <td></td>}
        {isAdmin && <td className="text-right bold">Rs. {fmt(t.net_amount)}</td>}
        <td></td>
      </tr>
    )}
  </>
))}
          </tbody>
          {ledger.length > 0 && isAdmin && (
            <tfoot>
              <tr className="totals-row">
                <td colSpan={5} className="bold">Totals</td>
                <td className="text-right bold income">Rs. {fmt(summary.total_debit)}</td>
                <td className="text-right bold expense">Rs. {fmt(summary.total_credit)}</td>
                <td className="text-right bold">Rs. {fmt(summary.closing_balance)}</td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      )}
    </div>
  </>
)}

      {/* ══ P&L TAB ══ */}
      {activeTab === 'pl' && (
        <>
          {loading ? <div className="table__empty">Loading...</div> : !pl ? (
            <div className="table-card">
              <div className="table__empty">No data found</div>
            </div>
          ) : (
            <>
              {/* Summary cards — admin only */}
              {isAdmin && (
                <div className="summary-grid">
                  <div className="card card--income">
                    <div className="card__label">Total Income</div>
                    <div className="card__value">Rs. {fmt(pl.summary.total_income)}</div>
                  </div>
                  <div className="card card--expense">
                    <div className="card__label">Total Expense</div>
                    <div className="card__value">Rs. {fmt(pl.summary.total_expense)}</div>
                  </div>
                  <div className="card card--profit">
                    <div className="card__label">{pl.summary.is_profit ? 'Net Profit' : 'Net Loss'}</div>
                    <div className="card__value" style={{ color: pl.summary.is_profit ? 'var(--green)' : 'var(--red)' }}>
                      Rs. {fmt(Math.abs(pl.summary.net_profit))}
                    </div>
                  </div>
                </div>
              )}

              {/* Export */}
              {isAdmin && (
                <div className="export-bar">
                  <button className="btn btn--ghost" onClick={handleExportPLExcel}>
                    Export to Excel
                  </button>
                </div>
              )}

              {/* Monthly breakdown table */}
              {pl.monthly_breakdown.length > 0 && (
                <div className="table-card">
                  <div className="table-card__header">
                    <h4 className="table-card__title">Monthly Breakdown</h4>
                  </div>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Month</th>
                        {isAdmin && <th className="text-right">Income (Rs.)</th>}
                        {isAdmin && <th className="text-right">Expense (Rs.)</th>}
                        {isAdmin && <th className="text-right">Net (Rs.)</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {pl.monthly_breakdown.map(m => (
                        <tr key={m.month}>
                          <td className="bold">{m.month}</td>
                          {isAdmin && <td className="text-right income">Rs. {fmt(m.income)}</td>}
                          {isAdmin && <td className="text-right expense">Rs. {fmt(m.expense)}</td>}
                          {isAdmin && (
                            <td className={`text-right bold ${m.net >= 0 ? 'income' : 'expense'}`}>
                              Rs. {fmt(Math.abs(m.net))}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Income breakdown by party — admin only */}
              {isAdmin && Object.keys(pl.income_by_party).length > 0 && (
                <div className="pl-grid">
                  <div className="table-card">
                    <div className="table-card__header">
                      <h4 className="table-card__title">Income by Party</h4>
                    </div>
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Party</th>
                          <th className="text-right">Amount (Rs.)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(pl.income_by_party)
                          .sort(([,a],[,b]) => b - a)
                          .map(([name, amount]) => (
                            <tr key={name}>
                              <td className="bold">{name}</td>
                              <td className="text-right income">Rs. {fmt(amount)}</td>
                            </tr>
                          ))
                        }
                      </tbody>
                    </table>
                  </div>

                  <div className="table-card">
                    <div className="table-card__header">
                      <h4 className="table-card__title">Expense by Party</h4>
                    </div>
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Party</th>
                          <th className="text-right">Amount (Rs.)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(pl.expense_by_party)
                          .sort(([,a],[,b]) => b - a)
                          .map(([name, amount]) => (
                            <tr key={name}>
                              <td className="bold">{name}</td>
                              <td className="text-right expense">Rs. {fmt(amount)}</td>
                            </tr>
                          ))
                        }
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Non admin message */}
              {!isAdmin && (
                <div className="role-notice">
                  <span>Financial totals are visible to admins only. Showing monthly periods.</span>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ══ BY CATEGORY TAB ══ */}
      {activeTab === 'category' && (
        <>
          {isAdmin && (
            <div className="summary-grid">
              <div className="card card--income">
                <div className="card__label">Total Income</div>
                <div className="card__value">Rs. {fmt(catOverall.total_income)}</div>
              </div>
              <div className="card card--expense">
                <div className="card__label">Total Expense</div>
                <div className="card__value">Rs. {fmt(catOverall.total_expense)}</div>
              </div>
              <div className="card card--profit">
                <div className="card__label">Net Profit</div>
                <div className="card__value">Rs. {fmt(catOverall.net_profit)}</div>
              </div>
            </div>
          )}
          {loading ? (
            <div className="table__empty">Loading...</div>
          ) : catReport.length === 0 ? (
            <div className="table-card"><div className="table__empty">No transactions found</div></div>
          ) : (
            <div className="cat-groups">
              {catReport.map(group => (
                <div key={group.category_id} className="cat-group">
                  <div className="cat-group__header"
                    onClick={() => toggleExpand(group.category_id)}
                    style={{ borderLeft: `4px solid ${group.category_color}` }}>
                    <div className="cat-group__left">
                      <span className="cat-group__dot" style={{ background: group.category_color }} />
                      <span className="cat-group__name">{group.category_name}</span>
                      <span className="cat-group__count">
                        {group.count} transaction{group.count !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="cat-group__right">
                      {isAdmin && (
                        <div className="cat-group__totals">
                          {group.total_income > 0 && (
                            <span className="cat-total cat-total--income">+ Rs. {fmt(group.total_income)}</span>
                          )}
                          {group.total_expense > 0 && (
                            <span className="cat-total cat-total--expense">- Rs. {fmt(group.total_expense)}</span>
                          )}
                          <span className={`cat-total cat-total--net ${group.net >= 0 ? 'income' : 'expense'}`}>
                            Net: Rs. {fmt(Math.abs(group.net))}
                          </span>
                        </div>
                      )}
                      <span className="cat-group__toggle">{expanded[group.category_id] ? '▲' : '▼'}</span>
                    </div>
                  </div>
                  {expanded[group.category_id] && (
                    <div className="cat-group__body">
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Party</th>
                            <th>Description</th>
                            <th>Type</th>
                            <th>Payment</th>
                            <th className="text-right">Amount (Rs.)</th>
                            <th>Attachment</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.transactions.map(t => (
                            <tr key={t._id} className={`row--${t.type}`}>
                              <td className="muted">{t.bs_date || new Date(t.date).toLocaleDateString()}</td>
                              <td className="bold">{t.party || '—'}</td>
                              <td>{t.description || '—'}</td>
                              <td><span className={`badge badge--${t.type}`}>{t.type}</span></td>
                              <td className="muted">{t.payment_method}</td>
                              <td className={`text-right bold ${t.type}`}>Rs. {fmt(t.gross_amount)}</td>
                              <td>
                                {t.attachment ? (
                                  <a href={getFileUrl(t.attachment)} target="_blank" rel="noreferrer" className="attachment-link">View</a>
                                ) : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
{/* ══ VAT TAB ══ */}
{activeTab === 'vat' && (
  <>
    {loading ? <div className="table__empty">Loading...</div> : !vat ? (
      <div className="table-card"><div className="table__empty">No VAT data found</div></div>
    ) : (
      <>
        {/* Summary cards — admin only */}
        {isAdmin && (
          <div className="summary-grid">
            <div className="card card--income">
              <div className="card__label">Input VAT (purchases)</div>
              <div className="card__value" style={{ color: 'var(--green)' }}>
                Rs. {fmt(vat.summary.total_input_vat)}
              </div>
            </div>
            <div className="card card--expense">
              <div className="card__label">Output VAT (sales)</div>
              <div className="card__value" style={{ color: 'var(--red)' }}>
                Rs. {fmt(vat.summary.total_output_vat)}
              </div>
            </div>
            <div className="card card--profit">
              <div className="card__label">
                {vat.summary.is_refund ? 'VAT Refund from IRD' : 'Net VAT Payable to IRD'}
              </div>
              <div className="card__value"
                style={{ color: vat.summary.is_refund ? 'var(--green)' : 'var(--amber)' }}>
                Rs. {fmt(Math.abs(vat.summary.net_vat_payable))}
              </div>
            </div>
          </div>
        )}

        {/* Input VAT table */}
        <div className="table-card">
          <div className="table-card__header">
            <h4 className="table-card__title">
              Input VAT — purchases
              {isAdmin && <span className="muted" style={{ fontSize: 12, marginLeft: 8 }}>
                Total: Rs. {fmt(vat.input_vat.total)}
              </span>}
            </h4>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Party</th>
                <th>VAT Number</th>
                <th>Description</th>
                <th>Bill Ref</th>
                <th className="text-right">Net (Rs.)</th>
                {isAdmin && <th className="text-right">VAT (Rs.)</th>}
                {isAdmin && <th className="text-right">Gross (Rs.)</th>}
              </tr>
            </thead>
            <tbody>
              {vat.input_vat.rows.length === 0 && (
                <tr><td colSpan={8} className="table__empty">No input VAT transactions</td></tr>
              )}
              {vat.input_vat.rows.map((t, i) => (
                <tr key={i}>
                  <td className="muted">{t.bs_date || new Date(t.date).toLocaleDateString()}</td>
                  <td className="bold">{t.party || '—'}</td>
                  <td className="muted">{t.vat_number || '—'}</td>
                  <td>{t.description || '—'}</td>
                  <td className="muted">{t.bill_ref || '—'}</td>
                  <td className="text-right">Rs. {fmt(t.net_amount)}</td>
                  {isAdmin && <td className="text-right income">Rs. {fmt(t.vat_amount)}</td>}
                  {isAdmin && <td className="text-right bold">Rs. {fmt(t.gross_amount)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Output VAT table */}
        <div className="table-card">
          <div className="table-card__header">
            <h4 className="table-card__title">
              Output VAT — sales
              {isAdmin && <span className="muted" style={{ fontSize: 12, marginLeft: 8 }}>
                Total: Rs. {fmt(vat.output_vat.total)}
              </span>}
            </h4>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Party</th>
                <th>VAT Number</th>
                <th>Description</th>
                <th>Bill Ref</th>
                <th className="text-right">Net (Rs.)</th>
                {isAdmin && <th className="text-right">VAT (Rs.)</th>}
                {isAdmin && <th className="text-right">Gross (Rs.)</th>}
              </tr>
            </thead>
            <tbody>
              {vat.output_vat.rows.length === 0 && (
                <tr><td colSpan={8} className="table__empty">No output VAT transactions</td></tr>
              )}
              {vat.output_vat.rows.map((t, i) => (
                <tr key={i}>
                  <td className="muted">{t.bs_date || new Date(t.date).toLocaleDateString()}</td>
                  <td className="bold">{t.party || '—'}</td>
                  <td className="muted">{t.vat_number || '—'}</td>
                  <td>{t.description || '—'}</td>
                  <td className="muted">{t.bill_ref || '—'}</td>
                  <td className="text-right">Rs. {fmt(t.net_amount)}</td>
                  {isAdmin && <td className="text-right expense">Rs. {fmt(t.vat_amount)}</td>}
                  {isAdmin && <td className="text-right bold">Rs. {fmt(t.gross_amount)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Settlement box — admin only */}
        {isAdmin && (
          <div className="vat-settlement">
            <div className="vat-settlement__row">
              <span>Output VAT collected from clients</span>
              <span className="expense">Rs. {fmt(vat.summary.total_output_vat)}</span>
            </div>
            <div className="vat-settlement__row">
              <span>Input VAT paid on purchases</span>
              <span className="income">− Rs. {fmt(vat.summary.total_input_vat)}</span>
            </div>
            <div className="vat-settlement__row vat-settlement__row--total">
              <span>{vat.summary.is_refund ? 'IRD owes you (refund)' : 'Net payable to IRD'}</span>
              <span style={{ color: vat.summary.is_refund ? 'var(--green)' : 'var(--amber)' }}>
                Rs. {fmt(Math.abs(vat.summary.net_vat_payable))}
              </span>
            </div>
          </div>
        )}

        {!isAdmin && (
          <div className="role-notice">
            <span>VAT amounts are visible to admins only.</span>
          </div>
        )}
      </>
    )}
  </>
)}
{/* ══ TRIAL BALANCE TAB ══ */}
{activeTab === 'trial-balance' && (
  <>
    {loading ? <div className="table__empty">Loading...</div> :
    !trialBalance ? (
      <div className="table-card">
        <div className="table__empty">No data found — set up chart of accounts first</div>
      </div>
    ) : (
      <>
        {/* Balance status — admin only */}
        {isAdmin && (
          <div className="summary-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <div className="card card--income">
              <div className="card__label">Total Debit</div>
              <div className="card__value">Rs. {fmt(trialBalance.summary.total_debit)}</div>
            </div>
            <div className="card card--expense">
              <div className="card__label">Total Credit</div>
              <div className="card__value">Rs. {fmt(trialBalance.summary.total_credit)}</div>
            </div>
            <div className={`card ${trialBalance.summary.is_balanced ? 'card--profit' : 'card--expense'}`}>
              <div className="card__label">Status</div>
              <div className="card__value" style={{
                fontSize: 16,
                color: trialBalance.summary.is_balanced ? 'var(--green)' : 'var(--red)'
              }}>
                {trialBalance.summary.is_balanced ? '✓ Balanced' : '✗ Not balanced'}
              </div>
            </div>
          </div>
        )}

        {/* Export — admin only */}
        {isAdmin && (
          <div className="export-bar">
            <button className="btn btn--ghost" onClick={() => {
              if (!trialBalance) return;
              const rows = trialBalance.data.map(r => ({
                'Code':          r.code,
                'Account':       r.name,
                'Type':          r.type,
                'Debit (Rs.)':   r.debit,
                'Credit (Rs.)':  r.credit,
                'Balance (Rs.)': r.net_balance,
              }));
              rows.push({
                'Code': '', 'Account': 'TOTALS', 'Type': '',
                'Debit (Rs.)':   trialBalance.summary.total_debit,
                'Credit (Rs.)':  trialBalance.summary.total_credit,
                'Balance (Rs.)': '',
              });
              const ws = XLSX.utils.json_to_sheet(rows);
              const wb = XLSX.utils.book_new();
              ws['!cols'] = [{ wch: 8 }, { wch: 24 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];
              XLSX.utils.book_append_sheet(wb, ws, 'Trial Balance');
              XLSX.writeFile(wb, `trial-balance-${filters.from || 'all'}-to-${filters.to || 'time'}.xlsx`);
            }}>
              Export to Excel
            </button>
          </div>
        )}

        {/* Trial balance table grouped by account type */}
        {['asset', 'liability', 'equity', 'income', 'expense'].map(type => {
          const rows = trialBalance.grouped[type] || [];
          if (rows.length === 0) return null;
          return (
            <div key={type} className="table-card">
              <div className="table-card__header">
                <h4 className="table-card__title">
                  {type.charAt(0).toUpperCase() + type.slice(1)}s
                </h4>
              </div>
              <table className="table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Account Name</th>
                    {isAdmin && <th className="text-right">Debit (Rs.)</th>}
                    {isAdmin && <th className="text-right">Credit (Rs.)</th>}
                    {isAdmin && <th className="text-right">Balance (Rs.)</th>}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.account_id}>
                      <td className="mono muted">{r.code}</td>
                      <td className="bold">{r.name}</td>
                      {isAdmin && (
                        <td className="text-right income">
                          {r.debit > 0 ? `Rs. ${fmt(r.debit)}` : '—'}
                        </td>
                      )}
                      {isAdmin && (
                        <td className="text-right expense">
                          {r.credit > 0 ? `Rs. ${fmt(r.credit)}` : '—'}
                        </td>
                      )}
                      {isAdmin && (
                        <td className={`text-right bold ${r.net_balance >= 0 ? 'income' : 'expense'}`}>
                          Rs. {fmt(Math.abs(r.net_balance))}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}

        {!isAdmin && (
          <div className="role-notice">
            <span>Trial balance figures are visible to admins only.</span>
          </div>
        )}
      </>
    )}
  </>
)}
{/* ══ BALANCE SHEET TAB ══ */}
{activeTab === 'balance-sheet' && (
  <>
    {/* As of date filter — balance sheet is a snapshot not a period */}
    <div className="filter-bar" style={{ marginBottom: 0 }}>
      <div className="form-group">
        <label>As of Date</label>
        <input type="date" value={asOf}
          onChange={e => setAsOf(e.target.value)} />
      </div>
      <div className="filter-bar__actions">
        <button className="btn btn--primary"
          onClick={() => fetchBalanceSheet(asOf ? { as_of: asOf } : {})}>
          Generate
        </button>
        <button className="btn btn--ghost"
          onClick={() => { setAsOf(''); fetchBalanceSheet(); }}>
          Today
        </button>
      </div>
    </div>

    {loading ? <div className="table__empty">Loading...</div> :
    !balanceSheet ? (
      <div className="table-card">
        <div className="table__empty">No data — set up chart of accounts and opening balances first</div>
      </div>
    ) : (
      <>
        {/* Balance status — admin only */}
        {isAdmin && (
          <div className="summary-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <div className="card card--income">
              <div className="card__label">Total Assets</div>
              <div className="card__value">Rs. {fmt(balanceSheet.summary.total_assets)}</div>
            </div>
            <div className="card card--expense">
              <div className="card__label">Total Liabilities + Equity</div>
              <div className="card__value">
                Rs. {fmt(balanceSheet.summary.total_liabilities + balanceSheet.summary.total_equity)}
              </div>
            </div>
            <div className={`card ${balanceSheet.summary.is_balanced ? 'card--profit' : 'card--expense'}`}>
              <div className="card__label">Status</div>
              <div className="card__value" style={{
                fontSize: 16,
                color: balanceSheet.summary.is_balanced ? 'var(--green)' : 'var(--red)'
              }}>
                {balanceSheet.summary.is_balanced ? '✓ Balanced' : '✗ Not balanced'}
              </div>
            </div>
          </div>
        )}

        {/* Export — admin only */}
        {isAdmin && (
          <div className="export-bar">
            <button className="btn btn--ghost" onClick={() => {
              if (!balanceSheet) return;
              const wb   = XLSX.utils.book_new();

              // assets sheet
              const assetRows = balanceSheet.assets.map(a => ({
                'Code': a.code, 'Account': a.name,
                'Balance (Rs.)': a.balance
              }));
              assetRows.push({ 'Code': '', 'Account': 'TOTAL ASSETS',
                'Balance (Rs.)': balanceSheet.summary.total_assets });
              const assetSheet = XLSX.utils.json_to_sheet(assetRows);
              assetSheet['!cols'] = [{ wch: 8 }, { wch: 24 }, { wch: 16 }];
              XLSX.utils.book_append_sheet(wb, assetSheet, 'Assets');

              // liabilities sheet
              const liabRows = [
                ...balanceSheet.liabilities.map(a => ({
                  'Code': a.code, 'Account': a.name, 'Balance (Rs.)': a.balance
                })),
                ...balanceSheet.equity.map(a => ({
                  'Code': a.code, 'Account': a.name, 'Balance (Rs.)': a.balance
                })),
                { 'Code': '', 'Account': 'Net Profit / Loss',
                  'Balance (Rs.)': balanceSheet.summary.net_profit },
                { 'Code': '', 'Account': 'TOTAL LIABILITIES + EQUITY',
                  'Balance (Rs.)': balanceSheet.summary.total_liabilities + balanceSheet.summary.total_equity }
              ];
              const liabSheet = XLSX.utils.json_to_sheet(liabRows);
              liabSheet['!cols'] = [{ wch: 8 }, { wch: 24 }, { wch: 16 }];
              XLSX.utils.book_append_sheet(wb, liabSheet, 'Liabilities & Equity');

              XLSX.writeFile(wb, `balance-sheet-${asOf || 'today'}.xlsx`);
            }}>
              Export to Excel
            </button>
          </div>
        )}

        {isAdmin ? (
          <div className="pl-grid">

            {/* Assets side */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="table-card">
                <div className="table-card__header">
                  <h4 className="table-card__title">Assets</h4>
                </div>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Account</th>
                      <th className="text-right">Balance (Rs.)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {balanceSheet.assets.map(a => (
                      <tr key={a.account_id}>
                        <td className="mono muted">{a.code}</td>
                        <td>{a.name}</td>
                        <td className="text-right bold income">Rs. {fmt(a.balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="totals-row">
                      <td colSpan={2} className="bold">Total Assets</td>
                      <td className="text-right bold income">
                        Rs. {fmt(balanceSheet.summary.total_assets)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Liabilities and equity side */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="table-card">
                <div className="table-card__header">
                  <h4 className="table-card__title">Liabilities</h4>
                </div>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Account</th>
                      <th className="text-right">Balance (Rs.)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {balanceSheet.liabilities.length === 0 && (
                      <tr><td colSpan={3} className="table__empty">No liabilities</td></tr>
                    )}
                    {balanceSheet.liabilities.map(a => (
                      <tr key={a.account_id}>
                        <td className="mono muted">{a.code}</td>
                        <td>{a.name}</td>
                        <td className="text-right bold expense">Rs. {fmt(a.balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="totals-row">
                      <td colSpan={2} className="bold">Total Liabilities</td>
                      <td className="text-right bold expense">
                        Rs. {fmt(balanceSheet.summary.total_liabilities)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="table-card">
                <div className="table-card__header">
                  <h4 className="table-card__title">Equity</h4>
                </div>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Account</th>
                      <th className="text-right">Balance (Rs.)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {balanceSheet.equity.map(a => (
                      <tr key={a.account_id}>
                        <td className="mono muted">{a.code}</td>
                        <td>{a.name}</td>
                        <td className="text-right bold">Rs. {fmt(a.balance)}</td>
                      </tr>
                    ))}
                    {/* Net profit row */}
                    <tr>
                      <td className="muted">—</td>
                      <td>Net {balanceSheet.summary.net_profit >= 0 ? 'Profit' : 'Loss'} (current period)</td>
                      <td className={`text-right bold ${balanceSheet.summary.net_profit >= 0 ? 'income' : 'expense'}`}>
                        Rs. {fmt(Math.abs(balanceSheet.summary.net_profit))}
                      </td>
                    </tr>
                  </tbody>
                  <tfoot>
                    <tr className="totals-row">
                      <td colSpan={2} className="bold">Total Equity</td>
                      <td className="text-right bold">
                        Rs. {fmt(balanceSheet.summary.total_equity)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Grand total */}
              <div className="vat-settlement">
                <div className="vat-settlement__row vat-settlement__row--total">
                  <span>Total Liabilities + Equity</span>
                  <span className={balanceSheet.summary.is_balanced ? 'income' : 'expense'}>
                    Rs. {fmt(balanceSheet.summary.total_liabilities + balanceSheet.summary.total_equity)}
                  </span>
                </div>
              </div>
            </div>

          </div>
        ) : (
          <div className="role-notice">
            <span>Balance sheet is visible to admins only.</span>
          </div>
        )}
      </>
    )}
  </>
)}
{/* ══ AGING REPORT TAB ══ */}
{activeTab === 'aging' && (
  <>
    {/* Aging filters */}
    <div className="filter-bar" style={{ marginBottom: 0 }}>
      <div className="form-group">
        <label>Report Type</label>
        <select value={agingType}
          onChange={e => setAgingType(e.target.value)}>
          <option value="receivable">Receivable — money owed to us</option>
          <option value="payable">Payable — money we owe</option>
        </select>
      </div>
      <div className="form-group">
        <label>As of Date</label>
        <input type="date" value={agingAsOf}
          onChange={e => setAgingAsOf(e.target.value)} />
      </div>
      <div className="filter-bar__actions">
        <button className="btn btn--primary"
          onClick={() => fetchAging({ type: agingType, ...(agingAsOf ? { as_of: agingAsOf } : {}) })}>
          Generate
        </button>
        <button className="btn btn--ghost"
          onClick={() => { setAgingAsOf(''); fetchAging({ type: agingType }); }}>
          Today
        </button>
      </div>
    </div>

    {loading ? <div className="table__empty">Loading...</div> :
    !aging ? (
      <div className="table-card">
        <div className="table__empty">No data found</div>
      </div>
    ) : (
      <>
        {/* Summary cards — admin only */}
        {isAdmin && (
          <div className="summary-grid">
            <div className="card card--income">
              <div className="card__label">Current (0-30 days)</div>
              <div className="card__value">Rs. {fmt(aging.totals.current)}</div>
            </div>
            <div className="card">
              <div className="card__label">31-60 days</div>
              <div className="card__value" style={{ color: 'var(--amber)' }}>
                Rs. {fmt(aging.totals.days_30)}
              </div>
            </div>
            <div className="card">
              <div className="card__label">61-90 days</div>
              <div className="card__value" style={{ color: 'var(--amber)' }}>
                Rs. {fmt(aging.totals.days_60)}
              </div>
            </div>
            <div className="card card--expense">
              <div className="card__label">90+ days overdue</div>
              <div className="card__value">Rs. {fmt(aging.totals.days_90)}</div>
            </div>
          </div>
        )}

        {/* Export — admin only */}
        {isAdmin && aging.data.length > 0 && (
          <div className="export-bar">
            <button className="btn btn--ghost" onClick={() => {
              const rows = aging.data.map(p => ({
                'Party':           p.party_name,
                'VAT Number':      p.vat_number || '—',
                'Current (Rs.)':   p.current,
                '31-60 days':      p.days_30,
                '61-90 days':      p.days_60,
                '90+ days':        p.days_90,
                'Total (Rs.)':     p.total,
              }));
              rows.push({
                'Party': 'TOTALS', 'VAT Number': '',
                'Current (Rs.)':  aging.totals.current,
                '31-60 days':     aging.totals.days_30,
                '61-90 days':     aging.totals.days_60,
                '90+ days':       aging.totals.days_90,
                'Total (Rs.)':    aging.totals.total,
              });
              const ws = XLSX.utils.json_to_sheet(rows);
              const wb = XLSX.utils.book_new();
              ws['!cols'] = [
                { wch: 24 }, { wch: 14 }, { wch: 14 },
                { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 14 }
              ];
              XLSX.utils.book_append_sheet(wb, ws, 'Aging Report');
              XLSX.writeFile(wb, `aging-${agingType}-${agingAsOf || 'today'}.xlsx`);
            }}>
              Export to Excel
            </button>
          </div>
        )}

        {/* Aging table */}
        {aging.data.length === 0 ? (
          <div className="table-card">
            <div className="table__empty">
              No {agingType === 'receivable' ? 'receivable' : 'payable'} transactions found
            </div>
          </div>
        ) : (
          <div className="table-card">
            <table className="table">
              <thead>
                <tr>
                  <th>Party</th>
                  {isAdmin && <th className="text-right">Current</th>}
                  {isAdmin && <th className="text-right">31-60 days</th>}
                  {isAdmin && <th className="text-right">61-90 days</th>}
                  {isAdmin && <th className="text-right">90+ days</th>}
                  {isAdmin && <th className="text-right">Total</th>}
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {aging.data.map(p => (
                  <>
                    <tr key={p.party_id}>
                      <td className="bold">{p.party_name}</td>
                      {isAdmin && (
                        <td className="text-right income">
                          {p.current > 0 ? `Rs. ${fmt(p.current)}` : '—'}
                        </td>
                      )}
                      {isAdmin && (
                        <td className="text-right" style={{ color: p.days_30 > 0 ? 'var(--amber)' : 'var(--text-muted)' }}>
                          {p.days_30 > 0 ? `Rs. ${fmt(p.days_30)}` : '—'}
                        </td>
                      )}
                      {isAdmin && (
                        <td className="text-right" style={{ color: p.days_60 > 0 ? 'var(--amber)' : 'var(--text-muted)' }}>
                          {p.days_60 > 0 ? `Rs. ${fmt(p.days_60)}` : '—'}
                        </td>
                      )}
                      {isAdmin && (
                        <td className="text-right expense">
                          {p.days_90 > 0 ? `Rs. ${fmt(p.days_90)}` : '—'}
                        </td>
                      )}
                      {isAdmin && (
                        <td className="text-right bold">Rs. {fmt(p.total)}</td>
                      )}
                      <td>
                        <button className="btn btn--ghost btn--sm"
                          onClick={() => toggleAging(p.party_id)}>
                          {agingExpanded[p.party_id] ? 'Hide' : 'View'} ({p.transactions.length})
                        </button>
                      </td>
                    </tr>

                    {/* Transaction details */}
                    {agingExpanded[p.party_id] && p.transactions.map((t, i) => (
                      <tr key={`${p.party_id}-${i}`} className="line-item-subrow">
                        <td style={{ paddingLeft: 32 }} className="muted">
                          ↳ {t.bs_date || new Date(t.date).toLocaleDateString()}
                          {' — '}{t.description || 'No description'}
                        </td>
                        {isAdmin && <td></td>}
                        {isAdmin && <td></td>}
                        {isAdmin && <td></td>}
                        {isAdmin && <td></td>}
                        {isAdmin && (
                          <td className="text-right bold">Rs. {fmt(t.amount)}</td>
                        )}
                        <td className="muted" style={{ fontSize: 11 }}>
                          {t.age_days} days old
                        </td>
                      </tr>
                    ))}
                  </>
                ))}
              </tbody>
              {isAdmin && (
                <tfoot>
                  <tr className="totals-row">
                    <td className="bold">Totals</td>
                    <td className="text-right bold income">Rs. {fmt(aging.totals.current)}</td>
                    <td className="text-right bold" style={{ color: 'var(--amber)' }}>
                      Rs. {fmt(aging.totals.days_30)}
                    </td>
                    <td className="text-right bold" style={{ color: 'var(--amber)' }}>
                      Rs. {fmt(aging.totals.days_60)}
                    </td>
                    <td className="text-right bold expense">Rs. {fmt(aging.totals.days_90)}</td>
                    <td className="text-right bold">Rs. {fmt(aging.totals.total)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}

        {!isAdmin && (
          <div className="role-notice">
            <span>Aging report amounts are visible to admins only.</span>
          </div>
        )}
      </>
    )}
  </>
)}
    </div>
  );
};

export default Reports;