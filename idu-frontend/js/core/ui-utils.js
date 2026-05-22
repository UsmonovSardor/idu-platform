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
// Students (role='student') cannot access this endpoint — return [] silently.
async function getAllStudents(opts) {
  opts = opts || {};
  // Guard: students are not allowed to fetch the full student list
  var role = (window.CURRENT_USER && window.CURRENT_USER.role) || '';
  if (role === 'student') return [];
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

// ── Auto-fill ALL group/subject dropdowns on the page ───────────────────────
// Detects <select> elements by ID pattern: contains "Group"/"group"/"Grp" → group select
// Contains "Subject"/"subject"/"Fan" → subject select. Preserves selected value.
async function initDynamicSelects(opts) {
  opts = opts || {};
  var groupSelects = [];
  var subjectSelects = [];

  document.querySelectorAll('select').forEach(function(s){
    if (!s.id) return;
    if (s.dataset.iduFilled === '1' && !opts.force) return; // skip already done
    // Skip the hidden helper select
    if (s.id === 'sGroup') return;
    // Skip subject-name selects (those that take "Algoritmlar" strings — different list)
    var lid = s.id.toLowerCase();
    if (/(group|grp|guruh)(filter|select|name)?$/i.test(s.id) || /group|grp|guruh/.test(lid)) {
      // But skip the "move to group" and dir/course selects (different semantics)
      if (/movetogroup|newgroupdir|newgroupcourse|editstudentgroup/i.test(s.id)) return;
      // Skip group SUBJECT-related selects
      if (/subject/i.test(lid)) return;
      groupSelects.push(s);
      return;
    }
    if (/(subject|fan)(filter|select)?$/i.test(s.id) && !/group/i.test(lid)) {
      subjectSelects.push(s);
    }
  });

  if (groupSelects.length) {
    var groups = await getGroups();
    groupSelects.forEach(function(sel){
      var current = sel.value;
      // Detect if it already has an "All" option (without value)
      var firstOpt = sel.querySelector('option');
      var hasAll = firstOpt && (!firstOpt.value || firstOpt.value === '');
      var html = hasAll ? '<option value="">Barcha guruhlar</option>' : '';
      groups.forEach(function(g){ html += '<option value="' + g + '">' + g + '</option>'; });
      sel.innerHTML = html;
      if (current && groups.indexOf(current) !== -1) sel.value = current;
      sel.dataset.iduFilled = '1';
    });
  }

  if (subjectSelects.length) {
    subjectSelects.forEach(function(sel){
      var current = sel.value;
      var firstOpt = sel.querySelector('option');
      var hasAll = firstOpt && (!firstOpt.value || firstOpt.value === '');
      var html = hasAll ? '<option value="">Barcha fanlar</option>' : '';
      SUBJECTS.forEach(function(s){
        html += '<option value="' + s.code + '">' + s.icon + ' ' + s.name + '</option>';
      });
      sel.innerHTML = html;
      if (current) sel.value = current;
      sel.dataset.iduFilled = '1';
    });
  }
}

// ── Universal search-box binder ──────────────────────────────────────────────
// Binds debounced input handler to a search box that calls a render function
function bindSearchBox(inputId, renderFn, delay) {
  var inp = document.getElementById(inputId);
  if (!inp || inp.dataset.iduBound === '1') return;
  inp.dataset.iduBound = '1';
  var deb = debounce(renderFn, delay || 350);
  inp.addEventListener('input', deb);
  // Also handle Enter for immediate search
  inp.addEventListener('keydown', function(e){
    if (e.key === 'Enter') { e.preventDefault(); renderFn(); }
  });
}

// ── Export to window ─────────────────────────────────────────────────────────
window.IDU = window.IDU || {};
Object.assign(window.IDU, {
  getAllStudents, getGroups, getSubjects,
  fillGroupSelect, fillSubjectSelect,
  initDynamicSelects, bindSearchBox,
  showLoading, showEmpty, showError,
  fmtNum, fmtPct, fmtScore, gradeColor, gradeLetter,
  esc, debounce, invalidateCache
});

})();
