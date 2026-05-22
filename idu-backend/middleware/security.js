'use strict';
/**
 * IDU Platform — Consolidated Security Middleware  (Phase D)
 *
 * Provides:
 *  1. realIp()         — trusted IP extraction (guards rate-limiter spoofing)
 *  2. sanitizeBody()   — strips __proto__ / constructor prototype pollution keys
 *  3. validateMime()   — magic-byte MIME check for file uploads (wraps multer)
 *  4. ALLOWED_MIME     — exported whitelist for use in route files
 *  5. promptSanitize() — strips prompt-injection markers from user text
 *  6. noSniff()        — X-Content-Type-Options for static upload routes
 */

// ── 1. Trusted IP extraction ──────────────────────────────────────────────────
// Railway (and most PaaS) sets X-Forwarded-For from their own edge.
// We trust only the FIRST IP in the chain from our own edge (rightmost = nearest).
// If no proxy is trusted (dev), fall back to socket remote address.
const TRUSTED_PROXY_CIDRS = (process.env.TRUSTED_PROXIES || '').split(',').map(s => s.trim()).filter(Boolean);

function ipToLong(ip) {
  if (!ip || ip.includes(':')) return null; // ignore IPv6 for simple CIDR check
  const p = ip.split('.').map(Number);
  return ((p[0] << 24) | (p[1] << 16) | (p[2] << 8) | p[3]) >>> 0;
}

function inCidr(ip, cidr) {
  const [base, bits] = cidr.split('/');
  const mask = bits ? (~0 << (32 - Number(bits))) >>> 0 : 0xFFFFFFFF;
  const ipL  = ipToLong(ip);
  const baseL = ipToLong(base);
  return ipL !== null && (ipL & mask) === (baseL & mask);
}

function isTrustedProxy(ip) {
  if (!TRUSTED_PROXY_CIDRS.length) return false;
  return TRUSTED_PROXY_CIDRS.some(cidr => inCidr(ip, cidr));
}

/**
 * realIp(req) — returns the client IP that should be used for rate-limiting.
 * Prevents X-Forwarded-For spoofing: only trusts the header when the
 * direct connection comes from a known proxy CIDR.
 */
function realIp(req) {
  const direct = req.socket?.remoteAddress || req.connection?.remoteAddress || '';
  if (isTrustedProxy(direct)) {
    const fwd = req.headers['x-forwarded-for'];
    if (fwd) {
      // X-Forwarded-For: client, proxy1, proxy2
      // The leftmost client IP is the real one
      const first = fwd.split(',')[0].trim();
      if (first) return first;
    }
  }
  return direct;
}

// ── 2. Prototype-pollution sanitizer ─────────────────────────────────────────
const PROTO_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function _stripProto(obj, depth = 0) {
  if (!obj || typeof obj !== 'object' || depth > 8) return obj;
  if (Array.isArray(obj)) return obj.map(v => _stripProto(v, depth + 1));
  const clean = {};
  for (const k of Object.keys(obj)) {
    if (PROTO_KEYS.has(k)) continue; // drop poisoned key
    clean[k] = _stripProto(obj[k], depth + 1);
  }
  return clean;
}

/** Express middleware — scrubs req.body, req.query, req.params in-place */
function sanitizeBody() {
  return (req, _res, next) => {
    if (req.body   && typeof req.body   === 'object') req.body   = _stripProto(req.body);
    if (req.query  && typeof req.query  === 'object') req.query  = _stripProto(req.query);
    if (req.params && typeof req.params === 'object') req.params = _stripProto(req.params);
    next();
  };
}

// ── 3. Magic-byte MIME validation ─────────────────────────────────────────────
// Read the first 12 bytes and verify they match expected image signatures.
// An attacker can rename exploit.php → exploit.jpg; extension alone is not enough.
const ALLOWED_MIME = {
  'image/jpeg': [[0xFF, 0xD8, 0xFF]],
  'image/png':  [[0x89, 0x50, 0x4E, 0x47]],
  'image/webp': [[0x52, 0x49, 0x46, 0x46]], // RIFF
  'image/gif':  [[0x47, 0x49, 0x46, 0x38]],
};

function matchesMagic(buf, signatures) {
  return signatures.some(sig => sig.every((byte, i) => buf[i] === byte));
}

/**
 * validateMime(allowedTypes?)
 * Express middleware — call AFTER multer to inspect uploaded buffer/file.
 * allowedTypes defaults to image types.
 */
function validateMime(allowedTypes = Object.keys(ALLOWED_MIME)) {
  return (req, res, next) => {
    if (!req.file) return next();

    const fs   = require('fs');
    const path = req.file.path;

    try {
      // Read only first 12 bytes — enough for all magic numbers we care about
      const fd  = fs.openSync(path, 'r');
      const buf = Buffer.alloc(12);
      fs.readSync(fd, buf, 0, 12, 0);
      fs.closeSync(fd);

      const matched = allowedTypes.some(mime => {
        const sigs = ALLOWED_MIME[mime];
        return sigs && matchesMagic(buf, sigs);
      });

      if (!matched) {
        // Delete the already-saved file before rejecting
        try { fs.unlinkSync(path); } catch (_) {}
        return res.status(415).json({ error: 'Unsupported file type. Only JPEG, PNG, WebP allowed.' });
      }
      next();
    } catch (e) {
      try { fs.unlinkSync(path); } catch (_) {}
      return res.status(500).json({ error: 'File validation failed' });
    }
  };
}

// ── 4. Prompt-injection sanitizer ────────────────────────────────────────────
// Strips common jailbreak / injection markers before text enters an AI prompt.
const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions?/gi,
  /system\s*:/gi,
  /assistant\s*:/gi,
  /\[\s*INST\s*\]/gi,
  /<<SYS>>/gi,
  /<\|im_start\|>/gi,
  /<\|im_end\|>/gi,
  /###\s*(instruction|system|prompt)/gi,
  /\bpretend\s+(you are|to be)\b/gi,
  /\bforget\s+(all|your)\b/gi,
  /\byou\s+are\s+now\b/gi,
  /\bDAN\b/g,            // "Do Anything Now" jailbreak
  /\bjailbreak\b/gi,
];

/**
 * promptSanitize(text, maxLen = 3000) — returns cleaned string safe for prompt.
 */
function promptSanitize(text, maxLen = 3000) {
  if (typeof text !== 'string') return '';
  let s = text.slice(0, maxLen);
  for (const pat of INJECTION_PATTERNS) s = s.replace(pat, '[redacted]');
  return s;
}

// ── 5. noSniff middleware for uploads ────────────────────────────────────────
function noSniff() {
  return (_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', 'inline');
    next();
  };
}

module.exports = { realIp, sanitizeBody, validateMime, ALLOWED_MIME, promptSanitize, noSniff };
