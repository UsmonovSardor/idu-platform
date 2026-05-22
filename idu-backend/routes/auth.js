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
    const ip       = req.ip || req.headers['x-forwarded-for'] || null;

    // ── 1. Check if account is locked ──
    try {
      const { rows: lockRows } = await db.query(
        'SELECT locked_until FROM account_lockouts WHERE login=$1 AND locked_until > NOW()',
        [login]
      );
      if (lockRows.length) {
        const until = new Date(lockRows[0].locked_until);
        const minLeft = Math.ceil((until - Date.now()) / 60000);
        return res.status(429).json({
          error: `Hisob bloklangan. ${minLeft} daqiqadan keyin urinib ko'ring.`,
          locked_until: until.toISOString()
        });
      }
    } catch (e) { /* table may not exist yet on cold start */ }

    const { rows } = await db.query(
      `SELECT id, full_name, login, password_hash, role, is_active
       FROM users WHERE LOWER(login) = $1 LIMIT 1`,
      [login]
    );

    const user = rows[0];

    // ── 2. Fail-handler: record failure, check threshold, optionally lock ──
    async function recordFailure(reason) {
      try {
        await db.query(
          'INSERT INTO failed_logins (login, ip_address) VALUES ($1, $2)',
          [login, ip]
        );
        // Count last 15 min
        const { rows: cnt } = await db.query(
          `SELECT COUNT(*)::int AS n FROM failed_logins
           WHERE login=$1 AND attempted_at > NOW() - INTERVAL '15 minutes'`,
          [login]
        );
        if (cnt[0] && cnt[0].n >= 5) {
          await db.query(
            `INSERT INTO account_lockouts (login, locked_until, reason)
             VALUES ($1, NOW() + INTERVAL '15 minutes', $2)
             ON CONFLICT (login) DO UPDATE
               SET locked_until = NOW() + INTERVAL '15 minutes',
                   reason = $2`,
            [login, reason]
          );
          return true; // locked
        }
      } catch(e) {}
      return false;
    }

    if (!user) {
      await recordFailure('user_not_found');
      return res.status(401).json({ error: "Login yoki parol noto'g'ri" });
    }
    if (!user.is_active)  return res.status(403).json({ error: 'Account deactivated' });

    // Check password — support plaintext with auto-upgrade to bcrypt on login
    let isValid = false;
    const isBcrypt = user.password_hash && user.password_hash.startsWith('$2');

    if (isBcrypt) {
      isValid = await bcrypt.compare(password, user.password_hash);
    } else {
      isValid = password === user.password_hash;
      if (isValid) {
        const newHash = await bcrypt.hash(password, 12);
        db.query('UPDATE users SET password_hash=$1 WHERE id=$2', [newHash, user.id]).catch(() => {});
      }
    }

    if (!isValid) {
      const locked = await recordFailure('wrong_password');
      if (locked) {
        return res.status(429).json({
          error: '5 marta noto\'g\'ri urinish. Hisob 15 daqiqaga bloklandi.'
        });
      }
      return res.status(401).json({ error: "Login yoki parol noto'g'ri" });
    }

    // ── 3. Success — clear lockout & failed attempts ──
    try {
      await db.query('DELETE FROM failed_logins WHERE login=$1', [login]);
      await db.query('DELETE FROM account_lockouts WHERE login=$1', [login]);
    } catch(e) {}

    await db.query('UPDATE users SET last_login = NOW(), updated_at = NOW() WHERE id = $1', [user.id]);

    const token = createToken(user);
    setCookieToken(res, token);

    return res.json({
      token,
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
