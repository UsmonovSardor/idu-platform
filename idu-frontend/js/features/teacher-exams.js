'use strict';
// IDU — Teacher Exams (oraliq, joriy, yakuniy, practice)
// + Student anti-cheat fullscreen exam taker

// ════════════════════════════════════════════════════════════════════════════
// TEACHER SIDE
// ════════════════════════════════════════════════════════════════════════════

var _curTeacherExamId = null;

async function renderTeacherExamsList() {
  var el = document.getElementById('teacherExamsList');
  if (!el) return;
  el.innerHTML = '<div style="text-align:center;color:#94A3B8;padding:24px">Yuklanmoqda...</div>';
  try {
    var rows = await api('GET', '/teacher-exams');
    if (!rows.length) {
      el.innerHTML = '<div style="text-align:center;color:#94A3B8;padding:32px;background:#F8FAFC;border-radius:12px">Imtihonlar yo\'q. Yangi yarating!</div>';
      return;
    }
    var typeLabel = { oraliq: '🟠 Oraliq', joriy: '🟢 Joriy nazorat', yakuniy: '🔴 Yakuniy', practice: '🔵 Mashq' };
    el.innerHTML = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px">'
      + rows.map(function(e) {
        var typeColor = e.exam_type==='oraliq'?'#EA580C':e.exam_type==='joriy'?'#16A34A':e.exam_type==='yakuniy'?'#DC2626':'#1B4FD8';
        return '<div class="card" style="border-top:3px solid ' + typeColor + ';padding:14px">'
          + '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">'
          + '<div style="font-weight:800;font-size:14px;color:#1E293B;flex:1">' + escTe(e.title) + '</div>'
          + '<div style="background:' + typeColor + '22;color:' + typeColor + ';font-size:10px;font-weight:700;padding:2px 8px;border-radius:12px;white-space:nowrap;margin-left:6px">' + (typeLabel[e.exam_type]||e.exam_type) + '</div>'
          + '</div>'
          + '<div style="font-size:11px;color:#94A3B8;margin-bottom:10px">' + escTe(e.subject) + ' · ' + escTe(e.group_name) + ' · ' + e.duration_min + ' daqiqa</div>'
          + '<div style="display:flex;justify-content:space-between;font-size:11px;color:#64748B;padding:8px 10px;background:#F8FAFC;border-radius:8px;margin-bottom:10px">'
          + '<div>📝 <strong>' + (e.q_count||0) + '</strong> savol</div>'
          + '<div>✅ <strong>' + (e.submitted_count||0) + '</strong> topshirildi</div>'
          + '</div>'
          + '<div style="display:flex;gap:6px;flex-wrap:wrap">'
          + '<button onclick="openTeacherExamEditor(' + e.id + ')" class="btn btn-primary" style="flex:1;font-size:11px;padding:6px 8px">📝 Tahrirlash</button>'
          + '<button onclick="showTeacherExamResults(' + e.id + ',\'' + escTe(e.title).replace(/'/g,"\\'") + '\')" class="btn btn-secondary" style="flex:1;font-size:11px;padding:6px 8px">📊 Natija</button>'
          + '<button onclick="deleteTeacherExam(' + e.id + ')" style="background:#FEE2E2;color:#DC2626;border:none;border-radius:8px;font-size:11px;padding:6px 10px;cursor:pointer">🗑️</button>'
          + '</div></div>';
      }).join('') + '</div>';
  } catch(err) {
    el.innerHTML = '<div style="color:#DC2626;padding:12px">' + err.message + '</div>';
  }
}

function openCreateExamModal() {
  var m = document.getElementById('createExamModal');
  if (m) m.style.display = 'flex';
}

function closeCreateExamModal() {
  var m = document.getElementById('createExamModal');
  if (m) m.style.display = 'none';
}

async function submitCreateExam() {
  var data = {
    title:       (document.getElementById('ceTitle')||{}).value || '',
    description: (document.getElementById('ceDesc') ||{}).value || '',
    subject:     (document.getElementById('ceSubject')||{}).value || '',
    group:       (document.getElementById('ceGroup')||{}).value || '',
    examType:    (document.getElementById('ceType')||{}).value || 'practice',
    durationMin: parseInt((document.getElementById('ceDuration')||{}).value || '30', 10),
    totalScore:  parseInt((document.getElementById('ceTotal')||{}).value || '100', 10),
    shuffleQ:    (document.getElementById('ceShuffleQ')||{}).checked,
    shuffleOpts: (document.getElementById('ceShuffleO')||{}).checked,
    showResults: (document.getElementById('ceShowRes')||{}).checked,
  };
  if (!data.title || !data.subject || !data.group) {
    showToast('⚠️', 'Xato', 'Nomi, fan va guruh kerak');
    return;
  }
  try {
    var exam = await api('POST', '/teacher-exams', data);
    closeCreateExamModal();
    showToast('✅', 'Yaratildi', exam.title);
    renderTeacherExamsList();
    openTeacherExamEditor(exam.id);
  } catch(e) {
    showToast('❌', 'Xato', e.message);
  }
}

async function openTeacherExamEditor(examId) {
  _curTeacherExamId = examId;
  var m = document.getElementById('examEditorModal');
  if (!m) return;
  m.style.display = 'flex';

  document.getElementById('eeQuestionList').innerHTML = '<div style="text-align:center;color:#94A3B8;padding:16px">Yuklanmoqda...</div>';

  try {
    var qs = await api('GET', '/teacher-exams/' + examId + '/questions');
    renderExamQuestions(qs);
  } catch(e) {
    document.getElementById('eeQuestionList').innerHTML = '<div style="color:#DC2626;padding:12px">' + e.message + '</div>';
  }
}

function renderExamQuestions(qs) {
  var el = document.getElementById('eeQuestionList');
  if (!el) return;
  document.getElementById('eeQCount').textContent = qs.length + ' ta savol';
  if (!qs.length) {
    el.innerHTML = '<div style="text-align:center;color:#94A3B8;padding:24px;background:#F8FAFC;border-radius:12px">Savol yo\'q. Fayl yuklang yoki qo\'lda qo\'shing.</div>';
    return;
  }
  el.innerHTML = qs.map(function(q, i) {
    var corr = q.correct_option;
    var opts = [['A',q.option_a],['B',q.option_b],['C',q.option_c],['D',q.option_d]];
    return '<div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;padding:12px;margin-bottom:8px">'
      + '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">'
      + '<div style="font-weight:700;font-size:13px;flex:1"><span style="color:#1B4FD8">#' + (i+1) + '.</span> ' + escTe(q.question_text) + '</div>'
      + '<button onclick="deleteExamQuestion(' + q.id + ')" style="background:#FEE2E2;color:#DC2626;border:none;width:24px;height:24px;border-radius:6px;font-size:12px;cursor:pointer;margin-left:6px">✕</button>'
      + '</div>'
      + '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:6px;font-size:12px">'
      + opts.map(function(o) {
        var isCorr = o[0] === corr;
        return '<div style="padding:6px 10px;border-radius:6px;background:' + (isCorr?'#DCFCE7':'#fff') + ';border:1px solid ' + (isCorr?'#86EFAC':'#E2E8F0') + ';color:' + (isCorr?'#15803D':'#475569') + ';font-weight:' + (isCorr?'700':'400') + '">'
          + (isCorr?'✓ ':'') + o[0] + ') ' + escTe(o[1]||'—') + '</div>';
      }).join('')
      + '</div></div>';
  }).join('');
  _renderMathWhenReady(el);
}

function _renderMathWhenReady(el, tries) {
  if (typeof renderMathInPage === 'function' && window._katexReady) {
    renderMathInPage(el);
  } else if ((tries || 0) < 30) {
    setTimeout(function() { _renderMathWhenReady(el, (tries || 0) + 1); }, 100);
  }
}

async function uploadExamFile() {
  if (!_curTeacherExamId) return;
  var inp = document.getElementById('eeFileInput');
  if (!inp || !inp.files[0]) { showToast('⚠️','Xato','Fayl tanlang'); return; }

  var btn = document.getElementById('eeUploadBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Yuklanmoqda...'; }

  var fd = new FormData();
  fd.append('file', inp.files[0]);

  try {
    var base = (window.API_BASE || '/api/v1');
    var headers = {};
    // Use in-memory token if available (set by config.js apiLogin); cookie sent automatically
    var memToken = (typeof _apiToken !== 'undefined' && _apiToken) ? _apiToken
                 : (localStorage.getItem('idu_jwt') || '');
    if (memToken) headers['Authorization'] = 'Bearer ' + memToken;
    var res = await fetch(base + '/teacher-exams/' + _curTeacherExamId + '/upload', {
      method: 'POST',
      headers: headers,
      credentials: 'include', // send httpOnly cookie
      body: fd
    });
    var data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Yuklash xatosi');
    showToast('✅', 'Muvaffaqiyat', data.message);
    inp.value = '';
    var qs = await api('GET', '/teacher-exams/' + _curTeacherExamId + '/questions');
    renderExamQuestions(qs);
  } catch(e) {
    showToast('❌', 'Xato', e.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '📤 Fayl yuklash'; }
  }
}

async function addManualQuestion() {
  if (!_curTeacherExamId) return;
  var data = {
    questionText: (document.getElementById('mqText')||{}).value || '',
    optionA: (document.getElementById('mqA')||{}).value || '',
    optionB: (document.getElementById('mqB')||{}).value || '',
    optionC: (document.getElementById('mqC')||{}).value || '',
    optionD: (document.getElementById('mqD')||{}).value || '',
    correctOption: (document.getElementById('mqCorrect')||{}).value || 'A',
    explanation: (document.getElementById('mqExp')||{}).value || ''
  };
  if (!data.questionText || !data.optionA || !data.optionB) {
    showToast('⚠️','Xato','Savol va A,B kerak'); return;
  }
  try {
    await api('POST', '/teacher-exams/' + _curTeacherExamId + '/questions', data);
    ['mqText','mqA','mqB','mqC','mqD','mqExp'].forEach(function(id){
      var x = document.getElementById(id); if (x) x.value = '';
    });
    showToast('✅', 'Qo\'shildi', 'Savol qo\'shildi');
    var qs = await api('GET', '/teacher-exams/' + _curTeacherExamId + '/questions');
    renderExamQuestions(qs);
  } catch(e) {
    showToast('❌','Xato',e.message);
  }
}

async function deleteExamQuestion(qid) {
  if (!_curTeacherExamId) return;
  if (!confirm('Savolni o\'chirilsinmi?')) return;
  try {
    await api('DELETE', '/teacher-exams/' + _curTeacherExamId + '/questions/' + qid);
    var qs = await api('GET', '/teacher-exams/' + _curTeacherExamId + '/questions');
    renderExamQuestions(qs);
  } catch(e) {
    showToast('❌','Xato',e.message);
  }
}

async function deleteTeacherExam(examId) {
  if (!confirm('Imtihonni o\'chirilsinmi? Hamma natijalar yo\'qoladi.')) return;
  try {
    await api('DELETE', '/teacher-exams/' + examId);
    showToast('✅', 'O\'chirildi', '');
    renderTeacherExamsList();
  } catch(e) {
    showToast('❌','Xato',e.message);
  }
}

function closeExamEditor() {
  var m = document.getElementById('examEditorModal');
  if (m) m.style.display = 'none';
  _curTeacherExamId = null;
  renderTeacherExamsList();
}

var _erAllRows = [];
var _erExamId  = null;

async function showTeacherExamResults(examId, title) {
  var m = document.getElementById('examResultsModal');
  if (!m) return;
  _erExamId = examId;
  m.style.display = 'flex';
  document.getElementById('erTitle').textContent = title || 'Natijalar';
  document.getElementById('erBody').innerHTML = '<div style="text-align:center;color:#94A3B8;padding:16px">Yuklanmoqda...</div>';

  try {
    _erAllRows = await api('GET', '/teacher-exams/' + examId + '/results');

    // Build filter bar (only once)
    var filterBar = document.getElementById('erFilterBar');
    if (!filterBar) {
      filterBar = document.createElement('div');
      filterBar.id = 'erFilterBar';
      filterBar.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;padding:10px 0 6px';
      filterBar.innerHTML =
        '<input id="erSearchName" placeholder="🔍 Talaba ismi..." oninput="_erRender()" style="flex:1;min-width:140px;padding:7px 10px;border:1px solid #E2E8F0;border-radius:8px;font-size:13px">'
        + '<select id="erFilterStatus" onchange="_erRender()" style="padding:7px 10px;border:1px solid #E2E8F0;border-radius:8px;font-size:13px">'
        + '<option value="">Barcha holat</option>'
        + '<option value="submitted">✓ Topshirildi</option>'
        + '<option value="auto_submitted">⏰ Avto</option>'
        + '<option value="cheated">⚠️ Hiyla</option>'
        + '<option value="in_progress">⌛ Jarayonda</option>'
        + '</select>'
        + '<select id="erFilterScore" onchange="_erRender()" style="padding:7px 10px;border:1px solid #E2E8F0;border-radius:8px;font-size:13px">'
        + '<option value="">Barcha ball</option>'
        + '<option value="pass">≥56 (O\'tdi)</option>'
        + '<option value="fail"><56 (O\'tmadi)</option>'
        + '<option value="excellent">≥86 (A\'lo)</option>'
        + '</select>'
        + '<button onclick="_erExport()" style="padding:7px 12px;background:#1B4FD8;color:#fff;border:none;border-radius:8px;font-size:12px;cursor:pointer;white-space:nowrap">📥 Excel</button>';
      document.getElementById('erBody').before(filterBar);
    }

    _erRender();
  } catch(e) {
    document.getElementById('erBody').innerHTML = '<div style="color:#DC2626;padding:12px">' + e.message + '</div>';
  }
}

function _erRender() {
  var nameQ   = ((document.getElementById('erSearchName') || {}).value || '').trim().toLowerCase();
  var statusQ = ((document.getElementById('erFilterStatus') || {}).value || '');
  var scoreQ  = ((document.getElementById('erFilterScore') || {}).value || '');

  var rows = _erAllRows.filter(function(r) {
    if (nameQ && !(r.full_name || '').toLowerCase().includes(nameQ)) return false;
    if (statusQ && r.status !== statusQ) return false;
    if (scoreQ === 'pass'      && (r.score || 0) < 56)  return false;
    if (scoreQ === 'fail'      && (r.score || 0) >= 56) return false;
    if (scoreQ === 'excellent' && (r.score || 0) < 86)  return false;
    return true;
  });

  var el = document.getElementById('erBody');
  if (!rows.length) {
    el.innerHTML = '<div style="text-align:center;color:#94A3B8;padding:24px">Hech narsa topilmadi</div>';
    return;
  }

  var avg = rows.length ? Math.round(rows.reduce(function(s,r){return s+(r.score||0);},0)/rows.length) : 0;
  var passCount = rows.filter(function(r){return (r.score||0)>=56;}).length;

  el.innerHTML = '<div style="display:flex;gap:12px;margin-bottom:10px;font-size:12px">'
    + '<span style="background:#F1F5F9;padding:4px 10px;border-radius:8px">Jami: <b>' + rows.length + '</b></span>'
    + '<span style="background:#DCFCE7;padding:4px 10px;border-radius:8px;color:#16A34A">O\'tdi: <b>' + passCount + '</b></span>'
    + '<span style="background:#FEE2E2;padding:4px 10px;border-radius:8px;color:#DC2626">O\'tmadi: <b>' + (rows.length - passCount) + '</b></span>'
    + '<span style="background:#EFF6FF;padding:4px 10px;border-radius:8px;color:#1B4FD8">O\'rtacha: <b>' + avg + '</b></span>'
    + '</div>'
    + '<div style="overflow:auto"><table class="dekanat-table"><thead><tr><th>#</th><th>Talaba</th><th>Ball</th><th>To\'g\'ri</th><th>Holat</th><th>Vaqt</th></tr></thead><tbody>'
    + rows.map(function(r, i) {
      var statusLabel = r.status==='submitted'?'<span style="color:#16A34A">✓ Topshirildi</span>'
        : r.status==='auto_submitted'?'<span style="color:#D97706">⏰ Avto</span>'
        : r.status==='cheated'?'<span style="color:#DC2626">⚠️ Hiyla</span>'
        : '<span style="color:#94A3B8">⌛ Jarayonda</span>';
      var cheatBadge = r.cheat_warnings > 0
        ? ' <span style="background:#FEE2E2;color:#DC2626;font-size:10px;padding:1px 6px;border-radius:8px">⚠️ ' + r.cheat_warnings + '</span>' : '';
      return '<tr>'
        + '<td style="padding:8px 10px;color:#94A3B8">' + (i+1) + '</td>'
        + '<td style="padding:8px 10px;font-weight:600">' + escTe(r.full_name) + cheatBadge + '<br><span style="font-size:10px;color:#94A3B8">' + escTe(r.email||'') + '</span></td>'
        + '<td style="padding:8px 10px;text-align:center;font-weight:800;color:' + ((r.score||0)>=71?'#16A34A':(r.score||0)>=56?'#D97706':'#DC2626') + '">' + (r.score||0) + '</td>'
        + '<td style="padding:8px 10px;text-align:center">' + (r.correct_count||0) + '/' + (r.total_count||0) + '</td>'
        + '<td style="padding:8px 10px">' + statusLabel + '</td>'
        + '<td style="padding:8px 10px;font-size:11px;color:#64748B">' + (r.submitted_at ? new Date(r.submitted_at).toLocaleString() : '—') + '</td>'
        + '</tr>';
    }).join('') + '</tbody></table></div>';
}

function _erExport() {
  if (!_erAllRows.length) return;
  var header = ['#','Talaba','Ball','To\'g\'ri/Jami','Holat','Vaqt'];
  var csvRows = [header.join(',')].concat(_erAllRows.map(function(r,i){
    return [i+1, '"'+(r.full_name||'').replace(/"/g,'""')+'"', r.score||0,
            (r.correct_count||0)+'/'+(r.total_count||0), r.status||'',
            r.submitted_at ? new Date(r.submitted_at).toLocaleString() : ''].join(',');
  }));
  var blob = new Blob(['﻿'+csvRows.join('\n')], {type:'text/csv;charset=utf-8'});
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'natijalar_' + (_erExamId||'exam') + '.csv';
  a.click();
}

function closeExamResults() {
  var m = document.getElementById('examResultsModal');
  if (m) m.style.display = 'none';
}

function escTe(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ════════════════════════════════════════════════════════════════════════════
// STUDENT SIDE — Anti-cheat fullscreen exam taker
// ════════════════════════════════════════════════════════════════════════════

var _stExam     = null;
var _stQuestions = [];
var _stAnswers   = {};
var _stCurIdx    = 0;
var _stTimer     = null;
var _stDeadline  = 0;
var _stCheatHandlers = [];
var _stCheatWarnings = 0;
var _stSubmitted = false;

// Student: list available teacher exams (called from a page)
async function renderStudentTeacherExams() {
  var el = document.getElementById('studentExamsList');
  if (!el) return;
  el.innerHTML = '<div style="text-align:center;color:#94A3B8;padding:24px">Yuklanmoqda...</div>';
  try {
    var rows = await api('GET', '/teacher-exams');
    if (!rows.length) {
      el.innerHTML = '<div style="text-align:center;color:#94A3B8;padding:32px;background:#F8FAFC;border-radius:12px">Sizning guruhingiz uchun imtihonlar yo\'q</div>';
      return;
    }
    var typeLabel = { oraliq: 'Oraliq nazorat', joriy: 'Joriy nazorat', yakuniy: 'Yakuniy', practice: 'Mashq' };
    var typeColor = { oraliq:'#EA580C', joriy:'#16A34A', yakuniy:'#DC2626', practice:'#1B4FD8' };
    el.innerHTML = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px">'
      + rows.map(function(e) {
        var color = typeColor[e.exam_type] || '#1B4FD8';
        var isDone = e.my_status && e.my_status !== 'in_progress';
        var btnLabel = isDone ? '✓ Topshirildi · ' + (e.my_score||0) + ' ball' : '🎯 Boshlash';
        var btnDisabled = isDone ? 'disabled' : '';
        return '<div class="card" style="border-top:3px solid ' + color + ';padding:16px">'
          + '<div style="background:' + color + '22;color:' + color + ';font-size:10px;font-weight:700;padding:2px 8px;border-radius:12px;display:inline-block;margin-bottom:8px">' + (typeLabel[e.exam_type]||e.exam_type).toUpperCase() + '</div>'
          + '<div style="font-weight:800;font-size:15px;color:#1E293B;margin-bottom:4px">' + escTe(e.title) + '</div>'
          + '<div style="font-size:12px;color:#64748B;margin-bottom:10px">' + escTe(e.subject) + ' · ' + escTe(e.teacher_name) + '</div>'
          + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:11px;color:#475569;background:#F8FAFC;padding:8px 10px;border-radius:8px;margin-bottom:10px">'
          + '<div>⏰ ' + e.duration_min + ' daq.</div>'
          + '<div>📝 ' + (e.q_count||0) + ' savol</div>'
          + '<div>🎯 ' + e.total_score + ' ball</div>'
          + '<div>' + (e.ends_at ? '📅 ' + new Date(e.ends_at).toLocaleDateString() : '∞') + '</div>'
          + '</div>'
          + '<button onclick="confirmStartExam(' + e.id + ')" class="btn btn-primary" style="width:100%;font-size:13px;padding:10px;font-weight:700' + (isDone?';opacity:0.6;cursor:not-allowed':'') + '" ' + btnDisabled + '>' + btnLabel + '</button>'
          + '</div>';
      }).join('') + '</div>';
  } catch(err) {
    el.innerHTML = '<div style="color:#DC2626;padding:12px">' + err.message + '</div>';
  }
}

function confirmStartExam(examId) {
  if (!confirm('Imtihonni boshlamoqchimisiz?\n\n⚠️ DIQQAT:\n• Sahifa to\'liq ekran rejimga o\'tadi\n• Boshqa oynaga o\'tsangiz ogohlantirilasiz\n• 3 marta ogohlantirilsangiz, imtihon avto-topshiriladi\n• Copy/paste ishlamaydi\n\nDavom etishni xohlaysizmi?')) return;
  startTeacherExam(examId);
}

async function startTeacherExam(examId) {
  try {
    var data = await api('POST', '/teacher-exams/' + examId + '/start', {});
    _stExam      = data.exam;
    _stQuestions = data.questions || [];
    _stAnswers   = {};
    _stCurIdx    = 0;
    _stDeadline  = new Date(data.deadline).getTime();
    _stCheatWarnings = 0;
    _stSubmitted = false;

    if (!_stQuestions.length) {
      showToast('⚠️', 'Xato', 'Bu imtihonda savol yo\'q');
      return;
    }

    openExamUI();
    enterAntiCheatMode();
    startExamTimer();
    renderExamQuestion();
  } catch(e) {
    showToast('❌', 'Xato', e.message || 'Imtihon boshlanmadi');
  }
}

function openExamUI() {
  var overlay = document.getElementById('examTakeOverlay');
  if (!overlay) return;
  document.getElementById('etTitle').textContent = _stExam.title;
  document.getElementById('etSubject').textContent = _stExam.subject + ' · ' + _stExam.examType.toUpperCase();
  overlay.style.display = 'flex';
  // Request fullscreen
  var el = document.documentElement;
  (el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen || el.msRequestFullscreen || function(){}).call(el).catch(()=>{});
}

function renderExamQuestion() {
  if (_stCurIdx < 0) _stCurIdx = 0;
  if (_stCurIdx >= _stQuestions.length) _stCurIdx = _stQuestions.length - 1;

  var q = _stQuestions[_stCurIdx];
  if (!q) return;

  // Progress info
  document.getElementById('etProgress').textContent = (_stCurIdx + 1) + ' / ' + _stQuestions.length;
  var answeredCount = Object.keys(_stAnswers).length;
  document.getElementById('etAnsweredCount').textContent = answeredCount;

  var letters = ['A','B','C','D'];
  var opts = [q.option_a, q.option_b, q.option_c, q.option_d];

  var html = '<div style="font-size:16px;font-weight:700;color:#1E293B;line-height:1.6;margin-bottom:18px;padding:16px;background:#F8FAFC;border-radius:12px;border-left:4px solid #1B4FD8">'
    + escTe(q.question_text) + '</div>';

  html += '<div style="display:flex;flex-direction:column;gap:8px">';
  for (var i = 0; i < 4; i++) {
    if (!opts[i] || opts[i] === '—') continue;
    var isSel = _stAnswers[q.id] === letters[i];
    html += '<div onclick="selectAnswer(\'' + letters[i] + '\')" '
      + 'style="display:flex;align-items:flex-start;gap:12px;padding:14px 16px;background:' + (isSel?'#EFF6FF':'#fff') + ';border:2px solid ' + (isSel?'#1B4FD8':'#E2E8F0') + ';border-radius:12px;cursor:pointer;transition:all 0.15s;user-select:none">'
      + '<div style="width:30px;height:30px;border-radius:50%;background:' + (isSel?'#1B4FD8':'#F1F5F9') + ';color:' + (isSel?'#fff':'#64748B') + ';display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px;flex-shrink:0">' + letters[i] + '</div>'
      + '<div style="flex:1;font-size:14px;color:#374151;line-height:1.5">' + escTe(opts[i]) + '</div>'
      + (isSel?'<div style="color:#1B4FD8;font-size:18px">✓</div>':'')
      + '</div>';
  }
  html += '</div>';

  document.getElementById('etQuestion').innerHTML = html;
  _renderMathWhenReady(document.getElementById('etQuestion'));

  // Nav buttons
  document.getElementById('etPrevBtn').disabled = _stCurIdx === 0;
  document.getElementById('etNextBtn').disabled = _stCurIdx === _stQuestions.length - 1;
  // Question grid
  renderQuestionGrid();
}

function renderQuestionGrid() {
  var el = document.getElementById('etGrid');
  if (!el) return;
  el.innerHTML = _stQuestions.map(function(q, i) {
    var ans = _stAnswers[q.id];
    var cur = i === _stCurIdx;
    return '<button onclick="jumpToQ(' + i + ')" style="width:32px;height:32px;border-radius:6px;border:' + (cur?'2px solid #1B4FD8':'1px solid #E2E8F0') + ';background:' + (ans?'#DCFCE7':'#fff') + ';color:' + (ans?'#15803D':'#64748B') + ';font-weight:700;font-size:11px;cursor:pointer;' + (cur?'transform:scale(1.1)':'') + '">' + (i+1) + '</button>';
  }).join('');
}

function selectAnswer(letter) {
  var q = _stQuestions[_stCurIdx];
  if (!q) return;
  _stAnswers[q.id] = letter;
  renderExamQuestion();
}

function nextQ() {
  if (_stCurIdx < _stQuestions.length - 1) { _stCurIdx++; renderExamQuestion(); }
}
function prevQ() {
  if (_stCurIdx > 0) { _stCurIdx--; renderExamQuestion(); }
}
function jumpToQ(i) {
  _stCurIdx = i;
  renderExamQuestion();
}

function startExamTimer() {
  clearInterval(_stTimer);
  _stTimer = setInterval(function() {
    var ms = _stDeadline - Date.now();
    var el = document.getElementById('etTimer');
    if (ms <= 0) {
      el.textContent = '00:00';
      el.style.color = '#DC2626';
      submitExam(true);
      return;
    }
    var min = Math.floor(ms / 60000);
    var sec = Math.floor((ms % 60000) / 1000);
    el.textContent = (min<10?'0':'') + min + ':' + (sec<10?'0':'') + sec;
    el.style.color = ms < 60000 ? '#DC2626' : ms < 300000 ? '#D97706' : '#16A34A';
  }, 1000);
}

// ── Anti-cheat ───────────────────────────────────────────────────────────────
function enterAntiCheatMode() {
  _stCheatHandlers = [];

  // 1. Block copy/paste/cut
  function blockClipboard(e) { e.preventDefault(); cheatWarn('clipboard'); }
  ['copy','paste','cut'].forEach(function(ev) {
    document.addEventListener(ev, blockClipboard);
    _stCheatHandlers.push([ev, blockClipboard]);
  });

  // 2. Block right-click
  function blockContext(e) { e.preventDefault(); }
  document.addEventListener('contextmenu', blockContext);
  _stCheatHandlers.push(['contextmenu', blockContext]);

  // 3. Block keyboard shortcuts (Ctrl+C, Ctrl+V, F12, etc.)
  function blockKeys(e) {
    var blocked = (e.ctrlKey || e.metaKey) && ['c','v','x','a','p','s','u'].includes((e.key||'').toLowerCase());
    if (blocked || e.key === 'F12' || (e.ctrlKey && e.shiftKey && (e.key||'').toLowerCase()==='i')) {
      e.preventDefault();
      cheatWarn('keyboard');
    }
    // Alt+Tab can't be blocked but we can detect via blur
  }
  document.addEventListener('keydown', blockKeys);
  _stCheatHandlers.push(['keydown', blockKeys]);

  // 4. Detect tab switch / window blur
  function onBlur() {
    if (_stSubmitted) return;
    cheatWarn('blur');
  }
  function onVis() {
    if (_stSubmitted) return;
    if (document.visibilityState === 'hidden') cheatWarn('hidden');
  }
  window.addEventListener('blur', onBlur);
  document.addEventListener('visibilitychange', onVis);
  _stCheatHandlers.push(['blur', onBlur, 'window']);
  _stCheatHandlers.push(['visibilitychange', onVis]);

  // 5. Detect fullscreen exit
  function onFsChange() {
    if (_stSubmitted) return;
    var fsEl = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement;
    if (!fsEl) cheatWarn('fullscreen-exit');
  }
  ['fullscreenchange','webkitfullscreenchange','mozfullscreenchange','MSFullscreenChange'].forEach(function(ev) {
    document.addEventListener(ev, onFsChange);
    _stCheatHandlers.push([ev, onFsChange]);
  });

  // 6. Disable text selection on questions (allow on input/textarea)
  document.body.style.userSelect = 'none';
  document.body.style.webkitUserSelect = 'none';
}

function exitAntiCheatMode() {
  _stCheatHandlers.forEach(function(h) {
    if (h[2] === 'window') window.removeEventListener(h[0], h[1]);
    else document.removeEventListener(h[0], h[1]);
  });
  _stCheatHandlers = [];
  document.body.style.userSelect = '';
  document.body.style.webkitUserSelect = '';
  // Exit fullscreen
  if (document.exitFullscreen) document.exitFullscreen().catch(()=>{});
  else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
  else if (document.mozCancelFullScreen) document.mozCancelFullScreen();
  else if (document.msExitFullscreen) document.msExitFullscreen();
}

var _lastWarnTime = 0;
function cheatWarn(reason) {
  if (_stSubmitted) return;
  // Debounce — multiple events fire for same action
  var now = Date.now();
  if (now - _lastWarnTime < 700) return;
  _lastWarnTime = now;

  _stCheatWarnings++;
  showCheatModal(reason);

  // Log to backend (fire-and-forget)
  if (_stExam) {
    api('POST', '/teacher-exams/' + _stExam.id + '/cheat-warn', { reason }).catch(()=>{});
  }

  if (_stCheatWarnings >= 3) {
    showToast('🚨', 'Imtihon yopildi', '3 marta qoidalar buzildi');
    setTimeout(function() { submitExam(true, true); }, 1500);
  }
}

function showCheatModal(reason) {
  var labels = {
    blur: 'Boshqa oynaga o\'tdingiz',
    hidden: 'Sahifani yashirdingiz',
    clipboard: 'Copy/paste ishlatildi',
    keyboard: 'Taqiqlangan tugma',
    'fullscreen-exit': 'To\'liq ekran rejimidan chiqdingiz'
  };
  var label = labels[reason] || 'Qoidalar buzildi';
  var el = document.getElementById('etCheatBanner');
  if (!el) return;
  el.innerHTML = '⚠️ <strong>OGOHLANTIRISH ' + _stCheatWarnings + '/3</strong> — ' + label;
  el.style.display = 'block';
  setTimeout(function(){ el.style.display = 'none'; }, 4000);
}

async function submitExam(autoSubmit, cheated) {
  if (_stSubmitted) return;
  if (!autoSubmit && !confirm('Imtihonni topshirmoqchimisiz?\n\nJavob berilgan: ' + Object.keys(_stAnswers).length + ' / ' + _stQuestions.length)) return;

  _stSubmitted = true;
  clearInterval(_stTimer);
  exitAntiCheatMode();

  try {
    var res = await api('POST', '/teacher-exams/' + _stExam.id + '/submit', {
      answers: _stAnswers,
      autoSubmit: !!autoSubmit,
      cheated: !!cheated
    });
    showExamResult(res);
  } catch(e) {
    showToast('❌', 'Xato', e.message);
  }
}

function showExamResult(res) {
  var overlay = document.getElementById('examTakeOverlay');
  var color = res.score >= 71 ? '#16A34A' : res.score >= 56 ? '#D97706' : '#DC2626';
  overlay.innerHTML = '<div style="background:#fff;border-radius:20px;padding:40px;max-width:480px;text-align:center;box-shadow:0 16px 60px rgba(0,0,0,0.3)">'
    + '<div style="font-size:64px;margin-bottom:12px">' + (res.score>=71?'🎉':res.score>=56?'👍':'😔') + '</div>'
    + '<div style="font-size:14px;color:#64748B;font-weight:600;margin-bottom:8px">SIZNING NATIJANGIZ</div>'
    + '<div style="font-size:72px;font-weight:900;color:' + color + ';line-height:1">' + res.score + '</div>'
    + '<div style="font-size:14px;color:#94A3B8;margin-bottom:24px">/ ' + _stExam.totalScore + ' ball</div>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:20px">'
    + '<div style="background:#F0FDF4;padding:10px;border-radius:10px"><div style="font-size:11px;color:#15803D;font-weight:700">TO\'G\'RI</div><div style="font-size:24px;font-weight:900;color:#16A34A">' + res.correct + '</div></div>'
    + '<div style="background:#FEF2F2;padding:10px;border-radius:10px"><div style="font-size:11px;color:#991B1B;font-weight:700">XATO</div><div style="font-size:24px;font-weight:900;color:#DC2626">' + (res.total - res.correct) + '</div></div>'
    + '</div>'
    + '<div style="background:' + color + '22;color:' + color + ';font-weight:800;font-size:18px;padding:10px;border-radius:10px;margin-bottom:20px">Baho: ' + res.grade + '</div>'
    + (res.status === 'cheated' ? '<div style="background:#FEE2E2;color:#991B1B;font-size:12px;padding:8px;border-radius:8px;margin-bottom:14px">⚠️ Qoidalar buzilganligi sababli avto-topshirildi</div>' : '')
    + '<button onclick="closeExamUI()" class="btn btn-primary" style="width:100%;padding:12px;font-weight:700">Yopish</button>'
    + '</div>';
  overlay.style.alignItems = 'center';
}

function closeExamUI() {
  var overlay = document.getElementById('examTakeOverlay');
  if (overlay) {
    overlay.style.display = 'none';
    overlay.innerHTML = ''; // clean up result UI
  }
  _stExam = null;
  _stQuestions = [];
  _stAnswers = {};
  // Reload list to show updated status
  if (typeof renderStudentTeacherExams === 'function') renderStudentTeacherExams();
}
