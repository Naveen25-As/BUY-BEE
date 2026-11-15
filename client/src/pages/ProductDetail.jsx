import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api/client';
import ProductCard from '../components/ProductCard';
import { useAuth } from '../context/AuthContext';
import { formatCurrency } from '../utils/format';

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [product, setProduct] = useState(null);
  const [related, setRelated] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [qty, setQty] = useState(1);
  const [imageIdx, setImageIdx] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [pRes, rRes, revRes] = await Promise.all([
          api.get(`/products/${id}`),
          api.get(`/products/${id}/related`),
          api.get(`/reviews/product/${id}`),
        ]);
        setProduct(pRes.data.data);
        setRelated(rRes.data.data);
        setReviews(revRes.data.data);
      } catch {
        toast.error('Product not found');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  const requireAuth = () => {
    if (!isAuthenticated) {
      toast.error('Please log in to continue');
      navigate('/login');
      return false;
    }
    return true;
  };

  const addToCart = async () => {
    if (!requireAuth()) return;
    try {
      await api.post('/cart/items', { productId: id, quantity: qty });
      toast.success('Added to cart');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const buyNow = async () => {
    if (!requireAuth()) return;
    try {
      await api.post('/cart/items', { productId: id, quantity: qty });
      navigate('/checkout');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const toggleWishlist = async () => {
    if (!requireAuth()) return;
    try {
      await api.post(`/wishlist/${id}`);
      toast.success('Added to wishlist');
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (loading) return (
    <div className="mx-auto max-w-7xl p-8">
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="card h-96 animate-pulse bg-slate-100" />
        <div className="space-y-4">
          <div className="h-8 bg-slate-200 rounded w-3/4 animate-pulse" />
          <div className="h-4 bg-slate-200 rounded w-1/2 animate-pulse" />
          <div className="h-6 bg-slate-200 rounded w-1/3 animate-pulse" />
          <div className="h-20 bg-slate-200 rounded animate-pulse" />
          <div className="h-10 bg-slate-200 rounded animate-pulse" />
        </div>
      </div>
    </div>
  );
  if (!product) return <div className="mx-auto max-w-7xl p-8">Product not found.</div>;

  const specs = product.specifications ? Object.entries(product.specifications) : [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="grid gap-8 lg:grid-cols-2">
        <div>
          <div className="card overflow-hidden">
            <img src={product.images[imageIdx]} alt={product.name} className="aspect-square w-full object-cover" />
          </div>
          <div className="mt-3 flex gap-2">
            {product.images.map((img, idx) => (
              <button
                key={img}
                type="button"
                onClick={() => setImageIdx(idx)}
                className={`h-16 w-16 overflow-hidden rounded border ${idx === imageIdx ? 'border-bee-gold' : 'border-slate-200'}`}
              >
                <img src={img} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm uppercase text-slate-500">{product.brand}</p>
          <h1 className="mt-1 text-3xl font-bold">{product.name}</h1>
          <p className="mt-2 text-amber-600">
            ★ {(product.rating?.rating || 0).toFixed(1)} ({product.rating?.numReviews || 0} reviews)
          </p>
          <div className="mt-4 flex items-end gap-3">
            <p className="text-3xl font-bold">{formatCurrency(product.price)}</p>
            {product.originalPrice > product.price && (
              <p className="text-slate-400 line-through">{formatCurrency(product.originalPrice)}</p>
            )}
          </div>
          <p className="mt-4 text-slate-700">{product.description}</p>
          <p className={`mt-3 text-sm font-medium ${product.stock > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {product.stock > 0 ? `${product.stock} units available` : 'Out of stock'}
          </p>

          <div className="mt-4 flex items-center gap-3">
            <label htmlFor="qty" className="text-sm font-medium">
              Quantity
            </label>
            <input
              id="qty"
              type="number"
              min={1}
              max={product.stock}
              value={qty}
              onChange={(e) => setQty(Math.max(1, Math.min(product.stock, Number(e.target.value) || 1)))}
              className="input-field w-24"
              disabled={product.stock < 1}
            />
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button type="button" className="btn-primary" disabled={product.stock < 1} onClick={addToCart}>
              Add to cart
            </button>
            <button type="button" className="btn-secondary" disabled={product.stock < 1} onClick={buyNow}>
              Buy now
            </button>
            <button type="button" className="btn-secondary" onClick={toggleWishlist}>
              Wishlist
            </button>
          </div>

          {specs.length > 0 && (
            <div className="mt-8">
              <h2 className="font-semibold">Specifications</h2>
              <dl className="mt-2 divide-y rounded-lg border">
                {specs.map(([k, v]) => (
                  <div key={k} className="grid grid-cols-2 gap-2 px-3 py-2 text-sm">
                    <dt className="text-slate-500">{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </div>
      </div>

      <section className="mt-12">
        <h2 className="text-xl font-bold">Customer reviews</h2>
        {reviews.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">No reviews yet.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {reviews.map((r) => (
              <li key={r._id} className="card p-4">
                <p className="font-medium">{r.user?.name}</p>
                <p className="text-xs text-amber-600">★ {r.rating}</p>
                <p className="mt-1 text-sm">{r.comment}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {related.length > 0 && (
        <section className="mt-12">
          <h2 className="text-xl font-bold">Related products</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((p) => (
              <ProductCard key={p._id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
