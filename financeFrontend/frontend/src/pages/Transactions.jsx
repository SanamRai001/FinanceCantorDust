import { useState, useEffect } from 'react';
import API from '../services/api';
import { useAuth } from '../context/AuthContext';
import { formatBS, bsToAD } from '../utils/bsDateConverter';

const emptyForm = {
  date:            '',
  type:            'income',
  party:           '',
  category:        '',
  description:     '',
  net_amount:      '',
  vat_applicable:  false,
  vat_percent:     13,
  vat_amount:      0,
  gross_amount:    0,
  discount:        0,
  payment_method:  '',
  payment_ref:     '',
  bill_ref_type:   'none',
  bill_ref_number: '',
  bs_date:         '',
};

const emptyItem = { name: '', quantity: 1, unit_price: '', total: 0 };

const Transactions = () => {
  const [transactions, setTransactions] = useState([]);
  const [parties,      setParties]      = useState([]);
  const [categories,   setCategories]   = useState([]);
  const [showForm,     setShowForm]     = useState(false);
  const [error,        setError]        = useState('');
  const [loading,      setLoading]      = useState(true);
  const [lineItems,    setLineItems]    = useState([]);
  const [useLineItems, setUseLineItems] = useState(false);
  const { canEdit }                     = useAuth();
  const [form,         setForm]         = useState(emptyForm);
  const [attachment,   setAttachment]   = useState(null);

  const fetchTransactions = () => {
    API.get('/transactions')
      .then(res => setTransactions(res.data.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchTransactions();
    API.get('/party').then(res => setParties(res.data.data));
    API.get('/categories').then(res => setCategories(res.data.data));
  }, []);

  // ── recalculate totals from line items ────
  const recalcFromLineItems = (items, discount, vatOn, vatPercent) => {
    const subtotal  = items.reduce((sum, i) =>
      sum + (Number(i.quantity || 1) * Number(i.unit_price || 0)), 0);
    const net       = Math.max(0, subtotal - Number(discount || 0));
    const pct       = Number(vatPercent || 0);
    const vat       = vatOn ? Math.round(net * (pct / 100) * 100) / 100 : 0;
    return { subtotal, net_amount: net, vat_amount: vat, gross_amount: net + vat };
  };

  // ── handle line item change ───────────────
  const handleItemChange = (index, field, value) => {
    const updated = lineItems.map((item, i) => {
      if (i !== index) return item;
      const newItem = { ...item, [field]: value };
      newItem.total = Number(newItem.quantity || 1) * Number(newItem.unit_price || 0);
      return newItem;
    });
    setLineItems(updated);

    // recalculate form totals
    const { net_amount, vat_amount, gross_amount } = recalcFromLineItems(
      updated, form.discount, form.vat_applicable, form.vat_percent
    );
    setForm(prev => ({ ...prev, net_amount, vat_amount, gross_amount }));
  };

  const addLineItem = () => setLineItems([...lineItems, { ...emptyItem }]);

  const removeLineItem = (index) => {
    const updated = lineItems.filter((_, i) => i !== index);
    setLineItems(updated);
    const { net_amount, vat_amount, gross_amount } = recalcFromLineItems(
      updated, form.discount, form.vat_applicable, form.vat_percent
    );
    setForm(prev => ({ ...prev, net_amount, vat_amount, gross_amount }));
  };

  // ── handle form field change ──────────────
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const updated = { ...form, [name]: type === 'checkbox' ? checked : value };

    if (['net_amount', 'vat_applicable', 'vat_percent', 'discount'].includes(name)) {
      const net     = parseFloat(name === 'net_amount' ? value : form.net_amount) || 0;
      const vatOn   = name === 'vat_applicable' ? checked : form.vat_applicable;
      const percent = parseFloat(name === 'vat_percent' ? value : form.vat_percent) || 0;
      const disc    = parseFloat(name === 'discount' ? value : form.discount) || 0;

      if (useLineItems) {
        // recalculate from line items when discount or VAT changes
        const { net_amount, vat_amount, gross_amount } = recalcFromLineItems(
          lineItems, disc, vatOn, percent
        );
        updated.net_amount   = net_amount;
        updated.vat_amount   = vat_amount;
        updated.gross_amount = gross_amount;
      } else {
        const effectiveNet   = Math.max(0, net - disc);
        const vat            = vatOn ? Math.round(effectiveNet * (percent / 100) * 100) / 100 : 0;
        updated.vat_amount   = vat;
        updated.gross_amount = effectiveNet + vat;
      }
    }

    // AD → BS auto fill
    if (name === 'date') {
      updated.bs_date = value ? formatBS(value) : '';
    }

    // BS → AD auto fill
    if (name === 'bs_date') {
      const normalized = value.replace(/[\/.]/g, '-');
      if (normalized && /^\d{4}-\d{1,2}-\d{1,2}$/.test(normalized)) {
        const adDate = bsToAD(normalized);
        if (adDate) updated.date = adDate;
      } else if (!value) {
        updated.date = '';
      }
    }

    setForm(updated);
  };

  // ── reset form ────────────────────────────
  const resetForm = () => {
    setForm(emptyForm);
    setLineItems([]);
    setUseLineItems(false);
    setAttachment(null);
    setError('');
  };

  // ── submit ────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const data = new FormData();

      Object.entries(form).forEach(([key, val]) => {
        data.append(key, val);
      });

      // send line items as JSON string
      if (useLineItems && lineItems.length > 0) {
        data.append('line_items', JSON.stringify(lineItems));
      }

      if (attachment) data.append('attachment', attachment);

      await API.post('/transactions', data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      resetForm();
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
            onClick={() => { setShowForm(!showForm); if (showForm) resetForm(); }}>
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

            {/* BS Date */}
            <div className="form-group">
              <label>BS Date (auto filled)</label>
              <input type="text" name="bs_date" value={form.bs_date}
                onChange={handleChange} placeholder="e.g. 2081-04-15" />
            </div>

            {/* Party */}
            <div className="form-group">
              <label>Party</label>
              <select name="party" value={form.party} onChange={handleChange}>
                <option value="">— Select party —</option>
                {parties.map(p => (
                  <option key={p._id} value={p._id}>{p.name}</option>
                ))}
              </select>
            </div>

            {/* Category */}
            <div className="form-group">
              <label>Category</label>
              <select name="category" value={form.category} onChange={handleChange}>
                <option value="">— Select category —</option>
                {categories
                  .filter(c => c.type === form.type || c.type === 'both')
                  .map(c => (
                    <option key={c._id} value={c._id}>{c.name}</option>
                  ))
                }
              </select>
            </div>

            {/* Description */}
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label>Description</label>
              <input type="text" name="description" value={form.description}
                onChange={handleChange}
                placeholder="e.g. Office rent Baisakh 2081" />
            </div>

          </div>

          {/* ── Line items toggle ── */}
          <div className="form-group--center" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <input type="checkbox" id="useLineItems"
              checked={useLineItems}
              onChange={e => {
                setUseLineItems(e.target.checked);
                if (e.target.checked && lineItems.length === 0) {
                  setLineItems([{ ...emptyItem }]);
                }
              }} />
            <label htmlFor="useLineItems" style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', cursor: 'pointer' }}>
              Add line items (multiple products on one bill)
            </label>
          </div>

          {/* ── Line items table ── */}
          {useLineItems && (
            <div className="line-items">
              <table className="table line-items__table">
                <thead>
                  <tr>
                    <th>Item name</th>
                    <th style={{ width: 80 }}>Qty</th>
                    <th style={{ width: 120 }}>Unit price</th>
                    <th style={{ width: 120 }}>Total</th>
                    <th style={{ width: 40 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {lineItems.map((item, i) => (
                    <tr key={i}>
                      <td>
                        <input type="text" value={item.name}
                          onChange={e => handleItemChange(i, 'name', e.target.value)}
                          placeholder="e.g. Office Chair" className="line-input" />
                      </td>
                      <td>
                        <input type="number" value={item.quantity} min="0"
                          onChange={e => handleItemChange(i, 'quantity', e.target.value)}
                          className="line-input" />
                      </td>
                      <td>
                        <input type="number" value={item.unit_price} min="0"
                          onChange={e => handleItemChange(i, 'unit_price', e.target.value)}
                          placeholder="0.00" className="line-input" />
                      </td>
                      <td className="muted" style={{ textAlign: 'right' }}>
                        {fmt(item.quantity * item.unit_price || 0)}
                      </td>
                      <td>
                        <button type="button" className="btn btn--danger btn--sm"
                          onClick={() => removeLineItem(i)}>
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button type="button" className="btn btn--ghost btn--sm"
                onClick={addLineItem} style={{ marginTop: 8 }}>
                + Add item
              </button>
            </div>
          )}

          <div className="form-grid">

            {/* Discount */}
            <div className="form-group">
              <label>Discount (Rs.)</label>
              <input type="number" name="discount" value={form.discount}
                onChange={handleChange} placeholder="0.00" min="0" />
            </div>

            {/* Net amount — readonly if line items, editable otherwise */}
            <div className="form-group">
              <label>Net Amount {useLineItems ? '(auto)' : '*'}</label>
              <input type="number" name="net_amount"
                value={form.net_amount}
                onChange={handleChange}
                readOnly={useLineItems}
                className={useLineItems ? 'input--readonly' : ''}
                placeholder="0.00" min="0"
                required={!useLineItems} />
            </div>

            {/* VAT toggle */}
            <div className="form-group form-group--center">
              <label>VAT Applicable</label>
              <input type="checkbox" name="vat_applicable"
                checked={form.vat_applicable} onChange={handleChange} />
            </div>

            {/* VAT percent */}
            {form.vat_applicable && (
              <div className="form-group">
                <label>VAT Rate (%)</label>
                <input type="number" name="vat_percent" value={form.vat_percent}
                  onChange={handleChange} placeholder="13" min="0" max="100" />
              </div>
            )}

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
                  placeholder={form.bill_ref_type === 'bill' ? 'BILL-001' : 'VAT-2025-001'} />
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
              <th>Category</th>
              <th>Description</th>
              <th>Type</th>
              <th>Payment</th>
              <th>Items</th>
              <th className="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {transactions.length === 0 && (
              <tr>
                <td colSpan={8} className="table__empty">
                  No transactions yet — add one above
                </td>
              </tr>
            )}
            {transactions.map(t => (
              <tr key={t._id}>
                <td className="muted">{t.bs_date || formatBS(t.date)}</td>
                <td className="bold">{t.party?.name || '—'}</td>
                <td>
                  {t.category ? (
                    <span className="badge" style={{
                      background: t.category.color + '22',
                      color:      t.category.color
                    }}>
                      {t.category.name}
                    </span>
                  ) : '—'}
                </td>
                <td>{t.description || '—'}</td>
                <td>
                  <span className={`badge badge--${t.type}`}>{t.type}</span>
                </td>
                <td className="muted">{t.payment_method}</td>
                <td className="muted">
                  {t.line_items?.length > 0
                    ? `${t.line_items.length} item${t.line_items.length > 1 ? 's' : ''}`
                    : '—'}
                </td>
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