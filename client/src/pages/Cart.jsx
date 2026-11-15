import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api/client';
import { formatCurrency } from '../utils/format';

export default function Cart() {
  const [cart, setCart] = useState({ items: [] });
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/cart');
      setCart(data.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const subtotal = useMemo(
    () => cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [cart.items]
  );
  const shipping = subtotal >= 999 ? 0 : subtotal > 0 ? 49 : 0;
  const tax = Math.round(Math.max(subtotal, 0) * 0.18 * 100) / 100;
  const total = subtotal + shipping + tax;

  const updateQty = async (itemId, quantity) => {
    try {
      const { data } = await api.patch(`/cart/items/${itemId}`, { quantity });
      setCart(data.data);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const removeItem = async (itemId) => {
    try {
      const { data } = await api.delete(`/cart/items/${itemId}`);
      setCart(data.data);
      toast.success('Item removed');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const clearCart = async () => {
    if (!window.confirm('Clear all items from cart?')) return;
    const { data } = await api.delete('/cart');
    setCart(data.data);
  };

  if (loading) return <div className="p-8">Loading cart...</div>;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Shopping cart</h1>
        {cart.items.length > 0 && (
          <button type="button" className="btn-secondary" onClick={clearCart}>
            Clear cart
          </button>
        )}
      </div>

      {cart.items.length === 0 ? (
        <div className="card mt-6 p-10 text-center">
          <p>Your cart is empty.</p>
          <Link to="/products" className="btn-primary mt-4 inline-flex">
            Continue shopping
          </Link>
        </div>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-4">
            {cart.items.map((item) => (
              <article key={item._id} className="card flex gap-4 p-4">
                <img src={item.product.images?.[0]} alt="" className="h-24 w-24 rounded object-cover" />
                <div className="flex-1">
                  <h2 className="font-semibold">{item.product.name}</h2>
                  <p className="text-sm text-slate-500">{item.product.brand}</p>
                  <p className="mt-1 font-bold">{formatCurrency(item.price)}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <button type="button" className="btn-secondary !px-2" onClick={() => updateQty(item._id, item.quantity - 1)}>
                      -
                    </button>
                    <span>{item.quantity}</span>
                    <button type="button" className="btn-secondary !px-2" onClick={() => updateQty(item._id, item.quantity + 1)}>
                      +
                    </button>
                    <button type="button" className="ml-auto text-sm text-red-600" onClick={() => removeItem(item._id)}>
                      Remove
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <aside className="card h-fit p-4">
            <h2 className="font-semibold">Order summary</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt>Subtotal</dt>
                <dd>{formatCurrency(subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Shipping</dt>
                <dd>{shipping === 0 ? 'Free' : formatCurrency(shipping)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Tax (18%)</dt>
                <dd>{formatCurrency(tax)}</dd>
              </div>
              <div className="flex justify-between border-t pt-2 text-base font-bold">
                <dt>Total</dt>
                <dd>{formatCurrency(total)}</dd>
              </div>
            </dl>
            <button type="button" className="btn-primary mt-4 w-full" onClick={() => navigate('/checkout')}>
              Proceed to checkout
            </button>
          </aside>
        </div>
      )}
    </div>
  );
}
