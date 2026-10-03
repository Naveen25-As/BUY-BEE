import { useState } from 'react';
import toast from 'react-hot-toast';
import api from '../api/client';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/auth/forgot-password', { email });
      setSent(true);
      toast.success('If the email exists, reset instructions were sent.');
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <form onSubmit={onSubmit} className="card p-6">
        <h1 className="text-2xl font-bold">Forgot password</h1>
        <p className="mt-2 text-sm text-slate-600">We will email you a secure reset link.</p>
        <label className="mt-4 block text-sm font-medium">
          Email
          <input type="email" required className="input-field mt-1" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <button type="submit" className="btn-primary mt-4 w-full">
          Send reset link
        </button>
        {sent && <p className="mt-3 text-sm text-emerald-700">Check your inbox (or server logs in development).</p>}
      </form>
    </div>
  );
}
