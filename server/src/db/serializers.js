// Map PostgreSQL rows (snake_case, uuid `id`) to the JSON shape the React client already uses
// (Mongo-style `_id`, camelCase fields, populated relations).

const num = (v) => (v === null || v === undefined ? v : Number(v));

const byCreated = (a, b) =>
  String(a.created_at).localeCompare(String(b.created_at)) || String(a.id).localeCompare(String(b.id));

function idOrObject(value, serializer) {
  if (value && typeof value === 'object') return serializer(value);
  return value ?? null;
}

export function serializeAddress(row) {
  return {
    _id: row.id,
    fullName: row.full_name,
    phone: row.phone,
    addressLine: row.address_line,
    city: row.city,
    state: row.state,
    postalCode: row.postal_code,
    country: row.country,
    addressType: row.address_type,
    isDefault: row.is_default,
  };
}

export function serializeUser(row) {
  if (!row) return null;
  const user = {
    _id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone ?? undefined,
    role: row.role,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  if (Array.isArray(row.addresses)) {
    user.addresses = [...row.addresses].sort(byCreated).map(serializeAddress);
  }
  return user;
}

export function serializeUserRef(row) {
  const ref = { _id: row.id };
  if (row.name !== undefined) ref.name = row.name;
  if (row.email !== undefined) ref.email = row.email;
  return ref;
}

export function serializeCategory(row) {
  if (!row) return null;
  const out = { _id: row.id };
  const map = {
    name: 'name',
    slug: 'slug',
    description: 'description',
    image: 'image',
    is_active: 'isActive',
    created_at: 'createdAt',
    updated_at: 'updatedAt',
  };
  for (const [col, key] of Object.entries(map)) {
    if (row[col] !== undefined) out[key] = row[col];
  }
  return out;
}

export function serializeProduct(row) {
  if (!row) return null;
  const out = { _id: row.id };
  const simple = {
    name: 'name',
    description: 'description',
    brand: 'brand',
    images: 'images',
    stock: 'stock',
    sku: 'sku',
    specifications: 'specifications',
    tags: 'tags',
    is_featured: 'isFeatured',
    is_active: 'isActive',
    sales_count: 'salesCount',
    discount_percent: 'discountPercent',
    created_at: 'createdAt',
    updated_at: 'updatedAt',
  };
  for (const [col, key] of Object.entries(simple)) {
    if (row[col] !== undefined) out[key] = row[col];
  }
  if (row.price !== undefined) out.price = num(row.price);
  if (row.original_price !== undefined && row.original_price !== null) out.originalPrice = num(row.original_price);
  if (row.rating !== undefined || row.num_reviews !== undefined) {
    out.rating = { rating: num(row.rating) || 0, numReviews: row.num_reviews || 0 };
  }
  if (row.category !== undefined) out.category = idOrObject(row.category, serializeCategory);
  else if (row.category_id !== undefined) out.category = row.category_id;
  return out;
}

export function serializeCart(row) {
  return {
    _id: row.id,
    user: row.user_id,
    items: [...(row.cart_items || [])].sort(byCreated).map((item) => ({
      _id: item.id,
      product: idOrObject(item.product ?? item.product_id, serializeProduct),
      quantity: item.quantity,
      price: num(item.price),
    })),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function serializeWishlist(row) {
  return {
    _id: row.id,
    user: row.user_id,
    products: [...(row.wishlist_items || [])]
      .sort(byCreated)
      .filter((item) => item.product)
      .map((item) => serializeProduct(item.product)),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function serializeOrder(row) {
  if (!row) return null;
  const out = {
    _id: row.id,
    user: row.user && typeof row.user === 'object' ? serializeUserRef(row.user) : row.user_id,
    orderNumber: row.order_number,
    shippingAddress: row.shipping_address,
    paymentMethod: row.payment_method,
    paymentStatus: row.payment_status,
    orderStatus: row.order_status,
    subtotal: num(row.subtotal),
    discount: num(row.discount),
    shipping: num(row.shipping),
    tax: num(row.tax),
    total: num(row.total),
    coupon: row.coupon_id ?? undefined,
    couponCode: row.coupon_code ?? undefined,
    isPaid: row.is_paid,
    paidAt: row.paid_at ?? undefined,
    deliveredAt: row.delivered_at ?? undefined,
    cancelledAt: row.cancelled_at ?? undefined,
    cancelReason: row.cancel_reason ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  if (row.order_items) {
    out.items = [...row.order_items]
      .sort((a, b) => a.position - b.position)
      .map((item) => ({
        product: item.product_id,
        name: item.name,
        image: item.image,
        quantity: item.quantity,
        price: num(item.price),
      }));
  }
  if (row.order_status_history) {
    out.statusHistory = [...row.order_status_history]
      .sort((a, b) => String(a.at).localeCompare(String(b.at)))
      .map((h) => ({ status: h.status, note: h.note ?? undefined, at: h.at }));
  }
  return out;
}

export function serializeReview(row) {
  return {
    _id: row.id,
    user: row.user && typeof row.user === 'object' ? serializeUserRef(row.user) : row.user_id,
    product:
      row.product && typeof row.product === 'object'
        ? { _id: row.product.id, name: row.product.name }
        : row.product_id,
    order: row.order_id,
    rating: row.rating,
    comment: row.comment,
    isApproved: row.is_approved,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function serializeCoupon(row) {
  if (!row) return null;
  return {
    _id: row.id,
    code: row.code,
    description: row.description ?? undefined,
    discountType: row.discount_type,
    discountValue: num(row.discount_value),
    minOrderAmount: num(row.min_order_amount),
    maxDiscount: row.max_discount === null ? undefined : num(row.max_discount),
    expiresAt: row.expires_at,
    usageLimit: row.usage_limit ?? undefined,
    usedCount: row.used_count,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
