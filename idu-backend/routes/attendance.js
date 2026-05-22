'use strict';

const express = require('express');
const crypto  = require('crypto');
const db      = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// Generate a short human-readable session code (e.g. "AB3X9K")
function genCode() {
  return crypto.randomBytes(4).toString('hex').toUpperCase().slice(0, 6);
}

// Generate a long secure QR token
function genToken() {
  return crypto.randomBytes(32).toString('hex');
}

// ── POST /api/attendance/session ─────────────────────────────────────────────
// Teacher opens an attendance session → returns QR token + short code
router.post('/session', authorize('teacher', 'dekanat', 'admin'), async (req, res) => {
  const { subject, group, room, durationMinutes = 15 } = req.body;
  if (!subject || !group) return res.status(400).json({ error: 'subject va group kerak' });

  const code     = genCode();
  const token    = genToken();
  const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000);

  const { rows } = await db.query(
    `INSERT INTO attendance_sessions
       (teacher_id, subject, group_name, room, session_code, qr_token, expires_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING id, session_code, qr_token, expires_at, created_at`,
    [req.user.id, subject, group, room || null, code, token, expiresAt]
  );

  res.status(201).json(rows[0]);
});

// ── GET /api/attendance/session/:id ─────────────────────────────────────────
// Teacher polls who has checked in so far
router.get('/session/:id', authorize('teacher', 'dekanat', 'admin'), async (req, res) => {
  const sessionId = parseInt(req.params.id, 10);

  const { rows: [session] } = await db.query(
    `SELECT s.*, u.full_name AS teacher_name
     FROM attendance_sessions s
     JOIN users u ON u.id = s.teacher_id
     WHERE s.id = $1`,
    [sessionId]
  );
  if (!session) return res.status(404).json({ error: 'Sessiya topilmadi' });

  const { rows: records } = await db.query(
    `SELECT r.student_id, r.marked_at, r.method, u.full_name, u.login AS email
     FROM attendance_records r
     JOIN users u ON u.id = r.student_id
     WHERE r.session_id = $1
     ORDER BY r.marked_at`,
    [sessionId]
  );

  const totalStudents = await db.query(
    `SELECT COUNT(*) FROM users u
     LEFT JOIN students st ON st.user_id = u.id
     WHERE u.role = 'student'
       AND ($1 = '' OR st.group_name = $1)`,
    [session.group_name || '']
  );

  res.json({
    session,
    records,
    presentCount: records.length,
    totalCount: parseInt(totalStudents.rows[0].count, 10)
  });
});

// ── POST /api/attendance/mark ────────────────────────────────────────────────
// Student marks attendance using QR token or short code
router.post('/mark', authorize('student'), async (req, res) => {
  const { token, code } = req.body;
  if (!token && !code) return res.status(400).json({ error: 'token yoki code kerak' });

  const { rows: [session] } = await db.query(
    token
      ? `SELECT * FROM attendance_sessions WHERE qr_token = $1`
      : `SELECT * FROM attendance_sessions WHERE session_code = $1`,
    [token || code.toUpperCase()]
  );

  if (!session) return res.status(404).json({ error: 'Noto\'g\'ri kod yoki QR' });
  if (session.closed_at) return res.status(410).json({ error: 'Davomat sessiyasi yopilgan' });
  if (new Date(session.expires_at) < new Date()) {
    return res.status(410).json({ error: 'QR kodning vaqti tugagan' });
  }

  try {
    await db.query(
      `INSERT INTO attendance_records (session_id, student_id, method)
       VALUES ($1, $2, $3)`,
      [session.id, req.user.id, token ? 'qr' : 'code']
    );
  } catch (e) {
    if (e.code === '23505') {
      return res.status(409).json({ error: 'Siz allaqachon davomat qo\'ydingiz' });
    }
    throw e;
  }

  res.json({
    message: 'Davomat muvaffaqiyatli belgilandi',
    subject: session.subject,
    group: session.group_name,
    markedAt: new Date().toISOString()
  });
});

// ── PATCH /api/attendance/session/:id/close ──────────────────────────────────
// Teacher manually closes a session
router.patch('/session/:id/close', authorize('teacher', 'dekanat', 'admin'), async (req, res) => {
  const { rowCount } = await db.query(
    `UPDATE attendance_sessions SET closed_at = NOW()
     WHERE id = $1 AND teacher_id = $2 AND closed_at IS NULL`,
    [req.params.id, req.user.id]
  );
  if (!rowCount) return res.status(404).json({ error: 'Sessiya topilmadi yoki allaqachon yopilgan' });
  res.json({ message: 'Sessiya yopildi' });
});

// ── GET /api/attendance/my ───────────────────────────────────────────────────
// Student: see own attendance history
router.get('/my', authorize('student'), async (req, res) => {
  const { rows } = await db.query(
    `SELECT r.marked_at, r.method, s.subject, s.group_name, s.created_at AS session_date
     FROM attendance_records r
     JOIN attendance_sessions s ON s.id = r.session_id
     WHERE r.student_id = $1
     ORDER BY r.marked_at DESC
     LIMIT 100`,
    [req.user.id]
  );
  res.json(rows);
});

// ── GET /api/attendance/report ───────────────────────────────────────────────
// Dekanat: full report with filters
router.get('/report', authorize('dekanat', 'admin'), async (req, res) => {
  const { group, subject, from, to } = req.query;

  let cond = ['1=1'];
  const params = [];

  if (group)   { params.push(group);   cond.push(`s.group_name = $${params.length}`); }
  if (subject) { params.push(subject); cond.push(`s.subject ILIKE $${params.length}`); }
  if (from)    { params.push(from);    cond.push(`s.created_at >= $${params.length}`); }
  if (to)      { params.push(to);      cond.push(`s.created_at <= $${params.length}`); }

  const { rows } = await db.query(
    `SELECT s.id, s.subject, s.group_name, s.created_at, s.expires_at, s.closed_at,
            u.full_name AS teacher_name,
            COUNT(r.id) AS present_count
     FROM attendance_sessions s
     JOIN users u ON u.id = s.teacher_id
     LEFT JOIN attendance_records r ON r.session_id = s.id
     WHERE ${cond.join(' AND ')}
     GROUP BY s.id, u.full_name
     ORDER BY s.created_at DESC
     LIMIT 200`,
    params
  );
  res.json(rows);
});

// ── GET /api/attendance/stats ────────────────────────────────────────────────
// KPI: overall attendance rate per group/subject
router.get('/stats', authorize('teacher', 'dekanat', 'admin'), async (req, res) => {
  const { rows } = await db.query(
    `SELECT s.group_name, s.subject,
            COUNT(DISTINCT s.id)  AS sessions_total,
            COUNT(r.id)           AS total_marks,
            ROUND(
              100.0 * COUNT(r.id) /
              NULLIF(COUNT(DISTINCT s.id) * NULLIF(
                (SELECT COUNT(*) FROM students st2
                 JOIN users u2 ON u2.id = st2.user_id
                 WHERE u2.role='student' AND st2.group_name = s.group_name), 0), 0)
            , 1) AS attendance_pct
     FROM attendance_sessions s
     LEFT JOIN attendance_records r ON r.session_id = s.id
     GROUP BY s.group_name, s.subject
     ORDER BY s.group_name, s.subject`
  );
  res.json(rows);
});

module.exports = router;
