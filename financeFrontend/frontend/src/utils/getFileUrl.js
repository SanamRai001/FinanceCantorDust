const getFileUrl = (path) => {
  if (!path) return null;
  const base = import.meta.env.VITE_API_URL?.replace('/api', '')
               || 'http://localhost:5000';
  const normalized = path.replace(/\\/g, '/');
  return `${base}/${normalized}`;
};

export default getFileUrl;