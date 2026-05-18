'use strict';

const express  = require('express');
const { body, param, query } = require('express-validator');

const db                    = require('../config/database');
const validate              = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

const VALID_SUBJECTS = ['algo', 'ai', 'math', 'db', 'web'];
const VALID_TYPES    = ['test', 'real', 'both'];

// ?? GET /api/questions ????????????????????????????????????????????????????????
router.get(
  '/',
  [
    query('subject').optional().isIn(VALID_SUBJECTS),
    query('type').optional().isIn(VALID_TYPES),
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 200 }).toInt(),
  ],
  validate,
  async (req, res) => {
    const { subject, type } = req.query;
    const page   = req.query.page  || 1;
    const limit  = req.query.limit || 50;
    const offset = (page - 1) * limit;

    let conditions = ['q.is_active = TRUE'];
    const params = [];

    if (subject) {
      params.push(subject);
      conditions.push(`q.subject = $${params.length}`);
    }
    if (type) {
      params.push(type);
      conditions.push(`(q.type = $${params.length} OR q.type = 'both')`);
    }

    const where = 'WHERE ' + conditions.join(' AND ');
    params.push(limit, offset);

    const { rows } = await db.query(
      `SELECT q.id, q.subject, q.type, q.question_text,
              q.option_a, q.option_b, q.option_c, q.option_d,
              q.correct_option, q.explanation,
              u.full_name AS created_by_name, q.created_at
       FROM questions q
       LEFT JOIN users u ON u.id = q.created_by
       ${where}
       ORDER BY q.subject, q.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    // For student role: hide correct_option and explanation while exam is active
    // (Exam endpoint handles this; here we only return full data to dekanat/teacher)
    if (req.user.role === 'student') {
      return res.json(
        rows.map(q => ({ ...q, correct_option: undefined, explanation: undefined }))
      );
    }

    res.json(rows);
  }
);

// ?? POST /api/questions ???????????????????????????????????????????????????????
router.post(
  '/',
  authorize('dekanat', 'admin'),
  [
    body('subject').isIn(VALID_SUBJECTS).withMessage('Invalid subject'),
    body('type').isIn(VALID_TYPES).withMessage('Invalid type'),
    body('questionText').isLength({ min: 10, max: 2000 }).trim().withMessage('Question text required (10-2000 chars)'),
    body('optionA').isLength({ min: 1, max: 500 }).trim(),
    body('optionB').isLength({ min: 1, max: 500 }).trim(),
    body('optionC').isLength({ min: 1, max: 500 }).trim(),
    body('optionD').isLength({ min: 1, max: 500 }).trim(),
    body('correctOption').isIn(['A','B','C','D']).withMessage('correctOption must be A, B, C, or D'),
    body('explanation').optional().isLength({ max: 2000 }).trim(),
  ],
  validate,
  async (req, res) => {
    const { subject, type, questionText, optionA, optionB, optionC, optionD, correctOption, explanation } = req.body;

    const { rows } = await db.query(
      `INSERT INTO questions (subject, type, question_text, option_a, option_b, option_c, option_d, correct_option, explanation, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [subject, type, questionText, optionA, optionB, optionC, optionD, correctOption, explanation || null, req.user.id]
    );

    res.status(201).json(rows[0]);
  }
);

// ?? PUT /api/questions/:id ????????????????????????????????????????????????????
router.put(
  '/:id',
  authorize('dekanat', 'admin'),
  [
    param('id').isInt({ min: 1 }).toInt(),
    body('subject').optional().isIn(VALID_SUBJECTS),
    body('type').optional().isIn(VALID_TYPES),
    body('questionText').optional().isLength({ min: 10, max: 2000 }).trim(),
    body('optionA').optional().isLength({ min: 1, max: 500 }).trim(),
    body('optionB').optional().isLength({ min: 1, max: 500 }).trim(),
    body('optionC').optional().isLength({ min: 1, max: 500 }).trim(),
    body('optionD').optional().isLength({ min: 1, max: 500 }).trim(),
    body('correctOption').optional().isIn(['A','B','C','D']),
    body('explanation').optional().isLength({ max: 2000 }).trim(),
  ],
  validate,
  async (req, res) => {
    const { subject, type, questionText, optionA, optionB, optionC, optionD, correctOption, explanation } = req.body;

    const { rows, rowCount } = await db.query(
      `UPDATE questions SET
         subject       = COALESCE($1, subject),
         type          = COALESCE($2, type),
         question_text = COALESCE($3, question_text),
         option_a      = COALESCE($4, option_a),
         option_b      = COALESCE($5, option_b),
         option_c      = COALESCE($6, option_c),
         option_d      = COALESCE($7, option_d),
         correct_option = COALESCE($8, correct_option),
         explanation   = COALESCE($9, explanation),
         updated_at    = NOW()
       WHERE id = $10 AND is_active = TRUE
       RETURNING *`,
      [subject||null, type||null, questionText||null, optionA||null, optionB||null, optionC||null, optionD||null, correctOption||null, explanation||null, req.params.id]
    );

    if (!rowCount) return res.status(404).json({ error: 'Question not found' });
    res.json(rows[0]);
  }
);

// ?? DELETE /api/questions/:id ?????????????????????????????????????????????????
router.delete(
  '/:id',
  authorize('dekanat', 'admin'),
  [param('id').isInt({ min: 1 }).toInt()],
  validate,
  async (req, res) => {
    // Soft delete
    const { rowCount } = await db.query(
      'UPDATE questions SET is_active = FALSE, updated_at = NOW() WHERE id = $1',
      [req.params.id]
    );
    if (!rowCount) return res.status(404).json({ error: 'Question not found' });
    res.json({ message: 'Question deleted' });
  }
);

// ?? POST /api/questions/bulk ??????????????????????????????????????????????????
// Import multiple questions at once
router.post(
  '/bulk',
  authorize('dekanat', 'admin'),
  [
    body('questions').isArray({ min: 1, max: 100 }).withMessage('Provide 1-100 questions'),
    body('questions.*.subject').isIn(VALID_SUBJECTS),
    body('questions.*.type').isIn(VALID_TYPES),
    body('questions.*.questionText').isLength({ min: 10, max: 2000 }).trim(),
    body('questions.*.optionA').isLength({ min: 1, max: 500 }).trim(),
    body('questions.*.optionB').isLength({ min: 1, max: 500 }).trim(),
    body('questions.*.optionC').isLength({ min: 1, max: 500 }).trim(),
    body('questions.*.optionD').isLength({ min: 1, max: 500 }).trim(),
    body('questions.*.correctOption').isIn(['A','B','C','D']),
  ],
  validate,
  async (req, res) => {
    const { questions } = req.body;
    const client = await db.getClient();

    try {
      await client.query('BEGIN');
      const inserted = [];
      for (const q of questions) {
        const { rows } = await client.query(
          `INSERT INTO questions (subject, type, question_text, option_a, option_b, option_c, option_d, correct_option, explanation, created_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
          [q.subject, q.type, q.questionText, q.optionA, q.optionB, q.optionC, q.optionD, q.correctOption, q.explanation||null, req.user.id]
        );
        inserted.push(rows[0].id);
      }
      await client.query('COMMIT');
      res.status(201).json({ inserted: inserted.length, ids: inserted });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
);

// ?? POST /api/questions/upload-pdf ???????????????????????????????????????????????
// Fan o'qituvchisi PDF fayl yuklaydi — test/sesiya uchun savollar
// PDF formatida savollar:
//   1. Savol matni?
//   A) Javob A
//   B) Javob B
//   C) Javob C
//   D) Javob D
//   To'g'ri: A
//   Izoh: (ixtiyoriy)
router.post(
  '/upload-pdf',
  authorize('dekanat', 'admin', 'teacher'),
  (req, res, next) => {
    const multer = require('multer');
    const storage = multer.memoryStorage();
    const ALLOWED_MIMES = new Set([
      'application/pdf',
      'text/plain',
      'text/csv',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/octet-stream', // some browsers send this for .pdf/.docx
    ]);
    const upload = multer({
      storage,
      limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
      fileFilter: (req, file, cb) => {
        const ext = (file.originalname || '').split('.').pop().toLowerCase();
        const allowedExts = ['pdf','txt','csv','doc','docx','xls','xlsx'];
        if (ALLOWED_MIMES.has(file.mimetype) || allowedExts.includes(ext)) {
          cb(null, true);
        } else {
          cb(new Error('Faqat PDF, TXT, CSV, DOC/DOCX, XLS/XLSX fayl yuklanishi mumkin'));
        }
      }
    }).single('pdf');
    upload(req, res, next);
  },
  [
    require('express-validator').body('subject').isIn(VALID_SUBJECTS).withMessage('Noto\'g\'ri fan'),
    require('express-validator').body('type').isIn(VALID_TYPES).withMessage('Noto\'g\'ri tur'),
  ],
  validate,
  async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Fayl yuklanmadi' });

    const { subject, type } = req.body;
    const ext = (req.file.originalname || '').split('.').pop().toLowerCase();

    let rawText = '';
    try {
      if (ext === 'pdf') {
        let pdfParse;
        try { pdfParse = require('pdf-parse/lib/pdf-parse'); }
        catch(e) { pdfParse = require('pdf-parse'); }
        const data = await pdfParse(req.file.buffer);
        rawText = data.text;
      } else {
        // TXT, CSV, DOC (best-effort plain text)
        rawText = req.file.buffer.toString('utf8');
      }
    } catch (err) {
      return res.status(422).json({ error: 'Faylni o\'qib bo\'lmadi: ' + err.message });
    }

    const questions = parsePdfQuestions(rawText);

    if (!questions.length) {
      // Return debug info so admin can see what was extracted
      const preview = rawText.replace(/\r/g, '').trim().slice(0, 500);
      return res.status(422).json({
        error: 'Savollar topilmadi. Fayl formatini tekshiring.',
        hint: 'Format: "1. Savol matni? A) ... B) ... C) ... D) ... To\'g\'ri: A"',
        extractedLines: rawText.split('\n').filter(Boolean).length,
        textPreview: preview
      });
    }

    // Savollarni bazaga kiritish
    const client = await db.getClient();
    const inserted = [];
    const errors = [];

    try {
      await client.query('BEGIN');
      for (const q of questions) {
        try {
          const { rows } = await client.query(
            `INSERT INTO questions
               (subject, type, question_text, option_a, option_b, option_c, option_d,
                correct_option, explanation, created_by)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
             RETURNING id`,
            [subject, type, q.text, q.a, q.b, q.c, q.d,
             q.correct, q.explanation || null, req.user.id]
          );
          inserted.push(rows[0].id);
        } catch (e) {
          errors.push({ question: q.text.substring(0, 60), error: e.message });
        }
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    res.status(201).json({
      message: `PDF muvaffaqiyatli qayta ishlandi`,
      parsed: questions.length,
      inserted: inserted.length,
      failed: errors.length,
      insertedIds: inserted,
      errors: errors.length ? errors : undefined
    });
  }
);

// ── POST /api/questions/import-json — JSON formatda savollar import ──────────
router.post(
  '/import-json',
  authorize('dekanat', 'admin', 'teacher'),
  async (req, res) => {
    const { subject, type, questions } = req.body;
    const VALID_SUBJECTS = ['algo','ai','math','db','web'];
    const VALID_TYPES = ['test','real','both'];
    if (!VALID_SUBJECTS.includes(subject)) return res.status(400).json({ error: 'Noto\'g\'ri fan' });
    if (!VALID_TYPES.includes(type)) return res.status(400).json({ error: 'Noto\'g\'ri tur' });
    if (!Array.isArray(questions) || !questions.length) return res.status(400).json({ error: 'questions massivi bo\'sh' });

    const client = await db.getClient();
    const inserted = [], errors = [];
    try {
      await client.query('BEGIN');
      for (const q of questions) {
        if (!q.question_text || !q.option_a || !q.option_b || !q.option_c || !q.option_d || !q.correct_option) continue;
        const types = type === 'both' ? ['test','real'] : [type];
        for (const t of types) {
          try {
            const { rows } = await client.query(
              `INSERT INTO questions (subject,type,question_text,option_a,option_b,option_c,option_d,correct_option,explanation,created_by)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
              [subject, t, q.question_text, q.option_a, q.option_b, q.option_c, q.option_d,
               q.correct_option.toUpperCase(), q.explanation||null, req.user.id]
            );
            inserted.push(rows[0].id);
          } catch(e) { errors.push({ q: q.question_text?.substring(0,50), err: e.message }); }
        }
      }
      await client.query('COMMIT');
    } catch(err) { await client.query('ROLLBACK'); throw err; }
    finally { client.release(); }
    res.status(201).json({ inserted: inserted.length, failed: errors.length, errors: errors.length ? errors : undefined });
  }
);

// Robust PDF/text question parser — handles real-world messy PDFs
function parsePdfQuestions(rawText) {
  if (!rawText) return [];

  // Normalise line endings and remove form-feed / page-break chars
  const text = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\f/g, '\n');

  const questions = [];

  // ── STEP 1: split into numbered blocks ──────────────────────────────────────
  // A new block starts at a line beginning with a number followed by . ) or :
  // e.g. "1.", "1)", "1:", "  2.", "10."
  const BLOCK_START = /^\s*(\d{1,3})[.):\s]\s*(.+)/;

  const lines = text.split('\n');
  const blocks = [];
  let current = null;

  for (const line of lines) {
    const m = line.match(BLOCK_START);
    if (m) {
      // Only treat as a new block if the number is sequential or > current block number
      const num = parseInt(m[1], 10);
      const lastNum = current ? current.num : 0;
      // Allow jumps: new block if num === lastNum+1 OR it's line 1 OR large sequential gap ≤ 5
      if (!current || num === lastNum + 1 || num === 1 || (num > lastNum && num <= lastNum + 5)) {
        if (current) blocks.push(current);
        current = { num, lines: [m[2].trim()] };
        continue;
      }
    }
    if (current) {
      const trimmed = line.trim();
      if (trimmed) current.lines.push(trimmed);
    }
  }
  if (current) blocks.push(current);

  // ── STEP 2: parse each block ─────────────────────────────────────────────────
  // Answer-line patterns: A) A. A: (A) A - А) (Cyrillic А)
  const OPT_RE = /^[(]?([AaBbCcDd]|[АБВГ])[.):\-\s]\s*(.+)/;

  // Correct-answer patterns (various languages/typos)
  const CORR_RE = [
    /(?:to[''`]?g[''`]?ri|togri|javob|answer|correct|правильн[ыо]й?|to['']g['']ri)[:\s]+([ABCD])/i,
    /^([ABCD])\s*[-–—]\s*(?:to[''`]?g[''`]?ri|javob|правильно)/i,
    /\*\*([ABCD])\*\*/,        // markdown bold **A**
    /\[([ABCD])\]/,            // [A]
  ];

  // Cyrillic-to-Latin letter map
  const CYR = { 'А': 'A', 'В': 'B', 'С': 'C', 'Д': 'D', 'Б': 'B', 'а': 'A', 'б': 'B', 'в': 'B', 'с': 'C', 'д': 'D' };

  function normLetter(ch) {
    return CYR[ch] || ch.toUpperCase();
  }

  for (const block of blocks) {
    if (!block.lines.length) continue;

    // Question text = first non-empty line (may span multiple lines if options haven't started yet)
    const qParts = [];
    let optStartIdx = block.lines.length;

    for (let i = 0; i < block.lines.length; i++) {
      if (OPT_RE.test(block.lines[i])) { optStartIdx = i; break; }
      qParts.push(block.lines[i]);
    }

    const qText = qParts.join(' ').trim();
    if (!qText) continue; // no question text

    let a, b, c, d, correct, explanation;

    for (let i = optStartIdx; i < block.lines.length; i++) {
      const line = block.lines[i];

      // Option lines
      const optM = line.match(OPT_RE);
      if (optM) {
        const letter = normLetter(optM[1]);
        const val = optM[2].trim();
        if (letter === 'A') a = val;
        else if (letter === 'B') b = val;
        else if (letter === 'C') c = val;
        else if (letter === 'D') d = val;
        continue;
      }

      // Correct-answer line
      for (const re of CORR_RE) {
        const cm = line.match(re);
        if (cm) {
          correct = normLetter(cm[1]);
          break;
        }
      }

      // Explanation / Izoh
      const izM = line.match(/^(?:izoh|explanation|note|tushuntirish)[:\s]+(.+)/i);
      if (izM) explanation = izM[1].trim();
    }

    // If no explicit "correct" marker found, try to detect starred/underlined option
    // e.g. "A) *correct answer*" or "A) correct answer ✓"
    if (!correct) {
      for (const [idx, ll] of [['A', a], ['B', b], ['C', c], ['D', d]]) {
        if (ll && (/\*/.test(ll) || /✓/.test(ll) || /\(correct\)/i.test(ll))) {
          correct = idx;
          // Clean the marker from the option text
          if (idx === 'A') a = a.replace(/[*✓]|\(correct\)/gi, '').trim();
          else if (idx === 'B') b = b.replace(/[*✓]|\(correct\)/gi, '').trim();
          else if (idx === 'C') c = c.replace(/[*✓]|\(correct\)/gi, '').trim();
          else if (idx === 'D') d = d.replace(/[*✓]|\(correct\)/gi, '').trim();
          break;
        }
      }
    }

    // Require at least question + 2 options to save (lenient for partial data)
    const hasEnoughOptions = !!(a && b && (c || d));
    if (!qText || !hasEnoughOptions) continue;

    // Fill missing options with placeholder so DB constraint is satisfied
    questions.push({
      text: qText,
      a: a || '—',
      b: b || '—',
      c: c || '—',
      d: d || '—',
      correct: (['A','B','C','D'].includes(correct)) ? correct : 'A',
      explanation: explanation || null
    });
  }

  return questions;
}

module.exports = router;
