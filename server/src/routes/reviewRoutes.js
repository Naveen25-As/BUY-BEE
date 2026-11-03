import express from 'express';
import { supabase } from '../config/supabase.js';
import { unwrap } from '../db/errors.js';
import { serializeReview } from '../db/serializers.js';
import { protect, authorize } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { isNonEmptyString, isUuid, uuidParam } from '../utils/validation.js';

const router = express.Router();
router.param('id', uuidParam('Review'));
router.param('productId', uuidParam('Product'));

router.get('/product/:productId', async (req, res, next) => {
  try {
    const reviews = unwrap(
      await supabase
        .from('reviews')
        .select('*,user:profiles(id,name)')
        .eq('product_id', req.params.productId)
        .eq('is_approved', true)
        .order('created_at', { ascending: false }),
      'Failed to load reviews'
    );
    res.json({ success: true, data: reviews.map(serializeReview) });
  } catch (err) {
    next(err);
  }
});

router.post('/', protect, async (req, res, next) => {
  try {
    const { productId, orderId, comment } = req.body;
    const rating = Number(req.body.rating);
    if (!isUuid(orderId)) return next(new AppError('Order not found', 404));
    if (!isUuid(productId)) return next(new AppError('Product was not in this order', 400));
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return next(new AppError('Rating must be between 1 and 5', 400));
    }
    if (!isNonEmptyString(comment) || comment.trim().length > 2000) {
      return next(new AppError('Comment is required (max 2000 characters)', 400));
    }
    const order = unwrap(
      await supabase.from('orders').select('id,user_id,order_status,order_items(product_id)').eq('id', orderId).maybeSingle(),
      'Failed to load order'
    );
    if (!order || order.user_id !== req.user._id) {
      return next(new AppError('Order not found', 404));
    }
    if (order.order_status !== 'delivered') {
      return next(new AppError('You can review only delivered orders', 400));
    }
    if (!order.order_items.some((i) => i.product_id === productId)) {
      return next(new AppError('Product was not in this order', 400));
    }
    const { data, error } = await supabase
      .from('reviews')
      .insert({ user_id: req.user._id, product_id: productId, order_id: orderId, rating, comment: comment.trim() })
      .select('*')
      .single();
    if (error?.code === '23505') return next(new AppError('You already reviewed this product', 400));
    unwrap({ data, error }, 'Failed to create review');
    res.status(201).json({ success: true, data: serializeReview(data) });
  } catch (err) {
    next(err);
  }
});

router.get('/', protect, authorize('admin'), async (req, res, next) => {
  try {
    const reviews = unwrap(
      await supabase
        .from('reviews')
        .select('*,user:profiles(id,name,email),product:products(id,name)')
        .order('created_at', { ascending: false })
        .limit(200),
      'Failed to load reviews'
    );
    res.json({ success: true, data: reviews.map(serializeReview) });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/moderate', protect, authorize('admin'), async (req, res, next) => {
  try {
    if (typeof req.body.isApproved !== 'boolean') return next(new AppError('isApproved must be a boolean', 400));
    const review = unwrap(
      await supabase
        .from('reviews')
        .update({ is_approved: req.body.isApproved })
        .eq('id', req.params.id)
        .select('*')
        .maybeSingle(),
      'Failed to update review'
    );
    if (!review) return next(new AppError('Review not found', 404));
    res.json({ success: true, data: serializeReview(review) });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', protect, authorize('admin'), async (req, res, next) => {
  try {
    const review = unwrap(
      await supabase.from('reviews').delete().eq('id', req.params.id).select('id').maybeSingle(),
      'Failed to delete review'
    );
    if (!review) return next(new AppError('Review not found', 404));
    res.json({ success: true, message: 'Review deleted' });
  } catch (err) {
    next(err);
  }
});

export default router;
