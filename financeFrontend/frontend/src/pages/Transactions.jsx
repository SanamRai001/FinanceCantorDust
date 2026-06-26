import { useState, useEffect } from 'react';
import API from '../services/api';
import { useAuth } from '../context/AuthContext';
import { formatBS } from '../utils/bsDateConverter';

const Transactions = () => {
  const [transactions, setTransactions] = useState([]);
  const [parties,      setParties]      = useState([]);
  const [showForm,     setShowForm]     = useState(false);
  const [error,        setError]        = useState('');
  const [loading,      setLoading]      = useState(true);
  const { canEdit }                     = useAuth();

  const [form, setForm] = useState({
    date:            '',
    type:            'income',
    party:           '',
    description:     '',
    net_amount:      '',
    vat_applicable:  false,
    vat_amount:      0,
    gross_amount:    0,
    payment_method:  '',
    payment_ref:     '',
    bill_ref_type:   'none',
    bill_ref_number: '',
    bs_date:         '',
  });
  const [attachment, setAttachment] = useState(null);

  const fetchTransactions = () => {
    API.get('/transactions')
      .then(res => setTransactions(res.data.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchTransactions();
    API.get('/party').then(res => setParties(res.data.data));
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const updated = {
      ...form,
      [name]: type === 'checkbox' ? checked : value
    };

    // auto-calculate VAT
    if (name === 'net_amount' || name === 'vat_applicable') {
      const net   = parseFloat(name === 'net_amount' ? value : form.net_amount) || 0;
      const vatOn = name === 'vat_applicable' ? checked : form.vat_applicable;
      const vat   = vatOn ? Math.round(net * 0.13 * 100) / 100 : 0;
      updated.vat_amount   = vat;
      updated.gross_amount = net + vat;
    }

    // auto-fill BS date when AD date is picked
    if (name === 'date' && value) {
      updated.bs_date = formatBS(value);
    }

    setForm(updated);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const data = new FormData();
      Object.entries(form).forEach(([key, val]) => data.append(key, val));
      if (attachment) data.append('attachment', attachment);
      await API.post('/transactions', data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setForm({
        date: '', type: 'income', party: '', description: '',
        net_amount: '', vat_applicable: false, vat_amount: 0,
        gross_amount: 0, payment_method: '', payment_ref: '',
        bill_ref_type: 'none', bill_ref_number: '', bs_date: ''
      });
      setAttachment(null);
      setShowForm(false);
      fetchTransactions();
    } catch (err) {
      setError(err?.response?.data?.error || 'Something went wrong');
    }
  };

  const fmt = (n) => 'Rs. ' + Number(n || 0).toLocaleString('en-IN');

  if (loading) return <div className="page-loading">Loading...</div>;

  return (
    <div className="transactions">

      {/* Header */}
      <div className="page-header">
        <h3 className="page-header__title">Transactions</h3>
        {canEdit && (
          <button className="btn btn--primary"
            onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancel' : '+ Add Transaction'}
          </button>
        )}
      </div>

      {/* Form */}
      {showForm && (
        <form className="form-card" onSubmit={handleSubmit}>
          {error && <div className="form-error">{error}</div>}

          {/* Income / Expense toggle */}
          <div className="type-toggle">
            <button type="button"
              className={`type-btn ${form.type === 'income' ? 'type-btn--income' : ''}`}
              onClick={() => setForm({ ...form, type: 'income' })}>
              Income
            </button>
            <button type="button"
              className={`type-btn ${form.type === 'expense' ? 'type-btn--expense' : ''}`}
              onClick={() => setForm({ ...form, type: 'expense' })}>
              Expense
            </button>
          </div>

          <div className="form-grid">

            {/* Date AD */}
            <div className="form-group">
              <label>Date (AD) *</label>
              <input type="date" name="date" value={form.date}
                onChange={handleChange} required />
            </div>

            {/* BS Date — auto filled */}
            <div className="form-group">
              <label>BS Date (auto filled)</label>
              <input type="text" name="bs_date" value={form.bs_date}
                onChange={handleChange} placeholder="e.g. 2081-04-15" />
            </div>

            {/* Net amount */}
            <div className="form-group">
              <label>Net Amount *</label>
              <input type="number" name="net_amount" value={form.net_amount}
                onChange={handleChange} required placeholder="0.00" min="0" />
            </div>

            {/* VAT toggle */}
            <div className="form-group form-group--center">
              <label>Include 13% VAT</label>
              <input type="checkbox" name="vat_applicable"
                checked={form.vat_applicable} onChange={handleChange} />
            </div>

            {/* VAT amount readonly */}
            <div className="form-group">
              <label>VAT Amount</label>
              <input type="number" value={form.vat_amount} readOnly
                className="input--readonly" />
            </div>

            {/* Gross amount readonly */}
            <div className="form-group">
              <label>Gross Amount</label>
              <input type="number" value={form.gross_amount} readOnly
                className="input--readonly" />
            </div>

            {/* Party */}
            <div className="form-group">
              <label>Party </label>
              <select name="party" value={form.party}
                onChange={handleChange} >
                <option value="">— Select party —</option>
                {parties.map(p => (
                  <option key={p._id} value={p._id}>{p.name}</option>
                ))}
              </select>
            </div>

            {/* Description */}
            <div className="form-group">
              <label>Description </label>
              <input type="text" name="description" value={form.description}
                onChange={handleChange} 
                placeholder="e.g. Office rent Baisakh 2081" />
            </div>

            {/* Payment method */}
            <div className="form-group">
              <label>Payment Method *</label>
              <select name="payment_method" value={form.payment_method}
                onChange={handleChange} required>
                <option value="">— Select method —</option>
                <option value="cash">Cash</option>
                <option value="cheque">Cheque</option>
                <option value="bank">Bank Transfer</option>
              </select>
            </div>

            {/* Conditional payment reference */}
            {form.payment_method === 'cheque' && (
              <div className="form-group">
                <label>Cheque Number *</label>
                <input type="text" name="payment_ref" value={form.payment_ref}
                  onChange={handleChange} placeholder="e.g. 004521" />
              </div>
            )}
            {form.payment_method === 'bank' && (
              <div className="form-group">
                <label>Bank Transfer ID *</label>
                <input type="text" name="payment_ref" value={form.payment_ref}
                  onChange={handleChange} placeholder="e.g. TXN20250601001" />
              </div>
            )}

            {/* Bill reference type */}
            <div className="form-group">
              <label>Bill Reference</label>
              <select name="bill_ref_type" value={form.bill_ref_type}
                onChange={handleChange}>
                <option value="none">No Bill</option>
                <option value="bill">Bill Number</option>
                <option value="vat">VAT Number</option>
              </select>
            </div>

            {/* Bill reference number — conditional */}
            {form.bill_ref_type !== 'none' && (
              <div className="form-group">
                <label>
                  {form.bill_ref_type === 'bill' ? 'Bill Number' : 'VAT Number'} *
                </label>
                <input type="text" name="bill_ref_number"
                  value={form.bill_ref_number}
                  onChange={handleChange}
                  placeholder={
                    form.bill_ref_type === 'bill' ? 'BILL-001' : 'VAT-2025-001'
                  } />
              </div>
            )}

            {/* Attachment */}
            <div className="form-group">
              <label>Attachment (optional)</label>
              <input type="file" accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => setAttachment(e.target.files[0])} />
            </div>

          </div>

          <button className="btn btn--primary" type="submit">
            Save Transaction
          </button>
        </form>
      )}

      {/* Transactions table */}
      <div className="table-card">
        <table className="table">
          <thead>
            <tr>
              <th>Date (BS)</th>
              <th>Party</th>
              <th>Description</th>
              <th>Type</th>
              <th>Payment</th>
              <th className="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {transactions.length === 0 && (
              <tr>
                <td colSpan={6} className="table__empty">
                  No transactions yet — add one above
                </td>
              </tr>
            )}
            {transactions.map(t => (
              <tr key={t._id}>
                <td className="muted">
                  {t.bs_date || formatBS(t.date)}
                </td>
                <td className="bold">{t.party?.name || '—'}</td>
                <td>{t.description}</td>
                <td>
                  <span className={`badge badge--${t.type}`}>{t.type}</span>
                </td>
                <td className="muted">{t.payment_method}</td>
                <td className={`text-right bold ${t.type}`}>
                  {fmt(t.gross_amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  );
};

export default Transactions;