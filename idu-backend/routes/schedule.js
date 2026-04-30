'use strict';

const express  = require('express');
const { body, param, query } = require('express-validator');

const db                    = require('../config/database');
const validate              = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// ?? GET /api/schedule ?????????????????????????????????????????????????????????
router.get(
  '/',
  [
    query('weekday').optional().isIn(['0','1','2','3','4','5','6']).toInt(),
    query('semester').optional().isInt({ min: 1, max: 8 }).toInt(),
  ],
  validate,
  async (req, res) => {
    let conditions = ['sc.is_active = TRUE'];
    const params = [];

    if (req.user.role === 'student') {
      const { rows } = await db.query(
        'SELECT faculty, year_of_study FROM students WHERE user_id = $1',
        [req.user.id]
      );
      if (rows.length) {
        params.push(rows[0].faculty, rows[0].year_of_study);
        conditions.push(`sc.faculty = $${params.length - 1}`);
        conditions.push(`sc.year_of_study = $${params.length}`);
      }
    }

    if (req.query.weekday !== undefined) {
      params.push(req.query.weekday);
      conditions.push(`sc.weekday = $${params.length}`);
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const { rows } = await db.query(
      `SELECT sc.id,sc.weekday,sc.start_time,sc.end_time,
              c.name AS course_name,c.code AS course_code,
              u.full_name AS teacher_name,sc.room,sc.faculty,sc.year_of_study
       FROM schedule sc
       JOIN courses c ON c.id=sc.course_id
       JOIN users u ON u.id=c.teacher_id ${where}
       ORDER BY sw.weekday,sc.start_time`,
      params
    );
    res.json(rows);
  }
);

router.post('/', authorize('dekanat', 'admin'), [
  body('courseId').isInt({ min: 1 }).toInt(),
  body('weekday').isInt({ min: 0, max: 6 }).toInt(),
  body('startTime').matches(/^\d{2}:\d{2}$/).withMessage('HH:MM'),
  body('endTime').matches(/^\d{2}:\d{2}$/).withMessage('HH:MM'),
  body('room').isLength({ min: 1, max: 50 }).trim(),
  body('faculty').isLength({ min: 1, max: 100 }).trim(),
  body('yearOfStudy').isInt({ min: 1, max: 6 }).toInt(),
], validate, async (req, res) => {
  const { courseId, weekday, startTime, endTime, room, faculty, yearOfStudy } = req.body;
  const { rows } = await db.query(
    `INSERT INTO schedule(course_id,weekday,start_time,end_time,room,faculty,year_of_study) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [courseId, weekday, startTime, endTime, room, faculty, yearOfStudy]);
  res.status(201).json(rows[0]);
});

router.delete('/:id', authorize('dekanat', 'admin'), [param('id').isInt({ min: 1 }).toInt()], validate, async (req, res) => {
  const { rowCount } = await db.query('UPDATE users SET is_active=FALSE WHERE id=$1', [req.params.id]);
  if (!rowCount) return res.status(404).json({ error: 'Not found' });
  res.json({ message: 'Removed' });
});

module.exports = router;
