import express from 'express';
import { supabase } from '../config/supabase.js';
import { unwrap } from '../db/errors.js';
import { serializeProduct } from '../db/serializers.js';
import { protect, authorize } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import {
  escapeLike,
  isNonEmptyString,
  isNonNegativeInt,
  isNonNegativeNumber,
  isUuid,
  uuidParam,
} from '../utils/validation.js';

const router = express.Router();
router.param('id', uuidParam('Product'));

const LIST_COLUMNS = '*,category:categories(id,name,slug)';

// Mongo $text matched ANY term; build an equivalent OR tsquery from safe word tokens only.
function toSearchQuery(q) {
  const terms = String(q).toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
  return [...new Set(terms)].slice(0, 10).join(' | ');
}

function applyFilters(query, params) {
  let q = query.eq('is_active', true);
  if (params.category) q = q.eq('category_id', params.category);
  if (params.brand) q = q.ilike('brand', escapeLike(params.brand));
  const minPrice = Number(params.minPrice);
  const maxPrice = Number(params.maxPrice);
  if (params.minPrice && Number.isFinite(minPrice)) q = q.gte('price', minPrice);
  if (params.maxPrice && Number.isFinite(maxPrice)) q = q.lte('price', maxPrice);
  const minRating = Number(params.minRating);
  if (params.minRating && Number.isFinite(minRating)) q = q.gte('rating', minRating);
  if (params.discount === 'true') q = q.gt('discount_percent', 0);
  if (params.inStock === 'true') q = q.gt('stock', 0);
  if (params.featured === 'true') q = q.eq('is_featured', true);
  if (params.q) {
    const tsquery = toSearchQuery(params.q);
    if (tsquery) q = q.textSearch('search_vector', tsquery, { config: 'english' });
  }
  return q;
}

function applySort(query, sort) {
  switch (sort) {
    case 'price_asc':
      return query.order('price', { ascending: true }).order('id');
    case 'price_desc':
      return query.order('price', { ascending: false }).order('id');
    case 'rating':
      return query.order('rating', { ascending: false }).order('num_reviews', { ascending: false }).order('id');
    case 'popularity':
      return query.order('sales_count', { ascending: false }).order('id');
    case 'newest':
    default:
      return query.order('created_at', { ascending: false }).order('id');
  }
}

const FIELD_MAP = {
  name: 'name',
  description: 'description',
  price: 'price',
  originalPrice: 'original_price',
  discountPercent: 'discount_percent',
  category: 'category_id',
  brand: 'brand',
  images: 'images',
  stock: 'stock',
  sku: 'sku',
  specifications: 'specifications',
  tags: 'tags',
  isFeatured: 'is_featured',
  isActive: 'is_active',
};

const REQUIRED_ON_CREATE = ['name', 'description', 'price', 'category', 'brand', 'stock', 'sku'];

function isStringArray(v) {
  return Array.isArray(v) && v.every((s) => typeof s === 'string');
}

// Whitelists and validates product input, returning a DB row. Throws AppError on invalid input.
function toProductRow(body, { partial }) {
  const input = body && typeof body === 'object' ? body : {};
  if (!partial) {
    const missing = REQUIRED_ON_CREATE.filter((f) => input[f] === undefined || input[f] === null || input[f] === '');
    if (missing.length) throw new AppError(`Missing required field: ${missing[0]}`, 400);
  }
  const row = {};
  for (const [key, column] of Object.entries(FIELD_MAP)) {
    if (input[key] !== undefined) row[column] = input[key];
  }
  if (row.category_id && typeof row.category_id === 'object') row.category_id = row.category_id._id;

  const checks = [
    ['name', (v) => isNonEmptyString(v)],
    ['description', (v) => isNonEmptyString(v)],
    ['brand', (v) => isNonEmptyString(v)],
    ['sku', (v) => isNonEmptyString(v)],
    ['price', isNonNegativeNumber],
    ['original_price', (v) => v === null || isNonNegativeNumber(v)],
    ['discount_percent', (v) => Number.isInteger(v) && v >= 0 && v <= 100],
    ['category_id', isUuid],
    ['stock', isNonNegativeInt],
    ['images', isStringArray],
    ['tags', isStringArray],
    ['specifications', (v) => v && typeof v === 'object' && !Array.isArray(v)],
    ['is_featured', (v) => typeof v === 'boolean'],
    ['is_active', (v) => typeof v === 'boolean'],
  ];
  for (const [column, valid] of checks) {
    if (row[column] !== undefined && !valid(row[column])) {
      throw new AppError(`Invalid value for ${Object.keys(FIELD_MAP).find((k) => FIELD_MAP[k] === column)}`, 400);
    }
  }
  if (row.name) row.name = row.name.trim();
  if (row.brand) row.brand = row.brand.trim();
  if (row.sku) row.sku = row.sku.trim().toUpperCase();
  if (row.images) row.images = row.images.map((s) => s.trim()).filter(Boolean);
  if (row.tags) row.tags = row.tags.map((s) => s.trim()).filter(Boolean);
  if (row.specifications) {
    row.specifications = Object.fromEntries(
      Object.entries(row.specifications).map(([k, v]) => [k, v === null || v === undefined ? '' : String(v)])
    );
  }
  return row;
}

async function assertCategoryExists(categoryId) {
  if (!categoryId) return;
  const category = unwrap(
    await supabase.from('categories').select('id').eq('id', categoryId).maybeSingle(),
    'Failed to load category'
  );
  if (!category) throw new AppError('Category not found', 400);
}

function productWriteError(error) {
  if (error?.code === '23505') return new AppError('A product with this SKU already exists', 409);
  return null;
}

router.get('/', async (req, res, next) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 12, 1), 48);
    const skip = (page - 1) * limit;
    if (req.query.category && !isUuid(String(req.query.category))) {
      return res.json({ success: true, data: [], pagination: { page, limit, total: 0, pages: 0 } });
    }
    let query = supabase.from('products').select(LIST_COLUMNS, { count: 'exact' });
    query = applySort(applyFilters(query, req.query), req.query.sort).range(skip, skip + limit - 1);
    const { data, error, count } = await query;
    // Requesting a page past the end returns an empty page (PostgREST reports it as a range error).
    if (error?.code === 'PGRST103') {
      return res.json({ success: true, data: [], pagination: { page, limit, total: count ?? 0, pages: 0 } });
    }
    unwrap({ data, error }, 'Failed to load products');
    const total = count ?? 0;
    res.json({
      success: true,
      data: data.map(serializeProduct),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/brands', async (req, res, next) => {
  try {
    const rows = unwrap(
      await supabase.from('products').select('brand').eq('is_active', true),
      'Failed to load brands'
    );
    const brands = [...new Set(rows.map((r) => r.brand))].sort();
    res.json({ success: true, data: brands });
  } catch (err) {
    next(err);
  }
});

router.get('/:id/related', async (req, res, next) => {
  try {
    const product = unwrap(
      await supabase.from('products').select('id,category_id').eq('id', req.params.id).maybeSingle(),
      'Failed to load product'
    );
    if (!product) return next(new AppError('Product not found', 404));
    const related = unwrap(
      await supabase
        .from('products')
        .select('*')
        .eq('category_id', product.category_id)
        .eq('is_active', true)
        .neq('id', product.id)
        .order('sales_count', { ascending: false })
        .limit(8),
      'Failed to load related products'
    );
    res.json({ success: true, data: related.map(serializeProduct) });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const product = unwrap(
      await supabase.from('products').select(LIST_COLUMNS).eq('id', req.params.id).maybeSingle(),
      'Failed to load product'
    );
    if (!product || !product.is_active) return next(new AppError('Product not found', 404));
    res.json({ success: true, data: serializeProduct(product) });
  } catch (err) {
    next(err);
  }
});

router.post('/', protect, authorize('admin'), async (req, res, next) => {
  try {
    const row = toProductRow(req.body, { partial: false });
    await assertCategoryExists(row.category_id);
    const { data, error } = await supabase.from('products').insert(row).select('*').single();
    if (productWriteError(error)) return next(productWriteError(error));
    unwrap({ data, error }, 'Failed to create product');
    res.status(201).json({ success: true, data: serializeProduct(data) });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', protect, authorize('admin'), async (req, res, next) => {
  try {
    const row = toProductRow(req.body, { partial: true });
    await assertCategoryExists(row.category_id);
    if (!Object.keys(row).length) {
      const existing = unwrap(
        await supabase.from('products').select('*').eq('id', req.params.id).maybeSingle(),
        'Failed to load product'
      );
      if (!existing) return next(new AppError('Product not found', 404));
      return res.json({ success: true, data: serializeProduct(existing) });
    }
    const { data, error } = await supabase.from('products').update(row).eq('id', req.params.id).select('*').maybeSingle();
    if (productWriteError(error)) return next(productWriteError(error));
    unwrap({ data, error }, 'Failed to update product');
    if (!data) return next(new AppError('Product not found', 404));
    res.json({ success: true, data: serializeProduct(data) });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', protect, authorize('admin'), async (req, res, next) => {
  try {
    const data = unwrap(
      await supabase.from('products').update({ is_active: false }).eq('id', req.params.id).select('id').maybeSingle(),
      'Failed to deactivate product'
    );
    if (!data) return next(new AppError('Product not found', 404));
    res.json({ success: true, message: 'Product deactivated' });
  } catch (err) {
    next(err);
  }
});

export default router;
