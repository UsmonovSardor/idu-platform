'use strict';
const express = require('express');
const router  = express.Router();
const db      = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

// AI grading via Anthropic claude-haiku
async function gradeWithAI(title, description, answer) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { ball: 0, xatolar: 'AI kalit topilmadi', ijobiy: '', tavsiyalar: '' };

  const prompt = `Sen IDU universitetining professional o'qituvchisisiz. Quyidagi vazifaga berilgan talaba javobini baholang.

Vazifa: "${title}"
Vazifa tavsifi: "${description}"
Talaba javobi: "${answer.substring(0, 3000)}"

Quyidagi JSON formatida o'zbek tilida javob bering (faqat JSON, hech qanday qo'shimcha matn yo'q):
{"ball": <0-100 son>, "xatolar": "<nima yetishmayapti yoki noto'g'ri>", "ijobiy": "<nima yaxshi qilingan>", "tavsiyalar": "<qanday yaxshilash mumkin>"}`;

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 600,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    const data = await resp.json();
    const text = data.content?.[0]?.text || '{}';
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    return {
      ball:        Math.min(100, Math.max(0, Number(parsed.ball) || 0)),
      xatolar:     parsed.xatolar || '',
      ijobiy:      parsed.ijobiy  || '',
      tavsiyalar:  parsed.tavsiyalar || ''
    };
  } catch(e) {
    return { ball: 0, xatolar: 'AI tekshirishda xato: ' + e.message, ijobiy: '', tavsiyalar: '' };
  }
}

// POST /api/submissions — talaba javob yuboradi
router.post('/', async (req, res) => {
  const { assignment_id, content } = req.body;
  if (!assignment_id || !content) return res.status(400).json({ error: 'assignment_id va content majburiy' });

  const asgn = await db.query('SELECT * FROM assignments WHERE id=$1', [assignment_id]);
  if (!asgn.rows[0]) return res.status(404).json({ error: 'Vazifa topilmadi' });

  const ai = await gradeWithAI(asgn.rows[0].title, asgn.rows[0].description, content);

  const exists = await db.query(
    'SELECT id FROM submissions WHERE assignment_id=$1 AND student_id=$2',
    [assignment_id, req.user.id]
  );

  let row;
  if (exists.rows[0]) {
    const r = await db.query(
      `UPDATE submissions SET content=$1, ai_ball=$2, ai_xatolar=$3, ai_ijobiy=$4,
       ai_tavsiyalar=$5, updated_at=NOW(), teacher_score=NULL, teacher_comment=NULL
       WHERE assignment_id=$6 AND student_id=$7 RETURNING *`,
      [content, ai.ball, ai.xatolar, ai.ijobiy, ai.tavsiyalar, assignment_id, req.user.id]
    );
    row = r.rows[0];
  } else {
    const r = await db.query(
      `INSERT INTO submissions (assignment_id, student_id, content, ai_ball, ai_xatolar, ai_ijobiy, ai_tavsiyalar)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [assignment_id, req.user.id, content, ai.ball, ai.xatolar, ai.ijobiy, ai.tavsiyalar]
    );
    row = r.rows[0];
  }

  res.status(201).json({ submission: row, ai_feedback: ai });
});

// GET /api/submissions/my — talaba o'z javoblarini ko'radi
router.get('/my', async (req, res) => {
  const { rows } = await db.query(
    `SELECT s.*, a.title AS assignment_title, a.description AS assignment_desc,
            a.deadline, a.max_score, a.subject
     FROM submissions s
     JOIN assignments a ON a.id = s.assignment_id
     WHERE s.student_id = $1
     ORDER BY s.submitted_at DESC`,
    [req.user.id]
  );
  res.json({ submissions: rows });
});

// GET /api/submissions/assignment/:id — ustoz barcha javoblarni ko'radi
router.get('/assignment/:id', authorize('teacher','dekanat','admin'), async (req, res) => {
  const { rows } = await db.query(
    `SELECT s.*, u.full_name AS student_name, st.group_name
     FROM submissions s
     JOIN users u ON u.id = s.student_id
     LEFT JOIN students st ON st.user_id = s.student_id
     WHERE s.assignment_id = $1
     ORDER BY s.submitted_at DESC`,
    [req.params.id]
  );
  res.json({ submissions: rows });
});

// PATCH /api/submissions/:id/approve — ustoz yakuniy baho qo'yadi
router.patch('/:id/approve', authorize('teacher','dekanat','admin'), async (req, res) => {
  const { teacher_score, teacher_comment } = req.body;
  if (teacher_score === undefined || teacher_score === null) {
    return res.status(400).json({ error: 'teacher_score majburiy' });
  }
  const score = Math.min(100, Math.max(0, Number(teacher_score)));
  const { rows, rowCount } = await db.query(
    `UPDATE submissions
     SET teacher_score=$1, teacher_comment=$2, updated_at=NOW()
     WHERE id=$3
     RETURNING *`,
    [score, teacher_comment || null, req.params.id]
  );
  if (!rowCount) return res.status(404).json({ error: 'Topilmadi' });
  res.json({ submission: rows[0] });
});

module.exports = router;
