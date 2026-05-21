'use strict';

const express = require('express');
const PDFDocument = require('pdfkit');
const db      = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// ── GET /api/documents/transcript/:studentId ─────────────────────────────────
router.get('/transcript/:studentId', async (req, res) => {
  const targetId = parseInt(req.params.studentId, 10);

  // Students can only get their own; dekanat/admin can get anyone's
  if (req.user.role === 'student' && req.user.id !== targetId) {
    return res.status(403).json({ error: 'Ruxsat yo\'q' });
  }

  const { rows: [student] } = await db.query(
    `SELECT u.id, u.full_name, u.email, u.group_name, u.year,
            u.created_at AS enrolled_at
     FROM users u
     WHERE u.id=$1 AND u.role='student'`,
    [targetId]
  );
  if (!student) return res.status(404).json({ error: 'Talaba topilmadi' });

  const { rows: grades } = await db.query(
    `SELECT g.subject, g.score, g.semester, g.academic_year, g.created_at
     FROM grades g
     WHERE g.student_id=$1
     ORDER BY g.academic_year, g.semester, g.subject`,
    [targetId]
  );

  const { rows: [xpRow] } = await db.query(
    'SELECT xp, level FROM user_xp WHERE user_id=$1',
    [targetId]
  ).catch(() => ({ rows: [null] }));

  // Build PDF
  res.setHeader('Content-Type',        'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="transcript_${student.full_name.replace(/\s+/g,'_')}.pdf"`);

  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  doc.pipe(res);

  const W = doc.page.width - 100; // usable width

  // ── Header ──
  doc.rect(50, 40, W, 80).fill('#1B4FD8');
  doc.fillColor('#ffffff').fontSize(20).font('Helvetica-Bold')
     .text('INTERNATIONAL DIGITAL UNIVERSITY', 50, 55, { width: W, align: 'center' });
  doc.fontSize(11).font('Helvetica')
     .text('Toshkent, O\'zbekiston · idu.uz', 50, 80, { width: W, align: 'center' });
  doc.fontSize(13).font('Helvetica-Bold')
     .text('RASMIY AKADEMIK TRANSKRIPT', 50, 100, { width: W, align: 'center' });

  doc.moveDown(3);

  // ── Student info box ──
  const infoY = 140;
  doc.rect(50, infoY, W, 70).stroke('#E2E8F0');
  doc.fillColor('#1E293B').fontSize(10).font('Helvetica-Bold');

  const col1 = 60, col2 = 300;
  doc.text('Talaba:', col1, infoY + 10);
  doc.text('Guruh:', col1, infoY + 25);
  doc.text('Kurs:', col1, infoY + 40);
  doc.text('Email:', col2, infoY + 10);
  doc.text('O\'qishga kirgan:', col2, infoY + 25);
  doc.text('Hujjat sanasi:', col2, infoY + 40);

  doc.font('Helvetica').fillColor('#334155');
  doc.text(student.full_name,  col1 + 60, infoY + 10);
  doc.text(student.group_name || '—', col1 + 60, infoY + 25);
  doc.text((student.year || '1') + '-kurs', col1 + 60, infoY + 40);
  doc.text(student.email, col2 + 90, infoY + 10);
  doc.text(new Date(student.enrolled_at).toLocaleDateString('uz-UZ'), col2 + 90, infoY + 25);
  doc.text(new Date().toLocaleDateString('uz-UZ'), col2 + 90, infoY + 40);

  doc.moveDown(6);

  // ── Grades table ──
  const tableTop = infoY + 85;
  const cols = [60, 240, 330, 400, 460];

  // Table header
  doc.rect(50, tableTop, W, 20).fill('#1B4FD8');
  doc.fillColor('#ffffff').fontSize(9).font('Helvetica-Bold');
  ['Fan', 'Semestr', 'O\'quv yil', 'Ball', 'Baho'].forEach((h, i) => {
    doc.text(h, cols[i], tableTop + 6, { width: (cols[i+1] || 50+W) - cols[i] - 4 });
  });

  // Table rows
  let rowY = tableTop + 20;
  let totalScore = 0, gradeCount = 0;

  if (!grades.length) {
    doc.fillColor('#94A3B8').fontSize(10).font('Helvetica')
       .text('Baholar mavjud emas', 60, rowY + 8);
    rowY += 24;
  }

  grades.forEach((g, idx) => {
    if (rowY > doc.page.height - 100) { doc.addPage(); rowY = 60; }
    const bg = idx % 2 === 0 ? '#F8FAFC' : '#FFFFFF';
    doc.rect(50, rowY, W, 20).fill(bg);

    const score = parseFloat(g.score) || 0;
    totalScore += score;
    gradeCount++;
    const letter = score >= 86 ? 'A' : score >= 71 ? 'B' : score >= 56 ? 'C' : score >= 41 ? 'D' : 'F';
    const letterColor = score >= 71 ? '#16A34A' : score >= 56 ? '#D97706' : '#DC2626';

    doc.fillColor('#334155').fontSize(9).font('Helvetica');
    doc.text(g.subject || '—',        cols[0], rowY + 6, { width: cols[1]-cols[0]-4 });
    doc.text((g.semester || '—') + '-sem', cols[1], rowY + 6);
    doc.text(g.academic_year || '—',  cols[2], rowY + 6);
    doc.text(score.toFixed(0),         cols[3], rowY + 6);

    doc.fillColor(letterColor).font('Helvetica-Bold')
       .text(letter, cols[4], rowY + 6);

    rowY += 20;
  });

  // ── Summary ──
  rowY += 10;
  const avgScore = gradeCount ? (totalScore / gradeCount).toFixed(1) : '—';
  const gpa = gradeCount ? (parseFloat(avgScore) / 25).toFixed(2) : '—';

  doc.rect(50, rowY, W, 40).fill('#F0F9FF').stroke('#BAE6FD');
  doc.fillColor('#1E40AF').fontSize(10).font('Helvetica-Bold');
  doc.text(`O'rtacha ball: ${avgScore}`, 60, rowY + 8);
  doc.text(`GPA: ${gpa} / 4.00`, 60, rowY + 22);
  if (xpRow) {
    doc.fillColor('#7C3AED').text(`IDU XP: ${xpRow.xp} · Level ${xpRow.level}`, 280, rowY + 8);
  }

  // ── Footer ──
  const footerY = doc.page.height - 80;
  doc.rect(50, footerY, W, 50).fill('#F8FAFC').stroke('#E2E8F0');
  doc.fillColor('#64748B').fontSize(8).font('Helvetica');
  doc.text('Ushbu hujjat IDU platformasi tomonidan avtomatik yaratilgan.', 60, footerY + 8, { width: W - 20, align: 'center' });
  doc.text('Rasmiy tasdiqlash uchun dekanat bilan bog\'laning: dekanat@idu.uz', 60, footerY + 20, { width: W - 20, align: 'center' });
  doc.text(`Hujjat ID: IDU-${Date.now()}-${targetId}`, 60, footerY + 32, { width: W - 20, align: 'center' });

  doc.end();
});

// ── GET /api/documents/certificate/:studentId ─────────────────────────────────
router.get('/certificate/:studentId', authorize('dekanat', 'admin'), async (req, res) => {
  const targetId = parseInt(req.params.studentId, 10);

  const { rows: [student] } = await db.query(
    `SELECT u.full_name, u.group_name, u.year FROM users u WHERE u.id=$1 AND u.role='student'`,
    [targetId]
  );
  if (!student) return res.status(404).json({ error: 'Talaba topilmadi' });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="certificate_${student.full_name.replace(/\s+/g,'_')}.pdf"`);

  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 60 });
  doc.pipe(res);

  const PW = doc.page.width  - 120;
  const PH = doc.page.height - 120;

  // Decorative border
  doc.rect(40, 40, doc.page.width - 80, doc.page.height - 80)
     .lineWidth(4).stroke('#1B4FD8');
  doc.rect(48, 48, doc.page.width - 96, doc.page.height - 96)
     .lineWidth(1).stroke('#93C5FD');

  // Title
  doc.fillColor('#1B4FD8').fontSize(36).font('Helvetica-Bold')
     .text("SERTIFIKAT", 60, 80, { width: PW, align: 'center' });

  doc.fillColor('#64748B').fontSize(13).font('Helvetica')
     .text('International Digital University', 60, 130, { width: PW, align: 'center' });

  doc.fillColor('#334155').fontSize(16).font('Helvetica')
     .text('ushbu sertifikatni', 60, 175, { width: PW, align: 'center' });

  doc.fillColor('#1E293B').fontSize(28).font('Helvetica-Bold')
     .text(student.full_name, 60, 205, { width: PW, align: 'center' });

  doc.fillColor('#334155').fontSize(14).font('Helvetica')
     .text(`${student.group_name || ''} guruhi, ${student.year || '1'}-kurs talebasi`, 60, 250, { width: PW, align: 'center' })
     .text('muvaffaqiyatli o\'qib, barcha fanlardan o\'tganligi tasdiqlaydi.', 60, 272, { width: PW, align: 'center' });

  // Date and signature line
  const sigY = doc.page.height - 120;
  doc.moveTo(100, sigY).lineTo(280, sigY).lineWidth(1).stroke('#334155');
  doc.moveTo(doc.page.width - 280, sigY).lineTo(doc.page.width - 100, sigY).lineWidth(1).stroke('#334155');

  doc.fillColor('#64748B').fontSize(10).font('Helvetica')
     .text('Sana: ' + new Date().toLocaleDateString('uz-UZ'), 100, sigY + 6)
     .text('Dekan imzosi', doc.page.width - 280, sigY + 6, { width: 180, align: 'center' });

  doc.fillColor('#94A3B8').fontSize(8)
     .text(`Hujjat ID: IDU-CERT-${Date.now()}`, 60, doc.page.height - 60, { width: PW, align: 'center' });

  doc.end();
});

module.exports = router;
