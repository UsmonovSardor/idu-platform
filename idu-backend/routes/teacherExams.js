'use strict';

const express = require('express');
const multer  = require('multer');
const db      = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

const VALID_TYPES = ['oraliq', 'joriy', 'yakuniy', 'practice'];

// Shared PDF/text question parser (re-uses logic from questions route)
function parseQuestions(rawText) {
  if (!rawText) return [];
  const text = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\f/g, '\n');
  const BLOCK_START = /^\s*(\d{1,3})[.):\s]\s*(.+)/;
  const OPT_RE      = /^[(]?([AaBbCcDd]|[АБВГ])[.):\-\s]\s*(.+)/;
  const CORR_RE = [
    /(?:to[''`]?g[''`]?ri|togri|javob|answer|correct|правильн[ыо]й?)[:\s]+([ABCDАБВГ])/i,
    /\*\*([ABCD])\*\*/, /\[([ABCD])\]/
  ];
  const CYR = { 'А':'A','В':'B','С':'C','Д':'D','Б':'B' };
  const norm = c => CYR[c] || c.toUpperCase();

  const lines = text.split('\n');
  const blocks = [];
  let current = null;
  for (const line of lines) {
    const m = line.match(BLOCK_START);
    if (m) {
      const num = parseInt(m[1], 10);
      const last = current ? current.num : 0;
      if (!current || num === last + 1 || num === 1 || (num > last && num <= last + 5)) {
        if (current) blocks.push(current);
        current = { num, lines: [m[2].trim()] };
        continue;
      }
    }
    if (current) {
      const t = line.trim();
      if (t) current.lines.push(t);
    }
  }
  if (current) blocks.push(current);

  const questions = [];
  for (const b of blocks) {
    const qParts = [];
    let optIdx = b.lines.length;
    for (let i = 0; i < b.lines.length; i++) {
      if (OPT_RE.test(b.lines[i])) { optIdx = i; break; }
      qParts.push(b.lines[i]);
    }
    const qText = qParts.join(' ').trim();
    if (!qText) continue;

    let a,b2,c,d,correct,explanation;
    for (let i = optIdx; i < b.lines.length; i++) {
      const line = b.lines[i];
      const om = line.match(OPT_RE);
      if (om) {
        const L = norm(om[1]);
        const v = om[2].trim();
        if (L==='A') a=v; else if (L==='B') b2=v; else if (L==='C') c=v; else if (L==='D') d=v;
        continue;
      }
      for (const re of CORR_RE) {
        const cm = line.match(re);
        if (cm) { correct = norm(cm[1]); break; }
      }
      const iz = line.match(/^(?:izoh|explanation|note|tushuntirish)[:\s]+(.+)/i);
      if (iz) explanation = iz[1].trim();
    }
    if (!a || !b2) continue;
    questions.push({
      text: qText, a, b: b2, c: c || '—', d: d || '—',
      correct: ['A','B','C','D'].includes(correct) ? correct : 'A',
      explanation: explanation || null
    });
  }
  return questions;
}

// ── GET /api/teacher-exams ────────────────────────────────────────────────────
// Teacher: list own exams · Student: list exams for their group
router.get('/', async (req, res) => {
  if (req.user.role === 'student') {
    // Find student's group via students table
    const { rows: [me] } = await db.query(
      'SELECT st.group_name FROM students st WHERE st.user_id=$1', [req.user.id]
    );
    const grp = me ? me.group_name : '';
    const { rows } = await db.query(
      `SELECT e.id, e.title, e.subject, e.exam_type, e.duration_min, e.total_score,
              e.starts_at, e.ends_at, e.show_results,
              u.full_name AS teacher_name,
              (SELECT COUNT(*) FROM teacher_exam_questions WHERE exam_id=e.id) AS q_count,
              (SELECT status FROM teacher_exam_attempts WHERE exam_id=e.id AND student_id=$2) AS my_status,
              (SELECT score FROM teacher_exam_attempts WHERE exam_id=e.id AND student_id=$2) AS my_score
       FROM teacher_exams e
       JOIN users u ON u.id=e.teacher_id
       WHERE e.group_name=$1 AND e.is_active=TRUE
         AND (e.starts_at IS NULL OR e.starts_at <= NOW())
         AND (e.ends_at IS NULL OR e.ends_at >= NOW())
       ORDER BY e.created_at DESC`,
      [grp, req.user.id]
    );
    return res.json(rows);
  }

  if (req.user.role === 'teacher' || req.user.role === 'dekanat' || req.user.role === 'admin') {
    const whereTeacher = req.user.role === 'teacher' ? 'WHERE e.teacher_id=$1' : '';
    const params = req.user.role === 'teacher' ? [req.user.id] : [];
    const { rows } = await db.query(
      `SELECT e.*,
              (SELECT COUNT(*) FROM teacher_exam_questions WHERE exam_id=e.id) AS q_count,
              (SELECT COUNT(*) FROM teacher_exam_attempts WHERE exam_id=e.id AND status IN ('submitted','auto_submitted')) AS submitted_count
       FROM teacher_exams e
       ${whereTeacher}
       ORDER BY e.created_at DESC`,
      params
    );
    return res.json(rows);
  }

  res.status(403).json({ error: 'Ruxsat yo\'q' });
});

// ── POST /api/teacher-exams ───────────────────────────────────────────────────
router.post('/', authorize('teacher', 'dekanat', 'admin'), async (req, res) => {
  const {
    title, description, subject, group, examType = 'practice',
    durationMin = 30, totalScore = 100,
    shuffleQ = true, shuffleOpts = true, showResults = true,
    startsAt = null, endsAt = null
  } = req.body;

  if (!title || !subject || !group) {
    return res.status(400).json({ error: 'title, subject, group kerak' });
  }
  if (!VALID_TYPES.includes(examType)) {
    return res.status(400).json({ error: 'Noto\'g\'ri imtihon turi' });
  }

  const { rows } = await db.query(
    `INSERT INTO teacher_exams
       (teacher_id, title, description, subject, group_name, exam_type,
        duration_min, total_score, shuffle_q, shuffle_opts, show_results,
        starts_at, ends_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     RETURNING *`,
    [req.user.id, title, description || null, subject, group, examType,
     durationMin, totalScore, shuffleQ, shuffleOpts, showResults,
     startsAt, endsAt]
  );
  res.status(201).json(rows[0]);
});

// ── PUT /api/teacher-exams/:id ────────────────────────────────────────────────
router.put('/:id', authorize('teacher', 'dekanat', 'admin'), async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const fields = ['title','description','subject','group_name','exam_type',
    'duration_min','total_score','shuffle_q','shuffle_opts','show_results',
    'starts_at','ends_at','is_active'];
  const map = {
    group_name: 'group', duration_min:'durationMin', total_score:'totalScore',
    exam_type:'examType', shuffle_q:'shuffleQ', shuffle_opts:'shuffleOpts',
    show_results:'showResults', starts_at:'startsAt', ends_at:'endsAt',
    is_active:'isActive'
  };
  const sets = [];
  const params = [id];
  for (const f of fields) {
    const key = map[f] || f;
    if (req.body[key] !== undefined) {
      params.push(req.body[key]);
      sets.push(`${f}=$${params.length}`);
    }
  }
  if (!sets.length) return res.status(400).json({ error: 'O\'zgartirish yo\'q' });

  const cond = req.user.role === 'teacher' ? ' AND teacher_id=$' + (params.length+1) : '';
  if (req.user.role === 'teacher') params.push(req.user.id);

  const { rows, rowCount } = await db.query(
    `UPDATE teacher_exams SET ${sets.join(', ')}, updated_at=NOW()
     WHERE id=$1${cond} RETURNING *`,
    params
  );
  if (!rowCount) return res.status(404).json({ error: 'Imtihon topilmadi' });
  res.json(rows[0]);
});

// ── DELETE /api/teacher-exams/:id ─────────────────────────────────────────────
router.delete('/:id', authorize('teacher','dekanat','admin'), async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const params = [id];
  let cond = '';
  if (req.user.role === 'teacher') { cond = ' AND teacher_id=$2'; params.push(req.user.id); }
  const { rowCount } = await db.query(`DELETE FROM teacher_exams WHERE id=$1${cond}`, params);
  if (!rowCount) return res.status(404).json({ error: 'Imtihon topilmadi' });
  res.json({ message: 'O\'chirildi' });
});

// ── POST /api/teacher-exams/:id/questions ─────────────────────────────────────
// Add single question (manual entry)
router.post('/:id/questions', authorize('teacher','dekanat','admin'), async (req, res) => {
  const examId = parseInt(req.params.id, 10);
  const { questionText, optionA, optionB, optionC, optionD, correctOption, explanation } = req.body;

  if (!questionText || !optionA || !optionB) {
    return res.status(400).json({ error: 'Savol va A,B variantlar kerak' });
  }
  if (!['A','B','C','D'].includes(correctOption)) {
    return res.status(400).json({ error: 'correctOption A/B/C/D bo\'lishi kerak' });
  }

  // Verify ownership
  const { rows: [exam] } = await db.query('SELECT teacher_id FROM teacher_exams WHERE id=$1', [examId]);
  if (!exam) return res.status(404).json({ error: 'Imtihon topilmadi' });
  if (req.user.role === 'teacher' && exam.teacher_id !== req.user.id) {
    return res.status(403).json({ error: 'Sizning imtihoningiz emas' });
  }

  const { rows: [{ pos }] } = await db.query(
    'SELECT COALESCE(MAX(position),0)+1 AS pos FROM teacher_exam_questions WHERE exam_id=$1',
    [examId]
  );

  const { rows } = await db.query(
    `INSERT INTO teacher_exam_questions
       (exam_id, question_text, option_a, option_b, option_c, option_d,
        correct_option, explanation, position)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING *`,
    [examId, questionText, optionA, optionB, optionC || '—', optionD || '—',
     correctOption, explanation || null, pos]
  );
  res.status(201).json(rows[0]);
});

// ── POST /api/teacher-exams/:id/upload ────────────────────────────────────────
// Upload PDF/TXT/CSV with questions
router.post(
  '/:id/upload',
  authorize('teacher','dekanat','admin'),
  (req, res, next) => {
    const upload = multer({
      storage: multer.memoryStorage(),
      limits: { fileSize: 15 * 1024 * 1024 },
      fileFilter: (req, file, cb) => {
        const ext = (file.originalname || '').split('.').pop().toLowerCase();
        if (['pdf','txt','csv','doc','docx','json'].includes(ext)) cb(null, true);
        else cb(new Error('PDF/TXT/CSV/DOC/JSON kerak'));
      }
    }).single('file');
    upload(req, res, next);
  },
  async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Fayl yuklanmadi' });
    const examId = parseInt(req.params.id, 10);

    const { rows: [exam] } = await db.query('SELECT teacher_id FROM teacher_exams WHERE id=$1', [examId]);
    if (!exam) return res.status(404).json({ error: 'Imtihon topilmadi' });
    if (req.user.role === 'teacher' && exam.teacher_id !== req.user.id) {
      return res.status(403).json({ error: 'Sizning imtihoningiz emas' });
    }

    const ext = (req.file.originalname || '').split('.').pop().toLowerCase();
    let questions = [];

    try {
      if (ext === 'json') {
        const arr = JSON.parse(req.file.buffer.toString('utf8'));
        if (!Array.isArray(arr)) return res.status(400).json({ error: 'JSON massiv kerak' });
        questions = arr.map(q => ({
          text: q.question_text || q.text || q.question,
          a: q.option_a || q.a, b: q.option_b || q.b,
          c: q.option_c || q.c, d: q.option_d || q.d,
          correct: (q.correct_option || q.correct || 'A').toUpperCase(),
          explanation: q.explanation || null
        })).filter(q => q.text && q.a && q.b);
      } else if (ext === 'pdf') {
        let pdfParse;
        try { pdfParse = require('pdf-parse/lib/pdf-parse'); }
        catch(e) { pdfParse = require('pdf-parse'); }
        const data = await pdfParse(req.file.buffer);
        questions = parseQuestions(data.text);
      } else {
        questions = parseQuestions(req.file.buffer.toString('utf8'));
      }
    } catch (err) {
      return res.status(422).json({ error: 'Faylni o\'qib bo\'lmadi: ' + err.message });
    }

    if (!questions.length) {
      return res.status(422).json({ error: 'Savollar topilmadi' });
    }

    const client = await db.getClient();
    const inserted = [];
    try {
      await client.query('BEGIN');
      const { rows: [{ pos }] } = await client.query(
        'SELECT COALESCE(MAX(position),0) AS pos FROM teacher_exam_questions WHERE exam_id=$1',
        [examId]
      );
      let nextPos = pos + 1;
      for (const q of questions) {
        const { rows } = await client.query(
          `INSERT INTO teacher_exam_questions
             (exam_id, question_text, option_a, option_b, option_c, option_d,
              correct_option, explanation, position)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
          [examId, q.text, q.a, q.b, q.c || '—', q.d || '—', q.correct, q.explanation, nextPos++]
        );
        inserted.push(rows[0].id);
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      return res.status(500).json({ error: e.message });
    } finally {
      client.release();
    }

    res.status(201).json({
      message: `${inserted.length} savol qo'shildi`,
      inserted: inserted.length,
      parsed: questions.length
    });
  }
);

// ── GET /api/teacher-exams/:id/questions ─────────────────────────────────────
// Returns all questions (without correct answers for students mid-attempt)
router.get('/:id/questions', async (req, res) => {
  const examId = parseInt(req.params.id, 10);
  const { rows } = await db.query(
    `SELECT id, question_text, option_a, option_b, option_c, option_d, position,
            ${req.user.role === 'student' ? 'NULL' : 'correct_option'} AS correct_option,
            ${req.user.role === 'student' ? 'NULL' : 'explanation'} AS explanation
     FROM teacher_exam_questions
     WHERE exam_id=$1 ORDER BY position`,
    [examId]
  );
  res.json(rows);
});

// ── DELETE /api/teacher-exams/:id/questions/:qid ─────────────────────────────
router.delete('/:id/questions/:qid', authorize('teacher','dekanat','admin'), async (req, res) => {
  await db.query(
    'DELETE FROM teacher_exam_questions WHERE id=$1 AND exam_id=$2',
    [req.params.qid, req.params.id]
  );
  res.json({ message: 'O\'chirildi' });
});

// ── POST /api/teacher-exams/:id/start ────────────────────────────────────────
// Student starts an attempt → returns shuffled questions WITHOUT correct answers
router.post('/:id/start', authorize('student'), async (req, res) => {
  const examId = parseInt(req.params.id, 10);

  const { rows: [exam] } = await db.query(
    'SELECT * FROM teacher_exams WHERE id=$1 AND is_active=TRUE', [examId]
  );
  if (!exam) return res.status(404).json({ error: 'Imtihon topilmadi yoki yopilgan' });

  // Check group via students table
  const { rows: [me] } = await db.query(
    'SELECT st.group_name FROM students st WHERE st.user_id=$1', [req.user.id]
  );
  if (me && me.group_name !== exam.group_name) {
    return res.status(403).json({ error: 'Bu imtihon sizning guruhingiz uchun emas' });
  }

  // Time window
  const now = new Date();
  if (exam.starts_at && now < new Date(exam.starts_at)) {
    return res.status(403).json({ error: 'Imtihon hali boshlanmadi' });
  }
  if (exam.ends_at && now > new Date(exam.ends_at)) {
    return res.status(403).json({ error: 'Imtihon muddati tugagan' });
  }

  // Existing attempt?
  const { rows: [existing] } = await db.query(
    'SELECT * FROM teacher_exam_attempts WHERE exam_id=$1 AND student_id=$2',
    [examId, req.user.id]
  );

  if (existing && existing.status !== 'in_progress') {
    return res.status(409).json({
      error: 'Siz allaqachon topshirgansiz',
      score: existing.score,
      submittedAt: existing.submitted_at
    });
  }

  if (!existing) {
    await db.query(
      'INSERT INTO teacher_exam_attempts (exam_id, student_id) VALUES ($1,$2)',
      [examId, req.user.id]
    );
  }

  // Fetch questions
  const { rows: questions } = await db.query(
    `SELECT id, question_text, option_a, option_b, option_c, option_d
     FROM teacher_exam_questions WHERE exam_id=$1 ORDER BY position`,
    [examId]
  );

  let qs = questions;
  if (exam.shuffle_q) qs = qs.sort(() => Math.random() - 0.5);

  // Shuffle option labels but keep mapping so student answer can be reversed
  // For simplicity, return as-is (A=option_a)
  const startedAt = existing ? existing.started_at : new Date();
  res.json({
    exam: {
      id: exam.id, title: exam.title, description: exam.description,
      subject: exam.subject, examType: exam.exam_type,
      durationMin: exam.duration_min, totalScore: exam.total_score
    },
    startedAt,
    deadline: new Date(new Date(startedAt).getTime() + exam.duration_min * 60000),
    questions: qs
  });
});

// ── POST /api/teacher-exams/:id/submit ───────────────────────────────────────
// Student submits answers { questionId: 'A' | 'B' | 'C' | 'D' }
router.post('/:id/submit', authorize('student'), async (req, res) => {
  const examId = parseInt(req.params.id, 10);
  const { answers = {}, autoSubmit = false, cheated = false } = req.body;

  const { rows: [exam] } = await db.query('SELECT * FROM teacher_exams WHERE id=$1', [examId]);
  if (!exam) return res.status(404).json({ error: 'Imtihon topilmadi' });

  const { rows: questions } = await db.query(
    'SELECT id, correct_option FROM teacher_exam_questions WHERE exam_id=$1', [examId]
  );

  let correct = 0;
  const total = questions.length;
  for (const q of questions) {
    if (answers[q.id] && answers[q.id].toUpperCase() === q.correct_option) correct++;
  }
  const score = total ? (correct / total) * exam.total_score : 0;

  const status = cheated ? 'cheated' : (autoSubmit ? 'auto_submitted' : 'submitted');

  const { rows } = await db.query(
    `UPDATE teacher_exam_attempts
     SET answers=$1, score=$2, correct_count=$3, total_count=$4,
         status=$5, submitted_at=NOW(),
         cheat_warnings = CASE WHEN $6=TRUE THEN cheat_warnings+10 ELSE cheat_warnings END
     WHERE exam_id=$7 AND student_id=$8
     RETURNING *`,
    [answers, score.toFixed(2), correct, total, status, cheated, examId, req.user.id]
  );

  if (!rows.length) return res.status(400).json({ error: 'Topshirilmadi (boshlanmagan)' });

  res.json({
    score: parseFloat(score.toFixed(2)),
    correct, total,
    status,
    showResults: exam.show_results,
    grade: score >= 86 ? 'A' : score >= 71 ? 'B' : score >= 56 ? 'C' : score >= 41 ? 'D' : 'F'
  });
});

// ── POST /api/teacher-exams/:id/cheat-warn ───────────────────────────────────
// Student window-leave / copy-paste detected — log warning
router.post('/:id/cheat-warn', authorize('student'), async (req, res) => {
  const examId = parseInt(req.params.id, 10);
  const reason = (req.body.reason || 'unknown').substring(0, 50);

  await db.query(
    `UPDATE teacher_exam_attempts
     SET cheat_warnings = cheat_warnings + 1
     WHERE exam_id=$1 AND student_id=$2 AND status='in_progress'`,
    [examId, req.user.id]
  );

  const { rows } = await db.query(
    `SELECT cheat_warnings FROM teacher_exam_attempts
     WHERE exam_id=$1 AND student_id=$2`, [examId, req.user.id]
  );
  res.json({ warnings: rows[0] ? rows[0].cheat_warnings : 0, reason });
});

// ── GET /api/teacher-exams/:id/results ───────────────────────────────────────
// Teacher: all student results for this exam
router.get('/:id/results', authorize('teacher','dekanat','admin'), async (req, res) => {
  const examId = parseInt(req.params.id, 10);
  const { rows } = await db.query(
    `SELECT a.student_id, a.score, a.correct_count, a.total_count, a.status,
            a.cheat_warnings, a.started_at, a.submitted_at,
            u.full_name, u.login AS email
     FROM teacher_exam_attempts a
     JOIN users u ON u.id=a.student_id
     WHERE a.exam_id=$1
     ORDER BY a.score DESC NULLS LAST`,
    [examId]
  );
  res.json(rows);
});

module.exports = router;
