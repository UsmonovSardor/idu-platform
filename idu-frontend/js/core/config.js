'use strict';
// IDU — core/config.js  v4.0

// ── API base URL ──────────────────────────────────────────────────────────────
var API_BASE = (function () {
  // 1. Explicit override via <meta name="api-base">
  var meta = document.querySelector('meta[name="api-base"]');
  if (meta && meta.content) return meta.content;

  // 2. Same-origin deployment (Railway / localhost)
  var sameOriginHosts = [
    'idu-platform-production.up.railway.app',
    'localhost',
    '127.0.0.1',
  ];
  if (sameOriginHosts.some(function(h) { return window.location.hostname.indexOf(h) !== -1; })) {
    return '/api/v1';
  }

  // 3. Separate frontend domain — point at backend
  return 'https://idu-platform-production.up.railway.app/api/v1';
}());

// ── In-memory token (used only as fallback when cookie is unavailable) ────────
var _apiToken = null;

// ── HTML sanitizer ────────────────────────────────────────────────────────────
function safeHTML(str) {
  if (typeof DOMPurify !== 'undefined') {
    return DOMPurify.sanitize(String(str || ''), {
      ALLOWED_TAGS: ['b','i','em','strong','span','div','p','br','ul','ol','li',
                     'table','thead','tbody','tr','th','td','h2','h3','h4','small',
                     'button','svg','path','circle','rect','input','label','textarea',
                     'select','option','form'],
      ALLOWED_ATTR: ['class','id','style','type','value','placeholder','onclick',
                     'data-*','href','src','alt','name','checked','disabled','selected',
                     'rowspan','colspan','for','aria-label','title'],
    });
  }
  return String(str || '')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;');
}

// ── Core API client ───────────────────────────────────────────────────────────
async function api(method, path, body) {
  var headers = { 'Content-Type': 'application/json' };

  // Attach Bearer token only when cookie is not available (e.g. cross-origin dev)
  if (_apiToken) headers['Authorization'] = 'Bearer ' + _apiToken;

  var res = await fetch(API_BASE + path, {
    method:      method,
    headers:     headers,
    credentials: 'include', // send httpOnly cookie on every request
    body:        body ? JSON.stringify(body) : undefined,
  });

  var data = await res.json().catch(function() { return {}; });

  if (!res.ok) {
    throw Object.assign(
      new Error(data.error || ('HTTP ' + res.status)),
      { status: res.status, data: data }
    );
  }
  return data;
}

// ── Login ─────────────────────────────────────────────────────────────────────
async function apiLogin(role, login, password, remember) {
  try {
    var result = await api('POST', '/auth/login', { login: login, password: password });

    // Token is now primarily stored in httpOnly cookie (set by server).
    // Keep in-memory copy as fallback for same-session Bearer auth.
    if (result.token) {
      _apiToken = result.token;
      // Persist for page refresh only when "remember me" is checked
      if (remember) {
        try { localStorage.setItem('idu_jwt', result.token); } catch(e) {}
      }
    }

    return { ok: true, user: result.user };
  } catch (err) {
    if (err.status === 401 || err.status === 403) {
      return { ok: false, error: err.message };
    }
    console.warn('[IDU] Backend unreachable:', err.message);
    return { ok: false, error: 'Server bilan aloqa yo\'q. Keyinroq urinib ko\'ring.' };
  }
}

// ── Logout ────────────────────────────────────────────────────────────────────
async function apiLogout() {
  _apiToken = null;
  try { localStorage.removeItem('idu_jwt'); } catch(e) {}
  try { await api('POST', '/auth/logout'); } catch(e) { /* ignore */ }
}

// ── Restore session from localStorage (page refresh) ─────────────────────────
(function _restoreToken() {
  try {
    var stored = localStorage.getItem('idu_jwt');
    if (stored) _apiToken = stored;
  } catch(e) {}
}());

// ── Helpers (kept for backward compat) ───────────────────────────────────────
async function apiSubmitApplication(data) {
  if (!_apiToken) return false;
  try { await api('POST', '/applications', data); return true; } catch(e) { return false; }
}

async function apiSubmitExam(attemptId, answers) {
  if (!_apiToken || !attemptId) return null;
  try { return await api('POST', '/exams/' + attemptId + '/submit', { answers }); } catch(e) { return null; }
}
