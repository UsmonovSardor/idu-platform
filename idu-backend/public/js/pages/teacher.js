'use strict';
// IDU - pages/teacher.js — Real API

async function renderDekanatTeachers() {
  const el = document.getElementById('dekanatTeacherBody');
  if (!el) return;
  el.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px">⏳</td></tr>';
  try {
    const data = await api('GET', '/teachers?limit=50');
    const list = Array.isArray(data) ? data : (data.data || []);
    if (!list.length) {
      el.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:30px;color:#94a3b8">O\'qituvchilar topilmadi</td></tr>';
      return;
    }
    el.innerHTML = list.map((t, i) => `<tr>
      <td>${i + 1}</td>
      <td><div style="display:flex;align-items:center;gap:8px">
        <div class="dt-avatar" style="background:#16A34A">${(t.full_name||'?').split(' ').map(x=>x[0]).join('').substring(0,2)}</div>
        ${t.full_name || '—'}
      </div></td>
      <td>${t.department || '—'}</td>
      <td>${t.title || '—'}</td>
      <td>—</td>
      <td>—</td>
      <td><span class="status-tag st-active">Faol</span></td>
    </tr>`).join('');
  } catch(e) {
    el.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:20px;color:#ef4444">Xato: ${e.message}</td></tr>`;
  }
}

async function renderProfessorsPage() {
  const gridEl = document.getElementById('profGrid');
  const statsEl = document.getElementById('profStatsRow');
  if (!gridEl) return;
  gridEl.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:#94a3b8">⏳ Yuklanmoqda...</div>';
  try {
    const data = await api('GET', '/teachers?limit=50');
    const list = Array.isArray(data) ? data : (data.data || []);
    if (statsEl) {
      statsEl.innerHTML = `
        <div class="prof-stat-card"><div class="prof-stat-val">${list.length}</div><div class="prof-stat-lbl">Ustozlar</div></div>
        <div class="prof-stat-card"><div class="prof-stat-val">0</div><div class="prof-stat-lbl">Sharhlar</div></div>
        <div class="prof-stat-card"><div class="prof-stat-val">—</div><div class="prof-stat-lbl">O'rtacha reyting</div></div>`;
    }
    if (!list.length) {
      gridEl.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:#94a3b8"><div style="font-size:40px;margin-bottom:12px">👨‍🏫</div><div>O\'qituvchilar topilmadi</div></div>';
      return;
    }
    const colors = ['#1B4FD8','#7C3AED','#16A34A','#EA580C','#0D9488','#DC2626','#0EA5E9'];
    gridEl.innerHTML = list.map((t, i) => {
      const initials = (t.full_name||'?').split(' ').map(x=>x[0]).join('').substring(0,2);
      const color = colors[i % colors.length];
      return `<div class="prof-card">
        <div class="prof-card-head">
          <div class="prof-avatar" style="background:${color}">${initials}</div>
          <div style="flex:1">
            <div class="prof-name">${t.full_name || '—'}</div>
            <div class="prof-subject" style="font-size:11.5px">${t.department || '—'}</div>
            <div style="font-size:10px;color:#94A3B8;margin-top:2px">${t.title || ''}</div>
          </div>
        </div>
        <div style="font-size:12px;color:#64748b;padding:8px 0">${t.bio || 'Hali ma\'lumot kiritilmagan'}</div>
        <button class="prof-btn-rate" onclick="openProfReview(${t.id})">
          ⭐ Ustozni baholash
        </button>
      </div>`;
    }).join('');
  } catch(e) {
    gridEl.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;color:#ef4444">Xato: ${e.message}</div>`;
  }
}

function openProfReview(id) {
  showToast('ℹ️', 'Tez kunda', 'Baholash tizimi qo\'shiladi');
}

// Stubs
function setPrmStar() {}
function updatePrmStarsUI() {}
function setPrmCat() {}
function updatePrmCatUI() {}
function submitProfReview() { showToast('✅', 'Yuborildi', 'Sharhingiz saqlandi'); }
function closeProfReview() {
  const m = document.getElementById('profReviewModal');
  if (m) m.style.display = 'none';
}
function renderTopTeachers() {}
function initAttendance() {}
function saveAttendance() { showToast('✅', 'Saqlandi', 'Davomat muvaffaqiyatli saqlandi'); }
