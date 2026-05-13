'use strict';
// IDU - features/schedule.js — Real API

const TIMES = ['08:30–10:00','10:15–11:45','12:30–14:00','14:15–15:45','16:00–17:30'];
const DAYS_UZ_WEEK = ['Dushanba','Seshanba','Chorshanba','Payshanba','Juma'];
const DAYS_RU_WEEK = ['Понедельник','Вторник','Среда','Четверг','Пятница'];
const DAYS_SHORT_UZ = ['Du','Se','Ch','Pa','Ju'];
const DAYS_SHORT_RU = ['Пн','Вт','Ср','Чт','Пт'];

let _scheduleCache = null;
let ttWeekOffset = 0;

function _daysWeek() { return currentLang === 'ru' ? DAYS_RU_WEEK : DAYS_UZ_WEEK; }
function _daysShort() { return currentLang === 'ru' ? DAYS_SHORT_RU : DAYS_SHORT_UZ; }
function _type(t) { const ru = {"Ma'ruza":'Лекция','Laboratoriya':'Лаборатория','Amaliyot':'Практика','Seminar':'Семинар'}; return currentLang === 'ru' ? (ru[t] || t) : t; }
function getDotColor(sub) {
  const colors = ['#3B82F6','#7C3AED','#16A34A','#EA580C','#DC2626','#0D9488','#8B5CF6','#F59E0B'];
  let hash = 0; for (let c of (sub||'')) hash = ((hash << 5) - hash) + c.charCodeAt(0);
  return colors[Math.abs(hash) % colors.length];
}
function highlightDay(i) {}

async function loadSchedule() {
  if (_scheduleCache) return _scheduleCache;
  try {
    const data = await api('GET', '/schedule?limit=200');
    _scheduleCache = Array.isArray(data) ? data : [];
    return _scheduleCache;
  } catch (e) { return []; }
}

async function renderTimetable() {
  const grp = currentUser?.group || '';
  if (!grp) return;
  renderWeekNav([]);
  const rows = await loadSchedule();
  const filtered = rows.filter(r =>
    r.faculty === grp || r.group_name === grp || !r.faculty
  );
  buildTTTableFromData('ttHead', 'ttBody', filtered, false);
  renderWeekNav(filtered);
}

async function renderTeacherTimetable() {
  if (!currentUser) return;
  const rows = await loadSchedule();
  const filtered = rows.filter(r => r.teacher_id == currentUser.id || r.teacher_name === currentUser.name);
  buildTTTableFromData('teacherTTHead', 'teacherTTBody', filtered, false);
}

function buildTTTableFromData(headId, bodyId, rows, editable) {
  const head = document.getElementById(headId);
  const body = document.getElementById(bodyId);
  if (!head || !body) return;
  const days = _daysWeek();
  head.innerHTML = '<tr><th>Vaqt / Para</th>' + days.map((d,i) => {
    const today = new Date().getDay(); // 1=Mon
    const isToday = (today === i + 1);
    return `<th style="${isToday ? 'background:#EEF3FF;color:#1B4FD8' : ''}">${d}</th>`;
  }).join('') + '</tr>';

  // Group by weekday and time
  const grid = {};
  TIMES.forEach((t, ti) => {
    grid[ti] = {};
    days.forEach((_, di) => { grid[ti][di] = null; });
  });
  rows.forEach(r => {
    const di = (r.weekday !== undefined ? r.weekday : 0);
    // Match time
    let ti = TIMES.findIndex(t => {
      const [s] = t.split('–');
      return (r.start_time || '').startsWith(s.substring(0,5));
    });
    if (ti < 0) ti = 0;
    if (di >= 0 && di < 5) grid[ti][di] = r;
  });

  body.innerHTML = TIMES.map((time, ti) => `
    <tr>
      <td style="font-size:11px;font-weight:700;color:#64748b;white-space:nowrap">${time}</td>
      ${days.map((_, di) => {
        const r = grid[ti][di];
        const today = new Date().getDay();
        const isToday = (today === di + 1);
        if (!r) return `<td style="${isToday ? 'background:#F8FBFF' : ''}"></td>`;
        const color = getDotColor(r.course_name || r.subject || '');
        return `<td style="${isToday ? 'background:#F8FBFF' : ''}">
          <div style="border-left:3px solid ${color};padding:6px 8px;border-radius:4px;background:white;font-size:12px">
            <div style="font-weight:700;color:#0f172a">${r.course_name || r.subject || '—'}</div>
            <div style="color:#64748b;font-size:11px">${r.room || ''}</div>
            <div style="color:#94a3b8;font-size:10px">${r.type ? _type(r.type) : ''}</div>
          </div>
        </td>`;
      }).join('')}
    </tr>`).join('');

  if (!rows.length) {
    body.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:#94a3b8">
      <div style="font-size:36px;margin-bottom:10px">📅</div>
      <div>Jadval hali kiritilmagan</div>
    </td></tr>`;
  }
}

// Legacy wrapper
function buildTTTable(headId, bodyId, grp, editable) {
  loadSchedule().then(rows => {
    const filtered = rows.filter(r => r.faculty === grp || !r.faculty);
    buildTTTableFromData(headId, bodyId, filtered, editable);
  });
}

function renderWeekNav(rows) {
  const el = document.getElementById('ttWeekNav');
  if (!el) return;
  const d = new Date(); const dow = d.getDay();
  const monday = new Date(d);
  monday.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1) + (ttWeekOffset || 0) * 7);
  el.innerHTML = _daysWeek().map((day, i) => {
    const dd = new Date(monday); dd.setDate(monday.getDate() + i);
    const isToday = dd.toDateString() === d.toDateString();
    const hasLessons = rows && rows.some(r => r.weekday === i);
    return `<div class="week-cell${isToday ? ' today' : ''}" onclick="highlightDay(${i})">
      <div class="wc-day">${_daysShort()[i]}</div>
      <div class="wc-num">${dd.getDate()}</div>
      <div class="wc-dots">${hasLessons ? '<div class="wc-dot" style="background:#3B82F6"></div>' : ''}</div>
    </div>`;
  }).join('');
}

async function renderDashboardSchedule() {
  const el = document.getElementById('todaySchedule');
  if (!el || !currentUser) return;
  try {
    const rows = await loadSchedule();
    const today = new Date().getDay() - 1; // 0=Mon
    if (today < 0 || today > 4) {
      el.innerHTML = '<div class="empty-state"><div class="empty-state-icon">😴</div><div>Bugun dars yo\'q</div></div>';
      return;
    }
    const todayLessons = rows.filter(r => r.weekday === today);
    if (!todayLessons.length) {
      el.innerHTML = '<div class="empty-state"><div class="empty-state-icon">😴</div><div>Bugun dars yo\'q</div></div>';
      return;
    }
    el.innerHTML = todayLessons.map((l, i) => {
      const color = getDotColor(l.course_name || '');
      return `<div class="sched-item${i === 0 ? ' now' : ''}">
        ${i === 0 ? '<div class="sched-now-label">HOZIR</div>' : ''}
        <div class="sched-stripe" style="background:${color}"></div>
        <div class="sched-time">${l.start_time || TIMES[i] || ''}</div>
        <div class="sched-body">
          <div class="sched-name">${l.course_name || '—'}</div>
          <div class="sched-meta">
            <span>🚪 ${l.room || '—'}</span>
          </div>
        </div>
      </div>`;
    }).join('');
  } catch (e) {
    el.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📅</div><div>Jadval yuklanmadi</div></div>';
  }
}
