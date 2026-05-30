'use strict';

/**
 * IDU Liga — inter-group subject tournaments.
 * Phase 1: tournament + auto-bracket + league table (read views).
 * Live battle (Phase 2) and rewards approval (Phase 3) build on this.
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

const SUBJECTS = {
  algo: 'Algoritmlar', ai: "Sun'iy intellekt", math: 'Matematika',
  db: "Ma'lumotlar bazasi", web: 'Web dasturlash',
};

// ── Bracket helpers ───────────────────────────────────────────────────────────
function nextPow2(n) { let s = 1; while (s < n) s *= 2; return Math.max(s, 2); }

// Propagate a winner into its parent match slot. Reused by the live battle engine.
async function advanceWinner(client, matchId, teamId) {
  const { rows: [m] } = await client.query(
    'SELECT next_match_id, next_slot FROM comp_matches WHERE id=$1', [matchId]
  );
  await client.query(
    "UPDATE comp_matches SET winner_team_id=$1, status='finished', ended_at=COALESCE(ended_at, NOW()) WHERE id=$2",
    [teamId, matchId]
  );
  if (m && m.next_match_id) {
    const col = m.next_slot === 'a' ? 'team_a_id' : 'team_b_id';
    await client.query(`UPDATE comp_matches SET ${col}=$1 WHERE id=$2`, [teamId, m.next_match_id]);
    await client.query(
      "UPDATE comp_matches SET status='ready' WHERE id=$1 AND team_a_id IS NOT NULL AND team_b_id IS NOT NULL AND status='pending'",
      [m.next_match_id]
    );
  }
}

async function generateBracket(client, tournamentId, teamRows, size, totalRounds) {
  const matchIdsByRound = [];
  for (let r = 1; r <= totalRounds; r++) {
    const count = size / Math.pow(2, r);
    const ids = [];
    for (let s = 0; s < count; s++) {
      const { rows: [mm] } = await client.query(
        "INSERT INTO comp_matches (tournament_id, round, slot, status) VALUES ($1,$2,$3,'pending') RETURNING id",
        [tournamentId, r, s]
      );
      ids.push(mm.id);
    }
    matchIdsByRound.push(ids);
  }
  // Link each match to its parent in the next round
  for (let r = 1; r < totalRounds; r++) {
    const ids = matchIdsByRound[r - 1];
    for (let s = 0; s < ids.length; s++) {
      const parent = matchIdsByRound[r][Math.floor(s / 2)];
      const slot = (s % 2 === 0) ? 'a' : 'b';
      await client.query('UPDATE comp_matches SET next_match_id=$1, next_slot=$2 WHERE id=$3', [parent, slot, ids[s]]);
    }
  }
  // Place teams (in seed order) into round 1, pad with byes
  const slots = [];
  for (let i = 0; i < size; i++) slots.push(teamRows[i] ? teamRows[i].id : null);
  const r1 = matchIdsByRound[0];
  for (let s = 0; s < r1.length; s++) {
    const a = slots[2 * s], b = slots[2 * s + 1];
    await client.query(
      'UPDATE comp_matches SET team_a_id=$1, team_b_id=$2, status=$3 WHERE id=$4',
      [a, b, (a && b) ? 'ready' : 'pending', r1[s]]
    );
    if (a && !b) await advanceWinner(client, r1[s], a);       // bye
    else if (!a && b) await advanceWinner(client, r1[s], b);  // bye
  }
}

// ── GET /api/competitions — list tournaments ─────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT t.id, t.title, t.subject, t.semester, t.status, t.total_rounds,
              t.created_at, t.starts_at, t.champion_team_id,
              (SELECT COUNT(*) FROM comp_teams ct WHERE ct.tournament_id=t.id) AS team_count,
              ch.group_name AS champion_group
         FROM comp_tournaments t
         LEFT JOIN comp_teams ch ON ch.id = t.champion_team_id
        ORDER BY t.created_at DESC`
    );
    res.json(rows.map(r => ({ ...r, subject_name: SUBJECTS[r.subject] || r.subject })));
  } catch (e) {
    console.error('comp list:', e.message);
    res.status(500).json({ error: 'comp_list_failed' });
  }
});

// ── GET /api/competitions/groups — available groups (dekanat picker) ─────────
router.get('/groups', authorize('dekanat', 'admin'), async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT group_name, MIN(faculty) AS faculty, COUNT(*)::int AS size
         FROM students
        WHERE group_name IS NOT NULL AND group_name <> ''
        GROUP BY group_name
        ORDER BY group_name`
    );
    res.json(rows);
  } catch (e) {
    console.error('comp groups:', e.message);
    res.json([]);
  }
});

// ── GET /api/competitions/:id — full detail (teams + bracket) ────────────────
router.get('/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ error: 'bad_id' });
  try {
    const { rows: [t] } = await db.query('SELECT * FROM comp_tournaments WHERE id=$1', [id]);
    if (!t) return res.status(404).json({ error: 'not_found' });

    const { rows: teams } = await db.query(
      `SELECT id, group_name, faculty, seed, rating, played, wins, losses, points, eliminated, captain_user_id
         FROM comp_teams WHERE tournament_id=$1
        ORDER BY rating DESC, wins DESC, group_name ASC`, [id]
    );
    const { rows: matches } = await db.query(
      `SELECT m.id, m.round, m.slot, m.status, m.scheduled_at,
              m.team_a_id, m.team_b_id, m.winner_team_id,
              m.team_a_score, m.team_b_score, m.next_match_id, m.next_slot,
              ta.group_name AS team_a_name, tb.group_name AS team_b_name
         FROM comp_matches m
         LEFT JOIN comp_teams ta ON ta.id = m.team_a_id
         LEFT JOIN comp_teams tb ON tb.id = m.team_b_id
        WHERE m.tournament_id=$1
        ORDER BY m.round ASC, m.slot ASC`, [id]
    );
    res.json({
      tournament: { ...t, subject_name: SUBJECTS[t.subject] || t.subject },
      teams, matches,
    });
  } catch (e) {
    console.error('comp detail:', e.message);
    res.status(500).json({ error: 'comp_detail_failed' });
  }
});

// ── POST /api/competitions — create tournament + bracket (dekanat) ───────────
router.post('/', authorize('dekanat', 'admin'), [
  body('title').isString().trim().isLength({ min: 1, max: 160 }),
  body('subject').isString().trim().isLength({ min: 1, max: 40 }),
  body('semester').isString().trim().isLength({ min: 1, max: 20 }),
  body('groups').isArray({ min: 2, max: 32 }),
  body('questions_per_match').optional().isInt({ min: 3, max: 30 }),
  body('seconds_per_question').optional().isInt({ min: 5, max: 60 }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ error: 'validation', details: errors.array() });

  const { title, subject, semester } = req.body;
  const groups = [...new Set((req.body.groups || []).map(g => String(g).trim()).filter(Boolean))];
  if (groups.length < 2) return res.status(422).json({ error: 'Kamida 2 ta guruh tanlang' });

  const qpm = parseInt(req.body.questions_per_match, 10) || 10;
  const spq = parseInt(req.body.seconds_per_question, 10) || 20;
  const startsAt = req.body.starts_at || null;

  const size = nextPow2(groups.length);
  const totalRounds = Math.round(Math.log2(size));

  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    const { rows: [t] } = await client.query(
      `INSERT INTO comp_tournaments
         (title, subject, semester, format, status, total_rounds, bracket_size,
          questions_per_match, seconds_per_question, created_by, starts_at)
       VALUES ($1,$2,$3,'knockout','draft',$4,$5,$6,$7,$8,$9) RETURNING *`,
      [title, subject, semester, totalRounds, size, qpm, spq, req.user.id, startsAt]
    );

    // Enrol teams. Captain = highest-XP student of the group (best-effort).
    const teamRows = [];
    for (let i = 0; i < groups.length; i++) {
      const g = groups[i];
      const { rows: [cap] } = await client.query(
        `SELECT u.id FROM users u JOIN students s ON s.user_id=u.id
           LEFT JOIN user_xp x ON x.user_id=u.id
          WHERE s.group_name=$1 AND u.role='student' AND u.is_active=TRUE
          ORDER BY COALESCE(x.xp,0) DESC LIMIT 1`, [g]
      ).catch(() => ({ rows: [] }));
      const { rows: [fac] } = await client.query(
        'SELECT MIN(faculty) AS faculty FROM students WHERE group_name=$1', [g]
      ).catch(() => ({ rows: [{ faculty: null }] }));
      const { rows: [team] } = await client.query(
        `INSERT INTO comp_teams (tournament_id, group_name, faculty, seed, captain_user_id)
         VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        [t.id, g, fac ? fac.faculty : null, i + 1, cap ? cap.id : null]
      );
      teamRows.push({ id: team.id });
    }

    await generateBracket(client, t.id, teamRows, size, totalRounds);
    await client.query('COMMIT');
    res.status(201).json({ id: t.id, message: 'Turnir yaratildi', bracket_size: size, total_rounds: totalRounds });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('comp create:', e.message);
    res.status(500).json({ error: 'comp_create_failed', detail: e.message });
  } finally {
    client.release();
  }
});

// ── POST /api/competitions/:id/status — activate / complete (dekanat) ────────
router.post('/:id/status', authorize('dekanat', 'admin'), [
  body('status').isIn(['draft', 'active', 'completed']),
], async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { status } = req.body;
  try {
    await db.query('UPDATE comp_tournaments SET status=$1, updated_at=NOW() WHERE id=$2', [status, id]);
    res.json({ id, status });
  } catch (e) {
    console.error('comp status:', e.message);
    res.status(500).json({ error: 'comp_status_failed' });
  }
});

// ── DELETE /api/competitions/:id — remove a draft tournament (dekanat) ───────
router.delete('/:id', authorize('dekanat', 'admin'), async (req, res) => {
  const id = parseInt(req.params.id, 10);
  try {
    const { rows: [t] } = await db.query('SELECT status FROM comp_tournaments WHERE id=$1', [id]);
    if (!t) return res.status(404).json({ error: 'not_found' });
    if (t.status === 'active') return res.status(400).json({ error: 'Faol turnirni o\'chirib bo\'lmaydi' });
    await db.query('DELETE FROM comp_tournaments WHERE id=$1', [id]);
    res.json({ ok: true });
  } catch (e) {
    console.error('comp delete:', e.message);
    res.status(500).json({ error: 'comp_delete_failed' });
  }
});

// ── GET /api/competitions/rewards/pending — dekanat inbox ────────────────────
router.get('/rewards/pending', authorize('dekanat', 'admin'), async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT r.id, r.tournament_id, r.team_id, r.type, r.value, r.placement, r.status, r.note,
              t.title AS tournament_title, t.subject, ct.group_name
         FROM comp_rewards r
         JOIN comp_tournaments t ON t.id = r.tournament_id
         JOIN comp_teams ct ON ct.id = r.team_id
        WHERE r.status = 'proposed'
        ORDER BY r.created_at ASC`
    );
    res.json(rows.map(r => ({ ...r, subject_name: SUBJECTS[r.subject] || r.subject })));
  } catch (e) {
    console.error('rewards pending:', e.message);
    res.json([]);
  }
});

// ── GET /api/competitions/:id/rewards — rewards for one tournament ───────────
router.get('/:id/rewards', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ error: 'bad_id' });
  try {
    const { rows } = await db.query(
      `SELECT r.id, r.team_id, r.type, r.value, r.placement, r.status, r.note, ct.group_name
         FROM comp_rewards r JOIN comp_teams ct ON ct.id = r.team_id
        WHERE r.tournament_id=$1
        ORDER BY r.placement ASC, r.type DESC`, [id]
    );
    res.json(rows);
  } catch (e) {
    console.error('tour rewards:', e.message);
    res.json([]);
  }
});

// ── POST /api/competitions/rewards/:rid/decide — approve / reject (dekanat) ──
router.post('/rewards/:rid/decide', authorize('dekanat', 'admin'), [
  body('decision').isIn(['approve', 'reject']),
  body('value').optional({ nullable: true }).isFloat({ min: 0, max: 100 }),
], async (req, res) => {
  const rid = parseInt(req.params.rid, 10);
  const { decision } = req.body;
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    const { rows: [r] } = await client.query('SELECT * FROM comp_rewards WHERE id=$1 FOR UPDATE', [rid]);
    if (!r) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'not_found' }); }
    if (r.status !== 'proposed') { await client.query('ROLLBACK'); return res.status(400).json({ error: 'already_decided' }); }

    if (decision === 'reject') {
      await client.query("UPDATE comp_rewards SET status='rejected', approved_by=$1, decided_at=NOW() WHERE id=$2", [req.user.id, rid]);
      await client.query('COMMIT');
      return res.json({ id: rid, status: 'rejected' });
    }

    // approve — allow dekanat to adjust the discount value
    const value = (req.body.value != null && r.type === 'discount') ? parseFloat(req.body.value) : r.value;
    await client.query(
      "UPDATE comp_rewards SET status='approved', value=$1, approved_by=$2, decided_at=NOW() WHERE id=$3",
      [value, req.user.id, rid]
    );

    // For a discount: write one ledger row per student in the winning group
    let granted = 0;
    if (r.type === 'discount' && value > 0) {
      const { rows: [team] } = await client.query('SELECT group_name FROM comp_teams WHERE id=$1', [r.team_id]);
      if (team && team.group_name) {
        const { rows: students } = await client.query(
          `SELECT u.id FROM users u JOIN students s ON s.user_id=u.id
            WHERE s.group_name=$1 AND u.role='student' AND u.is_active=TRUE`, [team.group_name]
        );
        for (const st of students) {
          await client.query(
            `INSERT INTO student_discounts (user_id, group_name, percent, reason, source, tournament_id, reward_id, granted_by)
             VALUES ($1,$2,$3,$4,'liga',$5,$6,$7)`,
            [st.id, team.group_name, value, r.note || 'IDU Liga sovrini', r.tournament_id, rid, req.user.id]
          );
          granted++;
        }
      }
    }
    await client.query('COMMIT');
    res.json({ id: rid, status: 'approved', value, granted_to: granted });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('reward decide:', e.message);
    res.status(500).json({ error: 'decide_failed' });
  } finally {
    client.release();
  }
});

// ── GET /api/competitions/my/discounts — student sees their own discounts ────
router.get('/my/discounts', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT d.percent, d.reason, d.created_at, t.title AS tournament_title
         FROM student_discounts d
         LEFT JOIN comp_tournaments t ON t.id = d.tournament_id
        WHERE d.user_id=$1 ORDER BY d.created_at DESC`, [req.user.id]
    );
    res.json(rows);
  } catch (e) {
    console.error('my discounts:', e.message);
    res.json([]);
  }
});

// Auto-propose rewards when a tournament completes (Phase 3 approves them).
// Champion → trophy + 10% discount proposal; runner-up → 5% discount proposal.
async function proposeRewards(client, tournamentId, championId, runnerUpId) {
  const q = client || db;
  // Avoid duplicates if called twice
  const { rows: existing } = await q.query(
    'SELECT 1 FROM comp_rewards WHERE tournament_id=$1 LIMIT 1', [tournamentId]
  );
  if (existing.length) return;
  await q.query(
    `INSERT INTO comp_rewards (tournament_id, team_id, type, value, placement, status, note)
     VALUES ($1,$2,'trophy',NULL,1,'proposed','Chempion kubogi')`,
    [tournamentId, championId]
  );
  await q.query(
    `INSERT INTO comp_rewards (tournament_id, team_id, type, value, placement, status, note)
     VALUES ($1,$2,'discount',10,1,'proposed','Chempion guruhga o''qish chegirmasi (taklif)')`,
    [tournamentId, championId]
  );
  if (runnerUpId) {
    await q.query(
      `INSERT INTO comp_rewards (tournament_id, team_id, type, value, placement, status, note)
       VALUES ($1,$2,'discount',5,2,'proposed','2-o''rin guruhga chegirma (taklif)')`,
      [tournamentId, runnerUpId]
    );
  }
}

module.exports = router;
module.exports.advanceWinner = advanceWinner;
module.exports.proposeRewards = proposeRewards;
module.exports.SUBJECTS = SUBJECTS;
