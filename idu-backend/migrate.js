'use strict';

const fs   = require('fs');
const path = require('path');
const { pool } = require('./config/database');

async function runMigrations() {
  const sqlFile = path.resolve(__dirname, 'schema.sql');
  if (!fs.existsSync(sqlFile)) {
    console.warn('schema.sql not found, skipping migrations.');
    return;
  }
  const sql = fs.readFileSync(sqlFile, 'utf8');
  const client = await pool.connect();
  try {
    console.log('Running database migrations...');
    await client.query(sql);
    console.log('Migrations completed successfully.');
  } catch (err) {
    // Tables may already exist - log but do not crash
    console.error('Migration warning:', err.message);
  } finally {
    client.release();
  }
}

module.exports = runMigrations;
