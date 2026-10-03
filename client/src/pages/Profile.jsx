import { useState } from 'react';
import toast from 'react-hot-toast';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function Profile() {
  const { user, refreshUser } = useAuth();
  const [profile, setProfile] = useState({ name: user?.name || '', phone: user?.phone || '', email: user?.email || '' });
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '' });
  const [editingAddress, setEditingAddress] = useState(null);

  const saveProfile = async (e) => {
    e.preventDefault();
    try {
      await api.put('/users/profile', profile);
      await refreshUser();
      toast.success('Profile updated');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    try {
      await api.put('/auth/change-password', passwords);
      setPasswords({ currentPassword: '', newPassword: '' });
      toast.success('Password changed');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const updateAddress = async (e) => {
    e.preventDefault();
    try {
      if (editingAddress.id) {
        // Update existing address
        const { id, ...addressData } = editingAddress;
        await api.put(`/users/addresses/${id}`, addressData);
        toast.success('Address updated');
      } else {
        // Create new address
        await api.post('/users/addresses', editingAddress);
        toast.success('Address added');
      }
      await refreshUser();
      setEditingAddress(null);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const deleteAddress = async (addressId) => {
    if (!window.confirm('Delete this address?')) return;
    try {
      await api.delete(`/users/addresses/${addressId}`);
      await refreshUser();
      toast.success('Address deleted');
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
      <h1 className="text-3xl font-bold">My profile</h1>

      <form onSubmit={saveProfile} className="card p-5 space-y-3">
        <h2 className="font-semibold">Personal information</h2>
        {['name', 'email', 'phone'].map((field) => (
          <label key={field} className="block text-sm capitalize">
            {field}
            <input
              className="input-field mt-1"
              value={profile[field]}
              onChange={(e) => setProfile({ ...profile, [field]: e.target.value })}
            />
          </label>
        ))}
        <button type="submit" className="btn-primary">
          Save profile
        </button>
      </form>

      <form onSubmit={changePassword} className="card p-5 space-y-3">
        <h2 className="font-semibold">Change password</h2>
        <input
          type="password"
          placeholder="Current password"
          className="input-field"
          value={passwords.currentPassword}
          onChange={(e) => setPasswords({ ...passwords, currentPassword: e.target.value })}
        />
        <input
          type="password"
          placeholder="New password"
          className="input-field"
          value={passwords.newPassword}
          onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })}
        />
        <button type="submit" className="btn-primary">
          Update password
        </button>
      </form>

      <section className="card p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Saved addresses</h2>
          <button
            type="button"
            className="btn-secondary text-xs"
            onClick={() => setEditingAddress({
              fullName: '',
              phone: '',
              addressLine: '',
              city: '',
              state: '',
              postalCode: '',
              country: 'India',
              addressType: 'home',
              isDefault: false,
            })}
          >
            Add new
          </button>
        </div>
        {!user?.addresses?.length ? (
          <p className="mt-2 text-sm text-slate-600">Add addresses during checkout or click "Add new".</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {user.addresses.map((a) => (
              <li key={a._id} className="rounded border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{a.fullName}</p>
                    <p className="text-slate-600">
                      {a.addressLine}, {a.city}, {a.state} {a.postalCode}
                    </p>
                    <p className="text-xs text-slate-500">
                      {a.phone} • {a.addressType} {a.isDefault && '• Default'}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="text-xs text-blue-600 hover:underline"
                      onClick={() => setEditingAddress({ ...a, id: a._id })}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="text-xs text-red-600 hover:underline"
                      onClick={() => deleteAddress(a._id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {editingAddress && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <form onSubmit={updateAddress} className="card w-full max-w-lg p-6">
            <h2 className="text-lg font-semibold">{editingAddress.id ? 'Edit address' : 'Add new address'}</h2>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <label className="text-xs">Full Name
                <input
                  className="input-field mt-1"
                  value={editingAddress.fullName}
                  onChange={(e) => setEditingAddress({ ...editingAddress, fullName: e.target.value })}
                  required
                />
              </label>
              <label className="text-xs">Phone
                <input
                  className="input-field mt-1"
                  value={editingAddress.phone}
                  onChange={(e) => setEditingAddress({ ...editingAddress, phone: e.target.value })}
                  required
                />
              </label>
              <label className="text-xs sm:col-span-2">Address Line
                <input
                  className="input-field mt-1"
                  value={editingAddress.addressLine}
                  onChange={(e) => setEditingAddress({ ...editingAddress, addressLine: e.target.value })}
                  required
                />
              </label>
              <label className="text-xs">City
                <input
                  className="input-field mt-1"
                  value={editingAddress.city}
                  onChange={(e) => setEditingAddress({ ...editingAddress, city: e.target.value })}
                  required
                />
              </label>
              <label className="text-xs">State
                <input
                  className="input-field mt-1"
                  value={editingAddress.state}
                  onChange={(e) => setEditingAddress({ ...editingAddress, state: e.target.value })}
                  required
                />
              </label>
              <label className="text-xs">Postal Code
                <input
                  className="input-field mt-1"
                  value={editingAddress.postalCode}
                  onChange={(e) => setEditingAddress({ ...editingAddress, postalCode: e.target.value })}
                  required
                />
              </label>
              <label className="text-xs">Country
                <input
                  className="input-field mt-1"
                  value={editingAddress.country}
                  onChange={(e) => setEditingAddress({ ...editingAddress, country: e.target.value })}
                  required
                />
              </label>
              <label className="text-xs">Address Type
                <select
                  className="input-field mt-1"
                  value={editingAddress.addressType}
                  onChange={(e) => setEditingAddress({ ...editingAddress, addressType: e.target.value })}
                >
                  <option value="home">Home</option>
                  <option value="work">Work</option>
                  <option value="other">Other</option>
                </select>
              </label>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="checkbox"
                id="setDefault"
                checked={editingAddress.isDefault}
                onChange={(e) => setEditingAddress({ ...editingAddress, isDefault: e.target.checked })}
              />
              <label htmlFor="setDefault" className="text-sm">Set as default</label>
            </div>
            <div className="mt-4 flex gap-2">
              <button type="submit" className="btn-primary flex-1">Save</button>
              <button type="button" className="btn-secondary flex-1" onClick={() => setEditingAddress(null)}>Cancel</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
