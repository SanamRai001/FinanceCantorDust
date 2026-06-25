import { useState, useEffect } from 'react';
import API from '../services/api';

// ── Line chart ────────────────────────────
const LineChart = ({ monthly }) => {
  const width  = 600;
  const height = 200;
  const padL   = 20;
  const padR   = 20;
  const padT   = 20;
  const padB   = 40;
  const chartW = width  - padL - padR;
  const chartH = height - padT - padB;

  if (!monthly || monthly.length === 0) {
    return <div className="chart__empty">No data for this period</div>;
  }

  const maxVal    = Math.max(...monthly.map(m => Math.max(m.income, m.expense)), 1);
  const toY       = (val) => padT + chartH - (val / maxVal) * chartH;
  const toX       = (i)   => padL + (i / (monthly.length - 1 || 1)) * chartW;
  const incPoints = monthly.map((m, i) => `${toX(i)},${toY(m.income)}`).join(' ');
  const expPoints = monthly.map((m, i) => `${toX(i)},${toY(m.expense)}`).join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="line-chart"
      preserveAspectRatio="xMidYMid meet">
      {monthly.map((m, i) => (
        <text key={i} x={toX(i)} y={height - 8}
          textAnchor="middle" fontSize="10" fill="#6B7280">
          {m.month}
        </text>
      ))}
      <polygon
        points={`${padL},${padT + chartH} ${incPoints} ${toX(monthly.length - 1)},${padT + chartH}`}
        fill="rgba(15,110,86,0.08)" />
      <polygon
        points={`${padL},${padT + chartH} ${expPoints} ${toX(monthly.length - 1)},${padT + chartH}`}
        fill="rgba(153,60,29,0.08)" />
      <polyline points={incPoints} fill="none"
        stroke="#0F6E56" strokeWidth="2"
        strokeLinejoin="round" strokeLinecap="round" />
      <polyline points={expPoints} fill="none"
        stroke="#993C1D" strokeWidth="2"
        strokeLinejoin="round" strokeLinecap="round" />
      {monthly.map((m, i) => (
        <circle key={`i-${i}`} cx={toX(i)} cy={toY(m.income)}
          r="4" fill="#0F6E56" stroke="white" strokeWidth="2">
          <title>Income {m.month}: Rs. {m.income.toLocaleString('en-IN')}</title>
        </circle>
      ))}
      {monthly.map((m, i) => (
        <circle key={`e-${i}`} cx={toX(i)} cy={toY(m.expense)}
          r="4" fill="#993C1D" stroke="white" strokeWidth="2">
          <title>Expense {m.month}: Rs. {m.expense.toLocaleString('en-IN')}</title>
        </circle>
      ))}
    </svg>
  );
};

const getPeriodDates = (period) => {
  const now   = new Date();
  const year  = now.getFullYear();
  const month = now.getMonth();
  const today = now.toISOString().split('T')[0];

  switch (period) {
    case '7d':
      return {
        from: new Date(now - 7  * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        to:   today,
      };
    case '30d':
      return {
        from: new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        to:   today,
      };
    case '3m':
      return {
        from: new Date(year, month - 2,  1).toISOString().split('T')[0],
        to:   new Date(year, month + 1,  0).toISOString().split('T')[0],
      };
    case '6m':
      return {
        from: new Date(year, month - 5,  1).toISOString().split('T')[0],
        to:   new Date(year, month + 1,  0).toISOString().split('T')[0],
      };
    case '1y':
      return {
        from: new Date(year - 1, month + 1, 1).toISOString().split('T')[0],
        to:   new Date(year,     month + 1, 0).toISOString().split('T')[0],
      };
    case '2y':
      return {
        from: new Date(year - 2, month + 1, 1).toISOString().split('T')[0],
        to:   new Date(year,     month + 1, 0).toISOString().split('T')[0],
      };
    case 'all':
    default:
      return {};
  }
};
// ── Dashboard ─────────────────────────────
const Dashboard = () => {
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
      const [plRes, txnRes] = await Promise.all([
        API.get('/reports/pl', { params }),
        API.get('/transactions')
      ]);
      setSummary(plRes.data.summary);
      setMonthly(plRes.data.monthly_breakdown || []);
      setRecent((txnRes.data.data || []).slice(0, 5));
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

  return (
    <div className="dashboard">

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

      <div className="chart-card">
        <div className="chart-card__header">
          <h4 className="chart-card__title">Income vs Expenses</h4>
          <div className="chart-legend">
            <span className="chart-legend__dot chart-legend__dot--income" />
            <span className="chart-legend__label">Income</span>
            <span className="chart-legend__dot chart-legend__dot--expense" />
            <span className="chart-legend__label">Expenses</span>
          </div>
        </div>
        <div className="chart-filters">
          <div className="period-btns">
  {[
    { key: '7d',  label: '7 Days'   },
    { key: '30d', label: '30 Days'  },
    { key: '3m',  label: '3 Months' },
    { key: '6m',  label: '6 Months' },
    { key: '1y',  label: '1 Year'   },
    { key: '2y',  label: '2 Years'  },
    { key: 'all', label: 'All time' },
  ].map(p => (
    <button key={p.key}
      className={`period-btn ${period === p.key && !useCustom ? 'period-btn--active' : ''}`}
      onClick={() => { setPeriod(p.key); setUseCustom(false); }}>
      {p.label}
    </button>
  ))}
</div>
        </div>
        {loading
          ? <div className="chart__empty">Loading...</div>
          : <LineChart monthly={monthly} />
        }
      </div>

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