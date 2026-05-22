'use strict';

const express  = require('express');
const { body, param } = require('express-validator');

const db                    = require('../config/database');
const validate              = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// ?? GET /api/teachers ?????????????????????????????????????????????????????????
router.get('/', async (req, res) => {
  const { rows } = await db.query(
    `SELECT u.id, u.full_name, u.phone, u.avatar_url,
            t.department, t.title, t.bio,
            COUNT(c.id) AS course_count
     FROM users u
     JOIN teachers t ON t.user_id = u.id
     LEFT JOIN courses c ON c.teacher_id = u.id
     WHERE u.is_active = TRUE
     GROUP BY u.id, t.department, t.title, t.bio
     ORDER BY u.full_name`
  );
  res.json(rows);
});

router.get('/:id/courses', [param('id').isInt({ min: 1 }).toInt()], validate, async (req, res) => {
  const { rows } = await db.query(
    'SELECT c.id,c.name,c.code,c.credits,c.description FROM courses c WHERE c.teacher_id=$1 AND c.is_active=TRUE ORDER BY name',
    [req.params.id]);
  res.json(rows);
});

// ── POST /api/teachers — create new teacher account ──────────────────────────
router.post('/', authorize('dekanat', 'admin'), [
  body('fullName').isLength({ min: 2, max: 100 }).trim()
    .withMessage('Ism-familiya 2–100 belgi bo\'lishi kerak'),
  body('login')
    .isLength({ min: 3, max: 50 }).trim()
    .matches(/^[a-zA-Z0-9._-]+$/)
    .withMessage('Login faqat harf, raqam, nuqta, tire va pastki chiziqdan iborat bo\'lishi kerak'),
  body('password').isLength({ min: 8, max: 128 })
    .withMessage('Parol kamida 8 belgi bo\'lishi kerak'),
  body('department').isLength({ min: 2, max: 100 }).trim()
    .withMessage('Bo\'lim nomi kiritish shart'),
  body('title').optional().isLength({ max: 100 }).trim(),
  body('phone').optional({ nullable: true })
    .custom(v => !v || /^\+?[\d\s\-().]{7,20}$/.test(v)),
], validate, async (req, res) => {
  const bcrypt = require('bcryptjs');
  const { fullName, login, password, department, title, phone } = req.body;
  const hash = await bcrypt.hash(password, 12);
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO users (full_name, login, password_hash, role, phone, is_active)
       VALUES ($1, $2, $3, 'teacher', $4, TRUE) RETURNING id`,
      [fullName, login.toLowerCase(), hash, phone || null]
    );
    await client.query(
      'INSERT INTO teachers (user_id, department, title) VALUES ($1, $2, $3)',
      [rows[0].id, department, title || null]
    );
    await client.query('COMMIT');
    res.status(201).json({
      id: rows[0].id, fullName, login: login.toLowerCase(), department, title: title || null
    });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Bu login allaqachon band. Boshqa login tanlang.' });
    }
    throw err;
  } finally { client.release(); }
});

// ── DELETE /api/teachers/:id ──────────────────────────────────────────────────
router.delete('/:id', authorize('dekanat', 'admin'),
  [param('id').isInt({ min: 1 }).toInt()], validate,
  async (req, res) => {
    const { rowCount } = await db.query(
      `UPDATE users SET is_active = FALSE, updated_at = NOW()
       WHERE id = $1 AND role = 'teacher'`,
      [req.params.id]
    );
    if (!rowCount) return res.status(404).json({ error: 'O\'qituvchi topilmadi' });
    res.json({ message: 'O\'qituvchi deaktivatsiya qilindi' });
  }
);

module.exports = router;
