import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { AppError } from './errorHandler.js';

export async function protect(req, res, next) {
  let token;
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }
  if (!token) {
    return next(new AppError('Not authorized. Please log in.', 401));
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password -resetPasswordToken -resetPasswordExpire');
    if (!user) {
      return next(new AppError('User no longer exists.', 401));
    }
    if (!user.isActive) {
      return next(new AppError('Account deactivated.', 403));
    }
    req.user = user;
    next();
  } catch {
    return next(new AppError('Invalid or expired token.', 401));
  }
}

export function authorize(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(new AppError('Not authorized for this action.', 403));
    }
    next();
  };
}
