import express from 'express';
import { supabase } from '../config/supabase.js';
import { unwrap } from '../db/errors.js';
import { serializeProduct } from '../db/serializers.js';
import { protect, authorize } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { isNonNegativeInt, uuidParam } from '../utils/validation.js';

const router = express.Router();
router.param('id', uuidParam('Product'));

router.use(protect, authorize('admin'));

router.get('/dashboard', async (req, res, next) => {
  try {
    const d = unwrap(await supabase.rpc('admin_dashboard'), 'Failed to load dashboard');
    const money = (v) => Number(v) || 0;
    res.json({
      success: true,
      data: {
        stats: {
          totalRevenue: money(d.totalRevenue),
          totalOrders: d.totalOrders,
          totalCustomers: d.totalCustomers,
          totalProducts: d.totalProducts,
          pendingOrders: d.pendingOrders,
          lowStockCount: d.lowStockProducts.length,
        },
        lowStockProducts: d.lowStockProducts.map((p) => ({ ...p, price: money(p.price) })),
        charts: {
          ordersOverTime: d.ordersOverTime.map((o) => ({ ...o, revenue: money(o.revenue) })),
          categoryPerformance: d.categoryPerformance.map((c) => ({ ...c, revenue: money(c.revenue), units: Number(c.units) })),
          topProducts: d.topProducts.map((p) => ({ ...p, price: money(p.price) })),
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/inventory', async (req, res, next) => {
  try {
    let query = supabase
      .from('products')
      .select('id,name,sku,stock,price,brand,category:categories(id,name)')
      .eq('is_active', true)
      .order('stock', { ascending: true })
      .order('name');
    if (req.query.outOfStock === 'true') query = query.eq('stock', 0);
    else if (req.query.lowStock === 'true') query = query.lte('stock', 5);
    const products = unwrap(await query, 'Failed to load inventory');
    res.json({ success: true, data: products.map(serializeProduct) });
  } catch (err) {
    next(err);
  }
});

router.patch('/inventory/:id', async (req, res, next) => {
  try {
    const stock = Number(req.body.stock);
    if (!isNonNegativeInt(stock)) return next(new AppError('Stock must be a non-negative integer', 400));
    const product = unwrap(
      await supabase.from('products').update({ stock }).eq('id', req.params.id).select('*').maybeSingle(),
      'Failed to update stock'
    );
    if (!product) return next(new AppError('Product not found', 404));
    res.json({ success: true, data: serializeProduct(product) });
  } catch (err) {
    next(err);
  }
});

export default router;
