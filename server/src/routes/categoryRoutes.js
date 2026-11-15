import express from 'express';
import { supabase } from '../config/supabase.js';
import { unwrap } from '../db/errors.js';
import { serializeCategory } from '../db/serializers.js';
import { protect, authorize } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { isNonEmptyString, uuidParam } from '../utils/validation.js';

const router = express.Router();
router.param('id', uuidParam('Category'));

function slugify(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function toCategoryRow(body, { partial }) {
  const input = body && typeof body === 'object' ? body : {};
  const row = {};
  if (input.name !== undefined || !partial) {
    if (!isNonEmptyString(input.name)) throw new AppError('Category name is required', 400);
    row.name = input.name.trim();
    row.slug = slugify(row.name);
    if (!row.slug) throw new AppError('Category name must contain letters or numbers', 400);
  }
  for (const key of ['description', 'image']) {
    if (input[key] !== undefined) {
      if (input[key] !== null && typeof input[key] !== 'string') throw new AppError(`Invalid ${key}`, 400);
      row[key] = input[key] === null ? null : input[key].trim();
    }
  }
  if (input.isActive !== undefined) {
    if (typeof input.isActive !== 'boolean') throw new AppError('Invalid isActive', 400);
    row.is_active = input.isActive;
  }
  return row;
}

function duplicateError(error) {
  return error?.code === '23505' ? new AppError('A category with this name already exists', 409) : null;
}

router.get('/', async (req, res, next) => {
  try {
    let query = supabase.from('categories').select('*').order('name');
    if (req.query.all !== 'true') query = query.eq('is_active', true);
    const rows = unwrap(await query, 'Failed to load categories');
    res.json({ success: true, data: rows.map(serializeCategory) });
  } catch (err) {
    next(err);
  }
});

router.post('/', protect, authorize('admin'), async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('categories')
      .insert(toCategoryRow(req.body, { partial: false }))
      .select('*')
      .single();
    if (duplicateError(error)) return next(duplicateError(error));
    unwrap({ data, error }, 'Failed to create category');
    res.status(201).json({ success: true, data: serializeCategory(data) });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', protect, authorize('admin'), async (req, res, next) => {
  try {
    const row = toCategoryRow(req.body, { partial: true });
    const query = Object.keys(row).length
      ? supabase.from('categories').update(row).eq('id', req.params.id).select('*').maybeSingle()
      : supabase.from('categories').select('*').eq('id', req.params.id).maybeSingle();
    const { data, error } = await query;
    if (duplicateError(error)) return next(duplicateError(error));
    unwrap({ data, error }, 'Failed to update category');
    if (!data) return next(new AppError('Category not found', 404));
    res.json({ success: true, data: serializeCategory(data) });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', protect, authorize('admin'), async (req, res, next) => {
  try {
    const { data, error } = await supabase.from('categories').delete().eq('id', req.params.id).select('id').maybeSingle();
    if (error?.code === '23503') {
      return next(new AppError('Category still has products. Move or deactivate them first.', 400));
    }
    unwrap({ data, error }, 'Failed to delete category');
    if (!data) return next(new AppError('Category not found', 404));
    res.json({ success: true, message: 'Category deleted' });
  } catch (err) {
    next(err);
  }
});

export default router;
