'use strict';

var _notifsCache = [];

async function renderNotifications() {
  const el = document.getElementById('notifList');
  if (!el) return;

  // Skeleton
  el.innerHTML = [1,2,3].map(() =>
    '<div class="notif-item">' +
      '<div class="skel" style="width:40px;height:40px;border-radius:10px;flex-shrink:0"></div>' +
      '<div style="flex:1;display:flex;flex-direction:column;gap:6px">' +
        '<div class="skel skel-line" style="width:70%"></div>' +
        '<div class="skel skel-line" style="width:40%"></div>' +
      '</div>' +
    '</div>'
  ).join('');

  // Local NOTIFS (dekanat e'lonlari)
  var local = typeof NOTIFS !== 'undefined' ? NOTIFS : [];

  // API dan ham olishga harakat qilish
  try {
    var data = await api('GET', '/applications');
    // applications ham bildirishnoma sifatida ko'rinsin
  } catch(e) {}

  _notifsCache = local;
  _renderNotifList();
}

function _renderNotifList() {
  const el = document.getElementById('notifList');
  if (!el) return;

  if (!_notifsCache.length) {
    el.innerHTML =
      '<div style="padding:40px 20px;text-align:center">' +
        '<div style="font-size:48px;margin-bottom:12px">🔔</div>' +
        '<div style="font-size:15px;font-weight:700;color:var(--text1);margin-bottom:6px">Bildirishnomalar yo\'q</div>' +
        '<div style="font-size:13px;color:var(--text3)">Yangi e\'lonlar va bildirishnomalar bu yerda ko\'rinadi</div>' +
      '</div>';
    return;
  }

  el.innerHTML = _notifsCache.map(n =>
    '<div class="notif-item">' +
      '<div class="notif-icon-wrap" style="background:' + (n.color || 'var(--primary-light)') + '">' + (n.icon || '📢') + '</div>' +
      '<div style="flex:1">' +
        '<div class="notif-text"><span class="' + (n.unread ? 'notif-unread' : '') + '">' + (n.title || '') + '</span>' +
          (n.text ? ' — ' + n.text : '') + '</div>' +
        '<div class="notif-time">' + (n.time || '') + '</div>' +
      '</div>' +
      (n.unread ? '<div style="width:8px;height:8px;border-radius:50%;background:var(--primary);flex-shrink:0;margin-top:4px"></div>' : '') +
    '</div>'
  ).join('');
}

function markAllRead() {
  _notifsCache.forEach(n => { n.unread = false; });
  if (typeof NOTIFS !== 'undefined') NOTIFS.forEach(n => { n.unread = false; });
  const badge = document.getElementById('notifCount');
  if (badge) badge.style.display = 'none';
  _renderNotifList();
  showToast('✅', 'O\'qildi', 'Barcha bildirishnomalar o\'qildi');
}
