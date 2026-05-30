'use strict';
/* ══════════════════════════════════════════════════════════════
   Calendar — Monthly view with interactive events
   · Reads schedule / assignments / exams (auto, read-only)
   · Reads custom events from /events (personal + broadcast)
   · Click a day  -> day detail modal (+ add event)
   · Students add PERSONAL events; dekanat/teacher broadcast to all/group/faculty
══════════════════════════════════════════════════════════════ */

var _calDate = new Date();
var _calEvents = [];        // auto events (schedule/assignments/exams)
var _calCustom = [];        // user/broadcast events from /events
var _calMonthsUz = ['Yanvar','Fevral','Mart','Aprel','May','Iyun','Iyul','Avgust','Sentabr','Oktabr','Noyabr','Dekabr'];

var EVENT_TYPES = [
  { key:'event',    label:'Tadbir',    icon:'📌', color:'#2563eb' },
  { key:'party',    label:'Bayram/Party', icon:'🎉', color:'#ec4899' },
  { key:'meeting',  label:'Uchrashuv',  icon:'🤝', color:'#0891b2' },
  { key:'deadline', label:'Muddat',    icon:'⏰', color:'#f59e0b' },
  { key:'holiday',  label:'Dam olish', icon:'🌴', color:'#10b981' },
  { key:'personal', label:'Shaxsiy',   icon:'📝', color:'#8b5cf6' },
];

function _isStaffRole() {
  var r = (typeof currentRole !== 'undefined' && currentRole) || (window.CURRENT_USER && window.CURRENT_USER.role) || '';
  return ['dekanat','admin','teacher','rector'].indexOf(r) >= 0;
}
function _esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function _key(y,m,d){ return y+'-'+String(m+1).padStart(2,'0')+'-'+String(d).padStart(2,'0'); }

function calChangeMonth(dir) {
  if (dir === 0) _calDate = new Date();
  else _calDate.setMonth(_calDate.getMonth() + dir);
  renderCalendarMonth();
}

async function renderCalendarMonth() {
  var grid = document.getElementById('calGrid');
  var label = document.getElementById('calMonthLabel');
  if (!grid) return;
  if (label) label.textContent = _calMonthsUz[_calDate.getMonth()] + ' ' + _calDate.getFullYear();

  _calEvents = [];
  _calCustom = [];
  await Promise.all([_fetchMonthEvents(), _fetchCustomEvents()]);

  var year  = _calDate.getFullYear();
  var month = _calDate.getMonth();
  var first = new Date(year, month, 1);
  var last  = new Date(year, month + 1, 0);
  var firstWeekday = (first.getDay() + 6) % 7;
  var daysInMonth  = last.getDate();
  var todayStr = new Date().toISOString().slice(0, 10);

  var html = '';
  for (var i = 0; i < firstWeekday; i++) {
    var prevDay = new Date(year, month, -firstWeekday + i + 1);
    html += '<div class="cal-cell cal-cell-outside"><div class="cal-day-num">' + prevDay.getDate() + '</div></div>';
  }
  for (var d = 1; d <= daysInMonth; d++) {
    var date = new Date(year, month, d);
    var key = _key(year, month, d);
    var auto = _calEvents.filter(function(e){ return e.date === key; });
    var custom = _calCustom.filter(function(e){ return e.event_date === key; });
    var all = auto.concat(custom.map(function(c){ return { date:key, label:c.title, color:c.color, icon:_typeIcon(c.type), custom:true }; }));
    var isToday = (key === todayStr);
    var weekend = (date.getDay() === 0 || date.getDay() === 6);
    html += '<div class="cal-cell cal-cell-click' + (isToday ? ' cal-cell-today' : '') + (weekend ? ' cal-cell-weekend' : '') + '" onclick="openDayModal(\'' + key + '\')">' +
      '<div class="cal-day-num">' + d + '</div>' +
      all.slice(0, 3).map(function(e) {
        return '<div class="cal-event" style="background:' + e.color + '22;color:' + e.color + ';border-left:3px solid ' + e.color + '" title="' + _esc(e.label||'') + '">' +
          (e.icon || '') + ' ' + _esc((e.label || '').substring(0, 16)) + '</div>';
      }).join('') +
      (all.length > 3 ? '<div class="cal-event-more">+' + (all.length - 3) + ' yana</div>' : '') +
    '</div>';
  }
  var totalUsed = firstWeekday + daysInMonth;
  var trailing = (7 - (totalUsed % 7)) % 7;
  for (var t = 1; t <= trailing; t++) {
    html += '<div class="cal-cell cal-cell-outside"><div class="cal-day-num">' + t + '</div></div>';
  }
  grid.innerHTML = html;
}

function _typeIcon(type){ var t = EVENT_TYPES.filter(function(x){return x.key===type;})[0]; return t ? t.icon : '📌'; }

async function _fetchCustomEvents() {
  var y = _calDate.getFullYear(), m = _calDate.getMonth();
  var from = _key(y, m, 1);
  var to   = _key(y, m, new Date(y, m+1, 0).getDate());
  try {
    var rows = await api('GET', '/events?from=' + from + '&to=' + to);
    _calCustom = Array.isArray(rows) ? rows : [];
  } catch (e) { _calCustom = []; }
}

async function _fetchMonthEvents() {
  var y = _calDate.getFullYear();
  var m = _calDate.getMonth();
  var lastDay = new Date(y, m + 1, 0);
  try {
    var schedule = await api('GET', '/schedule');
    var weekly = (schedule && schedule.entries) || schedule || [];
    if (Array.isArray(weekly)) {
      for (var d = 1; d <= lastDay.getDate(); d++) {
        var dt = new Date(y, m, d);
        var dow = dt.getDay() === 0 ? 7 : dt.getDay();
        weekly.forEach(function(s) {
          if (s.day_of_week === dow || s.weekday === dow) {
            _calEvents.push({ date:_key(y,m,d), label:(s.subject_name||s.subject||s.course||'Dars')+' · '+(s.start_time||s.time||''), color:'#2563eb', icon:'📚' });
          }
        });
      }
    }
  } catch (e) {}
  try {
    var asn = await api('GET', '/assignments?status=pending&limit=50');
    var list = (asn && asn.assignments) || asn || [];
    if (Array.isArray(list)) list.forEach(function(a) {
      if (!a.deadline && !a.due_date) return;
      var dt = new Date(a.deadline || a.due_date);
      if (dt.getFullYear() !== y || dt.getMonth() !== m) return;
      _calEvents.push({ date:dt.toISOString().slice(0,10), label:a.title||'Vazifa', color:'#f59e0b', icon:'📝' });
    });
  } catch (e) {}
  try {
    var exams = await api('GET', '/exams/history?limit=50');
    var elist = (exams && exams.exams) || exams || [];
    if (Array.isArray(elist)) elist.forEach(function(ex) {
      if (!ex.scheduled_at && !ex.exam_date) return;
      var dt = new Date(ex.scheduled_at || ex.exam_date);
      if (dt.getFullYear() !== y || dt.getMonth() !== m) return;
      _calEvents.push({ date:dt.toISOString().slice(0,10), label:ex.title||ex.subject||'Imtihon', color:'#dc2626', icon:'🎯' });
    });
  } catch (e) {}
}

// ── Modal infra ───────────────────────────────────────────────────────────────
function _calModal(html) {
  var m = document.getElementById('calModal');
  if (!m) {
    m = document.createElement('div');
    m.id = 'calModal';
    m.style.cssText = 'position:fixed;inset:0;background:rgba(7,21,36,0.55);backdrop-filter:blur(5px);z-index:9999;display:flex;align-items:center;justify-content:center;padding:18px';
    m.onclick = function(e){ if (e.target === m) m.remove(); };
    document.body.appendChild(m);
  }
  m.innerHTML = '<div class="cal-modal-box">' + html + '</div>';
  return m;
}
function _closeCalModal(){ var m = document.getElementById('calModal'); if (m) m.remove(); }

function _fmtDateLabel(key) {
  var p = key.split('-'); var dt = new Date(+p[0], +p[1]-1, +p[2]);
  var days = ['Yakshanba','Dushanba','Seshanba','Chorshanba','Payshanba','Juma','Shanba'];
  return p[2] + ' ' + _calMonthsUz[+p[1]-1] + ', ' + days[dt.getDay()];
}

// ── Day detail modal ──────────────────────────────────────────────────────────
function openDayModal(key) {
  var auto = _calEvents.filter(function(e){ return e.date === key; });
  var custom = _calCustom.filter(function(e){ return e.event_date === key; });

  var autoHtml = auto.map(function(e){
    return '<div class="cal-de-item" style="border-left-color:' + e.color + '">' +
      '<div class="cal-de-ic">' + (e.icon||'📌') + '</div>' +
      '<div class="cal-de-body"><div class="cal-de-title">' + _esc(e.label) + '</div>' +
      '<div class="cal-de-meta">Avtomatik</div></div></div>';
  }).join('');

  var customHtml = custom.map(function(c){
    var scopeBadge = c.scope === 'all' ? '🌍 Hammaga' : c.scope === 'group' ? '👥 '+_esc(c.scope_value||'Guruh') : c.scope === 'faculty' ? '🏛 '+_esc(c.scope_value||'Fakultet') : '🔒 Shaxsiy';
    var canDel = c.mine || _isStaffRole();
    return '<div class="cal-de-item" style="border-left-color:' + c.color + '">' +
      '<div class="cal-de-ic">' + _typeIcon(c.type) + '</div>' +
      '<div class="cal-de-body"><div class="cal-de-title">' + _esc(c.title) + '</div>' +
      (c.start_time ? '<div class="cal-de-meta">🕐 ' + _esc(String(c.start_time).slice(0,5)) + ' · ' + scopeBadge + '</div>' : '<div class="cal-de-meta">' + scopeBadge + (c.creator_name ? ' · ' + _esc(c.creator_name) : '') + '</div>') +
      (c.description ? '<div class="cal-de-desc">' + _esc(c.description) + '</div>' : '') +
      '</div>' +
      (canDel ? '<button class="cal-de-del" onclick="deleteCalEvent(' + c.id + ')" title="O\'chirish">🗑</button>' : '') +
      '</div>';
  }).join('');

  var empty = (!auto.length && !custom.length) ? '<div class="cal-de-empty">Bu kunda hech narsa yo\'q</div>' : '';

  _calModal(
    '<div class="cal-modal-head"><div><div class="cal-modal-title">' + _fmtDateLabel(key) + '</div></div>' +
      '<button onclick="_closeCalModal()" class="cal-x">✕</button></div>' +
    '<div class="cal-de-list">' + autoHtml + customHtml + empty + '</div>' +
    '<button class="btn btn-primary" style="width:100%;margin-top:14px" onclick="openEventModal(\'' + key + '\')">＋ Event qo\'shish</button>'
  );
}

// ── Add event modal ───────────────────────────────────────────────────────────
function openEventModal(key) {
  var dateVal = key || new Date().toISOString().slice(0,10);
  var staff = _isStaffRole();

  var typeOpts = EVENT_TYPES.map(function(t){
    return '<button type="button" class="cal-type-btn" data-type="' + t.key + '" data-color="' + t.color + '" onclick="_pickType(this)" style="--tc:' + t.color + '">' + t.icon + ' ' + t.label + '</button>';
  }).join('');

  var scopeRow = staff ? (
    '<label class="cal-fl">Kim ko\'radi?</label>' +
    '<select id="evScope" class="form-select" onchange="_onScopeChange()">' +
      '<option value="personal">🔒 Faqat o\'zim</option>' +
      '<option value="all">🌍 Barcha talabalar</option>' +
      '<option value="group">👥 Guruh</option>' +
      '<option value="faculty">🏛 Fakultet</option>' +
    '</select>' +
    '<input id="evScopeValue" class="form-input" placeholder="Guruh/Fakultet nomi" style="display:none;margin-top:8px">'
  ) : '<input type="hidden" id="evScope" value="personal">';

  _calModal(
    '<div class="cal-modal-head"><div class="cal-modal-title">＋ Yangi event</div>' +
      '<button onclick="_closeCalModal()" class="cal-x">✕</button></div>' +
    '<div class="cal-form">' +
      '<label class="cal-fl">Sarlavha *</label>' +
      '<input id="evTitle" class="form-input" placeholder="Masalan: Shanba kuni party" maxlength="150">' +
      '<label class="cal-fl">Tur</label>' +
      '<div class="cal-type-grid" id="evTypeGrid">' + typeOpts + '</div>' +
      '<div style="display:flex;gap:10px">' +
        '<div style="flex:1"><label class="cal-fl">Sana *</label><input id="evDate" type="date" class="form-input" value="' + dateVal + '"></div>' +
        '<div style="flex:1"><label class="cal-fl">Vaqt</label><input id="evTime" type="time" class="form-input"></div>' +
      '</div>' +
      scopeRow +
      '<label class="cal-fl">Izoh</label>' +
      '<textarea id="evDesc" class="form-input" rows="2" placeholder="Qo\'shimcha ma\'lumot..." maxlength="1000"></textarea>' +
      '<button class="btn btn-primary" style="width:100%;margin-top:14px" onclick="saveCalEvent()">Saqlash</button>' +
    '</div>'
  );
  // preselect first type
  var first = document.querySelector('#evTypeGrid .cal-type-btn');
  if (first) _pickType(first);
}

var _evType = 'event', _evColor = '#2563eb';
function _pickType(btn) {
  document.querySelectorAll('#evTypeGrid .cal-type-btn').forEach(function(b){ b.classList.remove('active'); });
  btn.classList.add('active');
  _evType = btn.getAttribute('data-type');
  _evColor = btn.getAttribute('data-color');
}
function _onScopeChange() {
  var s = document.getElementById('evScope').value;
  var inp = document.getElementById('evScopeValue');
  if (inp) inp.style.display = (s === 'group' || s === 'faculty') ? '' : 'none';
}

async function saveCalEvent() {
  var title = (document.getElementById('evTitle')||{}).value || '';
  var date  = (document.getElementById('evDate')||{}).value || '';
  var time  = (document.getElementById('evTime')||{}).value || '';
  var desc  = (document.getElementById('evDesc')||{}).value || '';
  var scopeEl = document.getElementById('evScope');
  var scope = scopeEl ? scopeEl.value : 'personal';
  var scopeVal = (document.getElementById('evScopeValue')||{}).value || '';

  if (!title.trim()) { showToast('⚠️','Sarlavha','Sarlavha kiriting'); return; }
  if (!date) { showToast('⚠️','Sana','Sana tanlang'); return; }
  if ((scope === 'group' || scope === 'faculty') && !scopeVal.trim()) {
    showToast('⚠️','Nom', (scope==='group'?'Guruh':'Fakultet') + ' nomini kiriting'); return;
  }

  var body = { title: title.trim(), event_date: date, type: _evType, color: _evColor, scope: scope };
  if (time) body.start_time = time;
  if (desc.trim()) body.description = desc.trim();
  if (scope === 'group' || scope === 'faculty') body.scope_value = scopeVal.trim();

  try {
    await api('POST', '/events', body);
    showToast('✅','Event', scope === 'personal' ? 'Saqlandi' : 'Hammaga e\'lon qilindi');
    _closeCalModal();
    renderCalendarMonth();
  } catch (e) {
    showToast('❌','Xato', (e && e.message) || 'Saqlanmadi');
  }
}

async function deleteCalEvent(id) {
  try {
    await api('DELETE', '/events/' + id);
    showToast('🗑','Event','O\'chirildi');
    _closeCalModal();
    renderCalendarMonth();
  } catch (e) { showToast('❌','Xato','O\'chirilmadi'); }
}

console.log('✅ Calendar module loaded (interactive events)');
