// src/context/AuthContext.jsx
import { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user,    setUser]    = useState(null);
  const [token,   setToken]   = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // on app load — restore session from localStorage
  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    const storedUser  = localStorage.getItem('user');

    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
      API.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    const res = await API.post('/auth/login', { email, password });
    const { token, name, role, _id } = res.data.data;

    // save to state
    setToken(token);
    setUser({ _id, name, role });

    // save to localStorage for persistence
    localStorage.setItem('token', token);
    localStorage.setItem('user',  JSON.stringify({ _id, name, role }));

    // set axios default header
    API.defaults.headers.common['Authorization'] = `Bearer ${token}`;

    navigate('/');
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    delete API.defaults.headers.common['Authorization'];
    navigate('/login');
  };

  // role helpers
  const isAdmin      = user?.role === 'admin';
  const isAccountant = user?.role === 'accountant';
  const canEdit      = isAdmin || isAccountant;
  const canDelete    = isAdmin;

  return (
    <AuthContext.Provider value={{
      user,
      token,
      loading,
      login,
      logout,
      isAdmin,
      isAccountant,
      canEdit,
      canDelete,
      isLoggedIn: !!token,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

// custom hook to use auth anywhere
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
};

export default AuthContext;