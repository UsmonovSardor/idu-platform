'use strict';

const express = require('express');
const db      = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);
router.use(authorize('admin', 'dekanat'));

// ── GET /api/rector/kpi ───────────────────────────────────────────────────────
// Top-level KPI cards for the rector dashboard
router.get('/kpi', async (req, res) => {
  const [students, teachers, avgGpa, attRate, submissions, exams] = await Promise.all([
    db.query("SELECT COUNT(*) FROM users WHERE role='student' AND is_active=TRUE"),
    db.query("SELECT COUNT(*) FROM users WHERE role='teacher' AND is_active=TRUE"),
    db.query("SELECT ROUND(AVG(score),1) AS avg FROM grades"),
    db.query(`SELECT ROUND(100.0*COUNT(r.id)/NULLIF(
                (SELECT COUNT(DISTINCT s2.id)*
                 (SELECT COUNT(*) FROM users WHERE role='student')
                 FROM attendance_sessions s2),0),1) AS pct
              FROM attendance_records r`).catch(()=>({rows:[{pct:null}]})),
    db.query("SELECT COUNT(*) FROM submissions WHERE status='graded'"),
    db.query("SELECT COUNT(*) FROM exams WHERE is_active=TRUE").catch(()=>({rows:[{count:0}]})),
  ]);

  res.json({
    totalStudents:  parseInt(students.rows[0].count, 10),
    totalTeachers:  parseInt(teachers.rows[0].count, 10),
    avgScore:       parseFloat(avgGpa.rows[0].avg) || 0,
    attendancePct:  parseFloat(attRate.rows[0].pct) || 0,
    gradedSubmissions: parseInt(submissions.rows[0].count, 10),
    activeExams:    parseInt(exams.rows[0].count, 10),
  });
});

// ── GET /api/rector/grade-distribution ───────────────────────────────────────
router.get('/grade-distribution', async (req, res) => {
  const { rows } = await db.query(`
    SELECT
      SUM(CASE WHEN score>=86 THEN 1 ELSE 0 END) AS a_count,
      SUM(CASE WHEN score>=71 AND score<86 THEN 1 ELSE 0 END) AS b_count,
      SUM(CASE WHEN score>=56 AND score<71 THEN 1 ELSE 0 END) AS c_count,
      SUM(CASE WHEN score>=41 AND score<56 THEN 1 ELSE 0 END) AS d_count,
      SUM(CASE WHEN score<41 THEN 1 ELSE 0 END) AS f_count,
      COUNT(*) AS total
    FROM grades
  `);
  res.json(rows[0]);
});

// ── GET /api/rector/group-stats ───────────────────────────────────────────────
router.get('/group-stats', async (req, res) => {
  const { rows } = await db.query(`
    SELECT u.group_name,
           COUNT(DISTINCT u.id) AS student_count,
           ROUND(AVG(g.score),1) AS avg_score,
           ROUND(AVG(CASE WHEN u2.gpa IS NOT NULL THEN u2.gpa::numeric ELSE NULL END),2) AS avg_gpa,
           SUM(CASE WHEN g.score>=86 THEN 1 ELSE 0 END) AS excellent,
           SUM(CASE WHEN g.score<56 THEN 1 ELSE 0 END) AS failing
    FROM users u
    LEFT JOIN grades g ON g.student_id=u.id
    LEFT JOIN users u2 ON u2.id=u.id
    WHERE u.role='student' AND u.group_name IS NOT NULL
    GROUP BY u.group_name
    ORDER BY avg_score DESC NULLS LAST
  `).catch(()=>({rows:[]}));
  res.json(rows);
});

// ── GET /api/rector/subject-stats ─────────────────────────────────────────────
router.get('/subject-stats', async (req, res) => {
  const { rows } = await db.query(`
    SELECT subject,
           COUNT(*) AS attempts,
           ROUND(AVG(score),1) AS avg_score,
           MAX(score) AS max_score,
           MIN(score) AS min_score,
           SUM(CASE WHEN score>=56 THEN 1 ELSE 0 END) AS passed
    FROM grades
    GROUP BY subject
    ORDER BY avg_score DESC
  `).catch(()=>({rows:[]}));
  res.json(rows);
});

// ── GET /api/rector/enrollment-trend ─────────────────────────────────────────
router.get('/enrollment-trend', async (req, res) => {
  const { rows } = await db.query(`
    SELECT DATE_TRUNC('month', created_at) AS month,
           COUNT(*) AS new_students
    FROM users
    WHERE role='student'
    GROUP BY month
    ORDER BY month
    LIMIT 24
  `).catch(()=>({rows:[]}));
  res.json(rows);
});

// ── GET /api/rector/attendance-by-group ───────────────────────────────────────
router.get('/attendance-by-group', async (req, res) => {
  const { rows } = await db.query(`
    SELECT s.group_name,
           COUNT(DISTINCT s.id) AS sessions,
           COUNT(r.id) AS total_marks,
           ROUND(100.0*COUNT(r.id)/NULLIF(COUNT(DISTINCT s.id)*
             (SELECT COUNT(*) FROM users u2
              WHERE u2.role='student' AND u2.group_name=s.group_name),0),1) AS pct
    FROM attendance_sessions s
    LEFT JOIN attendance_records r ON r.session_id=s.id
    GROUP BY s.group_name
    ORDER BY pct DESC NULLS LAST
  `).catch(()=>({rows:[]}));
  res.json(rows);
});

// ── GET /api/rector/top-students ──────────────────────────────────────────────
router.get('/top-students', async (req, res) => {
  const { rows } = await db.query(`
    SELECT u.id, u.full_name, u.group_name,
           ROUND(AVG(g.score),1) AS avg_score,
           COALESCE(x.xp,0) AS xp,
           COALESCE(x.level,1) AS level,
           (SELECT COUNT(*) FROM user_badges b WHERE b.user_id=u.id) AS badges
    FROM users u
    LEFT JOIN grades g ON g.student_id=u.id
    LEFT JOIN user_xp x ON x.user_id=u.id
    WHERE u.role='student'
    GROUP BY u.id, u.full_name, u.group_name, x.xp, x.level
    HAVING COUNT(g.id)>0
    ORDER BY avg_score DESC
    LIMIT 10
  `).catch(()=>({rows:[]}));
  res.json(rows);
});

// ── GET /api/rector/risk-students ─────────────────────────────────────────────
router.get('/risk-students', async (req, res) => {
  const { rows } = await db.query(`
    SELECT u.id, u.full_name, u.group_name, u.email,
           ROUND(AVG(g.score),1) AS avg_score,
           COUNT(g.id) AS grade_count
    FROM users u
    LEFT JOIN grades g ON g.student_id=u.id
    WHERE u.role='student'
    GROUP BY u.id, u.full_name, u.group_name, u.email
    HAVING AVG(g.score)<56 OR COUNT(g.id)=0
    ORDER BY avg_score ASC NULLS FIRST
    LIMIT 30
  `).catch(()=>({rows:[]}));
  res.json(rows);
});

module.exports = router;
