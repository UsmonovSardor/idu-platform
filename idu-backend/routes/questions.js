'use strict';

const express  = require('express');
const { body, param, query } = require('express-validator');

const db                    = require('../config/database');
const validate              = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

const VALID_SUBJECTS = ['algo', 'ai', 'math', 'db', 'web'];
const VALID_TYPES    = ['test', 'real', 'both'];

// ?? GET /api/questions ????????????????????????????????????????????????????????
router.get(
  '/',
  [
    query('subject').optional().isIn(VALID_SUBJECTS),
    query('type').optional().isIn(VALID_TYPES),
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 200 }).toInt(),
  ],
  validate,
  async (req, res) => {
    const { subject, type } = req.query;
    const page   = req.query.page  || 1;
    const limit  = req.query.limit || 50;
    const offset = (page - 1) * limit;

    let conditions = ['q.is_active = TRUE'];
    const params = [];

    if (subject) {
      params.push(subject);
      conditions.push(`q.subject = $${params.length}`);
    }
    if (type) {
      params.push(type);
      conditions.push(`(q.type = $${params.length} OR q.type = 'both')`);
    }

    const where = 'WHERE ' + conditions.join(' AND ');
    params.push(limit, offset);

    const { rows } = await db.query(
      `SELECT q.id, q.subject, q.type, q.question_text,
              q.option_a, q.option_b, q.option_c, q.option_d,
              q.correct_option, q.explanation,
              u.full_name AS created_by_name, q.created_at
       FROM questions q
       LEFT JOIN users u ON u.id = q.created_by
       ${where}
       ORDER BY q.subject, q.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    // For student role: hide correct_option and explanation while exam is active
    // (Exam endpoint handles this; here we only return full data to dekanat/teacher)
    if (req.user.role === 'student') {
      return res.json(
        rows.map(q => ({ ...q, correct_option: undefined, explanation: undefined }))
      );
    }

    res.json(rows);
  }
);

// ?? POST /api/questions ???????????????????????????????????????????????????????
router.post(
  '/',
  authorize('dekanat', 'admin'),
  [
    body('subject').isIn(VALID_SUBJECTS).withMessage('Invalid subject'),
    body('type').isIn(VALID_TYPES).withMessage('Invalid type'),
    body('questionText').isLength({ min: 10, max: 2000 }).trim().withMessage('Question text required (10-2000 chars)'),
    body('optionA').isLength({ min: 1, max: 500 }).trim(),
    body('optionB').isLength({ min: 1, max: 500 }).trim(),
    body('optionC').isLength({ min: 1, max: 500 }).trim(),
    body('optionD').isLength({ min: 1, max: 500 }).trim(),
    body('correctOption').isIn(['A','B','C','D']).withMessage('correctOption must be A, B, C, or D'),
    body('explanation').optional().isLength({ max: 2000 }).trim(),
  ],
  validate,
  async (req, res) => {
    const { subject, type, questionText, optionA, optionB, optionC, optionD, correctOption, explanation } = req.body;

    const { rows } = await db.query(
      `INSERT INTO questions (subject, type, question_text, option_a, option_b, option_c, option_d, correct_option, explanation, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [subject, type, questionText, optionA, optionB, optionC, optionD, correctOption, explanation || null, req.user.id]
    );

    res.status(201).json(rows[0]);
  }
);

// ?? PUT /api/questions/:id ????????????????????????????????????????????????????
router.put(
  '/:id',
  authorize('dekanat', 'admin'),
  [
    param('id').isInt({ min: 1 }).toInt(),
    body('subject').optional().isIn(VALID_SUBJECTS),
    body('type').optional().isIn(VALID_TYPES),
    body('questionText').optional().isLength({ min: 10, max: 2000 }).trim(),
    body('optionA').optional().isLength({ min: 1, max: 500 }).trim(),
    body('optionB').optional().isLength({ min: 1, max: 500 }).trim(),
    body('optionC').optional().isLength({ min: 1, max: 500 }).trim(),
    body('optionD').optional().isLength({ min: 1, max: 500 }).trim(),
    body('correctOption').optional().isIn(['A','B','C','D']),
    body('explanation').optional().isLength({ max: 2000 }).trim(),
  ],
  validate,
  async (req, res) => {
    const { subject, type, questionText, optionA, optionB, optionC, optionD, correctOption, explanation } = req.body;

    const { rows, rowCount } = await db.query(
      `UPDATE questions SET
         subject       = COALESCE($1, subject),
         type          = COALESCE($2, type),
         question_text = COALESCE($3, question_text),
         option_a      = COALESCE($4, option_a),
         option_b      = COALESCE($5, option_b),
         option_c      = COALESCE($6, option_c),
         option_d      = COALESCE($7, option_d),
         correct_option = COALESCE($8, correct_option),
         explanation   = COALESCE($9, explanation),
         updated_at    = NOW()
       WHERE id = $10 AND is_active = TRUE
       RETURNING *`,
      [subject||null, type||null, questionText||null, optionA||null, optionB||null, optionC||null, optionD||null, correctOption||null, explanation||null, req.params.id]
    );

    if (!rowCount) return res.status(404).json({ error: 'Question not found' });
    res.json(rows[0]);
  }
);

// ?? DELETE /api/questions/:id ?????????????????????????????????????????????????
router.delete(
  '/:id',
  authorize('dekanat', 'admin'),
  [param('id').isInt({ min: 1 }).toInt()],
  validate,
  async (req, res) => {
    // Soft delete
    const { rowCount } = await db.query(
      'UPDATE questions SET is_active = FALSE, updated_at = NOW() WHERE id = $1',
      [req.params.id]
    );
    if (!rowCount) return res.status(404).json({ error: 'Question not found' });
    res.json({ message: 'Question deleted' });
  }
);

// ?? POST /api/questions/bulk ??????????????????????????????????????????????????
// Import multiple questions at once
router.post(
  '/bulk',
  authorize('dekanat', 'admin'),
  [
    body('questions').isArray({ min: 1, max: 100 }).withMessage('Provide 1-100 questions'),
    body('questions.*.subject').isIn(VALID_SUBJECTS),
    body('questions.*.type').isIn(VALID_TYPES),
    body('questions.*.questionText').isLength({ min: 10, max: 2000 }).trim(),
    body('questions.*.optionA').isLength({ min: 1, max: 500 }).trim(),
    body('questions.*.optionB').isLength({ min: 1, max: 500 }).trim(),
    body('questions.*.optionC').isLength({ min: 1, max: 500 }).trim(),
    body('questions.*.optionD').isLength({ min: 1, max: 500 }).trim(),
    body('questions.*.correctOption').isIn(['A','B','C','D']),
  ],
  validate,
  async (req, res) => {
    const { questions } = req.body;
    const client = await db.getClient();

    try {
      await client.query('BEGIN');
      const inserted = [];
      for (const q of questions) {
        const { rows } = await client.query(
          `INSERT INTO questions (subject, type, question_text, option_a, option_b, option_c, option_d, correct_option, explanation, created_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
          [q.subject, q.type, q.questionText, q.optionA, q.optionB, q.optionC, q.optionD, q.correctOption, q.explanation||null, req.user.id]
        );
        inserted.push(rows[0].id);
      }
      await client.query('COMMIT');
      res.status(201).json({ inserted: inserted.length, ids: inserted });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
);

module.exports = router;
