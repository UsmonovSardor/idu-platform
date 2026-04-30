'use strict';

const express  = require('express');
const { body, param, query } = require('express-validator');

const db                    = require('../config/database');
const validate              = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// Letter grade calculator matching IDU 100-ball system
function calcLetterGrade(total) {
  if (total >= 86) return 'A';
  if (total >= 71) return 'B';
  if (total >= 56) return 'C';
  if (total >= 41) return 'D';
  return 'F';
}

// ?? GET /api/grades ???????????????????????????????????????????????????????????
// Dekanat: list all grades with filters
router.get(
  '/',
  authorize('dekanat', 'admin', 'teacher'),
  [
    query('studentId').optional().isInt({ min: 1 }).toInt(),
    query('courseId').optional().isInt({ min: 1 }).toInt(),
    query('semester').optional().isIn(['1','2','3','4','5','6','7','8']),
    query('academicYear').optional().isString().trim(),
  ],
  validate,
  async (req, res) => {
    const { studentId, courseId, semester, academicYear } = req.query;

    let conditions = [];
    const params = [];

    if (studentId) {
      params.push(studentId);
      conditions.push(`g.student_id = $${params.length}`);
    }
    if (courseId) {
      params.push(courseId);
      conditions.push(`g.course_id = $${params.length}`);
    }
    if (semester) {
      params.push(semester);
      conditions.push(`g.semester = $${params.length}`);
    }
    if (academicYear) {
      params.push(academicYear);
      conditions.push(`g.academic_year = $${params.length}`);
    }

    // Teachers can only see their own courses
    if (req.user.role === 'teacher') {
      params.push(req.user.id);
      conditions.push(`c.teacher_id = $${params.length}`);
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const { rows } = await db.query(
      `SELECT g.id, u.full_name AS student_name, s.student_id_number,
              c.name AS course_name, c.code AS course_code,
              g.jn, g.on_score, g.yn, g.mi,
              ROUND(g.jn + g.on_score + g.yn + g.mi) AS total,
              g.letter_grade, g.semester, g.academic_year
       FROM grades g
       JOIN users u    ON u.id = g.student_id
       JOI students s ON s.user_id = g.student_id
       JOIN courses c  ON c.id = g.course_id
       ${where}
       ORDER BY u.full_name, g.academic_year DESC, g.semester DESC`,
      params
    );

    res.json(rows);
  }
);

// ?? POST /api/grades ?????????????????????????????????????????????????????????
// Teacher/dekanat: create or update a grade
router.post(
  '/',
  authorize('teacher', 'dekanat', 'admin'),
  [
    body('studentId').isInt({ min: 1 }).toInt(),
    body('courseId').isInt({ min: 1 }).toInt(),
    body('semester').isInt({ min: 1, max: 8 }).toInt(),
    body('academicYear').matches(/^\d{4}-\d{4}$/).withMessage('Format: 2024-2025'),
    body('jn').isFloat({ min: 0, max: 30 }).withMessage('JN must be 0-30'),
    body('on_score').isFloat({ min: 0, max: 20 }).withMessage('ON must be 0-20'),
    body('yn').isFloat({ min: 0, max: 30 }).withMessage('YN must be 0-30'),
    body('mi').isFloat({ min: 0, max: 20 }).withMessage('MI must be 0-20'),
  ],
  validate,
  async (req, res) => {
    const { studentId, courseId, semester, academicYear, jn, on_score, yn, mi } = req.body;

    const total       = jn + on_score + yn + mi;
    const letterGrade = calcLetterGrade(total);

    // Teachers may only grade their own courses
    if (req.user.role === 'teacher') {
      const { rows } = await db.query(
        'SELECT id FROM courses WHERE id = $1 AND teacher_id = $2',
        [courseId, req.user.id]
      );
      if (!rows.length) {
        return res.status(403).json({ error: 'You are not the teacher of this course' });
      }
    }

    const { rows } = await db.query(
      `INSERT INTO grades (student_id, course_id, semester, academic_year, jn, on_score, yn, mi, letter_grade, graded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (student_id, course_id, semester, academic_year)
       DO UPDATE SET jn = $5, on_score = $6, yn = $7, mi = $8,
                     letter_grade = $9, graded_by = $10, updated_at = NOW()
       RETURNING *`,
      [studentId, courseId, semester, academicYear, jn, on_score, yn, mi, letterGrade, req.user.id]
    );

    res.status(201).json({ ...rows[0], total, letterGrade });
  }
);

// ?? DELETE /api/grades/:id ????????????????????????????????????????????????????
router.delete(
  '/:id',
  authorize('dekanat', 'admin'),
  [param('id').isInt({ min: 1 }).toInt()],
  validate,
  async (req, res) => {
    const { rowCount } = await db.query(
      'DELETE FROM grades WHERE id = $1',
      [req.params.id]
    );
    if (!rowCount) return res.status(404).json({ error: 'Grade not found' });
    res.json({ message: 'Grade deleted' });
  }
);

module.exports = router;
