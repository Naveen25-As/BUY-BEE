// End-to-end API tests. Requires a running server connected to a freshly seeded database:
//   npm run seed && npm start   (in another terminal)
//   API_URL=http://localhost:5000/api npm run test:api
// Set RATE_LIMIT_MAX / AUTH_RATE_LIMIT_MAX high on the server while running these tests.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const API = process.env.API_URL || 'http://localhost:5000/api';
const RUN = Date.now().toString(36);

async function call(method, path, { token, body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, body: json };
}

const get = (p, o) => call('GET', p, o);
const post = (p, body, o = {}) => call('POST', p, { ...o, body });
const put = (p, body, o = {}) => call('PUT', p, { ...o, body });
const patch = (p, body, o = {}) => call('PATCH', p, { ...o, body });
const del = (p, o) => call('DELETE', p, o);

const state = {};

async function registerUser(label) {
  const email = `${label}.${RUN}@Example.com`;
  const res = await post('/auth/register', { name: `Test ${label}`, email, password: 'secret123', phone: '9000000000' });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return { token: res.body.token, user: res.body.user, email: email.toLowerCase() };
}

async function addAddress(token, overrides = {}) {
  const res = await post(
    '/users/addresses',
    {
      fullName: 'Test User',
      phone: '9000000000',
      addressLine: '1 Test Street',
      city: 'Pune',
      state: 'MH',
      postalCode: '411001',
      country: 'India',
      addressType: 'home',
      isDefault: true,
      ...overrides,
    },
    { token }
  );
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body.user.addresses.at(-1);
}

test('health and database connectivity', async () => {
  const health = await get('/health');
  assert.equal(health.status, 200);
  const cats = await get('/categories');
  assert.equal(cats.status, 200);
  assert.ok(cats.body.data.length >= 5, 'seeded categories present');
});

test('auth: register, duplicate, validation, login, me, invalid token', async () => {
  const alice = await registerUser('alice');
  assert.ok(alice.token);
  assert.equal(alice.user.email, alice.email, 'email is normalised to lower case');
  assert.equal(alice.user.role, 'customer');
  assert.deepEqual(alice.user.addresses, []);
  assert.equal(alice.user.password, undefined);
  assert.equal(alice.user.password_hash, undefined);
  state.alice = alice;
  state.bob = await registerUser('bob');

  const dup = await post('/auth/register', { name: 'Dup', email: alice.email.toUpperCase(), password: 'secret123' });
  assert.equal(dup.status, 400);
  assert.equal(dup.body.message, 'Email already registered');

  assert.equal((await post('/auth/register', { name: 'X', email: 'not-an-email', password: 'secret123' })).status, 400);
  assert.equal((await post('/auth/register', { name: 'X', email: `short.${RUN}@x.com`, password: '123' })).status, 400);

  const roleEscalation = await post('/auth/register', {
    name: 'Mallory',
    email: `mallory.${RUN}@x.com`,
    password: 'secret123',
    role: 'admin',
  });
  assert.equal(roleEscalation.status, 201);
  assert.equal(roleEscalation.body.user.role, 'customer', 'role from request body is ignored');

  const login = await post('/auth/login', { email: alice.email, password: 'secret123' });
  assert.equal(login.status, 200);
  assert.ok(login.body.token);

  const bad = await post('/auth/login', { email: alice.email, password: 'wrong-password' });
  assert.equal(bad.status, 401);
  const unknown = await post('/auth/login', { email: `nobody.${RUN}@x.com`, password: 'secret123' });
  assert.equal(unknown.status, 401);

  const me = await get('/auth/me', { token: login.body.token });
  assert.equal(me.status, 200);
  assert.equal(me.body.user._id, alice.user._id);

  assert.equal((await get('/auth/me')).status, 401);
  assert.equal((await get('/auth/me', { token: 'garbage.token.value' })).status, 401);

  const admin = await post('/auth/login', { email: 'admin@buybee.com', password: 'Admin@12345' });
  assert.equal(admin.status, 200);
  assert.equal(admin.body.user.role, 'admin');
  state.admin = admin.body.token;
  const customer = await post('/auth/login', { email: 'customer@buybee.com', password: 'Customer@123' });
  assert.equal(customer.status, 200);
  assert.equal(customer.body.user.addresses.length, 1);
});

test('auth: change password and forgot/reset flow', async () => {
  const { token, email } = state.bob;
  assert.equal((await put('/auth/change-password', { currentPassword: 'nope', newPassword: 'newsecret1' }, { token })).status, 400);
  assert.equal((await put('/auth/change-password', { currentPassword: 'secret123', newPassword: 'newsecret1' }, { token })).status, 200);
  assert.equal((await post('/auth/login', { email, password: 'secret123' })).status, 401);
  assert.equal((await post('/auth/login', { email, password: 'newsecret1' })).status, 200);

  const forgot = await post('/auth/forgot-password', { email });
  assert.equal(forgot.status, 200);
  const forgotUnknown = await post('/auth/forgot-password', { email: `ghost.${RUN}@x.com` });
  assert.equal(forgotUnknown.status, 200, 'does not reveal whether the email exists');
  assert.equal((await put('/auth/reset-password/not-a-real-token', { password: 'whatever1' })).status, 400);
});

test('categories: public list, admin CRUD, authorization', async () => {
  const list = await get('/categories');
  assert.ok(list.body.data.every((c) => c._id && c.name && c.slug));

  const payload = { name: `Cameras ${RUN}`, description: 'Test category' };
  assert.equal((await post('/categories', payload)).status, 401);
  assert.equal((await post('/categories', payload, { token: state.alice.token })).status, 403);

  const created = await post('/categories', payload, { token: state.admin });
  assert.equal(created.status, 201);
  assert.equal(created.body.data.slug, `cameras-${RUN}`);
  state.categoryId = created.body.data._id;

  assert.equal((await post('/categories', payload, { token: state.admin })).status, 409);
  assert.equal((await post('/categories', { name: '' }, { token: state.admin })).status, 400);

  const updated = await put(`/categories/${state.categoryId}`, { description: 'Updated' }, { token: state.admin });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.data.description, 'Updated');

  assert.equal((await put('/categories/not-a-uuid', { description: 'x' }, { token: state.admin })).status, 404);
  assert.equal(
    (await put('/categories/00000000-0000-0000-0000-000000000000', { description: 'x' }, { token: state.admin })).status,
    404
  );

  const inUse = await del(`/categories/${list.body.data[0]._id}`, { token: state.admin });
  assert.equal(inUse.status, 400, 'cannot delete a category that still has products');
});

test('products: listing, filters, search, sorting, pagination, details', async () => {
  const all = await get('/products?limit=48');
  assert.equal(all.status, 200);
  assert.equal(all.body.pagination.total, 10);
  const p = all.body.data[0];
  for (const key of ['_id', 'name', 'price', 'images', 'stock', 'sku', 'brand', 'rating', 'category', 'discountPercent']) {
    assert.ok(key in p, `product has ${key}`);
  }
  assert.equal(typeof p.price, 'number');
  assert.ok(p.category._id && p.category.name && p.category.slug, 'category populated');
  assert.ok(typeof p.rating.rating === 'number' && typeof p.rating.numReviews === 'number');
  state.products = all.body.data;

  const page2 = await get('/products?limit=4&page=2');
  assert.equal(page2.body.data.length, 4);
  assert.deepEqual(page2.body.pagination, { page: 2, limit: 4, total: 10, pages: 3 });
  const beyond = await get('/products?limit=4&page=99');
  assert.equal(beyond.status, 200);
  assert.equal(beyond.body.data.length, 0);

  const asc = await get('/products?sort=price_asc&limit=48');
  const prices = asc.body.data.map((x) => x.price);
  assert.deepEqual(prices, [...prices].sort((a, b) => a - b));
  const pop = await get('/products?sort=popularity&limit=48');
  const sales = pop.body.data.map((x) => x.salesCount);
  assert.deepEqual(sales, [...sales].sort((a, b) => b - a));

  const catId = p.category._id;
  const byCat = await get(`/products?category=${catId}&limit=48`);
  assert.ok(byCat.body.data.length > 0 && byCat.body.data.every((x) => x.category._id === catId));
  const badCat = await get('/products?category=507f1f77bcf86cd799439011');
  assert.equal(badCat.status, 200);
  assert.equal(badCat.body.data.length, 0);

  const brand = await get('/products?brand=nova');
  assert.ok(brand.body.data.length >= 1 && brand.body.data.every((x) => x.brand === 'Nova'), 'brand filter is case-insensitive');
  assert.equal((await get('/products?brand=%25')).body.data.length, 0, 'LIKE wildcards are matched literally');

  const range = await get('/products?minPrice=3000&maxPrice=10000&limit=48');
  assert.ok(range.body.data.every((x) => x.price >= 3000 && x.price <= 10000));
  assert.ok((await get('/products?discount=true&limit=48')).body.data.every((x) => x.discountPercent > 0));
  assert.ok((await get('/products?inStock=true&limit=48')).body.data.every((x) => x.stock > 0));
  const featured = await get('/products?featured=true&limit=48');
  assert.equal(featured.body.data.length, 4);
  assert.ok((await get('/products?minRating=4&limit=48')).body.data.every((x) => x.rating.rating >= 4));

  const search = await get(`/products?q=${encodeURIComponent('headphones')}`);
  assert.ok(search.body.data.some((x) => x.name.includes('Headphones')));
  const multi = await get(`/products?q=${encodeURIComponent('laptop speaker')}&limit=48`);
  assert.ok(multi.body.data.length >= 3, 'multi-word search matches any term');
  const hostile = await get(`/products?q=${encodeURIComponent("'); drop table products; -- & | ! :*")}`);
  assert.equal(hostile.status, 200);

  const brands = await get('/products/brands');
  assert.ok(brands.body.data.includes('Nova'));
  assert.deepEqual(brands.body.data, [...brands.body.data].sort());

  const detail = await get(`/products/${p._id}`);
  assert.equal(detail.status, 200);
  assert.equal(detail.body.data._id, p._id);
  assert.equal(typeof detail.body.data.specifications, 'object');

  const related = await get(`/products/${p._id}/related`);
  assert.equal(related.status, 200);
  assert.ok(related.body.data.every((x) => x._id !== p._id));

  assert.equal((await get('/products/not-a-uuid')).status, 404);
  assert.equal((await get('/products/507f1f77bcf86cd799439011')).status, 404);
  assert.equal((await get('/products/00000000-0000-0000-0000-000000000000')).status, 404);
});

test('products: admin create, update, validation, soft delete', async () => {
  const payload = {
    name: `Test Camera ${RUN}`,
    description: 'Mirrorless test camera',
    price: 50000,
    originalPrice: 62500,
    category: state.categoryId,
    brand: 'Snap',
    images: ['https://example.com/a.jpg'],
    stock: 3,
    sku: `cam-${RUN}`,
    isFeatured: false,
    specifications: { Sensor: 'APS-C' },
  };
  assert.equal((await post('/products', payload, { token: state.alice.token })).status, 403);
  const created = await post('/products', payload, { token: state.admin });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  assert.equal(created.body.data.sku, `CAM-${RUN}`.toUpperCase());
  assert.equal(created.body.data.discountPercent, 20, 'discount computed from originalPrice');
  state.cameraId = created.body.data._id;

  assert.equal((await post('/products', payload, { token: state.admin })).status, 409, 'duplicate SKU');
  assert.equal((await post('/products', { ...payload, sku: `x-${RUN}`, price: -1 }, { token: state.admin })).status, 400);
  assert.equal((await post('/products', { ...payload, sku: `y-${RUN}`, category: 'nope' }, { token: state.admin })).status, 400);
  assert.equal(
    (await post('/products', { ...payload, sku: `z-${RUN}`, category: '00000000-0000-0000-0000-000000000000' }, { token: state.admin })).status,
    400
  );
  assert.equal((await post('/products', { name: 'only name' }, { token: state.admin })).status, 400);

  const updated = await put(`/products/${state.cameraId}`, { price: 45000, rating: { rating: 5 } }, { token: state.admin });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.data.price, 45000);
  assert.equal(updated.body.data.rating.rating, 0, 'rating cannot be mass-assigned');

  assert.equal((await put('/products/00000000-0000-0000-0000-000000000000', { price: 1 }, { token: state.admin })).status, 404);

  const temp = await post('/products', { ...payload, sku: `tmp-${RUN}`, name: 'Temp' }, { token: state.admin });
  assert.equal((await del(`/products/${temp.body.data._id}`, { token: state.admin })).status, 200);
  assert.equal((await get(`/products/${temp.body.data._id}`)).status, 404, 'deactivated product hidden');
});

test('addresses: create, default handling, update, delete, ownership', async () => {
  const { token } = state.alice;
  const a1 = await addAddress(token);
  const a2 = await addAddress(token, { addressLine: '2 Second Street', isDefault: true });
  let me = await get('/auth/me', { token });
  assert.equal(me.body.user.addresses.length, 2);
  assert.deepEqual(
    me.body.user.addresses.map((a) => a.isDefault),
    [false, true],
    'only the newest default address stays default'
  );

  const upd = await put(`/users/addresses/${a1._id}`, { city: 'Mumbai', isDefault: true }, { token });
  assert.equal(upd.status, 200);
  const first = upd.body.user.addresses.find((a) => a._id === a1._id);
  assert.equal(first.city, 'Mumbai');
  assert.equal(upd.body.user.addresses.filter((a) => a.isDefault).length, 1);

  assert.equal((await post('/users/addresses', { fullName: 'Missing fields' }, { token })).status, 400);
  assert.equal((await put(`/users/addresses/${a1._id}`, { addressType: 'castle' }, { token })).status, 400);

  // Bob cannot touch Alice's addresses.
  assert.equal((await put(`/users/addresses/${a1._id}`, { city: 'Hacked' }, { token: state.bob.token })).status, 404);
  assert.equal((await del(`/users/addresses/${a1._id}`, { token: state.bob.token })).status, 404);

  assert.equal((await del(`/users/addresses/${a2._id}`, { token })).status, 200);
  me = await get('/auth/me', { token });
  assert.equal(me.body.user.addresses.length, 1);
  state.aliceAddressId = a1._id;

  const profile = await put('/users/profile', { name: 'Alice Updated', phone: '9111111111' }, { token });
  assert.equal(profile.status, 200);
  assert.equal(profile.body.user.name, 'Alice Updated');
  const taken = await put('/users/profile', { email: 'customer@buybee.com' }, { token });
  assert.equal(taken.status, 400);
});

test('cart: add, increment, stock limits, update, remove, clear, ownership', async () => {
  const { token } = state.alice;
  const empty = await get('/cart', { token });
  assert.equal(empty.status, 200);
  assert.deepEqual(empty.body.data.items, []);
  assert.equal((await get('/cart')).status, 401);

  const product = state.products.find((x) => x.stock >= 10);
  let res = await post('/cart/items', { productId: product._id, quantity: 2 }, { token });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  res = await post('/cart/items', { productId: product._id, quantity: 1 }, { token });
  assert.equal(res.body.data.items.length, 1, 'no duplicate cart rows');
  const item = res.body.data.items[0];
  assert.equal(item.quantity, 3);
  assert.equal(item.product._id, product._id, 'product populated');
  assert.equal(item.price, product.price);

  const over = await post('/cart/items', { productId: product._id, quantity: 100000 }, { token });
  assert.equal(over.status, 400);
  assert.match(over.body.message, /Only \d+ items in stock/);

  const outOfStock = state.products.find((x) => x.stock === 0);
  assert.equal((await post('/cart/items', { productId: outOfStock._id }, { token })).status, 400);
  assert.equal((await post('/cart/items', { productId: '00000000-0000-0000-0000-000000000000' }, { token })).status, 404);
  assert.equal((await post('/cart/items', { productId: product._id, quantity: 0 }, { token })).status, 400);
  assert.equal((await post('/cart/items', { productId: product._id, quantity: 'abc' }, { token })).status, 400);

  res = await patch(`/cart/items/${item._id}`, { quantity: 5 }, { token });
  assert.equal(res.body.data.items[0].quantity, 5);
  assert.equal((await patch(`/cart/items/${item._id}`, { quantity: 100000 }, { token })).status, 400);

  // Bob cannot modify Alice's cart item.
  assert.equal((await patch(`/cart/items/${item._id}`, { quantity: 1 }, { token: state.bob.token })).status, 404);
  assert.equal((await del(`/cart/items/${item._id}`, { token: state.bob.token })).status, 404);

  res = await patch(`/cart/items/${item._id}`, { quantity: 0 }, { token });
  assert.equal(res.body.data.items.length, 0, 'quantity 0 removes the item');

  await post('/cart/items', { productId: product._id, quantity: 1 }, { token });
  res = await get('/cart', { token });
  assert.equal((await del(`/cart/items/${res.body.data.items[0]._id}`, { token })).body.data.items.length, 0);

  await post('/cart/items', { productId: product._id, quantity: 1 }, { token });
  res = await del('/cart', { token });
  assert.equal(res.status, 200);
  assert.equal(res.body.data.items.length, 0);
});

test('wishlist: add (idempotent), remove, move to cart', async () => {
  const { token } = state.alice;
  const [p1, p2] = state.products.filter((x) => x.stock > 5);
  let res = await post(`/wishlist/${p1._id}`, undefined, { token });
  assert.equal(res.status, 200);
  res = await post(`/wishlist/${p1._id}`, undefined, { token });
  assert.equal(res.body.data.products.length, 1, 'no duplicate wishlist entries');
  res = await post(`/wishlist/${p2._id}`, undefined, { token });
  assert.deepEqual(res.body.data.products.map((p) => p._id), [p1._id, p2._id]);

  assert.equal((await post('/wishlist/00000000-0000-0000-0000-000000000000', undefined, { token })).status, 404);

  res = await del(`/wishlist/${p2._id}`, { token });
  assert.deepEqual(res.body.data.products.map((p) => p._id), [p1._id]);

  res = await post(`/wishlist/${p1._id}/move-to-cart`, undefined, { token });
  assert.equal(res.status, 200);
  assert.equal((await get('/wishlist', { token })).body.data.products.length, 0);
  const cart = await get('/cart', { token });
  assert.equal(cart.body.data.items.length, 1);
  assert.equal(cart.body.data.items[0].product._id, p1._id);
  await del('/cart', { token });
});

test('coupons: validate and admin CRUD', async () => {
  const { token } = state.alice;
  const ok = await post('/coupons/validate', { code: 'welcome10', subtotal: 5000 }, { token });
  assert.equal(ok.status, 200);
  assert.deepEqual(ok.body.data, { code: 'WELCOME10', discount: 500, description: '10% off for new customers' });
  const capped = await post('/coupons/validate', { code: 'WELCOME10', subtotal: 50000 }, { token });
  assert.equal(capped.body.data.discount, 1500, 'max discount applied');
  const min = await post('/coupons/validate', { code: 'WELCOME10', subtotal: 100 }, { token });
  assert.equal(min.status, 400);
  assert.equal(min.body.message, 'Minimum order amount is ₹999');
  assert.equal((await post('/coupons/validate', { code: 'NOPE', subtotal: 5000 }, { token })).status, 400);

  assert.equal((await get('/coupons', { token })).status, 403);
  const expired = await post(
    '/coupons',
    { code: `old${RUN}`, discountType: 'fixed', discountValue: 100, minOrderAmount: 0, expiresAt: '2020-01-01' },
    { token: state.admin }
  );
  assert.equal(expired.status, 201, JSON.stringify(expired.body));
  assert.equal(expired.body.data.code, `OLD${RUN}`.toUpperCase());
  const expiredCheck = await post('/coupons/validate', { code: `old${RUN}`, subtotal: 5000 }, { token });
  assert.equal(expiredCheck.body.message, 'Coupon expired');

  const toggled = await put(`/coupons/${expired.body.data._id}`, { isActive: false }, { token: state.admin });
  assert.equal(toggled.status, 200);
  assert.equal(toggled.body.data.isActive, false);
  assert.equal(
    (await post('/coupons', { code: `bad${RUN}`, discountType: 'percent', discountValue: 150, expiresAt: '2030-01-01' }, { token: state.admin })).status,
    400
  );
  assert.equal((await del(`/coupons/${expired.body.data._id}`, { token: state.admin })).status, 200);
  const list = await get('/coupons', { token: state.admin });
  assert.ok(list.body.data.some((c) => c.code === 'WELCOME10'));
});

test('orders: placement is transactional and enforces stock', async () => {
  const { token } = state.alice;
  const product = (await get(`/products/${state.products.find((x) => x.stock >= 10)._id}`)).body.data;
  const coupons = await get('/coupons', { token: state.admin });
  const usedBefore = coupons.body.data.find((c) => c.code === 'WELCOME10').usedCount;

  assert.equal((await post('/orders', { addressId: state.aliceAddressId, paymentMethod: 'cod' }, { token })).status, 400, 'empty cart');

  await post('/cart/items', { productId: product._id, quantity: 2 }, { token });
  assert.equal((await post('/orders', { addressId: state.aliceAddressId, paymentMethod: 'bitcoin' }, { token })).status, 400);
  const foreignAddress = await post('/orders', { addressId: '00000000-0000-0000-0000-000000000000', paymentMethod: 'cod' }, { token });
  assert.equal(foreignAddress.status, 400);
  assert.equal((await post('/orders', { addressId: state.aliceAddressId, paymentMethod: 'cod', couponCode: 'NOPE' }, { token })).status, 400);

  const placed = await post('/orders', { addressId: state.aliceAddressId, paymentMethod: 'cod', couponCode: 'welcome10' }, { token });
  assert.equal(placed.status, 201, JSON.stringify(placed.body));
  const order = placed.body.data;
  const round2 = (n) => Math.round(n * 100) / 100;
  const subtotal = round2(product.price * 2);
  const discount = round2(Math.min(subtotal * 0.1, 1500));
  const tax = round2((subtotal - discount) * 0.18);
  assert.equal(order.subtotal, subtotal);
  assert.equal(order.discount, discount);
  assert.equal(order.shipping, 0);
  assert.equal(order.tax, tax);
  assert.equal(order.total, round2(subtotal - discount + tax));
  assert.equal(order.couponCode, 'WELCOME10');
  assert.equal(order.orderStatus, 'pending');
  assert.match(order.orderNumber, /^BB-/);
  assert.equal(order.items.length, 1);
  assert.equal(order.items[0].product, product._id);
  assert.equal(order.items[0].quantity, 2);
  assert.equal(order.shippingAddress.city, 'Mumbai');
  assert.equal(order.statusHistory[0].status, 'pending');
  state.orderId = order._id;
  state.orderProduct = product;

  const after = (await get(`/products/${product._id}`)).body.data;
  assert.equal(after.stock, product.stock - 2, 'stock decremented');
  assert.equal(after.salesCount, product.salesCount + 2, 'sales count incremented');
  assert.equal((await get('/cart', { token })).body.data.items.length, 0, 'cart emptied');
  const usedAfter = (await get('/coupons', { token: state.admin })).body.data.find((c) => c.code === 'WELCOME10').usedCount;
  assert.equal(usedAfter, usedBefore + 1, 'coupon usage incremented');

  // Insufficient stock at checkout must roll back everything.
  const scarce = state.products.find((x) => x.stock > 2 && x._id !== product._id);
  await post('/cart/items', { productId: scarce._id, quantity: 2 }, { token });
  await post('/cart/items', { productId: product._id, quantity: 1 }, { token });
  assert.equal((await patch(`/admin/inventory/${scarce._id}`, { stock: 1 }, { token: state.admin })).status, 200);
  const productBefore = (await get(`/products/${product._id}`)).body.data.stock;
  const fail = await post('/orders', { addressId: state.aliceAddressId, paymentMethod: 'cod' }, { token });
  assert.equal(fail.status, 400);
  assert.match(fail.body.message, /Insufficient stock/);
  assert.equal((await get(`/products/${product._id}`)).body.data.stock, productBefore, 'no partial stock update');
  assert.equal((await get('/cart', { token })).body.data.items.length, 2, 'cart preserved after failed order');
  assert.equal((await get('/orders/my', { token })).body.data.length, 1, 'no partial order created');
  await patch(`/admin/inventory/${scarce._id}`, { stock: scarce.stock }, { token: state.admin });
  await del('/cart', { token });
});

test('orders: history, access control, cancellation restores stock', async () => {
  const { token } = state.alice;
  const mine = await get('/orders/my', { token });
  assert.equal(mine.body.data.length, 1);
  assert.equal(mine.body.data[0]._id, state.orderId);
  assert.equal((await get('/orders/my', { token: state.bob.token })).body.data.length, 0);

  assert.equal((await get(`/orders/${state.orderId}`, { token })).status, 200);
  assert.equal((await get(`/orders/${state.orderId}`, { token: state.bob.token })).status, 403);
  assert.equal((await get(`/orders/${state.orderId}`, { token: state.admin })).status, 200);
  assert.equal((await get('/orders/00000000-0000-0000-0000-000000000000', { token })).status, 404);
  assert.equal((await get('/orders', { token })).status, 403, 'customers cannot list all orders');
  assert.equal((await post(`/orders/${state.orderId}/cancel`, {}, { token: state.bob.token })).status, 403);

  // Place and cancel a second order.
  const product = state.products.find((x) => x.stock >= 10 && x._id !== state.orderProduct._id);
  const before = (await get(`/products/${product._id}`)).body.data;
  await post('/cart/items', { productId: product._id, quantity: 3 }, { token });
  const placed = await post('/orders', { addressId: state.aliceAddressId, paymentMethod: 'online' }, { token });
  assert.equal(placed.status, 201);
  assert.equal(placed.body.data.shipping, before.price * 3 >= 999 ? 0 : 49);
  const cancelled = await post(`/orders/${placed.body.data._id}/cancel`, { reason: 'Changed my mind' }, { token });
  assert.equal(cancelled.status, 200);
  assert.equal(cancelled.body.data.orderStatus, 'cancelled');
  assert.equal(cancelled.body.data.cancelReason, 'Changed my mind');
  assert.deepEqual(cancelled.body.data.statusHistory.map((h) => h.status), ['pending', 'cancelled']);
  const restored = (await get(`/products/${product._id}`)).body.data;
  assert.equal(restored.stock, before.stock, 'stock restored');
  assert.equal(restored.salesCount, before.salesCount, 'sales count restored');
  assert.equal((await post(`/orders/${placed.body.data._id}/cancel`, {}, { token })).status, 400, 'cannot cancel twice');
});

test('orders: admin status workflow, reviews and rating aggregation', async () => {
  const { token } = state.alice;
  const id = state.orderId;
  assert.equal((await patch(`/orders/${id}/status`, { status: 'confirmed' }, { token })).status, 403);
  assert.equal((await patch(`/orders/${id}/status`, { status: 'shipped' }, { token: state.admin })).status, 400, 'cannot skip steps');
  assert.equal((await patch(`/orders/${id}/status`, { status: 'teleported' }, { token: state.admin })).status, 400);

  const review = { productId: state.orderProduct._id, orderId: id, rating: 4, comment: 'Great product' };
  assert.equal((await post('/reviews', review, { token })).status, 400, 'cannot review before delivery');

  for (const status of ['confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered']) {
    const res = await patch(`/orders/${id}/status`, { status }, { token: state.admin });
    assert.equal(res.status, 200, `${status}: ${JSON.stringify(res.body)}`);
  }
  const delivered = (await get(`/orders/${id}`, { token })).body.data;
  assert.equal(delivered.orderStatus, 'delivered');
  assert.equal(delivered.paymentStatus, 'paid');
  assert.equal(delivered.isPaid, true);
  assert.ok(delivered.deliveredAt && delivered.paidAt);
  assert.equal(delivered.statusHistory.length, 6);
  assert.equal((await post(`/orders/${id}/cancel`, {}, { token })).status, 400, 'delivered orders cannot be cancelled');

  const adminList = await get('/orders?status=delivered', { token: state.admin });
  assert.ok(adminList.body.data.some((o) => o._id === id && o.user.name && o.user.email));
  const byNumber = await get(`/orders?q=${encodeURIComponent(delivered.orderNumber.slice(0, 6))}`, { token: state.admin });
  assert.ok(byNumber.body.data.some((o) => o._id === id));

  assert.equal((await post('/reviews', review, { token: state.bob.token })).status, 404, "cannot review someone else's order");
  assert.equal((await post('/reviews', { ...review, rating: 9 }, { token })).status, 400);
  assert.equal((await post('/reviews', { ...review, productId: state.cameraId }, { token })).status, 400, 'product not in order');

  const created = await post('/reviews', review, { token });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  assert.equal((await post('/reviews', review, { token })).status, 400, 'one review per product');

  let product = (await get(`/products/${state.orderProduct._id}`)).body.data;
  assert.deepEqual(product.rating, { rating: 4, numReviews: 1 }, 'rating recalculated from reviews');

  const publicReviews = await get(`/reviews/product/${state.orderProduct._id}`);
  assert.equal(publicReviews.body.data[0].user.name, 'Alice Updated');
  assert.equal(publicReviews.body.data[0].user.email, undefined, 'email not exposed publicly');

  const all = await get('/reviews', { token: state.admin });
  assert.ok(all.body.data.some((r) => r._id === created.body.data._id && r.product.name && r.user.email));
  assert.equal((await get('/reviews', { token })).status, 403);

  const hidden = await patch(`/reviews/${created.body.data._id}/moderate`, { isApproved: false }, { token: state.admin });
  assert.equal(hidden.status, 200);
  product = (await get(`/products/${state.orderProduct._id}`)).body.data;
  assert.deepEqual(product.rating, { rating: 0, numReviews: 0 }, 'hidden reviews excluded from rating');
  assert.equal((await get(`/reviews/product/${state.orderProduct._id}`)).body.data.length, 0);

  await patch(`/reviews/${created.body.data._id}/moderate`, { isApproved: true }, { token: state.admin });
  assert.equal((await del(`/reviews/${created.body.data._id}`, { token: state.admin })).status, 200);
  product = (await get(`/products/${state.orderProduct._id}`)).body.data;
  assert.equal(product.rating.numReviews, 0);
});

test('admin: dashboard, inventory, users', async () => {
  const dash = await get('/admin/dashboard', { token: state.admin });
  assert.equal(dash.status, 200);
  const { stats, charts, lowStockProducts } = dash.body.data;
  assert.ok(stats.totalOrders >= 2);
  assert.ok(stats.totalRevenue > 0);
  assert.ok(stats.totalCustomers >= 3);
  assert.equal(typeof stats.pendingOrders, 'number');
  assert.equal(stats.lowStockCount, lowStockProducts.length);
  assert.ok(charts.ordersOverTime.length >= 1 && /^\d{4}-\d{2}-\d{2}$/.test(charts.ordersOverTime[0]._id));
  assert.ok(charts.categoryPerformance.length >= 1 && typeof charts.categoryPerformance[0]._id === 'string');
  assert.ok(charts.topProducts.length > 0);
  assert.equal((await get('/admin/dashboard', { token: state.alice.token })).status, 403);
  assert.equal((await get('/admin/dashboard')).status, 401);

  const inv = await get('/admin/inventory', { token: state.admin });
  assert.ok(inv.body.data.length > 0 && inv.body.data[0].category.name);
  const out = await get('/admin/inventory?outOfStock=true', { token: state.admin });
  assert.ok(out.body.data.every((p) => p.stock === 0));
  const low = await get('/admin/inventory?lowStock=true', { token: state.admin });
  assert.ok(low.body.data.every((p) => p.stock <= 5));
  assert.equal((await patch(`/admin/inventory/${state.cameraId}`, { stock: -5 }, { token: state.admin })).status, 400);
  assert.equal((await patch('/admin/inventory/00000000-0000-0000-0000-000000000000', { stock: 5 }, { token: state.admin })).status, 404);

  const users = await get(`/users?q=${encodeURIComponent('alice.' + RUN)}`, { token: state.admin });
  assert.equal(users.status, 200);
  assert.equal(users.body.data.length, 1);
  assert.equal(users.body.data[0].password_hash, undefined);
  const tricky = await get(`/users?q=${encodeURIComponent('a,b)"\\%_*')}`, { token: state.admin });
  assert.equal(tricky.status, 200, 'filter syntax characters are safely quoted');
  assert.equal(tricky.body.data.length, 0);
  assert.equal((await get('/users', { token: state.alice.token })).status, 403);

  const bobId = state.bob.user._id;
  const deactivated = await patch(`/users/${bobId}/status`, { isActive: false }, { token: state.admin });
  assert.equal(deactivated.status, 200);
  assert.equal(deactivated.body.data.isActive, false);
  assert.equal((await post('/auth/login', { email: state.bob.email, password: 'newsecret1' })).status, 403);
  assert.equal((await get('/auth/me', { token: state.bob.token })).status, 403, 'existing tokens rejected for deactivated users');
  assert.equal((await patch(`/users/${bobId}/status`, { role: 'superuser' }, { token: state.admin })).status, 400);
  assert.equal((await patch(`/users/${bobId}/status`, { isActive: true }, { token: state.admin })).status, 200);
  assert.equal((await patch(`/users/${bobId}/status`, { role: 'admin' }, { token: state.bob.token })).status, 403, 'customers cannot promote themselves');
});

test('invalid requests', async () => {
  const res = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{bad json' });
  assert.equal(res.status, 400);
  assert.equal((await get('/does-not-exist')).status, 404);
});
