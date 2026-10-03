import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../api/client';
import { formatCurrency } from '../../utils/format';

const STATUSES = ['pending', 'confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered', 'cancelled'];

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [status, setStatus] = useState('');

  const load = () => api.get('/orders', { params: { status: status || undefined } }).then((res) => setOrders(res.data.data));
  useEffect(() => {
    load();
  }, [status]);

  const updateStatus = async (id, next) => {
    try {
      await api.patch(`/orders/${id}/status`, { status: next });
      toast.success('Status updated');
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Orders</h1>
      <select className="input-field max-w-xs" value={status} onChange={(e) => setStatus(e.target.value)}>
        <option value="">All statuses</option>
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <div className="card overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b bg-slate-50 text-left">
              <th className="p-2">Order</th>
              <th className="p-2">Customer</th>
              <th className="p-2">Total</th>
              <th className="p-2">Status</th>
              <th className="p-2">Update</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o._id} className="border-b">
                <td className="p-2">{o.orderNumber}</td>
                <td className="p-2">{o.user?.name}</td>
                <td className="p-2">{formatCurrency(o.total)}</td>
                <td className="p-2 capitalize">{o.orderStatus.replaceAll('_', ' ')}</td>
                <td className="p-2">
                  <select
                    className="input-field"
                    defaultValue=""
                    onChange={(e) => {
                      if (e.target.value) updateStatus(o._id, e.target.value);
                      e.target.value = '';
                    }}
                  >
                    <option value="">Change status</option>
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
