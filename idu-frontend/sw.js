/* IDU Platform — Service Worker v11
 * Strategies:
 *   • App shell (index.html) : network-first, offline fallback
 *   • Versioned CSS/JS (?v=…): cache-first (URL IS the cache buster — immutable)
 *   • Unversioned CSS/JS     : stale-while-revalidate
 *   • Images / fonts         : cache-first (rarely change)
 *   • API safe reads         : stale-while-revalidate, 3-5 min TTL
 *   • API writes             : network-only (never cache mutations)
 */
'use strict';

const VERSION      = 'v11';
const STATIC_CACHE = 'idu-static-' + VERSION;
const IMG_CACHE    = 'idu-img-'    + VERSION;
const SHELL_CACHE  = 'idu-shell-'  + VERSION;
const API_CACHE    = 'idu-api-'    + VERSION;

// Core shell — always available offline after first visit
const SHELL_FILES = [
  '/',
  '/index.html',
  '/manifest.json',
];

// ── Install: pre-cache shell ─────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_FILES).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: drop all caches from old versions ──────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => ![STATIC_CACHE, IMG_CACHE, SHELL_CACHE, API_CACHE].includes(k))
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Helpers ──────────────────────────────────────────────────────────────────

// cache-first: serve from cache immediately, fetch on miss and store
function cacheFirst(req, cacheName) {
  return caches.open(cacheName).then((cache) =>
    cache.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((resp) => {
        if (resp && resp.ok) cache.put(req, resp.clone());
        return resp;
      });
    })
  );
}

// stale-while-revalidate: serve cache immediately AND refresh in background
function staleWhileRevalidate(req, cacheName) {
  return caches.open(cacheName).then((cache) =>
    cache.match(req).then((cached) => {
      const network = fetch(req).then((resp) => {
        if (resp && resp.ok) cache.put(req, resp.clone());
        return resp;
      }).catch(() => cached);
      return cached || network;
    })
  );
}

// network-first: try network, fall back to cache (for HTML navigation)
function networkFirst(req, cacheName) {
  return caches.open(cacheName).then((cache) =>
    fetch(req).then((resp) => {
      if (resp && resp.ok) cache.put(req, resp.clone());
      return resp;
    }).catch(() => cache.match(req))
  );
}

// stale-while-revalidate with TTL for API responses
// Stores {body, ts} in the cache value; re-fetches if older than ttlMs
function apiSWR(req, ttlMs) {
  const cacheKey = req.clone();
  return caches.open(API_CACHE).then((cache) =>
    cache.match(cacheKey).then((cached) => {
      const now = Date.now();

      // Helper: fetch fresh, cache it, return Response
      const fetchFresh = () =>
        fetch(req).then((resp) => {
          if (resp && resp.ok) {
            // Store alongside a timestamp header
            resp.clone().blob().then((blob) => {
              const headers = new Headers(resp.headers);
              headers.set('sw-cached-at', String(now));
              const stamped = new Response(blob, { status: resp.status, headers });
              cache.put(cacheKey, stamped);
            });
          }
          return resp;
        });

      if (!cached) return fetchFresh();

      const cachedAt = parseInt(cached.headers.get('sw-cached-at') || '0', 10);
      const age = now - cachedAt;

      // Background revalidation if stale
      if (age > ttlMs) {
        fetchFresh().catch(() => {}); // fire-and-forget
      }

      return cached;
    })
  );
}

// ── API routes that are safe to cache (reads only, user-scoped) ──────────────
// These are high-frequency, rarely-changing reads. Cache for up to 3-5 min.
const API_SWR_ROUTES = [
  { pattern: /\/api\/v1\/students\/me\/profile/,    ttl: 5 * 60 * 1000 },
  { pattern: /\/api\/v1\/grades\/my\b/,             ttl: 3 * 60 * 1000 },
  { pattern: /\/api\/v1\/grades\/my-stats\b/,       ttl: 3 * 60 * 1000 },
  { pattern: /\/api\/v1\/schedule\b/,               ttl: 5 * 60 * 1000 },
  { pattern: /\/api\/v1\/events\b/,                 ttl: 5 * 60 * 1000 },
  { pattern: /\/api\/v1\/tenants\/config\b/,        ttl: 60 * 60 * 1000 }, // 1h
];

// ── Fetch router ─────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return; // never intercept mutations
  const url = new URL(req.url);
  if (!url.protocol.startsWith('http')) return;

  // ── API ──────────────────────────────────────────────────────────────────
  if (url.pathname.startsWith('/api/')) {
    for (const rule of API_SWR_ROUTES) {
      if (rule.pattern.test(url.pathname)) {
        event.respondWith(apiSWR(req, rule.ttl));
        return;
      }
    }
    return; // other API calls → network-only (default)
  }

  // ── Navigation ───────────────────────────────────────────────────────────
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() =>
        caches.match('/').then((r) => r || caches.match('/index.html'))
      )
    );
    return;
  }

  // ── Images ───────────────────────────────────────────────────────────────
  if (/\.(png|jpg|jpeg|gif|svg|webp|ico)$/i.test(url.pathname)) {
    event.respondWith(cacheFirst(req, IMG_CACHE));
    return;
  }

  // ── Fonts ─────────────────────────────────────────────────────────────────
  // Self-hosted woff2 + Google Fonts CDN fallback both get cache-first
  if (/\.(woff2?|ttf|otf|eot)$/i.test(url.pathname) || url.host === 'fonts.gstatic.com') {
    event.respondWith(cacheFirst(req, STATIC_CACHE));
    return;
  }

  // ── CSS / JS ─────────────────────────────────────────────────────────────
  // Versioned (contains ?v=…) → cache-first.
  // The URL already encodes the version; if the file changed, the URL changed.
  // So a cache hit is ALWAYS fresh — no need to hit the network.
  if (/\.(css|js)$/i.test(url.pathname)) {
    if (url.search && /[?&]v=/.test(url.search)) {
      event.respondWith(cacheFirst(req, STATIC_CACHE));
    } else {
      event.respondWith(staleWhileRevalidate(req, STATIC_CACHE));
    }
    return;
  }

  // ── Cross-origin (CDN fonts/css already handled above) ───────────────────
  if (url.origin !== self.location.origin) {
    event.respondWith(cacheFirst(req, STATIC_CACHE));
    return;
  }
});

// ── Push notifications ────────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  var data = {};
  try { data = event.data ? event.data.json() : {}; } catch(e) {}
  var title = data.title || 'IDU Platform';
  var body  = data.body  || 'Yangi bildirishnoma';
  var icon  = data.icon  || '/manifest.json';
  event.waitUntil(
    self.registration.showNotification(title, {
      body, icon,
      badge: icon,
      tag: data.tag || 'idu-notif',
      data: { url: data.url || '/' }
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  var url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(list) {
      for (var i = 0; i < list.length; i++) {
        if (list[i].url.includes(self.location.origin)) {
          return list[i].focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});

// ── Manual cache purge from page ─────────────────────────────────────────────
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'PURGE_CACHE') {
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => caches.delete(k)))
    ).then(() => {
      if (e.source) e.source.postMessage({ type: 'CACHE_PURGED' });
    });
  }
});
