'use strict';

/**
 * Incremental migration runner.
 *
 * Rules:
 *  - Migration files live in ./migrations/
 *  - Named: NNN_description.sql  (e.g. 001_initial.sql)
 *  - Run in alphabetical order, each exactly once
 *  - Applied migrations tracked in `schema_migrations` table
 *  - Idempotent: safe to call on every startup
 */

const fs   = require('fs');
const path = require('path');
const { pool } = require('./config/database');

const MIGRATIONS_DIR = path.resolve(__dirname, 'migrations');

async function runMigrations() {
  const client = await pool.connect();
  try {
    // Ensure tracking table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version     VARCHAR(255) PRIMARY KEY,
        applied_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      )
    `);

    // Migration files
    const files = fs.existsSync(MIGRATIONS_DIR)
      ? fs.readdirSync(MIGRATIONS_DIR)
          .filter((f) => f.endsWith('.sql'))
          .sort()
      : [];

    // Legacy: if no migration files yet, fall back to schema.sql
    if (!files.length) {
      const legacy = path.resolve(__dirname, 'schema.sql');
      if (fs.existsSync(legacy)) {
        const { rows } = await client.query('SELECT COUNT(*) FROM schema_migrations');
        if (Number(rows[0].count) === 0) {
          console.log('[migrate] Applying legacy schema.sql...');
          const sql = fs.readFileSync(legacy, 'utf8');
          await client.query(sql);
          await client.query(
            'INSERT INTO schema_migrations (version) VALUES ($1) ON CONFLICT DO NOTHING',
            ['000_legacy_schema']
          );
          console.log('[migrate] Legacy schema applied.');
        }
      }
      return;
    }

    // Get already-applied versions
    const { rows: applied } = await client.query('SELECT version FROM schema_migrations');
    const appliedSet = new Set(applied.map((r) => r.version));

    let count = 0;
    for (const file of files) {
      if (appliedSet.has(file)) continue;

      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      console.log(`[migrate] Applying ${file}...`);

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (version) VALUES ($1)',
          [file]
        );
        await client.query('COMMIT');
        count++;
        console.log(`[migrate] ✓ ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`[migrate] ✗ ${file}: ${err.message}`);
        throw err;
      }
    }

    if (count === 0) {
      console.log('[migrate] All migrations up to date.');
    } else {
      console.log(`[migrate] ${count} migration(s) applied.`);
    }
  } finally {
    client.release();
  }
}

module.exports = runMigrations;
