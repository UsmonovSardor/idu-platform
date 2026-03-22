'use strict';

const express  = require('express');
const { body, param, query } = require('express-validator');

const db                    = require('../config/database');
const validate              = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

const VALID_TYPES    = ['cert', 'job', 'etiraz', 'other'];
const VALID_STATULES = ['pending', 'reviewing', 'approved', 'rejected'];

// ── GET /api/applications ─────────────────────────────────────────────────────
router.get(
  '/',
  [
    query('type').optional().isIn(VALID_TYPES),
    query('status').optional().isIn(VALID_STATUSES),
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  ],
  validate,
  async (req, res) => {
    const { type, status } = req.query;
    const page  = req.query.page  || 1;
    const limit = req.query.limit || 20;
    const offset = (page - 1) * limit;

    let conditions = [];
    const params = [];

    // Students only see their own applications
    if (req.user.role === 'student') {
      params.push(req.user.id);
      conditions.push(`a.student_id = $${params.length}`);
    }

    if (type) {
      params.push(type);
      conditions.push(`a.type = $${params.length}`);
    }
    if (status) {
      params.push(status);
      conditions.push(`a.status = $${params.length}`);
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    params.push(limit, offset);

    const { rows } = await db.query(
      `SELECT a.id, u.full_name AS student_name, s.student_id_number,
              a.type, a.detail, a.company, a.note, a.status,
              a.dekanat_comment, a.created_at, a.updated_at
       FROM applications a
       JOIN users u    ON u.id = a.student_id
       JOIN students s ON s.user_id = a.student_id
       ${where}
       ORDER BY a.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json(rows);
  }
);

// ── POST /api/applications ────────────────────────────────────────────────────�router.post(
  '/',
  [
    body('type').isIn(VALID_TYPES).withMessage('Invalid application type'),
    body('detail').isLength({ min: 5, max: 1000 }).trim().withMessage('Detail required (5-1000 chars)'),
    body('company').optional().isLength({ max: 200 }).trim(),
    body('note').optional().isLength({ max: 2000 }).trim(),
  ],
  validate,
  async (req, res) => {
    const { type, detail, company, note } = req.body;

    const { rows } = await db.query(
      `INSERT INTO applications (student_id, type, detail, company, note)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        req.user.id,
        type,
        detail,
        company || null,
        note || null,
      ]
    );

    res.status(201).json(rows[0]);
  }
);

// ── PATCH /api/applications/:id/status ───────────────────────────────────────
router.patch(
  '/:id/status',
  authorize('dekanat', 'admin'),
  [
    param('id').isInt({ min: 1 }).toInt(),
    body('status').isIn(VALID_STATUSEL��X��BdekanatComment').optional().isLength({ max: 1000 }).trim(),
  ],
  validate,
  async (req, res) => {
    const { status, dekanatComment } = req.body;

    const { rows, rowCount } = await db.query(
      `UPDATE applications
       SET status = $1, dekanat_comment = COALESCE($2, dekanat_comment),
           reviewed_by = $3, updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [status, dekanatComment || null, req.user.id, req.params.id]
    );

    if (!rowCount) return res.status(404).json({ error: 'Application not found' });
    res.json(rows[0]);
  }
);

module.exports = router;
