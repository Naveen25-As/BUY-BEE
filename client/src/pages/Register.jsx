import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await register(form);
      toast.success('Account created');
      navigate('/');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md items-center px-4 py-10">
      <form onSubmit={onSubmit} className="card w-full p-6">
        <h1 className="text-2xl font-bold">Create your BUY BEE account</h1>
        {['name', 'email', 'phone', 'password'].map((field) => (
          <label key={field} className="mt-3 block text-sm font-medium capitalize">
            {field === 'phone' ? 'Phone number' : field}
            <input
              type={field === 'password' ? 'password' : field === 'email' ? 'email' : 'text'}
              required={field !== 'phone'}
              className="input-field mt-1"
              value={form[field]}
              onChange={(e) => setForm({ ...form, [field]: e.target.value })}
            />
          </label>
        ))}
        <button type="submit" disabled={loading} className="btn-primary mt-4 w-full">
          {loading ? 'Creating...' : 'Sign up'}
        </button>
        <p className="mt-4 text-center text-sm">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-bee-gold">
            Login
          </Link>
        </p>
      </form>
    </div>
  );
}
