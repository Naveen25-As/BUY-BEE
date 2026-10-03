import express from 'express';
import Review from '../models/Review.js';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import { protect, authorize } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { updateProductRating } from '../utils/updateProductRating.js';

const router = express.Router();

router.get('/product/:productId', async (req, res, next) => {
  try {
    const reviews = await Review.find({ product: req.params.productId, isApproved: true })
      .populate('user', 'name')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: reviews });
  } catch (err) {
    next(err);
  }
});

router.post('/', protect, async (req, res, next) => {
  try {
    const { productId, orderId, rating, comment } = req.body;
    const order = await Order.findById(orderId);
    if (!order || order.user.toString() !== req.user._id.toString()) {
      return next(new AppError('Order not found', 404));
    }
    if (order.orderStatus !== 'delivered') {
      return next(new AppError('You can review only delivered orders', 400));
    }
    const purchased = order.items.some((i) => i.product.toString() === productId);
    if (!purchased) return next(new AppError('Product was not in this order', 400));
    const existing = await Review.findOne({ user: req.user._id, product: productId });
    if (existing) return next(new AppError('You already reviewed this product', 400));

    const review = await Review.create({
      user: req.user._id,
      product: productId,
      order: orderId,
      rating,
      comment,
    });
    await updateProductRating(productId);
    res.status(201).json({ success: true, data: review });
  } catch (err) {
    next(err);
  }
});

router.get('/', protect, authorize('admin'), async (req, res, next) => {
  try {
    const reviews = await Review.find()
      .populate('user', 'name email')
      .populate('product', 'name')
      .sort({ createdAt: -1 })
      .limit(200);
    res.json({ success: true, data: reviews });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/moderate', protect, authorize('admin'), async (req, res, next) => {
  try {
    const review = await Review.findByIdAndUpdate(
      req.params.id,
      { isApproved: req.body.isApproved },
      { new: true }
    );
    if (!review) return next(new AppError('Review not found', 404));
    await updateProductRating(review.product);
    res.json({ success: true, data: review });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', protect, authorize('admin'), async (req, res, next) => {
  try {
    const review = await Review.findByIdAndDelete(req.params.id);
    if (!review) return next(new AppError('Review not found', 404));
    await updateProductRating(review.product);
    res.json({ success: true, message: 'Review deleted' });
  } catch (err) {
    next(err);
  }
});

export default router;
