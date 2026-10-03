import express from 'express';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import User from '../models/User.js';
import Category from '../models/Category.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

router.use(protect, authorize('admin'));

router.get('/dashboard', async (req, res, next) => {
  try {
    const [
      totalOrders,
      totalCustomers,
      totalProducts,
      pendingOrders,
      lowStockProducts,
      revenueAgg,
      ordersOverTime,
      categoryPerformance,
      topProducts,
    ] = await Promise.all([
      Order.countDocuments(),
      User.countDocuments({ role: 'customer' }),
      Product.countDocuments({ isActive: true }),
      Order.countDocuments({ orderStatus: 'pending' }),
      Product.find({ isActive: true, stock: { $lte: 5 } })
        .select('name sku stock price')
        .sort({ stock: 1 })
        .limit(10),
      Order.aggregate([
        { $match: { orderStatus: { $ne: 'cancelled' } } },
        { $group: { _id: null, totalRevenue: { $sum: '$total' } } },
      ]),
      Order.aggregate([
        {
          $match: {
            createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
            orderStatus: { $ne: 'cancelled' },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            orders: { $sum: 1 },
            revenue: { $sum: '$total' },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Order.aggregate([
        { $match: { orderStatus: { $ne: 'cancelled' } } },
        { $unwind: '$items' },
        {
          $lookup: {
            from: 'products',
            localField: 'items.product',
            foreignField: '_id',
            as: 'product',
          },
        },
        { $unwind: '$product' },
        {
          $lookup: {
            from: 'categories',
            localField: 'product.category',
            foreignField: '_id',
            as: 'category',
          },
        },
        { $unwind: '$category' },
        {
          $group: {
            _id: '$category.name',
            revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
            units: { $sum: '$items.quantity' },
          },
        },
        { $sort: { revenue: -1 } },
      ]),
      Product.find({ isActive: true }).sort({ salesCount: -1 }).limit(8).select('name salesCount price'),
    ]);

    res.json({
      success: true,
      data: {
        stats: {
          totalRevenue: revenueAgg[0]?.totalRevenue || 0,
          totalOrders,
          totalCustomers,
          totalProducts,
          pendingOrders,
          lowStockCount: lowStockProducts.length,
        },
        lowStockProducts,
        charts: {
          ordersOverTime,
          categoryPerformance,
          topProducts,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/inventory', async (req, res, next) => {
  try {
    const filter = { isActive: true };
    if (req.query.lowStock === 'true') filter.stock = { $lte: 5 };
    if (req.query.outOfStock === 'true') filter.stock = 0;
    const products = await Product.find(filter)
      .select('name sku stock price brand category')
      .populate('category', 'name')
      .sort({ stock: 1 });
    res.json({ success: true, data: products });
  } catch (err) {
    next(err);
  }
});

router.patch('/inventory/:id', async (req, res, next) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { stock: req.body.stock },
      { new: true, runValidators: true }
    );
    res.json({ success: true, data: product });
  } catch (err) {
    next(err);
  }
});

export default router;
