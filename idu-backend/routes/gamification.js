'use strict';

const express = require('express');
const db      = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

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
  if (group) { params.push(group); cond += ` AND st.group_name=$${params.length}`; }

  const { rows } = await db.query(
    `SELECT u.id, u.full_name, st.group_name, COALESCE(x.xp,0) AS xp,
            COALESCE(x.level,1) AS level,
            (SELECT COUNT(*) FROM user_badges b WHERE b.user_id=u.id) AS badge_count
     FROM users u
     LEFT JOIN students st ON st.user_id=u.id
     LEFT JOIN user_xp x ON x.user_id=u.id
     WHERE ${cond}
     ORDER BY xp DESC
     LIMIT 50`,
    params
  ).catch((e)=>{console.error('leaderboard:', e.message); return {rows:[]};});
  res.json(rows.map((r, i) => ({ ...r, rank: i + 1 })));
});

// ── POST /api/gamification/award ─────────────────────────────────────────────
// Internal helper also callable from other routes
async function awardXP(userId, amount, reason, client) {
  const q = client || db;
  // Atomic upsert + level recalc in a single round-trip to avoid race conditions
  // when multiple events (exam, streak, challenge) award XP concurrently.
  const { rows: [row] } = await q.query(
    `INSERT INTO user_xp (user_id, xp, level) VALUES ($1,$2,1)
     ON CONFLICT (user_id) DO UPDATE
       SET xp = user_xp.xp + $2, updated_at = NOW()
     RETURNING xp`,
    [userId, amount]
  );
  const { level } = xpToLevel(row.xp);
  await q.query('UPDATE user_xp SET level=$1 WHERE user_id=$2', [level, userId]);
  await q.query(
    'INSERT INTO xp_log (user_id, amount, reason) VALUES ($1,$2,$3)',
    [userId, amount, reason]
  );
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
// Recalculate XP and badges for all students — dekanat/admin only
router.post('/recalculate', authorize('dekanat', 'admin'), async (req, res) => {
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
    `SELECT (g.jn+g.on_score+g.yn+g.mi) AS score FROM grades g WHERE g.student_id=$1`, [userId]
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

  // XP from submissions — count approved submissions (teacher_score IS NOT NULL)
  const { rows: subs } = await db.query(
    'SELECT COUNT(*) AS cnt FROM submissions WHERE student_id=$1 AND teacher_score IS NOT NULL', [userId]
  );
  const subCount = parseInt(subs[0].cnt, 10);
  if (subCount > 0) await awardXP(userId, subCount * 15, `Topshiriqlar: ${subCount} ta`);

  // Badges
  const { rows: [xpRow] } = await db.query('SELECT xp FROM user_xp WHERE user_id=$1', [userId]);
  const totalXp = xpRow ? xpRow.xp : 0;

  const avgGrade = grades.length
    ? grades.reduce((a, g) => a + (parseFloat(g.score) || 0), 0) / grades.length
    : 0;

  // Calculate real attendance rate: sessions attended vs total sessions available
  const { rows: [sessRow] } = await db.query(
    'SELECT COUNT(*) AS cnt FROM attendance_sessions'
  ).catch(() => ({ rows: [{ cnt: 0 }] }));
  const totalSessions = parseInt(sessRow?.cnt ?? 0, 10);
  const attRate = totalSessions > 0 ? attCount / totalSessions : 0;

  if (avgGrade >= 86)                          await awardBadge(userId, 'alochilar');
  if (attCount >= 20)                          await awardBadge(userId, 'qatnashuvchi');
  if (attRate >= 0.9 && totalSessions >= 10)   await awardBadge(userId, 'faol');      // real 90%+ attendance
  if (subCount >= 5)                           await awardBadge(userId, 'dasturchi');
  if (subCount >= 10)                          await awardBadge(userId, 'izlanuvchi');
  if (totalXp >= 2000)                         await awardBadge(userId, 'chempion');
}

// ════════════════════════════════════════════════════════════════════════════
//  STREAK SYSTEM
// ════════════════════════════════════════════════════════════════════════════
async function touchStreak(userId) {
  await db.query('INSERT INTO user_streaks (user_id) VALUES ($1) ON CONFLICT DO NOTHING', [userId]);
  const { rows: [s] } = await db.query('SELECT current_streak, longest_streak, last_active FROM user_streaks WHERE user_id=$1', [userId]);
  const today = new Date(); today.setHours(0,0,0,0);
  const last = s.last_active ? new Date(s.last_active) : null;
  if (last) last.setHours(0,0,0,0);

  let cur = s.current_streak || 0;
  let bumped = false;
  if (!last) { cur = 1; bumped = true; }
  else {
    const diffDays = Math.round((today - last) / 86400000);
    if (diffDays === 0) { /* already counted today */ }
    else if (diffDays === 1) { cur += 1; bumped = true; }
    else { cur = 1; bumped = true; }  // streak broken -> restart
  }
  const longest = Math.max(s.longest_streak || 0, cur);
  await db.query(
    'UPDATE user_streaks SET current_streak=$1, longest_streak=$2, last_active=CURRENT_DATE, updated_at=NOW() WHERE user_id=$3',
    [cur, longest, userId]
  );
  // milestone XP on a fresh day-extension
  if (bumped && cur > 1) {
    const bonus = cur % 7 === 0 ? 50 : 10;
    await awardXP(userId, bonus, `Streak: ${cur} kun 🔥`).catch(()=>{});
  }
  return { current: cur, longest, bumped };
}

// GET /api/gamification/streak  (also extends streak — called on app load)
router.get('/streak', async (req, res) => {
  try {
    const s = await touchStreak(req.user.id);
    res.json(s);
  } catch (e) { console.error('streak:', e.message); res.json({ current: 0, longest: 0 }); }
});

// ════════════════════════════════════════════════════════════════════════════
//  LEARNING RESULT RECORDER — feeds review queue + subject mastery
// ════════════════════════════════════════════════════════════════════════════
const REVIEW_INTERVALS = [1, 3, 7, 16, 30]; // days per stage

async function recordResult(userId, questionId, subject, isCorrect) {
  // subject mastery
  await db.query(
    `INSERT INTO subject_mastery (user_id, subject, correct, total, mastery)
       VALUES ($1,$2,$3,1, CASE WHEN $3=1 THEN 100 ELSE 0 END)
     ON CONFLICT (user_id, subject) DO UPDATE SET
       correct = subject_mastery.correct + $3,
       total   = subject_mastery.total + 1,
       mastery = ROUND(100.0 * (subject_mastery.correct + $3) / (subject_mastery.total + 1)),
       updated_at = NOW()`,
    [userId, subject || 'algo', isCorrect ? 1 : 0]
  ).catch(e => console.error('mastery:', e.message));

  // spaced repetition queue
  if (!isCorrect) {
    await db.query(
      `INSERT INTO review_queue (user_id, question_id, subject, stage, due_at, last_result, reps)
         VALUES ($1,$2,$3,0, CURRENT_DATE + 1, 'wrong', 1)
       ON CONFLICT (user_id, question_id) DO UPDATE SET
         stage = 0, due_at = CURRENT_DATE + 1, last_result='wrong',
         reps = review_queue.reps + 1, updated_at = NOW()`,
      [userId, questionId, subject || 'algo']
    ).catch(e => console.error('review-add:', e.message));
  } else {
    // correct review answer -> advance stage / schedule next
    const { rows: [r] } = await db.query('SELECT stage FROM review_queue WHERE user_id=$1 AND question_id=$2', [userId, questionId]);
    if (r) {
      const nextStage = Math.min((r.stage || 0) + 1, REVIEW_INTERVALS.length - 1);
      if ((r.stage || 0) + 1 >= REVIEW_INTERVALS.length) {
        await db.query('DELETE FROM review_queue WHERE user_id=$1 AND question_id=$2', [userId, questionId]).catch(()=>{});
      } else {
        await db.query(
          `UPDATE review_queue SET stage=$1, due_at=CURRENT_DATE + $2, last_result='right', reps=reps+1, updated_at=NOW()
             WHERE user_id=$3 AND question_id=$4`,
          [nextStage, REVIEW_INTERVALS[nextStage], userId, questionId]
        ).catch(()=>{});
      }
    }
  }
}

// ════════════════════════════════════════════════════════════════════════════
//  DAILY CHALLENGE
// ════════════════════════════════════════════════════════════════════════════
// GET /api/gamification/daily — today's challenge (creates it if missing)
router.get('/daily', async (req, res) => {
  const uid = req.user.id;
  try {
    let { rows: [ch] } = await db.query(
      'SELECT * FROM daily_challenge WHERE user_id=$1 AND challenge_date=CURRENT_DATE', [uid]
    );
    if (!ch) {
      // pick 5 random active questions
      const { rows: qs } = await db.query(
        'SELECT id FROM questions WHERE is_active=TRUE ORDER BY random() LIMIT 5'
      );
      const ids = qs.map(q => q.id);
      ({ rows: [ch] } = await db.query(
        `INSERT INTO daily_challenge (user_id, challenge_date, question_ids, total)
           VALUES ($1, CURRENT_DATE, $2::jsonb, $3) RETURNING *`,
        [uid, JSON.stringify(ids), ids.length]
      ));
    }
    // send questions WITHOUT correct_option
    const ids = ch.question_ids || [];
    let questions = [];
    if (ids.length) {
      const { rows } = await db.query(
        `SELECT id, subject, question_text, option_a, option_b, option_c, option_d
           FROM questions WHERE id = ANY($1::int[])`, [ids]
      );
      // preserve order
      questions = ids.map(id => rows.find(r => r.id === id)).filter(Boolean);
    }
    res.json({
      date: ch.challenge_date, answered: ch.answered, correct: ch.correct,
      total: ch.total, completed: ch.completed, xp_earned: ch.xp_earned, questions
    });
  } catch (e) { console.error('daily:', e.message); res.status(500).json({ error: 'daily_failed' }); }
});

// POST /api/gamification/daily/answer { question_id, choice }
router.post('/daily/answer', async (req, res) => {
  const uid = req.user.id;
  const { question_id, choice } = req.body || {};
  if (!question_id || !choice) return res.status(400).json({ error: 'missing' });
  try {
    const { rows: [ch] } = await db.query(
      'SELECT * FROM daily_challenge WHERE user_id=$1 AND challenge_date=CURRENT_DATE', [uid]
    );
    if (!ch) return res.status(404).json({ error: 'no_challenge' });
    if (ch.completed) return res.json({ already: true, correct: ch.correct, total: ch.total });

    const { rows: [q] } = await db.query('SELECT correct_option, explanation, subject FROM questions WHERE id=$1', [question_id]);
    if (!q) return res.status(404).json({ error: 'no_q' });
    const isCorrect = String(choice).toUpperCase() === q.correct_option;

    const answered = ch.answered + 1;
    const correct = ch.correct + (isCorrect ? 1 : 0);
    const done = answered >= ch.total;
    let xpEarned = ch.xp_earned;
    if (done) xpEarned += correct * 10 + (correct === ch.total ? 25 : 0); // bonus for all-correct

    await db.query(
      'UPDATE daily_challenge SET answered=$1, correct=$2, completed=$3, xp_earned=$4 WHERE id=$5',
      [answered, correct, done, xpEarned, ch.id]
    );
    await recordResult(uid, question_id, q.subject, isCorrect);
    if (done && xpEarned > 0) await awardXP(uid, xpEarned - ch.xp_earned, 'Kunlik challenge').catch(()=>{});

    res.json({
      correct: isCorrect, correct_option: q.correct_option, explanation: q.explanation,
      progress: { answered, correct, total: ch.total, completed: done, xp: done ? xpEarned : 0 }
    });
  } catch (e) { console.error('daily-answer:', e.message); res.status(500).json({ error: 'failed' }); }
});

// ════════════════════════════════════════════════════════════════════════════
//  SPACED REPETITION — REVIEW
// ════════════════════════════════════════════════════════════════════════════
// GET /api/gamification/review — questions due today
router.get('/review', async (req, res) => {
  const uid = req.user.id;
  try {
    const { rows } = await db.query(
      `SELECT q.id, q.subject, q.question_text, q.option_a, q.option_b, q.option_c, q.option_d, rq.stage
         FROM review_queue rq JOIN questions q ON q.id = rq.question_id
        WHERE rq.user_id=$1 AND rq.due_at <= CURRENT_DATE AND q.is_active=TRUE
        ORDER BY rq.due_at ASC LIMIT 15`, [uid]
    );
    const { rows: [c] } = await db.query(
      'SELECT COUNT(*)::int AS due, (SELECT COUNT(*)::int FROM review_queue WHERE user_id=$1) AS total FROM review_queue WHERE user_id=$1 AND due_at <= CURRENT_DATE',
      [uid]
    );
    res.json({ due: c.due, total: c.total, questions: rows });
  } catch (e) { console.error('review:', e.message); res.json({ due: 0, total: 0, questions: [] }); }
});

// POST /api/gamification/review/answer { question_id, choice }
router.post('/review/answer', async (req, res) => {
  const uid = req.user.id;
  const { question_id, choice } = req.body || {};
  if (!question_id || !choice) return res.status(400).json({ error: 'missing' });
  try {
    const { rows: [q] } = await db.query('SELECT correct_option, explanation, subject FROM questions WHERE id=$1', [question_id]);
    if (!q) return res.status(404).json({ error: 'no_q' });
    const isCorrect = String(choice).toUpperCase() === q.correct_option;
    await recordResult(uid, question_id, q.subject, isCorrect);
    if (isCorrect) await awardXP(uid, 5, 'Takrorlash').catch(()=>{});
    res.json({ correct: isCorrect, correct_option: q.correct_option, explanation: q.explanation });
  } catch (e) { console.error('review-answer:', e.message); res.status(500).json({ error: 'failed' }); }
});

// ════════════════════════════════════════════════════════════════════════════
//  SUBJECT MASTERY — BILIM DARAXTI
// ════════════════════════════════════════════════════════════════════════════
const SUBJECTS = {
  algo: { name: 'Algoritmlar', icon: '🧮', color: '#3B82F6' },
  ai:   { name: 'Sun\'iy intellekt', icon: '🤖', color: '#8B5CF6' },
  math: { name: 'Matematika', icon: '📐', color: '#10B981' },
  db:   { name: 'Ma\'lumotlar bazasi', icon: '🗄️', color: '#F59E0B' },
  web:  { name: 'Web dasturlash', icon: '🌐', color: '#EC4899' },
};

// GET /api/gamification/mastery — skill tree
router.get('/mastery', async (req, res) => {
  const uid = req.user.id;
  try {
    const { rows } = await db.query('SELECT subject, correct, total, mastery FROM subject_mastery WHERE user_id=$1', [uid]);
    const map = {};
    rows.forEach(r => { map[r.subject] = r; });
    const tree = Object.keys(SUBJECTS).map(code => {
      const m = map[code] || { correct: 0, total: 0, mastery: 0 };
      const mastery = m.mastery || 0;
      let tier = 'Boshlovchi';
      if (mastery >= 90) tier = 'Usta'; else if (mastery >= 70) tier = 'Ilg\'or';
      else if (mastery >= 40) tier = 'O\'rta';
      return { code, ...SUBJECTS[code], correct: m.correct, total: m.total, mastery, tier };
    });
    res.json(tree);
  } catch (e) { console.error('mastery:', e.message); res.json([]); }
});

// ════════════════════════════════════════════════════════════════════════════
//  WEEKLY LEADERBOARD — from xp_log (last 7 days)
// ════════════════════════════════════════════════════════════════════════════
router.get('/leaderboard/weekly', async (req, res) => {
  const uid = req.user.id;
  try {
    const { rows } = await db.query(
      `SELECT u.id, u.full_name, u.avatar_url, st.group_name,
              COALESCE(SUM(l.amount),0)::int AS week_xp
         FROM users u
         LEFT JOIN students st ON st.user_id=u.id
         LEFT JOIN xp_log l ON l.user_id=u.id AND l.created_at >= NOW() - INTERVAL '7 days'
        WHERE u.role='student' AND u.is_active=TRUE
        GROUP BY u.id, u.full_name, u.avatar_url, st.group_name
        ORDER BY week_xp DESC, u.full_name ASC
        LIMIT 50`
    );
    const ranked = rows.map((r, i) => ({ ...r, rank: i + 1 }));
    const meIdx = ranked.findIndex(r => r.id === uid);
    const me = meIdx >= 0 ? ranked[meIdx] : null;
    const toNext = (me && meIdx > 0) ? ranked[meIdx - 1].week_xp - me.week_xp : 0;
    res.json({ list: ranked, me, toNext });
  } catch (e) { console.error('weekly-lb:', e.message); res.json({ list: [], me: null, toNext: 0 }); }
});

module.exports = router;
module.exports.awardXP      = awardXP;
module.exports.awardBadge   = awardBadge;
module.exports.recordResult = recordResult;
module.exports.touchStreak  = touchStreak;
