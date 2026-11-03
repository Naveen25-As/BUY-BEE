import express from 'express';
import { supabase } from '../config/supabase.js';
import { unwrap } from '../db/errors.js';
import { serializeCart } from '../db/serializers.js';
import { protect } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { isUuid, uuidParam } from '../utils/validation.js';

const router = express.Router();
router.param('itemId', uuidParam('Cart item'));

const CART_COLUMNS = '*,cart_items(*,product:products(*))';

async function getOrCreateCart(userId) {
  unwrap(
    await supabase.from('carts').upsert({ user_id: userId }, { onConflict: 'user_id', ignoreDuplicates: true }),
    'Failed to create cart'
  );
  const cart = unwrap(
    await supabase.from('carts').select(CART_COLUMNS).eq('user_id', userId).single(),
    'Failed to load cart'
  );
  return cart;
}

async function sendCart(res, userId) {
  res.json({ success: true, data: serializeCart(await getOrCreateCart(userId)) });
}

router.use(protect);

router.get('/', async (req, res, next) => {
  try {
    await sendCart(res, req.user._id);
  } catch (err) {
    next(err);
  }
});

router.post('/items', async (req, res, next) => {
  try {
    const { productId } = req.body;
    const quantity = req.body.quantity === undefined ? 1 : Number(req.body.quantity);
    if (!isUuid(productId)) return next(new AppError('Product not found', 404));
    if (!Number.isInteger(quantity) || quantity < 1) return next(new AppError('Quantity must be a positive integer', 400));
    unwrap(
      await supabase.rpc('add_to_cart', { p_user_id: req.user._id, p_product_id: productId, p_quantity: quantity }),
      'Failed to add item to cart'
    );
    await sendCart(res, req.user._id);
  } catch (err) {
    next(err);
  }
});

async function findOwnedItem(userId, itemId) {
  const cart = await getOrCreateCart(userId);
  const item = unwrap(
    await supabase
      .from('cart_items')
      .select('id,product_id,quantity,product:products(stock,price)')
      .eq('id', itemId)
      .eq('cart_id', cart.id)
      .maybeSingle(),
    'Failed to load cart item'
  );
  return item;
}

router.patch('/items/:itemId', async (req, res, next) => {
  try {
    const quantity = Number(req.body.quantity);
    if (!Number.isInteger(quantity)) return next(new AppError('Quantity must be an integer', 400));
    const item = await findOwnedItem(req.user._id, req.params.itemId);
    if (!item) return next(new AppError('Cart item not found', 404));
    if (quantity > item.product.stock) {
      return next(new AppError(`Only ${item.product.stock} items in stock`, 400));
    }
    if (quantity < 1) {
      unwrap(await supabase.from('cart_items').delete().eq('id', item.id), 'Failed to remove cart item');
    } else {
      unwrap(
        await supabase.from('cart_items').update({ quantity, price: item.product.price }).eq('id', item.id),
        'Failed to update cart item'
      );
    }
    await sendCart(res, req.user._id);
  } catch (err) {
    next(err);
  }
});

router.delete('/items/:itemId', async (req, res, next) => {
  try {
    const item = await findOwnedItem(req.user._id, req.params.itemId);
    if (!item) return next(new AppError('Cart item not found', 404));
    unwrap(await supabase.from('cart_items').delete().eq('id', item.id), 'Failed to remove cart item');
    await sendCart(res, req.user._id);
  } catch (err) {
    next(err);
  }
});

router.delete('/', async (req, res, next) => {
  try {
    const cart = await getOrCreateCart(req.user._id);
    unwrap(await supabase.from('cart_items').delete().eq('cart_id', cart.id), 'Failed to clear cart');
    await sendCart(res, req.user._id);
  } catch (err) {
    next(err);
  }
});

export default router;
