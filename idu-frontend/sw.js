/* IDU Platform — Service Worker v3.0
 * Strategies:
 *   • API (/api/*): network-only (no caching of user data)
 *   • Versioned CSS/JS (?v=...): network-first, cache as fallback
 *     (the ?v= query string IS the cache buster — SW must respect it)
 *   • Unversioned CSS/JS: stale-while-revalidate (legacy paths)
 *   • Images/fonts: cache-first (rarely change)
 *   • Navigation: network-first, shell fallback offline
 */
'use strict';

const VERSION       = 'v7';
const STATIC_CACHE  = 'idu-static-' + VERSION;
const IMG_CACHE     = 'idu-img-' + VERSION;
const SHELL_CACHE   = 'idu-shell-' + VERSION;

const SHELL_FILES = [
  '/',
  '/index.html',
  '/manifest.json',
];

// ── Install ──────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_FILES).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: drop all old caches ────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => ![STATIC_CACHE, IMG_CACHE, SHELL_CACHE].includes(k))
            .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Helpers ──────────────────────────────────────────────────────────────────
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

// Network-first: always try the network. Use cache only as offline fallback.
// Critical for versioned assets where the URL (with ?v=…) is the cache key.
function networkFirst(req, cacheName) {
  return caches.open(cacheName).then((cache) =>
    fetch(req).then((resp) => {
      if (resp && resp.ok) cache.put(req, resp.clone());
      return resp;
    }).catch(() => cache.match(req))
  );
}

function cacheFirst(req, cacheName) {
  return caches.open(cacheName).then((cache) =>
    cache.match(req).then((cached) =>
      cached || fetch(req).then((resp) => {
        if (resp && resp.ok) cache.put(req, resp.clone());
        return resp;
      }).catch(() => cached)
    )
  );
}

// ── Fetch router ─────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (!url.protocol.startsWith('http')) return;

  // 1. API → network-only (never cache user-specific data)
  if (url.pathname.startsWith('/api/')) {
    return; // default behaviour = network
  }

  // 2. Navigation (page refresh) → network first, shell fallback offline
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() =>
        caches.match('/').then((r) => r || caches.match('/index.html'))
      )
    );
    return;
  }

  // 3. Images → cache-first
  if (/\.(png|jpg|jpeg|gif|svg|webp|ico)$/i.test(url.pathname)) {
    event.respondWith(cacheFirst(req, IMG_CACHE));
    return;
  }

  // 4. Fonts → cache-first
  if (/\.(woff2?|ttf|otf|eot)$/i.test(url.pathname) || url.host === 'fonts.gstatic.com') {
    event.respondWith(cacheFirst(req, STATIC_CACHE));
    return;
  }

  // 5. CSS / JS — network-first for versioned assets (?v=...),
  //    stale-while-revalidate only as a last resort for unversioned legacy paths.
  //    Reason: when the URL has ?v=…, that IS the cache buster. The user
  //    must always see the freshest deploy, never a stale cached copy.
  if (/\.(css|js)$/i.test(url.pathname)) {
    if (url.search && /[?&]v=/.test(url.search)) {
      event.respondWith(networkFirst(req, STATIC_CACHE));
    } else {
      event.respondWith(staleWhileRevalidate(req, STATIC_CACHE));
    }
    return;
  }

  // 6. Cross-origin (CDN) → cache-first
  if (url.origin !== self.location.origin) {
    event.respondWith(cacheFirst(req, STATIC_CACHE));
    return;
  }
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
