'use strict';
// IDU Platform — pages/student.js

function fillStudent(l,p,c,g){
  document.getElementById('sLogin').value=l;
  document.getElementById('sPass').value=p;
  document.getElementById('sCourse').value=c;
  document.getElementById('sGroup').value=g;
}

function renderStudentList(){
  const el=document.getElementById('teacherStudentBody');if(!el)return;
  const grp=document.getElementById('studGroupFilter')?.value||'all';
  const list=grp==='all'?STUDENTS_DATA:STUDENTS_DATA.filter(s=>s.group===grp);
  el.innerHTML=list.map((s,i)=>`
    <tr>
      <td>${i+1}</td>
      <td><div style="display:flex;align-items:center;gap:8px">
        <div class="dt-avatar" style="background:#1B4FD8">${s.name.split(' ').map(x=>x[0]).join('')}</div>
        <span>${s.name}</span>
      </div></td>
      <td><span class="card-badge cb-blue">${s.group}</span></td>
      <td><span class="font-mono">${s.avg}</span></td>
      <td><span class="${s.att<85?'status-tag st-warning':'status-tag st-active'}">${s.att}%</span></td>
      <td><span class="status-tag ${s.avg>=70&&s.att>=85?'st-active':s.avg>=55?'st-ok':'st-warning'}">${s.avg>=70&&s.att>=85?'A\'lo':'Qoniqarli'}</span></td>
      <td><button class="btn btn-secondary btn-sm" onclick="openStudentDetail(${s.id})">Ko'rish</button></td>
    </tr>`).join('');
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

function renderDekanatStudents(){
  filterStudents();
}

function renderGroupsStudentTable(){
  const el=document.getElementById('groupsStudentBody');if(!el)return;
  el.innerHTML=STUDENTS_DATA.map((s,i)=>`
    <tr>
      <td>${i+1}</td>
      <td><div style="display:flex;align-items:center;gap:8px">
        <div class="dt-avatar" style="background:#1B4FD8">${s.name.split(' ').map(x=>x[0]).join('')}</div>
        <span style="font-weight:600">${s.name}</span>
      </div></td>
      <td>
        <select class="form-select" style="width:auto;padding:5px 10px;font-size:12px" onchange="quickChangeGroup(${s.id},this.value)">
          ${getGroupNames().map(g=>`<option value="${g}"${g===s.group?' selected':''}>${g}</option>`).join('')}
        </select>
      </td>
      <td>
        <select class="form-select" style="width:auto;padding:5px 10px;font-size:12px" onchange="quickChangeCourse(${s.id},this.value)">
          <option value="1"${s.course==1?' selected':''}>1-kurs</option>
          <option value="2"${s.course==2?' selected':''}>2-kurs</option>
          <option value="3"${s.course==3?' selected':''}>3-kurs</option>
          <option value="4"${s.course==4?' selected':''}>4-kurs</option>
        </select>
      </td>
      <td>${s.avg}</td>
      <td><span class="status-tag ${s.att>=90?'st-active':'st-warning'}">${s.att}%</span></td>
      <td><button class="btn btn-sm btn-secondary" onclick="openStudentEditModal(${s.id})">âï¸ Tahrir</button></td>
    </tr>`).join('');
}

function moveStudentToGroup(){
  const sid=document.getElementById('moveStudentSelect')?.value;
  const grp=document.getElementById('moveToGroup')?.value;
  const course=document.getElementById('moveToCourse')?.value;
  if(!sid||!grp){ showToast('â ï¸','Xato','Talaba va guruhni tanlang'); return; }
  const s=STUDENTS_DATA.find(s=>s.id==sid);
  if(!s){ showToast('â ï¸','Xato','Talaba topilmadi'); return; }
  const old=s.group; s.group=grp; s.course=parseInt(course);
  showToast('â','Ko\'chirildi',`${s.name} â ${grp}, ${course}-kurs`);
  renderGroupsPage();
}

function openAddStudentModal(){
  document.getElementById('studentModalTitle').textContent='â Yangi talaba qo\'shish';
  document.getElementById('editStudentId').value='';
  document.getElementById('editStudentName').value='';
  document.getElementById('editStudentLogin').value='';
  document.getElementById('editStudentAvg').value='';
  document.getElementById('editStudentAtt').value='';
  document.getElementById('editStudentGroup').value='AI-2301';
  document.getElementById('editStudentCourse').value='1';
  document.getElementById('deleteStudentBtn').style.display='none';
  // Refresh group options
  const sel=document.getElementById('editStudentGroup');
  sel.innerHTML=getGroupNames().map(g=>`<option>${g}</option>`).join('');
  document.getElementById('studentEditModal').style.display='flex';
}

function openStudentEditModal(id){
  const s=STUDENTS_DATA.find(s=>s.id===id);
  if(!s) return;
  document.getElementById('studentModalTitle').textContent='âï¸ Talabani tahrirlash';
  document.getElementById('editStudentId').value=id;
  document.getElementById('editStudentName').value=s.name;
  document.getElementById('editStudentLogin').value=s.name.split(' ').map(x=>x.toLowerCase()).join('')||'';
  document.getElementById('editStudentAvg').value=s.avg;
  document.getElementById('editStudentAtt').value=s.att;
  document.getElementById('deleteStudentBtn').style.display='flex';
  const grpSel=document.getElementById('editStudentGroup');
  grpSel.innerHTML=getGroupNames().map(g=>`<option${g===s.group?' selected':''}>${g}</option>`).join('');
  grpSel.value=s.group;
  document.getElementById('editStudentCourse').value=s.course;
  document.getElementById('studentEditModal').style.display='flex';
}

function closeStudentModal(){
  document.getElementById('studentEditModal').style.display='none';
}

function saveStudentEdit(){
  const id=parseInt(document.getElementById('editStudentId').value);
  const name=document.getElementById('editStudentName').value.trim();
  const group=document.getElementById('editStudentGroup').value;
  const course=parseInt(document.getElementById('editStudentCourse').value);
  const avg=parseFloat(document.getElementById('editStudentAvg').value)||0;
  const att=parseFloat(document.getElementById('editStudentAtt').value)||0;
  if(!name){ showToast('â ï¸','Xato','Ism kiritish shart'); return; }
  if(id){
    const s=STUDENTS_DATA.find(s=>s.id===id);
    if(s){ s.name=name; s.group=group; s.course=course; s.avg=avg; s.att=att; s.gpa=+(avg/25).toFixed(1); }
    showToast('â','Saqlandi',`${name} ma'lumotlari yangilandi`);
  } else {
    const newId=Math.max(...STUDENTS_DATA.map(s=>s.id))+1;
    STUDENTS_DATA.push({id:newId,name,group,course,avg,att,gpa:+(avg/25).toFixed(1)});
    showToast('â','Qo\'shildi',`${name} talabalar ro'yxatiga qo'shildi`);
  }
  closeStudentModal();
  renderDekanatStudents();
  if(currentPage==='dekanat-groups') renderGroupsPage();
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

function renderMaterials(filter='all'){
  const el=document.getElementById('materialsList');if(!el)return;
  const f=filter==='all'?MATERIALS:MATERIALS.filter(m=>m.type===filter);
  el.innerHTML=f.map(m=>`
    <div class="card" style="margin-bottom:10px;padding:14px 18px">
      <div style="display:flex;align-items:center;gap:14px">
        <div style="font-size:28px">${m.icon}</div>
        <div style="flex:1">
          <div style="font-size:14px;font-weight:700;margin-bottom:2px">${m.title}</div>
          <div style="font-size:12px;color:var(--text2)">${m.sub} Â· ${m.size}</div>
        </div>
        <button class="btn btn-secondary btn-sm" onclick="showToast('ð¥','Yuklanmoqda','${m.title} yuklanmoqda...')">â¬ Yuklab olish</button>
      </div>
    </div>`).join('');
}

function filterMaterials(f,el){
  document.querySelectorAll('#page-materials .filter-chip').forEach(c=>c.classList.remove('active'));
  el.classList.add('active');
  renderMaterials(f);
}

function loadExtraUsers() {
  try {
    const extra = JSON.parse(_lsGet('idu_extra_users') || '{}');
    Object.keys(extra).forEach(role => {
      if (USERS[role]) USERS[role].push(...extra[role]);
    });
  } catch(e){}
}