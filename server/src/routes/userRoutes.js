import express from 'express';
import { supabase } from '../config/supabase.js';
import { unwrap } from '../db/errors.js';
import { serializeUser } from '../db/serializers.js';
import { emailExists, getUserById, normalizeEmail } from '../db/users.js';
import { protect, authorize } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { containsPattern, isNonEmptyString, pgrstQuote, uuidParam } from '../utils/validation.js';

const router = express.Router();
router.param('id', uuidParam('User'));
router.param('addressId', uuidParam('Address'));

const ADDRESS_FIELDS = {
  fullName: 'full_name',
  phone: 'phone',
  addressLine: 'address_line',
  city: 'city',
  state: 'state',
  postalCode: 'postal_code',
  country: 'country',
  addressType: 'address_type',
};
const REQUIRED_ADDRESS_FIELDS = ['fullName', 'phone', 'addressLine', 'city', 'state', 'postalCode'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function toAddressRow(body, { partial }) {
  const input = body && typeof body === 'object' ? body : {};
  const row = {};
  for (const [key, column] of Object.entries(ADDRESS_FIELDS)) {
    if (input[key] === undefined) continue;
    if (!isNonEmptyString(input[key])) throw new AppError(`Invalid value for ${key}`, 400);
    row[column] = input[key].trim();
  }
  if (!partial) {
    const missing = REQUIRED_ADDRESS_FIELDS.find((key) => row[ADDRESS_FIELDS[key]] === undefined);
    if (missing) throw new AppError(`Missing required field: ${missing}`, 400);
  }
  if (row.address_type && !['home', 'work', 'other'].includes(row.address_type)) {
    throw new AppError('Address type must be home, work or other', 400);
  }
  if (input.isDefault !== undefined) row.is_default = Boolean(input.isDefault);
  return row;
}

router.use(protect);

router.put('/profile', async (req, res, next) => {
  try {
    const { name, phone, email } = req.body;
    const updates = {};
    if (email && normalizeEmail(email) !== req.user.email) {
      if (!EMAIL_RE.test(String(email).trim())) return next(new AppError('Valid email required', 400));
      if (await emailExists(email, req.user._id)) return next(new AppError('Email already in use', 400));
      updates.email = normalizeEmail(email);
    }
    if (name) {
      if (!isNonEmptyString(name) || name.trim().length > 80) return next(new AppError('Invalid name', 400));
      updates.name = name.trim();
    }
    if (phone !== undefined) updates.phone = phone ? String(phone).trim() : null;
    if (Object.keys(updates).length) {
      const { error } = await supabase.from('profiles').update(updates).eq('id', req.user._id);
      if (error?.code === '23505') return next(new AppError('Email already in use', 400));
      unwrap({ error }, 'Failed to update profile');
    }
    res.json({ success: true, user: await getUserById(req.user._id) });
  } catch (err) {
    next(err);
  }
});

router.post('/addresses', async (req, res, next) => {
  try {
    const row = toAddressRow(req.body, { partial: false });
    unwrap(await supabase.from('addresses').insert({ ...row, user_id: req.user._id }), 'Failed to save address');
    res.status(201).json({ success: true, user: await getUserById(req.user._id) });
  } catch (err) {
    next(err);
  }
});

router.put('/addresses/:addressId', async (req, res, next) => {
  try {
    const row = toAddressRow(req.body, { partial: true });
    const query = Object.keys(row).length
      ? supabase.from('addresses').update(row)
      : supabase.from('addresses').select('id');
    const data = unwrap(
      await query.eq('id', req.params.addressId).eq('user_id', req.user._id).select('id').maybeSingle(),
      'Failed to update address'
    );
    if (!data) return next(new AppError('Address not found', 404));
    res.json({ success: true, user: await getUserById(req.user._id) });
  } catch (err) {
    next(err);
  }
});

router.delete('/addresses/:addressId', async (req, res, next) => {
  try {
    const data = unwrap(
      await supabase
        .from('addresses')
        .delete()
        .eq('id', req.params.addressId)
        .eq('user_id', req.user._id)
        .select('id')
        .maybeSingle(),
      'Failed to delete address'
    );
    if (!data) return next(new AppError('Address not found', 404));
    res.json({ success: true, user: await getUserById(req.user._id) });
  } catch (err) {
    next(err);
  }
});

router.get('/', authorize('admin'), async (req, res, next) => {
  try {
    let query = supabase
      .from('profiles')
      .select('id,name,email,phone,role,is_active,created_at,updated_at,addresses(*)')
      .order('created_at', { ascending: false })
      .limit(100);
    if (req.query.q) {
      const pattern = pgrstQuote(containsPattern(String(req.query.q).slice(0, 100)));
      query = query.or(`name.ilike.${pattern},email.ilike.${pattern}`);
    }
    const users = unwrap(await query, 'Failed to load users');
    res.json({ success: true, data: users.map(serializeUser) });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/status', authorize('admin'), async (req, res, next) => {
  try {
    const updates = {};
    if (req.body.isActive !== undefined) {
      if (typeof req.body.isActive !== 'boolean') return next(new AppError('isActive must be a boolean', 400));
      updates.is_active = req.body.isActive;
    }
    if (req.body.role !== undefined) {
      if (!['customer', 'admin'].includes(req.body.role)) return next(new AppError('Invalid role', 400));
      updates.role = req.body.role;
    }
    const query = Object.keys(updates).length
      ? supabase.from('profiles').update(updates).eq('id', req.params.id)
      : supabase.from('profiles').select('id').eq('id', req.params.id);
    const data = unwrap(await query.select('id').maybeSingle(), 'Failed to update user');
    if (!data) return next(new AppError('User not found', 404));
    res.json({ success: true, data: await getUserById(req.params.id) });
  } catch (err) {
    next(err);
  }
});

export default router;
