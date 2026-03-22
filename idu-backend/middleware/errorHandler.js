'use strict';

/**
 * Central error-handling middleware.
 * Must be registered LAST in Express (after all routes).
 */
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  // Log full stack in development, just message in production
  if (process.env.NODE_ENV !== 'production') {
    console.error('[ERROR]', err.stack || err.message);
  } else {
    console.error('[ERROR]', err.message);
  }

  // PostgreSQL unique violation
  if (err.code === '23505') {
    return res.status(409).json({ error: 'Resource already exists (duplicate entry)' });
  }

  // PostgreSQL foreign key violation
  if (err.code === '23503') {
    return res.status(400).json({ error: 'Related resource not found' });
  }

  // JWT errors (shouldn't reach here if auth middleware is correct, but just in case)
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ error: 'Invalid token' });
  }
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ error: 'Token expired' });
  }

  // Multer file size limit
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      error: `File too large. Maximum size: ${process.env.MAX_FILE_SIZE_MB || 5} MB`,
    });
  }

  // Default — 500
  const status  = err.status || err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production' && status === 500
    ? 'An internal server error occurred'
    : (err.message || 'Internal Server Error');

  res.status(status).json({ error: message });
}

module.exports = errorHandler;
