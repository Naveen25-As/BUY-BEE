import express from 'express';
import Product from '../models/Product.js';
import { protect, authorize } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

const router = express.Router();

function buildProductQuery(query) {
  const filter = { isActive: true };
  if (query.category) filter.category = query.category;
  if (query.brand) filter.brand = new RegExp(`^${query.brand}$`, 'i');
  if (query.minPrice || query.maxPrice) {
    filter.price = {};
    if (query.minPrice) filter.price.$gte = Number(query.minPrice);
    if (query.maxPrice) filter.price.$lte = Number(query.maxPrice);
  }
  if (query.minRating) filter['rating.rating'] = { $gte: Number(query.minRating) };
  if (query.discount === 'true') filter.discountPercent = { $gt: 0 };
  if (query.inStock === 'true') filter.stock = { $gt: 0 };
  if (query.featured === 'true') filter.isFeatured = true;
  if (query.q) {
    filter.$text = { $search: query.q };
  }
  return filter;
}

function buildSort(sort) {
  switch (sort) {
    case 'price_asc':
      return { price: 1 };
    case 'price_desc':
      return { price: -1 };
    case 'rating':
      return { 'rating.rating': -1, 'rating.numReviews': -1 };
    case 'popularity':
      return { salesCount: -1 };
    case 'newest':
    default:
      return { createdAt: -1 };
  }
}

router.get('/', async (req, res, next) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Number(req.query.limit) || 12, 48);
    const skip = (page - 1) * limit;
    const filter = buildProductQuery(req.query);
    const sort = buildSort(req.query.sort);
    const [products, total] = await Promise.all([
      Product.find(filter).populate('category', 'name slug').sort(sort).skip(skip).limit(limit),
      Product.countDocuments(filter),
    ]);
    res.json({
      success: true,
      data: products,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/brands', async (req, res, next) => {
  try {
    const brands = await Product.distinct('brand', { isActive: true });
    res.json({ success: true, data: brands.sort() });
  } catch (err) {
    next(err);
  }
});

router.get('/:id/related', async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return next(new AppError('Product not found', 404));
    const related = await Product.find({
      _id: { $ne: product._id },
      category: product.category,
      isActive: true,
    })
      .limit(8)
      .sort({ salesCount: -1 });
    res.json({ success: true, data: related });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id).populate('category', 'name slug');
    if (!product || !product.isActive) return next(new AppError('Product not found', 404));
    res.json({ success: true, data: product });
  } catch (err) {
    next(err);
  }
});

router.post('/', protect, authorize('admin'), async (req, res, next) => {
  try {
    const product = await Product.create(req.body);
    res.status(201).json({ success: true, data: product });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', protect, authorize('admin'), async (req, res, next) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!product) return next(new AppError('Product not found', 404));
    res.json({ success: true, data: product });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', protect, authorize('admin'), async (req, res, next) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!product) return next(new AppError('Product not found', 404));
    res.json({ success: true, message: 'Product deactivated' });
  } catch (err) {
    next(err);
  }
});

export default router;
