export function generateOrderNumber() {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `BB-${ts}-${rand}`;
}

export const ORDER_FLOW = [
  'pending',
  'confirmed',
  'processing',
  'shipped',
  'out_for_delivery',
  'delivered',
];

export function canTransition(from, to) {
  if (to === 'cancelled') {
    return ['pending', 'confirmed', 'processing'].includes(from);
  }
  const fromIdx = ORDER_FLOW.indexOf(from);
  const toIdx = ORDER_FLOW.indexOf(to);
  return toIdx === fromIdx + 1;
}

export function calcTotals(subtotal, discount = 0) {
  const shipping = subtotal >= 999 ? 0 : subtotal > 0 ? 49 : 0;
  const taxable = Math.max(subtotal - discount, 0);
  const tax = Math.round(taxable * 0.18 * 100) / 100;
  const total = Math.round((taxable + shipping + tax) * 100) / 100;
  return { shipping, tax, total };
}
