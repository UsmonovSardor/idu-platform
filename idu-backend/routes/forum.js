'use strict';
/**
 * Forum / Q&A endpoints
 *   GET    /forum/questions            → list (paginated, sortable)
 *   GET    /forum/questions/:id        → detail + answers
 *   POST   /forum/questions            → create
 *   POST   /forum/questions/:id/answers→ post answer
 *   POST   /forum/vote                 → upvote question/answer
 *   POST   /forum/accept/:answerId     → mark answer as accepted
 *   DELETE /forum/questions/:id        → delete own question
 *   DELETE /forum/answers/:id          → delete own answer
 */

const express = require('express');
const { body, query, param } = require('express-validator');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const db = require('../config/database');

const router = express.Router();
router.use(authenticate);

// ── GET /questions ────────────────────────────────────────────────────────────
router.get(
  '/questions',
  [
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('offset').optional().isInt({ min: 0 }).toInt(),
    query('category').optional().isString(),
    query('sort').optional().isIn(['recent', 'popular', 'unanswered']),
    query('search').optional().isString().isLength({ max: 100 }),
  ],
  validate,
  async (req, res) => {
    const limit  = req.query.limit  || 20;
    const offset = req.query.offset || 0;
    const sort   = req.query.sort   || 'recent';
    const cat    = req.query.category || null;
    const search = req.query.search   || null;

    const orderBy = sort === 'popular'
      ? 'q.upvotes DESC, q.created_at DESC'
      : sort === 'unanswered'
      ? '(SELECT COUNT(*) FROM forum_answers WHERE question_id = q.id) ASC, q.created_at DESC'
      : 'q.created_at DESC';

    const whereParts = [];
    const params = [];
    if (cat) { params.push(cat);    whereParts.push(`q.category = $${params.length}`); }
    if (search) { params.push('%' + search + '%'); whereParts.push(`(q.title ILIKE $${params.length} OR q.body ILIKE $${params.length})`); }
    const where = whereParts.length ? 'WHERE ' + whereParts.join(' AND ') : '';

    params.push(limit, offset);
    const { rows } = await db.query(
      `SELECT q.id, q.title, q.body, q.category, q.views, q.upvotes,
              q.is_solved, q.created_at,
              u.full_name AS author_name, u.avatar_url AS author_avatar, u.role AS author_role,
              (SELECT COUNT(*) FROM forum_answers WHERE question_id = q.id) AS answer_count
       FROM forum_questions q
       JOIN users u ON u.id = q.user_id
       ${where}
       ORDER BY ${orderBy}
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    const { rows: countRows } = await db.query(
      `SELECT COUNT(*)::int AS total FROM forum_questions q ${where}`,
      params.slice(0, params.length - 2)
    );

    res.json({ questions: rows, total: countRows[0].total });
  }
);

// ── GET /questions/:id ────────────────────────────────────────────────────────
router.get('/questions/:id', [param('id').isInt().toInt()], validate, async (req, res) => {
  const { id } = req.params;
  await db.query('UPDATE forum_questions SET views = views + 1 WHERE id = $1', [id]);

  const { rows: qRows } = await db.query(
    `SELECT q.*, u.full_name AS author_name, u.avatar_url AS author_avatar, u.role AS author_role
     FROM forum_questions q JOIN users u ON u.id = q.user_id WHERE q.id = $1`,
    [id]
  );
  if (!qRows.length) return res.status(404).json({ error: 'Savol topilmadi' });

  const { rows: answers } = await db.query(
    `SELECT a.id, a.body, a.upvotes, a.is_accepted, a.created_at, a.user_id,
            u.full_name AS author_name, u.avatar_url AS author_avatar, u.role AS author_role
     FROM forum_answers a JOIN users u ON u.id = a.user_id
     WHERE a.question_id = $1
     ORDER BY a.is_accepted DESC, a.upvotes DESC, a.created_at ASC`,
    [id]
  );

  // User's existing votes on these answers
  const answerIds = answers.map(a => a.id);
  const { rows: userVotes } = answerIds.length
    ? await db.query(
        `SELECT target_id FROM forum_votes
         WHERE user_id = $1 AND target_type = 'answer' AND target_id = ANY($2::int[])`,
        [req.user.id, answerIds]
      )
    : { rows: [] };
  const votedSet = new Set(userVotes.map(v => v.target_id));
  answers.forEach(a => { a.user_voted = votedSet.has(a.id); });

  res.json({ question: qRows[0], answers });
});

// ── POST /questions ───────────────────────────────────────────────────────────
router.post(
  '/questions',
  [
    body('title').isString().trim().isLength({ min: 5, max: 200 }),
    body('body').isString().trim().isLength({ min: 10, max: 5000 }),
    body('category').optional().isString().isLength({ max: 50 }),
  ],
  validate,
  async (req, res) => {
    const { title, body: questionBody, category } = req.body;
    const { rows } = await db.query(
      `INSERT INTO forum_questions (user_id, title, body, category)
       VALUES ($1,$2,$3,$4) RETURNING id, created_at`,
      [req.user.id, title, questionBody, category || 'umumiy']
    );
    res.status(201).json({ id: rows[0].id, created_at: rows[0].created_at });
  }
);

// ── POST /questions/:id/answers ───────────────────────────────────────────────
router.post(
  '/questions/:id/answers',
  [
    param('id').isInt().toInt(),
    body('body').isString().trim().isLength({ min: 5, max: 5000 }),
  ],
  validate,
  async (req, res) => {
    const { rows } = await db.query(
      `INSERT INTO forum_answers (question_id, user_id, body)
       VALUES ($1,$2,$3) RETURNING id, created_at`,
      [req.params.id, req.user.id, req.body.body]
    );
    res.status(201).json({ id: rows[0].id, created_at: rows[0].created_at });
  }
);

// ── POST /vote ────────────────────────────────────────────────────────────────
router.post(
  '/vote',
  [
    body('targetType').isIn(['question', 'answer']),
    body('targetId').isInt(),
  ],
  validate,
  async (req, res) => {
    const { targetType, targetId } = req.body;
    // Toggle: if already voted, remove vote
    const existing = await db.query(
      `SELECT id FROM forum_votes
       WHERE user_id = $1 AND target_type = $2 AND target_id = $3`,
      [req.user.id, targetType, targetId]
    );

    const table = targetType === 'question' ? 'forum_questions' : 'forum_answers';
    if (existing.rows.length) {
      await db.query('DELETE FROM forum_votes WHERE id = $1', [existing.rows[0].id]);
      await db.query(`UPDATE ${table} SET upvotes = GREATEST(upvotes - 1, 0) WHERE id = $1`, [targetId]);
      return res.json({ voted: false });
    }
    await db.query(
      `INSERT INTO forum_votes (user_id, target_type, target_id, value)
       VALUES ($1,$2,$3,1)`,
      [req.user.id, targetType, targetId]
    );
    await db.query(`UPDATE ${table} SET upvotes = upvotes + 1 WHERE id = $1`, [targetId]);
    res.json({ voted: true });
  }
);

// ── POST /accept/:answerId ────────────────────────────────────────────────────
router.post('/accept/:answerId', [param('answerId').isInt().toInt()], validate, async (req, res) => {
  const { rows } = await db.query(
    `SELECT a.id, a.question_id, q.user_id AS asker_id
     FROM forum_answers a JOIN forum_questions q ON q.id = a.question_id
     WHERE a.id = $1`,
    [req.params.answerId]
  );
  if (!rows.length) return res.status(404).json({ error: 'Javob topilmadi' });
  if (rows[0].asker_id !== req.user.id) {
    return res.status(403).json({ error: 'Faqat savol muallifi tanlay oladi' });
  }

  // Unaccept previous + accept new + mark solved
  await db.query(`UPDATE forum_answers SET is_accepted = FALSE WHERE question_id = $1`, [rows[0].question_id]);
  await db.query(`UPDATE forum_answers SET is_accepted = TRUE  WHERE id = $1`, [req.params.answerId]);
  await db.query(
    `UPDATE forum_questions SET is_solved = TRUE, accepted_answer_id = $1 WHERE id = $2`,
    [req.params.answerId, rows[0].question_id]
  );
  res.json({ ok: true });
});

// ── DELETE /questions/:id ─────────────────────────────────────────────────────
router.delete('/questions/:id', [param('id').isInt().toInt()], validate, async (req, res) => {
  const { rows } = await db.query('SELECT user_id FROM forum_questions WHERE id = $1', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Topilmadi' });
  if (rows[0].user_id !== req.user.id && req.user.role !== 'admin' && req.user.role !== 'dekanat') {
    return res.status(403).json({ error: 'Ruxsat yo\'q' });
  }
  await db.query('DELETE FROM forum_questions WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

// ── DELETE /answers/:id ───────────────────────────────────────────────────────
router.delete('/answers/:id', [param('id').isInt().toInt()], validate, async (req, res) => {
  const { rows } = await db.query('SELECT user_id FROM forum_answers WHERE id = $1', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Topilmadi' });
  if (rows[0].user_id !== req.user.id && req.user.role !== 'admin' && req.user.role !== 'dekanat') {
    return res.status(403).json({ error: 'Ruxsat yo\'q' });
  }
  await db.query('DELETE FROM forum_answers WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

module.exports = router;
