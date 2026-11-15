// Order totals, coupon rules and status transitions are enforced in Postgres
// (see supabase/migrations/0002_functions.sql) so they run inside the same transaction as the writes.
export function generateOrderNumber() {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `BB-${ts}-${rand}`;
}

export const ORDER_STATUSES = [
  'pending',
  'confirmed',
  'processing',
  'shipped',
  'out_for_delivery',
  'delivered',
  'cancelled',
];
