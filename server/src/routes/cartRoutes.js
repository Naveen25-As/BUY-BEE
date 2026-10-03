import express from 'express';
import Cart from '../models/Cart.js';
import Product from '../models/Product.js';
import { protect } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

const router = express.Router();

async function getOrCreateCart(userId) {
  let cart = await Cart.findOne({ user: userId }).populate('items.product');
  if (!cart) cart = await Cart.create({ user: userId, items: [] });
  return cart.populate('items.product');
}

router.use(protect);

router.get('/', async (req, res, next) => {
  try {
    const cart = await getOrCreateCart(req.user._id);
    res.json({ success: true, data: cart });
  } catch (err) {
    next(err);
  }
});

router.post('/items', async (req, res, next) => {
  try {
    const { productId, quantity = 1 } = req.body;
    const product = await Product.findById(productId);
    if (!product || !product.isActive) return next(new AppError('Product not found', 404));
    const cart = await getOrCreateCart(req.user._id);
    const idx = cart.items.findIndex((i) => i.product._id.toString() === productId);
    const newQty = idx >= 0 ? cart.items[idx].quantity + quantity : quantity;
    if (newQty > product.stock) {
      return next(new AppError(`Only ${product.stock} items in stock`, 400));
    }
    if (idx >= 0) {
      cart.items[idx].quantity = newQty;
      cart.items[idx].price = product.price;
    } else {
      cart.items.push({ product: productId, quantity, price: product.price });
    }
    await cart.save();
    res.json({ success: true, data: await cart.populate('items.product') });
  } catch (err) {
    next(err);
  }
});

router.patch('/items/:itemId', async (req, res, next) => {
  try {
    const { quantity } = req.body;
    const cart = await getOrCreateCart(req.user._id);
    const item = cart.items.id(req.params.itemId);
    if (!item) return next(new AppError('Cart item not found', 404));
    const product = await Product.findById(item.product);
    if (quantity > product.stock) {
      return next(new AppError(`Only ${product.stock} items in stock`, 400));
    }
    if (quantity < 1) {
      item.deleteOne();
    } else {
      item.quantity = quantity;
      item.price = product.price;
    }
    await cart.save();
    res.json({ success: true, data: await cart.populate('items.product') });
  } catch (err) {
    next(err);
  }
});

router.delete('/items/:itemId', async (req, res, next) => {
  try {
    const cart = await getOrCreateCart(req.user._id);
    const item = cart.items.id(req.params.itemId);
    if (!item) return next(new AppError('Cart item not found', 404));
    item.deleteOne();
    await cart.save();
    res.json({ success: true, data: await cart.populate('items.product') });
  } catch (err) {
    next(err);
  }
});

router.delete('/', async (req, res, next) => {
  try {
    const cart = await getOrCreateCart(req.user._id);
    cart.items = [];
    await cart.save();
    res.json({ success: true, data: cart });
  } catch (err) {
    next(err);
  }
});

export default router;
