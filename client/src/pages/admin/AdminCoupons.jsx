import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../api/client';

export default function AdminCoupons() {
  const [coupons, setCoupons] = useState([]);
  const [form, setForm] = useState({
    code: '',
    description: '',
    discountType: 'percent',
    discountValue: '',
    minOrderAmount: '0',
    maxDiscount: '',
    expiresAt: '',
    usageLimit: '',
    isActive: true,
  });

  const load = () => api.get('/coupons').then((res) => setCoupons(res.data.data));
  useEffect(() => {
    load();
  }, []);

  const save = async (e) => {
    e.preventDefault();
    await api.post('/coupons', {
      ...form,
      discountValue: Number(form.discountValue),
      minOrderAmount: Number(form.minOrderAmount),
      maxDiscount: form.maxDiscount ? Number(form.maxDiscount) : undefined,
      usageLimit: form.usageLimit ? Number(form.usageLimit) : undefined,
    });
    toast.success('Coupon created');
    load();
  };

  const toggle = async (coupon) => {
    await api.put(`/coupons/${coupon._id}`, { isActive: !coupon.isActive });
    load();
  };

  const remove = async (id) => {
    await api.delete(`/coupons/${id}`);
    load();
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Coupons</h1>
      <form onSubmit={save} className="card grid gap-2 p-4 sm:grid-cols-2">
        {Object.keys(form).map((key) =>
          key === 'discountType' ? (
            <select key={key} className="input-field" value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })}>
              <option value="percent">Percent</option>
              <option value="fixed">Fixed</option>
            </select>
          ) : key === 'isActive' ? (
            <label key={key} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
              Active
            </label>
          ) : (
            <input
              key={key}
              className="input-field"
              placeholder={key}
              type={key === 'expiresAt' ? 'date' : key.includes('Value') || key.includes('Amount') || key === 'usageLimit' ? 'number' : 'text'}
              value={form[key]}
              required={['code', 'discountValue', 'expiresAt'].includes(key)}
              onChange={(e) => setForm({ ...form, [key]: e.target.value })}
            />
          )
        )}
        <button type="submit" className="btn-primary sm:col-span-2">
          Create coupon
        </button>
      </form>
      <ul className="card divide-y">
        {coupons.map((c) => (
          <li key={c._id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
            <span>
              {c.code} — {c.discountType} {c.discountValue}
            </span>
            <div className="flex gap-2">
              <button type="button" className="btn-secondary !px-2 !py-1 text-xs" onClick={() => toggle(c)}>
                {c.isActive ? 'Deactivate' : 'Activate'}
              </button>
              <button type="button" className="text-red-600" onClick={() => remove(c._id)}>
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
