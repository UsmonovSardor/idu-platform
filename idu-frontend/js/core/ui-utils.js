'use strict';
// IDU — Universal UI Utilities
// Single source of truth for loading states, empty states, error banners,
// data caching (groups, subjects, current user), and small DOM helpers.

(function(){

// ── Data caches (refresh every 5 min) ────────────────────────────────────────
var _cache = {
  groups:   { data: null, ts: 0 },
  subjects: { data: null, ts: 0 },
  students: { data: null, ts: 0 },
  me:       { data: null, ts: 0 }
};
var TTL = 5 * 60 * 1000;

function _isFresh(c) { return c.data && (Date.now() - c.ts) < TTL; }

// Fetch all students (cached). Returns flat array — auto-unwraps {data:[...]}
async function getAllStudents(opts) {
  opts = opts || {};
  if (!opts.force && _isFresh(_cache.students)) return _cache.students.data;
  try {
    var res = await api('GET', '/students?limit=500');
    var list = Array.isArray(res) ? res : (res.data || res.students || res.rows || []);
    _cache.students = { data: list, ts: Date.now() };
    return list;
  } catch(e) {
    console.warn('getAllStudents failed:', e.message);
    return _cache.students.data || [];
  }
}

// Distinct groups from student roster — sorted, deduped
async function getGroups(opts) {
  if (!opts || !opts.force) {
    if (_isFresh(_cache.groups)) return _cache.groups.data;
  }
  var list = await getAllStudents(opts);
  var s = new Set();
  list.forEach(function(x){
    var g = x.group_name || x.group;
    if (g) s.add(g);
  });
  var arr = Array.from(s).sort();
  // Fallback for empty database — give sensible defaults so dropdowns aren't blank
  if (!arr.length) arr = ['AI-2301','CS-2301','IT-2301','DB-2301'];
  _cache.groups = { data: arr, ts: Date.now() };
  return arr;
}

// Known subjects (hardcoded list + can be extended)
var SUBJECTS = [
  { code: 'algo', name: 'Algoritmlar',       icon: '💻' },
  { code: 'ai',   name: "Sun'iy Intellekt",  icon: '🤖' },
  { code: 'math', name: 'Matematika',        icon: '📐' },
  { code: 'db',   name: "Ma'lumotlar Bazasi", icon: '🗄️' },
  { code: 'web',  name: 'Web Dasturlash',    icon: '🌐' }
];
function getSubjects() { return SUBJECTS.slice(); }

// Populate a <select> with groups
async function fillGroupSelect(selectEl, opts) {
  if (!selectEl) return;
  opts = opts || {};
  var current = selectEl.value;
  var groups = await getGroups();
  var html = opts.allowEmpty !== false
    ? '<option value="">' + (opts.emptyLabel || 'Barcha guruhlar') + '</option>'
    : '';
  groups.forEach(function(g){ html += '<option value="' + g + '">' + g + '</option>'; });
  selectEl.innerHTML = html;
  // restore previous selection if still valid
  if (current && groups.indexOf(current) !== -1) selectEl.value = current;
}

// Populate a <select> with subjects
function fillSubjectSelect(selectEl, opts) {
  if (!selectEl) return;
  opts = opts || {};
  var current = selectEl.value;
  var html = opts.allowEmpty !== false
    ? '<option value="">' + (opts.emptyLabel || 'Barcha fanlar') + '</option>'
    : '';
  SUBJECTS.forEach(function(s){
    html += '<option value="' + s.code + '">' + s.icon + ' ' + s.name + '</option>';
  });
  selectEl.innerHTML = html;
  if (current) selectEl.value = current;
}

// ── Loading skeleton ─────────────────────────────────────────────────────────
function showLoading(el, type, count) {
  if (!el) return;
  if (typeof el === 'string') el = document.getElementById(el);
  if (!el) return;
  type = type || 'cards';
  count = count || 4;

  var html = '';
  if (type === 'cards' || type === 'kpi') {
    html = '<div class="iu-skel-grid">';
    for (var i = 0; i < count; i++) {
      html += '<div class="iu-skel-card" style="animation-delay:' + (i*0.07) + 's">' +
              '<div class="iu-skel-line" style="width:55%;height:11px;margin-bottom:14px"></div>' +
              '<div class="iu-skel-line" style="width:40%;height:28px;margin-bottom:10px"></div>' +
              '<div class="iu-skel-line" style="width:75%;height:9px"></div></div>';
    }
    html += '</div>';
  } else if (type === 'rows' || type === 'list') {
    for (var j = 0; j < count; j++) {
      html += '<div class="iu-skel-row" style="animation-delay:' + (j*0.05) + 's"></div>';
    }
  } else if (type === 'table') {
    html = '<div class="iu-skel-table">';
    for (var k = 0; k < count; k++) {
      html += '<div class="iu-skel-tr" style="animation-delay:' + (k*0.04) + 's">' +
              '<div class="iu-skel-td" style="width:40%"></div>' +
              '<div class="iu-skel-td" style="width:20%"></div>' +
              '<div class="iu-skel-td" style="width:18%"></div>' +
              '<div class="iu-skel-td" style="width:18%"></div></div>';
    }
    html += '</div>';
  } else if (type === 'spinner') {
    html = '<div class="iu-spinner-wrap"><div class="iu-spinner"></div><div class="iu-spinner-msg">Yuklanmoqda...</div></div>';
  }
  el.innerHTML = html;
}

function showEmpty(el, opts) {
  if (!el) return;
  if (typeof el === 'string') el = document.getElementById(el);
  if (!el) return;
  opts = opts || {};
  var icon  = opts.icon  || '📭';
  var title = opts.title || "Ma'lumot topilmadi";
  var desc  = opts.desc  || '';
  var action = opts.action || '';
  el.innerHTML = '<div class="iu-empty">'
    + '<div class="iu-empty-icon">' + icon + '</div>'
    + '<div class="iu-empty-title">' + title + '</div>'
    + (desc ? '<div class="iu-empty-desc">' + desc + '</div>' : '')
    + (action ? '<div class="iu-empty-action">' + action + '</div>' : '')
    + '</div>';
}

function showError(el, msg, opts) {
  if (!el) return;
  if (typeof el === 'string') el = document.getElementById(el);
  if (!el) return;
  opts = opts || {};
  el.innerHTML = '<div class="iu-error">'
    + '<div class="iu-error-icon">⚠️</div>'
    + '<div class="iu-error-body">'
    +   '<div class="iu-error-title">' + (opts.title || 'Xato yuz berdi') + '</div>'
    +   '<div class="iu-error-msg">' + (msg || 'Nomalum xato') + '</div>'
    + '</div>'
    + (opts.retry ? '<button class="iu-error-btn" onclick="(' + opts.retry + ')()">🔄 Qayta urinish</button>' : '')
    + '</div>';
}

// ── Number formatting & display helpers ──────────────────────────────────────
function fmtNum(n) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return Number(n).toLocaleString('uz-UZ');
}
function fmtPct(n) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return Math.round(n) + '%';
}
function fmtScore(n) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return Number(n).toFixed(1);
}
function gradeColor(score) {
  score = parseFloat(score) || 0;
  return score >= 86 ? '#16A34A'
       : score >= 71 ? '#0891B2'
       : score >= 56 ? '#D97706'
       : score >= 41 ? '#EA580C' : '#DC2626';
}
function gradeLetter(score) {
  score = parseFloat(score) || 0;
  return score >= 86 ? 'A'
       : score >= 71 ? 'B'
       : score >= 56 ? 'C'
       : score >= 41 ? 'D' : 'F';
}

// ── Safe HTML escape ─────────────────────────────────────────────────────────
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// ── Debounce ─────────────────────────────────────────────────────────────────
function debounce(fn, wait) {
  var t;
  return function(){
    var ctx = this, args = arguments;
    clearTimeout(t);
    t = setTimeout(function(){ fn.apply(ctx, args); }, wait || 300);
  };
}

// ── Cache invalidation (call after mutations) ────────────────────────────────
function invalidateCache(key) {
  if (key && _cache[key]) _cache[key] = { data: null, ts: 0 };
  else Object.keys(_cache).forEach(function(k){ _cache[k] = { data: null, ts: 0 }; });
}

// ── Export to window ─────────────────────────────────────────────────────────
window.IDU = window.IDU || {};
Object.assign(window.IDU, {
  getAllStudents, getGroups, getSubjects,
  fillGroupSelect, fillSubjectSelect,
  showLoading, showEmpty, showError,
  fmtNum, fmtPct, fmtScore, gradeColor, gradeLetter,
  esc, debounce, invalidateCache
});

})();
