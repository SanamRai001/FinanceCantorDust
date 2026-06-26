import { useState, useEffect } from 'react';
import API from '../services/api';
import { useAuth } from '../context/AuthContext';

const Categories = () => {
  const [categories, setCategories] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [showForm,   setShowForm]   = useState(false);
  const [error,      setError]      = useState('');
  const [editItem,   setEditItem]   = useState(null);
  const { canEdit, canDelete }      = useAuth();

  const [form, setForm] = useState({
    name:        '',
    type:        'both',
    group:       'general',
    description: '',
    color:       '#2E5EA8'
  });

  const fetchCategories = () => {
    API.get('/categories')
      .then(res => setCategories(res.data.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchCategories(); }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleEdit = (cat) => {
    setEditItem(cat);
    setForm({
      name:        cat.name,
      type:        cat.type,
      group:       cat.group,
      description: cat.description || '',
      color:       cat.color
    });
    setShowForm(true);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (editItem) {
        await API.put(`/categories/${editItem._id}`, form);
      } else {
        await API.post('/categories', form);
      }
      setForm({ name: '', type: 'both', group: 'general', description: '', color: '#2E5EA8' });
      setShowForm(false);
      setEditItem(null);
      fetchCategories();
    } catch (err) {
      setError(err?.response?.data?.error || 'Something went wrong');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this category?')) return;
    try {
      await API.delete(`/categories/${id}`);
      fetchCategories();
    } catch (err) {
      console.error(err);
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditItem(null);
    setError('');
    setForm({ name: '', type: 'both', group: 'general', description: '', color: '#2E5EA8' });
  };

  if (loading) return <div className="page-loading">Loading...</div>;

  return (
    <div className="categories">

      {/* Header */}
      <div className="page-header">
        <h3 className="page-header__title">Categories</h3>
        {canEdit && (
          <button className="btn btn--primary"
            onClick={() => { setShowForm(!showForm); setEditItem(null); }}>
            {showForm && !editItem ? 'Cancel' : '+ Add Category'}
          </button>
        )}
      </div>

      {/* Form */}
      {showForm && (
        <form className="form-card" onSubmit={handleSubmit}>
          <h4 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
            {editItem ? 'Edit Category' : 'New Category'}
          </h4>
          {error && <div className="form-error">{error}</div>}
          <div className="form-grid">

            <div className="form-group">
              <label>Name *</label>
              <input type="text" name="name" value={form.name}
                onChange={handleChange} required
                placeholder="e.g. Office Expenses" />
            </div>

            <div className="form-group">
              <label>Type *</label>
              <select name="type" value={form.type} onChange={handleChange}>
                <option value="both">Both (income and expense)</option>
                <option value="income">Income only</option>
                <option value="expense">Expense only</option>
              </select>
            </div>

            <div className="form-group">
              <label>Group</label>
              <input type="text" name="group" value={form.group}
                onChange={handleChange}
                placeholder="e.g. general, project, hr" />
            </div>

            <div className="form-group">
              <label>Color</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="color" name="color" value={form.color}
                  onChange={handleChange}
                  style={{ width: 40, height: 36, padding: 2, border: '1px solid var(--border)', borderRadius: 'var(--radius)', cursor: 'pointer' }} />
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{form.color}</span>
              </div>
            </div>

            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label>Description</label>
              <input type="text" name="description" value={form.description}
                onChange={handleChange}
                placeholder="Optional description" />
            </div>

          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn--primary" type="submit">
              {editItem ? 'Update Category' : 'Save Category'}
            </button>
            <button className="btn btn--ghost" type="button" onClick={handleCancel}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Categories table */}
      <div className="table-card">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Group</th>
              <th>Description</th>
              <th>Status</th>
              {canEdit && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {categories.length === 0 && (
              <tr>
                <td colSpan={6} className="table__empty">
                  No categories yet — add one above
                </td>
              </tr>
            )}
            {categories.map(cat => (
              <tr key={cat._id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      width: 10, height: 10,
                      borderRadius: '50%',
                      background: cat.color,
                      display: 'inline-block',
                      flexShrink: 0
                    }} />
                    <span className="bold">{cat.name}</span>
                  </div>
                </td>
                <td>
                  <span className={`badge badge--${cat.type === 'income' ? 'income' : cat.type === 'expense' ? 'expense' : 'supplier'}`}>
                    {cat.type}
                  </span>
                </td>
                <td className="muted">{cat.group}</td>
                <td className="muted">{cat.description || '—'}</td>
                <td>
                  <span className={`badge ${cat.is_active ? 'badge--income' : 'badge--expense'}`}>
                    {cat.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                {canEdit && (
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn--ghost btn--sm"
                        onClick={() => handleEdit(cat)}>
                        Edit
                      </button>
                      {canDelete && (
                        <button className="btn btn--danger btn--sm"
                          onClick={() => handleDelete(cat._id)}>
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  );
};

export default Categories;