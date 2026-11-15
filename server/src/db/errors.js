import { AppError } from '../middleware/errorHandler.js';

const CLIENT_ERROR_CODES = {
  '23502': 'Missing required field',
  '23514': 'Invalid data',
  '22P02': 'Invalid input',
  '22003': 'Value out of range',
  '22001': 'Value too long',
  '22007': 'Invalid date',
  '22008': 'Invalid date',
};

// Converts a Supabase/PostgREST error into an AppError without leaking internals to clients.
export function toAppError(error, fallbackMessage = 'Database operation failed') {
  if (!error) return null;
  if (error instanceof AppError) return error;

  const code = error.code || '';
  let appError;

  if (code === 'P0001') {
    const status = Number(error.hint);
    appError = new AppError(error.message, status >= 400 && status < 600 ? status : 400);
  } else if (code === '23505') {
    appError = new AppError('A record with this value already exists', 409);
  } else if (code === '23503') {
    appError = new AppError('Related record not found or still in use', 400);
  } else if (CLIENT_ERROR_CODES[code]) {
    appError = new AppError(CLIENT_ERROR_CODES[code], 400);
  } else if (!code && /fetch failed|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|network/i.test(error.message || '')) {
    appError = new AppError('Database temporarily unavailable', 503);
  } else {
    appError = new AppError(fallbackMessage, 500);
  }

  appError.dbCode = code;
  appError.cause = error;
  return appError;
}

export function unwrap({ data, error }, fallbackMessage) {
  if (error) throw toAppError(error, fallbackMessage);
  return data;
}
