'use strict';
/* ══════════════════════════════════════════════════════════════
   Public stats — no auth required (landing page counters)
══════════════════════════════════════════════════════════════ */

const express = require('express');
const router  = express.Router();
const db      = require('../config/database');

/**
 * GET /api/v1/public/stats
 * Returns real counts for the landing page stat cards.
 * No authentication required — public endpoint.
 * Cached via Cache-Control to avoid hammering DB.
 */
router.get('/stats', async (req, res) => {
  try {
    const [students, teachers, subjects, grades] = await Promise.all([
      db.query(`SELECT COUNT(*)::int AS n FROM users WHERE role='student' AND is_active=TRUE`),
      db.query(`SELECT COUNT(*)::int AS n FROM users WHERE role='teacher' AND is_active=TRUE`),
      db.query(`SELECT COUNT(*)::int AS n FROM subjects WHERE is_active=TRUE`),
      db.query(`
        SELECT
          COUNT(*) FILTER (WHERE (jn + on_score + yn + mi) >= 56) AS passed,
          COUNT(*) FILTER (WHERE jn IS NOT NULL OR on_score IS NOT NULL) AS total
        FROM grades
      `),
    ]);

    const totalGrades = parseInt(grades.rows[0]?.total || 0);
    const passedGrades = parseInt(grades.rows[0]?.passed || 0);
    const successRate = totalGrades > 0 ? Math.round((passedGrades / totalGrades) * 100) : 0;

    res.set('Cache-Control', 'public, max-age=300'); // 5 min cache
    res.json({
      students:    students.rows[0]?.n  || 0,
      teachers:    teachers.rows[0]?.n  || 0,
      subjects:    subjects.rows[0]?.n  || 0,
      successRate: successRate,
      online:      24,   // always-on platform
      partners:    app_partners(),
    });
  } catch (e) {
    // Fallback — don't expose error details
    res.set('Cache-Control', 'public, max-age=60');
    res.json({ students: 0, teachers: 0, subjects: 0, successRate: 0, online: 24, partners: 0 });
  }
});

// Partner count is a business metric — update manually when partnerships grow
function app_partners() { return 3; }

module.exports = router;
