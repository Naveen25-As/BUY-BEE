import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar({ onSearch }) {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();

  const handleSearch = (e) => {
    e.preventDefault();
    const q = e.target.q.value.trim();
    if (q) navigate(`/products?q=${encodeURIComponent(q)}`);
  };

  return (
    <header className="sticky top-0 z-50 border-b border-slate-800 bg-bee-slate text-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
        <Link to="/" className="flex items-center gap-2 font-bold">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-bee-gold text-sm text-white">BB</span>
          <span className="text-lg text-bee-gold">BUY BEE</span>
        </Link>

        <nav className="hidden items-center gap-5 text-sm md:flex">
          <Link className="hover:text-bee-gold" to="/">
            Home
          </Link>
          <Link className="hover:text-bee-gold" to="/products">
            Products
          </Link>
          <Link className="hover:text-bee-gold" to="/products?featured=true">
            Deals
          </Link>
        </nav>

        <form onSubmit={handleSearch} className="order-3 flex min-w-[220px] flex-1 md:order-none">
          <input
            name="q"
            type="search"
            placeholder="Search products, brands..."
            aria-label="Search products"
            className="w-full rounded-l-lg border-0 px-3 py-2 text-sm text-slate-900 outline-none"
          />
          <button type="submit" className="rounded-r-lg bg-bee-gold px-4 text-sm font-semibold text-white">
            Search
          </button>
        </form>

        <div className="ml-auto flex items-center gap-3 text-sm">
          {user ? (
            <>
              <Link to="/wishlist" aria-label="Wishlist" className="hover:text-bee-gold">
                Wishlist
              </Link>
              <Link to="/cart" aria-label="Cart" className="hover:text-bee-gold">
                Cart
              </Link>
              <Link to="/orders" className="hover:text-bee-gold">
                Orders
              </Link>
              <Link to="/profile" className="hover:text-bee-gold">
                {user.name.split(' ')[0]}
              </Link>
              {isAdmin && (
                <Link to="/admin" className="rounded-md bg-bee-gold/20 px-2 py-1 text-bee-gold">
                  Admin
                </Link>
              )}
              <button type="button" onClick={logout} className="hover:text-bee-gold">
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="hover:text-bee-gold">
                Login
              </Link>
              <Link to="/register" className="btn-primary !py-2 text-xs">
                Sign Up
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
