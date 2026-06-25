import { useLocation } from 'react-router-dom';

const pageTitles = {
  '/':             'Dashboard',
  '/transactions': 'Transactions',
  '/reports':      'Reports',
  '/parties':      'Parties',
};

const Topbar = () => {
  const location = useLocation();
  const title = pageTitles[location.pathname] || 'Nepal Fin-Pro';

  return (
    <header className="topbar">
      <span className="topbar__title">{title}</span>
        Login Button    
    </header>
  );
};

export default Topbar;