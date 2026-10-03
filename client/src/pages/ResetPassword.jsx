import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function ResetPassword() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { updateUser } = useAuth();
  const [password, setPassword] = useState('');

  const onSubmit = async (e) => {
    e.preventDefault();
    try {
      const { data } = await api.put(`/auth/reset-password/${token}`, { password });
      localStorage.setItem('buybee_token', data.token);
      updateUser(data.user);
      toast.success('Password reset successful');
      navigate('/');
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <form onSubmit={onSubmit} className="card p-6">
        <h1 className="text-2xl font-bold">Reset password</h1>
        <label className="mt-4 block text-sm font-medium">
          New password
          <input
            type="password"
            minLength={6}
            required
            className="input-field mt-1"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <button type="submit" className="btn-primary mt-4 w-full">
          Update password
        </button>
      </form>
    </div>
  );
}
