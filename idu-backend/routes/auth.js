'use strict';

const express = require('express');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const { body } = require('express-validator');

const db           = require('../config/database');
const validate     = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { authLimiter }  = require('../middleware/rateLimiter');

const router = express.Router();

const JWT_SECRET     = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';
const IS_PROD        = process.env.NODE_ENV === 'production';

// Cookie max-age in ms (must match JWT expiry)
const COOKIE_MAX_AGE = 8 * 60 * 60 * 1000; // 8h

function createToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function setCookieToken(res, token) {
  res.cookie('idu_token', token, {
    httpOnly: true,
    secure:   IS_PROD,                // HTTPS only in production
    sameSite: IS_PROD ? 'strict' : 'lax',
    maxAge:   COOKIE_MAX_AGE,
    path:     '/',
  });
}

// ── POST /api/v1/auth/login ──────────────────────────────────────────────────
router.post(
  '/login',
  authLimiter,
  [
    body('login').trim().isLength({ min: 3, max: 50 }).withMessage('Login required'),
    body('password').isLength({ min: 1, max: 128 }).withMessage('Password required'),
  ],
  validate,
  async (req, res) => {
    const login    = String(req.body.login    || '').trim().toLowerCase();
    const password = String(req.body.password || '');

    const { rows } = await db.query(
      `SELECT id, full_name, login, password_hash, role, is_active
       FROM users WHERE LOWER(login) = $1 LIMIT 1`,
      [login]
    );

    const user = rows[0];
    if (!user)            return res.status(401).json({ error: "Login yoki parol noto'g'ri" });
    if (!user.is_active)  return res.status(403).json({ error: 'Account deactivated' });

    // Only bcrypt hashes accepted — no plaintext fallback (security)
    const hashExists = user.password_hash && user.password_hash.startsWith('$2');
    if (!hashExists) {
      return res.status(401).json({ error: "Login yoki parol noto'g'ri" });
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) return res.status(401).json({ error: "Login yoki parol noto'g'ri" });

    await db.query('UPDATE users SET last_login = NOW(), updated_at = NOW() WHERE id = $1', [user.id]);

    const token = createToken(user);
    setCookieToken(res, token);

    return res.json({
      token, // also in response body for localStorage fallback in dev
      user: { id: user.id, name: user.full_name, login: user.login, role: user.role },
    });
  }
);

// ── POST /api/v1/auth/logout ─────────────────────────────────────────────────
router.post('/logout', (req, res) => {
  res.clearCookie('idu_token', { path: '/' });
  res.json({ message: 'Logged out' });
});

// ── POST /api/v1/auth/change-password ───────────────────────────────────────
router.post(
  '/change-password',
  authenticate,
  [
    body('currentPassword').isLength({ min: 1, max: 128 }).withMessage('Current password required'),
    body('newPassword')
      .isLength({ min: 8, max: 128 }).withMessage('At least 8 characters')
      .matches(/[A-Z]/).withMessage('Must contain uppercase')
      .matches(/[a-z]/).withMessage('Must contain lowercase')
      .matches(/[0-9]/).withMessage('Must contain number'),
  ],
  validate,
  async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    const { rows } = await db.query(
      'SELECT password_hash FROM users WHERE id = $1 LIMIT 1',
      [req.user.id]
    );

    if (!rows.length) return res.status(404).json({ error: 'User not found' });

    const { password_hash } = rows[0];
    if (!password_hash?.startsWith('$2')) return res.status(401).json({ error: 'Wrong password' });

    const isCorrect = await bcrypt.compare(currentPassword, password_hash);
    if (!isCorrect) return res.status(401).json({ error: 'Wrong password' });

    const isSame = await bcrypt.compare(newPassword, password_hash);
    if (isSame) return res.status(400).json({ error: 'New password must differ from current' });

    const hash = await bcrypt.hash(newPassword, 12);
    await db.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [hash, req.user.id]);

    res.json({ message: 'Password updated' });
  }
);

// ── GET /api/v1/auth/me ──────────────────────────────────────────────────────
router.get('/me', authenticate, async (req, res) => {
  const { rows } = await db.query(
    `SELECT u.id, u.full_name, u.login, u.role, u.phone, u.avatar_url,
            u.created_at, u.last_login,
            s.student_id_number, s.faculty, s.department, s.year_of_study, s.gpa
     FROM users u
     LEFT JOIN students s ON s.user_id = u.id
     WHERE u.id = $1 LIMIT 1`,
    [req.user.id]
  );

  if (!rows.length) return res.status(404).json({ error: 'User not found' });
  res.json(rows[0]);
});

module.exports = router;
