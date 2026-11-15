import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { formatCurrency, formatDate } from '../utils/format';

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/orders/my').then((res) => {
      setOrders(res.data.data);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="p-8">Loading orders...</div>;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-3xl font-bold">Order history</h1>
      {orders.length === 0 ? (
        <div className="card mt-6 p-8 text-center">No orders yet.</div>
      ) : (
        <ul className="mt-6 space-y-3">
          {orders.map((order) => (
            <li key={order._id} className="card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold">{order.orderNumber}</p>
                  <p className="text-sm text-slate-500">{formatDate(order.createdAt)}</p>
                </div>
                <p className="text-sm capitalize">{order.orderStatus.replaceAll('_', ' ')}</p>
                <p className="font-bold">{formatCurrency(order.total)}</p>
                <Link to={`/orders/${order._id}`} className="btn-secondary text-xs">
                  View details
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
