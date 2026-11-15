import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import ProductCard from '../components/ProductCard';

export default function Home() {
  const [featured, setFeatured] = useState([]);
  const [trending, setTrending] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [featRes, trendRes, catRes] = await Promise.all([
          api.get('/products', { params: { featured: true, limit: 8 } }),
          api.get('/products', { params: { sort: 'popularity', limit: 8 } }),
          api.get('/categories'),
        ]);
        setFeatured(featRes.data.data);
        setTrending(trendRes.data.data);
        setCategories(catRes.data.data);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div>
      <section className="bg-gradient-to-br from-bee-slate via-slate-800 to-bee-dark text-white">
        <div className="mx-auto grid max-w-7xl items-center gap-8 px-4 py-16 md:grid-cols-2">
          <div>
            <p className="text-sm uppercase tracking-widest text-bee-gold">Technology-first commerce</p>
            <h1 className="mt-3 text-4xl font-bold leading-tight md:text-5xl">
              Shop smarter with <span className="text-bee-gold">BUY BEE</span>
            </h1>
            <p className="mt-4 max-w-lg text-slate-200">
              Curated electronics, transparent pricing, secure checkout, and real-time order tracking.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/products" className="btn-primary">
                Browse products
              </Link>
              <Link to="/products?discount=true" className="btn-secondary !border-white/30 !bg-white/10 !text-white">
                View deals
              </Link>
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
            <ul className="space-y-3 text-sm">
              <li>✓ Verified sellers and authentic products</li>
              <li>✓ Free shipping on orders above ₹999</li>
              <li>✓ Easy returns on eligible items</li>
              <li>✓ Secure payments (COD + online)</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12">
        <h2 className="text-2xl font-bold">Shop by category</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {categories.map((cat) => (
            <Link
              key={cat._id}
              to={`/products?category=${cat._id}`}
              className="card p-4 transition hover:border-bee-gold hover:shadow"
            >
              <p className="font-semibold">{cat.name}</p>
              <p className="mt-1 text-xs text-slate-500 line-clamp-2">{cat.description}</p>
            </Link>
          ))}
        </div>
      </section>

      <Section title="Featured products" products={featured} loading={loading} />
      <Section title="Trending now" products={trending} loading={loading} link="/products?sort=popularity" />
    </div>
  );
}

function Section({ title, products, loading, link = '/products' }) {
  return (
    <section className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-2xl font-bold">{title}</h2>
        <Link to={link} className="text-sm font-semibold text-bee-gold hover:underline">
          View all
        </Link>
      </div>
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card h-72 animate-pulse bg-slate-100">
              <div className="h-48 bg-slate-200" />
              <div className="p-4 space-y-2">
                <div className="h-4 bg-slate-200 rounded w-3/4" />
                <div className="h-3 bg-slate-200 rounded w-1/2" />
                <div className="h-4 bg-slate-200 rounded w-1/3" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {products.map((p) => (
            <ProductCard key={p._id} product={p} />
          ))}
        </div>
      )}
    </section>
  );
}
