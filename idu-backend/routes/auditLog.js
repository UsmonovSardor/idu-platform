'use strict';
// IDU — Audit log viewer (dekanat/admin only)

const express = require('express');
const db = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);
router.use(authorize('dekanat', 'admin'));

// ── GET /api/audit-log ────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  const {
    user_id, action, entity, status, from, to,
    limit = 100, page = 1
  } = req.query;

  const cond = ['1=1'];
  const params = [];

  if (user_id) { params.push(user_id); cond.push(`user_id=$${params.length}`); }
  if (action)  { params.push(action);  cond.push(`action=$${params.length}`); }
  if (entity)  { params.push(entity);  cond.push(`entity=$${params.length}`); }
  if (status)  { params.push(status);  cond.push(`status=$${params.length}`); }
  if (from)    { params.push(from);    cond.push(`created_at >= $${params.length}`); }
  if (to)      { params.push(to);      cond.push(`created_at <= $${params.length}`); }

  const lim = Math.min(parseInt(limit, 10) || 100, 500);
  const offset = (Math.max(parseInt(page, 10) || 1, 1) - 1) * lim;

  try {
    const { rows: countRows } = await db.query(
      `SELECT COUNT(*)::int AS n FROM audit_log WHERE ${cond.join(' AND ')}`,
      params
    );
    const { rows } = await db.query(
      `SELECT id, user_id, user_login, user_role, action, entity, entity_id,
              ip_address, details, status, created_at
       FROM audit_log
       WHERE ${cond.join(' AND ')}
       ORDER BY created_at DESC
       LIMIT $${params.length+1} OFFSET $${params.length+2}`,
      [...params, lim, offset]
    );
    res.json({ data: rows, total: countRows[0].n, page: parseInt(page, 10), limit: lim });
  } catch(e) {
    console.error('audit-log:', e.message);
    res.status(500).json({ error: 'Audit log unavailable' });
  }
});

// ── GET /api/audit-log/stats ──────────────────────────────────────────────────
// Aggregated counts per action for last 7 days
router.get('/stats', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT action,
             COUNT(*) AS total,
             SUM(CASE WHEN status='success' THEN 1 ELSE 0 END) AS success_count,
             SUM(CASE WHEN status='failed'  THEN 1 ELSE 0 END) AS failed_count,
             SUM(CASE WHEN status='blocked' THEN 1 ELSE 0 END) AS blocked_count
      FROM audit_log
      WHERE created_at > NOW() - INTERVAL '7 days'
      GROUP BY action
      ORDER BY total DESC
    `);
    res.json(rows);
  } catch(e) {
    res.json([]);
  }
});

// ── GET /api/audit-log/lockouts ───────────────────────────────────────────────
// Currently locked accounts (for admin review)
router.get('/lockouts', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT login, locked_until, reason, created_at
      FROM account_lockouts
      WHERE locked_until > NOW()
      ORDER BY created_at DESC
    `);
    res.json(rows);
  } catch(e) {
    res.json([]);
  }
});

// ── DELETE /api/audit-log/lockouts/:login ─────────────────────────────────────
// Admin unlocks an account manually
router.delete('/lockouts/:login', authorize('admin'), async (req, res) => {
  try {
    await db.query('DELETE FROM account_lockouts WHERE login=$1', [req.params.login]);
    await db.query('DELETE FROM failed_logins   WHERE login=$1', [req.params.login]);
    res.json({ message: 'Hisob qulfdan chiqarildi' });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
