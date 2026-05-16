'use strict';

const { Pool } = require('pg');

const POOL_COMMON = {
  max:                    parseInt(process.env.DB_POOL_MAX    || '20', 10),
  min:                    parseInt(process.env.DB_POOL_MIN    || '2',  10),
  idleTimeoutMillis:      30_000,
  connectionTimeoutMillis: 3_000,
  statement_timeout:      15_000, // kill queries running > 15 s
};

const poolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      ...POOL_COMMON,
    }
  : {
      host:     process.env.DB_HOST     || 'localhost',
      port:     parseInt(process.env.DB_PORT || '5432', 10),
      database: process.env.DB_NAME     || 'idu_platform',
      user:     process.env.DB_USER     || 'idu_user',
      password: process.env.DB_PASSWORD || '',
      ssl:      false,
      ...POOL_COMMON,
    };

const pool = new Pool(poolConfig);
pool.on('connect', () => { if (process.env.NODE_ENV !== 'test') console.log('[DB] connected'); });
pool.on('error', (err) => { console.error('[DB] error:', err.message); process.exit(1); });
async function query(text, params) { return pool.query(text, params); }
async function getClient() { return pool.connect(); }
module.exports = { query, getClient, pool };
