import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../api/client';

const empty = {
  name: '',
  description: '',
  price: '',
  originalPrice: '',
  category: '',
  brand: '',
  images: '',
  stock: '',
  sku: '',
  isFeatured: false,
};

export default function AdminProducts() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState(null);
  const [q, setQ] = useState('');

  const load = () => {
    api.get('/products', { params: { q, limit: 50, page: 1 } }).then((res) => setProducts(res.data.data));
    api.get('/categories', { params: { all: true } }).then((res) => setCategories(res.data.data));
  };

  useEffect(() => {
    load();
  }, [q]);

  const save = async (e) => {
    e.preventDefault();
    const payload = {
      ...form,
      price: Number(form.price),
      originalPrice: form.originalPrice ? Number(form.originalPrice) : undefined,
      stock: Number(form.stock),
      images: form.images.split(',').map((s) => s.trim()).filter(Boolean),
    };
    try {
      if (editingId) await api.put(`/products/${editingId}`, payload);
      else await api.post('/products', payload);
      toast.success('Product saved');
      setForm(empty);
      setEditingId(null);
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const edit = (p) => {
    setEditingId(p._id);
    setForm({
      name: p.name,
      description: p.description,
      price: p.price,
      originalPrice: p.originalPrice || '',
      category: p.category._id || p.category,
      brand: p.brand,
      images: p.images.join(', '),
      stock: p.stock,
      sku: p.sku,
      isFeatured: p.isFeatured,
    });
  };

  const remove = async (id) => {
    if (!window.confirm('Deactivate product?')) return;
    await api.delete(`/products/${id}`);
    toast.success('Product deactivated');
    load();
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Products</h1>
      <input className="input-field max-w-sm" placeholder="Search products" value={q} onChange={(e) => setQ(e.target.value)} />

      <form onSubmit={save} className="card grid gap-2 p-4 sm:grid-cols-2">
        {Object.entries(form).map(([key, val]) =>
          key === 'category' ? (
            <select key={key} className="input-field" value={val} onChange={(e) => setForm({ ...form, category: e.target.value })} required>
              <option value="">Category</option>
              {categories.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
          ) : key === 'isFeatured' ? (
            <label key={key} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={val} onChange={(e) => setForm({ ...form, isFeatured: e.target.checked })} />
              Featured
            </label>
          ) : (
            <input
              key={key}
              className="input-field"
              placeholder={key}
              value={val}
              required={!['originalPrice'].includes(key)}
              onChange={(e) => setForm({ ...form, [key]: e.target.value })}
            />
          )
        )}
        <button type="submit" className="btn-primary sm:col-span-2">
          {editingId ? 'Update product' : 'Create product'}
        </button>
      </form>

      <div className="card overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b bg-slate-50 text-left">
              <th className="p-2">Name</th>
              <th className="p-2">SKU</th>
              <th className="p-2">Stock</th>
              <th className="p-2">Price</th>
              <th className="p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p._id} className="border-b">
                <td className="p-2">{p.name}</td>
                <td className="p-2">{p.sku}</td>
                <td className="p-2">{p.stock}</td>
                <td className="p-2">{p.price}</td>
                <td className="p-2 space-x-2">
                  <button type="button" className="btn-secondary !px-2 !py-1 text-xs" onClick={() => edit(p)}>
                    Edit
                  </button>
                  <button type="button" className="text-xs text-red-600" onClick={() => remove(p._id)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
