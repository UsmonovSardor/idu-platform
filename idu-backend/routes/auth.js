'use strict';

const express = require('express');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const { body } = require('express-validator');

const db               = require('../config/database');
const validate         = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { authLimiter }  = require('../middleware/rateLimiter');
const { logger }       = require('../middleware/logger');
const { sendMail, passwordResetTemplate } = require('../services/email');
const { createOtp, verifyOtp, createResetToken, consumeResetToken } = require('../services/otp');

const router = express.Router();

const JWT_SECRET     = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';
const IS_PROD        = process.env.NODE_ENV === 'production';

// Cookie max-age in ms (must match JWT expiry)
const COOKIE_MAX_AGE = 8 * 60 * 60 * 1000; // 8h

function createToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function setCookieToken(res, token) {
  res.cookie('idu_token', token, {
    httpOnly: true,
    secure:   IS_PROD,                // HTTPS only in production
    sameSite: IS_PROD ? 'strict' : 'lax',
    maxAge:   COOKIE_MAX_AGE,
    path:     '/',
  });
}

// ── POST /api/v1/auth/login ──────────────────────────────────────────────────
router.post(
  '/login',
  authLimiter,
  [
    body('login').trim().isLength({ min: 3, max: 50 }).withMessage('Login required'),
    body('password').isLength({ min: 1, max: 128 }).withMessage('Password required'),
  ],
  validate,
  async (req, res) => {
    const login    = String(req.body.login    || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const ip       = req.ip || req.headers['x-forwarded-for'] || null;

    // ── 1. Check if account is locked ──
    try {
      const { rows: lockRows } = await db.query(
        'SELECT locked_until FROM account_lockouts WHERE login=$1 AND locked_until > NOW()',
        [login]
      );
      if (lockRows.length) {
        const until = new Date(lockRows[0].locked_until);
        const minLeft = Math.ceil((until - Date.now()) / 60000);
        return res.status(429).json({
          error: `Hisob bloklangan. ${minLeft} daqiqadan keyin urinib ko'ring.`,
          locked_until: until.toISOString()
        });
      }
    } catch (e) { /* table may not exist yet on cold start */ }

    const { rows } = await db.query(
      `SELECT id, full_name, login, password_hash, role, is_active
       FROM users WHERE LOWER(login) = $1 LIMIT 1`,
      [login]
    );

    const user = rows[0];

    // ── 2. Fail-handler: record failure, check threshold, optionally lock ──
    async function recordFailure(reason) {
      try {
        await db.query(
          'INSERT INTO failed_logins (login, ip_address) VALUES ($1, $2)',
          [login, ip]
        );
        // Count last 15 min
        const { rows: cnt } = await db.query(
          `SELECT COUNT(*)::int AS n FROM failed_logins
           WHERE login=$1 AND attempted_at > NOW() - INTERVAL '15 minutes'`,
          [login]
        );
        if (cnt[0] && cnt[0].n >= 5) {
          await db.query(
            `INSERT INTO account_lockouts (login, locked_until, reason)
             VALUES ($1, NOW() + INTERVAL '15 minutes', $2)
             ON CONFLICT (login) DO UPDATE
               SET locked_until = NOW() + INTERVAL '15 minutes',
                   reason = $2`,
            [login, reason]
          );
          return true; // locked
        }
      } catch(e) {}
      return false;
    }

    if (!user) {
      await recordFailure('user_not_found');
      return res.status(401).json({ error: "Login yoki parol noto'g'ri" });
    }
    if (!user.is_active)  return res.status(403).json({ error: 'Account deactivated' });

    // ── Password check — bcrypt ONLY (Phase D: plaintext fallback removed) ──
    // Accounts whose password_hash is still plaintext are blocked until
    // an admin resets their password. This removes the timing-attack surface
    // and ensures all credentials are hashed at rest.
    if (!user.password_hash || !user.password_hash.startsWith('$2')) {
      // Log the anomaly without revealing details to the caller
      logger.warn(`Login attempt on non-bcrypt account: ${login}`);
      await recordFailure('non_bcrypt_account');
      return res.status(401).json({ error: "Login yoki parol noto'g'ri" });
    }

    const isValid = await bcrypt.compare(password, user.password_hash);

    if (!isValid) {
      const locked = await recordFailure('wrong_password');
      if (locked) {
        return res.status(429).json({
          error: '5 marta noto\'g\'ri urinish. Hisob 15 daqiqaga bloklandi.'
        });
      }
      return res.status(401).json({ error: "Login yoki parol noto'g'ri" });
    }

    // ── 3. Success — clear lockout & failed attempts ──
    try {
      await db.query('DELETE FROM failed_logins WHERE login=$1', [login]);
      await db.query('DELETE FROM account_lockouts WHERE login=$1', [login]);
    } catch(e) {}

    await db.query('UPDATE users SET last_login = NOW(), updated_at = NOW() WHERE id = $1', [user.id]);

    const token = createToken(user);
    setCookieToken(res, token);

    return res.json({
      token,
      user: { id: user.id, name: user.full_name, login: user.login, role: user.role },
    });
  }
);

// ── POST /api/v1/auth/logout ─────────────────────────────────────────────────
router.post('/logout', (req, res) => {
  res.clearCookie('idu_token', { path: '/' });
  res.json({ message: 'Logged out' });
});

// ── POST /api/v1/auth/change-password ───────────────────────────────────────
router.post(
  '/change-password',
  authenticate,
  [
    body('currentPassword').isLength({ min: 1, max: 128 }).withMessage('Current password required'),
    body('newPassword')
      .isLength({ min: 8, max: 128 }).withMessage('At least 8 characters')
      .matches(/[A-Z]/).withMessage('Must contain uppercase')
      .matches(/[a-z]/).withMessage('Must contain lowercase')
      .matches(/[0-9]/).withMessage('Must contain number'),
  ],
  validate,
  async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    const { rows } = await db.query(
      'SELECT password_hash FROM users WHERE id = $1 LIMIT 1',
      [req.user.id]
    );

    if (!rows.length) return res.status(404).json({ error: 'User not found' });

    const { password_hash } = rows[0];
    if (!password_hash?.startsWith('$2')) return res.status(401).json({ error: 'Wrong password' });

    const isCorrect = await bcrypt.compare(currentPassword, password_hash);
    if (!isCorrect) return res.status(401).json({ error: 'Wrong password' });

    const isSame = await bcrypt.compare(newPassword, password_hash);
    if (isSame) return res.status(400).json({ error: 'New password must differ from current' });

    const hash = await bcrypt.hash(newPassword, 12);
    await db.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [hash, req.user.id]);

    res.json({ message: 'Password updated' });
  }
);

// ── GET /api/v1/auth/me ──────────────────────────────────────────────────────
router.get('/me', authenticate, async (req, res) => {
  const { rows } = await db.query(
    `SELECT u.id, u.full_name, u.login, u.role, u.phone, u.email, u.bio, u.nickname, u.avatar_url,
            u.created_at, u.last_login,
            s.student_id_number, s.faculty, s.department, s.year_of_study, s.gpa
     FROM users u
     LEFT JOIN students s ON s.user_id = u.id
     WHERE u.id = $1 LIMIT 1`,
    [req.user.id]
  );

  if (!rows.length) return res.status(404).json({ error: 'User not found' });
  res.json(rows[0]);
});

// ── GET /api/v1/auth/search?q=nick_or_id ─────────────────────────────────────
// Find users by @nickname or numeric ID. Returns minimal public profile.
router.get('/search', authenticate, async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (!q) return res.json([]);

  let rows;
  // If query is a number → search by ID
  if (/^\d+$/.test(q)) {
    ({ rows } = await db.query(
      `SELECT u.id, u.full_name, u.nickname, u.avatar_url, u.role,
              s.faculty, s.year_of_study
       FROM users u
       LEFT JOIN students s ON s.user_id = u.id
       WHERE u.id = $1 AND u.is_active = TRUE LIMIT 1`,
      [parseInt(q, 10)]
    ));
  } else {
    // Search by nickname (case-insensitive) or full_name prefix
    const like = q.replace(/[%_]/g, '\\$&') + '%';
    ({ rows } = await db.query(
      `SELECT u.id, u.full_name, u.nickname, u.avatar_url, u.role,
              s.faculty, s.year_of_study
       FROM users u
       LEFT JOIN students s ON s.user_id = u.id
       WHERE u.is_active = TRUE
         AND (LOWER(u.nickname) LIKE LOWER($1) OR LOWER(u.full_name) LIKE LOWER($1))
       ORDER BY
         CASE WHEN LOWER(u.nickname) = LOWER($2) THEN 0 ELSE 1 END,
         u.full_name
       LIMIT 10`,
      [like, q]
    ));
  }
  res.json(rows);
});

// ── PATCH /api/v1/auth/me — update profile ───────────────────────────────────
router.patch(
  '/me',
  authenticate,
  [
    body('full_name').optional().isString().trim().isLength({ min: 2, max: 100 }),
    body('phone').optional().isString().trim().isLength({ max: 20 }),
    body('email').optional().isEmail().normalizeEmail(),
    body('bio').optional().isString().isLength({ max: 500 }),
    body('avatar_url').optional().isString().isLength({ max: 600000 }), // base64 image up to ~450KB
    body('nickname').optional({ nullable: true }).isString().trim()
      .isLength({ min: 3, max: 30 }).withMessage('Nickname 3-30 belgi')
      .matches(/^[a-zA-Z0-9_]+$/).withMessage('Faqat harf, raqam va _ belgisi'),
  ],
  validate,
  async (req, res) => {
    // Nickname unique check (case-insensitive)
    if (req.body.nickname !== undefined && req.body.nickname !== null && req.body.nickname !== '') {
      const nick = String(req.body.nickname).trim();
      const { rows: taken } = await db.query(
        'SELECT id FROM users WHERE LOWER(nickname)=LOWER($1) AND id<>$2 LIMIT 1',
        [nick, req.user.id]
      );
      if (taken.length) return res.status(409).json({ error: 'Bu nickname band, boshqa tanlang' });
    }

    const allowed = ['full_name', 'phone', 'email', 'bio', 'nickname', 'avatar_url'];
    const updates = [];
    const values  = [];
    let idx = 1;
    for (const k of allowed) {
      if (req.body[k] !== undefined) {
        updates.push(`${k} = $${idx++}`);
        values.push(req.body[k]);
      }
    }
    if (!updates.length) return res.status(400).json({ error: 'Hech narsa o\'zgartirmadi' });

    values.push(req.user.id);
    const { rows } = await db.query(
      `UPDATE users SET ${updates.join(', ')}, updated_at = NOW()
       WHERE id = $${idx} RETURNING id, full_name, phone, email, bio, nickname, avatar_url`,
      values
    );
    res.json(rows[0]);
  }
);

// ── PATCH /api/v1/auth/password — change own password ────────────────────────
router.patch(
  '/password',
  authenticate,
  [
    body('currentPassword').isString().isLength({ min: 4, max: 100 }),
    body('newPassword').isString().isLength({ min: 6, max: 100 }),
  ],
  validate,
  async (req, res) => {
    const { rows } = await db.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    if (!rows.length) return res.status(404).json({ error: 'User topilmadi' });
    const bcrypt = require('bcryptjs');
    const ok = await bcrypt.compare(req.body.currentPassword, rows[0].password_hash);
    if (!ok) return res.status(400).json({ error: 'Joriy parol noto\'g\'ri' });
    const newHash = await bcrypt.hash(req.body.newPassword, 12);
    await db.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [newHash, req.user.id]);
    res.json({ ok: true });
  }
);

// ── POST /api/v1/auth/forgot/send ────────────────────────────────────────────
// Step 1 — Request OTP via email/login.  Rate-limited to 3/hour per login.
router.post(
  '/forgot/send',
  authLimiter,
  [body('login').trim().isLength({ min: 3, max: 50 }).withMessage('Login majburiy')],
  validate,
  async (req, res) => {
    const login = String(req.body.login).trim().toLowerCase();

    const { rows } = await db.query(
      "SELECT id, full_name, email FROM users WHERE LOWER(login)=$1 AND is_active=TRUE LIMIT 1",
      [login]
    );

    // Always respond OK — never reveal whether login exists
    if (!rows[0]) return res.json({ message: 'Agar bu login mavjud bo\'lsa, email yuborildi.' });

    const user = rows[0];
    if (!user.email) return res.json({ message: 'Ushbu akkount uchun email ro\'yxatga olinmagan.' });

    const otp = await createOtp(user.id, 'reset');
    const tpl = passwordResetTemplate(user.full_name || login, otp);

    // Fire-and-forget — don't block response on email delivery
    sendMail({ to: user.email, ...tpl }).catch(e =>
      logger.warn('[auth/forgot] email error: %s', e.message)
    );

    res.json({ message: "Email yuborildi. Iltimos pochtangizni tekshiring.", userId: user.id });
  }
);

// ── POST /api/v1/auth/forgot/verify ──────────────────────────────────────────
// Step 2 — Verify the 6-digit OTP. Returns a short-lived reset token.
router.post(
  '/forgot/verify',
  authLimiter,
  [
    body('userId').isInt({ min: 1 }).toInt().withMessage('userId majburiy'),
    body('otp').trim().isLength({ min: 6, max: 6 }).isNumeric().withMessage('6 xonali kod kiriting'),
  ],
  validate,
  async (req, res) => {
    const { userId, otp } = req.body;
    const result = await verifyOtp(userId, otp, 'reset');

    if (!result.ok) {
      const msg = result.reason === 'expired'          ? 'Kod muddati o\'tgan. Qayta so\'rang.'
                : result.reason === 'too_many_attempts' ? 'Ko\'p urinish. Qayta so\'rang.'
                : `Noto'g'ri kod. ${result.attemptsLeft ?? 0} ta urinish qoldi.`;
      return res.status(400).json({ error: msg });
    }

    const resetToken = await createResetToken(userId);
    res.json({ resetToken, message: 'Kod tasdiqlandi. Yangi parol o\'rnating.' });
  }
);

// ── POST /api/v1/auth/forgot/reset ───────────────────────────────────────────
// Step 3 — Set new password using the reset token from step 2.
router.post(
  '/forgot/reset',
  [
    body('resetToken').trim().isLength({ min: 64, max: 64 }).withMessage('resetToken noto\'g\'ri'),
    body('newPassword')
      .isLength({ min: 8, max: 128 }).withMessage('Kamida 8 belgi')
      .matches(/[A-Z]/).withMessage('Katta harf bo\'lishi kerak')
      .matches(/[a-z]/).withMessage('Kichik harf bo\'lishi kerak')
      .matches(/[0-9]/).withMessage('Raqam bo\'lishi kerak'),
  ],
  validate,
  async (req, res) => {
    const { resetToken, newPassword } = req.body;
    const userId = await consumeResetToken(resetToken);
    if (!userId) return res.status(400).json({ error: 'Token yaroqsiz yoki muddati o\'tgan.' });

    const hash = await bcrypt.hash(newPassword, 12);
    await db.query(
      'UPDATE users SET password_hash=$1, updated_at=NOW() WHERE id=$2',
      [hash, userId]
    );
    // Clear any lockouts since user proved identity via OTP
    await db.query('DELETE FROM account_lockouts WHERE login=(SELECT login FROM users WHERE id=$1)', [userId]).catch(()=>{});

    logger.info('[auth/forgot] password reset for userId=%d', userId);
    res.json({ message: 'Parol muvaffaqiyatli o\'zgartirildi.' });
  }
);

// ── POST /api/v1/auth/send-otp ───────────────────────────────────────────────
// Generic OTP send endpoint (for future 2FA use).
router.post(
  '/send-otp',
  authenticate,
  authLimiter,
  async (req, res) => {
    const { rows } = await db.query('SELECT full_name, email FROM users WHERE id=$1', [req.user.id]);
    if (!rows[0]?.email) return res.status(400).json({ error: 'Email topilmadi' });

    const otp = await createOtp(req.user.id, 'verify');
    const tpl = passwordResetTemplate(rows[0].full_name || req.user.login, otp);
    sendMail({ to: rows[0].email, ...tpl }).catch(e => logger.warn('[auth/send-otp] %s', e.message));

    res.json({ message: 'OTP emailga yuborildi.' });
  }
);

// ── POST /api/v1/auth/verify-otp ────────────────────────────────────────────
// Verify OTP sent via /send-otp.
router.post(
  '/verify-otp',
  authenticate,
  [body('otp').trim().isLength({ min: 6, max: 6 }).isNumeric()],
  validate,
  async (req, res) => {
    const result = await verifyOtp(req.user.id, req.body.otp, 'verify');
    if (!result.ok) {
      const msg = result.reason === 'expired' ? 'Kod muddati o\'tgan.' : `Noto'g'ri kod.`;
      return res.status(400).json({ error: msg });
    }
    res.json({ verified: true });
  }
);

module.exports = router;
