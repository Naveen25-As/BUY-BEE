import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { formatCurrency } from '../utils/format';

export default function Checkout() {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [cart, setCart] = useState({ items: [] });
  const [addressId, setAddressId] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('cod');
  const [placing, setPlacing] = useState(false);
  const [newAddress, setNewAddress] = useState({
    fullName: '',
    phone: '',
    addressLine: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'India',
    addressType: 'home',
    isDefault: true,
  });

  useEffect(() => {
    api.get('/cart').then((res) => setCart(res.data.data));
  }, []);

  useEffect(() => {
    const defaultAddr = user?.addresses?.find((a) => a.isDefault) || user?.addresses?.[0];
    if (defaultAddr) setAddressId(defaultAddr._id);
  }, [user]);

  const subtotal = useMemo(
    () => cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [cart.items]
  );
  const shipping = subtotal >= 999 ? 0 : subtotal > 0 ? 49 : 0;
  const taxable = Math.max(subtotal - discount, 0);
  const tax = Math.round(taxable * 0.18 * 100) / 100;
  const total = taxable + shipping + tax;

  const applyCoupon = async () => {
    try {
      const { data } = await api.post('/coupons/validate', { code: couponCode, subtotal });
      setDiscount(data.data.discount);
      toast.success(`Coupon applied: -${formatCurrency(data.data.discount)}`);
      setStep(3);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const saveAddress = async () => {
    try {
      const { data } = await api.post('/users/addresses', newAddress);
      updateUser(data.user);
      const latest = data.user.addresses[data.user.addresses.length - 1];
      setAddressId(latest._id);
      toast.success('Address saved');
      setStep(2);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const placeOrder = async () => {
    if (!addressId) return toast.error('Select a shipping address');
    setPlacing(true);
    try {
      const { data } = await api.post('/orders', {
        addressId,
        paymentMethod,
        couponCode: discount > 0 ? couponCode : undefined,
      });
      toast.success('Order placed successfully');
      navigate(`/orders/${data.data._id}`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setPlacing(false);
    }
  };

  if (!cart.items.length) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="card p-8 text-center">Your cart is empty.</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-3xl font-bold">Checkout</h1>
      <ol className="mt-4 flex flex-wrap gap-2 text-sm">
        {['Address', 'Summary', 'Coupon', 'Payment', 'Confirm'].map((label, idx) => (
          <li
            key={label}
            className={`rounded-full px-3 py-1 ${step === idx + 1 ? 'bg-bee-gold text-white' : 'bg-slate-200'}`}
          >
            {idx + 1}. {label}
          </li>
        ))}
      </ol>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="card p-5">
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="font-semibold">Shipping address</h2>
              {user?.addresses?.length > 0 && (
                <div className="space-y-2">
                  {user.addresses.map((addr) => (
                    <label key={addr._id} className="flex cursor-pointer gap-2 rounded border p-3">
                      <input type="radio" name="address" checked={addressId === addr._id} onChange={() => setAddressId(addr._id)} />
                      <span className="text-sm">
                        {addr.fullName}, {addr.addressLine}, {addr.city}, {addr.state} {addr.postalCode}
                      </span>
                    </label>
                  ))}
                </div>
              )}
              <div className="grid gap-2 sm:grid-cols-2">
                {Object.keys(newAddress).map((key) =>
                  key === 'isDefault' ? null : (
                    <label key={key} className="text-xs capitalize">
                      {key.replace(/([A-Z])/g, ' $1')}
                      <input
                        className="input-field mt-1"
                        value={newAddress[key]}
                        onChange={(e) => setNewAddress({ ...newAddress, [key]: e.target.value })}
                      />
                    </label>
                  )
                )}
              </div>
              <button type="button" className="btn-primary" onClick={saveAddress}>
                Save & continue
              </button>
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 className="font-semibold">Order summary</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {cart.items.map((item) => (
                  <li key={item._id} className="flex justify-between">
                    <span>
                      {item.product.name} × {item.quantity}
                    </span>
                    <span>{formatCurrency(item.price * item.quantity)}</span>
                  </li>
                ))}
              </ul>
              <button type="button" className="btn-primary mt-4" onClick={() => setStep(3)}>
                Continue
              </button>
            </div>
          )}

          {step === 3 && (
            <div>
              <h2 className="font-semibold">Apply coupon</h2>
              <div className="mt-2 flex gap-2">
                <input
                  className="input-field"
                  placeholder="Coupon code"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                />
                <button type="button" className="btn-secondary" onClick={applyCoupon}>
                  Apply
                </button>
              </div>
              <button type="button" className="btn-primary mt-4" onClick={() => setStep(4)}>
                Continue
              </button>
            </div>
          )}

          {step === 4 && (
            <div>
              <h2 className="font-semibold">Payment method</h2>
              <label className="mt-2 flex items-center gap-2">
                <input type="radio" checked={paymentMethod === 'cod'} onChange={() => setPaymentMethod('cod')} />
                Cash on Delivery
              </label>
              <label className="mt-2 flex items-center gap-2">
                <input type="radio" checked={paymentMethod === 'online'} onChange={() => setPaymentMethod('online')} />
                Online payment (secure gateway placeholder)
              </label>
              <button type="button" className="btn-primary mt-4" onClick={() => setStep(5)}>
                Review order
              </button>
            </div>
          )}

          {step === 5 && (
            <div>
              <h2 className="font-semibold">Confirm your order</h2>
              <p className="mt-2 text-sm text-slate-600">
                Payment: {paymentMethod === 'cod' ? 'Cash on Delivery' : 'Online (pending integration)'}
              </p>
              <button type="button" disabled={placing} className="btn-primary mt-4" onClick={placeOrder}>
                {placing ? 'Placing order...' : 'Place order'}
              </button>
            </div>
          )}
        </div>

        <aside className="card h-fit p-4 text-sm">
          <p className="font-semibold">Totals</p>
          <p className="mt-2 flex justify-between">
            <span>Subtotal</span>
            <span>{formatCurrency(subtotal)}</span>
          </p>
          <p className="flex justify-between">
            <span>Discount</span>
            <span>-{formatCurrency(discount)}</span>
          </p>
          <p className="flex justify-between">
            <span>Shipping</span>
            <span>{shipping ? formatCurrency(shipping) : 'Free'}</span>
          </p>
          <p className="flex justify-between">
            <span>Tax</span>
            <span>{formatCurrency(tax)}</span>
          </p>
          <p className="mt-2 flex justify-between border-t pt-2 text-base font-bold">
            <span>Total</span>
            <span>{formatCurrency(total)}</span>
          </p>
        </aside>
      </div>
    </div>
  );
}
