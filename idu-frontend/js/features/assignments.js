'use strict';
// IDU - features/assignments.js

function renderDashboardTasks(){
  const el=document.getElementById('upcomingTasks');if(!el)return;
  el.innerHTML=TASKS_DATA.slice(0,3).map(t=>`
    <div class="task-item">
      <div class="task-top">
        <div>
          <div class="task-subject" style="color:var(--primary)">${t.sub}</div>
          <div class="task-name">${t.name}</div>
          <div class="task-due">📅 ${t.due} · ${t.pts} ball</div>
        </div>
        <span class="task-badge tb-${t.type}">${currentLang==='ru'?{test:'Тест',lab:'Лаб',hw:'Д/З',project:'Проект'}[t.type]:{test:'Test',lab:'Lab',hw:'Uy',project:'Loyiha'}[t.type]}</span>
      </div>
    </div>`).join('');
}

function renderTasks(filter='all'){
  const el=document.getElementById('tasksList');if(!el)return;
  const filtered=filter==='all'?TASKS_DATA:TASKS_DATA.filter(t=>t.type===filter);
  el.innerHTML=filtered.map(t=>`
    <div class="task-item">
      <div class="task-top">
        <div>
          <div class="task-subject" style="color:var(--primary)">${t.sub}</div>
          <div class="task-name">${t.name}</div>
          <div class="task-due">📅 Muddat: ${t.due}</div>
          <div class="task-pts">+${t.pts} ball</div>
        </div>
        <span class="task-badge tb-${t.type}">${{test:'Test',lab:'Lab',hw:'Uy ishi',project:'Loyiha'}[t.type]}</span>
      </div>
    </div>`).join('');
}

function filterTasks(f,el){
  document.querySelectorAll('#page-tasks .filter-chip').forEach(c=>c.classList.remove('active'));
  el.classList.add('active');
  renderTasks(f);
}