// One-time data migration: MongoDB (BUY BEE Mongoose collections) -> Supabase PostgreSQL.
//
//   node scripts/migrate-mongo-to-supabase.js            # dry run: backup + validation report, writes nothing
//   node scripts/migrate-mongo-to-supabase.js --execute  # backup + write to Supabase + verify counts
//
// Safety:
//   * MongoDB is only read. Nothing is deleted or modified there.
//   * A full JSON (Extended JSON) backup of every collection is written to ./backups before anything else.
//   * Row ids are derived deterministically from the Mongo ObjectIds and inserted with ON CONFLICT DO NOTHING,
//     so the script can be re-run safely and never overwrites existing Supabase rows.
//   * The run aborts if Supabase already contains data that did not come from this migration
//     (pass --allow-existing to override).
import 'dotenv/config';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { MongoClient, BSON } from 'mongodb';

const EXECUTE = process.argv.includes('--execute');
const ALLOW_EXISTING = process.argv.includes('--allow-existing');
const BATCH_SIZE = 500;
const NAMESPACE = 'buybee-mongo-migration';
const ORDER_STATUSES = ['pending', 'confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered', 'cancelled'];

const here = path.dirname(fileURLToPath(import.meta.url));
const warnings = [];
const warn = (msg) => warnings.push(msg);

// ---------------------------------------------------------------------------
// Conversion helpers
// ---------------------------------------------------------------------------
const hex = (v) => (v == null ? null : typeof v === 'string' ? v : v.toHexString ? v.toHexString() : String(v));

// Deterministic UUID (v5 layout) so re-runs map every ObjectId to the same row id.
function uuidFor(key) {
  const h = crypto.createHash('sha1').update(`${NAMESPACE}:${key}`).digest();
  h[6] = (h[6] & 0x0f) | 0x50;
  h[8] = (h[8] & 0x3f) | 0x80;
  const s = h.subarray(0, 16).toString('hex');
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20, 32)}`;
}
const idOf = (oid) => uuidFor(hex(oid));

const iso = (v, fallback = null) => {
  if (v == null) return fallback;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? fallback : d.toISOString();
};
const toNum = (v, fallback = 0) => {
  if (v == null || v === '') return fallback;
  const n = Number(typeof v === 'object' && v.toString ? v.toString() : v);
  return Number.isFinite(n) ? n : fallback;
};
const money = (v, fallback = 0) => Math.max(Math.round(toNum(v, fallback) * 100) / 100, 0);
const int = (v, fallback = 0) => Math.trunc(toNum(v, fallback));
const str = (v) => (v == null ? null : String(v).trim() || null);
const bool = (v, fallback) => (typeof v === 'boolean' ? v : fallback);
const stamps = (doc) => {
  const created = iso(doc.createdAt, new Date().toISOString());
  return { created_at: created, updated_at: iso(doc.updatedAt, created) };
};
const slugify = (s) => String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

// ---------------------------------------------------------------------------
// Transform Mongo documents into relational rows
// ---------------------------------------------------------------------------
function transform(src) {
  const out = {
    categories: [], profiles: [], addresses: [], coupons: [], products: [],
    carts: [], cart_items: [], wishlists: [], wishlist_items: [],
    orders: [], order_items: [], order_status_history: [], reviews: [],
  };
  const known = { categories: new Set(), profiles: new Set(), products: new Set(), coupons: new Set(), orders: new Set() };

  const seenSlugs = new Set();
  const seenCategoryNames = new Set();
  for (const c of src.categories) {
    const name = str(c.name);
    if (!name) { warn(`category ${hex(c._id)}: missing name, skipped`); continue; }
    const slug = slugify(c.slug || name) || hex(c._id);
    if (seenSlugs.has(slug) || seenCategoryNames.has(name.toLowerCase())) {
      warn(`category ${hex(c._id)}: duplicate name/slug "${name}", skipped`);
      continue;
    }
    seenSlugs.add(slug);
    seenCategoryNames.add(name.toLowerCase());
    known.categories.add(hex(c._id));
    out.categories.push({
      id: idOf(c._id), legacy_mongo_id: hex(c._id), name, slug,
      description: str(c.description), image: str(c.image), is_active: bool(c.isActive, true), ...stamps(c),
    });
  }

  const seenEmails = new Map();
  for (const u of src.users) {
    const email = str(u.email)?.toLowerCase();
    if (!email || !email.includes('@')) { warn(`user ${hex(u._id)}: invalid email, skipped`); continue; }
    if (seenEmails.has(email)) {
      warn(`user ${hex(u._id)}: duplicate email ${email} (kept ${seenEmails.get(email)}), skipped`);
      continue;
    }
    if (!str(u.password)) { warn(`user ${hex(u._id)} (${email}): no password hash, skipped`); continue; }
    seenEmails.set(email, hex(u._id));
    known.profiles.add(hex(u._id));
    out.profiles.push({
      id: idOf(u._id), legacy_mongo_id: hex(u._id),
      name: (str(u.name) || email.split('@')[0]).slice(0, 80),
      email, phone: str(u.phone),
      password_hash: u.password, // bcrypt hashes are compatible with bcryptjs, users keep their passwords
      role: ['customer', 'admin'].includes(u.role) ? u.role : 'customer',
      is_active: bool(u.isActive, true),
      reset_password_token: str(u.resetPasswordToken),
      reset_password_expire: iso(u.resetPasswordExpire),
      ...stamps(u),
    });
    let hasDefault = false;
    (u.addresses || []).forEach((a, idx) => {
      const required = ['fullName', 'phone', 'addressLine', 'city', 'state', 'postalCode'];
      const missing = required.filter((k) => !str(a[k]));
      if (missing.length) { warn(`user ${email} address #${idx}: missing ${missing.join(', ')}, skipped`); return; }
      const isDefault = Boolean(a.isDefault) && !hasDefault;
      hasDefault = hasDefault || isDefault;
      const created = new Date(new Date(iso(u.createdAt, new Date().toISOString())).getTime() + idx).toISOString();
      out.addresses.push({
        id: a._id ? idOf(a._id) : uuidFor(`${hex(u._id)}:address:${idx}`),
        legacy_mongo_id: a._id ? hex(a._id) : null,
        user_id: idOf(u._id),
        full_name: str(a.fullName), phone: str(a.phone), address_line: str(a.addressLine), city: str(a.city),
        state: str(a.state), postal_code: str(a.postalCode), country: str(a.country) || 'India',
        address_type: ['home', 'work', 'other'].includes(a.addressType) ? a.addressType : 'home',
        is_default: isDefault, created_at: created, updated_at: created,
      });
    });
  }

  const seenCodes = new Set();
  for (const c of src.coupons) {
    const code = str(c.code)?.toUpperCase();
    if (!code || seenCodes.has(code)) { warn(`coupon ${hex(c._id)}: missing/duplicate code, skipped`); continue; }
    if (!['percent', 'fixed'].includes(c.discountType)) { warn(`coupon ${code}: invalid discountType, skipped`); continue; }
    const expires = iso(c.expiresAt);
    if (!expires) { warn(`coupon ${code}: missing expiresAt, skipped`); continue; }
    let value = money(c.discountValue);
    if (c.discountType === 'percent' && value > 100) { warn(`coupon ${code}: percent > 100 clamped to 100`); value = 100; }
    seenCodes.add(code);
    known.coupons.add(hex(c._id));
    out.coupons.push({
      id: idOf(c._id), legacy_mongo_id: hex(c._id), code, description: str(c.description),
      discount_type: c.discountType, discount_value: value, min_order_amount: money(c.minOrderAmount),
      max_discount: c.maxDiscount == null ? null : money(c.maxDiscount), expires_at: expires,
      usage_limit: int(c.usageLimit, 0) >= 1 ? int(c.usageLimit) : null, used_count: Math.max(int(c.usedCount), 0),
      is_active: bool(c.isActive, true), ...stamps(c),
    });
  }

  const seenSkus = new Set();
  for (const p of src.products) {
    const pid = hex(p._id);
    if (!known.categories.has(hex(p.category))) { warn(`product ${pid} (${p.name}): category missing, skipped`); continue; }
    let sku = str(p.sku)?.toUpperCase();
    if (!sku) { sku = `LEGACY-${pid}`.toUpperCase(); warn(`product ${pid}: missing SKU, using ${sku}`); }
    if (seenSkus.has(sku)) { warn(`product ${pid}: duplicate SKU ${sku}, skipped`); continue; }
    const name = str(p.name);
    if (!name) { warn(`product ${pid}: missing name, skipped`); continue; }
    seenSkus.add(sku);
    known.products.add(pid);
    const specs = p.specifications instanceof Map ? Object.fromEntries(p.specifications) : p.specifications || {};
    out.products.push({
      id: idOf(p._id), legacy_mongo_id: pid, name,
      description: str(p.description) || name,
      price: money(p.price), original_price: p.originalPrice == null ? null : money(p.originalPrice),
      discount_percent: Math.min(Math.max(int(p.discountPercent), 0), 100),
      category_id: idOf(p.category), brand: str(p.brand) || 'Unknown',
      images: (p.images || []).map(str).filter(Boolean), stock: Math.max(int(p.stock), 0), sku,
      specifications: Object.fromEntries(Object.entries(specs).map(([k, v]) => [k, v == null ? '' : String(v)])),
      tags: (p.tags || []).map(str).filter(Boolean),
      rating: Math.min(Math.max(Math.round(toNum(p.rating?.rating) * 10) / 10, 0), 5),
      num_reviews: Math.max(int(p.rating?.numReviews), 0),
      is_featured: bool(p.isFeatured, false), is_active: bool(p.isActive, true),
      sales_count: Math.max(int(p.salesCount), 0), ...stamps(p),
    });
  }

  const seenCartUsers = new Set();
  for (const cart of src.carts) {
    const uid = hex(cart.user);
    if (!known.profiles.has(uid)) { warn(`cart ${hex(cart._id)}: user ${uid} missing, skipped`); continue; }
    if (seenCartUsers.has(uid)) { warn(`cart ${hex(cart._id)}: second cart for user ${uid}, skipped`); continue; }
    seenCartUsers.add(uid);
    out.carts.push({ id: idOf(cart._id), legacy_mongo_id: hex(cart._id), user_id: idOf(cart.user), ...stamps(cart) });
    const merged = new Map();
    (cart.items || []).forEach((item, idx) => {
      const pid = hex(item.product);
      if (!known.products.has(pid)) { warn(`cart ${hex(cart._id)} item #${idx}: product ${pid} missing, skipped`); return; }
      const qty = Math.max(int(item.quantity, 1), 1);
      if (merged.has(pid)) { merged.get(pid).quantity += qty; warn(`cart ${hex(cart._id)}: duplicate product ${pid} merged`); return; }
      const created = new Date(new Date(iso(cart.createdAt, new Date().toISOString())).getTime() + idx).toISOString();
      merged.set(pid, {
        id: item._id ? idOf(item._id) : uuidFor(`${hex(cart._id)}:item:${idx}`),
        legacy_mongo_id: item._id ? hex(item._id) : null,
        cart_id: idOf(cart._id), product_id: idOf(item.product), quantity: qty, price: money(item.price),
        created_at: created, updated_at: created,
      });
    });
    out.cart_items.push(...merged.values());
  }

  const seenWishlistUsers = new Set();
  for (const list of src.wishlists) {
    const uid = hex(list.user);
    if (!known.profiles.has(uid)) { warn(`wishlist ${hex(list._id)}: user ${uid} missing, skipped`); continue; }
    if (seenWishlistUsers.has(uid)) { warn(`wishlist ${hex(list._id)}: second wishlist for user ${uid}, skipped`); continue; }
    seenWishlistUsers.add(uid);
    out.wishlists.push({ id: idOf(list._id), legacy_mongo_id: hex(list._id), user_id: idOf(list.user), ...stamps(list) });
    const seen = new Set();
    (list.products || []).forEach((p, idx) => {
      const pid = hex(p);
      if (!known.products.has(pid)) { warn(`wishlist ${hex(list._id)}: product ${pid} missing, skipped`); return; }
      if (seen.has(pid)) return;
      seen.add(pid);
      out.wishlist_items.push({
        id: uuidFor(`${hex(list._id)}:product:${pid}`), wishlist_id: idOf(list._id), product_id: idOf(p),
        created_at: new Date(new Date(iso(list.createdAt, new Date().toISOString())).getTime() + idx).toISOString(),
      });
    });
  }

  const seenOrderNumbers = new Set();
  for (const o of src.orders) {
    const oid = hex(o._id);
    if (!known.profiles.has(hex(o.user))) { warn(`order ${oid} (${o.orderNumber}): user missing, skipped`); continue; }
    let orderNumber = str(o.orderNumber) || `LEGACY-${oid}`;
    if (seenOrderNumbers.has(orderNumber)) { orderNumber = `${orderNumber}-${oid.slice(-6)}`; warn(`order ${oid}: duplicate orderNumber renamed`); }
    seenOrderNumbers.add(orderNumber);
    const items = (o.items || []).filter((item, idx) => {
      if (known.products.has(hex(item.product))) return true;
      warn(`order ${orderNumber} item #${idx} (${item.name}): product missing, skipped`);
      return false;
    });
    if (!items.length) { warn(`order ${orderNumber}: no migratable items, skipped`); continue; }
    known.orders.add(oid);
    const status = ORDER_STATUSES.includes(o.orderStatus) ? o.orderStatus : 'pending';
    out.orders.push({
      id: idOf(o._id), legacy_mongo_id: oid, user_id: idOf(o.user), order_number: orderNumber,
      shipping_address: o.shippingAddress && typeof o.shippingAddress === 'object' ? o.shippingAddress : {},
      payment_method: ['cod', 'online'].includes(o.paymentMethod) ? o.paymentMethod : 'cod',
      payment_status: ['pending', 'paid', 'failed', 'refunded'].includes(o.paymentStatus) ? o.paymentStatus : 'pending',
      order_status: status,
      subtotal: money(o.subtotal), discount: money(o.discount), shipping: money(o.shipping), tax: money(o.tax), total: money(o.total),
      coupon_id: known.coupons.has(hex(o.coupon)) ? idOf(o.coupon) : null, coupon_code: str(o.couponCode),
      is_paid: bool(o.isPaid, false), paid_at: iso(o.paidAt), delivered_at: iso(o.deliveredAt),
      cancelled_at: iso(o.cancelledAt), cancel_reason: str(o.cancelReason), ...stamps(o),
    });
    items.forEach((item, idx) => {
      out.order_items.push({
        id: uuidFor(`${oid}:item:${idx}`), order_id: idOf(o._id), product_id: idOf(item.product),
        name: str(item.name), image: str(item.image), quantity: Math.max(int(item.quantity, 1), 1),
        price: money(item.price), position: idx, created_at: iso(o.createdAt, new Date().toISOString()),
      });
    });
    const history = o.statusHistory?.length ? o.statusHistory : [{ status, note: 'Migrated', at: o.createdAt }];
    history.forEach((h, idx) => {
      if (!ORDER_STATUSES.includes(h.status)) { warn(`order ${orderNumber}: unknown history status ${h.status}, skipped`); return; }
      out.order_status_history.push({
        id: uuidFor(`${oid}:history:${idx}`), order_id: idOf(o._id), status: h.status, note: str(h.note),
        at: iso(h.at, iso(o.createdAt, new Date().toISOString())),
      });
    });
  }

  const seenReviews = new Set();
  for (const r of src.reviews) {
    const rid = hex(r._id);
    if (!known.profiles.has(hex(r.user)) || !known.products.has(hex(r.product)) || !known.orders.has(hex(r.order))) {
      warn(`review ${rid}: user/product/order missing, skipped`);
      continue;
    }
    const key = `${hex(r.product)}:${hex(r.user)}`;
    if (seenReviews.has(key)) { warn(`review ${rid}: duplicate review for product/user, skipped`); continue; }
    const comment = str(r.comment);
    if (!comment) { warn(`review ${rid}: empty comment, skipped`); continue; }
    seenReviews.add(key);
    out.reviews.push({
      id: idOf(r._id), legacy_mongo_id: rid, user_id: idOf(r.user), product_id: idOf(r.product), order_id: idOf(r.order),
      rating: Math.min(Math.max(int(r.rating, 5), 1), 5), comment: comment.slice(0, 2000),
      is_approved: bool(r.isApproved, true), ...stamps(r),
    });
  }

  return out;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const INSERT_ORDER = [
  'categories', 'profiles', 'addresses', 'coupons', 'products', 'carts', 'cart_items',
  'wishlists', 'wishlist_items', 'orders', 'order_items', 'order_status_history', 'reviews',
];
const SOURCE_COLLECTIONS = ['users', 'categories', 'products', 'carts', 'wishlists', 'orders', 'reviews', 'coupons'];

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is required');

  const mongo = new MongoClient(uri, { readPreference: 'secondaryPreferred' });
  await mongo.connect();
  const db = mongo.db();
  console.log(`Connected to MongoDB database "${db.databaseName}" (read-only usage)`);

  // 1. Backup every collection before touching anything.
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.resolve(here, '..', 'backups', `mongo-${db.databaseName}-${stamp}`);
  fs.mkdirSync(backupDir, { recursive: true });
  const collections = (await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name).sort();
  const src = {};
  console.log('\nSource collections:');
  for (const name of collections) {
    const docs = await db.collection(name).find({}).toArray();
    fs.writeFileSync(path.join(backupDir, `${name}.json`), BSON.EJSON.stringify(docs, null, 2, { relaxed: false }));
    src[name] = docs;
    const note = SOURCE_COLLECTIONS.includes(name) ? '' : '  (not part of the app schema - backed up only)';
    console.log(`  ${name.padEnd(16)} ${String(docs.length).padStart(6)}${note}`);
  }
  console.log(`Backup written to ${backupDir}`);
  for (const name of SOURCE_COLLECTIONS) src[name] ||= [];
  await mongo.close();

  // 2. Transform.
  const rows = transform(src);
  console.log('\nPlanned PostgreSQL rows:');
  for (const table of INSERT_ORDER) console.log(`  ${table.padEnd(22)} ${String(rows[table].length).padStart(6)}`);
  console.log(`\nWarnings (${warnings.length}):`);
  warnings.forEach((w) => console.log(`  - ${w}`));

  if (!EXECUTE) {
    console.log('\nDry run complete. Nothing was written. Re-run with --execute to migrate.');
    return;
  }

  const { supabase } = await import('../src/config/supabase.js');

  // 3. Refuse to mix with unrelated existing data.
  for (const table of ['profiles', 'products', 'orders']) {
    const { count, error } = await supabase.from(table).select('id', { count: 'exact', head: true }).is('legacy_mongo_id', null);
    if (error) throw new Error(`Checking ${table}: ${error.message}`);
    if (count && !ALLOW_EXISTING) {
      throw new Error(`Supabase table "${table}" already has ${count} non-migrated rows. Use an empty project or pass --allow-existing.`);
    }
  }

  // 4. Insert (idempotent: existing ids are left untouched).
  console.log('\nWriting to Supabase...');
  for (const table of INSERT_ORDER) {
    const list = rows[table];
    for (let i = 0; i < list.length; i += BATCH_SIZE) {
      const { error } = await supabase
        .from(table)
        .upsert(list.slice(i, i + BATCH_SIZE), { onConflict: 'id', ignoreDuplicates: true });
      if (error) throw new Error(`Inserting into ${table}: ${error.message}${error.details ? ` (${error.details})` : ''}`);
    }
    console.log(`  ${table.padEnd(22)} done`);
  }

  // Re-sync cached rating columns with the migrated (approved) reviews.
  const reviewed = [...new Set(rows.reviews.map((r) => r.product_id))];
  for (const productId of reviewed) {
    const { error } = await supabase.rpc('refresh_product_rating', { p_product_id: productId });
    if (error) throw new Error(`Refreshing rating: ${error.message}`);
  }

  // 5. Verify every planned row exists.
  console.log('\nVerification (expected vs found in Supabase):');
  let ok = true;
  for (const table of INSERT_ORDER) {
    const ids = rows[table].map((r) => r.id);
    let found = 0;
    for (let i = 0; i < ids.length; i += 200) {
      const { count, error } = await supabase.from(table).select('id', { count: 'exact', head: true }).in('id', ids.slice(i, i + 200));
      if (error) throw new Error(`Verifying ${table}: ${error.message}`);
      found += count || 0;
    }
    const match = found === ids.length;
    ok &&= match;
    console.log(`  ${table.padEnd(22)} ${String(ids.length).padStart(6)} ${String(found).padStart(6)}  ${match ? 'OK' : 'MISMATCH'}`);
  }
  if (!ok) throw new Error('Verification failed: some rows are missing');
  console.log('\nMigration complete. MongoDB was not modified; keep it until you have verified the app on Supabase.');
}

main().catch((err) => {
  console.error(`\nMigration failed: ${err.message}`);
  process.exit(1);
});
