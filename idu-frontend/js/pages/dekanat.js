'use strict';
// IDU Platform — pages/dekanat.js

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

function renderDekanatStudents(){
  filterStudents();
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
        <div style="font-size:12px;color:var(--text2)">${s.group} Â· ${currentLang==='ru'?'ÐÐ¾ÑÐµÑ.':'Davomat'}: ${s.att}% Â· ${currentLang==='ru'?'ÐÐ°Ð»Ð»':'Ball'}: ${s.avg}</div>
      </div>
      <span class="status-tag ${s.att<75?'st-warning':'st-neutral'}">${currentLang==='ru'?(s.att<75?'ÐÑÐ¸ÑÐ¸ÑÐ½Ð¾':'ÐÐ°Ð±Ð»ÑÐ´ÐµÐ½Ð¸Ðµ'):(s.att<75?'Kritik':'Kuzatuv')}</span>
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
          <option value="keldi">â Keldi</option>
          <option value="kelmadi">â Kelmadi</option>
          <option value="kech">â° Kechikdi</option>
        </select>
      </td>
      <td>
        <select class="form-select" style="width:120px" id="att-reason-${s.id}">
          <option value="">â</option>
          <option value="sababli">Sababli</option>
          <option value="sababsiz">Sababsiz</option>
        </select>
      </td>
      <td><input class="form-input" style="width:160px" placeholder="Izoh..." id="att-note-${s.id}"></td>
    </tr>`).join('');
}

function saveAttendance(){showToast('â','Saqlandi','Davomat muvaffaqiyatli saqlandi');}

function renderRiskStudents(){
  var highEl=document.getElementById('riskHighList');
  var midEl=document.getElementById('riskMidList');
  var attEl=document.getElementById('attendRiskBody');
  if(!highEl||!midEl) return;
  var allStudents=STUDENTS_DATA.length?STUDENTS_DATA:[
    {id:1,name:'Bobur Tursunov',group:'AI-2301',course:2,gpa:1.8,avg:51,att:72},
    {id:2,name:'Kamola Mirzayeva',group:'CS-2301',course:2,gpa:2.1,avg:58,att:68},
    {id:3,name:'Jasur Rahmatov',group:'IT-2301',course:1,gpa:1.6,avg:44,att:61},
    {id:4,name:'Gulnora Tosheva',group:'DB-2301',course:3,gpa:2.4,avg:63,att:74},
    {id:5,name:'Nodir Hamidov',group:'AI-2301',course:2,gpa:2.2,avg:61,att:71},
  ];
  var high=allStudents.filter(function(s){return s.avg<56;});
  var mid=allStudents.filter(function(s){return s.avg>=56&&s.avg<66;});
  var badAtt=allStudents.filter(function(s){return s.att<80;});
  var hBadge=document.getElementById('highRiskBadge');
  var mBadge=document.getElementById('midRiskBadge');
  if(hBadge) hBadge.textContent=high.length+' ta';
  if(mBadge) mBadge.textContent=mid.length+' ta';
  function riskRow(s,type){
    return '<div class="risk-student-row '+(type==='high'?'risk-high':'risk-mid')+'">'
      +'<div style="width:34px;height:34px;border-radius:9px;background:'+(type==='high'?'#DC2626':'#D97706')+';display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:#fff;flex-shrink:0">'
        +s.name.split(' ').map(function(x){return x[0];}).join('')
      +'</div>'
      +'<div style="flex:1">'
        +'<div class="rsr-name">'+s.name+'</div>'
        +'<div class="rsr-info">'+s.group+' Â· '+s.course+'-kurs Â· GPA: '+s.gpa+'</div>'
      +'</div>'
      +'<div style="text-align:right">'
        +'<div style="font-size:18px;font-weight:900;font-family:\'DM Mono\',monospace;color:'+(type==='high'?'#DC2626':'#D97706')+'">'+s.avg+'</div>'
        +'<span class="rsr-badge '+(type==='high'?'rsr-badge-red':'rsr-badge-yellow')+'">'+(type==='high'?'Kritik':'Diqqat')+'</span>'
      +'</div>'
    +'</div>';
  }
  highEl.innerHTML=high.length?high.map(function(s){return riskRow(s,'high');}).join('')
    :'<div style="text-align:center;padding:24px;color:#16A34A;font-size:13px">â Yuqori xavf guruhida hech kim yo\'q</div>';
  midEl.innerHTML=mid.length?mid.map(function(s){return riskRow(s,'mid');}).join('')
    :'<div style="text-align:center;padding:24px;color:#1B4FD8;font-size:13px">â O\'rta xavf guruhida hech kim yo\'q</div>';
  if(attEl){
    attEl.innerHTML=badAtt.length?badAtt.map(function(s){
      var color=s.att<70?'#DC2626':'#D97706';
      var sabsiz=Math.max(0,Math.round((100-s.att)/2));
      return '<tr>'
        +'<td><div style="display:flex;align-items:center;gap:8px"><div style="background:#94A3B8;width:26px;height:26px;min-width:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:10px;font-weight:700">'+s.name.split(' ').map(function(x){return x[0];}).join('')+'</div>'+s.name+'</div></td>'
        +'<td>'+s.group+'</td>'
        +'<td><span style="font-weight:800;color:'+color+';font-family:\'DM Mono\',monospace">'+s.att+'%</span></td>'
        +'<td style="color:#DC2626;font-weight:700">'+sabsiz+' dars</td>'
        +'<td><span class="status-tag '+(s.att<70?'st-warning':'st-neutral')+'">'+( s.att<70?'Ogohlantirildi':'Nazoratda')+'</span></td>'
      +'</tr>';
    }).join('')
    :'<tr><td colspan="5" style="text-align:center;padding:20px;color:#16A34A">â Davomat muammosi yo\'q</td></tr>';
  }
}

function filterStudents(){
  const q=document.getElementById('studentSearch')?.value.toLowerCase()||'';
  const grp=document.getElementById('studentGroupFilter')?.value||'';
  const el=document.getElementById('dekanatStudentBody');if(!el)return;
  const filtered=STUDENTS_DATA.filter(s=>(s.name.toLowerCase().includes(q)||s.group.toLowerCase().includes(q))&&(grp?s.group===grp:true));
  el.innerHTML=filtered.length ? filtered.map((s,i)=>`
    <tr>
      <td>${i+1}</td>
      <td><div style="display:flex;align-items:center;gap:8px">
        <div class="dt-avatar" style="background:#1B4FD8">${s.name.split(' ').map(x=>x[0]).join('')}</div>
        <div><div style="font-weight:600">${s.name}</div></div>
      </div></td>
      <td><span class="card-badge cb-blue" style="cursor:pointer" onclick="openStudentEditModal(${s.id})">${s.group} âï¸</span></td>
      <td><span style="cursor:pointer;font-weight:600" onclick="openStudentEditModal(${s.id})">${s.course}-kurs âï¸</span></td>
      <td><span class="font-mono">${s.avg}</span></td>
      <td><span class="status-tag ${s.att>=90?'st-active':s.att>=75?'st-ok':'st-warning'}">${s.att}%</span></td>
      <td><span class="font-mono">${s.gpa}</span></td>
      <td><span class="status-tag ${s.avg>=70&&s.att>=85?'st-active':s.avg>=55?'st-ok':'st-warning'}">${s.avg>=70&&s.att>=85?'Yaxshi':s.avg>=55?'Qoniqarli':'Xavfli'}</span></td>
      <td style="display:flex;gap:6px">
        <button class="btn btn-secondary btn-sm" onclick="openStudentEditModal(${s.id})" title="Tahrirlash">âï¸</button>
        <button class="btn btn-secondary btn-sm" onclick="openStudentDetail(${s.id})" title="Batafsil">ð</button>
      </td>
    </tr>`).join('') :
    '<tr><td colspan="9" style="text-align:center;color:var(--text3);padding:20px">Talaba topilmadi</td></tr>';
  // Update group filter dropdown dynamically
  const sel = document.getElementById('studentGroupFilter');
  if(sel){
    const cur = sel.value;
    sel.innerHTML = '<option value="">Barcha guruhlar</option>' + getGroupNames().map(g=>`<option value="${g}"${g===cur?' selected':''}>${g}</option>`).join('');
  }
}