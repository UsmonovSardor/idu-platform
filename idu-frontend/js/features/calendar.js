'use strict';
/* ══════════════════════════════════════════════════════════════
   Calendar — Monthly view (Google Calendar style)
   Pulls events from /schedule + /assignments + /exams
══════════════════════════════════════════════════════════════ */

var _calDate = new Date();
var _calEvents = []; // [{ date: 'YYYY-MM-DD', label, color, icon }]

function calChangeMonth(dir) {
  if (dir === 0) _calDate = new Date();
  else _calDate.setMonth(_calDate.getMonth() + dir);
  renderCalendarMonth();
}

async function renderCalendarMonth() {
  var grid = document.getElementById('calGrid');
  var label = document.getElementById('calMonthLabel');
  if (!grid) return;

  var months = ['Yanvar','Fevral','Mart','Aprel','May','Iyun','Iyul','Avgust','Sentabr','Oktabr','Noyabr','Dekabr'];
  if (label) label.textContent = months[_calDate.getMonth()] + ' ' + _calDate.getFullYear();

  // Fetch events for the month (best effort)
  _calEvents = [];
  await _fetchMonthEvents();

  var year  = _calDate.getFullYear();
  var month = _calDate.getMonth();
  var first = new Date(year, month, 1);
  var last  = new Date(year, month + 1, 0);
  // Mon=0, Sun=6
  var firstWeekday = (first.getDay() + 6) % 7;
  var daysInMonth  = last.getDate();
  var todayStr = new Date().toISOString().slice(0, 10);

  var html = '';
  // Leading empty cells from previous month
  for (var i = 0; i < firstWeekday; i++) {
    var prevDay = new Date(year, month, -firstWeekday + i + 1);
    html += '<div class="cal-cell cal-cell-outside">' +
      '<div class="cal-day-num">' + prevDay.getDate() + '</div></div>';
  }
  for (var d = 1; d <= daysInMonth; d++) {
    var date = new Date(year, month, d);
    var key = year + '-' + String(month+1).padStart(2,'0') + '-' + String(d).padStart(2,'0');
    var dayEvents = _calEvents.filter(function(e) { return e.date === key; });
    var isToday = (key === todayStr);
    var weekend = (date.getDay() === 0 || date.getDay() === 6);
    html += '<div class="cal-cell' + (isToday ? ' cal-cell-today' : '') + (weekend ? ' cal-cell-weekend' : '') + '">' +
      '<div class="cal-day-num">' + d + '</div>' +
      dayEvents.slice(0, 3).map(function(e) {
        return '<div class="cal-event" style="background:' + e.color + '22;color:' + e.color + ';border-left:3px solid ' + e.color + '" title="' + (e.label || '') + '">' +
          (e.icon || '') + ' ' + (e.label || '').substring(0, 18) + '</div>';
      }).join('') +
      (dayEvents.length > 3 ? '<div class="cal-event-more">+' + (dayEvents.length - 3) + ' more</div>' : '') +
    '</div>';
  }
  // Trailing cells from next month to fill grid (6 rows × 7 cols)
  var totalUsed = firstWeekday + daysInMonth;
  var trailing = (7 - (totalUsed % 7)) % 7;
  for (var t = 1; t <= trailing; t++) {
    html += '<div class="cal-cell cal-cell-outside"><div class="cal-day-num">' + t + '</div></div>';
  }

  grid.innerHTML = html;
}

async function _fetchMonthEvents() {
  var y = _calDate.getFullYear();
  var m = _calDate.getMonth();
  var firstDay = new Date(y, m, 1);
  var lastDay  = new Date(y, m + 1, 0);

  // Schedule (weekly recurring) — convert to dates in current month
  try {
    var schedule = await api('GET', '/schedule');
    var weekly = (schedule && schedule.entries) || schedule || [];
    if (Array.isArray(weekly)) {
      for (var d = 1; d <= lastDay.getDate(); d++) {
        var dt = new Date(y, m, d);
        var dow = dt.getDay() === 0 ? 7 : dt.getDay(); // 1=Mon, 7=Sun
        weekly.forEach(function(s) {
          if (s.day_of_week === dow || s.weekday === dow) {
            var key = y + '-' + String(m+1).padStart(2,'0') + '-' + String(d).padStart(2,'0');
            _calEvents.push({
              date: key,
              label: (s.subject_name || s.subject || s.course || 'Dars') + ' · ' + (s.start_time || s.time || ''),
              color: '#2563eb',
              icon: '📚',
            });
          }
        });
      }
    }
  } catch (e) {}

  // Assignments (deadlines)
  try {
    var asn = await api('GET', '/assignments?status=pending&limit=50');
    var list = (asn && asn.assignments) || asn || [];
    if (Array.isArray(list)) {
      list.forEach(function(a) {
        if (!a.deadline && !a.due_date) return;
        var dt = new Date(a.deadline || a.due_date);
        if (dt.getFullYear() !== y || dt.getMonth() !== m) return;
        var key = dt.toISOString().slice(0,10);
        _calEvents.push({
          date: key,
          label: a.title || 'Vazifa',
          color: '#f59e0b',
          icon: '📝',
        });
      });
    }
  } catch (e) {}

  // Exams
  try {
    var exams = await api('GET', '/exams/history?limit=50');
    var elist = (exams && exams.exams) || exams || [];
    if (Array.isArray(elist)) {
      elist.forEach(function(ex) {
        if (!ex.scheduled_at && !ex.exam_date) return;
        var dt = new Date(ex.scheduled_at || ex.exam_date);
        if (dt.getFullYear() !== y || dt.getMonth() !== m) return;
        var key = dt.toISOString().slice(0,10);
        _calEvents.push({
          date: key,
          label: ex.title || ex.subject || 'Imtihon',
          color: '#dc2626',
          icon: '🎯',
        });
      });
    }
  } catch (e) {}
}

console.log('✅ Calendar module loaded');
