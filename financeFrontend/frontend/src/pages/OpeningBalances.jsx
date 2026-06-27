import { useState, useEffect } from 'react';
import API from '../services/api';
import { useAuth } from '../context/AuthContext';

const OpeningBalances = () => {
  const [accounts, setAccounts] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [success,  setSuccess]  = useState('');
  const [error,    setError]    = useState('');
  const [balances, setBalances] = useState({});
  const [types,    setTypes]    = useState({});
  const { isAdmin }             = useAuth();

  useEffect(() => {
    API.get('/accounts')
      .then(res => {
        const accs = res.data.data;
        setAccounts(accs);

        // pre-fill existing opening balances
        const initBalances = {};
        const initTypes    = {};
        accs.forEach(a => {
          initBalances[a._id] = a.opening_balance      || 0;
          initTypes[a._id]    = a.opening_balance_type || 'debit';
        });
        setBalances(initBalances);
        setTypes(initTypes);
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const handleBalanceChange = (id, value) => {
    setBalances(prev => ({ ...prev, [id]: value }));
  };

  const handleTypeChange = (id, value) => {
    setTypes(prev => ({ ...prev, [id]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      // update all accounts with opening balances
      await Promise.all(
        accounts
          .filter(a => !a.is_system) // skip system accounts
          .map(a =>
            API.put(`/accounts/${a._id}`, {
              opening_balance:      Number(balances[a._id] || 0),
              opening_balance_type: types[a._id] || 'debit'
            })
          )
      );
      setSuccess('Opening balances saved successfully');
    } catch (err) {
      setError(err?.response?.data?.error || 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  const fmt = (n) => Number(n || 0).toLocaleString('en-IN');

  // group accounts by type for display
  const grouped = {
    asset:     accounts.filter(a => a.type === 'asset'),
    liability: accounts.filter(a => a.type === 'liability'),
    equity:    accounts.filter(a => a.type === 'equity'),
    income:    accounts.filter(a => a.type === 'income'),
    expense:   accounts.filter(a => a.type === 'expense'),
  };

  // total debit and credit
  const totalDebit = accounts.reduce((sum, a) => {
    const bal = Number(balances[a._id] || 0);
    return types[a._id] === 'debit' ? sum + bal : sum;
  }, 0);

  const totalCredit = accounts.reduce((sum, a) => {
    const bal = Number(balances[a._id] || 0);
    return types[a._id] === 'credit' ? sum + bal : sum;
  }, 0);

  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

  if (loading) return <div className="page-loading">Loading...</div>;

  if (!isAdmin) return (
    <div className="role-notice">
      Opening balances can only be set by admins.
    </div>
  );

  return (
    <div className="opening-balances">

      <div className="page-header">
        <h3 className="page-header__title">Opening Balances</h3>
        <button className="btn btn--primary"
          onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save All Balances'}
        </button>
      </div>

      <div className="role-notice" style={{ borderLeftColor: 'var(--amber)' }}>
        Enter the balances for each account as of the date your business
        starts using this system. Debit and Credit totals must match for
        your books to balance.
      </div>

      {error   && <div className="form-error">{error}</div>}
      {success && (
        <div className="form-error" style={{ background: 'rgba(15,110,86,0.08)', color: 'var(--green)' }}>
          {success}
        </div>
      )}

      {/* Balance check */}
      <div className="summary-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="card card--income">
          <div className="card__label">Total Debit</div>
          <div className="card__value">Rs. {fmt(totalDebit)}</div>
        </div>
        <div className="card card--expense">
          <div className="card__label">Total Credit</div>
          <div className="card__value">Rs. {fmt(totalCredit)}</div>
        </div>
        <div className={`card ${isBalanced ? 'card--profit' : 'card--expense'}`}>
          <div className="card__label">Status</div>
          <div className="card__value" style={{
            fontSize: 16,
            color: isBalanced ? 'var(--green)' : 'var(--red)'
          }}>
            {isBalanced ? '✓ Balanced' : '✗ Not balanced'}
          </div>
        </div>
      </div>

      {/* Account groups */}
      {Object.entries(grouped).map(([type, accs]) => (
        accs.length === 0 ? null : (
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
                  <th style={{ width: 200 }}>Opening Balance (Rs.)</th>
                  <th style={{ width: 140 }}>Dr / Cr</th>
                </tr>
              </thead>
              <tbody>
                {accs.map(a => (
                  <tr key={a._id}>
                    <td className="mono muted">{a.code}</td>
                    <td>
                      <span className={a.is_system ? 'muted' : 'bold'}>
                        {a.name}
                      </span>
                      {a.is_system && (
                        <span style={{
                          fontSize: 10, marginLeft: 6,
                          color: 'var(--text-muted)'
                        }}>
                          system
                        </span>
                      )}
                    </td>
                    <td>
                      <input
                        type="number"
                        value={balances[a._id] || 0}
                        onChange={e => handleBalanceChange(a._id, e.target.value)}
                        min="0"
                        disabled={a.is_system}
                        className={a.is_system ? 'input--readonly' : ''}
                        style={{
                          width: '100%',
                          padding: '6px 10px',
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--radius)',
                          fontSize: 13
                        }}
                      />
                    </td>
                    <td>
                      <select
                        value={types[a._id] || 'debit'}
                        onChange={e => handleTypeChange(a._id, e.target.value)}
                        disabled={a.is_system}
                        className={a.is_system ? 'input--readonly' : ''}
                        style={{
                          width: '100%',
                          padding: '6px 10px',
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--radius)',
                          fontSize: 13
                        }}
                      >
                        <option value="debit">Debit (Dr)</option>
                        <option value="credit">Credit (Cr)</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ))}

    </div>
  );
};

export default OpeningBalances;