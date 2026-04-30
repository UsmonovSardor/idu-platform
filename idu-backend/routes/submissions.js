'use strict';
const express = require('express');
const router  = express.Router();
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

// AI tekshiruv funksiyasi
async function checkWithAI(assignmentTitle, assignmentDesc, studentAnswer) {
  const prompt = `Sen IDU universitetining professional o'qituvchisisiz.
Vazifa: "${assignmentTitle}"
Vazifa tavsifi: "${assignmentDesc}"
Talaba javobi: "${studentAnswer}"

Quyidagilarni o'zbek tilida baholang:
1. Ball (0-100): faqat raqam
2. Xatolar: nima noto'g'ri yoki yetishmayapti
3. Ijobiy tomonlar: nima yaxshi qilingan
4. Tavsiyalar: qanday yaxshilash mumkin

Javobni quyidagi JSON formatida bering:
{"ball": 85, "xatolar": "...", "ijobiy": "...", "tavsiyalar": "..."}`;

  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 500
    })
  });
  const data = await resp.json();
  const text = data.choices?.[0]?.message?.content || '{}';
  try {
    const clean = text.replace(/```json|```/g, '').trim();
    return JSON.parse(clean);
  } catch {
    return { ball: 0, xatolar: text, ijobiy: '', tavsiyalar: '' };
  }
}

// POST /api/submissions — talaba javob yuboradi + AI tekshiradi
router.post('/', async (req, res) => {
  const { assignment_id, content } = req.body;
  const studentId = req.user?.id;
  if (!assignment_id || !content) return res.status(400).json({ error: 'assignment_id va content majburiy' });

  // Vazifani topamiz
  const asgn = await pool.query('SELECT * FROM assignments WHERE id=$1', [assignment_id]);
  if (!asgn.rows[0]) return res.status(404).json({ error: 'Vazifa topilmadi' });

  // Avval yuborilganmi?
  const exists = await pool.query('SELECT id FROM submissions WHERE assignment_id=$1 AND student_id=$2', [assignment_id, studentId]);
  
  // AI tekshiruv
  const ai = await checkWithAI(asgn.rows[0].title, asgn.rows[0].description, content);

  if (exists.rows[0]) {
    // Qayta yuborish — yangilash
    const upd = await pool.query(
      `UPDATE submissions SET content=$1, ai_ball=$2, ai_xatolar=$3, ai_ijobiy=$4, ai_tavsiyalar=$5, submitted_at=NOW()
       WHERE assignment_id=$6 AND student_id=$7 RETURNING *`,
      [content, ai.ball, ai.xatolar, ai.ijobiy, ai.tavsiyalar, assignment_id, studentId]);
    return res.json({ submission: upd.rows[0], ai_feedback: ai });
  }

  const ins = await pool.query(
    `INSERT INTO submissions (assignment_id, student_id, content, ai_ball, ai_xatolar, ai_ijobiy, ai_tavsiyalar)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [assignment_id, studentId, content, ai.ball, ai.xatolar, ai.ijobiy, ai.tavsiyalar]);
  res.status(201).json({ submission: ins.rows[0], ai_feedback: ai });
});

// GET /api/submissions/assignment/:id — ustoz barcha javoblarni ko'radi
router.get('/assignment/:id', async (req, res) => {
  const role = req.user?.role;
  if (!['teacher','dekanat','admin'].includes(role)) return res.status(403).json({ error: 'Ruxsat yoq' });
  const r = await pool.query(
    `SELECT s.*, u.full_name AS student_name
     FROM submissions s JOIN users u ON u.id=s.student_id
     WHERE s.assignment_id=$1 ORDER BY s.submitted_at DESC`, [req.params.id]);
  res.json({ submissions: r.rows });
});

// GET /api/submissions/my — talaba o'z javoblarini ko'radi
router.get('/my', async (req, res) => {
  const r = await pool.query(
    `SELECT s.*, a.title AS assignment_title, a.deadline
     FROM submissions s JOIN assignments a ON a.id=s.assignment_id
     WHERE s.student_id=$1 ORDER BY s.submitted_at DESC`, [req.user.id]);
  res.json({ submissions: r.rows });
});

module.exports = router;
