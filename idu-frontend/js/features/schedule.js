'use strict';
// IDU - features/schedule.js

function _daysWeek(){ return currentLang==='ru'?DAYS_RU_WEEK:DAYS_UZ_WEEK; }

function _daysShort(){ return currentLang==='ru'?DAYS_SHORT_RU:DAYS_SHORT_UZ; }

function _type(t){ return currentLang==='ru'?(TYPE_RU[t]||t):t; }

function renderWeekNav(){
  const d=new Date(); const dow=d.getDay();
  const offset=ttWeekOffset||0;
  const monday=new Date(d); monday.setDate(d.getDate()-(dow===0?6:dow-1)+offset*7);
  const months=currentLang==='ru'?['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек']:['Yan','Fev','Mar','Apr','May','Iyn','Iyl','Avg','Sen','Okt','Noy','Dek'];
  const daysW=_daysWeek(); const daysS=_daysShort();
  const el=document.getElementById('ttWeekNav');if(!el)return;
  el.innerHTML=daysW.map((day,i)=>{
    const dd=new Date(monday);dd.setDate(monday.getDate()+i);
    const isToday=dd.toDateString()===d.toDateString();
    return `<div class="week-cell${isToday?' today':''}" onclick="highlightDay(${i})">
      <div class="wc-day">${daysS[i]}</div>
      <div class="wc-num">${dd.getDate()}</div>
      <div class="wc-dots">
        ${(SCHEDULE[currentTTGroup]?.[i]||[]).filter(Boolean).map(l=>`<div class="wc-dot" style="background:${getDotColor(l.sub)}"></div>`).join('')}
      </div>
    </div>`;
  }).join('');
}

function getDotColor(sub){
  const map={'Matematika':'#3B82F6','Dasturlash':'#7C3AED','Ingliz tili':'#EA580C','Fizika':'#16A34A','Algoritmlar':'#DC2626','Algebra':'#0D9488'};
  return map[sub]||'#94A3B8';
}

function highlightDay(i){/* visual only */}

function buildTTTable(headId,bodyId,grp,editable){
  const today=new Date().getDay(); // 0=Sun,1=Mon...
  const head=document.getElementById(headId);
  const body=document.getElementById(bodyId);
  if(!head||!body)return;
  // Week offset for week display label
  const weekOffset = ttWeekOffset || 0;
  const baseDate = new Date();
  const dow = baseDate.getDay();
  const monday = new Date(baseDate);
  monday.setDate(baseDate.getDate() - (dow===0?6:dow-1) + weekOffset*7);
  const months=currentLang==='ru'?['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек']:['Yan','Fev','Mar','Apr','May','Iyn','Iyl','Avg','Sen','Okt','Noy','Dek'];
  const daysW=_daysWeek();
  const vaqtPara=currentLang==='ru'?'Время / Пара':'Vaqt / Para';
  const paraWord=currentLang==='ru'?'-пара':'-para';
  head.innerHTML=`<tr>
    <th style="min-width:90px">${vaqtPara}</th>
    ${daysW.map((d,i)=>{
      const dd=new Date(monday);dd.setDate(monday.getDate()+i);
      const isToday=dd.toDateString()===baseDate.toDateString();
      return`<th class="${isToday?'tt-today-header':''}">${d}<div style="font-size:10px;font-weight:400;opacity:0.8;margin-top:2px">${dd.getDate()} ${months[dd.getMonth()]}</div></th>`;
    }).join('')}
  </tr>`;
  const sched=SCHEDULE[grp]||SCHEDULE['AI-2301']||[];
  body.innerHTML=TIMES.map((time,ti)=>`
    <tr>
      <td class="time-col"><div style="font-weight:700;font-size:12px">${ti+1}${paraWord}</div>${time}</td>
      ${DAYS.map((_,di)=>{
        const lesson=sched[ti]?.[di];
        if(editable){
          if(!lesson)return`<td><div class="tt-empty" onclick="openAddLessonModal(${di},${ti})" style="cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--text4);font-size:20px;transition:all 0.15s" onmouseover="this.style.background='var(--primary-light)';this.style.color='var(--primary)'" onmouseout="this.style.background='';this.style.color='var(--text4)'">+</div></td>`;
          const cls=SUBJECTS_COLORS[lesson.sub]||'tt-blue';
          return`<td><div class="tt-cell ${cls}" onclick="openEditLessonModal(${di},${ti})" style="cursor:pointer;position:relative" title="Tahrirlash uchun bosing">
            <div class="tt-cell-subject">${lesson.sub}</div>
            <div class="tt-cell-teacher">👨‍🏫 ${lesson.teacher}</div>
            <div class="tt-cell-room">🚪 ${lesson.room}</div>
            <div style="font-size:9px;opacity:0.7;margin-top:2px">${_type(lesson.type)}</div>
            <div style="position:absolute;top:4px;right:4px;font-size:11px;opacity:0.6">✏️</div>
          </div></td>`;
        }
        if(!lesson)return`<td><div class="tt-empty"></div></td>`;
        const cls=SUBJECTS_COLORS[lesson.sub]||'tt-blue';
        return`<td><div class="tt-cell ${cls}" title="${lesson.sub} — ${lesson.teacher} — ${lesson.room}">
          <div class="tt-cell-subject">${lesson.sub}</div>
          <div class="tt-cell-teacher">👨‍🏫 ${lesson.teacher}</div>
          <div class="tt-cell-room">🚪 ${lesson.room}</div>
          <div style="font-size:9px;opacity:0.7;margin-top:2px">${lesson.type}</div>
        </div></td>`;
      }).join('')}
    </tr>`).join('');
}

function buildTTLegend(grp){
  const el=document.getElementById('ttLegend');if(!el)return;
  const sched=SCHEDULE[grp]||[];
  const seen={};
  sched.flat().filter(Boolean).forEach(l=>{if(!seen[l.sub])seen[l.sub]=l.sub});
  el.innerHTML=Object.keys(seen).map(sub=>{
    const cls=SUBJECTS_COLORS[sub]||'tt-blue';
    return`<div class="tt-cell ${cls}" style="min-height:auto;padding:4px 10px;font-size:12px;font-weight:700">${sub}</div>`;
  }).join('');
}

function setTTView(v,el){
  document.querySelectorAll('.filter-chip').forEach(c=>c.classList.remove('active'));
  el.classList.add('active');
}

function changeWeek(delta){
  if(delta===0){ ttWeekOffset=0; }
  else { ttWeekOffset += delta; }
  renderTimetable();
}

function saveNewLesson(){
  const grp = document.getElementById('dekScheduleGroup')?.value || 'AI-2301';
  const dayIdx = parseInt(document.getElementById('lessonDay').value);
  const timeIdx = parseInt(document.getElementById('lessonTime').value);
  const sub = document.getElementById('lessonSubject').value;
  const teacher = document.getElementById('lessonTeacher').value;
  const room = document.getElementById('lessonRoom').value;
  const type = document.getElementById('lessonType').value;
  if(!SCHEDULE[grp]) SCHEDULE[grp] = Array(5).fill(null).map(()=>Array(5).fill(null));
  if(!SCHEDULE[grp][timeIdx]) SCHEDULE[grp][timeIdx] = Array(5).fill(null);
  SCHEDULE[grp][timeIdx][dayIdx] = {sub, teacher, room, type};
  closeAddLessonModal();
  showToast('✅','Saqlandi',`${sub} darsi jadvalga qo'shildi`);
  setTimeout(()=>renderDekanatSchedule(), 200);
}

function deleteLesson(){
  const grp = document.getElementById('dekScheduleGroup')?.value || 'AI-2301';
  const dayIdx = parseInt(document.getElementById('editLessonDay').value);
  const timeIdx = parseInt(document.getElementById('editLessonTime').value);
  if(SCHEDULE[grp]?.[timeIdx]) SCHEDULE[grp][timeIdx][dayIdx] = null;
  closeAddLessonModal();
  showToast('🗑️','O\'chirildi','Dars jadvaldan o\'chirildi');
  setTimeout(()=>renderDekanatSchedule(), 200);
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
      const teacherName=(typeof currentUser!=='undefined'&&currentUser?.name)||'';
      if(l&&teacherName&&l.teacher.includes(teacherName.split(' ')[0]))lessons.push({...l,para:i,grp});
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

function renderDekanatSchedule(){
  const grp=document.getElementById('dekScheduleGroup')?.value||'AI-2301';
  currentDekScheduleGroup=grp;
  buildTTTable('dekTTHead','dekTTBody',grp,true); // editable=true
  renderRoomStatus(grp);
}