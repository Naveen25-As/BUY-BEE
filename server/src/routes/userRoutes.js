import express from 'express';
import User from '../models/User.js';
import { protect, authorize } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

const router = express.Router();

router.use(protect);

router.put('/profile', async (req, res, next) => {
  try {
    const { name, phone, email } = req.body;
    const user = await User.findById(req.user._id);
    if (email && email !== user.email) {
      if (await User.findOne({ email })) return next(new AppError('Email already in use', 400));
      user.email = email;
    }
    if (name) user.name = name;
    if (phone !== undefined) user.phone = phone;
    await user.save();
    res.json({ success: true, user });
  } catch (err) {
    next(err);
  }
});

router.post('/addresses', async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (req.body.isDefault) {
      user.addresses.forEach((a) => {
        a.isDefault = false;
      });
    }
    user.addresses.push(req.body);
    await user.save();
    res.status(201).json({ success: true, user });
  } catch (err) {
    next(err);
  }
});

router.put('/addresses/:addressId', async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    const addr = user.addresses.id(req.params.addressId);
    if (!addr) return next(new AppError('Address not found', 404));
    Object.assign(addr, req.body);
    if (req.body.isDefault) {
      user.addresses.forEach((a) => {
        if (a._id.toString() !== addr._id.toString()) a.isDefault = false;
      });
    }
    await user.save();
    res.json({ success: true, user });
  } catch (err) {
    next(err);
  }
});

router.delete('/addresses/:addressId', async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    const addr = user.addresses.id(req.params.addressId);
    if (!addr) return next(new AppError('Address not found', 404));
    addr.deleteOne();
    await user.save();
    res.json({ success: true, user });
  } catch (err) {
    next(err);
  }
});

router.get('/', authorize('admin'), async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.q) {
      filter.$or = [
        { name: new RegExp(req.query.q, 'i') },
        { email: new RegExp(req.query.q, 'i') },
      ];
    }
    const users = await User.find(filter).select('-password').sort({ createdAt: -1 }).limit(100);
    res.json({ success: true, data: users });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/status', authorize('admin'), async (req, res, next) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive: req.body.isActive, role: req.body.role },
      { new: true }
    ).select('-password');
    if (!user) return next(new AppError('User not found', 404));
    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
});

export default router;
