import { useState, useEffect } from 'react';
import API from '../services/api';
import { useAuth } from '../context/AuthContext';
import { formatBS, bsToAD } from '../utils/bsDateConverter';

const JournalEntry = () => {
  const [entries,    setEntries]    = useState([]);
  const [accounts,   setAccounts]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [showForm,   setShowForm]   = useState(false);
  const [error,      setError]      = useState('');
  const { canEdit, canDelete, isAdmin } = useAuth();

  const emptyLine = { account: '', description: '', debit: 0, credit: 0 };

  const [form, setForm] = useState({
    date:             '',
    bs_date:          '',
    voucher_type:     'journal',
    reference_number: '',
    narration:        '',
  });
  const [lines,      setLines]      = useState([
    { ...emptyLine },
    { ...emptyLine }
  ]);
  const [attachment, setAttachment] = useState(null);

  const fetchEntries = () => {
    setLoading(true);
    API.get('/journals')
      .then(res => setEntries(res.data.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchEntries();
    API.get('/accounts').then(res => setAccounts(res.data.data));
  }, []);

  // ── form field change ─────────────────────
  const handleChange = (e) => {
    const { name, value } = e.target;
    const updated = { ...form, [name]: value };

    if (name === 'date' && value) {
      updated.bs_date = formatBS(value);
    }
    if (name === 'bs_date') {
      const normalized = value.replace(/[\/.]/g, '-');
      if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(normalized)) {
        const ad = bsToAD(normalized);
        if (ad) updated.date = ad;
      }
    }
    setForm(updated);
  };

  // ── line change ───────────────────────────
  const handleLineChange = (index, field, value) => {
    setLines(prev => prev.map((line, i) =>
      i !== index ? line : { ...line, [field]: value }
    ));
  };

  const addLine = () => setLines(prev => [...prev, { ...emptyLine }]);

  const removeLine = (index) => {
    if (lines.length <= 2) return; // minimum 2 lines
    setLines(prev => prev.filter((_, i) => i !== index));
  };

  // ── totals ────────────────────────────────
  const totalDebit  = lines.reduce((sum, l) => sum + (Number(l.debit)  || 0), 0);
  const totalCredit = lines.reduce((sum, l) => sum + (Number(l.credit) || 0), 0);
  const isBalanced  = Math.abs(totalDebit - totalCredit) < 0.01;

  // ── reset ─────────────────────────────────
  const resetForm = () => {
    setForm({ date: '', bs_date: '', voucher_type: 'journal', reference_number: '', narration: '' });
    setLines([{ ...emptyLine }, { ...emptyLine }]);
    setAttachment(null);
    setError('');
  };

  // ── submit ────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!isBalanced) {
      setError(`Entry does not balance — Debit Rs.${totalDebit} ≠ Credit Rs.${totalCredit}`);
      return;
    }

    try {
      const data = new FormData();
      Object.entries(form).forEach(([k, v]) => data.append(k, v));
      data.append('lines', JSON.stringify(lines));
      if (attachment) data.append('attachment', attachment);

      await API.post('/journals', data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      resetForm();
      setShowForm(false);
      fetchEntries();
    } catch (err) {
      setError(err?.response?.data?.error || 'Something went wrong');
    }
  };

  // ── delete ────────────────────────────────
  const handleDelete = async (id) => {
    if (!window.confirm('Delete this journal entry? This cannot be undone.')) return;
    try {
      await API.delete(`/journals/${id}`);
      fetchEntries();
    } catch (err) {
      console.error(err);
    }
  };

  const fmt = (n) => 'Rs. ' + Number(n || 0).toLocaleString('en-IN');

  if (loading) return <div className="page-loading">Loading...</div>;

  return (
    <div className="journal-entries">

      {/* Header */}
      <div className="page-header">
        <h3 className="page-header__title">Journal Entries</h3>
        {canEdit && (
          <button className="btn btn--primary"
            onClick={() => { setShowForm(!showForm); if (showForm) resetForm(); }}>
            {showForm ? 'Cancel' : '+ New Journal Entry'}
          </button>
        )}
      </div>

      <div className="role-notice" style={{ borderLeftColor: 'var(--amber)' }}>
        Journal entries are for internal adjustments — depreciation, corrections,
        opening entries. For income and expense use Transactions instead.
        Journal entries cannot be edited — delete and re-enter if correction needed.
      </div>

      {/* Form */}
      {showForm && (
        <form className="form-card" onSubmit={handleSubmit}>
          {error && <div className="form-error">{error}</div>}

          <div className="form-grid">

            <div className="form-group">
              <label>Date (AD) *</label>
              <input type="date" name="date" value={form.date}
                onChange={handleChange} required />
            </div>

            <div className="form-group">
              <label>BS Date (auto filled)</label>
              <input type="text" name="bs_date" value={form.bs_date}
                onChange={handleChange} placeholder="e.g. 2081-04-15" />
            </div>

            <div className="form-group">
              <label>Voucher Type *</label>
              <select name="voucher_type" value={form.voucher_type}
                onChange={handleChange}>
                <option value="journal">Journal — internal adjustment</option>
                <option value="contra">Contra — cash to/from bank</option>
              </select>
            </div>

            <div className="form-group">
              <label>Reference Number</label>
              <input type="text" name="reference_number"
                value={form.reference_number}
                onChange={handleChange}
                placeholder="e.g. JV-2081-001" />
            </div>

            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label>Narration *</label>
              <input type="text" name="narration" value={form.narration}
                onChange={handleChange} required
                placeholder="e.g. Depreciation on office equipment FY 2081-82" />
            </div>

          </div>

          {/* Journal lines */}
          <div className="journal-lines">
            <div className="journal-lines__header">
              <span>Account</span>
              <span>Description</span>
              <span className="text-right">Debit (Rs.)</span>
              <span className="text-right">Credit (Rs.)</span>
              <span></span>
            </div>

            {lines.map((line, i) => (
              <div key={i} className="journal-line">
                <select value={line.account}
                  onChange={e => handleLineChange(i, 'account', e.target.value)}
                  required>
                  <option value="">— Select account —</option>
                  {accounts.map(a => (
                    <option key={a._id} value={a._id}>
                      {a.code} — {a.name}
                    </option>
                  ))}
                </select>

                <input type="text" value={line.description}
                  onChange={e => handleLineChange(i, 'description', e.target.value)}
                  placeholder="Line description (optional)" />

                <input type="number" value={line.debit || ''}
                  onChange={e => handleLineChange(i, 'debit', e.target.value)}
                  placeholder="0.00" min="0"
                  className="text-right" />

                <input type="number" value={line.credit || ''}
                  onChange={e => handleLineChange(i, 'credit', e.target.value)}
                  placeholder="0.00" min="0"
                  className="text-right" />

                <button type="button"
                  className="btn btn--danger btn--sm"
                  onClick={() => removeLine(i)}
                  disabled={lines.length <= 2}>
                  ×
                </button>
              </div>
            ))}

            {/* Totals row */}
            <div className="journal-lines__totals">
              <span className="bold">Totals</span>
              <span></span>
              <span className={`text-right bold ${isBalanced ? 'income' : 'expense'}`}>
                Rs. {totalDebit.toLocaleString('en-IN')}
              </span>
              <span className={`text-right bold ${isBalanced ? 'income' : 'expense'}`}>
                Rs. {totalCredit.toLocaleString('en-IN')}
              </span>
              <span className={`text-right bold ${isBalanced ? 'income' : 'expense'}`}>
                {isBalanced ? '✓ Balanced' : '✗ Not balanced'}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button type="button" className="btn btn--ghost"
              onClick={addLine}>
              + Add Line
            </button>
          </div>

          {/* Attachment */}
          <div className="form-group">
            <label>Attachment (optional)</label>
            <input type="file" accept=".pdf,.jpg,.jpeg,.png"
              onChange={e => setAttachment(e.target.files[0])} />
          </div>

          <button className="btn btn--primary" type="submit"
            disabled={!isBalanced}>
            Save Journal Entry
          </button>
        </form>
      )}

      {/* Journal entries table */}
      <div className="table-card">
        <table className="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Reference</th>
              <th>Narration</th>
              <th>Lines</th>
              {isAdmin && <th className="text-right">Amount</th>}
              {canDelete && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 && (
              <tr>
                <td colSpan={isAdmin ? 7 : 6} className="table__empty">
                  No journal entries yet
                </td>
              </tr>
            )}
            {entries.map(e => (
              <tr key={e._id}>
                <td className="muted">
                  {e.bs_date || new Date(e.date).toLocaleDateString()}
                </td>
                <td>
                  <span className={`badge ${e.voucher_type === 'journal' ? 'badge--journal' : 'badge--contra'}`}>
                    {e.voucher_type}
                  </span>
                </td>
                <td className="muted">{e.reference_number || '—'}</td>
                <td>{e.narration}</td>
                <td className="muted">{e.lines?.length} lines</td>
                {isAdmin && (
                  <td className="text-right bold">
                    {fmt(e.total_debit)}
                  </td>
                )}
                {canDelete && (
                  <td>
                    <button className="btn btn--danger btn--sm"
                      onClick={() => handleDelete(e._id)}>
                      Delete
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  );
};

export default JournalEntry;