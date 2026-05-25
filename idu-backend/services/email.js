'use strict';
/**
 * IDU Email Service
 * Supports: Resend SMTP relay (RESEND_API_KEY) · nodemailer SMTP (SMTP_HOST)
 * Dev fallback: prints to logger when no transport configured.
 */

const nodemailer = require('nodemailer');
const { logger }  = require('../middleware/logger');

const FROM_NAME    = process.env.FROM_NAME  || 'IDU Platform';
const FROM_EMAIL   = process.env.FROM_EMAIL || 'noreply@idu.uz';
const PLATFORM_URL = process.env.PLATFORM_URL || 'https://idu-platform-production.up.railway.app';

let _transport = null;

function buildTransport() {
  if (_transport) return _transport;

  if (process.env.RESEND_API_KEY) {
    _transport = nodemailer.createTransport({
      host: 'smtp.resend.com', port: 465, secure: true,
      auth: { user: 'resend', pass: process.env.RESEND_API_KEY },
    });
    logger.info('[email] using Resend SMTP relay');
  } else if (process.env.SMTP_HOST) {
    _transport = nodemailer.createTransport({
      host:   process.env.SMTP_HOST,
      port:   parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth:   { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    logger.info('[email] using custom SMTP: %s', process.env.SMTP_HOST);
  } else {
    logger.warn('[email] No SMTP configured — emails will be logged to console only.');
    _transport = null;
  }
  return _transport;
}

async function sendMail({ to, subject, html, text }) {
  const t = buildTransport();
  if (!t) {
    logger.info('[email:dev] To=%s Subject="%s"\n%s', to, subject, text || '(html only)');
    return { messageId: 'dev-' + Date.now(), accepted: [to] };
  }
  try {
    const info = await t.sendMail({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to, subject, html,
      text: text || html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
    });
    logger.info('[email] sent to=%s id=%s', to, info.messageId);
    return info;
  } catch (err) {
    logger.error('[email] FAILED to=%s: %s', to, err.message);
    throw err;
  }
}

// ── Shared layout wrapper ──────────────────────────────────────────────────────
function layout(bodyContent, preheader = '') {
  return `<!DOCTYPE html>
<html lang="uz">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>IDU Platform</title>
<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:#F0F4F8;font-family:'Segoe UI',Arial,sans-serif;color:#1e293b}
  .wrap{max-width:520px;margin:32px auto;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 4px 32px rgba(0,0,0,0.10)}
  .hdr{background:linear-gradient(135deg,#1e40af 0%,#0891b2 100%);padding:32px 36px 28px;text-align:center}
  .logo{font-size:30px;font-weight:900;color:#fff;letter-spacing:-1.5px}
  .logo-sub{font-size:12px;color:rgba(255,255,255,0.65);margin-top:3px;letter-spacing:0.5px}
  .body{padding:36px}
  .greeting{font-size:15px;color:#475569;line-height:1.7;margin-bottom:24px}
  .footer{background:#F8FAFC;padding:18px 36px;text-align:center;font-size:11px;color:#94A3B8;border-top:1px solid #E2E8F0}
  a.btn{display:inline-block;background:linear-gradient(135deg,#1e40af,#0891b2);color:#fff!important;text-decoration:none;padding:13px 36px;border-radius:12px;font-weight:700;font-size:14px;margin-top:24px;letter-spacing:0.2px}
  .divider{border:none;border-top:1px solid #F1F5F9;margin:24px 0}
</style>
</head>
<body>
${preheader ? `<div style="display:none;max-height:0;overflow:hidden">${preheader}</div>` : ''}
<div class="wrap">
  <div class="hdr">
    <div class="logo">IDU</div>
    <div class="logo-sub">International Digital University</div>
  </div>
  <div class="body">${bodyContent}</div>
  <div class="footer">
    © ${new Date().getFullYear()} IDU Platform &nbsp;·&nbsp;
    <a href="${PLATFORM_URL}" style="color:#94A3B8;text-decoration:none">idu.uz</a>
  </div>
</div>
</body>
</html>`;
}

// ── Template: Password reset OTP ──────────────────────────────────────────────
function passwordResetTemplate(name, otp) {
  const body = `
    <p class="greeting">Salom, <strong>${name}</strong>!<br>
    Parolingizni tiklash uchun quyidagi bir martalik kodni kiriting.</p>

    <div style="background:#EFF6FF;border:1.5px solid #BFDBFE;border-radius:14px;padding:28px;text-align:center;margin:8px 0">
      <div style="font-size:13px;color:#1e40af;font-weight:600;margin-bottom:10px;text-transform:uppercase;letter-spacing:1px">Tasdiqlash kodi</div>
      <div style="font-size:48px;font-weight:900;letter-spacing:14px;color:#1e40af;font-family:'Courier New',monospace">${otp}</div>
      <div style="font-size:12px;color:#64748B;margin-top:10px">⏱ Kod <strong>10 daqiqa</strong> ichida amal qiladi</div>
    </div>

    <hr class="divider">
    <p style="font-size:12px;color:#94A3B8;line-height:1.7">
      Agar siz bu so'rovni yubormagan bo'lsangiz, ushbu xatni e'tiborsiz qoldiring.
      Akkauntingiz xavfsizligi ta'minlangan.
    </p>`;
  return {
    subject: 'IDU Platform — Parol tiklash kodi',
    html: layout(body, `Parol tiklash kodi: ${otp}`),
  };
}

// ── Template: Exam result ──────────────────────────────────────────────────────
function examResultTemplate(studentName, subject, score, letterGrade) {
  const colors = { A:'#16A34A', B:'#2563EB', C:'#D97706', D:'#EA580C', F:'#DC2626' };
  const color  = colors[letterGrade] || '#64748B';
  const passed = letterGrade !== 'F';
  const body = `
    <p class="greeting">Salom, <strong>${studentName}</strong>!<br>
    Imtihon natijangiz tayyor bo'ldi.</p>

    <div style="background:#F8FAFC;border-radius:14px;padding:28px;text-align:center;border:1.5px solid #E2E8F0">
      <div style="font-size:13px;color:#64748B;font-weight:600;margin-bottom:8px">${subject}</div>
      <div style="font-size:72px;font-weight:900;color:${color};line-height:1">${letterGrade}</div>
      <div style="font-size:22px;font-weight:700;color:#1e293b;margin-top:8px">${score} / 100</div>
      <div style="display:inline-block;margin-top:12px;padding:4px 16px;border-radius:999px;background:${passed?'#DCFCE7':'#FEE2E2'};color:${passed?'#16A34A':'#DC2626'};font-size:12px;font-weight:700">
        ${passed ? '✅ O\'tdingiz!' : '❌ Qayta topshirish kerak'}
      </div>
    </div>

    <a class="btn" href="${PLATFORM_URL}" style="display:block;text-align:center">
      Platformada ko'rish →
    </a>`;
  return {
    subject: `IDU — ${subject} imtihon natijasi: ${letterGrade}`,
    html: layout(body, `${subject} natijangiz: ${letterGrade} (${score}/100)`),
  };
}

// ── Template: Welcome / account created ───────────────────────────────────────
function welcomeTemplate(name, login, tempPassword) {
  const body = `
    <p class="greeting">Salom, <strong>${name}</strong>!<br>
    IDU Platformaga xush kelibsiz. Quyida kirish ma'lumotlaringiz:</p>

    <div style="background:#EFF6FF;border:1.5px solid #BFDBFE;border-radius:14px;padding:20px 24px;margin:8px 0">
      <table style="width:100%;border-collapse:collapse">
        <tr>
          <td style="font-size:13px;color:#64748B;font-weight:500;padding:7px 0">Login</td>
          <td style="font-size:14px;font-weight:800;color:#1e40af;font-family:'Courier New',monospace;text-align:right">${login}</td>
        </tr>
        <tr style="border-top:1px solid #DBEAFE">
          <td style="font-size:13px;color:#64748B;font-weight:500;padding:7px 0">Vaqtinchalik parol</td>
          <td style="font-size:14px;font-weight:800;color:#1e40af;font-family:'Courier New',monospace;text-align:right">${tempPassword}</td>
        </tr>
      </table>
    </div>

    <p style="font-size:12px;color:#94A3B8;margin-top:16px;line-height:1.6">
      🔐 Birinchi kirishdan so'ng parolingizni albatta o'zgartiring.
    </p>
    <a class="btn" href="${PLATFORM_URL}" style="display:block;text-align:center">
      Tizimga kirish →
    </a>`;
  return {
    subject: 'IDU Platformaga xush kelibsiz!',
    html: layout(body, `Login: ${login} | Parol: ${tempPassword}`),
  };
}

// ── Template: Submission graded ───────────────────────────────────────────────
function submissionGradedTemplate(studentName, assignmentTitle, teacherScore, aiScore) {
  const body = `
    <p class="greeting">Salom, <strong>${studentName}</strong>!<br>
    O'qituvchingiz topshiriqni tekshirib, baho qo'ydi.</p>

    <div style="background:#F8FAFC;border-radius:14px;padding:24px;border:1.5px solid #E2E8F0;margin:8px 0">
      <div style="font-size:13px;color:#64748B;margin-bottom:16px;font-weight:600">${assignmentTitle}</div>
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div style="text-align:center;flex:1">
          <div style="font-size:36px;font-weight:900;color:#1e40af">${teacherScore}</div>
          <div style="font-size:11px;color:#64748B;margin-top:4px">O'qituvchi baho</div>
        </div>
        <div style="width:1px;background:#E2E8F0;height:48px"></div>
        <div style="text-align:center;flex:1">
          <div style="font-size:36px;font-weight:900;color:#0891b2">${aiScore}</div>
          <div style="font-size:11px;color:#64748B;margin-top:4px">AI baho</div>
        </div>
      </div>
    </div>

    <a class="btn" href="${PLATFORM_URL}" style="display:block;text-align:center">
      Batafsil ko'rish →
    </a>`;
  return {
    subject: `IDU — "${assignmentTitle}" topshirig'ingiz baholandi`,
    html: layout(body, `O'qituvchi baho: ${teacherScore}/100`),
  };
}

module.exports = {
  sendMail,
  passwordResetTemplate,
  examResultTemplate,
  welcomeTemplate,
  submissionGradedTemplate,
};
