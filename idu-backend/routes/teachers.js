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
    `SELECT u.id, u.full_name, u.email, u.phone, u.avatar_url,
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

router.post('/', authorize('dekanat', 'admin'), [
  body('fullName').isLength({ min: 2, max: 100 }).trim(),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }),
  body('department').isLength({ min: 2, max: 100 }).trim(),
  body('title').optional().isLength({ max: 100 }).trim(),
], validate, async (req, res) => {
  const bcrypt = require('bcryptjs');
  const { fullName, email, password, department, title } = req.body;
  const hash = await bcrypt.hash(password, 12);
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO users(full_name,email,password_hash,role) VALUES($1,$2,$3,'teacher') RETURNING id`,
      [fullName, email, hash]);
    await client.query(
      'INSERT INTO teachers(user_id,department,title) VALUES($1,$2,$3)',
      [rows[0].id, department, title || null]);
    await client.query('COMMIT');
    res.status(201).json({ id: rows[0].id, fullName, email, department });
  } catch (err) {
    await client.query('ROLLBACK'); throw err;
  } finally { client.release(); }
});

module.exports = router;
