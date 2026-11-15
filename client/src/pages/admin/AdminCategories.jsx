import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../api/client';

export default function AdminCategories() {
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({ name: '', description: '' });

  const load = () => api.get('/categories', { params: { all: true } }).then((res) => setCategories(res.data.data));
  useEffect(() => {
    load();
  }, []);

  const save = async (e) => {
    e.preventDefault();
    await api.post('/categories', form);
    toast.success('Category created');
    setForm({ name: '', description: '' });
    load();
  };

  const remove = async (id) => {
    if (!window.confirm('Delete category?')) return;
    await api.delete(`/categories/${id}`);
    load();
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Categories</h1>
      <form onSubmit={save} className="card flex flex-wrap gap-2 p-4">
        <input className="input-field" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        <input
          className="input-field flex-1"
          placeholder="Description"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
        <button type="submit" className="btn-primary">
          Add
        </button>
      </form>
      <ul className="card divide-y">
        {categories.map((c) => (
          <li key={c._id} className="flex items-center justify-between p-3 text-sm">
            <span>
              {c.name} — {c.description}
            </span>
            <button type="button" className="text-red-600" onClick={() => remove(c._id)}>
              Delete
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
