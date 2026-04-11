'use strict';
// IDU Platform — features/ai-chat.js
var AI_RESPONSES = {}

function recordFailedAttempt(key) {
  try {
    const data = JSON.parse(_lsGet('idu_lockout_' + key) || '{}');
    data.attempts = (data.attempts || 0) + 1;
    data.lastAttempt = Date.now();
    if (data.attempts >= MAX_ATTEMPTS) { data.lockedUntil = Date.now() + LOCKOUT_MS; data.attempts = 0; }
    _lsSet('idu_lockout_' + key, JSON.stringify(data));
  } catch(e) {}
}

function fillMainLogin(login, pass) {
  const lEl = document.getElementById('mainLogin');
  const pEl = document.getElementById('mainPass');
  if (lEl) lEl.value = login;
  if (pEl) { pEl.value = pass; pEl.type = 'password'; }
  const eyeBtn = document.getElementById('eyeBtn');
  if (eyeBtn) eyeBtn.innerHTML = '&#x1F441;';
  const errEl = document.getElementById('mainLoginError');
  if (errEl) errEl.classList.remove('show');
}

function renderGroupDetailReport(){
  var el=document.getElementById('groupDetailReport');if(!el)return;
  var groups=['AI-2301','CS-2301','IT-2301','DB-2301'];
  var colors=['#1B4FD8','#7C3AED','#16A34A','#EA580C'];
  var html='<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">';
  groups.forEach(function(grp,gi){
    var ss=STUDENTS_DATA.filter(function(s){return s.group===grp;});
    if(!ss.length){ ss=[{id:99,name:'Demo',gpa:3.2,avg:75,att:92}]; }
    var avgs=ss.map(function(s){
      return GRADES_DATA.reduce(function(acc,g){
        var key=s.id+'_'+g.sub;var sv=SAVED_GRADES[key];
        return acc+(sv?sv.jn:g.jn)+(sv?sv.on:g.on)+(sv?sv.yn:g.yn)+(sv?sv.mi:g.mi);
      },0)/Math.max(GRADES_DATA.length,1);
    });
    var avg=avgs.length?(avgs.reduce(function(a,b){return a+b;},0)/avgs.length).toFixed(1):75;
    var alo=ss.filter(function(s){return s.avg>=86;}).length;
    var fail=ss.filter(function(s){return s.avg<56;}).length;
    var attAvg=(ss.reduce(function(a,s){return a+s.att;},0)/ss.length).toFixed(1);
    var gpaAvg=(ss.reduce(function(a,s){return a+(parseFloat(s.gpa)||3);},0)/ss.length).toFixed(2);
    var c=colors[gi];
    html+='<div class="card" style="border-top:3px solid '+c+'">'
      +'<div class="card-header">'
        +'<div class="card-title" style="color:'+c+'">'+grp+'</div>'
        +'<div class="card-badge" style="background:'+c+'22;color:'+c+'">'+ss.length+' talaba</div>'
      +'</div>'
      +'<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px;margin-bottom:12px">'
        +'<div style="text-align:center;padding:10px 4px;background:#F8FAFC;border-radius:8px">'
          +'<div style="font-size:18px;font-weight:900;color:'+c+';font-family:\'DM Mono\',monospace">'+avg+'</div>'
          +'<div style="font-size:9px;color:#94A3B8;font-weight:600;margin-top:2px">ORT. BALL</div>'
        +'</div>'
        +'<div style="text-align:center;padding:10px 4px;background:#F8FAFC;border-radius:8px">'
          +'<div style="font-size:18px;font-weight:900;color:#16A34A;font-family:\'DM Mono\',monospace">'+alo+'</div>'
          +'<div style="font-size:9px;color:#94A3B8;font-weight:600;margin-top:2px">A\'LOCHILAR</div>'
        +'</div>'
        +'<div style="text-align:center;padding:10px 4px;background:#F8FAFC;border-radius:8px">'
          +'<div style="font-size:18px;font-weight:900;color:#D97706;font-family:\'DM Mono\',monospace">'+attAvg+'%</div>'
          +'<div style="font-size:9px;color:#94A3B8;font-weight:600;margin-top:2px">DAVOMAT</div>'
        +'</div>'
        +'<div style="text-align:center;padding:10px 4px;background:#F8FAFC;border-radius:8px">'
          +'<div style="font-size:18px;font-weight:900;color:#7C3AED;font-family:\'DM Mono\',monospace">'+gpaAvg+'</div>'
          +'<div style="font-size:9px;color:#94A3B8;font-weight:600;margin-top:2px">GPA</div>'
        +'</div>'
      +'</div>'
      +(fail>0?'<div style="background:#FFF5F5;border:1px solid #FCA5A5;border-radius:8px;padding:8px 12px;font-size:12.5px;color:#DC2626;display:flex;align-items:center;gap:6px">â ï¸ '+fail+' talaba qoniqarsiz baho olgan â nazorat tavsiya etiladi</div>':'<div style="background:#F0FDF4;border:1px solid #86EFAC;border-radius:8px;padding:8px 12px;font-size:12.5px;color:#16A34A;display:flex;align-items:center;gap:6px">â Guruh barqaror ko\'rsatkichda</div>')
    +'</div>';
  });
  html+='</div>';
  el.innerHTML=html;
}

function openStudentDetail(id){
  const s=STUDENTS_DATA.find(x=>x.id===id);if(!s)return;
  document.getElementById('studentDetailTitle').textContent=s.name;
  document.getElementById('studentDetailContent').innerHTML=`
    <div style="display:flex;align-items:center;gap:16px;margin-bottom:20px">
      <div style="width:60px;height:60px;border-radius:14px;background:linear-gradient(135deg,var(--primary),#3B82F6);display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:800;color:white">${s.name.split(' ').map(x=>x[0]).join('')}</div>
      <div>
        <div style="font-size:20px;font-weight:800">${s.name}</div>
        <div style="color:var(--text2);margin-top:4px">${s.group} Â· ${s.course}-kurs</div>
      </div>
    </div>
    <div class="stats-grid-3" style="margin-bottom:16px">
      <div style="text-align:center;padding:14px;background:var(--bg);border-radius:var(--r2)">
        <div style="font-size:24px;font-weight:900;color:var(--primary);font-family:'DM Mono',monospace">${s.gpa}</div>
        <div style="font-size:12px;color:var(--text3)">GPA</div>
      </div>
      <div style="text-align:center;padding:14px;background:var(--bg);border-radius:var(--r2)">
        <div style="font-size:24px;font-weight:900;color:var(--green);font-family:'DM Mono',monospace">${s.avg}</div>
        <div style="font-size:12px;color:var(--text3)">O'rt. ball</div>
      </div>
      <div style="text-align:center;padding:14px;background:var(--bg);border-radius:var(--r2)">
        <div style="font-size:24px;font-weight:900;color:${s.att>=90?'var(--green)':'var(--orange)'};font-family:'DM Mono',monospace">${s.att}%</div>
        <div style="font-size:12px;color:var(--text3)">Davomat</div>
      </div>
    </div>
    <table class="grade-table"><thead><tr><th>Fan</th><th>JN</th><th>ON</th><th>YN</th><th>MI</th><th>Jami</th><th>Baho</th></tr></thead>
    <tbody>${GRADES_DATA.map(g=>{const t=g.jn+g.on+g.yn+g.mi;const{letter,cls}=getGrade(t);return`<tr><td>${g.sub}</td><td>${g.jn}</td><td>${g.on}</td><td>${g.yn}</td><td>${g.mi}</td><td><strong>${t}</strong></td><td><span class="grade-chip ${cls}">${letter}</span></td></tr>`;}).join('')}</tbody></table>`;
  document.getElementById('studentDetailModal').classList.add('open');
}

async function sendAIMsg(){
  const inp=document.getElementById('aiInput');
  const txt=inp?.value.trim();if(!txt)return;
  inp.value='';
  appendMsg('user',txt);
  document.getElementById('aiSendBtn').disabled=true;
  appendMsg('ai','...');
  try {
    const data = await api('POST', '/ai/chat', { message: txt });
    const lastMsg = document.querySelector('#aiMessages .msg-ai:last-child');
    if(lastMsg) lastMsg.querySelector('.msg-text') ? lastMsg.querySelector('.msg-text').textContent = data.reply : lastMsg.textContent = data.reply;
    else appendMsg('ai', data.reply || 'Javob kelmadi');
  } catch(e) {
    const lastMsg = document.querySelector('#aiMessages .msg-ai:last-child');
  
   if(lastMsg) lastMsg.textContent = "Xatolik yuz berdi. Qayta urinib ko'ring.";
  }
  document.getElementById('aiSendBtn').disabled=false;
}

function askAI(q){document.getElementById('aiInput').value=q;sendAIMsg();}

function appendMsg(role,text){
  const mc=document.getElementById('aiMessages');if(!mc)return;
  const now=new Date().toLocaleTimeString('uz-UZ',{hour:'2-digit',minute:'2-digit'});
  const d=document.createElement('div');
  d.className=`chat-bubble-wrap ${role}`;
  d.innerHTML=`<div class="bubble-avatar ba-${role}">${role==='ai'?'ð¤':(currentUser?.name||'?').split(' ').map(x=>x[0]).join('').slice(0,2)}</div>
    <div class="bubble-body"><div class="bubble">${text.replace(/\n/g,'<br>').replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>')}</div>
    <div class="bubble-time">${now}</div></div>`;
  mc.appendChild(d);
  mc.scrollTop=mc.scrollHeight;
}

function startDailyChallenge(){
  const d=new Date();
  const end=new Date(d.getFullYear(),d.getMonth(),d.getDate()+1);
  const el=document.getElementById('dcCountdown');
  if(el){
    clearInterval(window.dcInt);
    window.dcInt=setInterval(()=>{
      const now=new Date();
      const diff=end-now;
      const h=Math.floor(diff/3600000);
      const m=Math.floor((diff%3600000)/60000);
      const s=Math.floor((diff%60000)/1000);
      el.textContent=`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    },1000);
  }
}

function showJobDetail(partnerId, vacancyId){
  const p = PARTNERS.find(x=>x.id===partnerId);
  const v = p?.vacancies.find(x=>x.id===vacancyId);
  if(!p||!v) return;
  _activeDetailPartner = p;
  _activeDetailVacancy = v;

  document.getElementById('jdmLogo').textContent = p.logo;
  document.getElementById('jdmLogo').style.background = p.color+'22';
  document.getElementById('jdmTitle').textContent = v.title;
  document.getElementById('jdmCompany').textContent = `${p.name} Â· ${p.type} Â· ${p.location}`;

  const stypeClass = v.stype==='Full-time'?'stype-full':v.stype==='Part-time'?'stype-part':'stype-intern';
  document.getElementById('jdmMeta').innerHTML = `
    <span class="stype-badge ${stypeClass}" style="padding:5px 12px">${v.stype}</span>
    <span style="padding:5px 12px;background:var(--green-light);color:var(--green);border-radius:7px;font-size:12px;font-weight:700">ð° ${v.salary} so'm</span>
    <span style="padding:5px 12px;background:var(--bg2);color:var(--text2);border-radius:7px;font-size:12px">ð ${p.location}</span>`;

  document.getElementById('jdmDesc').textContent = v.desc;
  document.getElementById('jdmReqs').innerHTML = v.requirements.map(r=>`
    <div class="jdm-req-item"><span style="color:var(--green);font-size:16px;flex-shrink:0">â</span> ${r}</div>`).join('');
  document.getElementById('jdmTags').innerHTML = v.tags.map(t=>`<span class="vc-tag" style="font-size:13px;padding:5px 12px">${t}</span>`).join('');

  const already = APPLICATIONS.some(a=>a.studentName===currentUser?.name&&a.company===p.name&&a.detail===v.title);
  const btn = document.getElementById('jdmApplyBtn');
  if(already){ btn.textContent='â Ariza allaqachon yuborilgan'; btn.disabled=true; btn.style.opacity='0.6'; }
  else { btn.textContent='ð© Ariza yuborish'; btn.disabled=false; btn.style.opacity='1'; }

  document.getElementById('jobDetailModal').style.display = 'flex';
}

function closeJobDetail(){
  document.getElementById('jobDetailModal').style.display = 'none';
}

function applyFromDetail(){
  if(!_activeDetailPartner || !_activeDetailVacancy) return;
  closeJobDetail();
  applyJobDirect(_activeDetailPartner.id, _activeDetailVacancy.id);
}