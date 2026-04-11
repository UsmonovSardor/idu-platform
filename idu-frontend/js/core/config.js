'use strict';
// ==============================================
//  IDU Platform — core/config.js
//  API sozlamalari va global holatlar
// ==============================================

var API_BASE = 'https://idu-platform-production.up.railway.app/api';
var _apiToken  = null;
var currentUser = null;

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
  // Fallback: escape HTML
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
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
    // Network error â re-throw so callers can handle or fall back
    throw err;
  }
}

async function apiLogin(role, email, password, remember) {
  try {
    var result = await api('POST', '/auth/login', { email: email, password: password });
    _apiToken = result.token;
    if (remember) {
      try { localStorage.setItem('idu_jwt', result.token); } catch(e) {}
    }
    return { ok: true, user: result.user };
  } catch (err) {
    if (err.status === 401 || err.status === 403) {
      return { ok: false, error: err.message };
    }
    // Server unreachable â fall back to local demo mode
    console.warn('[IDU] Backend unreachable, using demo mode:', err.message);
    return { ok: false, error: null, offline: true };
  }
}

async function apiSubmitApplication(data) {
  if (!_apiToken) return false;
  try {
    await api('POST', '/applications', data);
    return true;
  } catch(e) {
    return false; // silently fall back to localStorage version
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
