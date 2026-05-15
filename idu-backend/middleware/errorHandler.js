'use strict';

const { logger } = require('./logger');

function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  // Log with appropriate level
  const status = err.status || err.statusCode || 500;

  if (status >= 500) {
    logger.error(`${req.method} ${req.path} — ${err.message}`, { stack: err.stack });
  } else {
    logger.warn(`${req.method} ${req.path} — ${err.message}`, { status });
  }

  // PostgreSQL constraint errors
  if (err.code === '23505') return res.status(409).json({ error: 'Resource already exists' });
  if (err.code === '23503') return res.status(400).json({ error: 'Related resource not found' });

  // JWT errors
  if (err.name === 'JsonWebTokenError')  return res.status(401).json({ error: 'Invalid token' });
  if (err.name === 'TokenExpiredError')  return res.status(401).json({ error: 'Token expired' });

  // CORS error
  if (err.message === 'Not allowed by CORS') return res.status(403).json({ error: 'CORS: origin not allowed' });

  // Multer
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'File too large' });

  const message = process.env.NODE_ENV === 'production' && status >= 500
    ? 'Internal server error'
    : (err.message || 'Internal server error');

  res.status(status).json({ error: message });
}

module.exports = errorHandler;
