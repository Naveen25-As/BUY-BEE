const LABELS = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  processing: 'Processing',
  shipped: 'Shipped',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

export default function OrderTimeline({ history = [], currentStatus }) {
  const items = history.length
    ? history
    : [{ status: currentStatus, at: new Date(), note: 'Current status' }];

  return (
    <ol className="space-y-4 border-l-2 border-amber-200 pl-4">
      {items.map((item, idx) => (
        <li key={`${item.status}-${idx}`} className="relative">
          <span className="absolute -left-[1.35rem] top-1 h-3 w-3 rounded-full bg-bee-gold" />
          <p className="font-medium">{LABELS[item.status] || item.status}</p>
          <p className="text-xs text-slate-500">{new Date(item.at).toLocaleString()}</p>
          {item.note && <p className="text-sm text-slate-600">{item.note}</p>}
        </li>
      ))}
    </ol>
  );
}
