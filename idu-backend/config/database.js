'use strict';

const { Pool } = require('pg');

const poolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    }
  : {
      host:     process.env.DB_HOST     || 'localhost',
      port:     parseInt(process.env.DB_PORT || '5432', 10),
      database: process.env.DB_NAME     || 'idu_platform',
      user:     process.env.DB_USER     || 'idu_user',
      password: process.env.DB_PASSWORD || '',
      max: 20, idleTimeoutMillis: 30000, connectionTimeoutMillis: 2000, ssl: false,
    };

const pool = new Pool(poolConfig);
pool.on('connect', () => { if (process.env.NODE_ENV !== 'test') console.log('[DB] connected'); });
pool.on('error', (err) => { console.error('[DB] error:', err.message); process.exit(1); });
async function query(text, params) { return pool.query(text, params); }
async function getClient() { return pool.connect(); }
module.exports = { query, getClient, pool };
