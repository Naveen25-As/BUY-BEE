import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../api/client';

export default function AdminReviews() {
  const [reviews, setReviews] = useState([]);

  const load = () => api.get('/reviews').then((res) => setReviews(res.data.data));
  useEffect(() => {
    load();
  }, []);

  const moderate = async (id, isApproved) => {
    await api.patch(`/reviews/${id}/moderate`, { isApproved });
    toast.success('Review updated');
    load();
  };

  const remove = async (id) => {
    await api.delete(`/reviews/${id}`);
    load();
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Reviews</h1>
      <ul className="space-y-3">
        {reviews.map((r) => (
          <li key={r._id} className="card p-4 text-sm">
            <p className="font-medium">
              {r.product?.name} — {r.user?.name}
            </p>
            <p className="text-amber-600">★ {r.rating}</p>
            <p className="mt-1">{r.comment}</p>
            <div className="mt-2 flex gap-2">
              <button type="button" className="btn-secondary !px-2 !py-1 text-xs" onClick={() => moderate(r._id, !r.isApproved)}>
                {r.isApproved ? 'Hide' : 'Approve'}
              </button>
              <button type="button" className="text-xs text-red-600" onClick={() => remove(r._id)}>
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
