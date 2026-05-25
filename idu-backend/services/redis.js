'use strict';
/**
 * IDU Redis Service
 * Wraps ioredis with a transparent in-memory fallback.
 * If REDIS_URL is not set, all operations work in-process (single-instance).
 * API is identical regardless of backend — no caller changes needed.
 */

const { logger } = require('../middleware/logger');

// ── In-memory fallback ─────────────────────────────────────────────────────────
const _mem    = new Map(); // key → value (string)
const _expiry = new Map(); // key → expiry ms timestamp

function _memClean(key) {
  const exp = _expiry.get(key);
  if (exp && Date.now() > exp) { _mem.delete(key); _expiry.delete(key); return true; }
  return false;
}

const inMem = {
  get(key) {
    if (_memClean(key)) return null;
    return _mem.get(key) ?? null;
  },
  set(key, value, ex, ttl) {
    // support set(key, val, 'EX', ttl) Redis syntax
    const seconds = ex === 'EX' ? ttl : (typeof ex === 'number' ? ex : null);
    _mem.set(key, String(value));
    if (seconds) _expiry.set(key, Date.now() + seconds * 1000);
    else         _expiry.delete(key);
    return 'OK';
  },
  del(...keys) { keys.forEach(k => { _mem.delete(k); _expiry.delete(k); }); return keys.length; },
  incr(key) {
    if (_memClean(key)) _mem.set(key, '0');
    const val = (parseInt(_mem.get(key) || '0', 10) + 1);
    _mem.set(key, String(val));
    return val;
  },
  expire(key, seconds) {
    if (_mem.has(key)) { _expiry.set(key, Date.now() + seconds * 1000); return 1; }
    return 0;
  },
  publish() { return 0; },
  subscribe() {},
  on() { return this; },
  disconnect() {},
  duplicate() { return this; },
};

// ── Redis client (lazy-init) ───────────────────────────────────────────────────
let _client = null;
let _ready  = false;

async function getClient() {
  if (_client) return _client;
  if (!process.env.REDIS_URL) { _client = inMem; return _client; }

  try {
    const Redis = require('ioredis');
    const r = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest:   2,
      enableReadyCheck:       true,
      lazyConnect:            true,
      connectTimeout:         5000,
    });

    r.on('ready',  ()  => { _ready = true;  logger.info('[redis] connected'); });
    r.on('close',  ()  => { _ready = false; });
    r.on('error',  (e) => { if (!_ready) logger.warn('[redis] %s', e.message); });

    await r.connect();
    _client = r;
    return _client;
  } catch (err) {
    logger.warn('[redis] cannot connect (%s) — using in-memory store', err.message);
    _client = inMem;
    return _client;
  }
}

// ── Public API ─────────────────────────────────────────────────────────────────
async function get(key)                       { return (await getClient()).get(key); }
async function set(key, val, ex, ttl)         { return (await getClient()).set(key, String(val), ex, ttl); }
async function setex(key, seconds, val)       { return (await getClient()).set(key, String(val), 'EX', seconds); }
async function del(...keys)                   { return (await getClient()).del(...keys); }
async function incr(key)                      { return (await getClient()).incr(key); }
async function expire(key, seconds)           { return (await getClient()).expire(key, seconds); }

// ── Pub/Sub helpers for horizontal chat ───────────────────────────────────────
let _pub = null;
let _sub = null;

async function getPub() {
  const c = await getClient();
  if (c === inMem) return null; // in-memory: pub/sub not needed
  if (!_pub) _pub = c.duplicate();
  return _pub;
}
async function getSub() {
  const c = await getClient();
  if (c === inMem) return null;
  if (!_sub) _sub = c.duplicate();
  return _sub;
}

module.exports = { getClient, get, set, setex, del, incr, expire, getPub, getSub };
