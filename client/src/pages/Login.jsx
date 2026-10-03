import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await login(form.email, form.password);
      toast.success(`Welcome back, ${user.name}`);
      const redirect = location.state?.from || (user.role === 'admin' ? '/admin' : '/');
      navigate(redirect);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md items-center px-4 py-10">
      <form onSubmit={onSubmit} className="card w-full p-6">
        <p className="text-sm uppercase tracking-wide text-bee-gold">Welcome back</p>
        <h1 className="text-2xl font-bold">Login to BUY BEE</h1>
        <label className="mt-4 block text-sm font-medium">
          Email
          <input
            type="email"
            required
            className="input-field mt-1"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </label>
        <label className="mt-3 block text-sm font-medium">
          Password
          <input
            type="password"
            required
            className="input-field mt-1"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </label>
        <Link to="/forgot-password" className="mt-2 inline-block text-sm text-bee-gold hover:underline">
          Forgot password?
        </Link>
        <button type="submit" disabled={loading} className="btn-primary mt-4 w-full">
          {loading ? 'Signing in...' : 'Log in'}
        </button>
        <p className="mt-4 text-center text-sm">
          New here?{' '}
          <Link to="/register" className="font-semibold text-bee-gold">
            Create account
          </Link>
        </p>
      </form>
    </div>
  );
}
