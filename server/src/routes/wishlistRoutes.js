import express from 'express';
import { supabase } from '../config/supabase.js';
import { unwrap } from '../db/errors.js';
import { serializeWishlist } from '../db/serializers.js';
import { protect } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { uuidParam } from '../utils/validation.js';

const router = express.Router();
router.param('productId', uuidParam('Product'));

const WISHLIST_COLUMNS = '*,wishlist_items(*,product:products(*))';

async function getOrCreateWishlist(userId) {
  unwrap(
    await supabase.from('wishlists').upsert({ user_id: userId }, { onConflict: 'user_id', ignoreDuplicates: true }),
    'Failed to create wishlist'
  );
  return unwrap(
    await supabase.from('wishlists').select(WISHLIST_COLUMNS).eq('user_id', userId).single(),
    'Failed to load wishlist'
  );
}

async function sendWishlist(res, userId) {
  res.json({ success: true, data: serializeWishlist(await getOrCreateWishlist(userId)) });
}

router.use(protect);

router.get('/', async (req, res, next) => {
  try {
    await sendWishlist(res, req.user._id);
  } catch (err) {
    next(err);
  }
});

router.post('/:productId', async (req, res, next) => {
  try {
    const product = unwrap(
      await supabase.from('products').select('id,is_active').eq('id', req.params.productId).maybeSingle(),
      'Failed to load product'
    );
    if (!product || !product.is_active) return next(new AppError('Product not found', 404));
    const list = await getOrCreateWishlist(req.user._id);
    unwrap(
      await supabase
        .from('wishlist_items')
        .upsert(
          { wishlist_id: list.id, product_id: product.id },
          { onConflict: 'wishlist_id,product_id', ignoreDuplicates: true }
        ),
      'Failed to add to wishlist'
    );
    await sendWishlist(res, req.user._id);
  } catch (err) {
    next(err);
  }
});

router.delete('/:productId', async (req, res, next) => {
  try {
    const list = await getOrCreateWishlist(req.user._id);
    unwrap(
      await supabase.from('wishlist_items').delete().eq('wishlist_id', list.id).eq('product_id', req.params.productId),
      'Failed to remove from wishlist'
    );
    await sendWishlist(res, req.user._id);
  } catch (err) {
    next(err);
  }
});

router.post('/:productId/move-to-cart', async (req, res, next) => {
  try {
    unwrap(
      await supabase.rpc('move_wishlist_item_to_cart', {
        p_user_id: req.user._id,
        p_product_id: req.params.productId,
      }),
      'Failed to move item to cart'
    );
    res.json({ success: true, message: 'Moved to cart' });
  } catch (err) {
    next(err);
  }
});

export default router;
