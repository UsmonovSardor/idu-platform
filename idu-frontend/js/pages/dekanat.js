'use strict';
// IDU Platform — pages/dekanat.js
// Dekanat paneli: barcha malumotlar real API dan olinadi

let _dekStudentPage = 1;
let _dekStudentSearch = '';
let _allDekQuestions = [];
let _editingQId = null;
let _currentQFilter = 'all';
var SUBJ_LABELS = {algo:'💻 Algo', ai:'🤖 AI', math:'📐 Math', db:'🗄️ DB', web:'🌐 Web'};
var TYPE_LABELS = {test:'🧪 Test', real:'📋 Sesiya', both:'📝 Ikkalasi'};

// ── Subjects: dynamic load & management ──────────────────────────────────────
var _subjects = []; // cached from API

// Hardcoded fallback subjects (used if DB subjects table not yet created)
var _FALLBACK_SUBJECTS = [
  {id:1, code:'algo', label:'Algoritmlar va Dasturlash', icon:'💻'},
  {id:2, code:'ai',   label:"Sun'iy Intellekt",          icon:'🤖'},
  {id:3, code:'math', label:'Matematika',                icon:'📐'},
  {id:4, code:'db',   label:"Ma'lumotlar Bazasi",        icon:'🗄️'},
  {id:5, code:'web',  label:'Web Texnologiya',           icon:'🌐'},
];

async function loadSubjects(force) {
  if (_subjects.length && !force) return _subjects;
  try {
    const rows = await api('GET', '/subjects');
    // Only use fallback if API completely fails (not if it returns fewer items)
    _subjects = Array.isArray(rows) ? rows : _FALLBACK_SUBJECTS;
    // First-time load: if DB table empty, seed with fallback but don't overwrite if > 0
    if (_subjects.length === 0) _subjects = _FALLBACK_SUBJECTS.slice();
  } catch(e) {
    console.warn('loadSubjects: API xato, fallback ishlatilmoqda');
    if (!_subjects.length) _subjects = _FALLBACK_SUBJECTS.slice();
  }
  _rebuildSubjHelpers();
  return _subjects;
}

function _rebuildSubjHelpers() {
  SUBJ_LABELS = {};
  _subjects.forEach(function(s) { SUBJ_LABELS[s.code] = s.icon + ' ' + s.label; });
  _fillSubjectDropdowns();
}

function _fillSubjectDropdowns() {
  // Fill <select> dropdowns
  var ids = ['pdfSubject','qModalSubject','gradeSubjectFilter','dekGradeSubject'];
  ids.forEach(function(id) {
    var sel = document.getElementById(id);
    if (!sel) return;
    var cur = sel.value;
    sel.innerHTML = _subjects.map(function(s) {
      return '<option value="'+s.code+'">'+ s.icon +' '+ s.label +'</option>';
    }).join('');
    if (cur && _subjects.find(function(s){return s.code===cur;})) sel.value = cur;
  });

  // Fill filter chips in questions page
  var chipsEl = document.getElementById('qf-subjects-chips');
  if (chipsEl) {
    chipsEl.innerHTML = _subjects.map(function(s) {
      return '<button class="filter-chip" onclick="filterQs(\''+s.code+'\',this)">'+s.icon+' '+s.label.split(' ')[0]+'</button>';
    }).join('');
  }
}

function openSubjectsManager() {
  var existing = document.getElementById('subjectsMgrModal');
  if (existing) { existing.style.display='flex'; _renderSubjectsList(); return; }

  var modal = document.createElement('div');
  modal.id = 'subjectsMgrModal';
  modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:4000;display:flex;align-items:center;justify-content:center';
  modal.onclick = function(e){ if(e.target===modal) modal.style.display='none'; };
  modal.innerHTML = `
    <div style="background:white;border-radius:18px;padding:28px;width:500px;max-width:95vw;max-height:85vh;overflow-y:auto">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
        <div style="font-size:18px;font-weight:800;color:#0F172A">📚 Fanlarni boshqarish</div>
        <button onclick="document.getElementById('subjectsMgrModal').style.display='none'" style="background:none;border:none;font-size:20px;cursor:pointer;color:#94A3B8">✕</button>
      </div>
      <div id="subjectsList" style="margin-bottom:16px"></div>
      <div style="border-top:1.5px solid #E2E8F0;padding-top:16px">
        <div style="font-size:13px;font-weight:700;color:#1E293B;margin-bottom:10px">➕ Yangi fan qo'shish</div>
        <div style="display:grid;grid-template-columns:80px 1fr 60px;gap:8px;margin-bottom:8px">
          <input id="newSubjIcon"  placeholder="Emoji" value="📚" style="padding:9px;border:1.5px solid #E2E8F0;border-radius:8px;font-size:16px;text-align:center;outline:none">
          <input id="newSubjLabel" placeholder="Fan nomi (masalan: Fizika)" style="padding:9px;border:1.5px solid #E2E8F0;border-radius:8px;font-size:13px;outline:none">
          <input id="newSubjCode"  placeholder="kod" style="padding:9px;border:1.5px solid #E2E8F0;border-radius:8px;font-size:12px;outline:none">
        </div>
        <div style="font-size:11px;color:#94A3B8;margin-bottom:10px">Kod: faqat kichik harf va _ (masalan: fizika, chizmachilik)</div>
        <button onclick="addNewSubject()" style="width:100%;padding:11px;background:linear-gradient(135deg,#1B4FD8,#3B82F6);color:white;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;font-family:'Outfit',sans-serif">➕ Qo'shish</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  _renderSubjectsList();
}

async function _renderSubjectsList() {
  await loadSubjects(true);
  var list = document.getElementById('subjectsList');
  if (!list) return;
  if (!_subjects.length) { list.innerHTML='<div style="text-align:center;color:#94A3B8;padding:20px">Fanlar yo\'q</div>'; return; }
  list.innerHTML = _subjects.map(function(s) {
    return `<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:#F8FAFC;border-radius:10px;margin-bottom:8px">
      <span style="font-size:20px">${s.icon}</span>
      <div style="flex:1">
        <div style="font-weight:700;font-size:13px;color:#0F172A">${s.label}</div>
        <div style="font-size:11px;color:#94A3B8">kod: <code>${s.code}</code></div>
      </div>
      <button onclick="editSubject(${s.id},'${s.code}','${s.label.replace(/'/g,"\\'")}','${s.icon}')"
        style="padding:5px 10px;background:#EEF3FF;border:none;border-radius:6px;color:#1B4FD8;font-size:12px;cursor:pointer">✏️</button>
      <button onclick="deleteSubject(${s.id},'${s.label.replace(/'/g,"\\'")}')"
        style="padding:5px 10px;background:#FEE2E2;border:none;border-radius:6px;color:#DC2626;font-size:12px;cursor:pointer">🗑️</button>
    </div>`;
  }).join('');
}

async function addNewSubject() {
  var icon  = (document.getElementById('newSubjIcon')?.value || '📚').trim();
  var label = (document.getElementById('newSubjLabel')?.value || '').trim();
  var code  = (document.getElementById('newSubjCode')?.value || '').trim().toLowerCase();
  if (!label) { showToast('⚠️','Xato','Fan nomini kiriting'); return; }
  if (!code)  { code = label.toLowerCase().replace(/[^a-z0-9]/g,'_').replace(/__+/g,'_').slice(0,20); }
  try {
    const created = await api('POST', '/subjects', { code, label, icon });
    document.getElementById('newSubjLabel').value='';
    document.getElementById('newSubjCode').value='';
    document.getElementById('newSubjIcon').value='📚';
    // Add to local cache immediately; avoid full re-fetch
    if (created && created.id) {
      // Remove duplicate (same code) then add fresh
      _subjects = _subjects.filter(function(s){ return s.code !== created.code; });
      _subjects.push({ id: created.id, code: created.code, label: created.label, icon: created.icon, sort_order: created.sort_order || 99 });
    }
    _rebuildSubjHelpers();
    await _renderSubjectsList(); // still re-render modal to show updated list
    showToast('✅','Qo\'shildi', label + ' qo\'shildi');
  } catch(e) { showToast('❌','Xato', e.message); }
}

async function editSubject(id, code, label, icon) {
  var newLabel = prompt('Fan nomini o\'zgartiring:', label);
  if (!newLabel || newLabel.trim()===label) return;
  var newIcon  = prompt('Emoji:', icon) || icon;
  try {
    const updated = await api('PUT', '/subjects/'+id, { label: newLabel.trim(), icon: newIcon });
    // Update in local cache immediately
    _subjects = _subjects.map(function(s) {
      return s.id === id ? Object.assign({}, s, { label: updated.label || newLabel.trim(), icon: updated.icon || newIcon }) : s;
    });
    _rebuildSubjHelpers();
    await _renderSubjectsList();
    showToast('✅','Yangilandi', newLabel);
  } catch(e) { showToast('❌','Xato', e.message); }
}

async function deleteSubject(id, label) {
  if (!confirm('"'+label+'" fanini o\'chirmoqchimisiz?\nBu fandagi savollar o\'chib ketmaydi.')) return;
  try {
    await api('DELETE', '/subjects/'+id);
    // Remove immediately from local cache — no re-fetch to avoid fallback race
    _subjects = _subjects.filter(function(s) { return s.id !== id; });
    _rebuildSubjHelpers();
    // Re-draw the modal list without hitting the API again
    var list = document.getElementById('subjectsList');
    if (list) {
      if (!_subjects.length) {
        list.innerHTML = '<div style="text-align:center;color:#94A3B8;padding:20px">Fanlar yo\'q</div>';
      } else {
        list.innerHTML = _subjects.map(function(s) {
          return '<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:#F8FAFC;border-radius:10px;margin-bottom:8px">'
            + '<span style="font-size:20px">'+s.icon+'</span>'
            + '<div style="flex:1">'
            +   '<div style="font-weight:700;font-size:13px;color:#0F172A">'+escHtml(s.label)+'</div>'
            +   '<div style="font-size:11px;color:#94A3B8">kod: <code>'+s.code+'</code></div>'
            + '</div>'
            + '<button onclick="editSubject('+s.id+',\''+s.code+'\',\''+s.label.replace(/\\/g,'\\\\').replace(/'/g,"\\'")+'\',\''+s.icon+'\')" style="padding:5px 10px;background:#EEF3FF;border:none;border-radius:6px;color:#1B4FD8;font-size:12px;cursor:pointer">✏️</button>'
            + '<button onclick="deleteSubject('+s.id+',\''+s.label.replace(/\\/g,'\\\\').replace(/'/g,"\\'")+'\' )" style="padding:5px 10px;background:#FEE2E2;border:none;border-radius:6px;color:#DC2626;font-size:12px;cursor:pointer">🗑️</button>'
            + '</div>';
        }).join('');
      }
    }
    showToast('🗑️','O\'chirildi', label);
  } catch(e) { showToast('❌','Xato', e.message); }
}

async function renderDekanatDashboard() {
  // Fetch all data in parallel
  const [allStudents, teachers, attStats, grades] = await Promise.all([
    window.IDU ? window.IDU.getAllStudents() : api('GET','/students?limit=500').then(function(r){return r.data||r;}).catch(function(){return [];}),
    api('GET','/teachers?limit=200').then(function(r){return Array.isArray(r)?r:(r.data||[]);}).catch(function(){return [];}),
    api('GET','/attendance/stats').then(function(r){return Array.isArray(r)?r:(r.data||[]);}).catch(function(){return [];}),
    api('GET','/grades?limit=1000').then(function(r){return Array.isArray(r)?r:(r.data||[]);}).catch(function(){return [];})
  ]);

  // Compute groups
  const groupsSet = new Set();
  allStudents.forEach(function(s){
    var g = s.group_name || s.group;
    if (g) groupsSet.add(g);
  });
  const totalGroups = groupsSet.size;

  // Compute at-risk
  const avgs = {};
  grades.forEach(function(g){
    var id = g.student_id;
    if (!avgs[id]) avgs[id] = {sum:0, count:0};
    avgs[id].sum += parseFloat(g.score) || 0;
    avgs[id].count++;
  });
  const atRisk = allStudents.filter(function(s){
    var st = avgs[s.id];
    return st && st.count && (st.sum/st.count) < 56;
  });

  // Attendance avg
  const attPcts = attStats.map(function(a){return parseFloat(a.attendance_pct)||0;}).filter(function(x){return x>0;});
  const avgAtt = attPcts.length ? Math.round(attPcts.reduce(function(a,b){return a+b;},0)/attPcts.length) : 0;

  // Subjects: use IDU.getSubjects() or count distinct from grades
  const subjSet = new Set();
  grades.forEach(function(g){ if(g.subject) subjSet.add(g.subject); });
  const totalSubjects = subjSet.size || (window.IDU ? window.IDU.getSubjects().length : 5);

  // ── Update DOM ──
  function setVal(id, val){ var el = document.getElementById(id); if(el) el.textContent = val; }

  // Hero banner
  setVal('dek-hb-students',   allStudents.length);
  setVal('dek-hb-teachers',   teachers.length);
  setVal('dek-hb-subjects',   totalSubjects);
  setVal('dek-hb-attendance', avgAtt ? avgAtt + '%' : '—');

  // Stat cards
  setVal('dekStatStudents',   allStudents.length);
  setVal('dekStatTeachers',   teachers.length);
  setVal('dekStatGroups',     totalGroups);
  setVal('dekStatAtRisk',     atRisk.length);
  setVal('dekStatGroupsSub',  totalGroups ? totalGroups + ' ta faol' : 'Yo\'q');
  setVal('dekStatAtRiskSub',  atRisk.length ? 'Darhol diqqat' : 'Hammasi yaxshi');

  // Optional applications badge (if element exists)
  api('GET', '/applications?status=pending&limit=100').then(function(apps){
    var n = Array.isArray(apps) ? apps.length : 0;
    setVal('dekStatApps', n);
    var badge = document.getElementById('dekAppBadge');
    if (badge) badge.textContent = n ? n : '';
  }).catch(function(){});

  await renderGroupRanking();
  await renderAtRiskFromApi();
}

async function renderGroupRanking() {
  const el = document.getElementById('groupRankingList');
  if (!el) return;
  if (window.IDU) window.IDU.showLoading(el, 'rows', 4);
  try {
    const [students, grades] = await Promise.all([
      window.IDU ? window.IDU.getAllStudents() : api('GET','/students?limit=500').then(function(r){return r.data||r;}),
      api('GET','/grades?limit=1000').then(function(r){return Array.isArray(r)?r:(r.data||[]);}).catch(function(){return [];})
    ]);

    // Map student → group
    const stuGroup = {};
    students.forEach(function(s){ stuGroup[s.id] = s.group_name || s.group; });

    // Aggregate by group
    const grpStats = {};
    grades.forEach(function(g){
      var grp = stuGroup[g.student_id];
      if (!grp) return;
      if (!grpStats[grp]) grpStats[grp] = {sum:0, count:0};
      grpStats[grp].sum += parseFloat(g.score) || 0;
      grpStats[grp].count++;
    });

    const ranked = Object.keys(grpStats).map(function(grp){
      return { group: grp, avg: grpStats[grp].count ? grpStats[grp].sum/grpStats[grp].count : 0, count: grpStats[grp].count };
    }).filter(function(r){return r.count>0;}).sort(function(a,b){return b.avg-a.avg;});

    if (!ranked.length) {
      if (window.IDU) window.IDU.showEmpty(el, {icon:'📊', title:'Reyting yo\'q', desc:'Hali baholar kiritilmagan'});
      else el.innerHTML = '<div style="text-align:center;padding:24px;color:#94A3B8">Hali natijalar yo\'q</div>';
      return;
    }

    el.innerHTML = ranked.slice(0,6).map(function(r, i){
      var medal = i===0?'🥇':i===1?'🥈':i===2?'🥉':(i+1)+'.';
      var c = r.avg>=86?'#16A34A':r.avg>=71?'#0891B2':r.avg>=56?'#D97706':'#DC2626';
      return '<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-bottom:1px solid #F1F5F9">' +
        '<div style="width:30px;font-size:'+(i<3?'18px':'13px')+';text-align:center;font-weight:800;color:#94A3B8">'+medal+'</div>' +
        '<div style="flex:1"><div style="font-weight:700;font-size:13px;color:#1E293B">'+r.group+'</div>' +
        '<div style="font-size:11px;color:#94A3B8">'+r.count+' ta baho</div></div>' +
        '<div style="background:'+c+'22;color:'+c+';font-weight:800;font-size:13px;padding:4px 12px;border-radius:14px">'+r.avg.toFixed(1)+'</div>' +
      '</div>';
    }).join('');
  } catch (e) {
    if (window.IDU) window.IDU.showError(el, e.message);
    else el.innerHTML = '<div style="padding:12px;color:#DC2626">'+e.message+'</div>';
  }
}

async function renderAtRiskFromApi() {
  const el = document.getElementById('atRiskStudents') || document.getElementById('topTeachersList');
  if (!el) return;
  if (window.IDU) window.IDU.showLoading(el, 'rows', 3);

  try {
    const [students, grades] = await Promise.all([
      window.IDU ? window.IDU.getAllStudents() : api('GET','/students?limit=500').then(function(r){return r.data||r;}),
      api('GET','/grades?limit=1000').then(function(r){return Array.isArray(r)?r:(r.data||[]);}).catch(function(){return [];})
    ]);

    const avgs = {};
    grades.forEach(function(g){
      var id = g.student_id;
      if (!avgs[id]) avgs[id] = {sum:0,count:0};
      avgs[id].sum += parseFloat(g.score) || 0;
      avgs[id].count++;
    });

    const risk = students.map(function(s){
      var st = avgs[s.id];
      return { stu: s, avg: st && st.count ? st.sum/st.count : 0, hasGrades: !!(st && st.count) };
    }).filter(function(r){return r.hasGrades && r.avg < 56;})
      .sort(function(a,b){return a.avg-b.avg;});

    if (!risk.length) {
      if (window.IDU) window.IDU.showEmpty(el, {icon:'✅', title:'Xavf guruhi yo\'q', desc:'Barcha talabalar yetarli ball to\'pladi'});
      else el.innerHTML = '<div style="padding:12px;color:#16A34A;font-size:13px">✅ Hech kim xavf guruhida emas</div>';
      return;
    }

    el.innerHTML = risk.slice(0,6).map(function(r){
      var s = r.stu;
      var initials = (s.full_name||'?').split(' ').map(function(x){return x[0];}).join('').substring(0,2);
      return '<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-bottom:1px solid #F1F5F9">' +
        '<div style="width:36px;height:36px;border-radius:50%;background:#FEE2E2;color:#DC2626;font-weight:800;font-size:13px;display:flex;align-items:center;justify-content:center;flex-shrink:0">'+initials+'</div>' +
        '<div style="flex:1;min-width:0"><div style="font-weight:700;font-size:13px;color:#1E293B;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+(s.full_name||'Noma\'lum')+'</div>' +
        '<div style="font-size:11px;color:#94A3B8">'+(s.group_name||s.group||'—')+'</div></div>' +
        '<div style="background:#FEE2E2;color:#DC2626;font-weight:800;font-size:12px;padding:4px 10px;border-radius:14px">'+r.avg.toFixed(1)+'</div>' +
      '</div>';
    }).join('');
  } catch (e) {
    if (window.IDU) window.IDU.showError(el, e.message);
  }
}

async function renderDekanatStudents() {
  const el = document.getElementById('dekanatStudentBody');
  if (!el) return;
  el.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:20px">⏳ Yuklanmoqda...</td></tr>';
  try {
    const search = document.getElementById('studentSearch')?.value || '';
    const params = new URLSearchParams({ limit: 20, page: _dekStudentPage });
    if (search) params.append('search', search);
    const data = await api('GET', '/students?' + params.toString());
    const students = data.data || [];
    if (!students.length) { el.innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--text3);padding:20px">Talaba topilmadi</td></tr>'; return; }
    el.innerHTML = students.map((s, i) => '<tr><td>' + ((_dekStudentPage-1)*20+i+1) + '</td><td><div style="display:flex;align-items:center;gap:8px"><div class="dt-avatar" style="background:#1B4FD8">' + (s.full_name||'?').split(' ').map(x=>x[0]).join('').substring(0,2) + '</div><div><div style="font-weight:600">' + (s.full_name||'—') + '</div><div style="font-size:11px;color:var(--text3)">' + (s.student_id_number||'') + '</div></div></div></td><td><span class="card-badge cb-blue">' + (s.faculty||'—') + '</span></td><td>' + (s.year_of_study ? s.year_of_study+'-kurs':'—') + '</td><td><span class="font-mono">' + (s.gpa||'0.00') + '</span></td><td>—</td><td>—</td><td>—</td><td><button class="btn btn-secondary btn-sm" onclick="openStudentDetail(' + s.id + ')">📋</button></td></tr>').join('');
  } catch(e) { el.innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--red);padding:20px">Xato: ' + e.message + '</td></tr>'; }
}

function filterStudents() { _dekStudentPage = 1; renderDekanatStudents(); }
function dekStudentPage(page) { _dekStudentPage = Math.max(1,page); renderDekanatStudents(); }

async function openStudentDetail(id) {
  try {
    const s = await api('GET', '/students/' + id);
    const grades = await api('GET', '/students/' + id + '/grades');
    const modal = document.getElementById('studentDetailModal');
    if (!modal) return;
    document.getElementById('studentDetailTitle').textContent = s.full_name || 'Talaba';
    document.getElementById('studentDetailContent').innerHTML = '<div style="padding:12px;font-size:13px"><strong>' + (s.full_name||'—') + '</strong><br>' + (s.faculty||'—') + ' · ' + (s.year_of_study||'?') + '-kurs</div>' + (grades.length ? '<table class="grade-table"><thead><tr><th>Fan</th><th>JN</th><th>ON</th><th>YN</th><th>MI</th><th>Jami</th><th>Baho</th></tr></thead><tbody>' + grades.map(g => '<tr><td>' + (g.course_name||'—') + '</td><td>' + (g.jn||0) + '</td><td>' + (g.on_score||0) + '</td><td>' + (g.yn||0) + '</td><td>' + (g.mi||0) + '</td><td><strong>' + (g.total||0) + '</strong></td><td>' + (g.letter_grade||'—') + '</td></tr>').join('') + '</tbody></table>' : '<div style="text-align:center;padding:20px;color:var(--text3)">Baholar kiritilmagan</div>');
    modal.classList.add('open');
  } catch(e) { showToast('❌','Xato',e.message); }
}

async function renderDekanatQuestions() {
  await loadSubjects();          // fill dropdowns + filter chips
  await _updateQStats();
  await _renderQTable(_currentQFilter || 'all');
  await loadDekanatQuestions();  // sync student/teacher exam engine
}

async function _updateQStats() {
  try {
    const all = await api('GET', '/questions?limit=200');
    _allDekQuestions = Array.isArray(all) ? all : [];
    const total = _allDekQuestions.length;
    const e1=document.getElementById('qStatTotal'); if(e1)e1.textContent=total;
    const e2=document.getElementById('qStatTest'); if(e2)e2.textContent=_allDekQuestions.filter(q=>q.type==='test'||q.type==='both').length;
    const e3=document.getElementById('qStatReal'); if(e3)e3.textContent=_allDekQuestions.filter(q=>q.type==='real'||q.type==='both').length;
    const e4=document.getElementById('qStatSubjects'); if(e4)e4.textContent=[...new Set(_allDekQuestions.map(q=>q.subject))].length;
  } catch(e) {}
}

async function _renderQTable(filter) {
  const tbody = document.getElementById('questionsTableBody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px">⏳ Yuklanmoqda...</td></tr>';
  try {
    let url = '/questions?limit=100';
    if (filter==='test') url+='&type=test';
    else if (filter==='real') url+='&type=real';
    else if (['algo','ai','math','db','web'].includes(filter)) url+='&subject='+filter;
    const qs = await api('GET', url);
    if (!qs.length) { tbody.innerHTML='<tr><td colspan="6" style="text-align:center;color:var(--text3);padding:40px">Hali savol kiritilmagan</td></tr>'; return; }
    const opts = ['option_a','option_b','option_c','option_d'];
    tbody.innerHTML = qs.map((q,i) => '<tr><td><strong>'+(i+1)+'</strong></td><td><span style="padding:3px 8px;background:#EEF3FF;border-radius:6px;font-size:11.5px;font-weight:700;color:#1B4FD8">'+(SUBJ_LABELS[q.subject]||q.subject)+'</span></td><td><span style="padding:3px 8px;border-radius:6px;font-size:11.5px;font-weight:700;background:'+(q.type==='test'?'#DCFCE7':q.type==='real'?'#FEE2E2':'#F3E8FF')+';color:'+(q.type==='test'?'#16A34A':q.type==='real'?'#DC2626':'#7C3AED')+'">'+(TYPE_LABELS[q.type]||q.type)+'</span></td><td><div style="font-weight:600;font-size:13px">'+q.question_text.substring(0,80)+(q.question_text.length>80?'...':'')+'</div></td><td style="font-size:12px;color:#16A34A;font-weight:600">'+q.correct_option+'</td><td><div style="display:flex;gap:5px"><button onclick="editQuestion('+q.id+')" style="padding:5px 10px;background:#EEF3FF;border:none;border-radius:6px;color:#1B4FD8;font-size:12px;cursor:pointer">✏️</button><button onclick="deleteQuestion('+q.id+')" style="padding:5px 10px;background:#FEE2E2;border:none;border-radius:6px;color:#DC2626;font-size:12px;cursor:pointer">🗑️</button></div></td></tr>').join('');
  } catch(e) { tbody.innerHTML='<tr><td colspan="6" style="text-align:center;color:var(--red);padding:20px">Xato: '+e.message+'</td></tr>'; }
}

async function deleteQuestion(id) {
  if (!confirm('Bu savolni ochirmoqchimisiz?')) return;
  try { await api('DELETE', '/questions/'+id); showToast('🗑️','Ochirildi','Savol ochirildi'); renderDekanatQuestions(); }
  catch(e) { showToast('❌','Xato',e.message); }
}

async function editQuestion(id) {
  const q = _allDekQuestions.find(x=>x.id===id);
  if (!q) return;
  _editingQId = id;
  const subj=document.getElementById('qModalSubject'); if(subj)subj.value=q.subject;
  const type=document.getElementById('qModalType'); if(type)type.value=q.type;
  const text=document.getElementById('qModalText'); if(text)text.value=q.question_text;
  const a=document.getElementById('qOpt0'); if(a)a.value=q.option_a;
  const b=document.getElementById('qOpt1'); if(b)b.value=q.option_b;
  const c=document.getElementById('qOpt2'); if(c)c.value=q.option_c;
  const d=document.getElementById('qOpt3'); if(d)d.value=q.option_d;
  const idx = ['A','B','C','D'].indexOf(q.correct_option);
  if (idx>=0) { const r=document.querySelector('input[name="qModalCorrect"][value="'+idx+'"]'); if(r)r.checked=true; }
  const izoh=document.getElementById('qModalIzoh'); if(izoh)izoh.value=q.explanation||'';
  document.getElementById('addQuestionModal').style.display='flex';
}

async function openAddQuestionModal() {
  _editingQId = null;
  ['qModalText','qOpt0','qOpt1','qOpt2','qOpt3','qModalIzoh'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  const type=document.getElementById('qModalType'); if(type)type.value='test';
  const r=document.querySelector('input[name="qModalCorrect"][value="0"]'); if(r)r.checked=true;
  document.getElementById('addQuestionModal').style.display='flex';
  // Load subjects from DB to fill dropdown
  await loadSubjects();
  const subj=document.getElementById('qModalSubject');
  if(subj && subj.options.length) subj.selectedIndex=0;
}

async function saveQuestionModal() {
  const subject=document.getElementById('qModalSubject')?.value;
  const type=document.getElementById('qModalType')?.value;
  const questionText=document.getElementById('qModalText')?.value.trim();
  const optionA=document.getElementById('qOpt0')?.value.trim();
  const optionB=document.getElementById('qOpt1')?.value.trim();
  const optionC=document.getElementById('qOpt2')?.value.trim();
  const optionD=document.getElementById('qOpt3')?.value.trim();
  const corrRadio=document.querySelector('input[name="qModalCorrect"]:checked');
  const correctOption=corrRadio?['A','B','C','D'][parseInt(corrRadio.value)]:'A';
  const explanation=document.getElementById('qModalIzoh')?.value.trim();
  if(!questionText||!optionA||!optionB||!optionC||!optionD){showToast('⚠️','Xato','Barcha maydonlarni toldiring');return;}
  const body={subject,type,questionText,optionA,optionB,optionC,optionD,correctOption,explanation};
  try {
    if(_editingQId){await api('PUT','/questions/'+_editingQId,body);showToast('✅','Yangilandi','Savol yangilandi');}
    else{await api('POST','/questions',body);showToast('✅','Qoshildi','Savol qoshildi');}
    closeQuestionModal();renderDekanatQuestions();
  } catch(e){showToast('❌','Xato',e.message);}
}

function closeQuestionModal(){const m=document.getElementById('addQuestionModal');if(m)m.style.display='none';_editingQId=null;}

async function uploadQuestionsPDF() {
  const subject = document.getElementById('pdfSubject')?.value;
  const type    = document.getElementById('pdfType')?.value;
  const fileInput = document.getElementById('pdfFileInput');
  const file = fileInput?.files[0];
  if (!file)    { showToast('⚠️','Xato','Fayl tanlang'); return; }
  if (!subject) { showToast('⚠️','Xato','Fan tanlang'); return; }
  const btn = document.getElementById('pdfUploadBtn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Yuklanmoqda...'; }

  try {
    const ext = file.name.split('.').pop().toLowerCase();

    if (ext === 'json') {
      const text = await file.text();
      let questions;
      try { questions = JSON.parse(text); } catch(e) { throw new Error('JSON format noto\'g\'ri: ' + e.message); }
      if (!Array.isArray(questions)) throw new Error('JSON massiv (array) bo\'lishi kerak');
      const data = await api('POST', '/questions/import-json', { subject, type: type || 'test', questions });
      showToast('✅', 'JSON yuklandi', data.inserted + ' savol kiritildi');

    } else if (ext === 'txt' || ext === 'csv') {
      const text = await file.text();
      const questions = parseTxtQuestions(text);
      if (!questions.length) throw new Error('Fayl ichida savol topilmadi. Format: "1. Savol? A) ... To\'g\'ri: A"');
      const data = await api('POST', '/questions/import-json', { subject, type: type || 'test', questions });
      showToast('✅', 'TXT yuklandi', data.inserted + ' savol kiritildi');

    } else {
      // PDF, DOCX, DOC, XLSX — server-side processing
      const formData = new FormData();
      formData.append('pdf', file);
      formData.append('subject', subject);
      formData.append('type', type || 'test');
      const token = (typeof _apiToken !== 'undefined' && _apiToken) || localStorage.getItem('idu_jwt');
      const res = await fetch(window.location.origin + '/api/questions/upload-pdf', {
        method: 'POST',
        headers: token ? { 'Authorization': 'Bearer ' + token } : {},
        body: formData
      });
      const data = await res.json();
      if (!res.ok) {
        const hint = data.hint ? '\n\nFormat: ' + data.hint : '';
        const lines = data.extractedLines != null ? ' (' + data.extractedLines + ' qator topildi)' : '';
        const aiNote = data.aiAttempted ? ' (AI ham urinib ko\'rdi)' : '';
        throw new Error((data.error || 'Fayl yuklashda xato') + lines + aiNote + hint);
      }
      const aiTag = data.aiParsed ? ' · 🤖 AI' : '';
      const chTag = (data.chaptersCreated || 0) > 0 ? ' · ' + data.chaptersCreated + ' bob' : '';
      if (data.inserted > 0) {
        showToast('✅', 'Yuklandi', data.inserted + ' savol' + chTag + aiTag + ' saqlandi');
      } else if (data.parsed > 0 && data.inserted === 0) {
        // Parser found questions but none were saved — show the first DB error
        const firstErr = data.errors && data.errors[0] ? data.errors[0].error : 'DB xatosi';
        showToast('❌', 'DB xatosi', data.parsed + ' savol topildi, lekin saqlanmadi. ' + firstErr);
        console.error('[upload-pdf] Insert errors:', data.errors);
        console.error('[upload-pdf] Debug:', data.debug);
      } else {
        // 0 parsed — should have been 422, but just in case
        showToast('⚠️', 'Savol topilmadi', 'PDF formatini tekshiring. ' + (data.debug ? data.debug.rawLines + ' qator o\'qildi' : ''));
        console.warn('[upload-pdf] Response:', data);
      }
    }

    if (fileInput) fileInput.value = '';
    document.getElementById('pdfFileName').textContent = '';
    const pdfModal = document.getElementById('pdfUploadModal');
    if (pdfModal) pdfModal.style.display = 'none';
    renderDekanatQuestions();
  } catch(e) {
    showToast('❌', 'Xato', e.message);
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '📤 Yuklash'; }
  }
}

function parseTxtQuestions(text) {
  const questions = [];
  // Split by question numbers: "1.", "2.", etc.
  const blocks = text.split(/\n(?=\d+[\.\)]\s)/);
  for (const block of blocks) {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
    if (!lines.length) continue;
    // First line is the question (remove leading number)
    const qLine = lines[0].replace(/^\d+[\.\)]\s*/, '').trim();
    if (!qLine) continue;
    let optA='', optB='', optC='', optD='', correct='A', explanation='';
    for (const line of lines.slice(1)) {
      if (/^[Aa][\)\.]/.test(line)) optA = line.replace(/^[Aa][\)\.]\s*/, '');
      else if (/^[Bb][\)\.]/.test(line)) optB = line.replace(/^[Bb][\)\.]\s*/, '');
      else if (/^[Cc][\)\.]/.test(line)) optC = line.replace(/^[Cc][\)\.]\s*/, '');
      else if (/^[Dd][\)\.]/.test(line)) optD = line.replace(/^[Dd][\)\.]\s*/, '');
      else if (/^(To'g'ri|Togri|Answer|Javob|Correct)\s*[:=]/i.test(line)) correct = line.split(/[:=]/)[1].trim().toUpperCase().charAt(0) || 'A';
      else if (/^(Izoh|Explanation|Hint)\s*[:=]/i.test(line)) explanation = line.split(/[:=]/)[1].trim();
    }
    if (!optA && !optB) continue; // skip if no options
    questions.push({ question_text: qLine, option_a: optA, option_b: optB, option_c: optC, option_d: optD, correct_option: correct, explanation });
  }
  return questions;
}

function openPdfUploadModal(){const m=document.getElementById('pdfUploadModal');if(m){m.style.display='flex';loadSubjects();}}
function closePdfUploadModal(){const m=document.getElementById('pdfUploadModal');if(m)m.style.display='none';}

async function toggleExamSession(examType, isOpen) {
  try {
    const closesAt=isOpen?new Date(Date.now()+3*60*60*1000).toISOString():null;
    await api('POST','/exams/session-state',{examType,isOpen,closesAt});
    const stateKey=examType==='sesiya'?'real':'test';
    SESIYA_STATE[stateKey]=isOpen;
    setSesiyaState(stateKey,isOpen);
    showToast(isOpen?'✅':'🔒',examType==='test'?'Test Rejim':'Sesiya',isOpen?'Faollashtirildi (3 soat)':'Qulflandi');
  } catch(e){showToast('❌','Xato',e.message);}
}

async function renderExamResults() {
  const el = document.getElementById('examResultsBody');
  if (!el) return;
  el.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:24px">⏳ Yuklanmoqda...</td></tr>';
  try {
    const examType = document.getElementById('examResultFilter')?.value || '';
    const subject  = document.getElementById('examSubjectFilter')?.value || '';
    let url = '/exams/history?limit=100&';
    if (examType) url += 'examType=' + examType + '&';
    if (subject)  url += 'subject=' + subject;
    const results = await api('GET', url);

    // Summary stats
    const statsEl = document.getElementById('examResultsStats');
    if (statsEl && Array.isArray(results) && results.length) {
      const avg    = Math.round(results.reduce((s, r) => s + (r.score || 0), 0) / results.length);
      const passed = results.filter(r => r.letter_grade && r.letter_grade !== 'F').length;
      const gradeCount = { A:0, B:0, C:0, D:0, F:0 };
      results.forEach(r => { if (r.letter_grade && gradeCount[r.letter_grade] !== undefined) gradeCount[r.letter_grade]++; });
      statsEl.innerHTML =
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;margin-bottom:16px">' +
          _statCard('📊', 'Jami', results.length, '#2563EB') +
          _statCard('✅', 'O\'tdi', passed, '#16A34A') +
          _statCard('❌', 'Qoldi', results.length - passed, '#DC2626') +
          _statCard('📈', "O'rtacha", avg + '%', '#7C3AED') +
          _statCard('🏆', 'A-baho', gradeCount.A, '#16A34A') +
          _statCard('🥈', 'B-baho', gradeCount.B, '#2563EB') +
          _statCard('🥉', 'C-baho', gradeCount.C, '#D97706') +
          _statCard('⚠️', 'D/F', gradeCount.D + gradeCount.F, '#DC2626') +
        '</div>';
    } else if (statsEl) statsEl.innerHTML = '';

    if (!Array.isArray(results) || !results.length) {
      el.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--text3);padding:32px"><div style="font-size:40px;margin-bottom:8px">📭</div><div>Natijalar yo\'q</div></td></tr>';
      return;
    }

    el.innerHTML = results.map((r, i) => {
      const gc  = r.letter_grade === 'A' ? '#16A34A' : r.letter_grade === 'B' ? '#2563EB' : r.letter_grade === 'C' ? '#D97706' : r.letter_grade === 'D' ? '#EA580C' : '#DC2626';
      const pct = r.score || 0;
      const bar = '<div style="width:60px;height:6px;background:#E2E8F0;border-radius:3px;display:inline-block;vertical-align:middle;margin-left:4px">' +
        '<div style="height:100%;width:' + Math.min(100, pct) + '%;background:' + gc + ';border-radius:3px"></div></div>';
      const typeColors = { sesiya:'#7C3AED', real:'#1D4ED8', test:'#0891B2' };
      const typeColor  = typeColors[r.exam_type] || '#475569';
      const subjLabels = { algo:'Algoritmlar', ai:'Sun\'iy intellekt', math:'Matematika', db:'Ma\'lumotlar bazasi', web:'Web texnologiya' };
      return '<tr>' +
        '<td><strong style="color:var(--text3)">' + (i + 1) + '</strong></td>' +
        '<td><div style="font-weight:700;color:var(--text1)">' + (r.student_name || '—') + '</div>' +
          (r.correct_count != null ? '<div style="font-size:11px;color:var(--text3)">' + r.correct_count + '/' + (r.total_count || '?') + ' ta to\'g\'ri</div>' : '') + '</td>' +
        '<td><span style="font-size:11px;background:' + typeColor + '18;color:' + typeColor + ';padding:3px 9px;border-radius:20px;font-weight:700">' + (r.exam_type || '—') + '</span></td>' +
        '<td style="font-size:12px;font-weight:600;color:var(--text2)">' + (subjLabels[r.subject] || r.subject || '—') + '</td>' +
        '<td><strong style="font-family:monospace;font-size:14px">' + pct + '%</strong>' + bar + '</td>' +
        '<td><span style="font-size:16px;font-weight:900;color:' + gc + ';background:' + gc + '15;padding:4px 12px;border-radius:8px">' + (r.letter_grade || '—') + '</span></td>' +
        '<td style="font-size:11px;color:var(--text3)">' + (r.submitted_at ? new Date(r.submitted_at).toLocaleDateString('uz-UZ', { day:'2-digit', month:'2-digit', year:'numeric' }) : '—') + '</td>' +
      '</tr>';
    }).join('');
  } catch(e) {
    el.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--red);padding:24px">❌ Xato: ' + e.message + '</td></tr>';
  }
}

function _statCard(icon, label, value, color) {
  return '<div style="background:#fff;border-radius:12px;padding:12px 14px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,.06);border-top:3px solid ' + color + '">' +
    '<div style="font-size:20px">' + icon + '</div>' +
    '<div style="font-size:18px;font-weight:900;color:' + color + '">' + value + '</div>' +
    '<div style="font-size:11px;color:#64748B;font-weight:600">' + label + '</div>' +
  '</div>';
}

async function renderDekanatApplications() {
  const tbody=document.getElementById('applicationsBody');
  if(!tbody)return;
  tbody.innerHTML='<tr><td colspan="8" style="text-align:center;padding:20px">⏳ Yuklanmoqda...</td></tr>';
  try {
    let url='/applications?limit=50';
    if(currentAppFilter&&currentAppFilter!=='all'){
      if(['cert','job','etiraz','other'].includes(currentAppFilter))url+='&type='+currentAppFilter;
      else if(currentAppFilter==='pending')url+='&status=pending';
    }
    const apps=await api('GET',url);
    const pe=document.getElementById('pendingAppsCount'); if(pe)pe.textContent=Array.isArray(apps)?apps.filter(a=>a.status==='pending').length:0;
    if(!Array.isArray(apps)||!apps.length){tbody.innerHTML='<tr><td colspan="8" style="text-align:center;color:var(--text3);padding:30px">Hali ariza yoq</td></tr>';return;}
    tbody.innerHTML=apps.map(a=>'<tr><td><strong>#'+a.id+'</strong></td><td><div style="font-weight:700">'+(a.student_name||'—')+'</div></td><td>'+(a.type==='cert'?'🎓 Sertifikat':a.type==='etiraz'?'⚠️ Etiraz':a.type==='job'?'💼 Ish':'📝 Boshqa')+'</td><td><div style="font-weight:600">'+(a.detail||'—')+'</div>'+(a.note?'<div style="font-size:11px;color:var(--text3)">💬 '+a.note.substring(0,60)+'</div>':'')+'</td><td style="font-size:12px;color:var(--text3)">'+(a.created_at?new Date(a.created_at).toLocaleDateString('uz-UZ'):'—')+'</td><td><span style="padding:4px 10px;border-radius:20px;font-size:11px;font-weight:700;'+getStatusStyle(a.status)+'">'+getStatusLabel(a.status)+'</span></td><td><div style="display:flex;gap:6px">'+(a.status==='pending'?'<button class="btn btn-sm" style="background:var(--green-light);color:var(--green);border:1px solid #86EFAC" onclick="updateAppStatusApi('+a.id+',\'approved\')">✅</button><button class="btn btn-sm" style="background:var(--red-light);color:var(--red);border:1px solid #FCA5A5" onclick="updateAppStatusApi('+a.id+',\'rejected\')">❌</button>':'<button class="btn btn-sm btn-secondary" onclick="updateAppStatusApi('+a.id+',\'pending\')">↩</button>')+'</div></td></tr>').join('');
  } catch(e){tbody.innerHTML='<tr><td colspan="8" style="text-align:center;color:var(--red);padding:20px">Xato: '+e.message+'</td></tr>';}
}

async function updateAppStatusApi(id, status) {
  try { await api('PATCH','/applications/'+id+'/status',{status}); showToast(status==='approved'?'✅':status==='rejected'?'❌':'↩','Holat yangilandi',''); renderDekanatApplications(); }
  catch(e){showToast('❌','Xato',e.message);}
}

async function apiSubmitApplication(data) { return api('POST','/applications',data); }

function filterApps(filter,el){currentAppFilter=filter;document.querySelectorAll('#page-dekanat-applications .filter-chip').forEach(c=>c.classList.remove('active'));if(el)el.classList.add('active');renderDekanatApplications();}
function filterQs(filter,el){_currentQFilter=filter;document.querySelectorAll('#page-dekanat-questions .filter-chip').forEach(c=>c.classList.remove('active'));if(el)el.classList.add('active');_renderQTable(filter);}
function renderDekanatSchedule(){const grp=document.getElementById('dekScheduleGroup')?.value||'AI-2301';currentDekScheduleGroup=grp;if(typeof buildTTTable==='function')buildTTTable('dekTTHead','dekTTBody',grp,true);if(typeof renderRoomStatus==='function')renderRoomStatus(grp);}
function fillDekanat(l,p){const dl=document.getElementById('dLogin');const dp=document.getElementById('dPass');if(dl)dl.value=l;if(dp)dp.value=p;}
function clearAllDekanatQuestions(){if(!confirm('Hamma savollarni ochirmoqchimisiz?'))return;showToast('ℹ️','Malumot','Savollar faqat API orqali ochirish mumkin');}
// Loads all questions from API and populates the global DEKANAT_QUESTIONS
// array that student/teacher panels read for tests and real exams.
async function loadDekanatQuestions() {
  try {
    // Load ALL questions (up to 5000) so students see all uploaded chapters
    const all = await api('GET', '/questions?limit=5000');
    const list = Array.isArray(all) ? all : [];
    const corrMap = { A: 0, B: 1, C: 2, D: 3 };

    // Transform to the format expected by the exam engine:
    // { id, subject, type, chapter_num, q, opts:[a,b,c,d], ans }
    window.DEKANAT_QUESTIONS = list.map(function(q) {
      return {
        id:          q.id,
        subject:     q.subject,
        type:        q.type,
        chapter_num: q.chapter_num || 1,
        q:           q.question_text,
        opts:        [q.option_a, q.option_b, q.option_c, q.option_d],
        ans:         corrMap[(q.correct_option || 'A').toUpperCase()] ?? 0,
        explanation: q.explanation || null,
      };
    });

    // Also cache chapter map: { 'math': {1:20, 2:20, ...}, ... }
    window.DEKANAT_CHAPTERS = {};
    window.DEKANAT_QUESTIONS.forEach(function(q) {
      if (!window.DEKANAT_CHAPTERS[q.subject]) window.DEKANAT_CHAPTERS[q.subject] = {};
      var ch = q.chapter_num || 1;
      window.DEKANAT_CHAPTERS[q.subject][ch] = (window.DEKANAT_CHAPTERS[q.subject][ch] || 0) + 1;
    });
  } catch(e) {
    console.warn('loadDekanatQuestions failed:', e.message);
  }
}
function saveDekanatQuestions(){}
function renderDekanatQuestions_OLD(){}
