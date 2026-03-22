'use strict';

const { RateLimiterMemory } = require('rate-limiter-flexible');

// General API limiter — 100 requests per 15 minutes per IP
const generalLimiter = new RateLimiterMemory({
  points:   parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  duration: parseInt(process.env.RATE_LIMIT_WINDOW_MS    || '900000', 10) / 1000,
});

// Auth limiter — 10 login attempts per 15 minutes per IP (brute-force protection)
const authLimiter = new RateLimiterMemory({
  points:   parseInt(process.env.AUTH_RATEⒺ_LIMIT_MAX || '10', 10),
  duration: 900, // 15 minutes
});

function makeMiddleware(limiter) {
  return async (req, res, next) => {
    try {
      await limiter.consume(req.ip);
      next();
    } catch (rlRes) {
      const retryAfter = Math.ceil(rlRes.msBeforeNext / 1000) || 60;
      res.set('Retry-After', String(retryAfter));
      res.status(429).json({
        error:       'Too many requests. Please slow down.',
        retryAfter,
      });
    }
  };
}

module.exports = {
  generalLimiter: makeMiddleware(generalLimiter),
  authLimiter:    makeMiddleware(authLimiter),
};
