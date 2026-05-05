'use strict';

const express  = require('express');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const { body } = require('express-validator');

const db               = require('../config/database');
const validate         = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { authLimiter }  = require('../middleware/rateLimiter');

const router = express.Router();

// POST /api/auth/login
router.post(
  '/login',
  authLimiter,
  [
    body('login').trim().isLength({ min: 3 }).withMessage('Login required'),
    body('password').trim().isLength({ min: 1 }).withMessage('Parol required'),
  ],
  validate,
  async (req, res) => {
    const { login, password } = req.body;

    const { rows } = await db.query(
      'SELECT id, full_name, login, password_hash, role, is_active FROM users WHERE login = $1',
      [login]
    );

    const user = rows[0];

    if (!user) {
      return res.status(401).json({ error: 'Login yoki parol noto‘g‘ri' });
    }

    let isValid = false;

    // 1) Test/demo uchun: password_hash ichida oddiy parol bo‘lsa
    if (user.password_hash === password) {
      isValid = true;
    }

    // 2) Production uchun: password_hash bcrypt hash bo‘lsa
    if (!isValid && user.password_hash && user.password_hash.startsWith('$2')) {
      isValid = await bcrypt.compare(password, user.password_hash);
    }

    if (!isValid) {
      return res.status(401).json({ error: 'Login yoki parol noto‘g‘ri' });
    }

    if (!user.is_active) {
      return res.status(403).json({ error: 'Account deactivated' });
    }

    await db.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

    const token = jwt.sign(
      { sub: user.id, role: user.role },
      process.env.JWT_SECRET || 'dev_secret_change_me',
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.full_name,
        login: user.login,
        role: user.role,
      },
    });
  }
);

// POST /api/auth/change-password
router.post(
  '/change-password',
  authenticate,
  [
    body('currentPassword').notEmpty(),
    body('newPassword').isLength({ min: 8 }).matches(/[A-Z]/).matches(/[0-9]/),
  ],
  validate,
  async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    const { rows } = await db.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [req.user.id]
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'User not found' });
    }

    const savedPassword = rows[0].password_hash;
    let isCorrect = false;

    if (savedPassword === currentPassword) {
      isCorrect = true;
    }

    if (!isCorrect && savedPassword && savedPassword.startsWith('$2')) {
      isCorrect = await bcrypt.compare(currentPassword, savedPassword);
    }

    if (!isCorrect) {
      return res.status(401).json({ error: 'Wrong password' });
    }

    await db.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [await bcrypt.hash(newPassword, 12), req.user.id]
    );

    res.json({ message: 'Password updated' });
  }
);

// GET /api/auth/me
router.get('/me', authenticate, async (req, res) => {
  const { rows } = await db.query(
    `
    SELECT 
      u.id,
      u.full_name,
      u.login,
      u.role,
      u.phone,
      u.avatar_url,
      u.created_at,
      u.last_login,
      s.student_id_number,
      s.faculty,
      s.department,
      s.year_of_study,
      s.gpa
    FROM users u
    LEFT JOIN students s ON s.user_id = u.id
    WHERE u.id = $1
    `,
    [req.user.id]
  );

  if (!rows.length) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json(rows[0]);
});

module.exports = router;
