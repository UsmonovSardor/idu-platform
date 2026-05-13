'use strict';
// IDU - pages/investor.js — Real API

async function renderInvestorDashboard() {
  const el = document.getElementById('topIdeasList');
  if (!el) return;
  el.innerHTML = '<div style="text-align:center;padding:20px;color:#94a3b8">⏳ Yuklanmoqda...</div>';
  try {
    const apps = await api('GET', '/applications?type=job&limit=10');
    const list = Array.isArray(apps) ? apps : [];
    if (!list.length) {
      el.innerHTML = '<div style="text-align:center;padding:30px;color:#94a3b8"><div style="font-size:36px;margin-bottom:10px">💼</div><div>Startup g\'oyalar hali yo\'q</div></div>';
      return;
    }
    el.innerHTML = list.map(a => `
      <div style="display:flex;align-items:center;gap:14px;padding:13px 0;border-bottom:1px solid #F8FAFC">
        <div style="font-size:24px">🚀</div>
        <div style="flex:1">
          <div style="font-size:14px;font-weight:700">${a.detail || '—'}</div>
          <div style="font-size:12px;color:#64748b">${a.student_name || '—'}</div>
        </div>
        <span style="font-size:11px;padding:3px 10px;background:#EEF3FF;color:#1B4FD8;border-radius:20px;font-weight:600">${a.status === 'approved' ? '✅ Tasdiqlangan' : '⏳ Kutilmoqda'}</span>
      </div>`).join('');
  } catch(e) {
    el.innerHTML = '<div style="text-align:center;padding:20px;color:#94a3b8">—</div>';
  }
}

// Startup - ideas
let _ideas = [];

async function renderIdeas(filter) {
  const el = document.getElementById('ideasList');
  if (!el) return;
  el.innerHTML = '<div style="text-align:center;padding:40px;color:#94a3b8"><div style="font-size:40px;margin-bottom:12px">🚀</div><div>Startup g\'oyalar bo\'limi tez kunda ochiladi</div><div style="font-size:13px;margin-top:8px">Bu yerda talabalar startup g\'oyalarini qo\'shadilar</div></div>';
}

function filterIdeas(f, el) {}
function likeIdea() {}
function rateIdea() {}
function addComment() {}
function toggleIdeaForm() {
  const fc = document.getElementById('ideaFormCard');
  if (fc) fc.style.display = fc.style.display === 'none' ? 'block' : 'none';
}
function submitIdea() { showToast('✅', 'Yuborildi', 'G\'oyangiz qo\'shildi'); }
function expressInterest() { showToast('💼', 'Qiziqish bildirилди', 'Jamoa siz bilan bog\'lanadi'); }
