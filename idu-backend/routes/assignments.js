'use strict';
const express = require('express');
const router  = express.Router();
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

// Middleware: faqat teacher/dekanat/admin
function teacherOnly(req, res, next) {
  const role = req.user?.role;
  if (!['teacher','dekanat','admin'].includes(role)) return res.status(403).json({ error: 'Ruxsat yoq' });
  next();
}

// GET /api/assignments — talaba o'z guruhidagi vazifalarni ko'radi
router.get('/', async (req, res) => {
  const userId = req.user?.id;
  const role   = req.user?.role;
  let rows;
  if (role === 'student') {
    const st = await pool.query('SELECT group_name FROM students WHERE user_id=$1', [userId]);
    const grp = st.rows[0]?.group_name;
    const r = await pool.query(
      `SELECT a.*, u.full_name AS teacher_name
       FROM assignments a
       JOIN users u ON u.id = a.teacher_id
       WHERE a.group_name=$1 OR a.group_name='ALL'
       ORDER BY a.deadline ASC`, [grp]);
    rows = r.rows;
  } else {
    const r = await pool.query(
      `SELECT a.*, u.full_name AS teacher_name,
              (SELECT COUNT(*) FROM submissions s WHERE s.assignment_id=a.id) AS submission_count
       FROM assignments a JOIN users u ON u.id=a.teacher_id
       ORDER BY a.created_at DESC`);
    rows = r.rows;
  }
  res.json({ assignments: rows });
});

// POST /api/assignments — ustoz vazifa yaratadi
router.post('/', teacherOnly, async (req, res) => {
  const { title, description, subject, deadline, group_name, max_score } = req.body;
  if (!title || !description || !deadline) return res.status(400).json({ error: 'title, description, deadline majburiy' });
  const r = await pool.query(
    `INSERT INTO assignments (title, description, subject, deadline, group_name, max_score, teacher_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [title, description, subject || '', deadline, group_name || 'ALL', max_score || 100, req.user.id]);
  res.status(201).json({ assignment: r.rows[0] });
});

// GET /api/assignments/:id — bitta vazifa
router.get('/:id', async (req, res) => {
  const r = await pool.query(
    `SELECT a.*, u.full_name AS teacher_name FROM assignments a
     JOIN users u ON u.id=a.teacher_id WHERE a.id=$1`, [req.params.id]);
  if (!r.rows[0]) return res.status(404).json({ error: 'Topilmadi' });
  res.json({ assignment: r.rows[0] });
});

// DELETE /api/assignments/:id
router.delete('/:id', teacherOnly, async (req, res) => {
  await pool.query('DELETE FROM assignments WHERE id=$1 AND teacher_id=$2', [req.params.id, req.user.id]);
  res.json({ message: 'Ochirildi' });
});

module.exports = router;
