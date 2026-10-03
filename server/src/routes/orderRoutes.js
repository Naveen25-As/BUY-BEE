import express from 'express';
import Order from '../models/Order.js';
import Cart from '../models/Cart.js';
import Product from '../models/Product.js';
import Coupon from '../models/Coupon.js';
import User from '../models/User.js';
import { protect, authorize } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { calcTotals, canTransition, generateOrderNumber } from '../utils/orderHelpers.js';

const router = express.Router();

router.use(protect);

router.post('/', async (req, res, next) => {
  try {
    const { addressId, paymentMethod, couponCode } = req.body;
    if (!['cod', 'online'].includes(paymentMethod)) {
      return next(new AppError('Invalid payment method', 400));
    }
    const user = await User.findById(req.user._id);
    const address = user.addresses.id(addressId);
    if (!address) return next(new AppError('Shipping address not found', 400));

    const cart = await Cart.findOne({ user: req.user._id }).populate('items.product');
    if (!cart?.items.length) return next(new AppError('Cart is empty', 400));

    let subtotal = 0;
    const orderItems = [];
    for (const item of cart.items) {
      const product = item.product;
      if (!product?.isActive) return next(new AppError(`Product unavailable: ${product?.name || 'item'}`, 400));
      if (item.quantity > product.stock) {
        return next(new AppError(`Insufficient stock for ${product.name}`, 400));
      }
      subtotal += product.price * item.quantity;
      orderItems.push({
        product: product._id,
        name: product.name,
        image: product.images[0],
        quantity: item.quantity,
        price: product.price,
      });
    }

    let discount = 0;
    let coupon = null;
    if (couponCode) {
      coupon = await Coupon.findOne({ code: couponCode.toUpperCase() });
      if (!coupon) return next(new AppError('Invalid coupon', 400));
      const valid = coupon.isValid(subtotal);
      if (!valid.ok) return next(new AppError(valid.message, 400));
      discount = coupon.calculateDiscount(subtotal);
    }

    const { shipping, tax, total } = calcTotals(subtotal, discount);

    const order = await Order.create({
      user: req.user._id,
      orderNumber: generateOrderNumber(),
      items: orderItems,
      shippingAddress: {
        fullName: address.fullName,
        phone: address.phone,
        addressLine: address.addressLine,
        city: address.city,
        state: address.state,
        postalCode: address.postalCode,
        country: address.country,
        addressType: address.addressType,
      },
      paymentMethod,
      paymentStatus: paymentMethod === 'online' ? 'pending' : 'pending',
      orderStatus: 'pending',
      statusHistory: [{ status: 'pending', note: 'Order placed' }],
      subtotal,
      discount,
      shipping,
      tax,
      total,
      coupon: coupon?._id,
      couponCode: coupon?.code,
    });

    for (const item of cart.items) {
      await Product.findByIdAndUpdate(item.product._id, {
        $inc: { stock: -item.quantity, salesCount: item.quantity },
      });
    }
    if (coupon) {
      coupon.usedCount += 1;
      await coupon.save();
    }
    cart.items = [];
    await cart.save();

    res.status(201).json({ success: true, data: order });
  } catch (err) {
    next(err);
  }
});

router.get('/my', async (req, res, next) => {
  try {
    const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.json({ success: true, data: orders });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id).populate('items.product');
    if (!order) return next(new AppError('Order not found', 404));
    if (order.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return next(new AppError('Not authorized', 403));
    }
    res.json({ success: true, data: order });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/cancel', async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return next(new AppError('Order not found', 404));
    if (order.user.toString() !== req.user._id.toString()) {
      return next(new AppError('Not authorized', 403));
    }
    if (!canTransition(order.orderStatus, 'cancelled')) {
      return next(new AppError('Order cannot be cancelled at this stage', 400));
    }
    order.orderStatus = 'cancelled';
    order.cancelledAt = new Date();
    order.cancelReason = req.body.reason || 'Cancelled by customer';
    order.statusHistory.push({ status: 'cancelled', note: order.cancelReason });
    await order.save();
    for (const item of order.items) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: { stock: item.quantity, salesCount: -item.quantity },
      });
    }
    res.json({ success: true, data: order });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/status', protect, authorize('admin'), async (req, res, next) => {
  try {
    const { status, note } = req.body;
    const order = await Order.findById(req.params.id);
    if (!order) return next(new AppError('Order not found', 404));
    if (!canTransition(order.orderStatus, status) && status !== order.orderStatus) {
      return next(new AppError(`Invalid status transition from ${order.orderStatus} to ${status}`, 400));
    }
    order.orderStatus = status;
    order.statusHistory.push({ status, note: note || `Status updated to ${status}` });
    if (status === 'delivered') {
      order.deliveredAt = new Date();
      if (order.paymentMethod === 'cod') {
        order.paymentStatus = 'paid';
        order.isPaid = true;
        order.paidAt = new Date();
      }
    }
    await order.save();
    res.json({ success: true, data: order });
  } catch (err) {
    next(err);
  }
});

router.get('/', protect, authorize('admin'), async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.status) filter.orderStatus = req.query.status;
    if (req.query.q) {
      filter.$or = [
        { orderNumber: new RegExp(req.query.q, 'i') },
      ];
    }
    const orders = await Order.find(filter).populate('user', 'name email').sort({ createdAt: -1 }).limit(100);
    res.json({ success: true, data: orders });
  } catch (err) {
    next(err);
  }
});

export default router;
