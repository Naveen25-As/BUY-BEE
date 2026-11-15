import { Link } from 'react-router-dom';
import { formatCurrency } from '../utils/format';

export default function ProductCard({ product }) {
  const rating = product.rating?.rating || 0;
  const inStock = product.stock > 0;

  return (
    <article className="card group overflow-hidden transition hover:-translate-y-0.5 hover:shadow-md">
      <Link to={`/products/${product._id}`} className="block">
        <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
          <img
            src={product.images?.[0]}
            alt={product.name}
            className="h-full w-full object-cover transition group-hover:scale-105"
            loading="lazy"
            decoding="async"
          />
          {product.discountPercent > 0 && (
            <span className="absolute left-2 top-2 rounded bg-red-500 px-2 py-0.5 text-xs font-semibold text-white">
              -{product.discountPercent}%
            </span>
          )}
        </div>
        <div className="p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">{product.brand}</p>
          <h3 className="mt-1 line-clamp-2 font-semibold text-slate-900">{product.name}</h3>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-lg font-bold text-bee-dark">{formatCurrency(product.price)}</span>
            {product.originalPrice > product.price && (
              <span className="text-sm text-slate-400 line-through">{formatCurrency(product.originalPrice)}</span>
            )}
          </div>
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="text-amber-600">★ {rating.toFixed(1)}</span>
            <span className={inStock ? 'text-emerald-600' : 'text-red-600'}>
              {inStock ? `${product.stock} in stock` : 'Out of stock'}
            </span>
          </div>
        </div>
      </Link>
    </article>
  );
}
