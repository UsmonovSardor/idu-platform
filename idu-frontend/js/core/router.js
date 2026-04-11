'use strict';
// IDU Platform — core/router.js

function _tl(t){ return (currentLang==='ru' && t.labelRu) ? t.labelRu : t.label; }

function setupNav(role){
  const base = NAV_TABS[role] || [];
  const extra = (typeof NAV_EXTRA!=='undefined' && NAV_EXTRA[role]) ? NAV_EXTRA[role] : [];
  const tabs = [...base, ...extra];
  document.getElementById('topnavTabs').innerHTML = tabs.map(t=>`
    <button class="topnav-tab" onclick="showPage('${t.id}')" id="tab-${t.id}">
      ${t.icon} ${_tl(t)}${t.badge?`<span class="tab-badge">${t.badge}</span>`:''}
    </button>`).join('');
}

function setupChip(role,user){
  const colors={student:'#1B4FD8',teacher:'#16A34A',dekanat:'#7C3AED',investor:'#EA580C'};
  const roleLabelsUz={student:'Talaba',teacher:"O'qituvchi",dekanat:'Dekanat',investor:'Investor'};
  const roleLabelsRu={student:'Ð¡ÑÑÐ´ÐµÐ½Ñ',teacher:'ÐÑÐµÐ¿Ð¾Ð´Ð°Ð²Ð°ÑÐµÐ»Ñ',dekanat:'ÐÐµÐºÐ°Ð½Ð°Ñ',investor:'ÐÐ½Ð²ÐµÑÑÐ¾Ñ'};
  const roleLabels = currentLang==='ru' ? roleLabelsRu : roleLabelsUz;
  document.getElementById('chipAvatar').style.background=colors[role]||'#666';
  document.getElementById('chipAvatar').textContent=(user.name||'?').split(' ').map(x=>x[0]).join('').slice(0,2).toUpperCase();
  document.getElementById('chipName').textContent=user.name||user.login;
  document.getElementById('chipRole').textContent=roleLabels[role]||role;
}

function _months(){ return currentLang==='ru'?MONTHS_RU:MONTHS_UZ; }

function _days(){ return currentLang==='ru'?DAYS_RU:DAYS_UZ; }

function initDates(){
  const d=new Date();
  const months=_months(); const days=_days();
  const ds=`${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  const el=document.getElementById('dashDate');if(el)el.textContent=ds;
  const tb=document.getElementById('todayBadge');if(tb)tb.textContent=`${d.getDate()} ${months[d.getMonth()]}`;
  const td=document.getElementById('teacherDashDate');if(td)td.textContent=ds;
  const ttb=document.getElementById('teacherTodayBadge');if(ttb)ttb.textContent=`${d.getDate()} ${months[d.getMonth()]}`;
  const ad=document.getElementById('attDate');if(ad)ad.value=d.toISOString().split('T')[0];
  renderDashboardSchedule();
  renderDashboardTasks();
  renderDashboardGrades();
  renderWeekNav();
  renderAtRisk();
  renderTeacherTodayFull();
}