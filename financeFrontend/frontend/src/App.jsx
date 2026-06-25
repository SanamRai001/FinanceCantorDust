import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Sidebar      from './components/Sidebar';
import Topbar       from './components/Topbar';
import Dashboard    from './pages/Dashboard';
import Parties      from './pages/Parties';
import Reports      from './pages/Reports';
import Transactions from './pages/Transactions';

const Layout = ({ children }) => {
  return (
    <div className="app">
      <Sidebar />
      <div className="main">
        <Topbar />
        <div className="content">
          {children}
        </div>
      </div>
    </div>
  );
};

const App = () => {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/"             element={<Dashboard />}    />
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/reports"      element={<Reports />}      />
          <Route path="/parties"      element={<Parties />}      />
        </Routes>
      </Layout>
    </Router>
  );
};

export default App;