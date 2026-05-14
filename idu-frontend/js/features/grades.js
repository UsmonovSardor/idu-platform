'use strict';
// IDU - features/grades.js

function renderDashboardGrades(){
  const el=document.getElementById('recentGradesBody');if(!el)return;
  el.innerHTML=GRADES_DATA.slice(0,4).map(g=>{
    const total=g.jn+g.on+g.yn+g.mi;
    const {letter,cls}=getGrade(total);
    return`<tr>
      <td><strong>${g.sub}</strong></td>
      <td><span class="gc-comp gc-jn">${g.jn}</span></td>
      <td><span class="gc-comp gc-on">${g.on}</span></td>
      <td><span class="gc-comp gc-yn">${g.yn}</span></td>
      <td><span class="gc-comp gc-mi">${g.mi}</span></td>
      <td><strong>${total}</strong></td>
      <td><span class="grade-chip ${cls}">${letter}</span></td>
    </tr>`;
  }).join('');
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

function getGrade(total){
  if(total>=86)return{letter:'A (a\'lo)',cls:'gc-a'};
  if(total>=71)return{letter:'B (yaxshi)',cls:'gc-b'};
  if(total>=56)return{letter:'C (qoniq.)',cls:'gc-c'};
  if(total>=41)return{letter:'D (qoniq.)',cls:'gc-d'};
  return{letter:'F (qoniq.)',cls:'gc-f'};
}

function filterGradesSt(f,btn){
  _stGradeFilter=f;
  document.querySelectorAll('#page-grades .xl-filter-chip').forEach(c=>c.classList.remove('active'));
  if(btn)btn.classList.add('active');
  renderGrades();
}

var _gradesCache = [];

async function renderGrades() {
  const el = document.getElementById('gradesBody'); if (!el) return;

  // Skeleton
  el.innerHTML = [1,2,3,4].map(() =>
    '<tr>' + [1,2,3,4,5,6,7,8,9].map(() =>
      '<td><div class="skel skel-line" style="width:' + (Math.random()*30+30).toFixed(0) + 'px"></div></td>'
    ).join('') + '</tr>'
  ).join('');

  try {
    const data = await api('GET', '/grades/my');
    _gradesCache = data.grades || [];
  } catch(e) {
    // API ishlamasa — bo'sh holat
    _gradesCache = [];
  }
  _renderGradesTable();
}

function _renderGradesTable() {
  const el = document.getElementById('gradesBody'); if (!el) return;
  const q = (document.getElementById('gradesSearch')?.value || '').toLowerCase();

  let filtered = _gradesCache.filter(g => {
    if (q && !g.course_name.toLowerCase().includes(q)) return false;
    const t = Number(g.total) || 0;
    if (_stGradeFilter === 'alo')   return t >= 86;
    if (_stGradeFilter === 'yaxshi') return t >= 71 && t < 86;
    if (_stGradeFilter === 'qoniq') return t < 71;
    return true;
  });

  if (!filtered.length) {
    el.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:40px 20px">' +
      '<div style="font-size:40px;margin-bottom:10px">📊</div>' +
      '<div style="font-size:14px;font-weight:700;color:var(--text1);margin-bottom:6px">' +
        (q || _stGradeFilter !== 'all' ? 'Natija topilmadi' : 'Hali baholar kiritilmagan') +
      '</div>' +
      '<div style="font-size:12px;color:var(--text3)">' +
        (q || _stGradeFilter !== 'all' ? 'Qidiruv yoki filtrni o\'zgartiring' : 'O\'qituvchi baholarni kiritganda bu yerda ko\'rinadi') +
      '</div>' +
    '</td></tr>';
    _updateGradeStats([], 0, 0, 0, 0);
    return;
  }

  let sum = 0, alo = 0, good = 0, fail = 0;
  el.innerHTML = filtered.map((g, idx) => {
    const total = Number(g.total) || 0;
    const jn = Number(g.jn) || 0, on = Number(g.on_score) || 0;
    const yn = Number(g.yn) || 0, mi = Number(g.mi) || 0;
    sum += total;
    if (total >= 86) alo++; else if (total >= 71) good++; else if (total < 55) fail++;
    const {letter, cls} = getGrade(total);
    const tc = total>=86?'#166534':total>=71?'#1E40AF':total>=56?'#92400E':'#991B1B';
    const tb = total>=86?'#DCFCE7':total>=71?'#DBEAFE':total>=56?'#FEF3C7':'#FEE2E2';
    const st = total>=86?'st-active':total>=56?'st-ok':total<55?'st-warning':'st-neutral';
    const stl = total>=86?"A'lo":total>=71?'Yaxshi':total>=56?'Qoniqarli':'Qoniqarsiz';
    const cb = v => v>=0?`style="background:${v>=Math.round(v*0.85)?'#D1FAE5':v>=Math.round(v*0.6)?'#FEF9C3':'#FEE2E2'};padding:2px 9px;border-radius:5px;font-weight:700"`: '';
    return '<tr>'
      + '<td>' + (idx+1) + '</td>'
      + '<td class="xl-td-sub">' + (g.course_name || '—') + '</td>'
      + '<td class="xl-td-teacher">' + (g.teacher_name || '—') + '</td>'
      + '<td class="xl-td-num"><span style="background:' + (jn>=25?'#D1FAE5':jn>=18?'#FEF9C3':'#FEE2E2') + ';padding:2px 9px;border-radius:5px;font-weight:700">' + jn + '</span><span style="color:#9CA3AF;font-size:10px"> /30</span></td>'
      + '<td class="xl-td-num"><span style="background:' + (on>=17?'#D1FAE5':on>=12?'#FEF9C3':'#FEE2E2') + ';padding:2px 9px;border-radius:5px;font-weight:700">' + on + '</span><span style="color:#9CA3AF;font-size:10px"> /20</span></td>'
      + '<td class="xl-td-num"><span style="background:' + (yn>=25?'#D1FAE5':yn>=18?'#FEF9C3':'#FEE2E2') + ';padding:2px 9px;border-radius:5px;font-weight:700">' + yn + '</span><span style="color:#9CA3AF;font-size:10px"> /30</span></td>'
      + '<td class="xl-td-num"><span style="background:' + (mi>=17?'#D1FAE5':mi>=12?'#FEF9C3':'#FEE2E2') + ';padding:2px 9px;border-radius:5px;font-weight:700">' + mi + '</span><span style="color:#9CA3AF;font-size:10px"> /20</span></td>'
      + '<td class="xl-td-total"><span style="background:' + tb + ';color:' + tc + ';padding:3px 10px;border-radius:6px;font-size:15px">' + total + '</span>'
        + '<div style="height:3px;background:#E5E7EB;border-radius:2px;margin-top:3px"><div style="height:3px;background:' + tc + ';width:' + total + '%;border-radius:2px"></div></div></td>'
      + '<td class="xl-td-baho"><span class="grade-chip ' + cls + '">' + letter + '</span></td>'
      + '<td class="xl-td-status"><span class="status-tag ' + st + '">' + stl + '</span></td>'
      + '</tr>';
  }).join('');

  _updateGradeStats(filtered, sum, alo, good, fail);
}

function _updateGradeStats(data, sum, alo, good, fail) {
  const avg = data.length ? (sum/data.length).toFixed(1) : '—';
  const ae = document.getElementById('avgScore'); if (ae) ae.textContent = avg;
  const ec = document.getElementById('excellentCount'); if (ec) ec.textContent = alo;
  const gc = document.getElementById('goodCountSt'); if (gc) gc.textContent = good;
  const fc = document.getElementById('failCount'); if (fc) fc.textContent = fail;
}

function filterGradesSt(f, btn) {
  _stGradeFilter = f;
  document.querySelectorAll('#page-grades .xl-filter-chip').forEach(c => c.classList.remove('active'));
  if (btn) btn.classList.add('active');
  _renderGradesTable();
}

function exportStudentGrades(){
  let csv="Fan nomi,O'qituvchi,JN/30,ON/20,YN/30,MI/20,Jami/100,Baho\n";
  GRADES_DATA.forEach(g=>{
    const t=g.jn+g.on+g.yn+g.mi;
    csv+='"'+g.sub+'","'+g.teacher+'",'+g.jn+','+g.on+','+g.yn+','+g.mi+','+t+',"'+getGrade(t).letter+'"\n';
  });
  const blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='baholar.csv';a.click();
  showToast('📥','Excel','Yuklab olindi');
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

async function loadGradeGroup(){
  const el=document.getElementById('gradeEntryBody');if(!el)return;
  _curGrp=document.getElementById('gradeGroupSelect')?.value||'AI-2301';
  _curSub=document.getElementById('gradeSubjectSelect')?.value||'Machine Learning';
  const tEl=document.getElementById('gradeEntryTitle');
  if(tEl)tEl.textContent='✏️ '+_curSub+' — '+_curGrp+' guruh';

  // Skeleton
  el.innerHTML='<tr><td colspan="9" style="text-align:center;padding:20px"><div style="display:flex;flex-direction:column;gap:8px">'
    +[1,2,3,4].map(()=>'<div class="skel" style="height:36px;border-radius:6px"></div>').join('')
    +'</div></td></tr>';

  var students=[];
  try {
    var data=await api('GET','/students?group='+encodeURIComponent(_curGrp)+'&limit=100');
    var raw=Array.isArray(data)?data:(data.data||data.students||data.rows||[]);
    students=raw.map(function(s){return {id:s.id,name:s.full_name||s.name,group:s.group_name||_curGrp};});
  } catch(e){
    students=STUDENTS_DATA.filter(s=>s.group===_curGrp);
  }

  if(!students.length){
    el.innerHTML='<tr><td colspan="9" style="text-align:center;color:#94A3B8;padding:24px">Bu guruhda talabalar topilmadi</td></tr>';
    return;
  }

  const palette=['#1B4FD8','#7C3AED','#0891B2','#16A34A','#D97706','#DC2626','#0F766E','#9333EA'];
  el.innerHTML=students.map(function(s,i){
    const key=s.id+'_'+_curSub;
    const sv=SAVED_GRADES[key];
    const jv=sv?sv.jn:0;
    const ov=sv?sv.on:0;
    const yv=sv?sv.yn:0;
    const mv=sv?sv.mi:0;
    const ini=(s.name||'?').split(' ').map(function(x){return x[0];}).join('');
    const col=palette[i%palette.length];
    return '<tr id="grade-row-'+s.id+'">'
      +'<td>'+(i+1)+'</td>'
      +'<td style="min-width:160px"><div style="display:flex;align-items:center;gap:8px">'
        +'<div style="background:'+col+';width:28px;height:28px;min-width:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:700">'+ini+'</div>'
        +'<span style="font-weight:600;font-size:13px">'+s.name+'</span></div></td>'
      +'<td style="text-align:center"><span class="card-badge cb-blue" style="font-size:11px">'+s.group+'</span></td>'
      +'<td class="xl-td-num"><input class="xl-num-input" type="number" min="0" max="30" value="'+jv+'" id="jn-'+s.id+'" oninput="calcTotal('+s.id+')"></td>'
      +'<td class="xl-td-num"><input class="xl-num-input" type="number" min="0" max="20" value="'+ov+'" id="on-'+s.id+'" oninput="calcTotal('+s.id+')"></td>'
      +'<td class="xl-td-num"><input class="xl-num-input" type="number" min="0" max="30" value="'+yv+'" id="yn-'+s.id+'" oninput="calcTotal('+s.id+')"></td>'
      +'<td class="xl-td-num"><input class="xl-num-input" type="number" min="0" max="20" value="'+mv+'" id="mi-'+s.id+'" oninput="calcTotal('+s.id+')"></td>'
      +'<td class="xl-td-total" id="total-'+s.id+'">—</td>'
      +'<td class="xl-td-baho" id="letter-'+s.id+'">—</td>'
      +'<td style="text-align:center"><button class="xl-save-btn" onclick="saveGrade('+s.id+')">💾 Saqlash</button></td>'
      +'</tr>';
  }).join('');
  students.forEach(function(s){calcTotal(s.id);});
  updateGradeFooter(students);
}

function calcTotal(id){
  const jn=parseInt(document.getElementById('jn-'+id)?.value)||0;
  const on=parseInt(document.getElementById('on-'+id)?.value)||0;
  const yn=parseInt(document.getElementById('yn-'+id)?.value)||0;
  const mi=parseInt(document.getElementById('mi-'+id)?.value)||0;
  const jinEl=document.getElementById('jn-'+id);
  const onEl=document.getElementById('on-'+id);
  const ynEl=document.getElementById('yn-'+id);
  const miEl=document.getElementById('mi-'+id);
  if(jinEl)jinEl.classList.toggle('over-limit',jn>30);
  if(onEl)onEl.classList.toggle('over-limit',on>20);
  if(ynEl)ynEl.classList.toggle('over-limit',yn>30);
  if(miEl)miEl.classList.toggle('over-limit',mi>20);
  const t=Math.min(jn,30)+Math.min(on,20)+Math.min(yn,30)+Math.min(mi,20);
  const tc=t>=86?'#166534':t>=71?'#1E40AF':t>=56?'#92400E':'#991B1B';
  const tb=t>=86?'#DCFCE7':t>=71?'#DBEAFE':t>=56?'#FEF3C7':'#FEE2E2';
  const tel=document.getElementById('total-'+id);
  const lel=document.getElementById('letter-'+id);
  if(tel)tel.innerHTML='<span style="background:'+tb+';color:'+tc+';padding:3px 12px;border-radius:6px;font-size:15px;font-weight:800">'+t+'</span><div style="height:3px;background:#E5E7EB;border-radius:2px;margin-top:3px"><div style="height:3px;background:'+tc+';width:'+t+'%;border-radius:2px"></div></div>';
  if(lel){var gr=getGrade(t);lel.innerHTML='<span class="grade-chip '+gr.cls+'">'+gr.letter+'</span>';}
  var students=STUDENTS_DATA.filter(function(s){return s.group===_curGrp;});
  updateGradeFooter(students);
}

function updateGradeFooter(students){
  var rows=document.querySelectorAll('#gradeEntryBody tr[id^="grade-row-"]');
  var sum=0,alo=0,fail=0,count=0;
  rows.forEach(function(row){
    var sid=row.id.replace('grade-row-','');
    var jn=parseInt(document.getElementById('jn-'+sid)?.value)||0;
    var on=parseInt(document.getElementById('on-'+sid)?.value)||0;
    var yn=parseInt(document.getElementById('yn-'+sid)?.value)||0;
    var mi=parseInt(document.getElementById('mi-'+sid)?.value)||0;
    var t=jn+on+yn+mi;sum+=t;count++;
    if(t>=86)alo++;if(t<55)fail++;
  });
  var avg=count?(sum/count).toFixed(1):'—';
  var ce=document.getElementById('gradeEntryCount');if(ce)ce.textContent=count;
  var av=document.getElementById('gradeEntryAvg');if(av)av.textContent=avg;
  var al=document.getElementById('gradeEntryAlo');if(al)al.textContent=alo;
  var fa=document.getElementById('gradeEntryFail');if(fa)fa.textContent=fail;
}

function saveGrade(id){
  var jn=parseInt(document.getElementById('jn-'+id)?.value)||0;
  var on=parseInt(document.getElementById('on-'+id)?.value)||0;
  var yn=parseInt(document.getElementById('yn-'+id)?.value)||0;
  var mi=parseInt(document.getElementById('mi-'+id)?.value)||0;
  if(jn>30||on>20||yn>30||mi>20){showToast('⚠️','Xato','Ball limitdan oshib ketdi!');return;}
  SAVED_GRADES[id+'_'+_curSub]={jn:jn,on:on,yn:yn,mi:mi};
  var row=document.getElementById('grade-row-'+id);
  if(row){row.querySelectorAll('td').forEach(function(td){td.style.background='#D1FAE5';setTimeout(function(){td.style.background='';},700);});}
  var gd=GRADES_DATA.find(function(g){return g.sub===_curSub;});
  if(gd){gd.jn=jn;gd.on=on;gd.yn=yn;gd.mi=mi;}
  showToast('✅','Saqlandi','Baholar muvaffaqiyatli saqlandi');
}

function saveAllGrades(){
  var rows=document.querySelectorAll('#gradeEntryBody tr[id^="grade-row-"]');
  var err=false;
  rows.forEach(function(row){
    var sid=row.id.replace('grade-row-','');
    var jn=parseInt(document.getElementById('jn-'+sid)?.value)||0;
    var on=parseInt(document.getElementById('on-'+sid)?.value)||0;
    var yn=parseInt(document.getElementById('yn-'+sid)?.value)||0;
    var mi=parseInt(document.getElementById('mi-'+sid)?.value)||0;
    if(jn>30||on>20||yn>30||mi>20){err=true;return;}
    SAVED_GRADES[sid+'_'+_curSub]={jn:jn,on:on,yn:yn,mi:mi};
  });
  if(err){showToast('⚠️','Xato','Limitdan oshgan baholar mavjud!');return;}
  document.querySelectorAll('#gradeEntryBody tr').forEach(function(row){
    row.querySelectorAll('td').forEach(function(td){td.style.background='#D1FAE5';setTimeout(function(){td.style.background='';},800);});
  });
  showToast('✅','Barchasi saqlandi',_curSub+' — '+_curGrp+' baholar saqlandi');
}

function exportGrades(){
  var rows=document.querySelectorAll('#gradeEntryBody tr[id^="grade-row-"]');
  var csv='Fan,Guruh,Talaba,JN/30,ON/20,YN/30,MI/20,Jami/100,Baho\n';
  rows.forEach(function(row){
    var s={id:row.id.replace('grade-row-',''),name:row.querySelector('span[style*="font-weight"]')?.textContent||'',group:_curGrp};
    var jn=parseInt(document.getElementById('jn-'+s.id)?.value)||0;
    var on=parseInt(document.getElementById('on-'+s.id)?.value)||0;
    var yn=parseInt(document.getElementById('yn-'+s.id)?.value)||0;
    var mi=parseInt(document.getElementById('mi-'+s.id)?.value)||0;
    var t=jn+on+yn+mi;
    csv+='"'+_curSub+'","'+_curGrp+'","'+s.name+'",'+jn+','+on+','+yn+','+mi+','+t+',"'+getGrade(t).letter+'"\n';
  });
  var blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'});
  var a=document.createElement('a');a.href=URL.createObjectURL(blob);
  a.download=_curSub.replace(/ /g,'_')+'_'+_curGrp+'.csv';a.click();
  showToast('📥','Excel','Yuklab olindi');
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

function dekGradeFilter(f,btn){
  _dekFilter=f;
  document.querySelectorAll('#page-dekanat-grades .xl-filter-chip').forEach(function(c){c.classList.remove('active');});
  if(btn)btn.classList.add('active');
  renderDekanatGrades();
}

function renderDekanatGrades(){
  var el=document.getElementById('dekGradeBody');if(!el)return;
  var grp=document.getElementById('dekGradeGroup')?.value||'AI-2301';
  var subF=document.getElementById('dekGradeSub')?.value||'all';
  var q=(document.getElementById('dekGradeSearch')?.value||'').toLowerCase();
  var students=STUDENTS_DATA.filter(function(s){return s.group===grp;});
  var grades=subF==='all'?GRADES_DATA:GRADES_DATA.filter(function(g){return g.sub===subF;});
  var tEl=document.getElementById('dekGradeTitle');
  if(tEl)tEl.textContent='📊 '+grp+' — '+(subF==='all'?'Barcha fanlar':subF);
  var rows=[];var sum=0,cnt=0,alo=0,good=0,fail=0;
  var palette=['#1B4FD8','#7C3AED','#0891B2','#16A34A','#D97706','#DC2626','#0F766E','#9333EA'];
  students.forEach(function(s){
    if(q&&!s.name.toLowerCase().includes(q))return;
    grades.forEach(function(g){
      var key=s.id+'_'+g.sub;var sv=SAVED_GRADES[key];
      var jn=sv?sv.jn:g.jn,on=sv?sv.on:g.on,yn=sv?sv.yn:g.yn,mi=sv?sv.mi:g.mi;
      var total=jn+on+yn+mi;
      if(_dekFilter==='alo'&&total<86)return;
      if(_dekFilter==='yaxshi'&&(total<71||total>=86))return;
      if(_dekFilter==='fail'&&total>=55)return;
      sum+=total;cnt++;
      if(total>=86)alo++;else if(total>=71)good++;else if(total<55)fail++;
      var gr=getGrade(total);
      var tc=total>=86?'#166534':total>=71?'#1E40AF':total>=56?'#92400E':'#991B1B';
      var tb=total>=86?'#DCFCE7':total>=71?'#DBEAFE':total>=56?'#FEF3C7':'#FEE2E2';
      var ini=s.name.split(' ').map(function(x){return x[0];}).join('');
      var col=palette[s.id%palette.length];
      rows.push('<tr>'
        +'<td>'+cnt+'</td>'
        +'<td style="min-width:140px"><div style="display:flex;align-items:center;gap:7px">'
          +'<div style="background:'+col+';width:26px;height:26px;min-width:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:10px;font-weight:700">'+ini+'</div>'
          +'<span style="font-weight:600;font-size:12px">'+s.name+'</span></div></td>'
        +'<td style="min-width:150px;font-size:12px;color:#57606A">'+g.sub+'</td>'
        +'<td class="xl-td-num" style="background:#F5F3FF"><span style="font-weight:700;color:#6D28D9">'+jn+'</span><span style="color:#9CA3AF;font-size:10px"> /30</span></td>'
        +'<td class="xl-td-num" style="background:#EFF6FF"><span style="font-weight:700;color:#1E40AF">'+on+'</span><span style="color:#9CA3AF;font-size:10px"> /20</span></td>'
        +'<td class="xl-td-num" style="background:#F0FDF4"><span style="font-weight:700;color:#166534">'+yn+'</span><span style="color:#9CA3AF;font-size:10px"> /30</span></td>'
        +'<td class="xl-td-num" style="background:#FFFBEB"><span style="font-weight:700;color:#92400E">'+mi+'</span><span style="color:#9CA3AF;font-size:10px"> /20</span></td>'
        +'<td class="xl-td-total"><span style="background:'+tb+';color:'+tc+';padding:3px 10px;border-radius:6px;font-size:14px;font-weight:800">'+total+'</span></td>'
        +'<td class="xl-td-baho"><span class="grade-chip '+gr.cls+'">'+gr.letter+'</span></td>'
        +'</tr>');
    });
  });
  el.innerHTML=rows.join('');
  var avg=cnt?(sum/cnt).toFixed(1):'—';
  var dc=document.getElementById('dekGradeCount');if(dc)dc.textContent=cnt;
  var da=document.getElementById('dekGradeAvg');if(da)da.textContent=avg;
  var dal=document.getElementById('dekGradeAlo');if(dal)dal.textContent=alo;
  var dg=document.getElementById('dekGradeGood');if(dg)dg.textContent=good;
  var df=document.getElementById('dekGradeFail');if(df)df.textContent=fail;
  // Stats cards
  var sEl=document.getElementById('dekGradeStats');if(!sEl)return;
  sEl.innerHTML='<div class="stat-card"><div class="stat-card-top"><div class="stat-card-label">Talabalar</div><div class="stat-card-icon" style="background:var(--primary-light)">👥</div></div><div class="stat-card-val" style="color:var(--primary)">'+students.length+'</div><div class="stat-card-change sc-flat">'+grp+'</div><div class="stat-card-bar scb-blue"></div></div>'
   +'<div class="stat-card"><div class="stat-card-top"><div class="stat-card-label">O\'rtacha ball</div><div class="stat-card-icon" style="background:var(--green-light)">📊</div></div><div class="stat-card-val" style="color:var(--green)">'+avg+'</div><div class="stat-card-change sc-flat">Barcha fanlar</div><div class="stat-card-bar scb-green"></div></div>'
   +'<div class="stat-card"><div class="stat-card-top"><div class="stat-card-label">A\'lochilar</div><div class="stat-card-icon" style="background:var(--yellow-light)">⭐</div></div><div class="stat-card-val" style="color:var(--yellow)">'+alo+'</div><div class="stat-card-change sc-up">86+ ball</div><div class="stat-card-bar scb-orange"></div></div>'
   +'<div class="stat-card"><div class="stat-card-top"><div class="stat-card-label">Qoniqarsiz</div><div class="stat-card-icon" style="background:var(--red-light)">⚠️</div></div><div class="stat-card-val" style="color:var(--red)">'+fail+'</div><div class="stat-card-change sc-down">55 dan past</div><div class="stat-card-bar scb-red"></div></div>';
}

function exportDekanatGrades(){
  var grp=document.getElementById('dekGradeGroup')?.value||'AI-2301';
  var students=STUDENTS_DATA.filter(function(s){return s.group===grp;});
  var csv='Talaba,Guruh,Fan,JN/30,ON/20,YN/30,MI/20,Jami/100,Baho\n';
  students.forEach(function(s){
    GRADES_DATA.forEach(function(g){
      var key=s.id+'_'+g.sub;var sv=SAVED_GRADES[key];
      var jn=sv?sv.jn:g.jn,on=sv?sv.on:g.on,yn=sv?sv.yn:g.yn,mi=sv?sv.mi:g.mi;
      var t=jn+on+yn+mi;
      csv+='"'+s.name+'","'+grp+'","'+g.sub+'",'+jn+','+on+','+yn+','+mi+','+t+',"'+getGrade(t).letter+'"\n';
    });
  });
  var blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'});
  var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=grp+'_baholar.csv';a.click();
  showToast('📥','Excel','Yuklab olindi');
}

function renderGradeDistribution(){
  var el=document.getElementById('gradeDistribution');if(!el)return;
  // compute from real data
  var totals=[];
  STUDENTS_DATA.forEach(function(s){
    GRADES_DATA.forEach(function(g){
      var key=s.id+'_'+g.sub;var sv=SAVED_GRADES[key];
      var t=(sv?sv.jn:g.jn)+(sv?sv.on:g.on)+(sv?sv.yn:g.yn)+(sv?sv.mi:g.mi);
      totals.push(t);
    });
  });
  if(!totals.length) totals=[83,76,68,52,91,74,88,61,79,84,55,93,70,82,47,75];
  var alo=totals.filter(function(t){return t>=86;}).length;
  var yaxshi=totals.filter(function(t){return t>=71&&t<86;}).length;
  var qoniq=totals.filter(function(t){return t>=56&&t<71;}).length;
  var fail=totals.filter(function(t){return t<56;}).length;
  var total=totals.length;
  var data=[
    {l:"A'lo (86–100)",cnt:alo,pct:Math.round(alo/total*100),c:'#16A34A'},
    {l:'Yaxshi (71–85)',cnt:yaxshi,pct:Math.round(yaxshi/total*100),c:'#1B4FD8'},
    {l:'Qoniqarli (56–70)',cnt:qoniq,pct:Math.round(qoniq/total*100),c:'#D97706'},
    {l:'Qoniqarsiz (<56)',cnt:fail,pct:Math.round(fail/total*100),c:'#DC2626'}
  ];
  el.innerHTML=data.map(function(d){
    return '<div style="margin-bottom:14px">'
      +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px">'
        +'<span style="font-size:13px;color:#475569;font-weight:500">'+d.l+'</span>'
        +'<div style="display:flex;align-items:center;gap:10px">'
          +'<span style="font-size:11.5px;color:#94A3B8">'+d.cnt+' ta</span>'
          +'<span style="font-size:13px;font-weight:800;font-family:\'DM Mono\',monospace;color:'+d.c+'">'+d.pct+'%</span>'
        +'</div>'
      +'</div>'
      +'<div style="height:8px;background:#F1F5F9;border-radius:4px;overflow:hidden">'
        +'<div style="height:100%;background:'+d.c+';border-radius:4px;width:'+d.pct+'%;transition:width 0.6s ease"></div>'
      +'</div>'
    +'</div>';
  }).join('');
}