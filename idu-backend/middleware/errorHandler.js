'use strict';

function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  if (process.env.NODE_ENV !== 'production') {
    console.error('[ERROR]', err.stack || err.message);
  } else {
    console.error('[ERROR]', err.message);
  }
  if (err.code === '23505') return res.status(409).json({ error: 'Resource already exists' });
  if (err.code === '23503') return res.status(400).json({ error: 'Related resource not found' });
  if (err.name === 'JsonWebTokenError') return res.status(401).json({ error: 'Invalid token' });
  if (err.name === 'TokenExpiredError') return res.status(401).json({ error: 'Token expired' });
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'File too large' });
  const status = err.status || err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production' && status === 500
    ? 'Internal server error'
    : (err.message || 'Internal Server Error');
  res.status(status).json({ error: message });
}

module.exports = errorHandler;
