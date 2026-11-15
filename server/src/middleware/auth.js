import jwt from 'jsonwebtoken';
import { AppError } from './errorHandler.js';
import { getUserById, getUserByLegacyId } from '../db/users.js';
import { isUuid } from '../utils/validation.js';

const LEGACY_OBJECT_ID = /^[0-9a-f]{24}$/i;

async function findUserForToken(id) {
  if (isUuid(id)) return getUserById(id);
  // Tokens issued before the Supabase migration carry the old MongoDB ObjectId.
  if (typeof id === 'string' && LEGACY_OBJECT_ID.test(id)) return getUserByLegacyId(id);
  return null;
}

export async function protect(req, res, next) {
  let token;
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }
  if (!token) {
    return next(new AppError('Not authorized. Please log in.', 401));
  }
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return next(new AppError('Invalid or expired token.', 401));
  }
  try {
    const user = await findUserForToken(decoded.id);
    if (!user) {
      return next(new AppError('User no longer exists.', 401));
    }
    if (!user.isActive) {
      return next(new AppError('Account deactivated.', 403));
    }
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

export function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new AppError('Not authorized for this action.', 403));
    }
    next();
  };
}
