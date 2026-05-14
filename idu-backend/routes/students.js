'use strict';

const express  = require('express');
const { body, param, query } = require('express-validator');
const multer   = require('multer');
const path     = require('path');
const fs       = require('fs');

const db                    = require('../config/database');
const validate              = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// Multer config for avatar uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(process.env.UPLOAD_DIR || './uploads', 'avatars');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `avatar_${req.user.id}_${Date.now()}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: (parseInt(process.env.MAX_FILE_SIZE_MB || '5', 10)) * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    allowed.includes(ext) ? cb(null, true) : cb(new Error('Only image files allowed'));
  },
});

// All routes require authentication
router.use(authenticate);

// ?? GET /api/students ?????????????????????????????????????????????????????????
// Dekanat/admin/teacher: list students with optional filters
router.get(
  '/',
  authorize('dekanat', 'admin', 'teacher'),
  [
    query('search').optional().isString().trim(),
    query('faculty').optional().isString().trim(),
    query('group').optional().isString().trim(),
    query('year').optional().isInt({ min: 1, max: 6 }),
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  ],
  validate,
  async (req, res) => {
    const { search, faculty, group, year } = req.query;
    const page  = req.query.page  || 1;
    const limit = req.query.limit || 50;
    const offset = (page - 1) * limit;

    let conditions = ['u.is_active = TRUE', "u.role = 'student'"];
    const params = [];

    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(u.full_name ILIKE $${params.length} OR s.student_id_number ILIKE $${params.length})`);
    }
    if (faculty) {
      params.push(faculty);
      conditions.push(`s.faculty = $${params.length}`);
    }
    if (group) {
      params.push(group);
      conditions.push(`s.group_name = $${params.length}`);
    }
    if (year) {
      params.push(year);
      conditions.push(`s.year_of_study = $${params.length}`);
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    params.push(limit, offset);

    const countResult = await db.query(
      `SELECT COUNT(*) FROM users u LEFT JOIN students s ON s.user_id = u.id ${where}`,
      params.slice(0, params.length - 2)
    );

    const { rows } = await db.query(
      `SELECT u.id, u.full_name, u.phone, u.avatar_url,
              s.student_id_number, s.faculty, s.department, s.year_of_study, s.gpa,
              s.group_name
       FROM users u
       LEFT JOIN students s ON s.user_id = u.id
       ${where}
       ORDER BY u.full_name
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({
      data:  rows,
      total: parseInt(countResult.rows[0].count, 10),
      page,
      limit,
    });
  }
);

// ?? GET /api/students/:id ?????????????????????????????????????????????????????
router.get(
  '/:id',
  [param('id').isInt({ min: 1 }).toInt()],
  validate,
  async (req, res) => {
    // Students can only view their own profile; dekanat can view any
    if (req.user.role === 'student' && req.user.id !== req.params.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { rows } = await db.query(
      `SELECT u.id, u.full_name, u.phone, u.avatar_url, u.created_at,
              s.student_id_number, s.faculty, s.department, s.year_of_study, s.gpa,
              s.enrollment_date, s.graduation_date
       FROM users u
       LEFT JOIN students s ON s.user_id = u.id
       WHERE u.id = $1 AND u.is_active = TRUE`,
      [req.params.id]
    );

    if (!rows.length) return res.status(404).json({ error: 'Student not found' });
    res.json(rows[0]);
  }
);

// ?? PUT /api/students/:id ?????????????????????????????????????????????????????
router.put(
  '/:id',
  [
    param('id').isInt({ min: 1 }).toInt(),
    body('phone').optional().isMobilePhone().withMessage('Invalid phone number'),
    body('full_name').optional().isLength({ min: 2, max: 100 }).trim(),
  ],
  validate,
  async (req, res) => {
    if (req.user.role === 'student' && req.user.id !== req.params.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { full_name, phone } = req.body;
    await db.query(
      `UPDATE users SET
         full_name  = COALESCE($1, full_name),
         phone      = COALESCE($2, phone),
         updated_at = NOW()
       WHERE id = $3`,
      [full_name || null, phone || null, req.params.id]
    );

    res.json({ message: 'Profile updated' });
  }
);

// ?? POST /api/students/:id/avatar ?????????????????????????????????????????????
router.post(
  '/:id/avatar',
  [param('id').isInt({ min: 1 }).toInt()],
  validate,
  (req, res, next) => {
    if (req.user.role === 'student' && req.user.id !== req.params.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    next();
  },
  upload.single('avatar'),
  async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const avatarUrl = `/uploads/avatars/${req.file.filename}`;
    await db.query(
      'UPDATE users SET avatar_url = $1, updated_at = NOW() WHERE id = $2',
      [avatarUrl, req.params.id]
    );

    res.json({ avatarUrl });
  }
);

// ?? GET /api/students/:id/grades ??????????????????????????????????????????????
router.get(
  '/:id/grades',
  [param('id').isInt({ min: 1 }).toInt()],
  validate,
  async (req, res) => {
    if (req.user.role === 'student' && req.user.id !== req.params.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { rows } = await db.query(
      `SELECT g.id, c.name AS course_name, c.code AS course_code,
              g.jn, g.on_score, g.yn, g.mi,
              ROUND(g.jn + g.on_score + g.yn + g.mi) AS total,
              g.letter_grade, g.semester, g.academic_year, g.created_at
       FROM grades g
       JOIN courses c ON c.id = g.course_id
       WHERE g.student_id = $1
       ORDER BY g.academic_year DESC, g.semester DESC, c.name`,
      [req.params.id]
    );

    res.json(rows);
  }
);

// ?? POST /api/students/attendance ????????????????????????????????????????????
// Teacher/dekanat: save attendance records for a group
router.post(
  '/attendance',
  authorize('teacher', 'dekanat', 'admin'),
  [
    body('date').isISO8601().toDate(),
    body('records').isArray({ min: 1 }),
    body('records.*.studentId').notEmpty(),
    body('records.*.present').isBoolean(),
  ],
  validate,
  async (req, res) => {
    const { date, group, records } = req.body;

    // Ensure attendance table exists (soft create)
    await db.query(`
      CREATE TABLE IF NOT EXISTS attendance (
        id           SERIAL PRIMARY KEY,
        student_id   INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        teacher_id   INT NOT NULL REFERENCES users(id),
        date         DATE NOT NULL,
        present      BOOLEAN NOT NULL DEFAULT TRUE,
        excused      BOOLEAN NOT NULL DEFAULT FALSE,
        note         TEXT,
        group_name   VARCHAR(50),
        created_at   TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(student_id, date)
      )
    `).catch(() => {});

    const saved = [];
    for (const rec of records) {
      try {
        const { rows } = await db.query(
          `INSERT INTO attendance (student_id, teacher_id, date, present, excused, note, group_name)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (student_id, date)
           DO UPDATE SET present = $4, excused = $5, note = $6, teacher_id = $2
           RETURNING id`,
          [rec.studentId, req.user.id, date, rec.present, !!rec.excused, rec.note || null, group || null]
        );
        saved.push(rows[0]?.id);
      } catch(e) { /* skip individual failures */ }
    }

    res.json({ saved: saved.length, total: records.length });
  }
);

module.exports = router;
