import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth }  from './context/AuthContext';
import Sidebar      from './components/Sidebar';
import Topbar       from './components/Topbar';
import Dashboard    from './pages/Dashboard';
import Transactions from './pages/Transactions';
import Reports      from './pages/Reports';
import Parties      from './pages/Parties';
import Login        from './pages/Login';

const ProtectedRoute = ({ children }) => {
  const { isLoggedIn, loading } = useAuth();
  if (loading)    return <div className="page-loading">Loading...</div>;
  if (!isLoggedIn) return <Navigate to="/login" />;
  return children;
};

const Layout = ({ children }) => (
  <div className="app">
    <Sidebar />
    <div className="main">
      <Topbar />
      <div className="content">{children}</div>
    </div>
  </div>
);

const App = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={
        <ProtectedRoute><Layout><Dashboard /></Layout></ProtectedRoute>
      } />
      <Route path="/transactions" element={
        <ProtectedRoute><Layout><Transactions /></Layout></ProtectedRoute>
      } />
      <Route path="/reports" element={
        <ProtectedRoute><Layout><Reports /></Layout></ProtectedRoute>
      } />
      <Route path="/parties" element={
        <ProtectedRoute><Layout><Parties /></Layout></ProtectedRoute>
      } />
    </Routes>
  );
};

export default App;