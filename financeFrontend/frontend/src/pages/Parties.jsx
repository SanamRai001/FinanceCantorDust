import { useState, useEffect } from 'react';
import API from '../services/api';
import { useAuth } from '../context/AuthContext';
const Parties = () => {
  const [parties, setParties]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const {canEdit, canDelete} = useAuth();
  const [form, setForm]         = useState({
    name: '', type: 'supplier', phone: '', vat_number: '', pan_number: ''
  });
  const [error, setError]       = useState('');

  const fetchParties = () => {
    API.get('/party')
      .then(res => setParties(res.data.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchParties(); }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const response = await API.post('/party', form);
      console.log(response);
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

  const totalReceivable = parties
    .filter(p => p.opening_balance_type === 'receivable')
    .reduce((sum, p) => sum + (p.opening_balance || 0), 0);

  const totalPayable = parties
    .filter(p => p.opening_balance_type === 'payable')
    .reduce((sum, p) => sum + (p.opening_balance || 0), 0);

  if (loading) return <div>Loading...</div>;

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
          <div className="card__value">Rs. {totalReceivable.toLocaleString('en-IN')}</div>
        </div>
        <div className="card card--expense">
          <div className="card__label">Total Payables</div>
          <div className="card__value">Rs. {totalPayable.toLocaleString('en-IN')}</div>
        </div>
        <div className="card card--profit">
          <div className="card__label">Active Parties</div>
          <div className="card__value">{parties.filter(p => p.is_active).length}</div>
        </div>
      </div>

      {/* Header row */}
      <div className="page-header">
        <h3 className="page-header__title">All Parties</h3>
        {canEdit && (
        <button className="btn btn--primary" onClick={() => setShowForm(!showForm)}>
          + Add Party
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
              <input name="name" value={form.name} onChange={handleChange} required placeholder="e.g. ABC Suppliers" />
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
              <input name="phone" value={form.phone} onChange={handleChange} placeholder="98XXXXXXXX" />
            </div>
            <div className="form-group">
              <label>VAT number</label>
              <input name="vat_number" value={form.vat_number} onChange={handleChange} placeholder="VAT registration no." />
            </div>
            <div className="form-group">
              <label>PAN number</label>
              <input name="pan_number" value={form.pan_number} onChange={handleChange} placeholder="PAN number" />
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
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {parties.length === 0 && (
              <tr><td colSpan={6} className="table__empty">No parties yet — add one above</td></tr>
            )}
            {parties.map(p => (
              <tr key={p._id}>
                <td className="bold">{p.name}</td>
                <td><span className={`badge badge--${p.type}`}>{p.type}</span></td>
                <td className="muted">{p.vat_number || p.pan_number || '—'}</td>
                <td className="muted">{p.phone || '—'}</td>
                <td>
                  <span className={`badge ${p.is_active ? 'badge--income' : 'badge--expense'}`}>
                    {p.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td>
                  {canDelete && (
        <button className="btn btn--danger btn--sm" onClick={() => handleDelete(p._id)}>
          Delete
        </button>
      )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  );
};

export default Parties;