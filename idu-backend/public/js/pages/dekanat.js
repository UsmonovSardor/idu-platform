'use strict';
// IDU - pages/dekanat.js
// Dekanat paneli funksiyalari

function fillDekanat(l,p){
  document.getElementById('dLogin').value=l;
  document.getElementById('dPass').value=p;
}

function renderDekanatDashboard(){
  renderGroupRanking();renderTopTeachers();
}

function renderDekanatSchedule(){
  const grp=document.getElementById('dekScheduleGroup')?.value||'AI-2301';
  currentDekScheduleGroup=grp;
  buildTTTable('dekTTHead','dekTTBody',grp,true); // editable=true
  renderRoomStatus(grp);
}

function renderGroupRanking(){
  const el=document.getElementById('groupRankingList');if(!el)return;
  const groups=[
    {name:'AI-2301',avg:83.5,count:25},
    {name:'CS-2301',avg:81.2,count:28},
    {name:'IT-2301',avg:75.4,count:27},
    {name:'DB-2301',avg:73.1,count:26},
  ];
  el.innerHTML=groups.map((g,i)=>`
    <div class="rank-row">
      <div class="rank-pos${i<3?' rp-'+(i+1):''}">${i+1}</div>
      <div class="rank-info">
        <div class="rank-name">${g.name}</div>
        <div class="rank-dept">${g.count} talaba</div>
      </div>
      <div class="rank-score">${g.avg}</div>
    </div>`).join('');
}

function renderAtRisk(){
  const el=document.getElementById('atRiskStudents');if(!el)return;
  const risky=STUDENTS_DATA.filter(s=>s.att<85||s.avg<65);
  el.innerHTML=risky.slice(0,5).map(s=>`
    <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #F8FAFC">
      <div class="dt-avatar" style="background:${s.att<75?'#DC2626':'#EA580C'}">${s.name.split(' ').map(x=>x[0]).join('')}</div>
      <div style="flex:1">
        <div style="font-size:13.5px;font-weight:700">${s.name}</div>
        <div style="font-size:12px;color:var(--text2)">${s.group} · ${currentLang==='ru'?'Посещ.':'Davomat'}: ${s.att}% · ${currentLang==='ru'?'Балл':'Ball'}: ${s.avg}</div>
      </div>
      <span class="status-tag ${s.att<75?'st-warning':'st-neutral'}">${currentLang==='ru'?(s.att<75?'Критично':'Наблюдение'):(s.att<75?'Kritik':'Kuzatuv')}</span>
    </div>`).join('');
}

function initAttendance(){
  const el=document.getElementById('attendanceBody');if(!el)return;
  const grp=document.getElementById('attGroupSelect')?.value||'CS-2301';
  const students=STUDENTS_DATA.filter(s=>s.group===grp);
  el.innerHTML=students.map((s,i)=>`
    <tr>
      <td>${i+1}</td>
      <td>${s.name}</td>
      <td>
        <select class="form-select" style="width:120px" id="att-${s.id}">
          <option value="keldi">✅ Keldi</option>
          <option value="kelmadi">❌ Kelmadi</option>
          <option value="kech">⏰ Kechikdi</option>
        </select>
      </td>
      <td>
        <select class="form-select" style="width:120px" id="att-reason-${s.id}">
          <option value="">—</option>
          <option value="sababli">Sababli</option>
          <option value="sababsiz">Sababsiz</option>
        </select>
      </td>
      <td><input class="form-input" style="width:160px" placeholder="Izoh..." id="att-note-${s.id}"></td>
    </tr>`).join('');
}

function saveAttendance(){showToast('✅','Saqlandi','Davomat muvaffaqiyatli saqlandi');}