import express from 'express';
import Coupon from '../models/Coupon.js';
import { protect, authorize } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

const router = express.Router();

router.post('/validate', protect, async (req, res, next) => {
  try {
    const { code, subtotal } = req.body;
    const coupon = await Coupon.findOne({ code: code?.toUpperCase() });
    if (!coupon) return next(new AppError('Invalid coupon', 400));
    const valid = coupon.isValid(Number(subtotal) || 0);
    if (!valid.ok) return next(new AppError(valid.message, 400));
    const discount = coupon.calculateDiscount(Number(subtotal) || 0);
    res.json({
      success: true,
      data: {
        code: coupon.code,
        discount,
        description: coupon.description,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/', protect, authorize('admin'), async (req, res, next) => {
  try {
    const coupons = await Coupon.find().sort({ createdAt: -1 });
    res.json({ success: true, data: coupons });
  } catch (err) {
    next(err);
  }
});

router.post('/', protect, authorize('admin'), async (req, res, next) => {
  try {
    const coupon = await Coupon.create(req.body);
    res.status(201).json({ success: true, data: coupon });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', protect, authorize('admin'), async (req, res, next) => {
  try {
    const coupon = await Coupon.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!coupon) return next(new AppError('Coupon not found', 404));
    res.json({ success: true, data: coupon });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', protect, authorize('admin'), async (req, res, next) => {
  try {
    const coupon = await Coupon.findByIdAndDelete(req.params.id);
    if (!coupon) return next(new AppError('Coupon not found', 404));
    res.json({ success: true, message: 'Coupon deleted' });
  } catch (err) {
    next(err);
  }
});

export default router;
