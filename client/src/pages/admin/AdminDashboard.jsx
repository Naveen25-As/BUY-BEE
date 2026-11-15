import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import api from '../../api/client';
import { formatCurrency } from '../../utils/format';

export default function AdminDashboard() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get('/admin/dashboard').then((res) => setData(res.data.data));
  }, []);

  if (!data) return <div>Loading dashboard...</div>;

  const { stats, charts, lowStockProducts } = data;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Stat label="Total revenue" value={formatCurrency(stats.totalRevenue)} />
        <Stat label="Total orders" value={stats.totalOrders} />
        <Stat label="Customers" value={stats.totalCustomers} />
        <Stat label="Products" value={stats.totalProducts} />
        <Stat label="Pending orders" value={stats.pendingOrders} />
        <Stat label="Low stock SKUs" value={stats.lowStockCount} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-4">
          <h2 className="font-semibold">Revenue (30 days)</h2>
          <div className="mt-3 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={charts.ordersOverTime}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="_id" hide />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="revenue" stroke="#DAA520" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card p-4">
          <h2 className="font-semibold">Orders (30 days)</h2>
          <div className="mt-3 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts.ordersOverTime}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="_id" hide />
                <YAxis />
                <Tooltip />
                <Bar dataKey="orders" fill="#1e293b" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-4">
          <h2 className="font-semibold">Category performance</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {charts.categoryPerformance.map((c) => (
              <li key={c._id} className="flex justify-between">
                <span>{c._id}</span>
                <span>{formatCurrency(c.revenue)}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="card p-4">
          <h2 className="font-semibold">Low stock alerts</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {lowStockProducts.map((p) => (
              <li key={p._id} className="flex justify-between">
                <span>{p.name}</span>
                <span className="text-red-600">{p.stock} left</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="card p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}
