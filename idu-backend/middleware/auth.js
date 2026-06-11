'use strict';

const jwt   = require('jsonwebtoken');
const db    = require('../config/database');
const redis = require('../services/redis');

const USER_CACHE_TTL = 300; // 5 min — user profile rarely changes

/**
 * Verify JWT from:
 *   1. httpOnly cookie: idu_token
 *   2. Authorization: Bearer <token>  (fallback for API clients / dev)
 *
 * User profile is cached in Redis for 5 minutes so the DB is not
 * hit on every request (previously: 1 DB query per API call).
 */
async function authenticate(req, res, next) {
  let token = null;

  if (req.cookies && req.cookies.idu_token) {
    token = req.cookies.idu_token;
  }
  if (!token) {
    const header = req.headers['authorization'] || '';
    if (header.startsWith('Bearer ')) token = header.slice(7);
  }

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    const msg = err.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token';
    return res.status(401).json({ error: msg });
  }

  try {
    const cacheKey = `user:${payload.sub}`;
    const cached   = await redis.get(cacheKey);

    if (cached) {
      req.user = JSON.parse(cached);
      return next();
    }

    const { rows } = await db.query(
      'SELECT id, full_name, login, role, is_active, tenant_id FROM users WHERE id = $1',
      [payload.sub]
    );

    if (!rows.length || !rows[0].is_active) {
      return res.status(401).json({ error: 'Account not found or deactivated' });
    }

    req.user = {
      id:        rows[0].id,
      name:      rows[0].full_name,
      login:     rows[0].login,
      role:      rows[0].role,
      tenant_id: rows[0].tenant_id,
    };

    await redis.set(cacheKey, JSON.stringify(req.user), 'EX', USER_CACHE_TTL);

    // fire-and-forget last_login update
    db.query('UPDATE users SET last_login = NOW() WHERE id = $1', [rows[0].id]).catch(() => {});

    next();
  } catch (err) {
    next(err);
  }
}

// Call this when a user's role/status changes to bust the cache immediately
async function invalidateUserCache(userId) {
  await redis.del(`user:${userId}`).catch(() => {});
}

function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: `Access denied. Required: ${roles.join(' or ')}` });
    }
    next();
  };
}

module.exports = { authenticate, authorize, invalidateUserCache };
