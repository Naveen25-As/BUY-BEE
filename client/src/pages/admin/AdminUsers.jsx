import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../api/client';

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [q, setQ] = useState('');

  const load = () => api.get('/users', { params: { q: q || undefined } }).then((res) => setUsers(res.data.data));
  useEffect(() => {
    load();
  }, [q]);

  const toggleActive = async (user) => {
    await api.patch(`/users/${user._id}/status`, { isActive: !user.isActive, role: user.role });
    toast.success('User updated');
    load();
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Users</h1>
      <input className="input-field max-w-sm" placeholder="Search users" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="card overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b bg-slate-50 text-left">
              <th className="p-2">Name</th>
              <th className="p-2">Email</th>
              <th className="p-2">Role</th>
              <th className="p-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u._id} className="border-b">
                <td className="p-2">{u.name}</td>
                <td className="p-2">{u.email}</td>
                <td className="p-2">{u.role}</td>
                <td className="p-2">
                  <button type="button" className="btn-secondary !px-2 !py-1 text-xs" onClick={() => toggleActive(u)}>
                    {u.isActive ? 'Active' : 'Inactive'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
