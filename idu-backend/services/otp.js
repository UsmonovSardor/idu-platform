'use strict';
/**
 * IDU OTP Service
 * - 6-digit cryptographically random codes
 * - Stored in Redis (or in-memory fallback) with TTL
 * - Max 3 verification attempts before code invalidated
 * - Separate purpose namespaces: 'reset' | 'verify' | '2fa'
 */

const crypto = require('crypto');
const redis  = require('./redis');

const OTP_TTL_SECONDS  = 10 * 60; // 10 minutes
const MAX_ATTEMPTS     = 3;
const RESET_TOKEN_TTL  = 15 * 60; // 15 minutes (after OTP verified)

// ── Generate & store OTP ──────────────────────────────────────────────────────
async function createOtp(userId, purpose = 'reset') {
  const code = String(crypto.randomInt(100000, 999999)); // 6-digit, not guessable
  await redis.setex(`otp:${purpose}:${userId}`, OTP_TTL_SECONDS, code);
  await redis.del(`otp:att:${purpose}:${userId}`); // reset attempt counter
  return code;
}

// ── Verify OTP ────────────────────────────────────────────────────────────────
async function verifyOtp(userId, inputCode, purpose = 'reset') {
  const stored   = await redis.get(`otp:${purpose}:${userId}`);
  const attKey   = `otp:att:${purpose}:${userId}`;
  const attempts = parseInt(await redis.get(attKey) || '0', 10);

  if (!stored)               return { ok: false, reason: 'expired' };
  if (attempts >= MAX_ATTEMPTS) {
    await redis.del(`otp:${purpose}:${userId}`);
    return { ok: false, reason: 'too_many_attempts' };
  }

  if (stored !== String(inputCode).trim()) {
    const newAttempts = await redis.incr(attKey);
    await redis.expire(attKey, OTP_TTL_SECONDS);
    return { ok: false, reason: 'wrong_code', attemptsLeft: MAX_ATTEMPTS - newAttempts };
  }

  // ✅ Valid — consume immediately (single-use)
  await redis.del(`otp:${purpose}:${userId}`);
  await redis.del(attKey);
  return { ok: true };
}

// ── After OTP verified: create short-lived reset token ───────────────────────
// This lets the client complete the password-reset in a separate request
// without re-sending credentials.
async function createResetToken(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  await redis.setex(`rst:${token}`, RESET_TOKEN_TTL, String(userId));
  return token;
}

async function consumeResetToken(token) {
  const raw = await redis.get(`rst:${token}`);
  if (!raw) return null;
  await redis.del(`rst:${token}`);
  return parseInt(raw, 10);
}

module.exports = { createOtp, verifyOtp, createResetToken, consumeResetToken };
