'use strict';

/**
 * Startup environment validation.
 * Throws immediately if critical env vars are missing — fail fast.
 */

const REQUIRED = ['JWT_SECRET', 'DATABASE_URL'];

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
  const missing = REQUIRED.filter((key) => !process.env[key]);

  if (missing.length) {
    console.error('═══════════════════════════════════════════════════');
    console.error('  STARTUP ERROR: Missing required environment vars');
    missing.forEach((key) => console.error('  ✗ ' + key));
    console.error('═══════════════════════════════════════════════════');
    process.exit(1);
  }

  // Apply defaults for optional vars
  Object.entries(OPTIONAL_WITH_DEFAULTS).forEach(([key, defaultVal]) => {
    if (!process.env[key]) {
      process.env[key] = defaultVal;
    }
  });

  if (process.env.NODE_ENV === 'production' && process.env.JWT_SECRET.length < 32) {
    console.error('SECURITY: JWT_SECRET must be at least 32 characters in production');
    process.exit(1);
  }
}

module.exports = { validateEnv };
