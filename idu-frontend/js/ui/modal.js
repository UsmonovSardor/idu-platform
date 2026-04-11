'use strict';
// IDU Platform — ui/modal.js

function closeForgotModal() {
  document.getElementById('forgotModal').style.display = 'none';
}

function openAddLessonModal(dayIdx, timeIdx){
  const modal = document.getElementById('addLessonModal');
  modal.style.display = 'flex';
  document.getElementById('lessonModalTitle').textContent = 'â Yangi dars qo\'shish';
  document.getElementById('lessonModalSub').textContent = 'Jadvalga yangi dars kiritish';
  document.getElementById('deleteLessonBtn').style.display = 'none';
  if(dayIdx !== undefined) document.getElementById('lessonDay').value = dayIdx;
  if(timeIdx !== undefined) document.getElementById('lessonTime').value = timeIdx;
  // pre-fill subject based on group
  const grp = document.getElementById('dekScheduleGroup')?.value || 'AI-2301';
  const subj = document.getElementById('lessonSubject');
  const aiSubs = ['Machine Learning','Python for AI','Deep Learning','Data Science','Computer Vision','Neural Networks','Natural Language Processing','Matematika (AI uchun)','Ingliz tili (Tech)'];
  const csSubs = ['Network Security','Ethical Hacking','Web Application Security','Kriptografiya','Digital Forensics','Cloud Security','IDS/IPS Tizimlari','Ingliz tili (Tech)'];
  const itSubs = ['Dasturlash Asoslari',"Ma'lumotlar Tuzilmasi",'Algoritmlar','Web Dasturlash',"Ma'lumotlar Bazasi",'Kompyuter Tarmoqlari','Operatsion Tizimlar','Ingliz tili (Tech)'];
  const dbSubs = ['Raqamli Marketing','E-Tijorat','Biznes Analitika','Raqamli Transformatsiya','Loyiha Boshqaruvi','Moliyaviy Texnologiyalar','Tadbirkorlik','Ingliz tili (Tech)'];
  const map = {'AI-2301':aiSubs,'CS-2301':csSubs,'IT-2301':itSubs,'DB-2301':dbSubs};
  const relevantSubs = map[grp] || aiSubs;
  // Highlight relevant subjects at top
  Array.from(subj.options).forEach(opt => {
    opt.style.fontWeight = relevantSubs.includes(opt.value) ? '700' : 'normal';
    opt.style.color = relevantSubs.includes(opt.value) ? 'var(--primary)' : '';
  });
}

function openEditLessonModal(dayIdx, timeIdx){
  const grp = document.getElementById('dekScheduleGroup')?.value || 'AI-2301';
  const lesson = SCHEDULE[grp]?.[timeIdx]?.[dayIdx];
  if(!lesson) { openAddLessonModal(dayIdx, timeIdx); return; }
  const modal = document.getElementById('addLessonModal');
  modal.style.display = 'flex';
  document.getElementById('lessonModalTitle').textContent = 'âï¸ Darsni tahrirlash';
  document.getElementById('lessonModalSub').textContent = `${['Dushanba','Seshanba','Chorshanba','Payshanba','Juma'][dayIdx]} Â· ${timeIdx+1}-para`;
  document.getElementById('deleteLessonBtn').style.display = 'flex';
  document.getElementById('editLessonDay').value = dayIdx;
  document.getElementById('editLessonTime').value = timeIdx;
  document.getElementById('lessonDay').value = dayIdx;
  document.getElementById('lessonTime').value = timeIdx;
  // Set existing values
  const subj = document.getElementById('lessonSubject');
  for(let i=0;i<subj.options.length;i++) if(subj.options[i].value===lesson.sub||subj.options[i].text===lesson.sub) subj.selectedIndex=i;
  const teacher = document.getElementById('lessonTeacher');
  for(let i=0;i<teacher.options.length;i++) if(lesson.teacher.includes(teacher.options[i].text.replace('Prof. ',''))) teacher.selectedIndex=i;
  const room = document.getElementById('lessonRoom');
  for(let i=0;i<room.options.length;i++) if(room.options[i].text===lesson.room) room.selectedIndex=i;
  const type = document.getElementById('lessonType');
  for(let i=0;i<type.options.length;i++) if(type.options[i].text===lesson.type) type.selectedIndex=i;
}

function closeAddLessonModal(){
  document.getElementById('addLessonModal').style.display = 'none';
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

function openAddGroupModal(){
  document.getElementById('newGroupName').value='';
  document.getElementById('newGroupCount').value='25';
  document.getElementById('addGroupModal').style.display='flex';
}

function openEditGroupModal(name){
  const g=GROUPS_LIST.find(g=>g.name===name);if(!g)return;
  document.getElementById('newGroupName').value=g.name;
  document.getElementById('newGroupDir').value=g.dir;
  document.getElementById('newGroupCourse').value=g.course;
  document.getElementById('newGroupCount').value=g.count;
  document.getElementById('addGroupModal').style.display='flex';
}

function closeJobModal(){
  document.getElementById('jobApplyModal').style.display='none';
  currentApplyCompany = null;
  resumeFileData = null;
}

function openGuideModal(roleKey){
  const data = GUIDE_DATA[roleKey];
  if(!data) return;
  document.getElementById('guideModalIcon').textContent = data.icon;
  document.getElementById('guideModalTitle').textContent = data.title;
  document.getElementById('guideModalBody').innerHTML = data.steps.map(s=>`
    <div class="guide-step-card">
      <div class="guide-step-num">${s.num}</div>
      <div class="guide-step-content">
        <div class="guide-step-title">${s.title}</div>
        <div class="guide-step-desc">${s.desc}</div>
      </div>
    </div>
  `).join('');
  _openModal('guideModal');
}

function closeGuideModal(){ _closeModal('guideModal'); }

function openFaqModal(){
  document.getElementById('faqModalBody').innerHTML = FAQ_DATA.map((item,i)=>`
    <div class="faq-item" onclick="toggleFaq(${i})">
      <div class="faq-q" id="faq-q-${i}">
        <span>${item.q}</span>
        <span class="faq-arrow" id="faq-arr-${i}">â¼</span>
      </div>
      <div class="faq-a" id="faq-a-${i}" style="display:none">${item.a}</div>
    </div>
  `).join('');
  _openModal('faqModal');
}

function closeFaqModal(){ _closeModal('faqModal'); }

function openAboutModal(){ _openModal('aboutModal'); }

function closeAboutModal(){ _closeModal('aboutModal'); }

function openFeatModal(){ _openModal('featModal'); }

function closeFeatModal(){ _closeModal('featModal'); }

function openLoginModal(){
  document.getElementById('loginModalBg').classList.add('open');
  document.body.style.overflow='hidden';
  setTimeout(function(){ var el=document.getElementById('mainLogin'); if(el) el.focus(); }, 80);
}

function closeLoginModal(e){
  if(e.target===document.getElementById('loginModalBg')) closeLoginModalForce();
}

function closeLoginModalForce(){
  document.getElementById('loginModalBg').classList.remove('open');
  document.body.style.overflow='';
  // Reset new login form
  var lEl=document.getElementById('mainLogin'); if(lEl) lEl.value='';
  var pEl=document.getElementById('mainPass'); if(pEl){pEl.value='';pEl.type='password';}
  var errEl=document.getElementById('mainLoginError'); if(errEl) errEl.classList.remove('show');
  selectedRole=null;
}

function openAddQuestionModal() {
  _editingQId = null;
  document.getElementById('questionModalTitle').textContent = 'â Yangi savol qo\'shish';
  document.getElementById('qModalText').value = '';
  document.getElementById('qModalIzoh').value = '';
  document.getElementById('qOpt0').value = '';
  document.getElementById('qOpt1').value = '';
  document.getElementById('qOpt2').value = '';
  document.getElementById('qOpt3').value = '';
  document.querySelectorAll('input[name="qModalCorrect"]').forEach(function(r) { r.checked = false; });
  document.querySelector('input[name="qModalCorrect"][value="0"]').checked = true;
  document.getElementById('addQuestionModal').style.display = 'block';
}

function closeQuestionModal() {
  document.getElementById('addQuestionModal').style.display = 'none';
  _editingQId = null;
}