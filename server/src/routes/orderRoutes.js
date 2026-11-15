import express from 'express';
import { supabase } from '../config/supabase.js';
import { unwrap } from '../db/errors.js';
import { serializeOrder } from '../db/serializers.js';
import { protect, authorize } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { generateOrderNumber, ORDER_STATUSES } from '../utils/orderHelpers.js';
import { containsPattern, isUuid, uuidParam } from '../utils/validation.js';

const router = express.Router();
router.param('id', uuidParam('Order'));

const ORDER_COLUMNS = '*,order_items(*),order_status_history(*)';

async function loadOrder(id) {
  return unwrap(
    await supabase.from('orders').select(ORDER_COLUMNS).eq('id', id).maybeSingle(),
    'Failed to load order'
  );
}

router.use(protect);

router.post('/', async (req, res, next) => {
  try {
    const { addressId, paymentMethod, couponCode } = req.body;
    if (!['cod', 'online'].includes(paymentMethod)) {
      return next(new AppError('Invalid payment method', 400));
    }
    if (!isUuid(addressId)) return next(new AppError('Shipping address not found', 400));
    if (couponCode !== undefined && couponCode !== null && typeof couponCode !== 'string') {
      return next(new AppError('Invalid coupon', 400));
    }
    const orderId = unwrap(
      await supabase.rpc('place_order', {
        p_user_id: req.user._id,
        p_address_id: addressId,
        p_payment_method: paymentMethod,
        p_coupon_code: couponCode || null,
        p_order_number: generateOrderNumber(),
      }),
      'Failed to place order'
    );
    res.status(201).json({ success: true, data: serializeOrder(await loadOrder(orderId)) });
  } catch (err) {
    next(err);
  }
});

router.get('/my', async (req, res, next) => {
  try {
    const orders = unwrap(
      await supabase
        .from('orders')
        .select(ORDER_COLUMNS)
        .eq('user_id', req.user._id)
        .order('created_at', { ascending: false }),
      'Failed to load orders'
    );
    res.json({ success: true, data: orders.map(serializeOrder) });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const order = await loadOrder(req.params.id);
    if (!order) return next(new AppError('Order not found', 404));
    if (order.user_id !== req.user._id && req.user.role !== 'admin') {
      return next(new AppError('Not authorized', 403));
    }
    res.json({ success: true, data: serializeOrder(order) });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/cancel', async (req, res, next) => {
  try {
    const reason = typeof req.body.reason === 'string' ? req.body.reason.slice(0, 500) : null;
    unwrap(
      await supabase.rpc('cancel_order', { p_user_id: req.user._id, p_order_id: req.params.id, p_reason: reason }),
      'Failed to cancel order'
    );
    res.json({ success: true, data: serializeOrder(await loadOrder(req.params.id)) });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/status', authorize('admin'), async (req, res, next) => {
  try {
    const { status, note } = req.body;
    if (!ORDER_STATUSES.includes(status)) return next(new AppError('Invalid order status', 400));
    unwrap(
      await supabase.rpc('update_order_status', {
        p_order_id: req.params.id,
        p_status: status,
        p_note: typeof note === 'string' ? note.slice(0, 500) : null,
      }),
      'Failed to update order status'
    );
    res.json({ success: true, data: serializeOrder(await loadOrder(req.params.id)) });
  } catch (err) {
    next(err);
  }
});

router.get('/', authorize('admin'), async (req, res, next) => {
  try {
    let query = supabase
      .from('orders')
      .select(`${ORDER_COLUMNS},user:profiles(id,name,email)`)
      .order('created_at', { ascending: false })
      .limit(100);
    if (req.query.status) query = query.eq('order_status', String(req.query.status));
    if (req.query.q) query = query.ilike('order_number', containsPattern(String(req.query.q).slice(0, 100)));
    const orders = unwrap(await query, 'Failed to load orders');
    res.json({ success: true, data: orders.map(serializeOrder) });
  } catch (err) {
    next(err);
  }
});

export default router;
