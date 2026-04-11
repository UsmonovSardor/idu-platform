'use strict';
// IDU Platform — features/schedule.js

function _daysWeek(){ return currentLang==='ru'?DAYS_RU_WEEK:DAYS_UZ_WEEK; }

function _daysShort(){ return currentLang==='ru'?DAYS_SHORT_RU:DAYS_SHORT_UZ; }

function _type(t){ return currentLang==='ru'?(TYPE_RU[t]||t):t; }

function _months(){ return currentLang==='ru'?MONTHS_RU:MONTHS_UZ; }

function _days(){ return currentLang==='ru'?DAYS_RU:DAYS_UZ; }

function renderWeekNav(){
  const d=new Date(); const dow=d.getDay();
  const offset=ttWeekOffset||0;
  const monday=new Date(d); monday.setDate(d.getDate()-(dow===0?6:dow-1)+offset*7);
  const months=currentLang==='ru'?['Ð¯Ð½Ð²','Ð¤ÐµÐ²','ÐÐ°Ñ','ÐÐ¿Ñ','ÐÐ°Ð¹','ÐÑÐ½','ÐÑÐ»','ÐÐ²Ð³','Ð¡ÐµÐ½','ÐÐºÑ','ÐÐ¾Ñ','ÐÐµÐº']:['Yan','Fev','Mar','Apr','May','Iyn','Iyl','Avg','Sen','Okt','Noy','Dek'];
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
  const months=currentLang==='ru'?['Ð¯Ð½Ð²','Ð¤ÐµÐ²','ÐÐ°Ñ','ÐÐ¿Ñ','ÐÐ°Ð¹','ÐÑÐ½','ÐÑÐ»','ÐÐ²Ð³','Ð¡ÐµÐ½','ÐÐºÑ','ÐÐ¾Ñ','ÐÐµÐº']:['Yan','Fev','Mar','Apr','May','Iyn','Iyl','Avg','Sen','Okt','Noy','Dek'];
  const daysW=_daysWeek();
  const vaqtPara=currentLang==='ru'?'ÐÑÐµÐ¼Ñ / ÐÐ°ÑÐ°':'Vaqt / Para';
  const paraWord=currentLang==='ru'?'-Ð¿Ð°ÑÐ°':'-para';
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
            <div class="tt-cell-teacher">ð¨âð« ${lesson.teacher}</div>
            <div class="tt-cell-room">ðª ${lesson.room}</div>
            <div style="font-size:9px;opacity:0.7;margin-top:2px">${_type(lesson.type)}</div>
            <div style="position:absolute;top:4px;right:4px;font-size:11px;opacity:0.6">âï¸</div>
          </div></td>`;
        }
        if(!lesson)return`<td><div class="tt-empty"></div></td>`;
        const cls=SUBJECTS_COLORS[lesson.sub]||'tt-blue';
        return`<td><div class="tt-cell ${cls}" title="${lesson.sub} â ${lesson.teacher} â ${lesson.room}">
          <div class="tt-cell-subject">${lesson.sub}</div>
          <div class="tt-cell-teacher">ð¨âð« ${lesson.teacher}</div>
          <div class="tt-cell-room">ðª ${lesson.room}</div>
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
  showToast('â','Saqlandi',`${sub} darsi jadvalga qo'shildi`);
  setTimeout(()=>renderDekanatSchedule(), 200);
}

function deleteLesson(){
  const grp = document.getElementById('dekScheduleGroup')?.value || 'AI-2301';
  const dayIdx = parseInt(document.getElementById('editLessonDay').value);
  const timeIdx = parseInt(document.getElementById('editLessonTime').value);
  if(SCHEDULE[grp]?.[timeIdx]) SCHEDULE[grp][timeIdx][dayIdx] = null;
  closeAddLessonModal();
  showToast('ðï¸','O\'chirildi','Dars jadvaldan o\'chirildi');
  setTimeout(()=>renderDekanatSchedule(), 200);
}