'use strict';

/**
 * IDU Liga — live quiz battle engine (Phase 2).
 *
 * Two academic groups answer the same shuffled questions in real time.
 * Scoring is normalised per participant (avg correct %) so a larger group
 * doesn't auto-win. Correct answers are held server-side until each question's
 * timer closes (anti-cheat). On finish: bracket advances, ELO updates, XP +
 * trophy awarded, and (if it was the final) reward proposals are created.
 *
 * NOTE: live match state is in-memory (single-instance). All answers are also
 * persisted, and the final result is computed from the DB, so a crash mid-match
 * loses only the timer loop, not the recorded answers.
 */

const db = require('../config/database');

let _award = null, _advance = null, _propose = null, _logger = console;
function deps() {
  if (!_award)   _award   = require('../routes/gamification').awardXP;
  if (!_advance) _advance = require('../routes/competitions').advanceWinner;
  if (!_propose) _propose = require('../routes/competitions').proposeRewards;
}

const live = new Map();               // matchId -> state
const room = (id) => 'comp:' + id;

function sanitizeQ(q, idx, total, endsAt) {
  return {
    qIndex: idx, total, endsAt,
    question: { id: q.id, text: q.question_text, a: q.option_a, b: q.option_b, c: q.option_c, d: q.option_d },
  };
}

async function computeScores(st) {
  const { rows } = await db.query(
    `SELECT team_id, COUNT(DISTINCT user_id)::int AS participants, COALESCE(SUM(correct),0)::int AS correct
       FROM comp_match_participants WHERE match_id=$1 GROUP BY team_id`, [st.matchId]
  );
  let a = { participants: 0, correct: 0 }, b = { participants: 0, correct: 0 };
  rows.forEach(r => { if (r.team_id === st.teamA) a = r; else if (r.team_id === st.teamB) b = r; });
  const pct = (o) => o.participants ? Math.round((o.correct / o.participants / st.qpm) * 1000) / 10 : 0;
  return {
    teamA: { id: st.teamA, participants: a.participants, correct: a.correct, score: pct(a) },
    teamB: { id: st.teamB, participants: b.participants, correct: b.correct, score: pct(b) },
  };
}

async function userTeam(userId, st) {
  if (st.userTeamCache[userId] !== undefined) return st.userTeamCache[userId];
  let team = null;
  try {
    const { rows: [r] } = await db.query('SELECT group_name FROM students WHERE user_id=$1', [userId]);
    if (r) {
      if (r.group_name === st.aGroup) team = st.teamA;
      else if (r.group_name === st.bGroup) team = st.teamB;
    }
  } catch (e) {}
  st.userTeamCache[userId] = team;
  return team;
}

async function startMatch(io, matchId, byUser) {
  matchId = parseInt(matchId, 10);
  if (live.has(matchId)) return { error: 'already_live' };
  deps();
  const { rows: [m] } = await db.query(
    `SELECT m.*, t.subject, t.questions_per_match AS qpm, t.seconds_per_question AS spq,
            t.total_rounds, t.id AS tid, t.status AS tstatus,
            ta.group_name AS a_group, ta.captain_user_id AS a_cap,
            tb.group_name AS b_group, tb.captain_user_id AS b_cap
       FROM comp_matches m
       JOIN comp_tournaments t ON t.id = m.tournament_id
       LEFT JOIN comp_teams ta ON ta.id = m.team_a_id
       LEFT JOIN comp_teams tb ON tb.id = m.team_b_id
      WHERE m.id=$1`, [matchId]
  );
  if (!m) return { error: 'not_found' };
  if (m.status === 'finished') return { error: 'finished' };
  if (!m.team_a_id || !m.team_b_id) return { error: 'teams_not_set' };

  const isStaff = byUser.role === 'dekanat' || byUser.role === 'admin';
  if (!isStaff && byUser.id !== m.a_cap && byUser.id !== m.b_cap) return { error: 'not_captain' };

  const { rows: qs } = await db.query(
    `SELECT id, question_text, option_a, option_b, option_c, option_d, correct_option
       FROM questions WHERE subject=$1 AND is_active=TRUE ORDER BY random() LIMIT $2`,
    [m.subject, m.qpm]
  );
  if (qs.length < Math.min(3, m.qpm)) return { error: 'not_enough_questions' };

  await db.query(
    "UPDATE comp_matches SET status='live', started_at=NOW(), question_ids=$1 WHERE id=$2",
    [JSON.stringify(qs.map(q => q.id)), matchId]
  );

  const st = {
    matchId, tid: m.tid, qIndex: -1, questions: qs,
    spq: m.spq || 20, qpm: m.qpm || qs.length,
    teamA: m.team_a_id, teamB: m.team_b_id, aGroup: m.a_group, bGroup: m.b_group,
    round: m.round, totalRounds: m.total_rounds,
    answered: {}, currentEndsAt: 0, timers: [], userTeamCache: {},
  };
  live.set(matchId, st);
  io.to(room(matchId)).emit('comp:start', { matchId, total: qs.length, spq: st.spq });
  setTimeout(() => nextQuestion(io, matchId), 1500);
  return { ok: true };
}

function nextQuestion(io, matchId) {
  const st = live.get(matchId);
  if (!st) return;
  st.qIndex++;
  if (st.qIndex >= st.questions.length) return finishMatch(io, matchId);
  const q = st.questions[st.qIndex];
  st.answered[st.qIndex] = new Set();
  const endsAt = Date.now() + st.spq * 1000;
  st.currentEndsAt = endsAt;
  io.to(room(matchId)).emit('comp:question', sanitizeQ(q, st.qIndex, st.questions.length, endsAt));
  st.timers.push(setTimeout(() => revealQuestion(io, matchId), st.spq * 1000));
}

async function revealQuestion(io, matchId) {
  const st = live.get(matchId);
  if (!st) return;
  const q = st.questions[st.qIndex];
  let scores = null;
  try { scores = await computeScores(st); } catch (e) {}
  io.to(room(matchId)).emit('comp:reveal', { qIndex: st.qIndex, correct_option: q.correct_option, scores });
  st.timers.push(setTimeout(() => nextQuestion(io, matchId), 3500));
}

async function updateRatings(client, winnerId, loserId) {
  const { rows } = await client.query('SELECT id, rating FROM comp_teams WHERE id = ANY($1::int[])', [[winnerId, loserId]]);
  const w = rows.find(r => r.id === winnerId), l = rows.find(r => r.id === loserId);
  const rW = w ? w.rating : 1000, rL = l ? l.rating : 1000;
  const K = 32;
  const expW = 1 / (1 + Math.pow(10, (rL - rW) / 400));
  const expL = 1 / (1 + Math.pow(10, (rW - rL) / 400));
  const newW = Math.round(rW + K * (1 - expW));
  const newL = Math.max(100, Math.round(rL + K * (0 - expL)));
  await client.query('UPDATE comp_teams SET rating=$1, played=played+1, wins=wins+1, points=points+3 WHERE id=$2', [newW, winnerId]);
  await client.query('UPDATE comp_teams SET rating=$1, played=played+1, losses=losses+1 WHERE id=$2', [newL, loserId]);
}

async function awardParticipants(matchId, winnerId, loserId) {
  try {
    deps();
    const { rows } = await db.query('SELECT user_id, team_id FROM comp_match_participants WHERE match_id=$1', [matchId]);
    for (const p of rows) {
      const win = p.team_id === winnerId;
      await _award(p.user_id, win ? 50 : 20, win ? "Liga g'alabasi 🏆" : 'Liga ishtiroki').catch(() => {});
    }
  } catch (e) {}
}

async function finishMatch(io, matchId) {
  const st = live.get(matchId);
  if (!st) return;
  st.timers.forEach(clearTimeout);
  deps();

  let scores;
  try { scores = await computeScores(st); }
  catch (e) { scores = { teamA: { id: st.teamA, score: 0, correct: 0 }, teamB: { id: st.teamB, score: 0, correct: 0 } }; }

  const aS = scores.teamA.score, bS = scores.teamB.score;
  let winner = st.teamA, loser = st.teamB;
  if (bS > aS) { winner = st.teamB; loser = st.teamA; }
  else if (aS === bS && scores.teamB.correct > scores.teamA.correct) { winner = st.teamB; loser = st.teamA; }

  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    await client.query("UPDATE comp_matches SET team_a_score=$1, team_b_score=$2, status='finished', ended_at=NOW() WHERE id=$3", [aS, bS, matchId]);
    await _advance(client, matchId, winner);
    await updateRatings(client, winner, loser);
    await client.query('UPDATE comp_teams SET eliminated=TRUE WHERE id=$1', [loser]);
    if (st.round === st.totalRounds) {
      await client.query("UPDATE comp_tournaments SET champion_team_id=$1, status='completed', updated_at=NOW() WHERE id=$2", [winner, st.tid]);
      await _propose(client, st.tid, winner, loser);
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    (_logger.error || _logger.log)('[battle] finish error: ' + e.message);
  } finally {
    client.release();
  }

  await awardParticipants(matchId, winner, loser);
  io.to(room(matchId)).emit('comp:end', { matchId, winner_team_id: winner, team_a_score: aS, team_b_score: bS, scores });
  live.delete(matchId);
}

// ── Socket handler registration (called per connection from socket.js) ────────
function registerBattle(io, socket, user) {
  socket.on('comp:join', async ({ matchId }, ack) => {
    matchId = parseInt(matchId, 10);
    if (isNaN(matchId)) return ack && ack({ error: 'bad_match' });
    socket.join(room(matchId));
    const st = live.get(matchId);
    if (!st) return ack && ack({ ok: true, live: false });
    let scores = null, myTeam = null;
    try { scores = await computeScores(st); } catch (e) {}
    try { myTeam = await userTeam(user.id, st); } catch (e) {}
    const cur = (st.qIndex >= 0 && Date.now() < st.currentEndsAt)
      ? sanitizeQ(st.questions[st.qIndex], st.qIndex, st.questions.length, st.currentEndsAt) : null;
    ack && ack({ ok: true, live: true, qIndex: st.qIndex, total: st.questions.length, myTeam, scores, current: cur });
  });

  socket.on('comp:start', async ({ matchId }, ack) => {
    try {
      const r = await startMatch(io, matchId, user);
      ack && ack(r);
    } catch (e) { ack && ack({ error: 'start_failed' }); }
  });

  socket.on('comp:answer', async ({ matchId, qIndex, choice }, ack) => {
    matchId = parseInt(matchId, 10); qIndex = parseInt(qIndex, 10);
    const st = live.get(matchId);
    if (!st) return ack && ack({ error: 'not_live' });
    if (qIndex !== st.qIndex || Date.now() > st.currentEndsAt) return ack && ack({ error: 'too_late' });
    const teamId = await userTeam(user.id, st);
    if (!teamId) return ack && ack({ error: 'not_participant' });
    if (st.answered[qIndex] && st.answered[qIndex].has(user.id)) return ack && ack({ error: 'already' });
    st.answered[qIndex] = st.answered[qIndex] || new Set();
    st.answered[qIndex].add(user.id);

    const q = st.questions[qIndex];
    const ch = String(choice || '').slice(0, 1).toUpperCase();
    const isCorrect = ch === q.correct_option;
    try {
      await db.query(
        'INSERT INTO comp_match_participants (match_id, team_id, user_id) VALUES ($1,$2,$3) ON CONFLICT (match_id,user_id) DO NOTHING',
        [matchId, teamId, user.id]
      );
      await db.query(
        `INSERT INTO comp_answers (match_id, user_id, team_id, question_id, q_index, choice, is_correct)
         VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (match_id,user_id,q_index) DO NOTHING`,
        [matchId, user.id, teamId, q.id, qIndex, ch, isCorrect]
      );
      await db.query(
        'UPDATE comp_match_participants SET correct=correct+$1, answered=answered+1 WHERE match_id=$2 AND user_id=$3',
        [isCorrect ? 1 : 0, matchId, user.id]
      );
    } catch (e) {}
    ack && ack({ ok: true, correct: isCorrect });
    try {
      const scores = await computeScores(st);
      io.to(room(matchId)).emit('comp:score', scores);
    } catch (e) {}
  });
}

module.exports = { registerBattle, startMatch };
