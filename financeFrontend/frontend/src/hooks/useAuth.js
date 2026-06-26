const useAuth = () => {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  return {
    role:         user.role     || 'viewer',
    name:         user.name     || '',
    isAdmin:      user.role === 'admin',
    isAccountant: user.role === 'accountant',
    canEdit:      user.role === 'admin' || user.role === 'accountant',
    canDelete:    user.role === 'admin',
  };
};

export default useAuth;