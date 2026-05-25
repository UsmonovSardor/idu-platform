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

// ── Helper: fetch the student's profile (year + group) once per request ─────
async function getStudentProfile(userId) {
  try {
    const { rows } = await db.query(
      `SELECT year_of_study, group_name FROM students WHERE user_id = $1`,
      [userId]
    );
    return rows[0] || {};
  } catch { return {}; }
}

// ── Helper: is a chapter visible to this student? ───────────────────────────
// Returns { visible: bool, settings: {...}|null }
function isChapterVisibleToStudent(settings, profile, now = new Date()) {
  if (!settings) return { visible: true, settings: null }; // no rules → open
  if (settings.available_from && new Date(settings.available_from) > now) return { visible: false, settings };
  if (settings.available_to   && new Date(settings.available_to)   < now) return { visible: false, settings };
  if (settings.allowed_year && Number(settings.allowed_year) !== Number(profile.year_of_study || 0)) {
    return { visible: false, settings };
  }
  if (Array.isArray(settings.allowed_groups) && settings.allowed_groups.length > 0) {
    const g = String(profile.group_name || '').trim();
    if (!g || !settings.allowed_groups.map(x => String(x).trim()).includes(g)) {
      return { visible: false, settings };
    }
  }
  return { visible: true, settings };
}

// Shuffle (Fisher-Yates) — used for random_count slicing
function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
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

    let { rows } = await db.query(
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

    // For students: apply per-chapter visibility (time window + group/year) and random slicing
    if (req.user.role === 'student') {
      const profile = await getStudentProfile(req.user.id);

      // Load all settings rows for the subject+chapter pairs we have
      const pairs = [...new Set(rows.map(r => `${r.subject}|${r.chapter_num}`))];
      let settingsByKey = new Map();
      if (pairs.length) {
        try {
          const subs = [...new Set(rows.map(r => r.subject))];
          const { rows: sRows } = await db.query(
            `SELECT subject, chapter_num, random_count, available_from, available_to,
                    allowed_year, allowed_groups
             FROM chapter_settings
             WHERE subject = ANY($1::text[])`,
            [subs]
          );
          sRows.forEach(s => settingsByKey.set(`${s.subject}|${s.chapter_num}`, s));
        } catch { /* table missing → defaults */ }
      }

      // Group by (subject, chapter), filter visibility, then random-slice
      const grouped = new Map(); // key → array of q
      rows.forEach(q => {
        const key = `${q.subject}|${q.chapter_num}`;
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key).push(q);
      });

      const out = [];
      for (const [key, qs] of grouped.entries()) {
        const settings = settingsByKey.get(key) || null;
        const { visible } = isChapterVisibleToStudent(settings, profile);
        if (!visible) continue; // hide entire chapter
        let arr = qs;
        if (settings && settings.random_count > 0 && settings.random_count < arr.length) {
          arr = shuffleInPlace(arr.slice()).slice(0, settings.random_count);
        }
        out.push(...arr);
      }

      return res.json(
        out.map(q => ({ ...q, correct_option: undefined, explanation: undefined }))
      );
    }

    res.json(rows);
  }
);

// ?? GET /api/questions/chapters — list available chapters per subject ??????????
router.get('/chapters', async (req, res) => {
  const { rows } = await db.query(
    `SELECT q.subject, COALESCE(q.chapter_num,1) AS chapter_num,
            COUNT(*)::int AS question_count,
            cs.random_count, cs.available_from, cs.available_to,
            cs.allowed_year, cs.allowed_groups
     FROM questions q
     LEFT JOIN chapter_settings cs
       ON cs.subject = q.subject AND cs.chapter_num = COALESCE(q.chapter_num,1)
     WHERE q.is_active = TRUE
     GROUP BY q.subject, q.chapter_num, cs.random_count, cs.available_from,
              cs.available_to, cs.allowed_year, cs.allowed_groups
     ORDER BY q.subject, COALESCE(q.chapter_num,1)`
  ).catch(async () => {
    // Fallback if chapter_settings table missing
    return db.query(
      `SELECT subject, COALESCE(chapter_num,1) AS chapter_num,
              COUNT(*)::int AS question_count
       FROM questions WHERE is_active = TRUE
       GROUP BY subject, chapter_num ORDER BY subject, chapter_num`
    );
  });

  // Students: hide chapters they cannot access
  if (req.user.role === 'student') {
    const profile = await getStudentProfile(req.user.id);
    const visible = rows.filter(r => {
      const settings = {
        available_from: r.available_from,
        available_to:   r.available_to,
        allowed_year:   r.allowed_year,
        allowed_groups: r.allowed_groups,
      };
      return isChapterVisibleToStudent(settings, profile).visible;
    });
    return res.json(visible);
  }

  res.json(rows);
});

// ?? GET /api/questions/chapter-settings — admin view of all settings ────────
router.get('/chapter-settings',
  authorize('dekanat', 'admin', 'teacher'),
  async (req, res) => {
    try {
      const { rows } = await db.query(
        `SELECT subject, chapter_num, random_count, available_from, available_to,
                allowed_year, allowed_groups, updated_at
         FROM chapter_settings ORDER BY subject, chapter_num`
      );
      res.json(rows);
    } catch { res.json([]); }
  }
);

// ?? PUT /api/questions/chapter-settings — upsert single chapter's rules ─────
router.put('/chapter-settings',
  authorize('dekanat', 'admin'),
  [
    body('subject').trim().notEmpty(),
    body('chapter_num').isInt({ min: 1 }).toInt(),
    body('random_count').optional({ nullable: true }).isInt({ min: 1, max: 1000 }).toInt(),
    body('available_from').optional({ nullable: true }).isISO8601(),
    body('available_to').optional({ nullable: true }).isISO8601(),
    body('allowed_year').optional({ nullable: true }).isInt({ min: 1, max: 6 }).toInt(),
    body('allowed_groups').optional({ nullable: true }).isArray(),
  ],
  validate,
  async (req, res) => {
    const { subject, chapter_num, random_count, available_from, available_to,
            allowed_year, allowed_groups } = req.body;
    const { rows } = await db.query(
      `INSERT INTO chapter_settings
         (subject, chapter_num, random_count, available_from, available_to,
          allowed_year, allowed_groups, created_by, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8, NOW())
       ON CONFLICT (subject, chapter_num) DO UPDATE SET
         random_count   = EXCLUDED.random_count,
         available_from = EXCLUDED.available_from,
         available_to   = EXCLUDED.available_to,
         allowed_year   = EXCLUDED.allowed_year,
         allowed_groups = EXCLUDED.allowed_groups,
         updated_at     = NOW()
       RETURNING *`,
      [subject, chapter_num, random_count || null, available_from || null,
       available_to || null, allowed_year || null,
       Array.isArray(allowed_groups) && allowed_groups.length ? allowed_groups : null,
       req.user.id]
    );
    res.json(rows[0]);
  }
);

// ?? DELETE /api/questions/bulk — wipe all (optionally per subject/chapter) ─
router.delete('/bulk',
  authorize('dekanat', 'admin'),
  async (req, res) => {
    const { subject, chapter } = req.query;
    const params = [];
    let where = 'is_active = TRUE';
    if (subject) { params.push(subject); where += ` AND subject = $${params.length}`; }
    if (chapter) { params.push(parseInt(chapter, 10)); where += ` AND chapter_num = $${params.length}`; }
    const { rowCount } = await db.query(
      `UPDATE questions SET is_active = FALSE, updated_at = NOW() WHERE ${where}`,
      params
    );
    res.json({ message: 'Savollar o\'chirildi', deleted: rowCount });
  }
);

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

    // ── Detect matrix/formula PDF (delimited by '#') ──────────────────────────
    // These PDFs contain mathematical matrices and cannot be parsed by regex.
    // Use GPT-4 with a matrix-specific prompt to reconstruct LaTeX from garbled text.
    const hashBlocks = rawText.split(/\n?#+\s*/).filter(s => s.trim().length > 15);
    const isMatrixPdf = hashBlocks.length >= 3;

    // ── Hash-split fallback (no GPT-4 needed) ─────────────────────────────────
    // Even without AI, save the question blocks so they appear in the system.
    // Each block's text is stored as-is; options are extracted by '=' separators.
    if (isMatrixPdf && questions.length < hashBlocks.length / 2) {
      const hashParsed = hashBlocks.map((block, idx) => {
        const clean = block.replace(/[□■▪▫◻◼]/g, '').replace(/\s{3,}/g, ' ').trim();
        if (clean.length < 10) return null;
        // Split block into question part and options part
        // Options usually start after "toping" or "toping." or after 4 '=' signs
        const topingIdx = clean.search(/toping[\.\s]/i);
        const qEnd = topingIdx > 0 ? topingIdx + 6 : Math.floor(clean.length * 0.4);
        const qText = clean.slice(0, qEnd).trim() || clean.slice(0, 200).trim();
        const optPart = clean.slice(qEnd).trim();
        // Try to split options by '=(' or '= (' pattern
        const optSplit = optPart.split(/=\s*\(|\n{2,}/).map(s => s.trim()).filter(s => s.length > 0);
        return {
          text: 'Savol ' + (idx + 1) + ': ' + qText,
          a: optSplit[0] ? ('(' + optSplit[0]).slice(0, 200) : '(variant A)',
          b: optSplit[1] ? ('(' + optSplit[1]).slice(0, 200) : '(variant B)',
          c: optSplit[2] ? ('(' + optSplit[2]).slice(0, 200) : '(variant C)',
          d: optSplit[3] ? ('(' + optSplit[3]).slice(0, 200) : '(variant D)',
          correct: 'A',
          explanation: null,
        };
      }).filter(Boolean);

      if (hashParsed.length > questions.length) {
        questions = hashParsed;
        logger.info(`[upload-pdf] Hash-split fallback: ${questions.length} blocks saved`);
      }
    }

    if ((isMatrixPdf && questions.length < hashBlocks.length / 2) && process.env.OPENAI_API_KEY) {
      try {
        const OpenAI = require('openai');
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        logger.info(`[upload-pdf] Matrix PDF detected: ${hashBlocks.length} blocks. Using GPT-4 parser.`);

        const BATCH = 10; // questions per GPT-4 request
        const allAiQuestions = [];

        for (let b = 0; b < hashBlocks.length; b += BATCH) {
          const chunk = hashBlocks.slice(b, b + BATCH)
            .map((block, i) => `SAVOL ${b + i + 1}:\n${block.trim().replace(/\s{3,}/g, ' ')}`)
            .join('\n\n---\n\n')
            .slice(0, 8000);

          const completion = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [{
              role: 'system',
              content: `Sen matematik test savollarini PDF matnidan tuzatuvchi yordamchisan.
PDF dan olingan matn matritsa va formulalarni buzilgan holda ko'rsatadi.
Har bir savolni to'g'ri LaTeX formatida qaytarishing kerak.
Matritsalar uchun: $\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}$
Kasrlar: $\\frac{a}{b}$, inline: $x$, display: $$x$$
To'g'ri javobni aniqlashga urinib ko'r, bilmasang "A" deb qo'y.
FAQAT JSON massiv qaytarilsin — boshqa matn yo'q.`
            }, {
              role: 'user',
              content: `Quyidagi PDF matnidagi savollarni to'g'ri LaTeX formatiga o'tkazib, JSON massiv qaytargil.
Har element: {"question_text":"...","option_a":"...","option_b":"...","option_c":"...","option_d":"...","correct_option":"A"}
Matritsa variantlari LaTeX da yozilsin.

${chunk}`
            }],
            max_tokens: 4000,
            temperature: 0.1,
            response_format: { type: 'json_object' },
          });

          try {
            const obj = JSON.parse(completion.choices[0].message.content || '{}');
            const list = Array.isArray(obj) ? obj : (obj.questions || obj.savollar || Object.values(obj)[0] || []);
            if (Array.isArray(list)) {
              list.forEach(q => {
                if (q.question_text && (q.option_a || q.option_b)) {
                  allAiQuestions.push({
                    text: q.question_text.trim(),
                    a: q.option_a || '—', b: q.option_b || '—',
                    c: q.option_c || '—', d: q.option_d || '—',
                    correct: (['A','B','C','D'].includes((q.correct_option||'A').toUpperCase()))
                             ? (q.correct_option||'A').toUpperCase() : 'A',
                    explanation: q.explanation || null,
                  });
                }
              });
            }
          } catch(parseErr) {
            logger.warn('[upload-pdf] GPT-4 batch parse error:', parseErr.message);
          }
        }

        if (allAiQuestions.length > questions.length) {
          questions = allAiQuestions;
          aiParsed = true;
          logger.info(`[upload-pdf] GPT-4 matrix parser: ${questions.length} questions extracted`);
        }
      } catch (aiErr) {
        logger.warn('[upload-pdf] Matrix AI parse failed:', aiErr.message);
      }
    }

    // ── Standard AI fallback: if regex parser finds nothing ────────────────────
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
Savollarni topib, JSON massiv qaytar. Faqat JSON massiv, boshqa matn yo'q.
Har element: {"question_text":"...","option_a":"...","option_b":"...","option_c":"...","option_d":"...","correct_option":"A"}
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

    // Determine starting chapter_num: find max chapter already in DB for this subject
    let startChapter = 1;
    try {
      const { rows: chRows } = await db.query(
        `SELECT COALESCE(MAX(chapter_num), 0) AS max_ch FROM questions WHERE subject = $1 AND is_active = TRUE`,
        [subject]
      );
      startChapter = (chRows[0]?.max_ch || 0) + 1;
    } catch (_) { startChapter = 1; }

    // ── Bob (chapter) bo'lish strategiyasi ──────────────────────────────
    // Frontend uchta rejimni jo'natishi mumkin:
    //   chapterMode='size'  + chapterSize  → har bobda N savol
    //   chapterMode='count' + chapterCount → jami N ta bob (teng taqsim)
    //   chapterMode='auto'  (default)      → har 20 savolda 1 bob
    const chapterMode = String(req.body.chapterMode || 'auto').toLowerCase();
    const reqSize  = parseInt(req.body.chapterSize,  10);
    const reqCount = parseInt(req.body.chapterCount, 10);

    // Effective size per chapter (clamped to a sane range)
    let effectiveSize;
    if (chapterMode === 'count' && reqCount > 0) {
      effectiveSize = Math.max(1, Math.ceil(questions.length / reqCount));
    } else if (chapterMode === 'size' && reqSize > 0) {
      effectiveSize = reqSize;
    } else {
      effectiveSize = 20; // auto / fallback
    }
    // Hard guardrails: 1 ≤ size ≤ 1000
    effectiveSize = Math.min(1000, Math.max(1, effectiveSize));

    logger.info(`[upload-pdf] chapter strategy: mode=${chapterMode} size=${effectiveSize} (${questions.length} questions → ${Math.ceil(questions.length/effectiveSize)} chapters)`);

    const CHAPTER_SIZE = effectiveSize;
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

    // ── Persist per-chapter settings (random count, schedule, group access) ──
    // All optional. When provided, applied to every chapter just created.
    try {
      const rndC = parseInt(req.body.randomCount, 10);
      const avFrom = req.body.availableFrom ? new Date(req.body.availableFrom) : null;
      const avTo   = req.body.availableTo   ? new Date(req.body.availableTo)   : null;
      const allowedYear = parseInt(req.body.allowedYear, 10) || null;
      // allowedGroups arrives as csv "101,102,201A" or JSON array
      let allowedGroups = req.body.allowedGroups;
      if (typeof allowedGroups === 'string') {
        allowedGroups = allowedGroups.split(',').map(s => s.trim()).filter(Boolean);
      }
      if (!Array.isArray(allowedGroups) || !allowedGroups.length) allowedGroups = null;

      const hasAnySetting = (rndC > 0) || avFrom || avTo || allowedYear || allowedGroups;
      if (hasAnySetting && chaptersCreated > 0) {
        // Ensure table exists (defensive — migration 010 may not have run yet)
        await db.query(`
          CREATE TABLE IF NOT EXISTS chapter_settings (
            id SERIAL PRIMARY KEY,
            subject VARCHAR(50) NOT NULL,
            chapter_num INTEGER NOT NULL,
            random_count INTEGER,
            available_from TIMESTAMPTZ,
            available_to TIMESTAMPTZ,
            allowed_year SMALLINT,
            allowed_groups TEXT[],
            created_by INTEGER,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE(subject, chapter_num)
          )`).catch(()=>{});
        for (let c = 0; c < chaptersCreated; c++) {
          const chNum = startChapter + c;
          await db.query(
            `INSERT INTO chapter_settings
               (subject, chapter_num, random_count, available_from, available_to,
                allowed_year, allowed_groups, created_by, updated_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8, NOW())
             ON CONFLICT (subject, chapter_num) DO UPDATE SET
               random_count   = EXCLUDED.random_count,
               available_from = EXCLUDED.available_from,
               available_to   = EXCLUDED.available_to,
               allowed_year   = EXCLUDED.allowed_year,
               allowed_groups = EXCLUDED.allowed_groups,
               updated_at     = NOW()`,
            [subject, chNum, rndC > 0 ? rndC : null, avFrom, avTo,
             allowedYear, allowedGroups, req.user.id]
          ).catch(err => logger.warn(`[upload-pdf] chapter_settings upsert failed: ${err.message}`));
        }
        logger.info(`[upload-pdf] chapter_settings written for chapters ${startChapter}-${startChapter+chaptersCreated-1}`);
      }
    } catch (sErr) {
      logger.warn(`[upload-pdf] chapter_settings block failed: ${sErr.message}`);
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

  // Option line: A) A. A: (A) А) А. etc. — ONLY punctuation delimiter (never bare space)
  // Bare-space matching (e.g. "A some text") is too risky: question text itself can start with A/B/C/D.
  const OPT_RE = /^[(]?\s*([AaBbCcDdАБВГСДсд])\s*[.):\-]\s*(.+)/;

  function parseOpt(line) {
    const m = line.match(OPT_RE);
    if (m) return { letter: m[1], val: m[2].trim() };
    return null;
  }

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
      const parsed = parseOpt(bLines[i]);
      if (parsed || /^(?:to[''`']?g|togri|javob|answer|correct)/i.test(bLines[i])) {
        optStart = i; break;
      }
      qParts.push(bLines[i]);
    }

    const qText = qParts.join(' ').replace(/\s+/g, ' ').trim();
    if (!qText || qText.length < 3) return null;

    let a, b, c, d, correct, explanation;

    for (let i = optStart; i < bLines.length; i++) {
      const line = bLines[i];
      const optM = parseOpt(line);
      if (optM) {
        const letter = normLetter(optM.letter);
        const val = optM.val;
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

  // ── STRATEGY 1: multi-line blocks (standard + space-delimited format) ──────────
  // Handles both "1. Savol" and "1 Savol" formats.
  // Guard against false positives like "33 ta", "34-yil" using negative lookahead.
  function strategyMultiLine() {
    const results = [];

    // Primary: number + punctuation delimiter (most reliable)
    const START_PUNCT = /^\s*(\d{1,3})\s*[-.):#]\s*(?:savol[.\s]*)?\s*(.*)/i;
    // Secondary: number + space + real question text
    // Rules to avoid false positives like "33 ta" / "12 yil" / page numbers:
    //   - Skip common non-question words (ta, yil, kun, oy, ...)
    //   - Text must be ≥10 chars
    //   - Must NOT start with A/B/C/D (would confuse with option lines if question restarts)
    const START_SPACE = /^\s*(\d{1,3})\s+(?!(?:ta|yil|kun|oy|soat|nchi|inch|bet|sahifa|variant|bob|guruh|sinf|[ABCD][\s.):\-])\b)([A-ZА-ЯҚҒҲЎa-zа-яқғҳўЀ-ӿ].{9,})/;

    const lines = text.split('\n');
    const blocks = [];
    let cur = null;
    let lastNum = 0;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Try punctuation delimiter first, then space delimiter
      let m = trimmed.match(START_PUNCT) || trimmed.match(START_SPACE);
      if (m) {
        const num = parseInt(m[1], 10);
        const rest = (m[2] || '').trim();

        // Sanity: if space-delimited, the rest must look like a sentence (not a lone digit or letter)
        if (!trimmed.match(START_PUNCT) && rest.length < 8) { m = null; }

        if (m) {
          const isReset = num === 1 && lastNum > 5;       // new chapter/section
          const isSeq   = num > lastNum && num <= lastNum + 100;
          const isFirst = cur === null;

          if (isFirst || isReset || isSeq) {
            if (cur) blocks.push(cur);
            cur = { num, lines: rest ? [rest] : [] };
            lastNum = num;
            continue;
          }
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
    const flat = text.replace(/\n/g, ' ');
    // Split on question number boundaries: "1." "1)" "1 " (space + capital)
    const parts = flat.split(/(?=\s+\d{1,3}\s*[.)]\s|\s+\d{1,3}\s+[A-ZА-ЯӲҚҒҲЎa-z]{2})/);

    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      // Strip leading question number
      const noNum = trimmed.replace(/^\d{1,3}\s*[-.):#]?\s*/, '');
      // Split on option boundaries
      const subLines = noNum
        .split(/\s+(?=[ABCDАБВГabcdабвг]\s*[.):\-]|\bTo[''']?g|togri|javob|answer|correct)/i)
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

  // Run all strategies; pick the one that finds the most questions
  const s1 = strategyMultiLine();
  const s2 = strategySingleLine();
  const s3 = strategyRegexScan();
  const s4 = strategyStandaloneOptions();

  // Always merge all strategies — dedup by first 60 chars of question text
  let questions = dedupByText([...s1, ...s2, ...s3, ...s4]);

  // If merged is worse than best single strategy, use best single
  const best = [s1, s2, s3, s4].reduce((a, b) => a.length >= b.length ? a : b, []);
  if (best.length > questions.length) questions = best;

  return questions;
}

module.exports = router;
