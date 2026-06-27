import { NavLink } from 'react-router-dom';

const Sidebar = () => {
  return (
    <div className="sidebar">

      {/* Logo at top */}
      <div className="sidebar__logoWrap">
        <img src="/cantorDust.png" alt="logo" className="sidebarLogo" />
      </div>

      <nav className="sidebarNav">
        <NavLink to="/" end
          className={({ isActive }) =>
            isActive ? 'sidebar_link sidebar_link--active' : 'sidebar_link'}>
          Dashboard
        </NavLink>
        <NavLink to="/transactions"
          className={({ isActive }) =>
            isActive ? 'sidebar_link sidebar_link--active' : 'sidebar_link'}>
          Transactions
        </NavLink>
        <NavLink to="/reports"
          className={({ isActive }) =>
            isActive ? 'sidebar_link sidebar_link--active' : 'sidebar_link'}>
          Reports
        </NavLink>
        <NavLink to="/parties"
          className={({ isActive }) =>
            isActive ? 'sidebar_link sidebar_link--active' : 'sidebar_link'}>
          Parties
        </NavLink>
        <NavLink to="/categories"
  className={({ isActive }) =>
    isActive ? 'sidebar_link sidebar_link--active' : 'sidebar_link'}>
  Categories
</NavLink>
<NavLink to="/accounts"
  className={({ isActive }) =>
    isActive ? 'sidebar_link sidebar_link--active' : 'sidebar_link'}>
  Chart of Accounts
</NavLink>
<NavLink to="/opening-balances"
  className={({ isActive }) =>
    isActive ? 'sidebar_link sidebar_link--active' : 'sidebar_link'}>
  Opening Balances
</NavLink>
<NavLink to="/journals"
  className={({ isActive }) =>
    isActive ? 'sidebar_link sidebar_link--active' : 'sidebar_link'}>
  Journal Entries
</NavLink>
      </nav>

    </div>
  );
};

export default Sidebar;