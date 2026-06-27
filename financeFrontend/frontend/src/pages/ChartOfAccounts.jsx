import { useState, useEffect } from 'react';
import API from '../services/api';
import { useAuth } from '../context/AuthContext';

const ChartOfAccounts = () => {
  const [accounts,   setAccounts]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [showForm,   setShowForm]   = useState(false);
  const [editItem,   setEditItem]   = useState(null);
  const [error,      setError]      = useState('');
  const [seeding,    setSeeding]    = useState(false);
  const [filter,     setFilter]     = useState('all');
  const { isAdmin }                 = useAuth();

  const [form, setForm] = useState({
    code:                 '',
    name:                 '',
    type:                 'asset',
    group:                '',
    parent:               '',
    opening_balance:      0,
    opening_balance_type: 'debit',
    description:          '',
  });

  const fetchAccounts = () => {
    setLoading(true);
    const params = filter !== 'all' ? { type: filter } : {};
    API.get('/accounts', { params })
      .then(res => setAccounts(res.data.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchAccounts(); }, [filter]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleEdit = (account) => {
    setEditItem(account);
    setForm({
      code:                 account.code,
      name:                 account.name,
      type:                 account.type,
      group:                account.group       || '',
      parent:               account.parent?._id || '',
      opening_balance:      account.opening_balance || 0,
      opening_balance_type: account.opening_balance_type || 'debit',
      description:          account.description || '',
    });
    setShowForm(true);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (editItem) {
        await API.put(`/accounts/${editItem._id}`, form);
      } else {
        await API.post('/accounts', form);
      }
      setForm({
        code: '', name: '', type: 'asset', group: '',
        parent: '', opening_balance: 0,
        opening_balance_type: 'debit', description: ''
      });
      setShowForm(false);
      setEditItem(null);
      fetchAccounts();
    } catch (err) {
      setError(err?.response?.data?.error || 'Something went wrong');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this account?')) return;
    try {
      await API.delete(`/accounts/${id}`);
      fetchAccounts();
    } catch (err) {
      setError(err?.response?.data?.error || 'Cannot delete this account');
    }
  };

  const handleSeed = async () => {
    if (!window.confirm('This will create the default Nepal chart of accounts. Continue?')) return;
    setSeeding(true);
    try {
      await API.post('/accounts/seed');
      fetchAccounts();
    } catch (err) {
      setError(err?.response?.data?.error || 'Seeding failed');
    } finally {
      setSeeding(false);
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditItem(null);
    setError('');
    setForm({
      code: '', name: '', type: 'asset', group: '',
      parent: '', opening_balance: 0,
      opening_balance_type: 'debit', description: ''
    });
  };

  // group options based on selected type
  const groupOptions = {
    asset:     ['current_asset', 'fixed_asset', 'other_asset'],
    liability: ['current_liability', 'long_term_liability'],
    equity:    ['owners_equity', 'retained_earnings'],
    income:    ['operating_income', 'other_income'],
    expense:   ['operating_expense', 'other_expense'],
  };

  // type badge color
  const typeBadge = {
    asset:     'badge--supplier',
    liability: 'badge--expense',
    equity:    'badge--other',
    income:    'badge--income',
    expense:   'badge--payment',
  };

  const fmt = (n) => 'Rs. ' + Number(n || 0).toLocaleString('en-IN');

  if (loading) return <div className="page-loading">Loading...</div>;

  return (
    <div className="accounts">

      {/* Header */}
      <div className="page-header">
        <h3 className="page-header__title">Chart of Accounts</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          {isAdmin && accounts.length === 0 && (
            <button className="btn btn--ghost" onClick={handleSeed} disabled={seeding}>
              {seeding ? 'Setting up...' : 'Setup Default Accounts'}
            </button>
          )}
          {isAdmin && (
            <button className="btn btn--primary"
              onClick={() => { setShowForm(!showForm); if (showForm) handleCancel(); }}>
              {showForm && !editItem ? 'Cancel' : '+ Add Account'}
            </button>
          )}
        </div>
      </div>

      {/* Type filter tabs */}
      <div className="report-tabs">
        {['all', 'asset', 'liability', 'equity', 'income', 'expense'].map(t => (
          <button key={t}
            className={`report-tab ${filter === t ? 'report-tab--active' : ''}`}
            onClick={() => setFilter(t)}>
            {t === 'all' ? 'All' : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Form */}
      {showForm && (
        <form className="form-card" onSubmit={handleSubmit}>
          <h4 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
            {editItem ? 'Edit Account' : 'New Account'}
          </h4>
          {error && <div className="form-error">{error}</div>}
          <div className="form-grid">

            <div className="form-group">
              <label>Account Code *</label>
              <input type="text" name="code" value={form.code}
                onChange={handleChange} required
                placeholder="e.g. 5100"
                disabled={editItem?.is_system} />
            </div>

            <div className="form-group">
              <label>Account Name *</label>
              <input type="text" name="name" value={form.name}
                onChange={handleChange} required
                placeholder="e.g. Office Rent"
                disabled={editItem?.is_system} />
            </div>

            <div className="form-group">
              <label>Type *</label>
              <select name="type" value={form.type}
                onChange={handleChange}
                disabled={editItem?.is_system}>
                <option value="asset">Asset</option>
                <option value="liability">Liability</option>
                <option value="equity">Equity</option>
                <option value="income">Income</option>
                <option value="expense">Expense</option>
              </select>
            </div>

            <div className="form-group">
              <label>Group</label>
              <select name="group" value={form.group} onChange={handleChange}>
                <option value="">— Select group —</option>
                {(groupOptions[form.type] || []).map(g => (
                  <option key={g} value={g}>
                    {g.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Parent Account</label>
              <select name="parent" value={form.parent} onChange={handleChange}>
                <option value="">— No parent —</option>
                {accounts
                  .filter(a => a.type === form.type && a._id !== editItem?._id)
                  .map(a => (
                    <option key={a._id} value={a._id}>
                      {a.code} — {a.name}
                    </option>
                  ))
                }
              </select>
            </div>

            <div className="form-group">
              <label>Opening Balance (Rs.)</label>
              <input type="number" name="opening_balance"
                value={form.opening_balance}
                onChange={handleChange} min="0" placeholder="0" />
            </div>

            <div className="form-group">
              <label>Opening Balance Type</label>
              <select name="opening_balance_type"
                value={form.opening_balance_type}
                onChange={handleChange}>
                <option value="debit">Debit</option>
                <option value="credit">Credit</option>
              </select>
            </div>

            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label>Description</label>
              <input type="text" name="description" value={form.description}
                onChange={handleChange} placeholder="Optional description" />
            </div>

          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn--primary" type="submit">
              {editItem ? 'Update Account' : 'Save Account'}
            </button>
            <button className="btn btn--ghost" type="button" onClick={handleCancel}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Accounts table */}
      <div className="table-card">
        {accounts.length === 0 ? (
          <div className="table__empty">
            No accounts yet — click Setup Default Accounts to get started
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Account Name</th>
                <th>Type</th>
                <th>Group</th>
                <th>Parent</th>
                {isAdmin && <th className="text-right">Opening Balance</th>}
                <th>Status</th>
                {isAdmin && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {accounts.map(a => (
                <tr key={a._id}>
                  <td className="mono bold">{a.code}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {a.parent && (
                        <span style={{
                          width: 12, height: 1,
                          background: 'var(--border)',
                          display: 'inline-block',
                          marginLeft: 8
                        }} />
                      )}
                      <span className={a.is_system ? 'bold' : ''}>{a.name}</span>
                      {a.is_system && (
                        <span style={{
                          fontSize: 10, color: 'var(--text-muted)',
                          background: 'var(--surface-alt)',
                          padding: '1px 6px', borderRadius: 99
                        }}>
                          system
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${typeBadge[a.type]}`}>{a.type}</span>
                  </td>
                  <td className="muted">
                    {a.group
                      ? a.group.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
                      : '—'}
                  </td>
                  <td className="muted">
                    {a.parent ? `${a.parent.code} — ${a.parent.name}` : '—'}
                  </td>
                  {isAdmin && (
                    <td className="text-right muted">
                      {a.opening_balance > 0
                        ? `${fmt(a.opening_balance)} ${a.opening_balance_type}`
                        : '—'}
                    </td>
                  )}
                  <td>
                    <span className={`badge ${a.is_active ? 'badge--income' : 'badge--expense'}`}>
                      {a.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  {isAdmin && (
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn--ghost btn--sm"
                          onClick={() => handleEdit(a)}>
                          Edit
                        </button>
                        {!a.is_system && (
                          <button className="btn btn--danger btn--sm"
                            onClick={() => handleDelete(a._id)}>
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

    </div>
  );
};

export default ChartOfAccounts;