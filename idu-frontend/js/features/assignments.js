'use strict';
// IDU - features/assignments.js

// ── State ──────────────────────────────────────────────────────────
var _asgnState = { id: null, title: '', deadline: null, timerInterval: null };
var _origWindowOpenAsgn = null;

// ══════════════════════════════════════════════════════════════════
//  TEACHER PANEL
// ══════════════════════════════════════════════════════════════════

async function renderTeacherAssignments() {
  var list  = document.getElementById('teacherAssignmentsList');
  var panel = document.getElementById('submissionsPanel');
  if (!list) return;
  if (panel) panel.style.display = 'none';
  list.style.display = '';
  list.innerHTML = '<div style="padding:30px;text-align:center;color:#94A3B8">Yuklanmoqda...</div>';

  var assignments = [];
  try {
    var data = await api('GET', '/assignments');
    assignments = data.assignments || data || [];
  } catch(e) {
    list.innerHTML = '<div style="padding:30px;text-align:center;color:#EF4444">Serverga ulanishda xato</div>';
    return;
  }

  if (!assignments.length) {
    list.innerHTML = '<div style="padding:40px;text-align:center;color:#94A3B8">'
      + '<div style="font-size:40px;margin-bottom:12px">📝</div>'
      + '<div style="font-weight:700;margin-bottom:6px">Hali vazifa yo\'q</div>'
      + '<div style="font-size:13px">Yangi vazifa yaratish uchun "+ Yangi vazifa" tugmasini bosing</div></div>';
    return;
  }

  var subNames = { algo:'Algoritmlar', ai:"Sun'iy Intellekt", math:'Matematika', db:"Ma'lumotlar Bazasi", web:'Web Dasturlash' };

  list.innerHTML = '<div style="display:flex;flex-direction:column;gap:12px">'
    + assignments.map(function(a) {
      var dead = a.deadline ? new Date(a.deadline) : null;
      var isExpired = dead && dead < new Date();
      var deadStr = dead ? dead.toLocaleString('uz-UZ', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '—';
      return '<div style="background:#fff;border:1.5px solid #E2E8F0;border-radius:14px;padding:18px 20px">'
        + '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap">'
          + '<div style="flex:1;min-width:200px">'
            + '<div style="font-size:16px;font-weight:800;color:#0F172A;margin-bottom:4px">' + (a.title||'') + '</div>'
            + '<div style="font-size:12px;color:#64748B;margin-bottom:8px">'
              + '📚 ' + (subNames[a.subject]||a.subject||'Umumiy') + ' &nbsp;·&nbsp; 👥 ' + (a.group_name||'ALL') + ' &nbsp;·&nbsp; 🏆 Max: ' + (a.max_score||100) + ' ball'
            + '</div>'
            + '<div style="font-size:13px;color:#475569;line-height:1.5;max-width:600px">' + ((a.description||'').substring(0,200)) + (a.description&&a.description.length>200?'...':'') + '</div>'
          + '</div>'
          + '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px;flex-shrink:0">'
            + '<span style="padding:4px 12px;border-radius:20px;font-size:11px;font-weight:700;background:' + (isExpired?'#FEE2E2':'#DCFCE7') + ';color:' + (isExpired?'#DC2626':'#16A34A') + '">' + (isExpired?'⏰ Muddati o\'tgan':'✅ Faol') + '</span>'
            + '<div style="font-size:12px;color:#64748B">📅 ' + deadStr + '</div>'
            + '<div style="display:flex;gap:8px;margin-top:4px">'
              + '<button onclick="viewSubmissions(' + a.id + ',\'' + (a.title||'').replace(/'/g,'') + '\')" style="padding:7px 14px;background:#1B4FD8;color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer">👁 Javoblar (' + (a.submission_count||0) + ')</button>'
              + '<button onclick="deleteAssignment(' + a.id + ')" style="padding:7px 12px;background:#FEE2E2;border:none;border-radius:8px;font-size:12px;font-weight:700;color:#DC2626;cursor:pointer">🗑</button>'
            + '</div>'
          + '</div>'
        + '</div>'
      + '</div>';
    }).join('')
  + '</div>';
}

function openCreateAssignment() {
  var form = document.getElementById('createAssignmentForm');
  if (!form) return;
  form.style.display = form.style.display === 'none' ? 'block' : 'none';
  if (form.style.display === 'block') {
    var d = new Date(Date.now() + 7 * 86400000);
    var dl = document.getElementById('asgn-deadline');
    if (dl) dl.value = d.toISOString().slice(0,16);
  }
}

async function submitCreateAssignment() {
  var title    = (document.getElementById('asgn-title')    ||{}).value||'';
  var subject  = (document.getElementById('asgn-subject')  ||{}).value||'';
  var group    = (document.getElementById('asgn-group')    ||{}).value||'ALL';
  var deadline = (document.getElementById('asgn-deadline') ||{}).value||'';
  var desc     = (document.getElementById('asgn-desc')     ||{}).value||'';
  var maxScore = parseInt((document.getElementById('asgn-maxscore')||{}).value)||100;

  if (!title.trim())  { showToast('⚠️','Xato','Sarlavha kiriting'); return; }
  if (!desc.trim())   { showToast('⚠️','Xato','Topshiriq matnini kiriting'); return; }
  if (!deadline)      { showToast('⚠️','Xato','Muddatni kiriting'); return; }

  try {
    await api('POST', '/assignments', {
      title: title.trim(), description: desc.trim(), subject: subject,
      group_name: group, deadline: new Date(deadline).toISOString(), max_score: maxScore
    });
    showToast('✅','Saqlandi','Vazifa muvaffaqiyatli yaratildi');
    document.getElementById('createAssignmentForm').style.display = 'none';
    ['asgn-title','asgn-desc'].forEach(function(id){ var el=document.getElementById(id); if(el) el.value=''; });
    renderTeacherAssignments();
  } catch(e) {
    showToast('❌','Xato','Serverga ulanishda muammo');
  }
}

async function deleteAssignment(id) {
  if (!confirm('Bu vazifani o\'chirmoqchimisiz?')) return;
  try {
    await api('DELETE', '/assignments/'+id);
    showToast('🗑️','O\'chirildi','Vazifa o\'chirildi');
    renderTeacherAssignments();
  } catch(e) {
    showToast('❌','Xato','O\'chirishda muammo');
  }
}

async function viewSubmissions(assignmentId, title) {
  var list  = document.getElementById('teacherAssignmentsList');
  var panel = document.getElementById('submissionsPanel');
  var slist = document.getElementById('submissionsList');
  var ptitle = document.getElementById('submissionsPanelTitle');
  if (!panel||!slist) return;
  if (list) list.style.display = 'none';
  panel.style.display = 'block';
  if (ptitle) ptitle.textContent = '📝 ' + title + ' — Javoblar';
  slist.innerHTML = '<div style="padding:20px;text-align:center;color:#94A3B8">Yuklanmoqda...</div>';

  try {
    var data = await api('GET', '/submissions/assignment/'+assignmentId);
    var subs = data.submissions || [];
    if (!subs.length) {
      slist.innerHTML = '<div style="padding:40px;text-align:center;color:#94A3B8">Hali hech kim javob bermagan</div>';
      return;
    }
    var sc = function(v){ return v>=86?'#16A34A':v>=56?'#D97706':'#DC2626'; };
    slist.innerHTML = '<div style="display:flex;flex-direction:column;gap:14px">'
      + subs.map(function(s){
        var ai = s.ai_ball!==null&&s.ai_ball!==undefined ? Number(s.ai_ball) : null;
        var ts = s.teacher_score!==null&&s.teacher_score!==undefined ? Number(s.teacher_score) : null;
        return '<div style="background:#fff;border:1.5px solid #E2E8F0;border-radius:14px;padding:20px">'
          + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:8px">'
            + '<div>'
              + '<div style="font-weight:800;font-size:15px;color:#0F172A">' + (s.student_name||'Talaba') + '</div>'
              + '<div style="font-size:12px;color:#64748B">' + (s.group_name||'') + ' · ' + new Date(s.submitted_at).toLocaleString('uz-UZ') + '</div>'
            + '</div>'
            + '<div style="display:flex;gap:10px">'
              + (ai!==null?'<div style="text-align:center;padding:8px 14px;background:#F0F9FF;border:1.5px solid #BAE6FD;border-radius:10px"><div style="font-size:18px;font-weight:900;color:'+sc(ai)+'">'+ai+'</div><div style="font-size:10px;color:#64748B;font-weight:600">AI BAHO</div></div>':'')
              + (ts!==null?'<div style="text-align:center;padding:8px 14px;background:#F0FDF4;border:1.5px solid #86EFAC;border-radius:10px"><div style="font-size:18px;font-weight:900;color:#16A34A">'+ts+'</div><div style="font-size:10px;color:#64748B;font-weight:600">YAKUNIY</div></div>':'')
            + '</div>'
          + '</div>'
          + '<div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;padding:14px;margin-bottom:12px;font-size:13px;color:#374151;line-height:1.6;max-height:140px;overflow-y:auto;white-space:pre-wrap">' + (s.content||'') + '</div>'
          + (s.ai_xatolar||s.ai_ijobiy||s.ai_tavsiyalar?'<div style="background:#FFF7ED;border:1px solid #FED7AA;border-radius:10px;padding:12px;margin-bottom:12px;font-size:12px;line-height:1.6">'
            + (s.ai_xatolar?'<div style="margin-bottom:4px"><strong style="color:#92400E">⚠️ Xatolar:</strong> '+s.ai_xatolar+'</div>':'')
            + (s.ai_ijobiy?'<div style="margin-bottom:4px"><strong style="color:#166534">✅ Ijobiy:</strong> '+s.ai_ijobiy+'</div>':'')
            + (s.ai_tavsiyalar?'<div><strong style="color:#1E40AF">💡 Tavsiya:</strong> '+s.ai_tavsiyalar+'</div>':'')
          + '</div>':'')
          + '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">'
            + '<input type="number" id="tscore_'+s.id+'" value="'+(ts!==null?ts:ai!==null?ai:'')+'" min="0" max="100" placeholder="Ball (0-100)" style="width:120px;padding:8px 12px;border:1.5px solid #E2E8F0;border-radius:8px;font-size:14px;font-weight:700">'
            + '<input type="text" id="tcomment_'+s.id+'" value="'+(s.teacher_comment||'')+'" placeholder="Izoh (ixtiyoriy)" style="flex:1;min-width:160px;padding:8px 12px;border:1.5px solid #E2E8F0;border-radius:8px;font-size:13px">'
            + '<button onclick="approveSubmission('+s.id+')" style="padding:9px 20px;background:#16A34A;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer">✅ Tasdiqlash</button>'
          + '</div>'
        + '</div>';
      }).join('')
    + '</div>';
  } catch(e) {
    slist.innerHTML = '<div style="padding:20px;text-align:center;color:#EF4444">Xato yuz berdi</div>';
  }
}

function closeSubmissionsPanel() {
  var panel = document.getElementById('submissionsPanel');
  var list  = document.getElementById('teacherAssignmentsList');
  if (panel) panel.style.display = 'none';
  if (list)  list.style.display  = '';
}

async function approveSubmission(subId) {
  var scoreEl   = document.getElementById('tscore_'+subId);
  var commentEl = document.getElementById('tcomment_'+subId);
  var score = scoreEl ? Number(scoreEl.value) : null;
  if (score===null||isNaN(score)||scoreEl.value==='') { showToast('⚠️','Xato','Ball kiriting (0-100)'); return; }
  try {
    await api('PATCH', '/submissions/'+subId+'/approve', {
      teacher_score: score,
      teacher_comment: commentEl ? commentEl.value.trim() : ''
    });
    showToast('✅','Tasdiqlandi',score+' ball berildi');
    // Update UI
    var wrap = scoreEl.closest ? scoreEl.closest('div[style*="border-radius:14px"]') : null;
    if (wrap) {
      var greenBox = wrap.querySelector('div[style*="F0FDF4"]');
      if (greenBox) { greenBox.querySelector('div').textContent = score; }
      else {
        var scoreArea = scoreEl.closest('div[style*="gap:10px"]');
        if (scoreArea) {
          var prev = scoreArea.previousElementSibling;
          if (prev) prev.insertAdjacentHTML('beforeend','<div style="text-align:center;padding:8px 14px;background:#F0FDF4;border:1.5px solid #86EFAC;border-radius:10px"><div style="font-size:18px;font-weight:900;color:#16A34A">'+score+'</div><div style="font-size:10px;color:#64748B;font-weight:600">YAKUNIY</div></div>');
        }
      }
    }
  } catch(e) {
    showToast('❌','Xato','Tasdiqlashda muammo');
  }
}

// ══════════════════════════════════════════════════════════════════
//  STUDENT PANEL
// ══════════════════════════════════════════════════════════════════

async function renderStudentAssignments() {
  var el = document.getElementById('studentAssignmentsList');
  if (!el) return;
  el.innerHTML = '<div style="padding:30px;text-align:center;color:#94A3B8">Yuklanmoqda...</div>';

  var assignments = [], mySubmissions = {};
  try {
    var results = await Promise.all([
      api('GET', '/assignments'),
      api('GET', '/submissions/my')
    ]);
    assignments = results[0].assignments || results[0] || [];
    (results[1].submissions||[]).forEach(function(s){ mySubmissions[s.assignment_id] = s; });
  } catch(e) {
    el.innerHTML = '<div style="padding:30px;text-align:center;color:#94A3B8">Yuklanishda xato. Qayta urinib ko\'ring.</div>';
    return;
  }

  if (!assignments.length) {
    el.innerHTML = '<div style="padding:40px;text-align:center;color:#94A3B8">'
      + '<div style="font-size:40px;margin-bottom:12px">📭</div>'
      + '<div style="font-weight:700;font-size:15px;margin-bottom:6px">Vazifalar yo\'q</div>'
      + '<div style="font-size:13px">O\'qituvchi hali vazifa bermagan</div></div>';
    return;
  }

  var subNames = { algo:'Algoritmlar', ai:"Sun'iy Intellekt", math:'Matematika', db:"Ma'lumotlar Bazasi", web:'Web Dasturlash' };

  el.innerHTML = '<div style="display:flex;flex-direction:column;gap:12px">'
    + assignments.map(function(a) {
      var sub = mySubmissions[a.id];
      var dead = a.deadline ? new Date(a.deadline) : null;
      var isExpired = dead && dead < new Date();
      var deadStr = dead ? dead.toLocaleString('uz-UZ',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '—';
      var ai = sub&&sub.ai_ball!==null&&sub.ai_ball!==undefined ? Number(sub.ai_ball) : null;
      var ts = sub&&sub.teacher_score!==null&&sub.teacher_score!==undefined ? Number(sub.teacher_score) : null;

      var badge;
      if (!sub) {
        badge = isExpired
          ? '<span style="padding:4px 12px;border-radius:20px;font-size:11px;font-weight:700;background:#FEE2E2;color:#DC2626">⏰ Muddat o\'tdi</span>'
          : '<span style="padding:4px 12px;border-radius:20px;font-size:11px;font-weight:700;background:#FEF3C7;color:#D97706">⏳ Topshirilmagan</span>';
      } else if (ts!==null) {
        badge = '<span style="padding:4px 12px;border-radius:20px;font-size:11px;font-weight:700;background:#DCFCE7;color:#16A34A">✅ Baholandi: '+ts+' ball</span>';
      } else {
        badge = '<span style="padding:4px 12px;border-radius:20px;font-size:11px;font-weight:700;background:#DBEAFE;color:#1D4ED8">🤖 AI: '+(ai!==null?ai:'—')+' ball</span>';
      }

      var safeDesc = (a.description||'').replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/\n/g,' ');
      var safeTitle = (a.title||'').replace(/'/g,"\\'");
      var deadMs = dead ? dead.getTime() : 0;

      return '<div style="background:#fff;border:1.5px solid #E2E8F0;border-radius:14px;padding:18px 20px">'
        + '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap">'
          + '<div style="flex:1;min-width:200px">'
            + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;flex-wrap:wrap">'
              + '<div style="font-size:16px;font-weight:800;color:#0F172A">'+(a.title||'')+'</div>'
              + badge
            + '</div>'
            + '<div style="font-size:12px;color:#64748B;margin-bottom:8px">'
              + '📚 '+(subNames[a.subject]||a.subject||'')+' &nbsp;·&nbsp; 📅 '+deadStr
              + (a.teacher_name?' &nbsp;·&nbsp; 👨‍🏫 '+a.teacher_name:'')
            + '</div>'
            + '<div style="font-size:13px;color:#475569;line-height:1.5">'+((a.description||'').substring(0,150))+(a.description&&a.description.length>150?'...':'')+'</div>'
            + (sub&&(sub.ai_ijobiy||sub.ai_tavsiyalar)?'<div style="margin-top:10px;background:#F0FDF4;border:1px solid #86EFAC;border-radius:8px;padding:10px 12px;font-size:12px;color:#166534">'
              + (sub.ai_ijobiy?'<div>✅ '+sub.ai_ijobiy+'</div>':'')
              + (sub.ai_tavsiyalar?'<div style="color:#1E40AF;margin-top:4px">💡 '+sub.ai_tavsiyalar+'</div>':'')
            +'</div>':'')
          + '</div>'
          + (!isExpired?'<button onclick="openAssignmentModal('+a.id+',\''+safeTitle+'\',\''+safeDesc+'\',\''+(a.subject||'')+'\','+deadMs+')" style="padding:10px 20px;background:'+(sub?'#1B4FD8':'#16A34A')+';color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;flex-shrink:0">'+(sub?'✏️ Qayta topshirish':'📤 Topshirish')+'</button>':'')
        + '</div>'
      +'</div>';
    }).join('')
  + '</div>';
}

function openAssignmentModal(id, title, desc, subject, deadlineMs) {
  _asgnState.id = id;
  _asgnState.title = title;
  _asgnState.deadline = deadlineMs ? new Date(deadlineMs) : null;

  var modal = document.getElementById('assignmentModal');
  if (!modal) return;

  var subNames = { algo:'Algoritmlar', ai:"Sun'iy Intellekt", math:'Matematika', db:"Ma'lumotlar Bazasi", web:'Web Dasturlash' };
  document.getElementById('asgnModalTitle').textContent   = title;
  document.getElementById('asgnModalSubject').textContent = subNames[subject]||subject||'';
  document.getElementById('asgnModalDesc').textContent    = desc;
  document.getElementById('asgnAnswerText').value         = '';
  document.getElementById('asgnAiResult').style.display   = 'none';

  var btn = document.getElementById('asgnSubmitBtn');
  if (btn) { btn.disabled=false; btn.textContent='📤 Topshirish'; btn.style.background='#16A34A'; }

  // Countdown timer
  if (_asgnState.timerInterval) clearInterval(_asgnState.timerInterval);
  var timerEl = document.getElementById('asgnModalDeadline');
  var clockEl = document.getElementById('asgnModalTimer');
  if (_asgnState.deadline) {
    var deadStr = _asgnState.deadline.toLocaleString('uz-UZ',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
    if (timerEl) timerEl.textContent = '⏰ '+deadStr;
    _asgnState.timerInterval = setInterval(function(){
      var left = _asgnState.deadline - Date.now();
      if (left<=0){ if(clockEl) clockEl.textContent='Muddat o\'tdi'; clearInterval(_asgnState.timerInterval); return; }
      var h=Math.floor(left/3600000), m=Math.floor((left%3600000)/60000);
      if (clockEl) clockEl.textContent=(h>0?h+'h ':'')+m+'m qoldi';
    }, 15000);
  }

  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';

  // Block new windows
  _origWindowOpenAsgn = window.open;
  window.open = function(){ showToast('🔒','Taqiqlangan','Yangi oyna ochish mumkin emas'); return null; };

  // Block copy/paste/cut
  document.addEventListener('keydown', _blockAsgnKeys);
  document.addEventListener('copy',    _blockAsgnCopy);
  document.addEventListener('paste',   _blockAsgnCopy);
  document.addEventListener('cut',     _blockAsgnCopy);

  // Fullscreen
  try { document.documentElement.requestFullscreen(); } catch(e) {}
}

function _blockAsgnKeys(e) {
  if ((e.ctrlKey||e.metaKey) && ['c','v','x','a','u','s'].includes(e.key.toLowerCase())) {
    e.preventDefault();
  }
}
function _blockAsgnCopy(e) { e.preventDefault(); }

function closeAssignmentModal() {
  var modal = document.getElementById('assignmentModal');
  if (modal) modal.style.display = 'none';
  document.body.style.overflow = '';
  if (_asgnState.timerInterval){ clearInterval(_asgnState.timerInterval); _asgnState.timerInterval=null; }
  if (_origWindowOpenAsgn){ window.open=_origWindowOpenAsgn; _origWindowOpenAsgn=null; }
  document.removeEventListener('keydown', _blockAsgnKeys);
  document.removeEventListener('copy',    _blockAsgnCopy);
  document.removeEventListener('paste',   _blockAsgnCopy);
  document.removeEventListener('cut',     _blockAsgnCopy);
  try { document.exitFullscreen(); } catch(e) {}
}

async function submitAssignmentAnswer() {
  var answer = (document.getElementById('asgnAnswerText')||{}).value||'';
  if (!answer.trim()){ showToast('⚠️','Xato','Javobingizni yozing'); return; }
  if (!_asgnState.id){ showToast('⚠️','Xato','Vazifa aniqlanmadi'); return; }

  var btn = document.getElementById('asgnSubmitBtn');
  if (btn){ btn.disabled=true; btn.textContent='⏳ AI tekshirmoqda...'; btn.style.background='#D97706'; }

  try {
    var result = await api('POST', '/submissions', { assignment_id:_asgnState.id, content:answer.trim() });
    var ai = result.ai_feedback || {};
    var aiScore = result.submission ? Number(result.submission.ai_ball) : Number(ai.ball||0);
    var scoreColor = aiScore>=86?'#16A34A':aiScore>=56?'#D97706':'#DC2626';

    var aiBox = document.getElementById('asgnAiResult');
    if (aiBox) {
      aiBox.style.display = 'block';
      aiBox.innerHTML = '<div style="font-size:11px;font-weight:700;color:#93C5FD;margin-bottom:10px;text-transform:uppercase">🤖 AI Baholash natijasi</div>'
        + '<div style="font-size:36px;font-weight:900;color:'+scoreColor+';margin-bottom:12px;font-family:\'DM Mono\',monospace">'+(aiScore||0)+' <span style="font-size:14px;font-weight:500;color:#64748B">/ 100</span></div>'
        + (ai.ijobiy    ?'<div style="color:#86EFAC;font-size:13px;line-height:1.5;margin-bottom:6px">✅ <b>Ijobiy:</b> '+ai.ijobiy+'</div>':'')
        + (ai.xatolar   ?'<div style="color:#FCA5A5;font-size:13px;line-height:1.5;margin-bottom:6px">⚠️ <b>Xatolar:</b> '+ai.xatolar+'</div>':'')
        + (ai.tavsiyalar?'<div style="color:#93C5FD;font-size:13px;line-height:1.5;margin-bottom:6px">💡 <b>Tavsiya:</b> '+ai.tavsiyalar+'</div>':'')
        + '<div style="margin-top:12px;padding:10px;background:rgba(255,255,255,0.05);border-radius:8px;font-size:11px;color:#94A3B8">O\'qituvchi yakuniy bahoni tasdiqlaydi</div>';
    }

    if (btn){ btn.textContent='✅ Topshirildi'; btn.style.background='#16A34A'; btn.disabled=true; }
    showToast('✅','Topshirildi','AI bahosi: '+(aiScore||0)+' ball. O\'qituvchi tasdiqlaydi');
  } catch(e) {
    if (btn){ btn.disabled=false; btn.textContent='📤 Topshirish'; btn.style.background='#16A34A'; }
    showToast('❌','Xato','Serverga ulanishda muammo');
  }
}

// ══════════════════════════════════════════════════════════════════
//  FORGOT PASSWORD
// ══════════════════════════════════════════════════════════════════

function showForgotPassword() {
  var m = document.getElementById('forgotModal');
  if (m) m.style.display = 'flex';
}
function closeForgotModal() {
  var m = document.getElementById('forgotModal');
  if (m) m.style.display = 'none';
}
function submitForgotPassword() {
  var name  = (document.getElementById('forgotName') ||{}).value||'';
  var phone = (document.getElementById('forgotPhone')||{}).value||'';
  if (!name.trim())  { showToast('⚠️','Xato','Ismingizni kiriting'); return; }
  if (!phone.trim()) { showToast('⚠️','Xato','Telefon raqam kiriting'); return; }
  var btn = document.getElementById('forgotSubmitBtn');
  if (btn){ btn.disabled=true; btn.textContent='✅ Yuborildi'; }
  var box = document.getElementById('forgotSuccessBox');
  if (box) box.style.display='block';
  showToast('✅','So\'rov yuborildi','Dekanat siz bilan bog\'lanadi');
}

// Legacy stubs (used by old dashboard widget)
function renderDashboardTasks(){
  var el=document.getElementById('upcomingTasks'); if(!el)return;
  el.innerHTML='<div style="padding:16px;text-align:center;color:#94A3B8;font-size:13px">Vazifalar yuklanmoqda...</div>';
  api('GET','/assignments').then(function(d){
    var list=(d.assignments||d||[]).slice(0,3);
    if(!list.length){el.innerHTML='<div style="padding:16px;text-align:center;color:#94A3B8;font-size:13px">Vazifalar yo\'q</div>';return;}
    el.innerHTML=list.map(function(a){
      var dead=a.deadline?new Date(a.deadline):null;
      return '<div class="task-item"><div class="task-top"><div><div class="task-subject" style="color:var(--primary)">'+(a.subject||'')+'</div><div class="task-name">'+(a.title||'')+'</div>'+(dead?'<div class="task-due">📅 '+dead.toLocaleDateString('uz-UZ')+'</div>':'')+'</div></div></div>';
    }).join('');
  }).catch(function(){});
}
function renderTasks(){ renderStudentAssignments(); }
function filterTasks(f,btn){
  document.querySelectorAll('#page-tasks .filter-chip').forEach(function(c){c.classList.remove('active');});
  if(btn) btn.classList.add('active');
  renderStudentAssignments();
}
