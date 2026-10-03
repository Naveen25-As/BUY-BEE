import mongoose from 'mongoose';

const couponSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    description: { type: String, trim: true },
    discountType: { type: String, enum: ['percent', 'fixed'], required: true },
    discountValue: { type: Number, required: true, min: 0 },
    minOrderAmount: { type: Number, default: 0, min: 0 },
    maxDiscount: { type: Number, min: 0 },
    expiresAt: { type: Date, required: true },
    usageLimit: { type: Number, min: 1 },
    usedCount: { type: Number, default: 0, min: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

couponSchema.methods.isValid = function isValid(subtotal) {
  if (!this.isActive) return { ok: false, message: 'Coupon is inactive' };
  if (this.expiresAt < new Date()) return { ok: false, message: 'Coupon expired' };
  if (this.usageLimit != null && this.usedCount >= this.usageLimit) {
    return { ok: false, message: 'Coupon usage limit reached' };
  }
  if (subtotal < this.minOrderAmount) {
    return { ok: false, message: `Minimum order amount is ₹${this.minOrderAmount}` };
  }
  return { ok: true };
};

couponSchema.methods.calculateDiscount = function calculateDiscount(subtotal) {
  let amount = 0;
  if (this.discountType === 'percent') {
    amount = (subtotal * this.discountValue) / 100;
    if (this.maxDiscount != null) amount = Math.min(amount, this.maxDiscount);
  } else {
    amount = this.discountValue;
  }
  return Math.min(amount, subtotal);
};

const Coupon = mongoose.model('Coupon', couponSchema);
export default Coupon;
