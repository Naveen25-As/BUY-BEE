import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../api/client';

export default function AdminInventory() {
  const [products, setProducts] = useState([]);
  const [filter, setFilter] = useState('');

  const load = () =>
    api
      .get('/admin/inventory', {
        params: {
          lowStock: filter === 'low' ? true : undefined,
          outOfStock: filter === 'out' ? true : undefined,
        },
      })
      .then((res) => setProducts(res.data.data));

  useEffect(() => {
    load();
  }, [filter]);

  const updateStock = async (id, stock) => {
    await api.patch(`/admin/inventory/${id}`, { stock: Number(stock) });
    toast.success('Stock updated');
    load();
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Inventory</h1>
      <select className="input-field max-w-xs" value={filter} onChange={(e) => setFilter(e.target.value)}>
        <option value="">All products</option>
        <option value="low">Low stock (≤5)</option>
        <option value="out">Out of stock</option>
      </select>
      <div className="card overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b bg-slate-50 text-left">
              <th className="p-2">Product</th>
              <th className="p-2">SKU</th>
              <th className="p-2">Stock</th>
              <th className="p-2">Update</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p._id} className="border-b">
                <td className="p-2">{p.name}</td>
                <td className="p-2">{p.sku}</td>
                <td className={`p-2 ${p.stock <= 5 ? 'text-red-600 font-semibold' : ''}`}>{p.stock}</td>
                <td className="p-2">
                  <input
                    type="number"
                    defaultValue={p.stock}
                    className="input-field w-24"
                    onBlur={(e) => updateStock(p._id, e.target.value)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
