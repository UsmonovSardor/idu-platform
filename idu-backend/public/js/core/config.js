'use strict';
// IDU Platform v3.0 - Railway Edition
// API_BASE: relative path (frontend va backend bitta serverda)

var API_BASE = '/api';  // Railway: bitta URL, relative path

// Agar alohida serverda bo'lsa (local dev):
if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
  API_BASE = 'http://localhost:3000/api';
}

var _apiToken = null;

// Saqlangan JWT ni yuklab olish
(function() {
  try {
    var saved = localStorage.getItem('idu_jwt') ||
                localStorage.getItem('idu_token') ||
                localStorage.getItem('token');
    if (saved) _apiToken = saved;
  } catch(e) {}
})();

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
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function setToken(token) {
  _apiToken = token;
  try {
    localStorage.setItem('idu_jwt', token);
    localStorage.setItem('idu_token', token);
    localStorage.setItem('token', token);
  } catch(e) {}
}

async function api(method, path, body) {
  var headers = { 'Content-Type': 'application/json' };
  if (_apiToken) headers['Authorization'] = 'Bearer ' + _apiToken;
  try {
    var res = await fetch(API_BASE + path, {
      method: method,
      headers: headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    var data = await res.json().catch(function() { return {}; });
    if (!res.ok) {
      throw Object.assign(new Error(data.error || ('HTTP ' + res.status)), { status: res.status, data: data });
    }
    return data;
  } catch (err) {
    throw err;
  }
}

async function apiLogin(role, login, password, remember) {
  try {
    var result = await api('POST', '/auth/login', { login: login, password: password });
    _apiToken = result.token;
    if (remember || true) {  // har doim saqlaymiz
      try { localStorage.setItem('idu_jwt', result.token); } catch(e) {}
      try { localStorage.setItem('idu_token', result.token); } catch(e) {}
      try { localStorage.setItem('token', result.token); } catch(e) {}
    }
    return { ok: true, user: result.user };
  } catch (err) {
    if (err.status === 401 || err.status === 403) {
      return { ok: false, error: err.message };
    }
    // Server bilan bog'lana olmasa — lokal demo mode
    console.warn('[IDU] Backend ulanmadi, demo mode:', err.message);
    return { ok: false, error: null, offline: true };
  }
}

async function apiSubmitApplication(data) {
  if (!_apiToken) return false;
  try {
    await api('POST', '/applications', data);
    return true;
  } catch(e) {
    return false;
  }
}

async function apiSubmitExam(attemptId, answers) {
  if (!_apiToken || !attemptId) return null;
  try {
    return await api('POST', '/exams/' + attemptId + '/submit', { answers: answers });
  } catch(e) {
    return null;
  }
}
