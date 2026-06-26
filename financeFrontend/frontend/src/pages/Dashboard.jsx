import { useState, useEffect } from 'react';
import API from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  AreaChart, Area, XAxis, Tooltip,
  ResponsiveContainer, Legend, CartesianGrid
} from 'recharts';

const getPeriodDates = (period) => {
  const now   = new Date();
  const year  = now.getFullYear();
  const month = now.getMonth();
  const today = now.toISOString().split('T')[0];

  switch (period) {
    case '30d':
      return {
        from: new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        to:   today,
      };
    case '6m':
      return {
        from: new Date(year, month - 5, 1).toISOString().split('T')[0],
        to:   new Date(year, month + 1, 0).toISOString().split('T')[0],
      };
    case '1y':
      return {
        from: new Date(year - 1, month + 1, 1).toISOString().split('T')[0],
        to:   new Date(year,     month + 1, 0).toISOString().split('T')[0],
      };
    case 'all':
    default:
      return {};
  }
};

const Dashboard = () => {
  const { isAdmin } = useAuth();

  const [summary,   setSummary]   = useState({ total_income: 0, total_expense: 0, net_profit: 0 });
  const [monthly,   setMonthly]   = useState([]);
  const [recent,    setRecent]    = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [period,    setPeriod]    = useState('6m');
  const [from,      setFrom]      = useState('');
  const [to,        setTo]        = useState('');
  const [useCustom, setUseCustom] = useState(false);

  const fetchData = async (params = {}) => {
    setLoading(true);
    try {
      const requests = [API.get('/transactions')];
      if (isAdmin) requests.unshift(API.get('/reports/pl', { params }));

      const results = await Promise.all(requests);

      if (isAdmin) {
        setSummary(results[0].data.summary);
        setMonthly(results[0].data.monthly_breakdown || []);
        setRecent((results[1].data.data || []).slice(0, 5));
      } else {
        setRecent((results[0].data.data || []).slice(0, 5));
      }
    } catch (err) {
      console.error('Error fetching dashboard data:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!useCustom) {
      const dates = getPeriodDates(period);
      fetchData(dates);
    }
  }, [period, useCustom]);

  const handleCustomApply = () => {
    if (from && to) fetchData({ from, to });
  };

  const fmt     = (n) => 'Rs. ' + Number(n || 0).toLocaleString('en-IN');
  const closing = summary.total_income - summary.total_expense;

  if (loading) return <div className="page-loading">Loading...</div>;

  return (
    <div className="dashboard">

      {/* Summary cards — admin only */}
      {isAdmin && (
        <div className="summary-grid">
          <div className="card card--income">
            <div className="card__label">Total Income</div>
            <div className="card__value">{fmt(summary.total_income)}</div>
          </div>
          <div className="card card--expense">
            <div className="card__label">Total Expense</div>
            <div className="card__value">{fmt(summary.total_expense)}</div>
          </div>
          <div className="card card--profit">
            <div className="card__label">Net Profit</div>
            <div className="card__value">{fmt(summary.net_profit)}</div>
          </div>
          <div className="card card--balance">
            <div className="card__label">Closing Balance</div>
            <div className="card__value">{fmt(closing)}</div>
          </div>
        </div>
      )}

      {/* Chart — admin only */}
      {isAdmin && (
        <div className="chart-card">
          <div className="chart-card__header">
            <h4 className="chart-card__title">Income vs Expenses</h4>
          </div>
          <div className="chart-filters">
            <div className="period-btns">
              {[
                { key: '30d', label: '30 Days'  },
                { key: '6m',  label: '6 Months' },
                { key: '1y',  label: '1 Year'   },
                { key: 'all', label: 'All time'  },
              ].map(p => (
                <button key={p.key}
                  className={`period-btn ${period === p.key && !useCustom ? 'period-btn--active' : ''}`}
                  onClick={() => { setPeriod(p.key); setUseCustom(false); }}>
                  {p.label}
                </button>
              ))}
            </div>
            <div className="chart-custom-range">
              <input type="date" value={from}
                onChange={e => { setFrom(e.target.value); setUseCustom(true); }} />
              <span className="chart-custom-range__sep">to</span>
              <input type="date" value={to}
                onChange={e => { setTo(e.target.value); setUseCustom(true); }} />
              <button className="btn btn--primary btn--sm"
                onClick={handleCustomApply} disabled={!from || !to}>
                Apply
              </button>
            </div>
          </div>
          {monthly.length === 0 ? (
            <div className="chart__empty">No data for this period</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={monthly}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#0F6E56" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#0F6E56" stopOpacity={0}    />
                  </linearGradient>
                  <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#993C1D" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#993C1D" stopOpacity={0}    />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E0DFDB" vertical={false} />
                <XAxis dataKey="month"
                  tick={{ fontSize: 11, fill: '#6B7280' }}
                  axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    background: '#fff',
                    border: '1px solid #E0DFDB',
                    borderRadius: '6px',
                    fontSize: '12px',
                  }}
                  formatter={(val, name) => [
                    `Rs. ${Number(val).toLocaleString('en-IN')}`,
                    name === 'income' ? 'Income' : 'Expense'
                  ]}
                />
                <Legend
                  formatter={(val) => val === 'income' ? 'Income' : 'Expense'}
                  wrapperStyle={{ fontSize: '12px', paddingTop: '12px' }}
                />
                <Area type="monotone" dataKey="income"
                  stroke="#0F6E56" strokeWidth={2}
                  fill="url(#incomeGrad)"
                  dot={{ r: 3, fill: '#0F6E56', strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: '#0F6E56' }} />
                <Area type="monotone" dataKey="expense"
                  stroke="#993C1D" strokeWidth={2}
                  fill="url(#expenseGrad)"
                  dot={{ r: 3, fill: '#993C1D', strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: '#993C1D' }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      )}

      {/* Non-admin message */}
      {!isAdmin && (
        <div className="role-notice">
          <span>👋 Welcome back — you are logged in as <strong>accountant</strong> or <strong>viewer</strong>. Financial summaries are visible to admins only.</span>
        </div>
      )}

      {/* Recent transactions — all roles */}
      <div className="table-card">
        <div className="table-card__header">
          <h4 className="table-card__title">Recent Transactions</h4>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Party</th>
              <th>Description</th>
              <th>Type</th>
              <th className="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {recent.length === 0 && (
              <tr><td colSpan={5} className="table__empty">No transactions yet</td></tr>
            )}
            {recent.map((t) => (
              <tr key={t._id}>
                <td className="muted">{t.bs_date || new Date(t.date).toLocaleDateString()}</td>
                <td className="bold">{t.party?.name || '—'}</td>
                <td>{t.description}</td>
                <td><span className={`badge badge--${t.type}`}>{t.type}</span></td>
                <td className={`text-right bold ${t.type}`}>{fmt(t.gross_amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  );
};

export default Dashboard;