import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../api/client';
import ProductCard from '../components/ProductCard';

export default function Products() {
  const [params, setParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);

  const q = params.get('q') || '';
  const category = params.get('category') || '';
  const brand = params.get('brand') || '';
  const sort = params.get('sort') || 'newest';
  const page = Number(params.get('page') || 1);
  const minPrice = params.get('minPrice') || '';
  const maxPrice = params.get('maxPrice') || '';
  const minRating = params.get('minRating') || '';
  const discount = params.get('discount') || '';
  const inStock = params.get('inStock') || '';
  const featured = params.get('featured') || '';

  useEffect(() => {
    api.get('/categories').then((res) => setCategories(res.data.data));
    api.get('/products/brands').then((res) => setBrands(res.data.data));
  }, []);

  useEffect(() => {
    setLoading(true);
    api
      .get('/products', {
        params: {
          q: q || undefined,
          category: category || undefined,
          brand: brand || undefined,
          sort,
          page,
          minPrice: minPrice || undefined,
          maxPrice: maxPrice || undefined,
          minRating: minRating || undefined,
          discount: discount || undefined,
          inStock: inStock || undefined,
          featured: featured || undefined,
          limit: 12,
        },
      })
      .then((res) => {
        setProducts(res.data.data);
        setPagination(res.data.pagination);
      })
      .finally(() => setLoading(false));
  }, [q, category, brand, sort, page, minPrice, maxPrice, minRating, discount, inStock, featured]);

  const updateParam = (key, value) => {
    const next = new URLSearchParams(params);
    if (!value) next.delete(key);
    else next.set(key, value);
    if (key !== 'page') next.set('page', '1');
    setParams(next);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-3xl font-bold">Products</h1>
      <p className="mt-1 text-slate-600">{pagination.total} products found</p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[260px_1fr]">
        <aside className="card h-fit space-y-4 p-4">
          <FilterSelect label="Category" value={category} onChange={(v) => updateParam('category', v)}>
            <option value="">All</option>
            {categories.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect label="Brand" value={brand} onChange={(v) => updateParam('brand', v)}>
            <option value="">All</option>
            {brands.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect label="Sort by" value={sort} onChange={(v) => updateParam('sort', v)}>
            <option value="newest">Newest</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
            <option value="rating">Rating</option>
            <option value="popularity">Popularity</option>
          </FilterSelect>
          <div>
            <label className="text-sm font-medium">Min price</label>
            <input
              type="number"
              value={minPrice}
              onChange={(e) => updateParam('minPrice', e.target.value)}
              className="input-field mt-1"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Max price</label>
            <input
              type="number"
              value={maxPrice}
              onChange={(e) => updateParam('maxPrice', e.target.value)}
              className="input-field mt-1"
            />
          </div>
          <FilterSelect label="Min rating" value={minRating} onChange={(v) => updateParam('minRating', v)}>
            <option value="">Any</option>
            <option value="4">4+ stars</option>
            <option value="3">3+ stars</option>
          </FilterSelect>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={discount === 'true'}
              onChange={(e) => updateParam('discount', e.target.checked ? 'true' : '')}
            />
            On discount
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={inStock === 'true'}
              onChange={(e) => updateParam('inStock', e.target.checked ? 'true' : '')}
            />
            In stock only
          </label>
        </aside>

        <section>
          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
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
          ) : products.length === 0 ? (
            <div className="card p-10 text-center text-slate-600">No products match your filters.</div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {products.map((p) => (
                <ProductCard key={p._id} product={p} />
              ))}
            </div>
          )}

          {pagination.pages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                className="btn-secondary"
                onClick={() => updateParam('page', String(page - 1))}
              >
                Previous
              </button>
              <span className="text-sm">
                Page {page} of {pagination.pages}
              </span>
              <button
                type="button"
                disabled={page >= pagination.pages}
                className="btn-secondary"
                onClick={() => updateParam('page', String(page + 1))}
              >
                Next
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function FilterSelect({ label, value, onChange, children }) {
  return (
    <div>
      <label className="text-sm font-medium">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="input-field mt-1">
        {children}
      </select>
    </div>
  );
}
