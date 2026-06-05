'use strict';

const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { cache } = require('../middleware/cache');

const router = express.Router();
router.use(authenticate);

const BROADCAST_ROLES = ['dekanat', 'admin', 'teacher', 'rector'];

// Resolve the requesting student's faculty + group (null for staff)
async function getScopeCtx(userId) {
  try {
    const { rows } = await db.query(
      'SELECT faculty, group_name FROM students WHERE user_id = $1', [userId]
    );
    if (rows.length) return { faculty: rows[0].faculty, group: rows[0].group_name };
  } catch (e) { /* ignore */ }
  return { faculty: null, group: null };
}

// ── GET /api/events?from=YYYY-MM-DD&to=YYYY-MM-DD ────────────────────────────
router.get('/', cache(120), async (req, res) => {
  const uid = req.user.id;
  const from = String(req.query.from || '').slice(0, 10) || '1970-01-01';
  const to   = String(req.query.to   || '').slice(0, 10) || '2999-12-31';
  const ctx = await getScopeCtx(uid);
  try {
    const { rows } = await db.query(
      `SELECT e.id, e.title, e.description, e.event_date, e.start_time, e.type,
              e.color, e.scope, e.scope_value, e.created_by, u.full_name AS creator_name
         FROM events e
         LEFT JOIN users u ON u.id = e.created_by
        WHERE e.event_date BETWEEN $1 AND $2
          AND (
            e.scope = 'all'
            OR e.created_by = $3
            OR (e.scope = 'faculty' AND e.scope_value = $4)
            OR (e.scope = 'group'   AND e.scope_value = $5)
          )
        ORDER BY e.event_date ASC, e.start_time ASC NULLS LAST`,
      [from, to, uid, ctx.faculty, ctx.group]
    );
    // normalize date to YYYY-MM-DD string
    res.json(rows.map(r => ({
      ...r,
      event_date: (r.event_date instanceof Date) ? r.event_date.toISOString().slice(0, 10) : String(r.event_date).slice(0, 10),
      mine: r.created_by === uid,
    })));
  } catch (e) {
    console.error('events GET:', e.message);
    res.status(500).json({ error: 'events_failed' });
  }
});

// ── POST /api/events ─────────────────────────────────────────────────────────
router.post('/', [
  body('title').isString().trim().isLength({ min: 1, max: 150 }),
  body('event_date').matches(/^\d{4}-\d{2}-\d{2}$/),
  body('description').optional({ nullable: true }).isString().isLength({ max: 1000 }),
  body('start_time').optional({ nullable: true }).matches(/^\d{2}:\d{2}(:\d{2})?$/),
  body('type').optional().isIn(['event', 'party', 'meeting', 'holiday', 'deadline', 'personal']),
  body('color').optional().matches(/^#[0-9a-fA-F]{3,8}$/),
  body('scope').optional().isIn(['personal', 'all', 'faculty', 'group']),
  body('scope_value').optional({ nullable: true }).isString().isLength({ max: 100 }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ error: 'validation', details: errors.array() });

  let { title, description, event_date, start_time, type, color, scope, scope_value } = req.body;
  scope = scope || 'personal';
  type  = type  || (scope === 'personal' ? 'personal' : 'event');
  color = color || (scope === 'personal' ? '#8b5cf6' : '#2563eb');

  // Only staff may broadcast beyond personal scope
  if (scope !== 'personal' && !BROADCAST_ROLES.includes(req.user.role)) {
    return res.status(403).json({ error: 'Faqat dekanat barcha uchun event qo\'sha oladi' });
  }
  if (scope === 'personal') scope_value = null;

  try {
    const { rows: [ev] } = await db.query(
      `INSERT INTO events (title, description, event_date, start_time, type, color, scope, scope_value, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [title.trim(), description || null, event_date, start_time || null, type, color, scope, scope_value || null, req.user.id]
    );
    res.status(201).json({
      ...ev,
      event_date: ev.event_date instanceof Date ? ev.event_date.toISOString().slice(0, 10) : String(ev.event_date).slice(0, 10),
      mine: true,
    });
  } catch (e) {
    console.error('events POST:', e.message);
    res.status(500).json({ error: 'create_failed' });
  }
});

// ── DELETE /api/events/:id ───────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ error: 'bad_id' });
  try {
    const { rows } = await db.query('SELECT created_by FROM events WHERE id=$1', [id]);
    if (!rows.length) return res.status(404).json({ error: 'not_found' });
    const isOwner = rows[0].created_by === req.user.id;
    const isStaff = ['dekanat', 'admin', 'rector'].includes(req.user.role);
    if (!isOwner && !isStaff) return res.status(403).json({ error: 'forbidden' });
    await db.query('DELETE FROM events WHERE id=$1', [id]);
    res.json({ ok: true });
  } catch (e) {
    console.error('events DELETE:', e.message);
    res.status(500).json({ error: 'delete_failed' });
  }
});

module.exports = router;
