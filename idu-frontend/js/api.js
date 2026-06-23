// =============================================
// API CLIENT v2 — cookie-auth, auto-refresh
// =============================================

// API_BASE is set by <meta name="api-base"> in index.html via core/config.js.
// This fallback runs only if config.js didn't execute first.
if (typeof API_BASE === 'undefined') var API_BASE = window.location.origin + '/api/v1';

// In-memory token (set by saveAuthToken after login).
// localStorage is NOT used for JWT — httpOnly cookies carry the session.
// Keeping it in memory avoids XSS token theft via localStorage.
var _apiToken = null;

function setToken(token) { _apiToken = token; }
function getToken()      { return _apiToken; }

var _refreshing = false;
var _refreshQueue = [];

async function _doRefresh() {
  try {
    const r = await fetch(API_BASE + '/auth/refresh', {
      method:      'POST',
      credentials: 'include',
    });
    if (r.ok) {
      const d = await r.json().catch(() => ({}));
      if (d.token) _apiToken = d.token;
      return true;
    }
  } catch (_) {}
  return false;
}

async function api(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (_apiToken) headers['Authorization'] = 'Bearer ' + _apiToken;

  try {
    var res = await fetch(API_BASE + path, {
      method,
      headers,
      credentials: 'include', // send httpOnly cookies with every request
      body: body ? JSON.stringify(body) : undefined,
    });

    // Auto-refresh on 401: queue concurrent callers so only one refresh fires
    if (res.status === 401 && path !== '/auth/refresh' && path !== '/auth/login') {
      if (!_refreshing) {
        _refreshing = true;
        const ok = await _doRefresh();
        _refreshing = false;
        _refreshQueue.forEach(fn => fn(ok));
        _refreshQueue = [];
        if (!ok) {
          // Refresh failed — clear token and redirect to login
          _apiToken = null;
          try { localStorage.removeItem('idu_jwt'); } catch (_) {}
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('idu:session-expired'));
          }
          throw Object.assign(new Error('Session expired'), { status: 401 });
        }
      } else {
        // Another refresh is already in progress — wait for it
        await new Promise(resolve => _refreshQueue.push(resolve));
      }

      // Retry original request with refreshed token
      if (_apiToken) headers['Authorization'] = 'Bearer ' + _apiToken;
      res = await fetch(API_BASE + path, {
        method,
        headers,
        credentials: 'include',
        body: body ? JSON.stringify(body) : undefined,
      });
    }

    var data = await res.json().catch(function() { return {}; });
    if (!res.ok) {
      throw Object.assign(new Error(data.error || ('HTTP ' + res.status)), { status: res.status, data: data });
    }
    return data;
  } catch (e) {
    if (e.status) throw e;
    throw Object.assign(new Error('Server bilan aloqa yo\'q'), { status: 0 });
  }
}
