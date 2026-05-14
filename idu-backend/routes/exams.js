'use strict';

const express  = require('express');
const { body, param, query } = require('express-validator');

const db                    = require('../config/database');
const validate              = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

const VALID_SUBJECTS  = ['algo', 'ai', 'math', 'db', 'web'];
const VALID_EXAM_TYPES = ['test', 'sesiya'];

// ?? GET /api/exams/session-state ??????????????????????????????????????????????
// Check if test/sesiya is currently open (dekanat controls this)
router.get('/session-state', async (req, res) => {
  const { rows } = await db.query(
    `SELECT exam_type, is_open, opened_at, closes_at
     FROM exam_sessions
     WHERE is_open = TRUE
     ORDER BY opened_at DESC`
  );
  res.json(rows);
});

// ?? POST /api/exams/session-state ?????????????????????????????????????????????
// Dekanat: open or close test/sesiya
router.post(
  '/session-state',
  authorize('admin', 'dekanat'),
  [
    body('examType').isIn(VALID_EXAM_TYPES),
    body('isOpen').custom(v => v === true || v === false || v === 'true' || v === 'false').withMessage('isOpen must be boolean'),
    body('closesAt').optional({ nullable: true }).isISO8601().toDate(),
  ],
  validate,
  async (req, res) => {
    const { examType, closesAt } = req.body;
    const isOpen = req.body.isOpen === true || req.body.isOpen === 'true';

    await db.query(
      `INSERT INTO exam_sessions (exam_type, is_open, opened_at, closes_at, controlled_by)
       VALUES ($1, $2, NOW(), $3, $4)
       ON CONFLICT (exam_type) DO UPDATE
       SET is_open = $2, opened_at = NOW(), closes_at = $3, controlled_by = $4`,
      [examType, isOpen, closesAt || null, req.user.id]
    );

    res.json({ examType, isOpen, message: isOpen ? 'Exam opened' : 'Exam closed' });
  }
);

// ?? POST /api/exams/start ?????????????????????????????????????????????????????
// Student starts an exam -- returns shuffled questions (no answers)
router.post(
  '/start',
  authorize('student'),
  [
    body('examType').isIn(VALID_EXAM_TYPES),
    body('subject').isIn(VALID_SUBJECTS),
  ],
  validate,
  async (req, res) => {
    const { examType, subject } = req.body;

    // 1. Check if exam is open
    const { rows: sessionRows } = await db.query(
      `SELECT is_open, closes_at FROM exam_sessions WHERE exam_type = $1`,
      [examType]
    );
    if (!sessionRows.length || !sessionRows[0].is_open) {
      return res.status(403).json({ error: 'This exam is not currently open' });
    }
    if (sessionRows[0].closes_at && new Date() > new Date(sessionRows[0].closes_at)) {
      return res.status(403).json({ error: 'Exam session has expired' });
    }

    // 2. Check if student already has an active attempt
    const { rows: activeAttempts } = await db.query(
    `SELECT id FROM exam_attempts 
     WHERE student_id = $1 AND exam_type = $2 AND subject = $3 AND status = 'active'`,
    [req.user.id, examType, subject]
   );

   if (activeAttempts.length > 0) {
     return res.json({
    attemptId: activeAttempts[0].id
    });
  }

    // 3. Fetch questions
    const questionCount = examType === 'test' ? 20 : 30;
    const typeFilter    = examType === 'test'
      ? "(q.type = 'test' OR q.type = 'both')"
      : "(q.type = 'real' OR q.type = 'both')";

    const { rows: questions } = await db.query(
      `SELECT id, question_text, option_a, option_b, option_c, option_d
       FROM questions
       WHERE subject = $1 AND is_active = TRUE AND ${typeFilter}
       ORDER BY RANDOM()
       LIMIT $2`,
      [subject, questionCount]
    );

    if (questions.length < questionCount) {
      return res.status(503).json({
        error: `Not enough questions available. Need ${questionCount}, found ${questions.length}`,
      });
    }

    // 4. Create attempt record
    const durationMin = examType === 'test' ? 30 : 60;
    const expiresAt   = new Date(Date.now() + durationMin * 60 * 1000);

    const { rows: attemptRows } = await db.query(
      `INSERT INTO exam_attempts (student_id, exam_type, subject, question_ids, expires_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, expires_at`,
      [req.user.id, examType, subject, JSON.stringify(questions.map(q => q.id)), expiresAt]
    );

    res.status(201).json({
      attemptId:    attemptRows[0].id,
      expiresAt:    attemptRows[0].expires_at,
      durationMin,
      questions:    questions.map((q, i) => ({
        index:     i,
        id:        q.id,
        text:      q.question_text,
        options:   [q.option_a, q.option_b, q.option_c, q.option_d],
      })),
    });
  }
);

// ?? POST /api/exams/:attemptId/submit ?????????????????????????????????????????
// Student submits answers -- returns results with explanations
router.post(
  '/:attemptId/submit',
  [
    param('attemptId').isInt({ min: 1 }).toInt(),
    body('answers').custom(v => Array.isArray(v) || (v && typeof v === 'object')).withMessage('answers must be an object or array'), 
  ],
  validate,
  async (req, res) => {
    let { answers } = req.body;
    const { attemptId } = req.params;

    // Load attempt
    const { rows: attemptRows } = await db.query(
      `SELECT * FROM exam_attempts WHERE id = $1 AND student_id = $2`,
      [attemptId, req.user.id]
    );
    if (!attemptRows.length) return res.status(404).json({ error: 'Attempt not found' });

    const attempt = attemptRows[0];
    if (attempt.status !== 'active') {
      return res.status(409).json({ error: 'This attempt has already been submitted' });
    }
    if (new Date() > new Date(attempt.expires_at)) {
      // Auto-fail expired attempt
      await db.query(
        `UPDATE exam_attempts SET status = 'expired', submitted_at = NOW() WHERE id = $1`,
        [attemptId]
      );
      return res.status(410).json({ error: 'Exam time has expired' });
    }

    // Fetch questions with correct answers
    const questionIds = JSON.parse(attempt.question_ids);
    // Normalize answers (allow legacy array payload too)
if (Array.isArray(answers)) {
  const normalized = {};
  questionIds.forEach((qid, idx) => {
    if (answers[idx] !== undefined && answers[idx] !== null) {
      normalized[qid] = answers[idx];
    }
  });
  answers = normalized;
}
    const { rows: questions } = await db.query(
      `SELECT id, question_text, option_a, option_b, option_c, option_d, correct_option, explanation
       FROM questions WHERE id = ANY($1::int[])`,
      [questionIds]
    );

    // Sort to preserve original order
    const qMap = {};
    questions.forEach(q => { qMap[q.id] = q; });
    const orderedQs = questionIds.map(id => qMap[id]).filter(Boolean);

    // Grade
    let correct = 0;
    const resultDetails = orderedQs.map((q, i) => {
      const optionMap = { A: 0, B: 1, C: 2, D: 3 };
      const correctIdx = optionMap[q.correct_option];
      const chosenIdx  = answers[q.id] !== undefined ? parseInt(answers[q.id], 10) : -1;
      const isCorrect  = chosenIdx === correctIdx;
      if (isCorrect) correct++;
      return {
        index:         i,
        questionId:    q.id,
        questionText:  q.question_text,
        options:       [q.option_a, q.option_b, q.option_c, q.option_d],
        correctIndex:  correctIdx,
        chosenIndex:   chosenIdx,
        isCorrect,
        explanation:   q.explanation,
      };
    });

    const total         = orderedQs.length;
    const score         = Math.round((correct / total) * 100);
    const letterGrade   = score >= 86 ? 'A' : score >= 71 ? 'B' : score >= 56 ? 'C' : score >= 41 ? 'D' : 'F';

    // Save result
    await db.query(
  `UPDATE exam_attempts
   SET status = 'completed', submitted_at = NOW(),
       answers_json = $1, correct_count = $2, total_count = $3,
       score = $4, letter_grade = $5,
       warning_count = GREATEST(warning_count, $6),
       suspicion_score = GREATEST(suspicion_score, $7),
       integrity_hash = COALESCE($8, integrity_hash),
       force_submit_reason = COALESCE($9, force_submit_reason)
   WHERE id = $10`,
  [
    JSON.stringify(answers),
    correct,
    total,
    score,
    letterGrade,
    req.body.warnings || 0,
    req.body.suspicion || 0,
    req.body.integrity || null,
    req.body.reason || null,
    attemptId
  ]
);

    // Save exam score to grades table (auto-fill YN for sesiya or JN for test)
    // This is optional -- dekanat may prefer to manually finalize grades
    if (attempt.exam_type === 'test') {
      // Test contributes to JN (joriy nazorat) -- store as a reference
      await db.query(
        `INSERT INTO exam_results_log (attempt_id, student_id, exam_type, subject, score, letter_grade)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (attempt_id) DO NOTHING`,
        [attemptId, req.user.id, attempt.exam_type, attempt.subject, score, letterGrade]
      );
    }

    res.json({
      correct,
      total,
      score,
      letterGrade,
      passed:  letterGrade !== 'F',
      details: resultDetails,
    });
  }
);

// ?? GET /api/exams/history ????????????????????????????????????????????????????
router.get(
  '/history',
  [
    query('examType').optional().isIn(VALID_EXAM_TYPES),
    query('subject').optional().isIn(VALID_SUBJECTS),
  ],
  validate,
  async (req, res) => {
    let conditions = [];
    const params = [];

    if (req.user.role === 'student') {
      params.push(req.user.id);
      conditions.push(`a.student_id = $${params.length}`);
    }

    if (req.query.examType) {
      params.push(req.query.examType);
      conditions.push(`a.exam_type = $${params.length}`);
    }
    if (req.query.subject) {
      params.push(req.query.subject);
      conditions.push(`a.subject = $${params.length}`);
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const { rows } = await db.query(
      `SELECT a.id, u.full_name AS student_name,
              a.exam_type, a.subject, a.score, a.letter_grade,
              a.correct_count, a.total_count, a.status,
              a.started_at, a.submitted_at
       FROM exam_attempts a
       JOIN users u ON u.id = a.student_id
       ${where}
       ORDER BY a.started_at DESC
       LIMIT 100`,
      params
    );

    res.json(rows);
  }
);
// TIME
router.get('/time', async (req, res) => {
  res.json({ serverTime: Date.now() });
});

// HEARTBEAT
router.post('/:attemptId/heartbeat', async (req, res) => {
  const { attemptId } = req.params;

  const { rowCount } = await db.query(
    `UPDATE exam_attempts
     SET last_heartbeat_at = NOW(),
         heartbeat_count = heartbeat_count + 1,
         warning_count = GREATEST(warning_count, $1),
         suspicion_score = GREATEST(suspicion_score, $2)
     WHERE id = $3 AND student_id = $4 AND status = 'active'`,
    [
      req.body.tabWarnings || 0,
      req.body.suspicion || 0,
      attemptId,
      req.user.id
    ]
  );

  if (!rowCount) return res.status(404).json({ error: 'Active attempt not found' });

  res.json({ ok: true });
});

// AUTOSAVE
router.post('/:attemptId/save', async (req, res) => {
  const { attemptId } = req.params;
  const { answers } = req.body;

  const { rowCount } = await db.query(
    `UPDATE exam_attempts
     SET saved_answers_json = $1,
         last_heartbeat_at = NOW()
     WHERE id = $2 AND student_id = $3 AND status = 'active'`,
    [
      JSON.stringify(answers || {}),
      attemptId,
      req.user.id
    ]
  );

  if (!rowCount) return res.status(404).json({ error: 'Active attempt not found' });

  res.json({ ok: true });
});

// SECURITY LOG
router.post('/:attemptId/log', async (req, res) => {
  const { attemptId } = req.params;

  const { rowCount } = await db.query(
    `UPDATE exam_attempts
     SET suspicion_score = GREATEST(suspicion_score, $1)
     WHERE id = $2 AND student_id = $3`,
    [
      req.body.suspicion || 0,
      attemptId,
      req.user.id
    ]
  );
  await db.query(
  `INSERT INTO exam_security_logs (attempt_id, student_id, event_type, event_data, suspicion_score)
   VALUES ($1, $2, $3, $4, $5)`,
  [
    attemptId,
    req.user.id,
    req.body.eventType || 'UNKNOWN',
    JSON.stringify(req.body.eventData || {}),
    req.body.suspicion || 0
  ]
);

  if (!rowCount) return res.status(404).json({ error: 'Attempt not found' });

  res.json({ ok: true });
});

// POST /api/exams/record-result — local fallback rejimida natijani saqlash
router.post('/record-result', async (req, res) => {
  const { subject, examType, score, correct_count, total_count } = req.body;

  const VALID_SUBJECTS = ['algo', 'ai', 'math', 'db', 'web'];
  const VALID_TYPES    = ['test', 'real', 'sesiya'];

  if (!VALID_SUBJECTS.includes(subject)) return res.status(400).json({ error: 'Noto\'g\'ri fan' });
  if (!VALID_TYPES.includes(examType))   return res.status(400).json({ error: 'Noto\'g\'ri tur' });

  const pct         = Math.min(100, Math.max(0, Number(score) || 0));
  const letterGrade = pct >= 86 ? 'A' : pct >= 71 ? 'B' : pct >= 56 ? 'C' : pct >= 41 ? 'D' : 'F';
  const correct     = Number(correct_count) || 0;
  const total       = Number(total_count)   || 0;

  const { rows } = await db.query(
    `INSERT INTO exam_attempts
       (student_id, exam_type, subject, question_ids, status,
        score, letter_grade, correct_count, total_count, submitted_at, expires_at)
     VALUES ($1,$2,$3,'[]','completed',$4,$5,$6,$7,NOW(),NOW())
     RETURNING id`,
    [req.user.id, examType, subject, pct, letterGrade, correct, total]
  );

  // Natijani grades jadvaliga ham yoz
  try {
    await db.query(
      `INSERT INTO exam_results_log (attempt_id, student_id, exam_type, subject, score, letter_grade)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT DO NOTHING`,
      [rows[0].id, req.user.id, examType, subject, pct, letterGrade]
    );
  } catch (_) { /* optional table, ignore if not exists */ }

  res.status(201).json({ saved: true, attemptId: rows[0].id, letterGrade, score: pct });
});

module.exports = router;
