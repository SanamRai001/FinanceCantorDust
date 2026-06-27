import { useState, useEffect } from 'react';
import API from '../services/api';
import { useAuth } from '../context/AuthContext';
import { formatBS } from '../utils/bsDateConverter';

const Parties = () => {
  const [parties,       setParties]       = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [showForm,      setShowForm]      = useState(false);
  const [selectedParty, setSelectedParty] = useState(null);
  const [statement,     setStatement]     = useState(null);
  const [stmtLoading,   setStmtLoading]   = useState(false);
  const { canEdit, canDelete, isAdmin }   = useAuth();

  const [form, setForm] = useState({
    name: '', type: 'supplier', phone: '', vat_number: '', pan_number: ''
  });
  const [error, setError] = useState('');

  const fetchParties = () => {
    API.get('/party')
      .then(res => setParties(res.data.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchParties(); }, []);

  // ── open party statement ──────────────────
  const openStatement = (party) => {
    setSelectedParty(party);
    setStmtLoading(true);
    Promise.all([
      API.get(`/party/${party._id}`),
      API.get('/transactions', { params: { party: party._id } })
    ])
      .then(([partyRes, txnRes]) => {
        setStatement({
          summary:      partyRes.data.summary,
          transactions: txnRes.data.data || []
        });
      })
      .catch(err => console.error(err))
      .finally(() => setStmtLoading(false));
  };

  const closeStatement = () => {
    setSelectedParty(null);
    setStatement(null);
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await API.post('/party', form);
      setForm({ name: '', type: 'supplier', phone: '', vat_number: '', pan_number: '' });
      setShowForm(false);
      fetchParties();
    } catch (err) {
      setError(err?.response?.data?.error || 'Something went wrong');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this party?')) return;
    try {
      await API.delete(`/party/${id}`);
      fetchParties();
    } catch (err) {
      console.error(err);
    }
  };

  const fmt = (n) => 'Rs. ' + Number(n || 0).toLocaleString('en-IN');

  const totalReceivable = parties
    .filter(p => p.opening_balance_type === 'receivable')
    .reduce((sum, p) => sum + (p.opening_balance || 0), 0);

  const totalPayable = parties
    .filter(p => p.opening_balance_type === 'payable')
    .reduce((sum, p) => sum + (p.opening_balance || 0), 0);

  if (loading) return <div className="page-loading">Loading...</div>;

  return (
    <div className="parties">

      {/* Summary cards */}
      <div className="summary-grid">
        <div className="card">
          <div className="card__label">Total Parties</div>
          <div className="card__value">{parties.length}</div>
        </div>
        <div className="card card--income">
          <div className="card__label">Total Receivables</div>
          <div className="card__value">{fmt(totalReceivable)}</div>
        </div>
        <div className="card card--expense">
          <div className="card__label">Total Payables</div>
          <div className="card__value">{fmt(totalPayable)}</div>
        </div>
        <div className="card card--profit">
          <div className="card__label">Active Parties</div>
          <div className="card__value">{parties.filter(p => p.is_active).length}</div>
        </div>
      </div>

      {/* Header */}
      <div className="page-header">
        <h3 className="page-header__title">All Parties</h3>
        {canEdit && (
          <button className="btn btn--primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancel' : '+ Add Party'}
          </button>
        )}
      </div>

      {/* Create party form */}
      {showForm && (
        <form className="form-card" onSubmit={handleSubmit}>
          {error && <div className="form-error">{error}</div>}
          <div className="form-grid">
            <div className="form-group">
              <label>Party name *</label>
              <input name="name" value={form.name} onChange={handleChange}
                required placeholder="e.g. ABC Suppliers" />
            </div>
            <div className="form-group">
              <label>Type *</label>
              <select name="type" value={form.type} onChange={handleChange}>
                <option value="supplier">Supplier</option>
                <option value="client">Client</option>
                <option value="employee">Employee</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="form-group">
              <label>Phone</label>
              <input name="phone" value={form.phone} onChange={handleChange}
                placeholder="98XXXXXXXX" />
            </div>
            <div className="form-group">
              <label>VAT number</label>
              <input name="vat_number" value={form.vat_number} onChange={handleChange}
                placeholder="VAT registration no." />
            </div>
            <div className="form-group">
              <label>PAN number</label>
              <input name="pan_number" value={form.pan_number} onChange={handleChange}
                placeholder="PAN number" />
            </div>
          </div>
          <button className="btn btn--primary" type="submit">Save Party</button>
        </form>
      )}

      {/* Parties table */}
      <div className="table-card">
        <table className="table">
          <thead>
            <tr>
              <th>Party name</th>
              <th>Type</th>
              <th>VAT / PAN</th>
              <th>Phone</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {parties.length === 0 && (
              <tr><td colSpan={6} className="table__empty">No parties yet — add one above</td></tr>
            )}
            {parties.map(p => (
              <tr key={p._id}>
                <td>
                  <button
                    className="party-name-btn"
                    onClick={() => openStatement(p)}
                  >
                    {p.name}
                  </button>
                </td>
                <td><span className={`badge badge--${p.type}`}>{p.type}</span></td>
                <td className="muted">{p.vat_number || p.pan_number || '—'}</td>
                <td className="muted">{p.phone || '—'}</td>
                <td>
                  <span className={`badge ${p.is_active ? 'badge--income' : 'badge--expense'}`}>
                    {p.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn--ghost btn--sm"
                      onClick={() => openStatement(p)}>
                      View
                    </button>
                    {canDelete && (
                      <button className="btn btn--danger btn--sm"
                        onClick={() => handleDelete(p._id)}>
                        Delete
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Party statement slide-over ── */}
      {selectedParty && (
        <>
          {/* backdrop */}
          <div className="slideover-backdrop" onClick={closeStatement} />

          {/* panel */}
          <div className="slideover">
            <div className="slideover__header">
              <div>
                <h3 className="slideover__title">{selectedParty.name}</h3>
                <span className={`badge badge--${selectedParty.type}`}>
                  {selectedParty.type}
                </span>
              </div>
              <button className="slideover__close" onClick={closeStatement}>✕</button>
            </div>

            {/* Party details */}
            <div className="slideover__details">
              {selectedParty.phone && (
                <div className="detail-row">
                  <span className="detail-label">Phone</span>
                  <span>{selectedParty.phone}</span>
                </div>
              )}
              {selectedParty.vat_number && (
                <div className="detail-row">
                  <span className="detail-label">VAT number</span>
                  <span>{selectedParty.vat_number}</span>
                </div>
              )}
              {selectedParty.pan_number && (
                <div className="detail-row">
                  <span className="detail-label">PAN number</span>
                  <span>{selectedParty.pan_number}</span>
                </div>
              )}
            </div>

            {/* Transaction summary — admin only */}
            {isAdmin && statement && (
              <div className="slideover__summary">
                <div className="stmt-card stmt-card--income">
                  <div className="stmt-card__label">Total Received</div>
                  <div className="stmt-card__value">{fmt(statement.summary.total_received)}</div>
                </div>
                <div className="stmt-card stmt-card--expense">
                  <div className="stmt-card__label">Total Paid</div>
                  <div className="stmt-card__value">{fmt(statement.summary.total_paid)}</div>
                </div>
                <div className="stmt-card">
                  <div className="stmt-card__label">Net Balance</div>
                  <div className={`stmt-card__value ${statement.summary.net_balance >= 0 ? 'income' : 'expense'}`}>
                    {fmt(Math.abs(statement.summary.net_balance))}
                  </div>
                </div>
              </div>
            )}

            {/* Transaction list */}
            <div className="slideover__body">
              <h4 className="slideover__section-title">Transaction History</h4>
              {stmtLoading ? (
                <div className="table__empty">Loading...</div>
              ) : statement?.transactions.length === 0 ? (
                <div className="table__empty">No transactions with this party</div>
              ) : (
                <table className="table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Description</th>
                      <th>Type</th>
                      {isAdmin && <th className="text-right">Amount</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {statement?.transactions.map(t => (
                      <tr key={t._id} className={`row--${t.type}`}>
                        <td className="muted">
                          {t.bs_date || formatBS(t.date)}
                        </td>
                        <td>{t.description || '—'}</td>
                        <td>
                          <span className={`badge badge--${t.type}`}>{t.type}</span>
                        </td>
                        {isAdmin && (
                          <td className={`text-right bold ${t.type}`}>
                            {fmt(t.gross_amount)}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}

    </div>
  );
};

export default Parties;