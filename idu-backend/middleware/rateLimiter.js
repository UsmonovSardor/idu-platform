'use strict';
/**
 * Rate limiters — Redis-backed with in-memory fallback
 *
 * When REDIS_URL is set: RateLimiterRedis (shared across all instances).
 * Otherwise: RateLimiterMemory (per-process, fine for single-instance deploys).
 *
 * Three tiers:
 *  • generalLimiter — 100 req / 15 min per real IP
 *  • authLimiter    —  10 req / 15 min per real IP (login brute-force guard)
 *  • uploadLimiter  —   5 req / 60 s  per user ID  (upload spam guard)
 */

const { RateLimiterMemory, RateLimiterRedis } = require('rate-limiter-flexible');
const jwt = require('jsonwebtoken');
const { realIp } = require('./security');

/**
 * Per-user rate-limit key.
 *
 * Critical for a university platform: hundreds of students on campus Wi-Fi
 * share ONE public (NAT) IP. Keying by IP would make them all share a single
 * budget and trip 429 instantly during launch. So we key by authenticated
 * user id (from the JWT) whenever possible, giving each user their own bucket.
 * Falls back to IP only for unauthenticated traffic (login page, public API).
 */
function rlKey(req) {
  let token = null;
  if (req.cookies && req.cookies.idu_token) token = req.cookies.idu_token;
  if (!token) {
    const h = req.headers['authorization'] || '';
    if (h.startsWith('Bearer ')) token = h.slice(7);
  }
  if (token) {
    try {
      const p = jwt.verify(token, process.env.JWT_SECRET);
      if (p && p.sub) return `uid:${p.sub}`;
    } catch (e) { /* invalid/expired -> fall through to IP */ }
  }
  return `ip:${realIp(req)}`;
}

// Limiter configs
const CONFIGS = {
  general: {
    keyPrefix:  'rl:g',
    // Per-user budget (see rlKey). Generous so the SPA's many calls per
    // navigation never trip it for a normal user.
    points:     parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '1000', 10),
    duration:   Math.floor(parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10) / 1000),
  },
  auth: {
    keyPrefix: 'rl:a',
    points:    parseInt(process.env.AUTH_RATE_LIMIT_MAX || '10', 10),
    duration:  900,
  },
  upload: {
    keyPrefix: 'rl:u',
    points:    5,
    duration:  60,
  },
};

// Start with in-memory limiters (always work)
let _general = new RateLimiterMemory(CONFIGS.general);
let _auth    = new RateLimiterMemory(CONFIGS.auth);
let _upload  = new RateLimiterMemory(CONFIGS.upload);

// Upgrade to Redis limiters once connection is available
if (process.env.REDIS_URL) {
  // Lazy upgrade: try after a short delay to let Redis connect first
  setTimeout(async () => {
    try {
      const redis = require('../services/redis');
      const client = await redis.getClient();
      // Real ioredis has a .status property; in-memory fallback does not
      if (client && typeof client.status === 'string') {
        _general = new RateLimiterRedis({
          storeClient:      client,
          insuranceLimiter: new RateLimiterMemory(CONFIGS.general),
          ...CONFIGS.general,
        });
        _auth = new RateLimiterRedis({
          storeClient:      client,
          insuranceLimiter: new RateLimiterMemory(CONFIGS.auth),
          ...CONFIGS.auth,
        });
        _upload = new RateLimiterRedis({
          storeClient:      client,
          insuranceLimiter: new RateLimiterMemory(CONFIGS.upload),
          ...CONFIGS.upload,
        });
        const { logger } = require('./logger');
        logger.info('[rateLimiter] upgraded to Redis-backed limiters');
      }
    } catch (e) {
      // Fallback already in place — no action needed
    }
  }, 3000);
}

// ── Middleware factory ─────────────────────────────────────────────────────────
function makeMiddleware(getLimiter, keyFn) {
  return async (req, res, next) => {
    try {
      await getLimiter().consume(keyFn(req));
      next();
    } catch (rlRes) {
      const retryAfter = Math.ceil((rlRes.msBeforeNext || 60000) / 1000);
      res.set('Retry-After', String(retryAfter));
      res.status(429).json({ error: 'Too many requests. Please slow down.', retryAfter });
    }
  };
}

module.exports = {
  generalLimiter: makeMiddleware(() => _general, rlKey),
  authLimiter:    makeMiddleware(() => _auth,    req => `ip:${realIp(req)}`),
  uploadLimiter:  makeMiddleware(() => _upload,  req =>
    req.user ? `uid:${req.user.id}` : `ip:${realIp(req)}`
  ),
};
