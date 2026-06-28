import { useLocation } from 'react-router-dom';
import { useAuth }     from '../context/AuthContext';

const pageTitles = {
  '/':             'Dashboard',
  '/transactions': 'Transactions',
  '/reports':      'Reports',
  '/parties':      'Parties',
  '/categories': 'Categories',
  '/accounts': 'Chart of Accounts',
  '/opening-balances': 'Opening Balances',
  '/journals': 'Journal Entries',
  '/export': 'Export'
};

const Topbar = () => {
  const location      = useLocation();
  const { user, logout } = useAuth();
  const title         = pageTitles[location.pathname] || 'Nepal Fin-Pro';

  return (
    <header className="topbar">
      <span className="topbar__title">{title}</span>
      <div className="topbar__right">
        <span className="topbar__user">{user?.name}</span>
        <span className="topbar__role">{user?.role}</span>
        <button className="btn btn--ghost btn--sm" onClick={logout}>
          Logout
        </button>
      </div>
    </header>
  );
};

export default Topbar;