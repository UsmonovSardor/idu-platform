'use strict';
// IDU - pages/teacher.js
// Ustoz paneli funksiyalari

function fillTeacher(l,p,d){
  document.getElementById('tLogin').value=l;
  document.getElementById('tPass').value=p;
  document.getElementById('tDept').value=d;
}

function renderTeacherTimetable(){
  // Show schedule for all groups where this teacher teaches
  buildTTTable('teacherTTHead','teacherTTBody','CS-2301');
}

function renderTeacherTodayFull(){
  const el=document.getElementById('teacherTodayFull');if(!el)return;
  const todayIdx=Math.max(0,Math.min(new Date().getDay()-1,4));
  let lessons=[];
  Object.keys(SCHEDULE).forEach(grp=>{
    (SCHEDULE[grp][todayIdx]||[]).forEach((l,i)=>{
      if(l&&l.teacher.startsWith('Toshmatov'))lessons.push({...l,para:i,grp});
    });
  });
  if(!lessons.length){el.innerHTML=`<div style="color:var(--text3);font-size:13px">${currentLang==='ru'?'Сегодня нет занятий':'Bugun dars yo\'q yoki bu o\'qituvchiga dars tayinlanmagan'}</div>`;return;}
  el.innerHTML=lessons.map(l=>`
    <div class="sched-item" style="margin-bottom:8px">
      <div class="sched-stripe" style="background:${getDotColor(l.sub)}"></div>
      <div class="sched-time">${TIMES[l.para]}</div>
      <div class="sched-body">
        <div class="sched-name">${l.sub} — <span style="color:var(--primary);font-size:13px">${l.grp}</span></div>
        <div class="sched-meta">
          <span class="sched-room-tag">🚪 ${l.room}</span>
          <span style="font-size:10.5px;color:var(--text3)">${_type(l.type)}</span>
        </div>
      </div>
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