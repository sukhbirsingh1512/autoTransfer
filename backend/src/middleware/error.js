import { logger } from '../utils/logger.js';

export function notFoundHandler(_req, res) {
  res.status(404).json({ error: 'Not found', code: 'NOT_FOUND' });
}

export function errorHandler(err, req, res, _next) {
  const status = err.statusCode || 500;
  if (status >= 500) {
    logger.error({ err, path: req.path, method: req.method }, 'Unhandled error');
  } else {
    logger.warn({ message: err.message, path: req.path, method: req.method }, 'Request error');
  }
  res.status(status).json({
    error: err.message || 'Internal error',
    code: err.code || 'ERR_INTERNAL',
  });
}
