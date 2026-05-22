'use strict';
/**
 * Rate limiters — Phase D: IP spoofing hardened
 *
 * Previously used req.ip which can be spoofed via X-Forwarded-For
 * on misconfigured servers. Now uses realIp() which only trusts the
 * forwarded header when the direct connection comes from a trusted proxy.
 *
 * Three limiters:
 *  • generalLimiter — 100 req / 15 min per real IP (all /api/* routes)
 *  • authLimiter    —  10 req / 15 min per real IP (login endpoint only)
 *  • uploadLimiter  —   5 req / 60 s  per user id  (file uploads)
 */

const { RateLimiterMemory } = require('rate-limiter-flexible');
const { realIp }            = require('./security');

// ── General API limiter ───────────────────────────────────────────────────────
const _general = new RateLimiterMemory({
  points:   parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  duration: Math.floor(parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10) / 1000),
});

// ── Auth limiter — brute-force guard ─────────────────────────────────────────
const _auth = new RateLimiterMemory({
  points:   parseInt(process.env.AUTH_RATE_LIMIT_MAX || '10', 10),
  duration: 900, // 15 minutes
});

// ── Upload limiter — prevents upload spam / storage abuse ────────────────────
const _upload = new RateLimiterMemory({
  points:   5,
  duration: 60,
});

function makeMiddleware(limiter, keyFn) {
  return async (req, res, next) => {
    // keyFn receives the request and returns the rate-limit key string
    const key = keyFn(req);
    try {
      await limiter.consume(key);
      next();
    } catch (rlRes) {
      const retryAfter = Math.ceil((rlRes.msBeforeNext || 60000) / 1000);
      res.set('Retry-After', String(retryAfter));
      res.status(429).json({
        error:      'Too many requests. Please slow down.',
        retryAfter,
      });
    }
  };
}

module.exports = {
  // General limiter keyed by real IP (spoofing-resistant)
  generalLimiter: makeMiddleware(_general, req => `ip:${realIp(req)}`),

  // Auth limiter keyed by real IP
  authLimiter:    makeMiddleware(_auth,    req => `ip:${realIp(req)}`),

  // Upload limiter keyed by user ID (if authenticated) or IP
  uploadLimiter:  makeMiddleware(_upload,  req =>
    req.user ? `uid:${req.user.id}` : `ip:${realIp(req)}`
  ),
};
