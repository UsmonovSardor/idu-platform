'use strict';
/* ══════════════════════════════════════════════════════════════
   Command Palette — Linear / GitHub / Vercel style
   Opens with Ctrl+K (Cmd+K on Mac)
   Also handles keyboard shortcuts:  G+H, G+T, G+G, G+V, G+A, G+R
   ? → show shortcuts help
══════════════════════════════════════════════════════════════ */

var CMD_PAGES = [
  { id:'dashboard',     icon:'🏠', label:'Bosh sahifa',   short:'G H', desc:'Student paneli' },
  { id:'timetable',     icon:'📅', label:'Jadval',        short:'G T', desc:'Dars jadvali' },
  { id:'grades',        icon:'📊', label:'Baholar',       short:'G G', desc:'Baho va GPA' },
  { id:'tasks',         icon:'📝', label:'Vazifalar',     short:'G V', desc:'Topshiriqlar' },
  { id:'leaderboard',   icon:'🏆', label:'Reyting',       short:'G R', desc:'Guruh reytingi' },
  { id:'aitutor',       icon:'🤖', label:'AI Tutor',      short:'G A', desc:'Suniy intellekt' },
  { id:'notifications', icon:'🔔', label:'Xabarlar',      desc:'Bildirishnomalar' },
  { id:'student-exams', icon:'🎯', label:'Imtihonlar',    desc:'Imtihon jadvali' },
  { id:'sesiya-test',   icon:'🧪', label:'Test rejim',    desc:'Sinov savollari' },
  { id:'sesiya-real',   icon:'📝', label:'Sesiya',        desc:'Rasmiy sesiya' },
  { id:'professors',    icon:'⭐', label:'Ustozlar',      desc:'O\'qituvchilar reytingi' },
  { id:'startup',       icon:'🚀', label:'Startup',       desc:'G\'oyalar va startuplar' },
];

var CMD_ACTIONS = [
  { icon:'🌙', label:'Qorong\'u rejim',   desc:'Dark / Light mode',  action: function(){ toggleDarkMode(); } },
  { icon:'🧠', label:'Quiz boshlash',     desc:'Tez tekshiruv',       action: function(){ if(typeof openQuiz==='function') openQuiz(); } },
  { icon:'🔄', label:'Ma\'lumotlarni yangilash', desc:'Sync',         action: function(){ if(typeof syncData==='function') syncData(); } },
  { icon:'📄', label:'Transkript yuklab olish', desc:'PDF',           action: function(){ if(typeof downloadMyTranscript==='function') downloadMyTranscript(); } },
  { icon:'❓', label:'Yordam ko\'rsatish', desc:'Keyboard shortcuts', action: showShortcutsHelp },
];

var _cmdOpen = false;
var _cmdSelected = 0;
var _cmdFiltered = [];
var _gPressed = false;
var _gTimer = null;

function openCmdPalette() {
  var bg = document.getElementById('cmdPaletteBg');
  if (!bg) return;
  _cmdOpen = true;
  bg.style.display = 'flex';
  requestAnimationFrame(function() { bg.classList.add('open'); });
  var input = document.getElementById('cmdInput');
  if (input) { input.value = ''; input.focus(); }
  _cmdFiltered = CMD_PAGES.concat(CMD_ACTIONS.map(function(a){ return a; }));
  _renderCmdResults('');
}

function closeCmdPalette() {
  var bg = document.getElementById('cmdPaletteBg');
  if (!bg) return;
  _cmdOpen = false;
  bg.classList.remove('open');
  setTimeout(function(){ bg.style.display = 'none'; }, 200);
}

function _renderCmdResults(query) {
  var el = document.getElementById('cmdResults');
  if (!el) return;
  var q = query.toLowerCase().trim();

  var pages = CMD_PAGES.filter(function(p) {
    return !q || p.label.toLowerCase().includes(q) || p.desc.toLowerCase().includes(q);
  });
  var actions = CMD_ACTIONS.filter(function(a) {
    return !q || a.label.toLowerCase().includes(q) || a.desc.toLowerCase().includes(q);
  });

  _cmdFiltered = pages.concat(actions.map(function(a, i){ return { _actionIdx: i, icon: a.icon, label: a.label, desc: a.desc }; }));
  _cmdSelected = 0;

  var html = '';
  if (pages.length) {
    html += '<div class="cmd-group-label">Sahifalar</div>';
    pages.forEach(function(p, i) {
      html += _cmdItemHTML(i, p.icon, p.label, p.desc, p.short);
    });
  }
  if (actions.length) {
    html += '<div class="cmd-group-label">Harakatlar</div>';
    actions.forEach(function(a, ai) {
      html += _cmdItemHTML(pages.length + ai, a.icon, a.label, a.desc, '');
    });
  }
  if (!html) html = '<div class="cmd-empty">Hech narsa topilmadi</div>';
  el.innerHTML = html;
  _highlightCmd(0);
}

function _cmdItemHTML(idx, icon, label, desc, shortcut) {
  return '<div class="cmd-item" data-idx="' + idx + '" onclick="_execCmd(' + idx + ')">' +
    '<span class="cmd-item-icon">' + icon + '</span>' +
    '<span class="cmd-item-body"><span class="cmd-item-label">' + label + '</span>' +
    '<span class="cmd-item-desc">' + desc + '</span></span>' +
    (shortcut ? '<kbd class="cmd-kbd">' + shortcut + '</kbd>' : '') +
  '</div>';
}

function _highlightCmd(idx) {
  document.querySelectorAll('.cmd-item').forEach(function(el, i) {
    el.classList.toggle('selected', i === idx);
    if (i === idx) el.scrollIntoView({ block: 'nearest' });
  });
  _cmdSelected = idx;
}

function _execCmd(idx) {
  var item = _cmdFiltered[idx];
  if (!item) return;
  closeCmdPalette();
  if (item._actionIdx !== undefined) {
    var act = CMD_ACTIONS[item._actionIdx];
    if (act && act.action) setTimeout(act.action, 150);
  } else {
    if (typeof window.showPage === 'function') setTimeout(function(){ window.showPage(item.id); }, 150);
  }
}

function showShortcutsHelp() {
  var el = document.getElementById('shortcutsModal');
  if (el) { el.style.display = 'flex'; return; }
  var shortcuts = [
    ['Ctrl+K / ⌘K', 'Command palette'],
    ['G  H',   'Bosh sahifa'],
    ['G  T',   'Jadval'],
    ['G  G',   'Baholar'],
    ['G  V',   'Vazifalar'],
    ['G  A',   'AI Tutor'],
    ['G  R',   'Reyting'],
    ['?',      'Bu oyna'],
    ['Esc',    'Yopish'],
  ];
  var div = document.createElement('div');
  div.id = 'shortcutsModal';
  div.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(15,23,42,0.7);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center';
  div.onclick = function(e){ if(e.target===div) div.remove(); };
  div.innerHTML = '<div style="background:var(--white);border:1px solid var(--border);border-radius:18px;padding:28px 32px;min-width:320px;box-shadow:var(--shadow-lg)">' +
    '<div style="font-size:17px;font-weight:800;margin-bottom:18px;display:flex;align-items:center;gap:8px">⌨️ Klaviatura yorliqlari</div>' +
    shortcuts.map(function(s){
      return '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">' +
        '<span style="font-size:13px;color:var(--text2)">' + s[1] + '</span>' +
        '<kbd style="background:var(--bg2);border:1px solid var(--border2);border-radius:6px;padding:3px 10px;font-size:11px;font-weight:700;letter-spacing:0.5px;font-family:inherit">' + s[0] + '</kbd>' +
      '</div>';
    }).join('') +
    '<button onclick="document.getElementById(\'shortcutsModal\').remove()" style="margin-top:12px;width:100%;padding:9px;background:var(--bg2);border:1px solid var(--border);border-radius:9px;font-family:inherit;font-size:13px;font-weight:600;cursor:pointer;color:var(--text2)">Yopish</button>' +
  '</div>';
  document.body.appendChild(div);
}

// ── Event listeners ───────────────────────────────────────────────────────────
document.addEventListener('keydown', function(e) {
  // Don't intercept when typing in inputs
  var tag = document.activeElement && document.activeElement.tagName;
  var inInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

  // Ctrl+K / Cmd+K → open palette
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault();
    _cmdOpen ? closeCmdPalette() : openCmdPalette();
    return;
  }

  // Escape
  if (e.key === 'Escape' && _cmdOpen) { closeCmdPalette(); return; }

  // Palette navigation
  if (_cmdOpen) {
    var total = document.querySelectorAll('.cmd-item').length;
    if (e.key === 'ArrowDown') { e.preventDefault(); _highlightCmd((_cmdSelected + 1) % total); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); _highlightCmd((_cmdSelected - 1 + total) % total); }
    if (e.key === 'Enter')     { e.preventDefault(); _execCmd(_cmdSelected); }
    return;
  }

  if (inInput) return;

  // ? → shortcuts help
  if (e.key === '?') { showShortcutsHelp(); return; }

  // G + letter shortcuts
  if (e.key && e.key.toLowerCase() === 'g' && !e.ctrlKey && !e.metaKey && !e.altKey) {
    _gPressed = true;
    clearTimeout(_gTimer);
    _gTimer = setTimeout(function(){ _gPressed = false; }, 900);
    return;
  }
  if (_gPressed && e.key) {
    _gPressed = false;
    clearTimeout(_gTimer);
    var map = { h:'dashboard', t:'timetable', g:'grades', v:'tasks', a:'aitutor', r:'leaderboard' };
    var pg = map[e.key.toLowerCase()];
    if (pg && typeof window.showPage === 'function') { window.showPage(pg); }
  }
});

// Wire up command input
document.addEventListener('DOMContentLoaded', function() {
  var input = document.getElementById('cmdInput');
  if (input) {
    input.addEventListener('input', function() { _renderCmdResults(this.value); });
  }
  // Close on backdrop click
  var bg = document.getElementById('cmdPaletteBg');
  if (bg) bg.addEventListener('click', function(e){ if(e.target === bg) closeCmdPalette(); });
});

console.log('✅ Command Palette loaded (Ctrl+K, G+shortcuts, ?)');
