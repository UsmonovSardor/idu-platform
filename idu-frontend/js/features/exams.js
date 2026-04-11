'use strict';
// IDU Platform — features/exams.js

async function apiSubmitExam(attemptId, answers) {
  if (!_apiToken || !attemptId) return null;
  try {
    return await api('POST', '/exams/' + attemptId + '/submit', { answers: answers });
  } catch(e) {
    return null;
  }
}

function saveSession(role, user) {
  _lsSet('idu_session', JSON.stringify({role, login:user.login, ts:Date.now()}));
}

function loadSavedSession() {
  try {
    const s = JSON.parse(_lsGet('idu_session') || 'null');
    if (!s) return;
    if (Date.now() - s.ts > 7 * 24 * 3600 * 1000) { _lsDel('idu_session'); return; }
    const u = USERS[s.role] && USERS[s.role].find(x => x.login === s.login);
    if (u) {
      const storedPhone = _lsGet('idu_phone_' + s.role + ':' + s.login);
      if (storedPhone && !u.phone) u.phone = storedPhone;
      launchApp(s.role, u);
    }
  } catch(e){}
}

function deleteStudent(){
  const id=parseInt(document.getElementById('editStudentId').value);
  const s=STUDENTS_DATA.find(s=>s.id===id);
  if(!s) return;
  if(!confirm(`${s.name}ni o'chirishni tasdiqlaysizmi?`)) return;
  const idx=STUDENTS_DATA.findIndex(s=>s.id===id);
  STUDENTS_DATA.splice(idx,1);
  closeStudentModal();
  showToast('ðï¸','O\'chirildi',`${s.name} ro'yxatdan o'chirildi`);
  renderDekanatStudents();
}

function openQuiz(){quizIdx=0;quizScore=0;renderQuiz();document.getElementById('quizModal').classList.add('open');}

function closeQuiz(){document.getElementById('quizModal').classList.remove('open');}

function renderQuiz(){
  const qEl=document.getElementById('quizContent');if(!qEl)return;
  if(quizIdx>=QUIZ_QUESTIONS.length){
    const pct=Math.round(quizScore/QUIZ_QUESTIONS.length*100);
    qEl.innerHTML=`<div class="quiz-result">
      <div class="quiz-result-pct" style="color:${pct>=80?'var(--green)':pct>=50?'var(--primary)':'var(--red)'}">${pct}%</div>
      <div class="quiz-result-msg">${quizScore}/${QUIZ_QUESTIONS.length} to'g'ri javob<br>${pct>=80?'ð A\'lo natija!':pct>=50?'ð Yaxshi!':'ðª Ko\'proq o\'rganing!'}</div>
      <div class="quiz-result-btns">
        <button class="btn btn-secondary" onclick="closeQuiz()">Yopish</button>
        <button class="btn btn-primary" onclick="openQuiz()">Qayta boshlash</button>
      </div>
    </div>`;
    return;
  }
  const q=QUIZ_QUESTIONS[quizIdx];
  qEl.innerHTML=`
    <div class="quiz-prog-bar"><div class="quiz-prog-fill" style="width:${quizIdx/QUIZ_QUESTIONS.length*100}%"></div></div>
    <div class="quiz-meta-row"><span>${quizIdx+1}/${QUIZ_QUESTIONS.length} savol</span><span id="quizTimer">â± 30s</span></div>
    <div class="quiz-question">${q.q}</div>
    <div class="quiz-opts">${q.opts.map((o,i)=>`
      <div class="quiz-opt" onclick="answerQuiz(${i})" id="qopt${i}">
        <div class="opt-ltr">${'ABCD'[i]}</div>${o}
      </div>`).join('')}
    </div>`;
  let t=30;
  clearInterval(window.quizTimerInt);
  window.quizTimerInt=setInterval(()=>{
    t--;
    const te=document.getElementById('quizTimer');
    if(te)te.textContent=`â± ${t}s`;
    if(t<=0){clearInterval(window.quizTimerInt);answerQuiz(-1);}
  },1000);
}

function answerQuiz(idx){
  clearInterval(window.quizTimerInt);
  const q=QUIZ_QUESTIONS[quizIdx];
  document.querySelectorAll('.quiz-opt').forEach((el,i)=>{
    el.classList.add('locked');
    if(i===q.ans)el.classList.add('correct');
    else if(i===idx&&idx!==q.ans)el.classList.add('wrong');
  });
  if(idx===q.ans)quizScore++;
  setTimeout(()=>{quizIdx++;renderQuiz();},1000);
}

function updateStreak(){
  const today=new Date().toDateString();
  const lastDay=localStorage.getItem('idu_last_day');
  if(lastDay!==today){
    localStorage.setItem('idu_last_day',today);
    streakDays++;
    if(streakDays>streakRecord){streakRecord=streakDays;localStorage.setItem('idu_streak_record',streakRecord);}
    localStorage.setItem('idu_streak',streakDays);
    const sn=document.getElementById('streakNum');if(sn)sn.textContent=streakDays;
    const sr=document.getElementById('streakRecord');if(sr)sr.textContent=streakRecord;
    showToast('ð¥','Streak!',`${streakDays} kunlik streak davom etmoqda!`);
  }
}

function getRealQuestions(subj) {
  var base = TEST_QUESTIONS_DB[subj] || [];
  var extra = REAL_EXTRA_QUESTIONS[subj] || [];
  return base.concat(extra);
}

function renderSesiyaTest() {
  var locked = document.getElementById('stest-locked');
  var instr = document.getElementById('stest-instructions');
  var active = document.getElementById('stest-active');
  var results = document.getElementById('stest-results');
  if (!locked) return;
  if (SESIYA_STATE.test) {
    locked.style.display = 'none';
    active.style.display = 'none';
    results.style.display = 'none';
    instr.style.display = 'block';
    document.getElementById('testPageSub').textContent = 'Fan tanlang va testni boshlang';
  } else {
    locked.style.display = 'flex';
    instr.style.display = 'none';
    active.style.display = 'none';
    results.style.display = 'none';
    if (_testTimer) { clearInterval(_testTimer); _testTimer = null; }
  }
}

function showTestInstructions() {
  if (_testTimer) { clearInterval(_testTimer); _testTimer = null; }
  _testAnswers = {};
  document.getElementById('stest-instructions').style.display = 'block';
  document.getElementById('stest-active').style.display = 'none';
  document.getElementById('stest-results').style.display = 'none';
  document.getElementById('testPageSub').textContent = 'Fan tanlang va testni boshlang';
}

function startTestWithSubject(subj) {
  _currentTestSubject = subj;
  _currentTestQuestions = TEST_QUESTIONS_DB[subj] || [];
  _testAnswers = {};

  var icons = {algo:'ð»', ai:'ð¤', math:'ð', db:'ðï¸', web:'ð'};
  var names = {algo:'Algoritmlar va Dasturlash', ai:"Sun'iy Intellekt", math:'Matematika (AI uchun)', db:"Ma'lumotlar Bazasi", web:'Web Dasturlash'};

  document.getElementById('testSubjectIcon').textContent = icons[subj] || 'ð';
  document.getElementById('testSubjectName').textContent = names[subj] || subj;
  document.getElementById('testProgressLabel').textContent = '0/' + _currentTestQuestions.length;
  document.getElementById('testProgressBar').style.width = '0%';
  document.getElementById('testPageSub').textContent = names[subj] + ' Â· Mashq rejim';

  // Render questions
  var container = document.getElementById('testQuestionsContainer');
  var html = '';
  _currentTestQuestions.forEach(function(q, i) {
    html += '<div id="tq-' + i + '" style="background:white;border:1.5px solid #E2E8F0;border-radius:12px;padding:18px 20px;margin-bottom:14px;transition:border-color 0.2s">';
    html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:14px">';
    html += '<div style="font-size:13.5px;font-weight:700;color:#0F172A;line-height:1.5"><span style="color:#94A3B8;margin-right:6px">' + (i+1) + '.</span>' + q.q + '</div>';
    html += '<button onclick="toggleEtirozBox(' + i + ')" style="white-space:nowrap;padding:4px 10px;background:#FFF7ED;border:1px solid #FED7AA;border-radius:6px;font-size:11px;font-weight:600;color:#EA580C;cursor:pointer;font-family:\'Outfit\',sans-serif">â ï¸ E\'tiroz</button>';
    html += '</div>';
    html += '<div style="display:flex;flex-direction:column;gap:8px">';
    q.opts.forEach(function(opt, j) {
      html += '<label id="tq-' + i + '-opt-' + j + '" style="display:flex;align-items:center;gap:10px;padding:10px 14px;border:1.5px solid #E2E8F0;border-radius:8px;cursor:pointer;font-size:13px;transition:all 0.15s" onmouseover="this.style.borderColor=\'#1B4FD8\';this.style.background=\'#F8FBFF\'" onmouseout="this.style.borderColor=(document.getElementById(\'tq'+i+'ans\').value===\''+j+'\'?\'#1B4FD8\':\'#E2E8F0\');this.style.background=(document.getElementById(\'tq'+i+'ans\').value===\''+j+'\'?\'#EEF3FF\':\'white\')">';
      html += '<input type="radio" name="tq' + i + '" value="' + j + '" style="accent-color:#1B4FD8;width:16px;height:16px" onchange="onTestAnswer(' + i + ',' + j + ')"> ' + opt;
      html += '</label>';
    });
    html += '</div>';
    html += '<input type="hidden" id="tq' + i + 'ans" value="">';
    // E'tiroz box
    html += '<div id="etirozBox' + i + '" style="display:none;margin-top:12px;background:#FFF7ED;border:1.5px solid #FED7AA;border-radius:10px;padding:14px">';
    html += '<div style="font-size:12px;font-weight:700;color:#92400E;margin-bottom:8px">â ï¸ ' + (i+1) + '-savol bo\'yicha e\'tiroz:</div>';
    html += '<textarea id="etirozText' + i + '" placeholder="E\'tirozingiz sababini yozing..." style="width:100%;padding:10px;border:1.5px solid #FED7AA;border-radius:8px;font-family:\'Outfit\',sans-serif;font-size:13px;resize:vertical;min-height:70px;outline:none;box-sizing:border-box"></textarea>';
    html += '<div style="display:flex;gap:8px;margin-top:8px">';
    html += '<button onclick="submitEtiraz(' + i + ')" style="padding:7px 16px;background:#EA580C;color:white;border:none;border-radius:7px;font-family:\'Outfit\',sans-serif;font-size:12.5px;font-weight:700;cursor:pointer">ð¤ Dekanatga yuborish</button>';
    html += '<button onclick="document.getElementById(\'etirozBox' + i + '\').style.display=\'none\'" style="padding:7px 14px;background:white;border:1.5px solid #E2E8F0;border-radius:7px;font-family:\'Outfit\',sans-serif;font-size:12.5px;cursor:pointer">Bekor</button>';
    html += '</div></div>';
    html += '</div>';
  });
  container.innerHTML = html;

  // Show active, hide instructions
  document.getElementById('stest-instructions').style.display = 'none';
  document.getElementById('stest-active').style.display = 'block';
  document.getElementById('stest-results').style.display = 'none';

  // Start timer
  if (_testTimer) clearInterval(_testTimer);
  _testSec = 30 * 60;
  document.getElementById('testTimerDisplay').textContent = '30:00';
  _testTimer = setInterval(function() {
    _testSec--;
    var m = Math.floor(_testSec/60).toString().padStart(2,'0');
    var s = (_testSec%60).toString().padStart(2,'0');
    var el = document.getElementById('testTimerDisplay');
    if (el) {
      el.textContent = m + ':' + s;
      el.style.color = _testSec < 300 ? '#DC2626' : '#1B4FD8';
    }
    if (_testSec <= 0) { clearInterval(_testTimer); _testTimer = null; submitTestExam(); }
  }, 1000);

  window.scrollTo({top: 0, behavior: 'smooth'});
}

function onTestAnswer(qi, optIdx) {
  _testAnswers[qi] = optIdx;
  var hidden = document.getElementById('tq' + qi + 'ans');
  if (hidden) hidden.value = optIdx;
  // Style the selected option
  var qs = TEST_QUESTIONS_DB[_currentTestSubject][qi];
  qs.opts.forEach(function(_, j) {
    var lbl = document.getElementById('tq-' + qi + '-opt-' + j);
    if (lbl) {
      lbl.style.borderColor = j === optIdx ? '#1B4FD8' : '#E2E8F0';
      lbl.style.background = j === optIdx ? '#EEF3FF' : 'white';
    }
  });
  // Mark question card
  var card = document.getElementById('tq-' + qi);
  if (card) card.style.borderColor = '#86EFAC';
  // Update answered count and progress
  var answered = Object.keys(_testAnswers).length;
  var total = _currentTestQuestions.length;
  var pct = Math.round(answered / total * 100);
  var pb = document.getElementById('testProgressBar');
  if (pb) pb.style.width = pct + '%';
  var pl = document.getElementById('testProgressLabel');
  if (pl) pl.textContent = answered + '/' + total;
  var ac = document.getElementById('testAnsweredCount');
  if (ac) ac.textContent = answered + ' ta savol javob berildi';
}

function startExamTimer(type) {
  if (type === 'test') {
    if (_testTimer) return;
    _testSec = 30 * 60;
    _testTimer = setInterval(function() {
      _testSec--;
      var el = document.getElementById('testTimerDisplay');
      if (el) el.textContent = Math.floor(_testSec/60).toString().padStart(2,'0') + ':' + (_testSec%60).toString().padStart(2,'0');
      if (_testSec <= 0) { clearInterval(_testTimer); _testTimer = null; submitTestExam(); }
    }, 1000);
  } else {
    if (_realTimer) return;
    _realSec = 90 * 60;
    _realTimer = setInterval(function() {
      _realSec--;
      var el = document.getElementById('realTimerDisplay');
      if (el) el.textContent = Math.floor(_realSec/60).toString().padStart(2,'0') + ':' + (_realSec%60).toString().padStart(2,'0');
      if (_realSec <= 0) { clearInterval(_realTimer); _realTimer = null; submitRealExam(); }
    }, 1000);
  }
}

function submitTestExam() {
  if (_testTimer) { clearInterval(_testTimer); _testTimer = null; }

  var qs = _currentTestQuestions;
  var total = qs.length;
  var correct = 0;
  var resultRows = '';

  qs.forEach(function(q, i) {
    var chosen = (_testAnswers[i] !== undefined) ? parseInt(_testAnswers[i]) : -1;
    var isCorrect = chosen === q.ans;
    if (isCorrect) correct++;
    var statusIcon = isCorrect ? 'â' : (chosen === -1 ? 'â¬' : 'â');
    var statusColor = isCorrect ? '#16A34A' : (chosen === -1 ? '#94A3B8' : '#DC2626');
    var statusBg = isCorrect ? '#DCFCE7' : (chosen === -1 ? '#F1F5F9' : '#FEE2E2');

    resultRows += '<div style="background:white;border:1.5px solid ' + (isCorrect ? '#86EFAC' : (chosen===-1?'#E2E8F0':'#FCA5A5')) + ';border-radius:12px;padding:16px 18px;margin-bottom:10px">';
    resultRows += '<div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:' + (isCorrect?'0':'10px') + '">';
    resultRows += '<span style="min-width:26px;height:26px;border-radius:50%;background:' + statusBg + ';display:flex;align-items:center;justify-content:center;font-size:14px">' + statusIcon + '</span>';
    resultRows += '<div style="flex:1">';
    resultRows += '<div style="font-size:13px;font-weight:700;color:#0F172A;line-height:1.5"><span style="color:#94A3B8;margin-right:5px">' + (i+1) + '.</span>' + q.q + '</div>';
    if (!isCorrect && chosen !== -1) {
      resultRows += '<div style="margin-top:8px;font-size:12.5px;color:#DC2626">â Sizning javobingiz: <strong>' + q.opts[chosen] + '</strong></div>';
    } else if (chosen === -1) {
      resultRows += '<div style="margin-top:8px;font-size:12.5px;color:#94A3B8">â¬ Javob berilmadi</div>';
    }
    if (!isCorrect) {
      resultRows += '<div style="margin-top:6px;font-size:12.5px;color:#16A34A">â To\'g\'ri javob: <strong>' + q.opts[q.ans] + '</strong></div>';
    }
    resultRows += '</div></div>';
    // Always show explanation
    resultRows += '<div style="background:#F8FAFC;border-radius:8px;padding:10px 12px;margin-top:' + (isCorrect?'10px':'4px') + ';border:1px solid #E2E8F0">';
    resultRows += '<span style="font-size:11px;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:0.4px">ð¡ Izoh: </span>';
    resultRows += '<span style="font-size:12.5px;color:#334155">' + q.izoh + '</span>';
    resultRows += '</div>';
    resultRows += '</div>';
  });

  var pct = Math.round(correct / total * 100);
  var grade = pct >= 86 ? {l:'A', c:'#16A34A', bg:'#DCFCE7'} : pct >= 71 ? {l:'B', c:'#2563EB', bg:'#DBEAFE'} : pct >= 56 ? {l:'C', c:'#D97706', bg:'#FEF3C7'} : pct >= 41 ? {l:'D', c:'#EA580C', bg:'#FFF7ED'} : {l:'F', c:'#DC2626', bg:'#FEE2E2'};
  var msg = pct >= 86 ? "ð A'lo! Zo'r natija!" : pct >= 71 ? "ð Yaxshi natija!" : pct >= 56 ? "ðª Qoniqarli, ko'proq o'rganing!" : "ð Yaxshiroq tayyorlaning!";

  var html = '';
  // Score card
  html += '<div style="background:linear-gradient(135deg,' + grade.bg + ',white);border:2px solid ' + grade.c + ';border-radius:16px;padding:28px;margin-bottom:22px;text-align:center">';
  html += '<div style="font-size:52px;font-weight:900;color:' + grade.c + ';font-family:\'DM Mono\',monospace">' + grade.l + '</div>';
  html += '<div style="font-size:28px;font-weight:800;color:#0F172A;margin:8px 0">' + pct + '%</div>';
  html += '<div style="font-size:15px;font-weight:600;color:#475569;margin-bottom:12px">' + correct + ' / ' + total + ' to\'g\'ri javob</div>';
  html += '<div style="font-size:14px;color:' + grade.c + ';font-weight:700">' + msg + '</div>';
  html += '</div>';
  // Stats row
  html += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:22px">';
  html += '<div style="background:white;border:1.5px solid #86EFAC;border-radius:12px;padding:14px;text-align:center"><div style="font-size:22px;font-weight:800;color:#16A34A">' + correct + '</div><div style="font-size:12px;color:#64748B;margin-top:3px">To\'g\'ri</div></div>';
  html += '<div style="background:white;border:1.5px solid #FCA5A5;border-radius:12px;padding:14px;text-align:center"><div style="font-size:22px;font-weight:800;color:#DC2626">' + (total - correct - (total - Object.keys(_testAnswers).length)) + '</div><div style="font-size:12px;color:#64748B;margin-top:3px">Noto\'g\'ri</div></div>';
  html += '<div style="background:white;border:1.5px solid #E2E8F0;border-radius:12px;padding:14px;text-align:center"><div style="font-size:22px;font-weight:800;color:#94A3B8">' + (total - Object.keys(_testAnswers).length) + '</div><div style="font-size:12px;color:#64748B;margin-top:3px">Javobsiz</div></div>';
  html += '</div>';
  // Detailed results
  html += '<div style="font-size:15px;font-weight:800;color:#0F172A;margin-bottom:14px">ð Batafsil natijalar:</div>';
  html += resultRows;

  document.getElementById('testResultsContent').innerHTML = html;
  document.getElementById('stest-active').style.display = 'none';
  document.getElementById('stest-results').style.display = 'block';
  document.getElementById('testPageSub').textContent = 'Test yakunlandi Â· ' + correct + '/' + total + ' to\'g\'ri';
  window.scrollTo({top: 0, behavior: 'smooth'});
  showToast('ð', 'Test yakunlandi!', correct + '/' + total + ' to\'g\'ri javob Â· ' + grade.l + ' baho', 'blue');
}

function submitRealExam() {
  if (_realTimer) { clearInterval(_realTimer); _realTimer = null; }

  var qs = _currentRealQuestions;
  var total = qs.length;
  var correct = 0;
  var resultRows = '';

  qs.forEach(function(q, i) {
    var chosen = (_realAnswers[i] !== undefined) ? parseInt(_realAnswers[i]) : -1;
    var isCorrect = chosen === q.ans;
    if (isCorrect) correct++;
    var statusIcon = isCorrect ? 'â' : (chosen === -1 ? 'â¬' : 'â');
    var statusBg = isCorrect ? '#DCFCE7' : (chosen === -1 ? '#F1F5F9' : '#FEE2E2');

    resultRows += '<div style="background:white;border:1.5px solid ' + (isCorrect ? '#86EFAC' : (chosen===-1?'#E2E8F0':'#FCA5A5')) + ';border-radius:12px;padding:16px 18px;margin-bottom:10px">';
    resultRows += '<div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:' + (isCorrect?'0':'10px') + '">';
    resultRows += '<span style="min-width:26px;height:26px;border-radius:50%;background:' + statusBg + ';display:flex;align-items:center;justify-content:center;font-size:14px">' + statusIcon + '</span>';
    resultRows += '<div style="flex:1">';
    resultRows += '<div style="font-size:13px;font-weight:700;color:#0F172A;line-height:1.5"><span style="color:#94A3B8;margin-right:5px">' + (i+1) + '.</span>' + q.q + '</div>';
    if (!isCorrect && chosen !== -1) {
      resultRows += '<div style="margin-top:8px;font-size:12.5px;color:#DC2626">â Sizning javobingiz: <strong>' + q.opts[chosen] + '</strong></div>';
    } else if (chosen === -1) {
      resultRows += '<div style="margin-top:8px;font-size:12.5px;color:#94A3B8">â¬ Javob berilmadi</div>';
    }
    if (!isCorrect) {
      resultRows += '<div style="margin-top:6px;font-size:12.5px;color:#16A34A">â To\'g\'ri javob: <strong>' + q.opts[q.ans] + '</strong></div>';
    }
    resultRows += '</div></div>';
    resultRows += '<div style="background:#F8FAFC;border-radius:8px;padding:10px 12px;margin-top:' + (isCorrect?'10px':'4px') + ';border:1px solid #E2E8F0">';
    resultRows += '<span style="font-size:11px;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:0.4px">ð¡ Izoh: </span>';
    resultRows += '<span style="font-size:12.5px;color:#334155">' + q.izoh + '</span>';
    resultRows += '</div></div>';
  });

  var pct = Math.round(correct / total * 100);
  var ball = Math.round(pct); // 100 ball scale
  var grade = pct >= 86 ? {l:'A (A\'lo)', c:'#16A34A', bg:'#DCFCE7'} : pct >= 71 ? {l:'B (Yaxshi)', c:'#2563EB', bg:'#DBEAFE'} : pct >= 56 ? {l:'C (Qoniqarli)', c:'#D97706', bg:'#FEF3C7'} : pct >= 41 ? {l:'D (Qoniqarsiz)', c:'#EA580C', bg:'#FFF7ED'} : {l:'F (Yiqildi)', c:'#DC2626', bg:'#FEE2E2'};
  var msg = pct >= 86 ? "ð Zo'r natija! Imtihonni muvaffaqiyatli topshirdingiz!" : pct >= 71 ? "ð Yaxshi natija!" : pct >= 56 ? "â Qoniqarli natija." : pct >= 41 ? "â ï¸ Qoniqarsiz. Qayta topshirish tavsiya etiladi." : "â Imtihondan o'tmadingiz. Dekanatga murojaat qiling.";

  var html = '';
  html += '<div style="background:linear-gradient(135deg,' + grade.bg + ',white);border:2px solid ' + grade.c + ';border-radius:16px;padding:28px;margin-bottom:22px;text-align:center">';
  html += '<div style="font-size:14px;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">RASMIY IMTIHON NATIJASI</div>';
  html += '<div style="font-size:44px;font-weight:900;color:' + grade.c + ';margin-bottom:4px">' + ball + '</div>';
  html += '<div style="font-size:16px;color:#64748B;margin-bottom:8px">ball / 100</div>';
  html += '<div style="font-size:18px;font-weight:800;color:' + grade.c + ';margin-bottom:10px">' + grade.l + '</div>';
  html += '<div style="font-size:15px;font-weight:600;color:#475569;margin-bottom:10px">' + correct + ' / ' + total + ' to\'g\'ri javob</div>';
  html += '<div style="font-size:14px;color:' + grade.c + ';font-weight:700">' + msg + '</div>';
  html += '</div>';

  html += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:22px">';
  html += '<div style="background:white;border:1.5px solid #86EFAC;border-radius:12px;padding:14px;text-align:center"><div style="font-size:22px;font-weight:800;color:#16A34A">' + correct + '</div><div style="font-size:12px;color:#64748B;margin-top:3px">To\'g\'ri</div></div>';
  html += '<div style="background:white;border:1.5px solid #FCA5A5;border-radius:12px;padding:14px;text-align:center"><div style="font-size:22px;font-weight:800;color:#DC2626">' + (total - correct - (total - Object.keys(_realAnswers).length)) + '</div><div style="font-size:12px;color:#64748B;margin-top:3px">Noto\'g\'ri</div></div>';
  html += '<div style="background:white;border:1.5px solid #E2E8F0;border-radius:12px;padding:14px;text-align:center"><div style="font-size:22px;font-weight:800;color:#94A3B8">' + (total - Object.keys(_realAnswers).length) + '</div><div style="font-size:12px;color:#64748B;margin-top:3px">Javobsiz</div></div>';
  html += '</div>';

  html += '<div style="background:#F0FDF4;border:1.5px solid #86EFAC;border-radius:12px;padding:14px 16px;margin-bottom:20px;display:flex;align-items:center;gap:12px">';
  html += '<span style="font-size:22px">ð¤</span><div><div style="font-size:13px;font-weight:700;color:#16A34A">Imtihon topshirildi!</div><div style="font-size:12.5px;color:#64748B">Natijalaringiz dekanatga yuborildi va saqlanmoqda.</div></div>';
  html += '</div>';

  html += '<div style="font-size:15px;font-weight:800;color:#0F172A;margin-bottom:14px">ð Batafsil natijalar va izohlar:</div>';
  html += resultRows;

  document.getElementById('realResultsContent').innerHTML = html;
  document.getElementById('sreal-active').style.display = 'none';
  document.getElementById('sreal-results').style.display = 'block';
  document.getElementById('realPageSub').textContent = 'Imtihon yakunlandi Â· ' + ball + '/100 ball Â· ' + grade.l;
  window.scrollTo({top: 0, behavior: 'smooth'});
  showToast('ð¤', 'Imtihon topshirildi!', ball + '/100 ball Â· ' + grade.l, 'green');
}

function loadDekanatQuestions() {
  try {
    var s = localStorage.getItem('idu_dekanat_questions');
    if (s) { var arr = JSON.parse(s); if (Array.isArray(arr)) DEKANAT_QUESTIONS = arr; }
  } catch(e) {}
}

function saveDekanatQuestions() {
  try { localStorage.setItem('idu_dekanat_questions', JSON.stringify(DEKANAT_QUESTIONS)); } catch(e) {}
}

function _buildTestQHtml(q, i, mode) {
  var isReal = mode === 'real';
  var acColor = isReal ? '#DC2626' : '#1B4FD8';
  var hoverColor = isReal ? '#DC2626' : '#1B4FD8';
  var hoverBg = isReal ? '#FFF5F5' : '#F8FBFF';
  var prefix = isReal ? 'r' : 't';
  var eBox = isReal ? 'realEtirozBox' : 'etirozBox';
  var eText = isReal ? 'realEtirozText' : 'etirozText';
  var ansHandler = isReal ? 'onRealAnswer' : 'onTestAnswer';
  var eToggle = isReal ? 'toggleRealEtirozBox' : 'toggleEtirozBox';
  var eSubmit = isReal ? 'submitRealEtiraz' : 'submitEtiraz';
  var html = '<div id="' + prefix + 'q-' + i + '" style="background:white;border:1.5px solid #E2E8F0;border-radius:12px;padding:18px 20px;margin-bottom:14px;transition:border-color 0.2s">';
  html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:14px">';
  html += '<div style="font-size:13.5px;font-weight:700;color:#0F172A;line-height:1.5"><span style="color:#94A3B8;margin-right:6px">' + (i+1) + '.</span>' + q.q + '</div>';
  html += '<button onclick="' + eToggle + '(' + i + ')" style="white-space:nowrap;padding:4px 10px;background:#FFF7ED;border:1px solid #FED7AA;border-radius:6px;font-size:11px;font-weight:600;color:#EA580C;cursor:pointer;font-family:\'Outfit\',sans-serif">â ï¸ E\'tiroz</button>';
  html += '</div>';
  html += '<div style="display:flex;flex-direction:column;gap:8px">';
  q.opts.forEach(function(opt, j) {
    html += '<label id="' + prefix + 'q-' + i + '-opt-' + j + '" style="display:flex;align-items:center;gap:10px;padding:10px 14px;border:1.5px solid #E2E8F0;border-radius:8px;cursor:pointer;font-size:13px;transition:all 0.15s">';
    html += '<input type="radio" name="' + prefix + 'q' + i + '" value="' + j + '" style="accent-color:' + acColor + ';width:16px;height:16px" onchange="' + ansHandler + '(' + i + ',' + j + ')"> ' + opt;
    html += '</label>';
  });
  html += '</div>';
  html += '<input type="hidden" id="' + prefix + 'q' + i + 'ans" value="">';
  html += '<div id="' + eBox + i + '" style="display:none;margin-top:12px;background:#FFF7ED;border:1.5px solid #FED7AA;border-radius:10px;padding:14px">';
  html += '<div style="font-size:12px;font-weight:700;color:#92400E;margin-bottom:8px">â ï¸ ' + (i+1) + '-savol bo\'yicha e\'tiroz:</div>';
  html += '<textarea id="' + eText + i + '" placeholder="E\'tirozingiz sababini yozing..." style="width:100%;padding:10px;border:1.5px solid #FED7AA;border-radius:8px;font-family:\'Outfit\',sans-serif;font-size:13px;resize:vertical;min-height:70px;outline:none;box-sizing:border-box"></textarea>';
  html += '<div style="display:flex;gap:8px;margin-top:8px">';
  html += '<button onclick="' + eSubmit + '(' + i + ')" style="padding:7px 16px;background:#EA580C;color:white;border:none;border-radius:7px;font-family:\'Outfit\',sans-serif;font-size:12.5px;font-weight:700;cursor:pointer">ð¤ Dekanatga yuborish</button>';
  html += '<button onclick="document.getElementById(\'' + eBox + i + '\').style.display=\'none\'" style="padding:7px 14px;background:white;border:1.5px solid #E2E8F0;border-radius:7px;font-family:\'Outfit\',sans-serif;font-size:12.5px;cursor:pointer">Bekor</button>';
  html += '</div></div></div>';
  return html;
}

function renderDekanatQuestions() {
  loadDekanatQuestions();
  _updateQStats();
  _renderQTable(_currentQFilter);
}

function openAddQuestionModal() {
  _editingQId = null;
  document.getElementById('questionModalTitle').textContent = 'â Yangi savol qo\'shish';
  document.getElementById('qModalText').value = '';
  document.getElementById('qModalIzoh').value = '';
  document.getElementById('qOpt0').value = '';
  document.getElementById('qOpt1').value = '';
  document.getElementById('qOpt2').value = '';
  document.getElementById('qOpt3').value = '';
  document.querySelectorAll('input[name="qModalCorrect"]').forEach(function(r) { r.checked = false; });
  document.querySelector('input[name="qModalCorrect"][value="0"]').checked = true;
  document.getElementById('addQuestionModal').style.display = 'block';
}

function editQuestion(id) {
  var q = DEKANAT_QUESTIONS.find(function(x) { return x.id === id; });
  if (!q) return;
  _editingQId = id;
  document.getElementById('questionModalTitle').textContent = 'âï¸ Savolni tahrirlash';
  document.getElementById('qModalSubject').value = q.subject;
  document.getElementById('qModalType').value = q.type;
  document.getElementById('qModalText').value = q.q;
  document.getElementById('qModalIzoh').value = q.izoh || '';
  q.opts.forEach(function(opt, i) {
    var el = document.getElementById('qOpt' + i);
    if (el) el.value = opt;
  });
  var radio = document.querySelector('input[name="qModalCorrect"][value="' + q.ans + '"]');
  if (radio) radio.checked = true;
  document.getElementById('addQuestionModal').style.display = 'block';
}

function deleteQuestion(id) {
  if (!confirm('Bu savolni o\'chirishni tasdiqlaysizmi?')) return;
  DEKANAT_QUESTIONS = DEKANAT_QUESTIONS.filter(function(q) { return q.id !== id; });
  saveDekanatQuestions();
  renderDekanatQuestions();
  showToast('ðï¸', 'O\'chirildi', 'Savol o\'chirildi', 'red');
}

function clearAllDekanatQuestions() {
  if (!confirm('Barcha ' + DEKANAT_QUESTIONS.length + ' ta savolni o\'chirishni tasdiqlaysizmi? Bu amalni qaytarib bo\'lmaydi!')) return;
  DEKANAT_QUESTIONS = [];
  saveDekanatQuestions();
  renderDekanatQuestions();
  showToast('ðï¸', 'Tozalandi', 'Barcha savollar o\'chirildi', 'red');
}

function saveQuestionModal() {
  var subj = document.getElementById('qModalSubject').value;
  var type = document.getElementById('qModalType').value;
  var text = document.getElementById('qModalText').value.trim();
  var izoh = document.getElementById('qModalIzoh').value.trim();
  var opts = [
    document.getElementById('qOpt0').value.trim(),
    document.getElementById('qOpt1').value.trim(),
    document.getElementById('qOpt2').value.trim(),
    document.getElementById('qOpt3').value.trim()
  ];
  var ansRadio = document.querySelector('input[name="qModalCorrect"]:checked');
  var ans = ansRadio ? parseInt(ansRadio.value) : 0;

  if (!text) { showToast('â ï¸', 'Xato', 'Savol matnini kiriting!'); return; }
  if (opts.some(function(o) { return !o; })) { showToast('â ï¸', 'Xato', 'Barcha 4 ta variantni kiriting!'); return; }

  if (_editingQId !== null) {
    var q = DEKANAT_QUESTIONS.find(function(x) { return x.id === _editingQId; });
    if (q) { q.subject = subj; q.type = type; q.q = text; q.opts = opts; q.ans = ans; q.izoh = izoh; }
    showToast('â', 'Yangilandi', 'Savol muvaffaqiyatli yangilandi', 'green');
  } else {
    var newId = DEKANAT_QUESTIONS.length > 0 ? Math.max.apply(null, DEKANAT_QUESTIONS.map(function(q) { return q.id; })) + 1 : 1;
    DEKANAT_QUESTIONS.push({ id: newId, subject: subj, type: type, q: text, opts: opts, ans: ans, izoh: izoh });
    showToast('â', 'Saqlandi', 'Yangi savol qo\'shildi', 'green');
  }

  saveDekanatQuestions();
  closeQuestionModal();
  renderDekanatQuestions();
}

function closeQuestionModal() {
  document.getElementById('addQuestionModal').style.display = 'none';
  _editingQId = null;
}