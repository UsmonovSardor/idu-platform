'use strict';

const jwt = require('jsonwebtoken');
const db  = require('../config/database');

/**
 * Verify JWT from Authorization: Bearer <token>
 * Attaches req.user = { id, login, role } on success.
 */
async function authenticate(req, res, next) {
  const header = req.headers['authorization'] || '';
  if (!header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = header.slice(7);
  let payload;

  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    const msg = err.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token';
    return res.status(401).json({ error: msg });
  }

  try {
    const { rows } = await db.query(
      'SELECT id, full_name, login, role, is_active FROM users WHERE id = $1',
      [payload.sub]
    );

    if (!rows.length || !rows[0].is_active) {
      return res.status(401).json({ error: 'Account not found or deactivated' });
    }

    req.user = {
      id:    rows[0].id,
      name:  rows[0].full_name,
      login: rows[0].login,
      role:  rows[0].role,
    };

    await db.query(
      'UPDATE users SET last_login = NOW() WHERE id = $1',
      [rows[0].id]
    );

    next();
  } catch (err) {
    next(err);
  }
}

function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Access denied. Required role: ${roles.join(' or ')}`,
      });
    }

    next();
  };
}

module.exports = { authenticate, authorize };
