'use strict';

const express  = require('express');
const { body, param, query } = require('express-validator');

const db                    = require('../config/database');
const validate              = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const { logger }            = require('../middleware/logger');

const router = express.Router();
router.use(authenticate);

// VALID_SUBJECTS is now loaded dynamically from DB (see getValidSubjects())
// Kept as fallback in case DB is unavailable
const FALLBACK_SUBJECTS = ['algo', 'ai', 'math', 'db', 'web'];
const VALID_TYPES       = ['test', 'real', 'both'];

async function getValidSubjects() {
  try {
    const { rows } = await db.query(`SELECT code FROM subjects WHERE is_active = TRUE`);
    return rows.map(r => r.code);
  } catch { return FALLBACK_SUBJECTS; }
}

// ?? GET /api/questions ????????????????????????????????????????????????????????
router.get(
  '/',
  [
    query('subject').optional(),
    query('type').optional().isIn(VALID_TYPES),
    query('chapter').optional().isInt({ min: 1 }).toInt(),
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 5000 }).toInt(),
  ],
  validate,
  async (req, res) => {
    const { subject, type } = req.query;
    const chapter = req.query.chapter || null;
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
    if (chapter) {
      params.push(chapter);
      conditions.push(`q.chapter_num = $${params.length}`);
    }

    const where = 'WHERE ' + conditions.join(' AND ');
    params.push(limit, offset);

    // Use COALESCE for chapter_num in case the column was just added / migration pending
    const { rows } = await db.query(
      `SELECT q.id, q.subject, q.type,
              COALESCE(q.chapter_num, 1) AS chapter_num,
              q.question_text,
              q.option_a, q.option_b, q.option_c, q.option_d,
              q.correct_option, q.explanation,
              u.full_name AS created_by_name, q.created_at
       FROM questions q
       LEFT JOIN users u ON u.id = q.created_by
       ${where}
       ORDER BY q.subject, COALESCE(q.chapter_num, 1), q.id ASC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    // For student role: hide correct_option and explanation
    if (req.user.role === 'student') {
      return res.json(
        rows.map(q => ({ ...q, correct_option: undefined, explanation: undefined }))
      );
    }

    res.json(rows);
  }
);

// ?? GET /api/questions/chapters — list available chapters per subject ??????????
router.get('/chapters', async (req, res) => {
  const { rows } = await db.query(
    `SELECT subject, chapter_num,
            COUNT(*) AS question_count
     FROM questions
     WHERE is_active = TRUE
     GROUP BY subject, chapter_num
     ORDER BY subject, chapter_num`
  );
  res.json(rows);
});

// ?? POST /api/questions ???????????????????????????????????????????????????????
router.post(
  '/',
  authorize('dekanat', 'admin'),
  [
    body('subject').trim().notEmpty().withMessage('Fan tanlang'),
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
    body('subject').optional().trim(),
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
    body('questions').isArray({ min: 1, max: 500 }).withMessage('Provide 1-500 questions'),
    body('questions.*.subject').optional().trim(),
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
    require('express-validator').body('subject').trim().notEmpty().withMessage('Fan tanlang'),
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

    let questions = parsePdfQuestions(rawText);
    let aiParsed = false;

    // ── AI fallback: if regex parser finds nothing, try OpenAI ────────────────
    if (!questions.length && process.env.OPENAI_API_KEY) {
      try {
        const OpenAI = require('openai');
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        const textChunk = rawText.replace(/[□■▪▫◻◼]/g, '').replace(/\s{3,}/g, ' ').slice(0, 7000);

        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [{
            role: 'user',
            content: `Quyida PDF fayldan olingan o'zbek tili yoki matematika test savollari matni.
Matritsalar, formulalar va boshqa matematik ifodalarni o'z ichiga olishi mumkin.
Savollarni topib, JSON massiv qaytar. Faqat JSON, boshqa matn yo'q.
Har element: {"question_text":"...","option_a":"...","option_b":"...","option_c":"...","option_d":"...","correct_option":"A"}
LaTeX ishlatish mumkin: $...$ yoki $$...$$ matritsalar uchun \\begin{pmatrix}...\\end{pmatrix}
MATN:\n${textChunk}`
          }],
          max_tokens: 4000,
          temperature: 0.1,
        });

        const raw = completion.choices[0].message.content || '';
        const match = raw.match(/\[[\s\S]*\]/);
        if (match) {
          const aiList = JSON.parse(match[0]);
          if (Array.isArray(aiList) && aiList.length) {
            questions = aiList.map(q => ({
              text: q.question_text || q.text || '',
              a: q.option_a || q.a || '—',
              b: q.option_b || q.b || '—',
              c: q.option_c || q.c || '—',
              d: q.option_d || q.d || '—',
              correct: (['A','B','C','D'].includes((q.correct_option||q.correct||'A').toUpperCase()))
                       ? (q.correct_option||q.correct||'A').toUpperCase() : 'A',
              explanation: q.explanation || null,
            })).filter(q => q.text && q.a !== '—');
            aiParsed = true;
          }
        }
      } catch (aiErr) {
        logger.warn('AI PDF parse urinishi muvaffaqiyatsiz:', aiErr.message);
      }
    }

    if (!questions.length) {
      const preview = rawText.replace(/\r/g, '').trim().slice(0, 500);
      return res.status(422).json({
        error: 'Savollar topilmadi. Fayl formatini tekshiring.',
        hint: 'Format: "1. Savol matni? A) ... B) ... C) ... D) ... To\'g\'ri: A"',
        extractedLines: rawText.split('\n').filter(Boolean).length,
        textPreview: preview,
        aiAttempted: !!process.env.OPENAI_API_KEY,
      });
    }

    // Ensure chapter_num column exists — defensive guard in case migration 008 hasn't run yet
    try {
      await db.query(`ALTER TABLE questions ADD COLUMN IF NOT EXISTS chapter_num INTEGER NOT NULL DEFAULT 1`);
      await db.query(`CREATE INDEX IF NOT EXISTS idx_questions_subject_chapter ON questions (subject, chapter_num) WHERE is_active = TRUE`);
    } catch (migrErr) {
      logger.warn('[upload-pdf] chapter_num migration guard failed:', migrErr.message);
    }

    // Determine starting chapter_num: find max chapter already in DB for this subject
    let startChapter = 1;
    try {
      const { rows: chRows } = await db.query(
        `SELECT COALESCE(MAX(chapter_num), 0) AS max_ch FROM questions WHERE subject = $1 AND is_active = TRUE`,
        [subject]
      );
      startChapter = (chRows[0]?.max_ch || 0) + 1;
    } catch (_) { startChapter = 1; }

    // Savollarni bazaga kiritish — har 20 tasi yangi bob (chapter_num)
    const CHAPTER_SIZE = 20;
    const client = await db.getClient();
    const inserted = [];
    const errors = [];

    try {
      await client.query('BEGIN');
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        const chapterNum = startChapter + Math.floor(i / CHAPTER_SIZE);
        try {
          const { rows } = await client.query(
            `INSERT INTO questions
               (subject, type, chapter_num, question_text, option_a, option_b, option_c, option_d,
                correct_option, explanation, created_by)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
             RETURNING id`,
            [subject, type, chapterNum, q.text, q.a, q.b, q.c, q.d,
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

    const chaptersCreated = Math.ceil(inserted.length / CHAPTER_SIZE) || 0;
    if (errors.length) {
      logger.warn(`[upload-pdf] ${errors.length} insert(s) failed. First error: ${errors[0]?.error}`);
    }
    res.status(201).json({
      message: `PDF muvaffaqiyatli qayta ishlandi`,
      parsed: questions.length,
      inserted: inserted.length,
      failed: errors.length,
      chaptersCreated,
      startChapter,
      insertedIds: inserted,
      aiParsed,
      errors: errors.length ? errors.slice(0, 5) : undefined,
      debug: {
        rawLines: rawText.split('\n').filter(Boolean).length,
        textPreview: rawText.trim().slice(0, 300),
        firstParsed: questions.slice(0, 2).map(q => ({ q: q.text?.slice(0,60), a: q.a?.slice(0,30) })),
      }
    });
  }
);

// ── POST /api/questions/ai-parse — AI yordamida matritsali PDF matnini parse qilish ──
router.post(
  '/ai-parse',
  authorize('dekanat', 'admin', 'teacher'),
  async (req, res) => {
    const { rawText, subject, type } = req.body;
    if (!rawText || rawText.trim().length < 20) {
      return res.status(400).json({ error: 'rawText bo\'sh yoki juda qisqa' });
    }
    const VALID_TYPES    = ['test','real','both'];

    // Use existing OpenAI key
    const OpenAI = require('openai');
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // Truncate to avoid token limits (max ~6000 chars)
    const textChunk = rawText.slice(0, 6000);

    const prompt = `Quyida PDF fayldan olingan matematik test savollari matni berilgan.
Matn matritsalar, formulalar va boshqa matematik ifodalarni o'z ichiga oladi.
Ular PDF dan noto'g'ri chiqib kelgan (□ belgilar, tartibsiz raqamlar va h.k.).

Vazifang: ushbu matndan test savollarini topib, ularni to'g'ri JSON formatiga o'tkazish.
Har bir savol uchun LaTeX notatsiyasidan foydalaning:
- Matritsalar uchun: $\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}$
- Kasrlar uchun: $\\frac{a}{b}$
- Inline math: $...$ delimiters
- Display math: $$...$$ delimiters

JSON massiv qaytar, har bir element:
{
  "question_text": "Savol matni (LaTeX bilan)",
  "option_a": "A javob (LaTeX bilan)",
  "option_b": "B javob",
  "option_c": "C javob",
  "option_d": "D javob",
  "correct_option": "A" (yoki B, C, D — agar ma'lum bo'lsa, aks holda "A"),
  "explanation": null
}

Faqat JSON massiv qaytar, boshqa matn yo'q.

MATN:
${textChunk}`;

    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 4000,
        temperature: 0.1,
        response_format: { type: 'json_object' },
      });

      let parsed;
      try {
        const content = completion.choices[0].message.content;
        // Try to extract array from possible wrapper object
        const obj = JSON.parse(content);
        parsed = Array.isArray(obj) ? obj : (obj.questions || obj.savollar || Object.values(obj)[0] || []);
      } catch (e) {
        return res.status(422).json({ error: 'AI javobini parse qilib bo\'lmadi', raw: completion.choices[0].message.content?.slice(0,500) });
      }

      if (!Array.isArray(parsed) || !parsed.length) {
        return res.status(422).json({ error: 'AI savollar topilmadi', hint: 'PDF matnini tekshiring' });
      }

      // Optionally import directly into DB if subject/type provided
      if (subject && VALID_TYPES.includes(type)) {
        const realSubject = subject.toLowerCase().replace('matematika','math');
        const client = await db.getClient();
        const inserted = [], errors = [];
        try {
          await client.query('BEGIN');
          for (const q of parsed) {
            if (!q.question_text || !q.option_a || !q.option_b) continue;
            try {
              const { rows } = await client.query(
                `INSERT INTO questions (subject,type,question_text,option_a,option_b,option_c,option_d,correct_option,explanation,created_by)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
                [realSubject, type, q.question_text, q.option_a, q.option_b, q.option_c||'—', q.option_d||'—',
                 (q.correct_option||'A').toUpperCase(), q.explanation||null, req.user.id]
              );
              inserted.push(rows[0].id);
            } catch(e) { errors.push({ q: q.question_text?.substring(0,50), err: e.message }); }
          }
          await client.query('COMMIT');
        } catch(err) { await client.query('ROLLBACK'); throw err; }
        finally { client.release(); }
        return res.status(201).json({ parsed: parsed.length, inserted: inserted.length, failed: errors.length, questions: parsed });
      }

      // Otherwise just return parsed questions for preview
      return res.json({ parsed: parsed.length, questions: parsed });
    } catch (err) {
      if (err.code === 'insufficient_quota') return res.status(402).json({ error: 'OpenAI quota tugagan' });
      throw err;
    }
  }
);

// ── POST /api/questions/import-json — JSON formatda savollar import ──────────
router.post(
  '/import-json',
  authorize('dekanat', 'admin', 'teacher'),
  async (req, res) => {
    const { subject, type, questions } = req.body;
    const VALID_TYPES = ['test','real','both'];
    if (!subject || !subject.trim()) return res.status(400).json({ error: 'Fan tanlang' });
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
//   • Matrix/table PDFs         • chapter-separated PDFs
function parsePdfQuestions(rawText) {
  if (!rawText) return [];

  // ── normalise text ──────────────────────────────────────────────────────────
  const text = rawText
    .replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\f/g, '\n')
    .replace(/\n{3,}/g, '\n\n');

  // ── shared helpers ──────────────────────────────────────────────────────────
  const CYR = { 'А':'A','Б':'B','В':'C','Г':'D','С':'C','Д':'D','а':'A','б':'B','в':'C','г':'D','с':'C','д':'D' };
  const normLetter = ch => CYR[ch] || ch.toUpperCase();

  // Option line: A) A. A: (A) А) etc.
  const OPT_RE = /^[(]?\s*([AaBbCcDdАБВГ])\s*[.):\-]\s*(.+)/;

  const CORR_RE = [
    /(?:to[''`'′]?[gġ][''`'′]?ri|tog[''`'′]?ri|togri|javob|answer|correct|to['']g['']ri|правильн(?:ый|о|ая)?)\s*[:=]\s*([ABCD])/i,
    /\bjavob\s*[:=]\s*([ABCD])/i,
    /\*\*([ABCD])\*\*/,
    /\[([ABCD])\]/,
    /✓\s*([ABCD])|([ABCD])\s*✓/,
  ];

  function findCorrect(txt) {
    for (const re of CORR_RE) {
      const m = txt.match(re);
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
    if (!qText || qText.length < 3) return null;

    let a, b, c, d, correct, explanation;

    for (let i = optStart; i < bLines.length; i++) {
      const line = bLines[i];
      const optM = line.match(OPT_RE);
      if (optM) {
        const letter = normLetter(optM[1]);
        const val = optM[2].trim();
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

    if (!a && !b) return null;
    return {
      text: qText,
      a: a || '—', b: b || '—', c: c || '—', d: d || '—',
      correct: (['A','B','C','D'].includes(correct)) ? correct : 'A',
      explanation: explanation || null
    };
  }

  // ── STRATEGY 1: multi-line blocks (standard format) ─────────────────────────
  // KEY FIX: removed \s from delimiter class — only punctuation triggers new block.
  // This prevents "33 ta" or page numbers like "34" from splitting blocks.
  // Also increased gap tolerance from 10 → 100 to handle chapter restarts.
  function strategyMultiLine() {
    const results = [];
    // Delimiter MUST be punctuation (., ), :, -, #) — NOT a plain space.
    // This is the critical fix: \s was causing "number + space" to split mid-question.
    const START = /^\s*(\d{1,3})\s*[-.):#]\s*(?:savol[.\s]*)?\s*(.*)/i;
    const lines = text.split('\n');
    const blocks = [];
    let cur = null;
    let lastNum = 0;
    let globalMax = 0;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const m = trimmed.match(START);
      if (m) {
        const num = parseInt(m[1], 10);
        // Accept as new question block if:
        // - It's the very first block
        // - Resets to 1 (new chapter/section starts)
        // - Is sequential (±1) or within reasonable gap (up to 100)
        // - Is greater than the global max seen (handles large gaps in numbering)
        const isReset   = num === 1 && lastNum > 5;      // new section
        const isSeq     = num > lastNum && num <= lastNum + 100;
        const isFirst   = cur === null;
        if (isFirst || isReset || isSeq) {
          if (cur) blocks.push(cur);
          cur = { num, lines: m[2].trim() ? [m[2].trim()] : [] };
          lastNum = num;
          if (num > globalMax) globalMax = num;
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
  function strategySingleLine() {
    const results = [];
    const parts = text
      .replace(/\n/g, ' ')
      .split(/(?=\s\d{1,3}\s*[.)]\s)/);

    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      const noNum = trimmed.replace(/^\d{1,3}\s*[.)]\s*/, '');
      const subLines = noNum
        .split(/\s+(?=[ABCDАБВГabcdабвг]\s*[.):]|\bTo[''']?g|togri|javob|answer|correct)/i)
        .map(s => s.trim()).filter(Boolean);
      const q = parseBlock(subLines);
      if (q) results.push(q);
    }
    return results;
  }

  // ── STRATEGY 3: regex scan across entire text (last resort) ─────────────────
  function strategyRegexScan() {
    const results = [];
    const flat = text.replace(/\n/g, ' ').replace(/\s{2,}/g, ' ');
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

  // ── STRATEGY 4: standalone option labels (matrix/table PDFs) ────────────────
  function strategyStandaloneOptions() {
    const results = [];
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

    const STANDALONE_OPT = /^([ABCD])\s*[.):]?\s*$/i;
    const BLOCK_START = /^(\d{1,3})\s*[-.):#]/;
    const CORR_LINE = /(?:to[''`]?g[''`]?ri|javob|answer|correct)\s*[:=]\s*([ABCD])/i;

    const blocks = [];
    let cur = null;
    for (const line of lines) {
      if (BLOCK_START.test(line)) {
        if (cur) blocks.push(cur);
        cur = { lines: [line.replace(BLOCK_START, '').trim()] };
      } else if (cur) {
        cur.lines.push(line);
      }
    }
    if (cur) blocks.push(cur);

    for (const block of blocks) {
      const bLines = block.lines;
      if (!bLines.length) continue;

      let firstOptIdx = -1;
      for (let i = 0; i < bLines.length; i++) {
        if (STANDALONE_OPT.test(bLines[i])) { firstOptIdx = i; break; }
      }
      if (firstOptIdx === -1) continue;

      const qText = bLines.slice(0, firstOptIdx)
        .join(' ')
        .replace(/[□■▪▫◻◼]/g, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
      if (!qText || qText.length < 3) continue;

      const opts = { A: [], B: [], C: [], D: [] };
      let curOpt = null;
      let correct = null;
      let explanation = null;

      for (let i = firstOptIdx; i < bLines.length; i++) {
        const line = bLines[i];
        const optM = line.match(STANDALONE_OPT);
        if (optM) { curOpt = optM[1].toUpperCase(); continue; }
        const corrM = line.match(CORR_LINE);
        if (corrM) { correct = corrM[1].toUpperCase(); continue; }
        const izM = line.match(/^(?:izoh|tushuntirish|explanation)\s*[:=]\s*(.+)/i);
        if (izM) { explanation = izM[1]; continue; }
        if (curOpt && opts[curOpt] !== undefined) {
          const cleaned = line.replace(/[□■▪▫◻◼\s]/g, '');
          if (cleaned.length > 0) opts[curOpt].push(line.replace(/[□■▪▫◻◼]/g, '').trim());
        }
      }

      const optA = opts.A.join(' ').trim();
      const optB = opts.B.join(' ').trim();
      if (!optA && !optB) continue;

      results.push({
        text: qText,
        a: optA || '—', b: optB || '—',
        c: opts.C.join(' ').trim() || '—',
        d: opts.D.join(' ').trim() || '—',
        correct: (['A','B','C','D'].includes(correct)) ? correct : 'A',
        explanation: explanation || null
      });
    }
    return results;
  }

  // ── Run all strategies; merge unique results ─────────────────────────────────
  // This ensures questions from different sections/chapters are all captured,
  // even when different parts of the PDF use different formatting.
  function dedupByText(arr) {
    const seen = new Set();
    return arr.filter(q => {
      const key = q.text.slice(0, 60).toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  let questions = strategyMultiLine();

  // If strategy 1 gave too few results, supplement with other strategies
  if (questions.length < 10) {
    const s2 = strategySingleLine();
    const s3 = strategyRegexScan();
    const s4 = strategyStandaloneOptions();
    const merged = dedupByText([...questions, ...s2, ...s3, ...s4]);
    if (merged.length > questions.length) questions = merged;
  }

  // If still nothing, try all strategies merged
  if (!questions.length) {
    questions = dedupByText([
      ...strategySingleLine(),
      ...strategyRegexScan(),
      ...strategyStandaloneOptions(),
    ]);
  }

  return questions;
}

module.exports = router;
