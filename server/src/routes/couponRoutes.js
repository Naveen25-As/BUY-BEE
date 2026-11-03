import express from 'express';
import { supabase } from '../config/supabase.js';
import { unwrap } from '../db/errors.js';
import { serializeCoupon } from '../db/serializers.js';
import { protect, authorize } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { isNonEmptyString, isNonNegativeNumber, uuidParam } from '../utils/validation.js';

const router = express.Router();
router.param('id', uuidParam('Coupon'));

function toCouponRow(body, { partial }) {
  const input = body && typeof body === 'object' ? body : {};
  const row = {};
  const optionalNumber = (v) => v === null || v === '' || isNonNegativeNumber(v);

  if (input.code !== undefined || !partial) {
    if (!isNonEmptyString(input.code)) throw new AppError('Coupon code is required', 400);
    row.code = input.code.trim().toUpperCase();
  }
  if (input.description !== undefined) row.description = input.description ? String(input.description).trim() : null;
  if (input.discountType !== undefined || !partial) {
    if (!['percent', 'fixed'].includes(input.discountType)) throw new AppError('Discount type must be percent or fixed', 400);
    row.discount_type = input.discountType;
  }
  if (input.discountValue !== undefined || !partial) {
    if (!isNonNegativeNumber(input.discountValue)) throw new AppError('Invalid discount value', 400);
    row.discount_value = input.discountValue;
  }
  if (input.minOrderAmount !== undefined) {
    if (!isNonNegativeNumber(input.minOrderAmount)) throw new AppError('Invalid minimum order amount', 400);
    row.min_order_amount = input.minOrderAmount;
  }
  if (input.maxDiscount !== undefined) {
    if (!optionalNumber(input.maxDiscount)) throw new AppError('Invalid max discount', 400);
    row.max_discount = input.maxDiscount === '' ? null : input.maxDiscount;
  }
  if (input.usageLimit !== undefined) {
    const valid = input.usageLimit === null || input.usageLimit === '' || (Number.isInteger(input.usageLimit) && input.usageLimit >= 1);
    if (!valid) throw new AppError('Usage limit must be a positive integer', 400);
    row.usage_limit = input.usageLimit === '' ? null : input.usageLimit;
  }
  if (input.expiresAt !== undefined || !partial) {
    const date = new Date(input.expiresAt);
    if (!input.expiresAt || Number.isNaN(date.getTime())) throw new AppError('Valid expiry date is required', 400);
    row.expires_at = date.toISOString();
  }
  if (input.isActive !== undefined) {
    if (typeof input.isActive !== 'boolean') throw new AppError('isActive must be a boolean', 400);
    row.is_active = input.isActive;
  }
  if (row.discount_type === 'percent' && row.discount_value > 100) {
    throw new AppError('Percent discount cannot exceed 100', 400);
  }
  return row;
}

function couponWriteError(error) {
  if (error?.code === '23505') return new AppError('A coupon with this code already exists', 409);
  if (error?.code === '23514') return new AppError('Invalid coupon data', 400);
  return null;
}

router.post('/validate', protect, async (req, res, next) => {
  try {
    const { code, subtotal } = req.body;
    if (!isNonEmptyString(code)) return next(new AppError('Invalid coupon', 400));
    const data = unwrap(
      await supabase.rpc('validate_coupon', { p_code: code, p_subtotal: Number(subtotal) || 0 }),
      'Failed to validate coupon'
    );
    res.json({
      success: true,
      data: { code: data.code, discount: Number(data.discount), description: data.description ?? undefined },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/', protect, authorize('admin'), async (req, res, next) => {
  try {
    const coupons = unwrap(
      await supabase.from('coupons').select('*').order('created_at', { ascending: false }),
      'Failed to load coupons'
    );
    res.json({ success: true, data: coupons.map(serializeCoupon) });
  } catch (err) {
    next(err);
  }
});

router.post('/', protect, authorize('admin'), async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('coupons')
      .insert(toCouponRow(req.body, { partial: false }))
      .select('*')
      .single();
    if (couponWriteError(error)) return next(couponWriteError(error));
    unwrap({ data, error }, 'Failed to create coupon');
    res.status(201).json({ success: true, data: serializeCoupon(data) });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', protect, authorize('admin'), async (req, res, next) => {
  try {
    const row = toCouponRow(req.body, { partial: true });
    const query = Object.keys(row).length
      ? supabase.from('coupons').update(row).eq('id', req.params.id)
      : supabase.from('coupons').select('*').eq('id', req.params.id);
    const { data, error } = await query.select('*').maybeSingle();
    if (couponWriteError(error)) return next(couponWriteError(error));
    unwrap({ data, error }, 'Failed to update coupon');
    if (!data) return next(new AppError('Coupon not found', 404));
    res.json({ success: true, data: serializeCoupon(data) });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', protect, authorize('admin'), async (req, res, next) => {
  try {
    const data = unwrap(
      await supabase.from('coupons').delete().eq('id', req.params.id).select('id').maybeSingle(),
      'Failed to delete coupon'
    );
    if (!data) return next(new AppError('Coupon not found', 404));
    res.json({ success: true, message: 'Coupon deleted' });
  } catch (err) {
    next(err);
  }
});

export default router;
