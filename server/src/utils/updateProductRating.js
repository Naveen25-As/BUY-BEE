import Review from '../models/Review.js';
import Product from '../models/Product.js';

export async function updateProductRating(productId) {
  const stats = await Review.aggregate([
    { $match: { product: productId, isApproved: true } },
    {
      $group: {
        _id: '$product',
        avgRating: { $avg: '$rating' },
        count: { $sum: 1 },
      },
    },
  ]);
  const rating = stats[0]?.avgRating ? Math.round(stats[0].avgRating * 10) / 10 : 0;
  const numReviews = stats[0]?.count || 0;
  await Product.findByIdAndUpdate(productId, { rating: { rating, numReviews } });
}
