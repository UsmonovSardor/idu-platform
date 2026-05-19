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

// ── Robust PDF/text question parser ────────────────────────────────────────────
// Handles real-world messy Uzbek/Russian educational PDFs:
//   • multi-line blocks          • single-line blocks
//   • "1.", "1)", "1-savol."    • Cyrillic А/Б/В/Г options
//   • To'g'ri / Javob / Answer  • ✓ / * markers in options
function parsePdfQuestions(rawText) {
  if (!rawText) return [];

  // ── normalise text ──────────────────────────────────────────────────────────
  const text = rawText
    .replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\f/g, '\n')
    // collapse multiple blank lines
    .replace(/\n{3,}/g, '\n\n');

  // ── shared helpers ──────────────────────────────────────────────────────────
  // Cyrillic option letters → Latin
  const CYR = { 'А':'A','Б':'B','В':'B','Г':'C','С':'C','Д':'D','а':'A','б':'B','в':'B','г':'C','с':'C','д':'D' };
  const normLetter = ch => CYR[ch] || ch.toUpperCase();

  // Option line: A) A. A: (A) А) etc.
  const OPT_RE = /^[(]?\s*([AaBbCcDdАБВГ])\s*[.):\-]\s*(.+)/;

  // Correct-answer markers
  const CORR_RE = [
    /(?:to[''`'′]?[gġ][''`'′]?ri|tog[''`'′]?ri|togri|javob|answer|correct|to['']g['']ri|правильн(?:ый|о|ая)?)\s*[:=]\s*([ABCD])/i,
    /\bjavob\s*[:=]\s*([ABCD])/i,
    /\*\*([ABCD])\*\*/,
    /\[([ABCD])\]/,
    /✓\s*([ABCD])|([ABCD])\s*✓/,
  ];

  function findCorrect(text) {
    for (const re of CORR_RE) {
      const m = text.match(re);
      if (m) return normLetter(m[1] || m[2] || '');
    }
    return null;
  }

  // ── parse one text block (list of trimmed lines) into a question object ─────
  function parseBlock(bLines) {
    if (!bLines.length) return null;

    const qParts = [];
    let optStart = bLines.length;

    for (let i = 0; i < bLines.length; i++) {
      if (OPT_RE.test(bLines[i]) || /^(?:to[''`']?g|togri|javob|answer|correct)/i.test(bLines[i])) {
        optStart = i; break;
      }
      qParts.push(bLines[i]);
    }

    const qText = qParts.join(' ').replace(/\s+/g, ' ').trim();
    if (!qText) return null;

    let a, b, c, d, correct, explanation;

    for (let i = optStart; i < bLines.length; i++) {
      const line = bLines[i];
      const optM = line.match(OPT_RE);
      if (optM) {
        const letter = normLetter(optM[1]);
        const val = optM[2].trim();
        // Check for ✓ marker inside option value
        if (/✓|\*/.test(val) && !correct) correct = letter;
        const cleaned = val.replace(/[*✓]/g, '').trim();
        if (letter === 'A') a = cleaned;
        else if (letter === 'B') b = cleaned;
        else if (letter === 'C') c = cleaned;
        else if (letter === 'D') d = cleaned;
        continue;
      }
      const corr = findCorrect(line);
      if (corr && ['A','B','C','D'].includes(corr)) correct = corr;
      const izM = line.match(/^(?:izoh|tushuntirish|explanation|note)\s*[:=]\s*(.+)/i);
      if (izM) explanation = izM[1].trim();
    }

    if (!a && !b) return null; // need at least 2 options
    return {
      text: qText,
      a: a || '—', b: b || '—', c: c || '—', d: d || '—',
      correct: (['A','B','C','D'].includes(correct)) ? correct : 'A',
      explanation: explanation || null
    };
  }

  // ── STRATEGY 1: multi-line blocks (standard format) ─────────────────────────
  function strategyMultiLine() {
    const results = [];
    // Block starter: line beginning with a number + punctuation OR "N-savol"
    const START = /^\s*(\d{1,3})\s*[-.):\s]\s*(?:savol[.\s]*)?\s*(.+)/i;
    const lines = text.split('\n');
    const blocks = [];
    let cur = null;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const m = trimmed.match(START);
      if (m) {
        const num = parseInt(m[1], 10);
        const last = cur ? cur.num : 0;
        if (!cur || num === 1 || num === last + 1 || (num > last && num <= last + 10)) {
          if (cur) blocks.push(cur);
          cur = { num, lines: [m[2].trim()] };
          continue;
        }
      }
      if (cur) cur.lines.push(trimmed);
    }
    if (cur) blocks.push(cur);

    for (const b of blocks) {
      const q = parseBlock(b.lines);
      if (q) results.push(q);
    }
    return results;
  }

  // ── STRATEGY 2: single-line scan (PDF flattened everything to one line) ─────
  // Splits by question number pattern embedded in continuous text
  function strategySingleLine() {
    const results = [];
    // Split on question number patterns embedded in text
    const parts = text
      .replace(/\n/g, ' ')
      .split(/(?=\s\d{1,3}\s*[.)]\s)/);

    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      // Remove leading number
      const noNum = trimmed.replace(/^\d{1,3}\s*[.)]\s*/, '');
      // Split on option markers and correct-answer markers
      const subLines = noNum
        .split(/\s+(?=[ABCDАБВГabcdабвг]\s*[.):]|\bTo[''']?g|togri|javob|answer|correct)/i)
        .map(s => s.trim()).filter(Boolean);
      const q = parseBlock(subLines);
      if (q) results.push(q);
    }
    return results;
  }

  // ── STRATEGY 3: regex scan across entire text (last resort) ─────────────────
  // Looks for the pattern: question text + A)...B)...C)...D)...[correct marker]
  function strategyRegexScan() {
    const results = [];
    const flat = text.replace(/\n/g, ' ').replace(/\s{2,}/g, ' ');
    // Matches: (optional number.) question A) ... B) ... C) ... D) ... [To'g'ri: X]
    const Q_PATTERN = /(?:\d{1,3}\s*[.)]\s*)?(.+?)\s+[АA]\s*[.)]\s*(.+?)\s+[ВB]\s*[.)]\s*(.+?)\s+[СC]\s*[.)]\s*(.+?)\s+[ДD]\s*[.)]\s*(.+?)(?:\s+(?:To[''']?g[''']?ri|Javob|Answer|Correct|Правильн[ыо]й?)\s*[:=]\s*([ABCD]))?(?=\s+\d{1,3}\s*[.)]|$)/gi;
    let m;
    while ((m = Q_PATTERN.exec(flat)) !== null) {
      const qText = m[1].trim();
      if (!qText || qText.length < 3) continue;
      results.push({
        text: qText,
        a: m[2].trim(), b: m[3].trim(), c: m[4].trim(), d: m[5].trim(),
        correct: m[6] ? m[6].toUpperCase() : 'A',
        explanation: null
      });
    }
    return results;
  }

  // ── Run strategies in order, return first that works ────────────────────────
  let questions = strategyMultiLine();
  if (!questions.length) questions = strategySingleLine();
  if (!questions.length) questions = strategyRegexScan();

  return questions;
}

module.exports = router;
