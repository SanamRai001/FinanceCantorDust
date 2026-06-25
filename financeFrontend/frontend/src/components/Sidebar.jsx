import { NavLink } from 'react-router-dom';

const Sidebar = () => {
  return (
    <div className="sidebar">
      <h1 className="text-4xl text-center">Finance App</h1>
      <nav className="sidebarNav">
        <NavLink to="/"             end className={({ isActive }) => isActive ? 'sidebar_link sidebar_link--active' : 'sidebar_link'}>Dashboard</NavLink>
        <NavLink to="/transactions"     className={({ isActive }) => isActive ? 'sidebar_link sidebar_link--active' : 'sidebar_link'}>Transactions</NavLink>
        <NavLink to="/reports"          className={({ isActive }) => isActive ? 'sidebar_link sidebar_link--active' : 'sidebar_link'}>Reports</NavLink>
        <NavLink to="/parties"          className={({ isActive }) => isActive ? 'sidebar_link sidebar_link--active' : 'sidebar_link'}>Parties</NavLink>

      </nav>
      <img src="/cantorDust.png" alt="logo" className="sidebarLogo" />
    </div>
  );
};

export default Sidebar;