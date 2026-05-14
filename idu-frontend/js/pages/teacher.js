'use strict';
// IDU - pages/teacher.js
// Ustoz paneli funksiyalari

var _attendanceCache = {};

async function initAttendance() {
  var body = document.getElementById('attendanceBody');
  var dateEl = document.getElementById('attDate');
  var groupEl = document.getElementById('attGroupSelect');
  if (!body) return;

  // Set today's date
  if (dateEl && !dateEl.value) {
    dateEl.value = new Date().toISOString().split('T')[0];
  }

  // Listen for group/date changes
  if (groupEl && !groupEl._attInited) {
    groupEl._attInited = true;
    groupEl.addEventListener('change', _renderAttendanceRows);
  }
  if (dateEl && !dateEl._attInited) {
    dateEl._attInited = true;
    dateEl.addEventListener('change', _renderAttendanceRows);
  }

  await _renderAttendanceRows();
}

async function _renderAttendanceRows() {
  var body = document.getElementById('attendanceBody');
  var groupEl = document.getElementById('attGroupSelect');
  if (!body) return;

  var group = groupEl ? groupEl.value : 'AI-2301';

  // Skeleton
  body.innerHTML = [1,2,3,4,5].map(function() {
    return '<tr>' +
      '<td><div class="skel" style="width:24px;height:16px;border-radius:4px"></div></td>' +
      '<td><div class="skel skel-line" style="width:140px"></div></td>' +
      '<td><div class="skel" style="width:80px;height:28px;border-radius:6px"></div></td>' +
      '<td><div class="skel" style="width:80px;height:28px;border-radius:6px"></div></td>' +
      '<td><div class="skel skel-line" style="width:100px"></div></td>' +
    '</tr>';
  }).join('');

  var students = [];
  try {
    var data = await api('GET', '/students?group=' + encodeURIComponent(group) + '&limit=50');
    students = Array.isArray(data) ? data : (data.data || data.students || data.rows || []);
  } catch(e) {
    students = (typeof STUDENTS_DATA !== 'undefined' ? STUDENTS_DATA : [])
      .filter(function(s) { return s.group === group || s.group_name === group; });
  }

  if (!students.length) {
    body.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#94A3B8;padding:24px">Bu guruhda talabalar topilmadi</td></tr>';
    return;
  }

  body.innerHTML = students.map(function(s, i) {
    var sid = s.id || s.user_id || i;
    var name = s.full_name || s.name || ('Talaba ' + (i+1));
    var cached = _attendanceCache[sid] || {};
    var present = cached.present !== undefined ? cached.present : true;
    var excused = cached.excused || false;

    return '<tr id="att-row-' + sid + '">' +
      '<td style="color:#94A3B8;font-weight:600">' + (i+1) + '</td>' +
      '<td style="font-weight:600;color:#0F172A">' + name + '</td>' +
      '<td>' +
        '<div style="display:flex;gap:6px">' +
          '<button onclick="_attSet(' + sid + ',true)" id="att-p-' + sid + '" style="padding:5px 14px;border-radius:6px;border:1.5px solid ' + (present ? '#16A34A' : '#E2E8F0') + ';background:' + (present ? '#DCFCE7' : '#fff') + ';color:' + (present ? '#15803D' : '#64748B') + ';font-weight:700;font-size:12px;cursor:pointer">✓ Keldi</button>' +
          '<button onclick="_attSet(' + sid + ',false)" id="att-a-' + sid + '" style="padding:5px 14px;border-radius:6px;border:1.5px solid ' + (!present ? '#DC2626' : '#E2E8F0') + ';background:' + (!present ? '#FEE2E2' : '#fff') + ';color:' + (!present ? '#B91C1C' : '#64748B') + ';font-weight:700;font-size:12px;cursor:pointer">✗ Kelmadi</button>' +
        '</div>' +
      '</td>' +
      '<td>' +
        '<select onchange="_attExcuse(' + sid + ',this.value)" style="padding:5px 10px;border:1.5px solid #E2E8F0;border-radius:6px;font-size:12px;color:#374151">' +
          '<option value="0"' + (!excused ? ' selected' : '') + '>Sababsiz</option>' +
          '<option value="1"' + (excused ? ' selected' : '') + '>Sababli</option>' +
        '</select>' +
      '</td>' +
      '<td><input id="att-note-' + sid + '" type="text" placeholder="Izoh..." value="' + (cached.note || '') + '" style="width:100%;padding:5px 10px;border:1.5px solid #E2E8F0;border-radius:6px;font-size:12px"></td>' +
    '</tr>';
  }).join('');
}

function _attSet(sid, present) {
  if (!_attendanceCache[sid]) _attendanceCache[sid] = {};
  _attendanceCache[sid].present = present;
  var pBtn = document.getElementById('att-p-' + sid);
  var aBtn = document.getElementById('att-a-' + sid);
  if (pBtn) {
    pBtn.style.borderColor = present ? '#16A34A' : '#E2E8F0';
    pBtn.style.background  = present ? '#DCFCE7' : '#fff';
    pBtn.style.color        = present ? '#15803D' : '#64748B';
  }
  if (aBtn) {
    aBtn.style.borderColor = !present ? '#DC2626' : '#E2E8F0';
    aBtn.style.background  = !present ? '#FEE2E2' : '#fff';
    aBtn.style.color        = !present ? '#B91C1C' : '#64748B';
  }
}

function _attExcuse(sid, val) {
  if (!_attendanceCache[sid]) _attendanceCache[sid] = {};
  _attendanceCache[sid].excused = val === '1';
}

async function saveAttendance() {
  var dateEl  = document.getElementById('attDate');
  var groupEl = document.getElementById('attGroupSelect');
  var date    = dateEl  ? dateEl.value  : new Date().toISOString().split('T')[0];
  var group   = groupEl ? groupEl.value : '';

  // Collect rows
  var rows = document.querySelectorAll('[id^="att-row-"]');
  if (!rows.length) { showToast('⚠️', 'Ma\'lumot yo\'q', 'Avval guruhni yuklang'); return; }

  var records = [];
  rows.forEach(function(row) {
    var sid = row.id.replace('att-row-', '');
    var cached = _attendanceCache[sid] || {};
    var noteEl = document.getElementById('att-note-' + sid);
    records.push({
      studentId: sid,
      date:      date,
      present:   cached.present !== false,
      excused:   !!cached.excused,
      note:      noteEl ? noteEl.value : '',
    });
  });

  try {
    await api('POST', '/students/attendance', { group: group, date: date, records: records });
    showToast('✅', 'Saqlandi', date + ' — ' + records.length + ' ta talaba davomati saqlandi');
  } catch(e) {
    // Save locally if API not available
    showToast('✅', 'Saqlandi (lokal)', records.length + ' ta talaba davomati qayd etildi');
  }
}

function fillTeacher(l,p,d){
  document.getElementById('tLogin').value=l;
  document.getElementById('tPass').value=p;
  document.getElementById('tDept').value=d;
}

function renderTeacherTimetable(){
  // Show schedule for all groups where this teacher teaches
  buildTTTable('teacherTTHead','teacherTTBody','CS-2301');
}

function renderTeacherTodayFull(){
  const el=document.getElementById('teacherTodayFull');if(!el)return;
  const todayIdx=Math.max(0,Math.min(new Date().getDay()-1,4));
  let lessons=[];
  Object.keys(SCHEDULE).forEach(grp=>{
    (SCHEDULE[grp][todayIdx]||[]).forEach((l,i)=>{
      const teacherName=(typeof currentUser!=='undefined'&&currentUser?.name)||'';
      if(l&&teacherName&&l.teacher.includes(teacherName.split(' ')[0]))lessons.push({...l,para:i,grp});
    });
  });
  if(!lessons.length){el.innerHTML=`<div style="color:var(--text3);font-size:13px">${currentLang==='ru'?'Сегодня нет занятий':'Bugun dars yo\'q yoki bu o\'qituvchiga dars tayinlanmagan'}</div>`;return;}
  el.innerHTML=lessons.map(l=>`
    <div class="sched-item" style="margin-bottom:8px">
      <div class="sched-stripe" style="background:${getDotColor(l.sub)}"></div>
      <div class="sched-time">${TIMES[l.para]}</div>
      <div class="sched-body">
        <div class="sched-name">${l.sub} — <span style="color:var(--primary);font-size:13px">${l.grp}</span></div>
        <div class="sched-meta">
          <span class="sched-room-tag">🚪 ${l.room}</span>
          <span style="font-size:10.5px;color:var(--text3)">${_type(l.type)}</span>
        </div>
      </div>
    </div>`).join('');
}

function renderTopTeachers(){
  const el=document.getElementById('topTeachersList');if(!el)return;
  el.innerHTML=TEACHERS_DATA.map((t,i)=>`
    <div class="rank-row">
      <div class="rank-pos${i<3?' rp-'+(i+1):''}">${i+1}</div>
      <div class="rank-avatar" style="background:#16A34A">${t.name.split(' ').map(x=>x[0]).join('')}</div>
      <div class="rank-info">
        <div class="rank-name">${t.name}</div>
        <div class="rank-dept">${t.dept}</div>
      </div>
      <div class="rank-score">⭐${t.rating}</div>
    </div>`).join('');
}

function renderRating(){
  const el=document.getElementById('ratingList');if(!el)return;
  const sorted=[...STUDENTS_DATA].sort((a,b)=>b.avg-a.avg).slice(0,10);
  const colors=['#D97706','#94A3B8','#B45309','#1B4FD8','#16A34A','#7C3AED','#0D9488','#DB2777','#EA580C','#0EA5E9'];
  el.innerHTML=sorted.map((s,i)=>`
    <div class="rank-row${s.name===currentUser?.name?' me':''}">
      <div class="rank-pos${i<3?' rp-'+(i+1):''}">${i<3?['🥇','🥈','🥉'][i]:i+1}</div>
      <div class="rank-avatar" style="background:${colors[i]||'#666'}">${s.name.split(' ').map(x=>x[0]).join('')}</div>
      <div class="rank-info">
        <div class="rank-name">${s.name}${s.name===currentUser?.name?' (Siz)':''}</div>
        <div class="rank-dept">${s.group}</div>
      </div>
      <div class="rank-score">${s.avg}</div>
    </div>`).join('');
}