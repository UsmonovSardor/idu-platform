'use strict';
// IDU - pages/student.js — Real API

async function renderStudentList() {
  const el = document.getElementById('teacherStudentBody');
  if (!el) return;
  el.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px">⏳</td></tr>';
  try {
    const grp = document.getElementById('studGroupFilter')?.value || '';
    let url = '/students?limit=50';
    if (grp) url += '&faculty=' + encodeURIComponent(grp);
    const data = await api('GET', url);
    const list = data.data || [];
    if (!list.length) {
      el.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px;color:#94a3b8">Talabalar topilmadi</td></tr>';
      return;
    }
    el.innerHTML = list.map((s, i) => `<tr>
      <td>${i + 1}</td>
      <td><div style="display:flex;align-items:center;gap:8px">
        <div class="dt-avatar" style="background:#1B4FD8">${(s.full_name||'?').split(' ').map(x=>x[0]).join('').substring(0,2)}</div>
        <span>${s.full_name || '—'}</span>
      </div></td>
      <td><span class="card-badge cb-blue">${s.faculty || '—'}</span></td>
      <td><span class="font-mono">${parseFloat(s.gpa||0).toFixed(2)}</span></td>
      <td>—</td>
      <td><span class="status-tag st-active">Faol</span></td>
      <td><button class="btn btn-secondary btn-sm" onclick="openStudentDetailById(${s.id})">Ko'rish</button></td>
    </tr>`).join('');
  } catch(e) {
    el.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:20px;color:#ef4444">Xato: ${e.message}</td></tr>`;
  }
}

async function openStudentDetailById(id) {
  try {
    const s = await api('GET', '/students/' + id);
    const grades = await api('GET', '/students/' + id + '/grades');
    const modal = document.getElementById('studentDetailModal');
    if (!modal) return;
    document.getElementById('studentDetailTitle').textContent = s.full_name || 'Talaba';
    document.getElementById('studentDetailContent').innerHTML = `
      <div style="display:flex;align-items:center;gap:16px;margin-bottom:20px">
        <div style="width:60px;height:60px;border-radius:14px;background:linear-gradient(135deg,#1B4FD8,#3B82F6);display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:800;color:white">${(s.full_name||'?').split(' ').map(x=>x[0]).join('').substring(0,2)}</div>
        <div>
          <div style="font-size:20px;font-weight:800">${s.full_name || '—'}</div>
          <div style="color:#64748b;margin-top:4px">${s.faculty || '—'} · ${s.year_of_study || '?'}-kurs</div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px">
        <div style="text-align:center;padding:14px;background:#F8FAFC;border-radius:10px">
          <div style="font-size:22px;font-weight:900;color:#1B4FD8">${parseFloat(s.gpa||0).toFixed(2)}</div>
          <div style="font-size:12px;color:#64748b">GPA</div>
        </div>
        <div style="text-align:center;padding:14px;background:#F8FAFC;border-radius:10px">
          <div style="font-size:22px;font-weight:900;color:#16A34A">${s.student_id_number || '—'}</div>
          <div style="font-size:12px;color:#64748b">ID raqam</div>
        </div>
        <div style="text-align:center;padding:14px;background:#F8FAFC;border-radius:10px">
          <div style="font-size:22px;font-weight:900;color:#D97706">${s.department || '—'}</div>
          <div style="font-size:12px;color:#64748b">Kafedra</div>
        </div>
      </div>
      ${grades.length ? `<table class="grade-table">
        <thead><tr><th>Fan</th><th>JN</th><th>ON</th><th>YN</th><th>MI</th><th>Jami</th><th>Baho</th></tr></thead>
        <tbody>${grades.map(g => {
          const total = parseFloat(g.total) || 0;
          const letter = g.letter_grade || (total>=86?'A':total>=71?'B':total>=56?'C':total>=41?'D':'F');
          const cls = {A:'gc-a',B:'gc-b',C:'gc-c',D:'gc-d',F:'gc-f'}[letter] || 'gc-f';
          return `<tr><td>${g.course_name||'—'}</td><td>${g.jn||0}</td><td>${g.on_score||0}</td><td>${g.yn||0}</td><td>${g.mi||0}</td><td><strong>${total}</strong></td><td><span class="grade-chip ${cls}">${letter}</span></td></tr>`;
        }).join('')}</tbody>
      </table>` : '<div style="text-align:center;padding:20px;color:#94a3b8">Baholar kiritilmagan</div>'}`;
    modal.classList.add('open');
  } catch(e) { showToast('❌', 'Xato', e.message); }
}

// Backward compat
function openStudentDetail(id) { openStudentDetailById(id); }
function filterStudents() { renderDekanatStudents && renderDekanatStudents(); }

async function renderRating() {
  const el = document.getElementById('ratingList');
  if (!el) return;
  el.innerHTML = '<div style="text-align:center;padding:30px;color:#94a3b8">⏳ Yuklanmoqda...</div>';
  try {
    const data = await api('GET', '/exams/history?limit=100');
    if (!Array.isArray(data) || !data.length) {
      el.innerHTML = '<div style="text-align:center;padding:40px;color:#94a3b8"><div style="font-size:40px;margin-bottom:12px">🏆</div><div>Reyting ma\'lumotlari yo\'q</div><div style="font-size:13px;margin-top:8px">Imtihonlar o\'tkazilgandan keyin reyting shakllanadi</div></div>';
      return;
    }
    // Student bo'yicha o'rtacha
    const byStudent = {};
    data.forEach(r => {
      if (!byStudent[r.student_name]) byStudent[r.student_name] = [];
      byStudent[r.student_name].push(parseFloat(r.score) || 0);
    });
    const sorted = Object.entries(byStudent)
      .map(([name, scores]) => ({ name, avg: scores.reduce((a,b)=>a+b,0)/scores.length, count: scores.length }))
      .sort((a,b) => b.avg - a.avg);
    el.innerHTML = sorted.map((s, i) => {
      const isMe = s.name === currentUser?.name;
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '';
      return `<div class="rank-row${isMe ? ' me' : ''}" style="${isMe ? 'background:#EEF3FF;border-radius:10px;' : ''}">
        <div class="rank-pos${i < 3 ? ' rp-' + (i+1) : ''}">${medal || (i+1)}</div>
        <div class="rank-info">
          <div class="rank-name">${s.name}${isMe ? ' <span style="color:#1B4FD8;font-size:11px">(Siz)</span>' : ''}</div>
          <div class="rank-dept">${s.count} ta imtihon</div>
        </div>
        <div class="rank-score">${s.avg.toFixed(1)}%</div>
      </div>`;
    }).join('');
  } catch(e) {
    el.innerHTML = `<div style="text-align:center;padding:30px;color:#ef4444">Xato: ${e.message}</div>`;
  }
}

// Stub funksiyalar - eski kodni buzmaslik uchun
function renderMaterials() {
  const el = document.getElementById('materialsList');
  if (!el) return;
  el.innerHTML = '<div style="text-align:center;padding:40px;color:#94a3b8"><div style="font-size:40px;margin-bottom:12px">📚</div><div>Materiallar tez kunda qo\'shiladi</div></div>';
}
function filterMaterials(f, el) {}
function renderGroupsPage() {}
function moveStudentToGroup() {}
function openAddStudentModal() {}
function openStudentEditModal() {}
function closeStudentModal() {}
function saveStudentEdit() {}
function deleteStudent() {}
function renderGroupsStudentTable() {}
function quickChangeGroup() {}
function quickChangeCourse() {}
function saveNewGroup() {}
function deleteGroup() {}
function refreshAllGroupDropdowns() {}
function populateMoveSelects() {}
function renderGroupsOverview() {}
function loadGradeGroup() {}
function renderDekanatGrades() {}
function renderDekanatAttendance() {}
