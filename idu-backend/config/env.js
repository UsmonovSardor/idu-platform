'use strict';

/**
 * Startup environment validation.
 * DATABASE_URL is required UNLESS individual DB_* vars are present (Railway may use either).
 * JWT_SECRET is always required.
 */

const OPTIONAL_WITH_DEFAULTS = {
  NODE_ENV:               'development',
  PORT:                   '3000',
  JWT_EXPIRES_IN:         '8h',
  RATE_LIMIT_MAX_REQUESTS:'100',
  RATE_LIMIT_WINDOW_MS:   '900000',
  AUTH_RATE_LIMIT_MAX:    '10',
  UPLOAD_DIR:             './uploads',
  MAX_FILE_SIZE_MB:       '5',
};

function validateEnv() {
  const missing = [];

  // JWT_SECRET is always required
  if (!process.env.JWT_SECRET) missing.push('JWT_SECRET');

  // DATABASE_URL OR individual DB vars must be present
  const hasDbUrl  = !!process.env.DATABASE_URL;
  const hasDbVars = !!process.env.DB_HOST || !!process.env.PGHOST;
  if (!hasDbUrl && !hasDbVars) missing.push('DATABASE_URL (or DB_HOST)');

  if (missing.length) {
    console.error('═══════════════════════════════════════════════════');
    console.error('  STARTUP ERROR: Missing required environment vars');
    missing.forEach((key) => console.error('  ✗ ' + key));
    console.error('  Set these in Railway → Variables tab');
    console.error('═══════════════════════════════════════════════════');
    process.exit(1);
  }

  // Apply defaults for optional vars
  Object.entries(OPTIONAL_WITH_DEFAULTS).forEach(([key, val]) => {
    if (!process.env[key]) process.env[key] = val;
  });

  if (process.env.JWT_SECRET.length < 16) {
    console.warn('[SECURITY] JWT_SECRET is very short — use at least 32 random characters in production');
  }
}

module.exports = { validateEnv };
