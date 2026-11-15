export function notFound(req, res, next) {
  res.status(404).json({ success: false, message: `Route not found: ${req.originalUrl}` });
}

export function errorHandler(err, req, res, next) {
  let status = err.statusCode || err.status || 500;
  let message = err.message || 'Internal server error';

  if (err.type === 'entity.parse.failed') {
    status = 400;
    message = 'Invalid JSON body';
  }

  const isProduction = process.env.NODE_ENV === 'production';
  if (status >= 500) {
    console.error(err.cause || err);
    if (isProduction) message = 'Internal server error';
  } else if (!isProduction) {
    console.error(message);
  }

  res.status(status).json({
    success: false,
    message,
    ...(!isProduction && status >= 500 && err.stack ? { stack: err.stack } : {}),
  });
}

export class AppError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}
