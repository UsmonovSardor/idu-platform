'use strict';
/* In-memory per-user API response cache with TTL.
   Keyed by  userId:fullPath  so users never see each other's data.
   Auto-evicts expired entries when the store exceeds 2 000 entries. */

const store = new Map(); // key → { data, expiresAt }

const MAX_STORE_SIZE = 2000;
const CLEANUP_EVERY  = 200; // entries added between cleanups
let addedSinceClean  = 0;

function evictExpired() {
  const now = Date.now();
  for (const [k, v] of store) {
    if (v.expiresAt < now) store.delete(k);
  }
}

function set(key, data, ttlMs) {
  store.set(key, { data, expiresAt: Date.now() + ttlMs });
  addedSinceClean++;
  if (store.size > MAX_STORE_SIZE || addedSinceClean > CLEANUP_EVERY) {
    evictExpired();
    addedSinceClean = 0;
  }
}

function get(key) {
  const entry = store.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) { store.delete(key); return null; }
  return entry.data;
}

/* Middleware factory — use as:  router.get('/', authenticate, cache(30), handler)
   ttlSeconds: how long to cache this route's response (default 30 s) */
function cache(ttlSeconds = 30) {
  return function cacheMiddleware(req, res, next) {
    if (req.method !== 'GET') return next();

    const userId = req.user?.id ?? 'anon';
    const key    = userId + ':' + req.originalUrl;
    const cached = get(key);

    if (cached) {
      res.setHeader('X-Cache', 'HIT');
      return res.json(cached);
    }

    // Wrap res.json to capture the outgoing payload
    const originalJson = res.json.bind(res);
    res.json = function (payload) {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        set(key, payload, ttlSeconds * 1000);
      }
      res.setHeader('X-Cache', 'MISS');
      return originalJson(payload);
    };

    next();
  };
}

/* Call after a write operation to drop cached reads for the same user.
   Optionally pass a path prefix to be more targeted. */
function invalidate(userId, pathPrefix) {
  const prefix = (userId ?? '') + ':' + (pathPrefix ?? '');
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}

module.exports = { cache, invalidate };
