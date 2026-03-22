'use strict';

const express  = require('express');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const { body } = require('express-validator');

const db                 = require('../config/database');
const validate          = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { authLimiter }  = require('../middleware/rateLimiter');

const router = express.Router();

// ── POST /api/auth/login ──────────────────────────────────────────────────────
router.post(
  '/login',
  authLimiter,
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  ],
  validate,
  async (req, res) => {
    const { email, password } = req.body;

    const { rows } = await db.query(
      'SELECT id, full_name, email, password_hash, role, is_active FROM users WHERE email = $1',
      [email]
    );

    const user = rows[0];

    // Use constant-time comparison even when user not found (prevent timing attacks)
    const dummyHash = '$2a$12$invalidhashfortimingprotectiononly000000000000000000000';
    const hashToCheck = user ? user.password_hash : dummyHash;
    const isValid = await bcrypt.compare(password, hashToCheck);

    if (!user || !isValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (!user.is_active) {
      return res.status(403).json({ error: 'Account has been deactivated' });
    }

    // Update last_login timestamp
    await db.query(
      'UPDATE users SET last_login = NOW() WHERE id = $1',
      [user.id]
    );

    const token = jwt.sign(
      { sub: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    res.json({
      token,
      user: {
        id:   user.id,
        name: user.full_name,
        email: user.email,
        role: user.role,
      },
    });
  }
);

// ── POST /api/auth/change-password ────────────────────────────────────────────
router.post(
  '/change-password',
  authenticate,
  [
    body('currentPassword').notEmpty().withMessage('Current password required'),
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('New password must be at least 8 characters')
      .matches(/[A-Z]/).withMessage('Must contain an uppercase letter')
      .matches(/[0-9]/).withMessage('Must contain a number'),
  ],
  validate,
  async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    const { rows } = await db.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [req.user.id]
    );

    const valid = await bcrypt.compare(currentPassword, rows[0].password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const newHash = await bcrypt.hash(newPassword, 12);
    await db.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [newHash, req.user.id]
    );

    res.json({ message: 'Password updated successfully' });
  }
);

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
router.get('/me', authenticate, async (req, res) => {
  const { rows } = await db.query(
    `SELECT u.id, u.full_name, u.email, u.role, u.phone, u.avatar_url,
            u.created_at, u.last_login,
            s.student_id_number, s.faculty, s.department, s.year_of_study, s.gpa
      FROM users u
     LEFT JOIN students s ON s.user_id = u.id
     WHERE u.id = $1`,
    [req.user.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'User not found' });
  res.json(rows[0]);
});

module.exports = router;
