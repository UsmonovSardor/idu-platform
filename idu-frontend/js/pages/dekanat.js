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

async function renderDekanatDashboard() {
  try {
    const studData = await api('GET', '/students?limit=1');
    const el1 = document.getElementById('dekStatStudents');
    if (el1) el1.textContent = studData.total || 0;
    const apps = await api('GET', '/applications?status=pending&limit=100');
    const el3 = document.getElementById('dekStatApps');
    if (el3) el3.textContent = Array.isArray(apps) ? apps.length : 0;
    await renderGroupRanking();
    await renderAtRiskFromApi();
  } catch (e) { console.error('Dashboard xatosi:', e); }
}

async function renderGroupRanking() {
  const el = document.getElementById('groupRankingList');
  if (!el) return;
  try {
    const history = await api('GET', '/exams/history');
    if (!Array.isArray(history) || !history.length) {
      el.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text3)">Hali natijalar yoq</div>';
      return;
    }
    const unique = [...new Set(history.map(r => r.student_name))];
    el.innerHTML = '<div style="padding:16px;color:var(--text2);font-size:13px">Jami <strong>' + history.length + '</strong> ta imtihon, <strong>' + unique.length + '</strong> talaba</div>';
  } catch (e) { el.innerHTML = '<div style="padding:12px;color:var(--text3)">Malumot yuklanmadi</div>'; }
}

async function renderAtRiskFromApi() {
  const el = document.getElementById('atRiskStudents');
  if (!el) return;
  try {
    const history = await api('GET', '/exams/history');
    if (!Array.isArray(history)) return;
    const failed = history.filter(r => r.letter_grade === 'F');
    if (!failed.length) { el.innerHTML = '<div style="padding:12px;color:var(--green);font-size:13px">✅ Hech kim xavf guruhida emas</div>'; return; }
    el.innerHTML = failed.slice(0,5).map(r => '<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #F8FAFC"><div class="dt-avatar" style="background:#DC2626">' + (r.student_name||'?').split(' ').map(x=>x[0]).join('').substring(0,2) + '</div><div style="flex:1"><div style="font-size:13.5px;font-weight:700">' + (r.student_name||'Noma\'lum') + '</div><div style="font-size:12px;color:var(--text2)">' + r.subject + ' · ' + r.score + '% · ' + r.exam_type + '</div></div><span class="status-tag st-warning">Xavf</span></div>').join('');
  } catch (e) {}
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
  await _updateQStats();
  await _renderQTable(_currentQFilter || 'all');
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

function openAddQuestionModal() {
  _editingQId = null;
  ['qModalText','qOpt0','qOpt1','qOpt2','qOpt3','qModalIzoh'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  const subj=document.getElementById('qModalSubject'); if(subj)subj.value='algo';
  const type=document.getElementById('qModalType'); if(type)type.value='test';
  const r=document.querySelector('input[name="qModalCorrect"][value="0"]'); if(r)r.checked=true;
  document.getElementById('addQuestionModal').style.display='flex';
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
  if (!file)    { showToast('⚠️','Xato','Fayl tanlang (PDF yoki JSON)'); return; }
  if (!subject) { showToast('⚠️','Xato','Fan tanlang'); return; }
  const btn = document.getElementById('pdfUploadBtn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Yuklanmoqda...'; }

  try {
    const isJson = file.name.toLowerCase().endsWith('.json');

    if (isJson) {
      // JSON import — read file locally, POST as JSON
      const text = await file.text();
      let questions;
      try { questions = JSON.parse(text); } catch(e) { throw new Error('JSON format noto\'g\'ri: ' + e.message); }
      if (!Array.isArray(questions)) throw new Error('JSON massiv (array) bo\'lishi kerak: [{"question_text":...}]');
      const data = await api('POST', '/questions/import-json', { subject, type: type || 'test', questions });
      showToast('✅', 'JSON yuklandi', data.inserted + ' savol bazaga kiritildi');
    } else {
      // PDF upload via FormData
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
      if (!res.ok) throw new Error(data.error || 'PDF yuklashda xato');
      showToast('✅', 'PDF yuklandi', data.inserted + ' savol bazaga kiritildi');
    }

    if (fileInput) fileInput.value = '';
    document.getElementById('pdfFileName').textContent = '';
    const pdfModal = document.getElementById('pdfUploadModal');
    if (pdfModal) pdfModal.style.display = 'none';
    renderDekanatQuestions();
  } catch(e) {
    showToast('❌', 'Xato', e.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '📤 Yuklash'; }
  }
}

function openPdfUploadModal(){const m=document.getElementById('pdfUploadModal');if(m)m.style.display='flex';}
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
  const el=document.getElementById('examResultsBody');
  if(!el)return;
  el.innerHTML='<tr><td colspan="7" style="text-align:center;padding:20px">⏳ Yuklanmoqda...</td></tr>';
  try {
    const examType=document.getElementById('examResultFilter')?.value||'';
    const subject=document.getElementById('examSubjectFilter')?.value||'';
    let url='/exams/history?';
    if(examType)url+='examType='+examType+'&';
    if(subject)url+='subject='+subject;
    const results=await api('GET',url);
    if(!Array.isArray(results)||!results.length){el.innerHTML='<tr><td colspan="7" style="text-align:center;color:var(--text3);padding:20px">Natijalar yoq</td></tr>';return;}
    el.innerHTML=results.map((r,i)=>{
      const gc=r.letter_grade==='A'?'#16A34A':r.letter_grade==='B'?'#2563EB':r.letter_grade==='C'?'#D97706':r.letter_grade==='D'?'#EA580C':'#DC2626';
      return '<tr><td><strong>'+(i+1)+'</strong></td><td>'+(r.student_name||'—')+'</td><td><span style="font-size:11px;background:#EEF3FF;padding:2px 8px;border-radius:5px;font-weight:700;color:#1B4FD8">'+r.exam_type+'</span></td><td>'+r.subject+'</td><td><strong style="font-family:monospace">'+(r.score||0)+'%</strong></td><td><span style="font-weight:800;color:'+gc+'">'+(r.letter_grade||'—')+'</span></td><td style="font-size:11px;color:var(--text3)">'+(r.submitted_at?new Date(r.submitted_at).toLocaleDateString('uz-UZ'):'—')+'</td></tr>';
    }).join('');
  } catch(e){el.innerHTML='<tr><td colspan="7" style="text-align:center;color:var(--red);padding:20px">Xato: '+e.message+'</td></tr>';}
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
function loadDekanatQuestions(){}
function saveDekanatQuestions(){}
function renderDekanatQuestions_OLD(){}
