'use strict';

const express = require('express');
const { body } = require('express-validator');
const db       = require('../config/database');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// ── GET /api/subjects — all active subjects (any authenticated user) ──────────
router.get('/', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT id, code, label, icon, sort_order
       FROM subjects WHERE is_active = TRUE
       ORDER BY sort_order, label`
    );
    res.json(rows);
  } catch (err) {
    // subjects table may not exist yet (migration pending) — return empty array
    // so the frontend uses its fallback list instead of crashing
    res.json([]);
  }
});

// ── POST /api/subjects — add new subject ──────────────────────────────────────
router.post('/',
  authorize('dekanat', 'admin'),
  [
    body('code').trim().notEmpty().matches(/^[a-z0-9_]{1,50}$/)
      .withMessage('Code faqat kichik harf, raqam va _ dan iborat bo\'lsin'),
    body('label').trim().notEmpty().isLength({ max: 100 })
      .withMessage('Label 1-100 belgi bo\'lishi kerak'),
    body('icon').optional().trim().isLength({ max: 10 }),
    body('sort_order').optional().isInt({ min: 0 }).toInt(),
  ],
  validate,
  async (req, res) => {
    const { code, label, icon = '📚', sort_order = 99 } = req.body;
    const { rows } = await db.query(
      `INSERT INTO subjects (code, label, icon, sort_order)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (code) DO UPDATE
         SET label = EXCLUDED.label, icon = EXCLUDED.icon,
             sort_order = EXCLUDED.sort_order, is_active = TRUE
       RETURNING id, code, label, icon, sort_order`,
      [code.toLowerCase(), label.trim(), icon, sort_order]
    );
    res.status(201).json(rows[0]);
  }
);

// ── PUT /api/subjects/:id — edit subject ──────────────────────────────────────
router.put('/:id',
  authorize('dekanat', 'admin'),
  [
    body('label').optional().trim().isLength({ min: 1, max: 100 }),
    body('icon').optional().trim().isLength({ max: 10 }),
    body('sort_order').optional().isInt({ min: 0 }).toInt(),
  ],
  validate,
  async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const { label, icon, sort_order } = req.body;
    const sets = [], params = [];
    if (label !== undefined) { params.push(label.trim()); sets.push(`label = $${params.length}`); }
    if (icon  !== undefined) { params.push(icon);         sets.push(`icon  = $${params.length}`); }
    if (sort_order !== undefined) { params.push(sort_order); sets.push(`sort_order = $${params.length}`); }
    if (!sets.length) return res.status(400).json({ error: 'O\'zgartirish yo\'q' });
    params.push(id);
    const { rows } = await db.query(
      `UPDATE subjects SET ${sets.join(', ')} WHERE id = $${params.length}
       RETURNING id, code, label, icon, sort_order`,
      params
    );
    if (!rows.length) return res.status(404).json({ error: 'Fan topilmadi' });
    res.json(rows[0]);
  }
);

// ── DELETE /api/subjects/:id — soft delete (is_active=FALSE) ─────────────────
router.delete('/:id',
  authorize('dekanat', 'admin'),
  async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const { rows } = await db.query(
      `UPDATE subjects SET is_active = FALSE WHERE id = $1 RETURNING id, code`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Fan topilmadi' });
    res.json({ message: 'Fan o\'chirildi', id: rows[0].id });
  }
);

module.exports = router;
