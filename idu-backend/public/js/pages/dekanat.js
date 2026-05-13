'use strict';
// IDU Platform — pages/dekanat.js
// Dekanat paneli: barcha ma'lumotlar real API dan olinadi

// ════════════════════════════════════
// DEKANAT DASHBOARD
// ════════════════════════════════════
async function renderDekanatDashboard() {
  try {
    // Talabalar soni
    const studData = await api('GET', '/students?limit=1');
    const studCount = studData.total || 0;
    const el1 = document.getElementById('dekStatStudents');
    if (el1) el1.textContent = studCount;

    // Ekzamen natijalari
    const examHistory = await api('GET', '/exams/history?examType=test');
    const examCount = Array.isArray(examHistory) ? examHistory.length : 0;
    const el2 = document.getElementById('dekStatExams');
    if (el2) el2.textContent = examCount;

    // Arizalar
    const apps = await api('GET', '/applications?status=pending');
    const appCount = Array.isArray(apps) ? apps.length : 0;
    const el3 = document.getElementById('dekStatApps');
    if (el3) el3.textContent = appCount;

    // Savollar banki
    const qs = await api('GET', '/questions?limit=1');
    const qCount = Array.isArray(qs) ? qs.length : 0;
    const el4 = document.getElementById('dekStatQuestions');
    if (el4) el4.textContent = qCount;

    // Guruh reytingini render
    await renderGroupRanking();
    // Xavf ostidagi talabalar
    await renderAtRiskFromApi();

  } catch (e) {
    console.error('Dashboard xatosi:', e);
  }
}

async function renderGroupRanking() {
  const el = document.getElementById('groupRankingList');
  if (!el) return;
  try {
    const history = await api('GET', '/exams/history');
    if (!Array.isArray(history) || !history.length) {
      el.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text3)">Hali natijalar yo\'q</div>';
      return;
    }
    // Guruh bo'yicha guruhlash — students da group_name kerak, bu yerda student_name orqali
    // Faqat har bir unique talabani sanash
    const uniqueStudents = [...new Set(history.map(r => r.student_name))];
    el.innerHTML = `<div style="text-align:center;padding:16px;color:var(--text2);font-size:13px">
      Jami <strong>${history.length}</strong> ta imtihon natijasi, 
      <strong>${uniqueStudents.length}</strong> ta talaba
    </div>`;
  } catch (e) {
    el.innerHTML = '<div style="padding:12px;color:var(--text3)">Ma\'lumot yuklanmadi</div>';
  }
}

async function renderAtRiskFromApi() {
  const el = document.getElementById('atRiskStudents');
  if (!el) return;
  try {
    const history = await api('GET', '/exams/history');
    if (!Array.isArray(history)) return;
    // F baho olganlari
    const failed = history.filter(r => r.letter_grade === 'F');
    if (!failed.length) {
      el.innerHTML = '<div style="padding:12px;color:var(--green);font-size:13px">✅ Hech kim xavf guruhida emas</div>';
      return;
    }
    el.innerHTML = failed.slice(0,5).map(r => `
      <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #F8FAFC">
        <div class="dt-avatar" style="background:#DC2626">${(r.student_name||'?').split(' ').map(x=>x[0]).join('').substring(0,2)}</div>
        <div style="flex:1">
          <div style="font-size:13.5px;font-weight:700">${r.student_name || 'Noma\'lum'}</div>
          <div style="font-size:12px;color:var(--text2)">${r.subject} · Ball: ${r.score} · ${r.exam_type}</div>
        </div>
        <span class="status-tag st-warning">Xavf</span>
      </div>`).join('');
  } catch (e) {
    el.innerHTML = '<div style="padding:12px;color:var(--text3)">Yuklashda xato</div>';
  }
}

// ════════════════════════════════════
// DEKANAT STUDENTS
// ════════════════════════════════════
let _dekStudentPage = 1;
let _dekStudentSearch = '';

async function renderDekanatStudents() {
  const el = document.getElementById('dekanatStudentBody');
  if (!el) return;
  el.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:20px">⏳ Yuklanmoqda...</td></tr>';
  try {
    const search = document.getElementById('studentSearch')?.value || '';
    _dekStudentSearch = search;
    const params = new URLSearchParams({ limit: 20, page: _dekStudentPage });
    if (search) params.append('search', search);
    const data = await api('GET', '/students?' + params.toString());
    const students = data.data || [];
    const total = data.total || 0;
    if (!students.length) {
      el.innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--text3);padding:20px">Talaba topilmadi</td></tr>';
      return;
    }
    el.innerHTML = students.map((s, i) => `
      <tr>
        <td>${((_dekStudentPage-1)*20) + i + 1}</td>
        <td>
          <div style="display:flex;align-items:center;gap:8px">
            <div class="dt-avatar" style="background:#1B4FD8">${(s.full_name||'?').split(' ').map(x=>x[0]).join('').substring(0,2)}</div>
            <div><div style="font-weight:600">${s.full_name||'—'}</div>
            <div style="font-size:11px;color:var(--text3)">${s.student_id_number||''}</div></div>
          </div>
        </td>
        <td><span class="card-badge cb-blue">${s.faculty||'—'}</span></td>
        <td>${s.year_of_study ? s.year_of_study + '-kurs' : '—'}</td>
        <td><span class="font-mono">${s.gpa||'0.00'}</span></td>
        <td>—</td>
        <td>—</td>
        <td>—</td>
        <td><button class="btn btn-secondary btn-sm" onclick="openStudentDetail(${s.id})">📋</button></td>
      </tr>`).join('');
    // Pagination
    const totalPages = Math.ceil(total / 20);
    const pag = document.getElementById('studentPagination');
    if (pag && totalPages > 1) {
      pag.innerHTML = `
        <button class="btn btn-secondary btn-sm" onclick="dekStudentPage(${_dekStudentPage-1})" ${_dekStudentPage<=1?'disabled':''}>← Oldingi</button>
        <span style="padding:0 12px;font-size:13px">${_dekStudentPage} / ${totalPages}</span>
        <button class="btn btn-secondary btn-sm" onclick="dekStudentPage(${_dekStudentPage+1})" ${_dekStudentPage>=totalPages?'disabled':''}>Keyingi →</button>`;
    }
  } catch (e) {
    el.innerHTML = `<tr><td colspan="9" style="text-align:center;color:var(--red);padding:20px">Xato: ${e.message}</td></tr>`;
  }
}

function dekStudentPage(page) {
  _dekStudentPage = Math.max(1, page);
  renderDekanatStudents();
}

function filterStudents() {
  _dekStudentPage = 1;
  renderDekanatStudents();
}

async function openStudentDetail(id) {
  try {
    const s = await api('GET', '/students/' + id);
    const grades = await api('GET', '/students/' + id + '/grades');
    const modal = document.getElementById('studentDetailModal');
    if (!modal) return;
    document.getElementById('studentDetailTitle').textContent = s.full_name || 'Talaba';
    document.getElementById('studentDetailContent').innerHTML = `
      <div style="display:flex;align-items:center;gap:16px;margin-bottom:20px">
        <div style="width:60px;height:60px;border-radius:14px;background:linear-gradient(135deg,var(--primary),#3B82F6);display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:800;color:white">${(s.full_name||'?').split(' ').map(x=>x[0]).join('').substring(0,2)}</div>
        <div>
          <div style="font-size:20px;font-weight:800">${s.full_name||'—'}</div>
          <div style="color:var(--text2);margin-top:4px">${s.faculty||'—'} · ${s.year_of_study||'?'}-kurs · ${s.department||'—'}</div>
          ${s.phone ? `<div style="font-size:12px;color:var(--text3)">📞 ${s.phone}</div>` : ''}
        </div>
      </div>
      <div class="stats-grid-3" style="margin-bottom:16px">
        <div style="text-align:center;padding:14px;background:var(--bg);border-radius:var(--r2)">
          <div style="font-size:24px;font-weight:900;color:var(--primary);font-family:'DM Mono',monospace">${s.gpa||'0.00'}</div>
          <div style="font-size:12px;color:var(--text3)">GPA</div>
        </div>
        <div style="text-align:center;padding:14px;background:var(--bg);border-radius:var(--r2)">
          <div style="font-size:24px;font-weight:900;color:var(--green);font-family:'DM Mono',monospace">${s.student_id_number||'—'}</div>
          <div style="font-size:12px;color:var(--text3)">ID raqam</div>
        </div>
        <div style="text-align:center;padding:14px;background:var(--bg);border-radius:var(--r2)">
          <div style="font-size:24px;font-weight:900;color:var(--orange);font-family:'DM Mono',monospace">${s.enrollment_date ? new Date(s.enrollment_date).getFullYear() : '—'}</div>
          <div style="font-size:12px;color:var(--text3)">Qabul yili</div>
        </div>
      </div>
      ${grades.length ? `
      <table class="grade-table">
        <thead><tr><th>Fan</th><th>JN</th><th>ON</th><th>YN</th><th>MI</th><th>Jami</th><th>Baho</th></tr></thead>
        <tbody>${grades.map(g => {
          const total = g.total || (g.jn + g.on_score + g.yn + g.mi);
          const letter = g.letter_grade || (total>=86?'A':total>=71?'B':total>=56?'C':total>=41?'D':'F');
          const cls = letter==='A'?'gc-a':letter==='B'?'gc-b':letter==='C'?'gc-c':letter==='D'?'gc-d':'gc-f';
          return `<tr>
            <td>${g.course_name||'—'}</td>
            <td>${g.jn||0}</td><td>${g.on_score||0}</td><td>${g.yn||0}</td><td>${g.mi||0}</td>
            <td><strong>${total}</strong></td>
            <td><span class="grade-chip ${cls}">${letter}</span></td>
          </tr>`;
        }).join('')}</tbody>
      </table>` : '<div style="text-align:center;padding:20px;color:var(--text3)">Baholar hali kiritilmagan</div>'}`;
    modal.classList.add('open');
  } catch (e) {
    showToast('❌', 'Xato', e.message);
  }
}

// ════════════════════════════════════
// DEKANAT QUESTIONS (PDF upload bilan)
// ════════════════════════════════════
let _allDekQuestions = [];

async function renderDekanatQuestions() {
  await _updateQStats();
  await _renderQTable(_currentQFilter || 'all');
}

async function _updateQStats() {
  try {
    const all = await api('GET', '/questions?limit=200');
    _allDekQuestions = Array.isArray(all) ? all : [];
    const total = _allDekQuestions.length;
    const testQ = _allDekQuestions.filter(q => q.type === 'test' || q.type === 'both').length;
    const realQ = _allDekQuestions.filter(q => q.type === 'real' || q.type === 'both').length;
    const subjs = [...new Set(_allDekQuestions.map(q => q.subject))].length;
    const e1 = document.getElementById('qStatTotal'); if(e1) e1.textContent = total;
    const e2 = document.getElementById('qStatTest'); if(e2) e2.textContent = testQ;
    const e3 = document.getElementById('qStatReal'); if(e3) e3.textContent = realQ;
    const e4 = document.getElementById('qStatSubjects'); if(e4) e4.textContent = subjs;
  } catch(e) {}
}

async function _renderQTable(filter) {
  const tbody = document.getElementById('questionsTableBody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px">⏳ Yuklanmoqda...</td></tr>';
  try {
    let url = '/questions?limit=100';
    if (filter === 'test') url += '&type=test';
    else if (filter === 'real') url += '&type=real';
    else if (['algo','ai','math','db','web'].includes(filter)) url += '&subject=' + filter;
    const qs = await api('GET', url);
    if (!qs.length) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text3);padding:40px"><div style="font-size:28px;margin-bottom:8px">📝</div><div>Hali savol kiritilmagan</div></td></tr>';
      return;
    }
    tbody.innerHTML = qs.map((q, i) => `
      <tr>
        <td><strong>${i+1}</strong></td>
        <td><span style="padding:3px 8px;background:#EEF3FF;border-radius:6px;font-size:11.5px;font-weight:700;color:#1B4FD8">${SUBJ_LABELS[q.subject]||q.subject}</span></td>
        <td><span style="padding:3px 8px;border-radius:6px;font-size:11.5px;font-weight:700;background:${q.type==='test'?'#DCFCE7':q.type==='real'?'#FEE2E2':'#F3E8FF'};color:${q.type==='test'?'#16A34A':q.type==='real'?'#DC2626':'#7C3AED'}">${TYPE_LABELS[q.type]||q.type}</span></td>
        <td style="max-width:300px"><div style="font-weight:600;font-size:13px;line-height:1.4">${q.question_text.substring(0,80)}${q.question_text.length>80?'...':''}</div>
          <div style="font-size:11px;color:#64748B;margin-top:3px">✅ ${(q[['option_a','option_b','option_c','option_d'][['A','B','C','D'].indexOf(q.correct_option)]]||'').substring(0,50)}</div></td>
        <td style="font-size:12px;color:#16A34A;font-weight:600">${q.correct_option} – ${(q[['option_a','option_b','option_c','option_d'][['A','B','C','D'].indexOf(q.correct_option)]]||'').substring(0,20)}</td>
        <td><div style="display:flex;gap:5px">
          <button onclick="editQuestion(${q.id})" style="padding:5px 10px;background:#EEF3FF;border:none;border-radius:6px;color:#1B4FD8;font-size:12px;cursor:pointer;font-weight:600">✏️</button>
          <button onclick="deleteQuestion(${q.id})" style="padding:5px 10px;background:#FEE2E2;border:none;border-radius:6px;color:#DC2626;font-size:12px;cursor:pointer;font-weight:600">🗑️</button>
        </div></td>
      </tr>`).join('');
  } catch(e) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--red);padding:20px">Xato: ${e.message}</td></tr>`;
  }
}

async function deleteQuestion(id) {
  if (!confirm('Bu savolni o\'chirmoqchimisiz?')) return;
  try {
    await api('DELETE', '/questions/' + id);
    showToast('🗑️', 'O\'chirildi', 'Savol o\'chirildi');
    renderDekanatQuestions();
  } catch(e) {
    showToast('❌', 'Xato', e.message);
  }
}

async function editQuestion(id) {
  const q = _allDekQuestions.find(x => x.id === id);
  if (!q) { showToast('⚠️', 'Xato', 'Savol topilmadi'); return; }
  _editingQId = id;
  document.getElementById('qModalSubject').value = q.subject;
  document.getElementById('qModalType').value = q.type;
  document.getElementById('qModalText').value = q.question_text;
  document.getElementById('qOpt0').value = q.option_a;
  document.getElementById('qOpt1').value = q.option_b;
  document.getElementById('qOpt2').value = q.option_c;
  document.getElementById('qOpt3').value = q.option_d;
  document.getElementById('qCorrect').value = q.correct_option;
  document.getElementById('qModalIzoh').value = q.explanation || '';
  document.getElementById('addQuestionModal').style.display = 'flex';
}

function openAddQuestionModal() {
  _editingQId = null;
  ['qModalText','qOpt0','qOpt1','qOpt2','qOpt3','qModalIzoh'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const subj = document.getElementById('qModalSubject');
  if (subj) subj.value = 'algo'; document.querySelectorAll('input[name="qModalCorrect"]').forEach(r => r.checked = false); const firstRadio = document.querySelector('input[name="qModalCorrect"][value="0"]'); if(firstRadio) firstRadio.checked = true;
  const type = document.getElementById('qModalType');
  if (type) type.value = 'test';
  document.getElementById('addQuestionModal').style.display = 'flex';
}

async function saveQuestionModal() {
  const subject = document.getElementById('qModalSubject')?.value;
  const type = document.getElementById('qModalType')?.value;
  const questionText = document.getElementById('qModalText')?.value.trim();
  const optionA = document.getElementById('qOpt0')?.value.trim();
  const optionB = document.getElementById('qOpt1')?.value.trim();
  const optionC = document.getElementById('qOpt2')?.value.trim();
  const optionD = document.getElementById('qOpt3')?.value.trim();
  const corrRadio = document.querySelector('input[name="qModalCorrect"]:checked');
  const correctOption = corrRadio ? ['A','B','C','D'][parseInt(corrRadio.value)] : 'A';
  const explanation = document.getElementById('qModalIzoh')?.value.trim();

  if (!questionText || !optionA || !optionB || !optionC || !optionD) {
    showToast('⚠️', 'Xato', 'Barcha maydonlarni to\'ldiring'); return;
  }

  const body = { subject, type, questionText, optionA, optionB, optionC, optionD, correctOption, explanation };

  try {
    if (_editingQId) {
      await api('PUT', '/questions/' + _editingQId, body);
      showToast('✅', 'Yangilandi', 'Savol yangilandi');
    } else {
      await api('POST', '/questions', body);
      showToast('✅', 'Qo\'shildi', 'Savol qo\'shildi');
    }
    closeQuestionModal();
    renderDekanatQuestions();
  } catch(e) {
    showToast('❌', 'Xato', e.message);
  }
}

function closeQuestionModal() {
  const m = document.getElementById('addQuestionModal');
  if (m) m.style.display = 'none';
  _editingQId = null;
}

// ════════════════════════════════════
// PDF UPLOAD (savollar banki uchun)
// ════════════════════════════════════
async function uploadQuestionsPDF() {
  const subject = document.getElementById('pdfSubject')?.value;
  const type = document.getElementById('pdfType')?.value;
  const fileInput = document.getElementById('pdfFileInput');
  const file = fileInput?.files[0];

  if (!file) { showToast('⚠️', 'Xato', 'PDF fayl tanlang'); return; }
  if (!subject) { showToast('⚠️', 'Xato', 'Fan tanlang'); return; }

  const btn = document.getElementById('pdfUploadBtn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Yuklanmoqda...'; }

  try {
    const formData = new FormData();
    formData.append('pdf', file);
    formData.append('subject', subject);
    formData.append('type', type || 'test');

    const token = _apiToken || localStorage.getItem('idu_jwt');
    const res = await fetch((window.location.origin + '/api') + '/questions/upload-pdf', {
      method: 'POST',
      headers: token ? { 'Authorization': 'Bearer ' + token } : {},
      body: formData
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'PDF yuklashda xato');

    showToast('✅', 'PDF yuklandi',
      `${data.inserted} savol bazaga kiritildi (${data.parsed} ta parse qilindi${data.failed ? ', '+data.failed+' ta xato' : ''})`);
    if (fileInput) fileInput.value = '';
    const pdfModal = document.getElementById('pdfUploadModal');
    if (pdfModal) pdfModal.style.display = 'none';
    renderDekanatQuestions();
  } catch(e) {
    showToast('❌', 'Xato', e.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '📤 Yuklash'; }
  }
}

function openPdfUploadModal() {
  const m = document.getElementById('pdfUploadModal');
  if (m) m.style.display = 'flex';
}

function closePdfUploadModal() {
  const m = document.getElementById('pdfUploadModal');
  if (m) m.style.display = 'none';
}

// ════════════════════════════════════
// DEKANAT SESIYA BOSHQARUVI (API)
// ════════════════════════════════════
async function toggleExamSession(examType, isOpen) {
  try {
    const closesAt = isOpen ? new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString() : null;
    await api('POST', '/exams/session-state', { examType, isOpen, closesAt });
    SESIYA_STATE[examType === 'sesiya' ? 'real' : 'test'] = isOpen;
    setSesiyaState(examType === 'sesiya' ? 'real' : 'test', isOpen);
    showToast(isOpen ? '✅' : '🔒',
      examType === 'test' ? 'Test Rejim' : 'Sesiya',
      isOpen ? 'Faollashtirildi (3 soat)' : 'Qulflandi');
  } catch(e) {
    showToast('❌', 'Xato', e.message);
  }
}

// ════════════════════════════════════
// EXAM RESULTS — DEKANAT KO'RISHI
// ════════════════════════════════════
async function renderExamResults() {
  const el = document.getElementById('examResultsBody');
  if (!el) return;
  el.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px">⏳ Yuklanmoqda...</td></tr>';
  try {
    const examType = document.getElementById('examResultFilter')?.value || '';
    const subject = document.getElementById('examSubjectFilter')?.value || '';
    let url = '/exams/history?';
    if (examType) url += 'examType=' + examType + '&';
    if (subject) url += 'subject=' + subject;
    const results = await api('GET', url);
    if (!Array.isArray(results) || !results.length) {
      el.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text3);padding:20px">Natijalar yo\'q</td></tr>';
      return;
    }
    el.innerHTML = results.map((r, i) => {
      const gradeColor = r.letter_grade==='A'?'#16A34A':r.letter_grade==='B'?'#2563EB':r.letter_grade==='C'?'#D97706':r.letter_grade==='D'?'#EA580C':'#DC2626';
      return `<tr>
        <td><strong>${i+1}</strong></td>
        <td>${r.student_name||'—'}</td>
        <td><span style="font-size:11px;background:#EEF3FF;padding:2px 8px;border-radius:5px;font-weight:700;color:#1B4FD8">${r.exam_type}</span></td>
        <td><span style="font-size:11px;font-weight:600">${r.subject}</span></td>
        <td><strong style="font-family:'DM Mono',monospace">${r.score||0}%</strong></td>
        <td><span style="font-weight:800;color:${gradeColor}">${r.letter_grade||'—'}</span></td>
        <td><span style="font-size:11px;color:var(--text3)">${r.submitted_at ? new Date(r.submitted_at).toLocaleDateString('uz-UZ') : '—'}</span></td>
      </tr>`;
    }).join('');
  } catch(e) {
    el.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--red);padding:20px">Xato: ${e.message}</td></tr>`;
  }
}

// ════════════════════════════════════
// DEKANAT APPLICATIONS (API)
// ════════════════════════════════════
async function renderDekanatApplications() {
  const tbody = document.getElementById('applicationsBody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:20px">⏳ Yuklanmoqda...</td></tr>';
  try {
    let url = '/applications?limit=50';
    if (currentAppFilter && currentAppFilter !== 'all') {
      if (['cert','job','etiraz','other'].includes(currentAppFilter)) url += '&type=' + currentAppFilter;
      else if (currentAppFilter === 'pending') url += '&status=pending';
    }
    const apps = await api('GET', url);
    const allApps = await api('GET', '/applications?limit=1');

    const el1 = document.getElementById('totalAppsCount');
    if (el1) el1.textContent = allApps.length || apps.length;
    const pendingCount = apps.filter ? apps.filter(a => a.status === 'pending').length : 0;
    const pe = document.getElementById('pendingAppsCount');
    if (pe) pe.textContent = pendingCount;
    const approvedCount = apps.filter ? apps.filter(a => a.status === 'approved').length : 0;
    const ae = document.getElementById('approvedAppsCount');
    if (ae) ae.textContent = approvedCount;

    if (!Array.isArray(apps) || !apps.length) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--text3);padding:30px">Hali ariza yo\'q</td></tr>';
      return;
    }
    tbody.innerHTML = apps.map(a => `
      <tr>
        <td><strong>#${a.id}</strong></td>
        <td>
          <div style="font-weight:700">${a.student_name||'—'}</div>
          <div style="font-size:11px;color:var(--text3)">${a.student_id_number||''}</div>
        </td>
        <td>${a.type==='cert'?'🎓 Sertifikat':a.type==='etiraz'?'⚠️ E\'tiroz':a.type==='job'?'💼 Ish':'📝 Boshqa'}</td>
        <td>
          <div style="font-weight:600">${a.detail||'—'}</div>
          ${a.company?`<div style="font-size:11px;color:var(--text2)">📚 ${a.company}</div>`:''}
          ${a.note?`<div style="font-size:11px;color:var(--text3);margin-top:3px">💬 ${a.note.substring(0,60)}</div>`:''}
        </td>
        <td style="font-size:12px;color:var(--text3)">${a.created_at ? new Date(a.created_at).toLocaleDateString('uz-UZ') : '—'}</td>
        <td><span style="padding:4px 10px;border-radius:20px;font-size:11px;font-weight:700;${getStatusStyle(a.status)}">${getStatusLabel(a.status)}</span></td>
        <td>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            ${a.status==='pending'?`
              <button class="btn btn-sm" style="background:var(--green-light);color:var(--green);border:1px solid #86EFAC" onclick="updateAppStatusApi(${a.id},'approved')">✅</button>
              <button class="btn btn-sm" style="background:var(--red-light);color:var(--red);border:1px solid #FCA5A5" onclick="updateAppStatusApi(${a.id},'rejected')">❌</button>
            `:`<button class="btn btn-sm btn-secondary" onclick="updateAppStatusApi(${a.id},'pending')">↩</button>`}
          </div>
          ${a.dekanat_comment?`<div style="margin-top:4px;font-size:11px;color:var(--text2)">💬 ${a.dekanat_comment}</div>`:''}
        </td>
      </tr>`).join('');
  } catch(e) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--red);padding:20px">Xato: ${e.message}</td></tr>`;
  }
}

async function updateAppStatusApi(id, status) {
  try {
    await api('PATCH', '/applications/' + id + '/status', { status });
    showToast(status==='approved'?'✅':status==='rejected'?'❌':'↩', 'Holat yangilandi', '');
    renderDekanatApplications();
  } catch(e) {
    showToast('❌', 'Xato', e.message);
  }
}

// ════════════════════════════════════
// API application submit (frontend dan)
// ════════════════════════════════════
async function apiSubmitApplication(data) {
  return api('POST', '/applications', data);
}

// ════════════════════════════════════
// MISC
// ════════════════════════════════════
function renderDekanatSchedule() {
  const grp = document.getElementById('dekScheduleGroup')?.value || 'AI-2301';
  currentDekScheduleGroup = grp;
  if (typeof buildTTTable === 'function') buildTTTable('dekTTHead', 'dekTTBody', grp, true);
  if (typeof renderRoomStatus === 'function') renderRoomStatus(grp);
}

function filterApps(filter, el) {
  currentAppFilter = filter;
  document.querySelectorAll('#page-dekanat-applications .filter-chip').forEach(c => c.classList.remove('active'));
  if (el) el.classList.add('active');
  renderDekanatApplications();
}

function filterQs(filter, el) {
  _currentQFilter = filter;
  document.querySelectorAll('#page-dekanat-questions .filter-chip').forEach(c => c.classList.remove('active'));
  if (el) el.classList.add('active');
  _renderQTable(filter);
}

function fillDekanat(l, p) {
  const dl = document.getElementById('dLogin');
  const dp = document.getElementById('dPass');
  if (dl) dl.value = l;
  if (dp) dp.value = p;
}

var SUBJ_LABELS = {algo:'💻 Algo', ai:'🤖 AI', math:'📐 Math', db:'🗄️ DB', web:'🌐 Web'};
var TYPE_LABELS = {test:'🧪 Test', real:'📋 Sesiya', both:'📝 Ikkalasi'};
