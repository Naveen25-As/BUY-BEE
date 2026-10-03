import { NavLink, Outlet } from 'react-router-dom';

const links = [
  ['', 'Dashboard'],
  ['products', 'Products'],
  ['categories', 'Categories'],
  ['inventory', 'Inventory'],
  ['orders', 'Orders'],
  ['users', 'Users'],
  ['coupons', 'Coupons'],
  ['reviews', 'Reviews'],
];

export default function AdminLayout() {
  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b bg-bee-slate px-4 py-3 text-white">
        <p className="font-bold text-bee-gold">BUY BEE Admin</p>
      </header>
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[220px_1fr]">
        <nav className="card h-fit p-3 text-sm">
          {links.map(([path, label]) => (
            <NavLink
              key={path}
              end={path === ''}
              to={path ? `/admin/${path}` : '/admin'}
              className={({ isActive }) =>
                `block rounded px-3 py-2 ${isActive ? 'bg-bee-gold text-white' : 'hover:bg-slate-100'}`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
        <div>
          <Outlet />
        </div>
      </div>
    </div>
  );
}
