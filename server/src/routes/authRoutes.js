import express from 'express';
import crypto from 'crypto';
import { body, validationResult } from 'express-validator';
import User from '../models/User.js';
import { AppError } from '../middleware/errorHandler.js';
import { protect } from '../middleware/auth.js';
import { sendTokenResponse } from '../utils/generateToken.js';
import { sendResetEmail } from '../utils/email.js';

const router = express.Router();

const registerRules = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 6 }).withMessage('Password min 6 characters'),
];

router.post('/register', registerRules, async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: errors.array()[0].msg });
    }
    const { name, email, phone, password } = req.body;
    if (await User.findOne({ email })) {
      return next(new AppError('Email already registered', 400));
    }
    const user = await User.create({ name, email, phone, password });
    sendTokenResponse(user, 201, res);
  } catch (err) {
    next(err);
  }
});

router.post(
  '/login',
  [body('email').isEmail(), body('password').notEmpty()],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: 'Invalid credentials' });
      }
      const { email, password } = req.body;
      const user = await User.findOne({ email }).select('+password');
      if (!user || !(await user.matchPassword(password))) {
        return next(new AppError('Invalid email or password', 401));
      }
      if (!user.isActive) {
        return next(new AppError('Account deactivated', 403));
      }
      sendTokenResponse(user, 200, res);
    } catch (err) {
      next(err);
    }
  }
);

router.get('/me', protect, async (req, res) => {
  res.json({ success: true, user: req.user });
});

router.post('/forgot-password', [body('email').isEmail()], async (req, res, next) => {
  try {
    const user = await User.findOne({ email: req.body.email });
    if (!user) {
      return res.json({ success: true, message: 'If that email exists, a reset link was sent.' });
    }
    const resetToken = user.createPasswordResetToken();
    await user.save({ validateBeforeSave: false });
    const resetUrl = `${process.env.CLIENT_URL}/reset-password/${resetToken}`;
    await sendResetEmail(user.email, resetUrl);
    res.json({ success: true, message: 'If that email exists, a reset link was sent.' });
  } catch (err) {
    next(err);
  }
});

router.put(
  '/reset-password/:token',
  [body('password').isLength({ min: 6 })],
  async (req, res, next) => {
    try {
      const hashed = crypto.createHash('sha256').update(req.params.token).digest('hex');
      const user = await User.findOne({
        resetPasswordToken: hashed,
        resetPasswordExpire: { $gt: Date.now() },
      }).select('+password');
      if (!user) return next(new AppError('Invalid or expired reset token', 400));
      user.password = req.body.password;
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;
      await user.save();
      sendTokenResponse(user, 200, res);
    } catch (err) {
      next(err);
    }
  }
);

router.put(
  '/change-password',
  protect,
  [body('currentPassword').notEmpty(), body('newPassword').isLength({ min: 6 })],
  async (req, res, next) => {
    try {
      const user = await User.findById(req.user._id).select('+password');
      if (!(await user.matchPassword(req.body.currentPassword))) {
        return next(new AppError('Current password is incorrect', 400));
      }
      user.password = req.body.newPassword;
      await user.save();
      res.json({ success: true, message: 'Password updated' });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
