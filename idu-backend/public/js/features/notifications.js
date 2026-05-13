'use strict';
// IDU - features/notifications.js — Real API

async function renderNotifications() {
  const el = document.getElementById('notifList');
  if (!el) return;
  el.innerHTML = '<div style="padding:30px;text-align:center;color:#94a3b8">⏳ Yuklanmoqda...</div>';
  try {
    const data = await api('GET', '/applications?limit=20');
    const anns = await api('GET', '/announcements?limit=10').catch(() => []);
    const items = [
      ...(Array.isArray(anns) ? anns.map(a => ({
        icon: a.priority === 'urgent' ? '🚨' : a.priority === 'high' ? '📣' : '📋',
        color: a.priority === 'urgent' ? '#FEE2E2' : a.priority === 'high' ? '#FEF3C7' : '#EEF3FF',
        title: a.title,
        text: a.body,
        time: new Date(a.created_at).toLocaleDateString('uz-UZ'),
        unread: true
      })) : []),
      ...(Array.isArray(data) ? data.filter(a => a.status === 'approved' || a.status === 'rejected').map(a => ({
        icon: a.status === 'approved' ? '✅' : '❌',
        color: a.status === 'approved' ? '#D1FAE5' : '#FEE2E2',
        title: a.type === 'cert' ? 'Sertifikat arizasi' : 'Ariza',
        text: `${a.detail} — ${a.status === 'approved' ? 'tasdiqlandi' : 'rad etildi'}`,
        time: new Date(a.updated_at).toLocaleDateString('uz-UZ'),
        unread: false
      })) : [])
    ];
    if (!items.length) {
      el.innerHTML = '<div style="padding:40px;text-align:center;color:#94a3b8"><div style="font-size:40px;margin-bottom:12px">🔔</div><div>Bildirishnomalar yo\'q</div></div>';
      return;
    }
    el.innerHTML = items.map(n => `
      <div class="notif-item">
        <div class="notif-icon-wrap" style="background:${n.color}">${n.icon}</div>
        <div style="flex:1">
          <div class="notif-text"><span class="${n.unread ? 'notif-unread' : ''}">${n.title}</span> — ${n.text}</div>
          <div class="notif-time">${n.time}</div>
        </div>
      </div>`).join('');
    // Badge yangilash
    const unread = items.filter(i => i.unread).length;
    const badge = document.getElementById('notifCount');
    if (badge) { badge.textContent = unread; badge.style.display = unread ? '' : 'none'; }
  } catch (e) {
    el.innerHTML = '<div style="padding:20px;text-align:center;color:#94a3b8">Bildirishnomalar yuklanmadi</div>';
  }
}

async function markAllRead() {
  document.getElementById('notifCount') && (document.getElementById('notifCount').style.display = 'none');
  showToast('✅', "O'qildi", "Barcha bildirishnomalar o'qildi");
}
