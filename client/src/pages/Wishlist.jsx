import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api/client';
import ProductCard from '../components/ProductCard';

export default function Wishlist() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data } = await api.get('/wishlist');
    setProducts(data.data.products || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const remove = async (productId) => {
    await api.delete(`/wishlist/${productId}`);
    toast.success('Removed from wishlist');
    load();
  };

  const moveToCart = async (productId) => {
    try {
      await api.post(`/wishlist/${productId}/move-to-cart`);
      toast.success('Moved to cart');
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (loading) return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card h-72 animate-pulse bg-slate-100">
            <div className="h-48 bg-slate-200" />
            <div className="p-4 space-y-2">
              <div className="h-4 bg-slate-200 rounded w-3/4" />
              <div className="h-3 bg-slate-200 rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-3xl font-bold">Wishlist</h1>
      {products.length === 0 ? (
        <div className="card mt-6 p-10 text-center">
          <p>No saved items yet.</p>
          <Link to="/products" className="btn-primary mt-4 inline-flex">
            Browse products
          </Link>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {products.map((p) => (
            <div key={p._id} className="space-y-2">
              <ProductCard product={p} />
              <div className="flex gap-2">
                <button type="button" className="btn-primary flex-1 text-xs" onClick={() => moveToCart(p._id)}>
                  Move to cart
                </button>
                <button type="button" className="btn-secondary text-xs" onClick={() => remove(p._id)}>
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
