'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body } = require('express-validator');

const db = require('../config/database');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is required in environment variables');
}

function createToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      role: user.role,
    },
    JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || '8h',
    }
  );
}

// POST /api/auth/login
router.post(
  '/login',
  authLimiter,
  [
    body('login')
      .trim()
      .isLength({ min: 3, max: 50 })
      .withMessage('Login required'),

    body('password')
      .isLength({ min: 1, max: 128 })
      .withMessage('Password required'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const login = String(req.body.login || '').trim().toLowerCase();
      const password = String(req.body.password || '');

      const { rows } = await db.query(
        `
        SELECT
          id,
          full_name,
          login,
          password_hash,
          role,
          is_active
        FROM users
        WHERE LOWER(login) = LOWER($1)
        LIMIT 1
        `,
        [login]
      );

      const user = rows[0];

      if (!user) {
        return res.status(401).json({
          error: "Login yoki parol noto'g'ri",
        });
      }

      if (!user.is_active) {
        return res.status(403).json({
          error: 'Account deactivated',
        });
      }

      let isValid = false;

      if (user.password_hash && user.password_hash.startsWith('$2')) {
      isValid = await bcrypt.compare(password, user.password_hash);
   } else {
    isValid = password === user.password_hash;
  }

      const isValid = await bcrypt.compare(password, user.password_hash);

      if (!isValid) {
        return res.status(401).json({
          error: "Login yoki parol noto'g'ri",
        });
      }

      await db.query(
        'UPDATE users SET last_login = NOW(), updated_at = NOW() WHERE id = $1',
        [user.id]
      );

      const token = createToken(user);

      return res.json({
        token,
        user: {
          id: user.id,
          name: user.full_name,
          login: user.login,
          role: user.role,
        },
      });
    } catch (error) {
      return next(error);
    }
  }
);

// POST /api/auth/change-password
router.post(
  '/change-password',
  authenticate,
  [
    body('currentPassword')
      .isLength({ min: 1, max: 128 })
      .withMessage('Current password required'),

    body('newPassword')
      .isLength({ min: 8, max: 128 })
      .withMessage('New password must be at least 8 characters')
      .matches(/[A-Z]/)
      .withMessage('New password must contain uppercase letter')
      .matches(/[a-z]/)
      .withMessage('New password must contain lowercase letter')
      .matches(/[0-9]/)
      .withMessage('New password must contain number'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const currentPassword = String(req.body.currentPassword || '');
      const newPassword = String(req.body.newPassword || '');

      const { rows } = await db.query(
        `
        SELECT password_hash
        FROM users
        WHERE id = $1
        LIMIT 1
        `,
        [req.user.id]
      );

      if (!rows.length) {
        return res.status(404).json({
          error: 'User not found',
        });
      }

      const savedPassword = rows[0].password_hash;

      if (!savedPassword || !savedPassword.startsWith('$2')) {
        return res.status(401).json({
          error: 'Wrong password',
        });
      }

      const isCorrect = await bcrypt.compare(currentPassword, savedPassword);

      if (!isCorrect) {
        return res.status(401).json({
          error: 'Wrong password',
        });
      }

      const isSamePassword = await bcrypt.compare(newPassword, savedPassword);

      if (isSamePassword) {
        return res.status(400).json({
          error: 'New password must be different from current password',
        });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 12);

      await db.query(
        `
        UPDATE users
        SET password_hash = $1,
            updated_at = NOW()
        WHERE id = $2
        `,
        [hashedPassword, req.user.id]
      );

      return res.json({
        message: 'Password updated',
      });
    } catch (error) {
      return next(error);
    }
  }
);

// GET /api/auth/me
router.get('/me', authenticate, async (req, res, next) => {
  try {
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
      LIMIT 1
      `,
      [req.user.id]
    );

    if (!rows.length) {
      return res.status(404).json({
        error: 'User not found',
      });
    }

    return res.json(rows[0]);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
