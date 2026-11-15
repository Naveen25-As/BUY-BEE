import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api/client';
import OrderTimeline from '../components/OrderTimeline';
import { formatCurrency, formatDate } from '../utils/format';

export default function OrderDetail() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [reviewForms, setReviewForms] = useState({});

  const load = () => api.get(`/orders/${id}`).then((res) => setOrder(res.data.data));

  useEffect(() => {
    load();
  }, [id]);

  const cancelOrder = async () => {
    if (!window.confirm('Cancel this order?')) return;
    try {
      await api.post(`/orders/${id}/cancel`, { reason: 'Changed my mind' });
      toast.success('Order cancelled');
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const submitReview = async (productId) => {
    const form = reviewForms[productId] || { rating: 5, comment: '' };
    try {
      await api.post('/reviews', { productId, orderId: id, ...form });
      toast.success('Review submitted');
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (!order) return <div className="p-8">Loading order...</div>;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{order.orderNumber}</h1>
          <p className="text-sm text-slate-500">Placed on {formatDate(order.createdAt)}</p>
        </div>
        {['pending', 'confirmed', 'processing'].includes(order.orderStatus) && (
          <button type="button" className="btn-secondary" onClick={cancelOrder}>
            Cancel order
          </button>
        )}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="card p-4">
          <h2 className="font-semibold">Items</h2>
          <ul className="mt-3 space-y-3">
            {order.items.map((item) => (
              <li key={`${item.product}-${item.name}`} className="flex justify-between text-sm">
                <span>
                  {item.name} × {item.quantity}
                </span>
                <span>{formatCurrency(item.price * item.quantity)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 border-t pt-2 font-bold">Total: {formatCurrency(order.total)}</p>
        </section>

        <section className="card p-4">
          <h2 className="font-semibold">Tracking</h2>
          <div className="mt-3">
            <OrderTimeline history={order.statusHistory} currentStatus={order.orderStatus} />
          </div>
        </section>
      </div>

      {order.orderStatus === 'delivered' && (
        <section className="card mt-6 p-4">
          <h2 className="font-semibold">Review purchased products</h2>
          <div className="mt-3 space-y-4">
            {order.items.map((item) => (
              <div key={item.product} className="rounded border p-3">
                <p className="font-medium">{item.name}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <select
                    className="input-field w-24"
                    value={reviewForms[item.product]?.rating || 5}
                    onChange={(e) =>
                      setReviewForms({
                        ...reviewForms,
                        [item.product]: {
                          ...(reviewForms[item.product] || {}),
                          rating: Number(e.target.value),
                        },
                      })
                    }
                  >
                    {[5, 4, 3, 2, 1].map((r) => (
                      <option key={r} value={r}>
                        {r} stars
                      </option>
                    ))}
                  </select>
                  <input
                    className="input-field flex-1"
                    placeholder="Write your review"
                    value={reviewForms[item.product]?.comment || ''}
                    onChange={(e) =>
                      setReviewForms({
                        ...reviewForms,
                        [item.product]: {
                          ...(reviewForms[item.product] || { rating: 5 }),
                          comment: e.target.value,
                        },
                      })
                    }
                  />
                  <button type="button" className="btn-primary" onClick={() => submitReview(item.product)}>
                    Submit
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
