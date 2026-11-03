import express from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { body, validationResult } from 'express-validator';
import { supabase } from '../config/supabase.js';
import { unwrap } from '../db/errors.js';
import { emailExists, getAuthProfileByEmail, getPasswordHash, getUserById, normalizeEmail } from '../db/users.js';
import { AppError } from '../middleware/errorHandler.js';
import { protect } from '../middleware/auth.js';
import { sendTokenResponse } from '../utils/generateToken.js';
import { sendResetEmail } from '../utils/email.js';

const router = express.Router();
const BCRYPT_ROUNDS = 12;

const registerRules = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 80 }).withMessage('Name is too long'),
  body('email').isEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 6 }).withMessage('Password min 6 characters'),
  body('phone').optional({ values: 'falsy' }).isString().trim().isLength({ max: 20 }).withMessage('Invalid phone'),
];

router.post('/register', registerRules, async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: errors.array()[0].msg });
    }
    const { name, email, phone, password } = req.body;
    if (await emailExists(email)) {
      return next(new AppError('Email already registered', 400));
    }
    const { data, error } = await supabase
      .from('profiles')
      .insert({
        name: name.trim(),
        email: normalizeEmail(email),
        phone: phone || null,
        password_hash: await bcrypt.hash(password, BCRYPT_ROUNDS),
        role: 'customer',
      })
      .select('id')
      .single();
    if (error?.code === '23505') return next(new AppError('Email already registered', 400));
    unwrap({ data, error }, 'Registration failed');
    sendTokenResponse(await getUserById(data.id), 201, res);
  } catch (err) {
    next(err);
  }
});

router.post(
  '/login',
  [body('email').isEmail(), body('password').isString().notEmpty()],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: 'Invalid credentials' });
      }
      const { email, password } = req.body;
      const profile = await getAuthProfileByEmail(email);
      if (!profile || !(await bcrypt.compare(password, profile.password_hash))) {
        return next(new AppError('Invalid email or password', 401));
      }
      if (!profile.is_active) {
        return next(new AppError('Account deactivated', 403));
      }
      sendTokenResponse(await getUserById(profile.id), 200, res);
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
    const genericResponse = { success: true, message: 'If that email exists, a reset link was sent.' };
    if (!validationResult(req).isEmpty()) return res.json(genericResponse);

    const profile = await getAuthProfileByEmail(req.body.email);
    if (!profile) return res.json(genericResponse);

    const resetToken = crypto.randomBytes(32).toString('hex');
    unwrap(
      await supabase
        .from('profiles')
        .update({
          reset_password_token: crypto.createHash('sha256').update(resetToken).digest('hex'),
          reset_password_expire: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        })
        .eq('id', profile.id),
      'Failed to create reset token'
    );
    const resetUrl = `${process.env.CLIENT_URL}/reset-password/${resetToken}`;
    await sendResetEmail(profile.email, resetUrl);
    res.json(genericResponse);
  } catch (err) {
    next(err);
  }
});

router.put(
  '/reset-password/:token',
  [body('password').isLength({ min: 6 }).withMessage('Password min 6 characters')],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: errors.array()[0].msg });
      }
      const hashed = crypto.createHash('sha256').update(req.params.token).digest('hex');
      const profile = unwrap(
        await supabase
          .from('profiles')
          .select('id')
          .eq('reset_password_token', hashed)
          .gt('reset_password_expire', new Date().toISOString())
          .maybeSingle(),
        'Failed to verify reset token'
      );
      if (!profile) return next(new AppError('Invalid or expired reset token', 400));
      unwrap(
        await supabase
          .from('profiles')
          .update({
            password_hash: await bcrypt.hash(req.body.password, BCRYPT_ROUNDS),
            reset_password_token: null,
            reset_password_expire: null,
          })
          .eq('id', profile.id),
        'Failed to reset password'
      );
      sendTokenResponse(await getUserById(profile.id), 200, res);
    } catch (err) {
      next(err);
    }
  }
);

router.put(
  '/change-password',
  protect,
  [body('currentPassword').isString().notEmpty(), body('newPassword').isLength({ min: 6 })],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: 'New password must be at least 6 characters' });
      }
      const hash = await getPasswordHash(req.user._id);
      if (!hash || !(await bcrypt.compare(req.body.currentPassword, hash))) {
        return next(new AppError('Current password is incorrect', 400));
      }
      unwrap(
        await supabase
          .from('profiles')
          .update({ password_hash: await bcrypt.hash(req.body.newPassword, BCRYPT_ROUNDS) })
          .eq('id', req.user._id),
        'Failed to update password'
      );
      res.json({ success: true, message: 'Password updated' });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
