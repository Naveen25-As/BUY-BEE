import express from 'express';
import Wishlist from '../models/Wishlist.js';
import Product from '../models/Product.js';
import Cart from '../models/Cart.js';
import { protect } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

const router = express.Router();

async function getOrCreateWishlist(userId) {
  let list = await Wishlist.findOne({ user: userId }).populate('products');
  if (!list) list = await Wishlist.create({ user: userId, products: [] });
  return list.populate('products');
}

router.use(protect);

router.get('/', async (req, res, next) => {
  try {
    res.json({ success: true, data: await getOrCreateWishlist(req.user._id) });
  } catch (err) {
    next(err);
  }
});

router.post('/:productId', async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.productId);
    if (!product || !product.isActive) return next(new AppError('Product not found', 404));
    const list = await getOrCreateWishlist(req.user._id);
    const exists = list.products.some((p) => p._id.toString() === product._id.toString());
    if (!exists) {
      list.products.push(product._id);
      await list.save();
    }
    res.json({ success: true, data: await list.populate('products') });
  } catch (err) {
    next(err);
  }
});

router.delete('/:productId', async (req, res, next) => {
  try {
    const list = await getOrCreateWishlist(req.user._id);
    list.products = list.products.filter((p) => p._id.toString() !== req.params.productId);
    await list.save();
    res.json({ success: true, data: await list.populate('products') });
  } catch (err) {
    next(err);
  }
});

router.post('/:productId/move-to-cart', async (req, res, next) => {
  try {
    const productId = req.params.productId;
    const product = await Product.findById(productId);
    if (!product) return next(new AppError('Product not found', 404));
    let cart = await Cart.findOne({ user: req.user._id });
    if (!cart) cart = await Cart.create({ user: req.user._id, items: [] });
    const idx = cart.items.findIndex((i) => i.product.toString() === productId);
    const qty = idx >= 0 ? cart.items[idx].quantity + 1 : 1;
    if (qty > product.stock) return next(new AppError(`Only ${product.stock} in stock`, 400));
    if (idx >= 0) cart.items[idx].quantity = qty;
    else cart.items.push({ product: productId, quantity: 1, price: product.price });
    await cart.save();
    const list = await getOrCreateWishlist(req.user._id);
    list.products = list.products.filter((p) => p._id.toString() !== productId);
    await list.save();
    res.json({ success: true, message: 'Moved to cart' });
  } catch (err) {
    next(err);
  }
});

export default router;
