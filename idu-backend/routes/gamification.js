'use strict';

const express = require('express');
const db      = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// Badge definitions
const BADGES = {
  alochilar:    { name: "A'lochi",       icon: '🏆', desc: "O'rtacha ball 86+",         color: '#F59E0B' },
  faol:         { name: 'Faol talaba',   icon: '⚡', desc: 'Davomat 90%+',              color: '#8B5CF6' },
  matematik:    { name: 'Matematik',     icon: '📐', desc: 'Matematika 90+ ball',        color: '#3B82F6' },
  dasturchi:    { name: 'Dasturchi',     icon: '💻', desc: '5+ topshiriq yubordi',       color: '#10B981' },
  izlanuvchi:   { name: "Izlanuvchi",    icon: '🔬', desc: '10+ topshiriq yubordi',      color: '#6366F1' },
  chempion:     { name: 'Chempion',      icon: '🥇', desc: 'Guruh reytingida 1-o\'rin',  color: '#EF4444' },
  qatnashuvchi: { name: 'Qatnashuvchi', icon: '📅', desc: '20+ davomat sessiya',        color: '#0EA5E9' },
  ustoz_sher:   { name: "Ustoz she'rdi", icon: '📖', desc: 'Imtixon 95+ ball',          color: '#EC4899' },
};

function xpToLevel(xp) {
  // Level thresholds: 0,100,250,500,900,1400,2000,2800,3800,5000,...
  const thresholds = [0,100,250,500,900,1400,2000,2800,3800,5000,6500];
  let level = 1;
  for (let i = 1; i < thresholds.length; i++) {
    if (xp >= thresholds[i]) level = i + 1;
    else break;
  }
  const nextThreshold = thresholds[Math.min(level, thresholds.length - 1)] || thresholds[thresholds.length - 1] + 2000;
  const prevThreshold = thresholds[level - 1] || 0;
  return { level, nextThreshold, prevThreshold, progress: Math.round(100 * (xp - prevThreshold) / (nextThreshold - prevThreshold)) };
}

// ── GET /api/gamification/me ─────────────────────────────────────────────────
router.get('/me', async (req, res) => {
  const uid = req.user.id;

  // Ensure xp row exists
  await db.query(
    'INSERT INTO user_xp (user_id, xp, level) VALUES ($1,0,1) ON CONFLICT DO NOTHING',
    [uid]
  );

  const { rows: [xpRow] } = await db.query(
    'SELECT xp, level FROM user_xp WHERE user_id=$1', [uid]
  );
  const { rows: badges }  = await db.query(
    'SELECT badge_code, earned_at FROM user_badges WHERE user_id=$1 ORDER BY earned_at', [uid]
  );
  const { rows: log } = await db.query(
    'SELECT amount, reason, created_at FROM xp_log WHERE user_id=$1 ORDER BY created_at DESC LIMIT 20', [uid]
  );

  const levelInfo = xpToLevel(xpRow.xp);

  res.json({
    xp: xpRow.xp,
    ...levelInfo,
    badges: badges.map(b => ({ ...b, ...BADGES[b.badge_code] })),
    log
  });
});

// ── GET /api/gamification/leaderboard ────────────────────────────────────────
router.get('/leaderboard', async (req, res) => {
  const { group } = req.query;
  let cond = "u.role='student'";
  const params = [];
  if (group) { params.push(group); cond += ` AND u.group_name=$${params.length}`; }

  const { rows } = await db.query(
    `SELECT u.id, u.full_name, u.group_name, COALESCE(x.xp,0) AS xp,
            COALESCE(x.level,1) AS level,
            (SELECT COUNT(*) FROM user_badges b WHERE b.user_id=u.id) AS badge_count
     FROM users u
     LEFT JOIN user_xp x ON x.user_id=u.id
     WHERE ${cond}
     ORDER BY xp DESC
     LIMIT 50`,
    params
  );
  res.json(rows.map((r, i) => ({ ...r, rank: i + 1 })));
});

// ── POST /api/gamification/award ─────────────────────────────────────────────
// Internal helper also callable from other routes
async function awardXP(userId, amount, reason, client) {
  const q = client || db;
  await q.query(
    'INSERT INTO user_xp (user_id, xp, level) VALUES ($1,$2,1) ON CONFLICT (user_id) DO UPDATE SET xp = user_xp.xp + $2, updated_at=NOW()',
    [userId, amount]
  );
  await q.query(
    'INSERT INTO xp_log (user_id, amount, reason) VALUES ($1,$2,$3)',
    [userId, amount, reason]
  );
  // Update level
  const { rows: [row] } = await q.query('SELECT xp FROM user_xp WHERE user_id=$1', [userId]);
  const { level } = xpToLevel(row.xp);
  await q.query('UPDATE user_xp SET level=$1 WHERE user_id=$2', [level, userId]);
}

async function awardBadge(userId, badgeCode, client) {
  const q = client || db;
  try {
    await q.query(
      'INSERT INTO user_badges (user_id, badge_code) VALUES ($1,$2) ON CONFLICT DO NOTHING',
      [userId, badgeCode]
    );
  } catch(e) {}
}

// ── POST /api/gamification/recalculate ───────────────────────────────────────
// Recalculate XP and badges for all students (run periodically / on demand)
router.post('/recalculate', async (req, res) => {
  const { rows: students } = await db.query(
    "SELECT id FROM users WHERE role='student'"
  );

  let processed = 0;
  for (const s of students) {
    try {
      await recalculateStudent(s.id);
      processed++;
    } catch(e) {}
  }
  res.json({ message: `${processed} talaba qayta hisoblandi` });
});

async function recalculateStudent(userId) {
  // Reset XP
  await db.query('UPDATE user_xp SET xp=0 WHERE user_id=$1', [userId]);
  await db.query('DELETE FROM xp_log WHERE user_id=$1', [userId]);

  // Ensure row
  await db.query('INSERT INTO user_xp (user_id) VALUES ($1) ON CONFLICT DO NOTHING', [userId]);

  // XP from grades (submitted grades)
  const { rows: grades } = await db.query(
    `SELECT g.score FROM grades g WHERE g.student_id=$1`, [userId]
  );
  for (const g of grades) {
    const score = parseFloat(g.score) || 0;
    await awardXP(userId, Math.round(score * 2), `Baho: ${score} ball`);
  }

  // XP from attendance
  const { rows: att } = await db.query(
    'SELECT COUNT(*) AS cnt FROM attendance_records WHERE student_id=$1', [userId]
  );
  const attCount = parseInt(att[0].cnt, 10);
  if (attCount > 0) await awardXP(userId, attCount * 10, `Davomat: ${attCount} sesiya`);

  // XP from submissions
  const { rows: subs } = await db.query(
    "SELECT COUNT(*) AS cnt FROM submissions WHERE student_id=$1 AND status='graded'", [userId]
  );
  const subCount = parseInt(subs[0].cnt, 10);
  if (subCount > 0) await awardXP(userId, subCount * 15, `Topshiriqlar: ${subCount} ta`);

  // Badges
  const { rows: [xpRow] } = await db.query('SELECT xp FROM user_xp WHERE user_id=$1', [userId]);
  const totalXp = xpRow ? xpRow.xp : 0;

  const avgGrade = grades.length
    ? grades.reduce((a, g) => a + (parseFloat(g.score) || 0), 0) / grades.length
    : 0;

  if (avgGrade >= 86)  await awardBadge(userId, 'alochilar');
  if (attCount >= 20)  await awardBadge(userId, 'qatnashuvchi');
  if (attCount >= 0 && attCount / Math.max(attCount, 1) >= 0.9) await awardBadge(userId, 'faol');
  if (subCount >= 5)   await awardBadge(userId, 'dasturchi');
  if (subCount >= 10)  await awardBadge(userId, 'izlanuvchi');
  if (totalXp >= 2000) await awardBadge(userId, 'chempion');
}

module.exports = router;
module.exports.awardXP    = awardXP;
module.exports.awardBadge = awardBadge;
