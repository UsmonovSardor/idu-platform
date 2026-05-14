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

  var combined = [];

  // Local announcements
  var local = typeof NOTIFS !== 'undefined' ? NOTIFS : [];
  combined = combined.concat(local);

  // For dekanat/admin: fetch etiraz + exam results from API
  var role = (typeof currentUser !== 'undefined' && currentUser) ? currentUser.role : '';
  if (typeof api !== 'undefined') {
    // Etiraz arizalari
    try {
      var apps = await api('GET', '/applications');
      if (Array.isArray(apps)) {
        apps.filter(function(a) { return a.type === 'etiraz'; }).forEach(function(a) {
          combined.push({
            icon: '⚠️',
            color: '#FFF7ED',
            title: "E'tiroz: " + (a.student_name || 'Talaba'),
            text: a.detail || '',
            time: a.created_at ? _timeAgo(a.created_at) : '',
            unread: a.status === 'pending'
          });
        });
      }
    } catch(e) {}

    // Imtihon natijalari (dekanat)
    if (role === 'dekanat' || role === 'admin') {
      try {
        var attempts = await api('GET', '/exams/history');
        if (Array.isArray(attempts)) {
          attempts.slice(0, 20).forEach(function(a) {
            var passed = a.letter_grade && a.letter_grade !== 'F';
            combined.push({
              icon: passed ? '✅' : '❌',
              color: passed ? '#F0FDF4' : '#FFF1F2',
              title: (a.student_name || 'Talaba') + ' — ' + (a.subject || '') + ' ' + (a.exam_type === 'sesiya' ? 'Sesiya' : 'Test'),
              text: 'Ball: ' + (a.score || 0) + '% | Baho: ' + (a.letter_grade || '—') + ' | ' + (a.correct_count || 0) + '/' + (a.total_count || 0),
              time: a.submitted_at ? _timeAgo(a.submitted_at) : '',
              unread: false
            });
          });
        }
      } catch(e) {}
    }
  }

  _notifsCache = combined;

  // Update badge count
  var unread = _notifsCache.filter(function(n) { return n.unread; }).length;
  var badge = document.getElementById('notifCount');
  if (badge) {
    badge.textContent = unread;
    badge.style.display = unread ? '' : 'none';
  }

  _renderNotifList();
}

function _timeAgo(dateStr) {
  try {
    var diff = Date.now() - new Date(dateStr).getTime();
    var min = Math.floor(diff / 60000);
    if (min < 1) return 'Hozirgina';
    if (min < 60) return min + ' daqiqa oldin';
    var h = Math.floor(min / 60);
    if (h < 24) return h + ' soat oldin';
    return Math.floor(h / 24) + ' kun oldin';
  } catch(e) { return ''; }
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

  el.innerHTML = _notifsCache.map(function(n) {
    return '<div class="notif-item">' +
      '<div class="notif-icon-wrap" style="background:' + (n.color || 'var(--primary-light)') + '">' + (n.icon || '📢') + '</div>' +
      '<div style="flex:1">' +
        '<div class="notif-text"><span class="' + (n.unread ? 'notif-unread' : '') + '">' + (n.title || '') + '</span>' +
          (n.text ? ' — ' + n.text : '') + '</div>' +
        '<div class="notif-time">' + (n.time || '') + '</div>' +
      '</div>' +
      (n.unread ? '<div style="width:8px;height:8px;border-radius:50%;background:var(--primary);flex-shrink:0;margin-top:4px"></div>' : '') +
    '</div>';
  }).join('');
}

function markAllRead() {
  _notifsCache.forEach(function(n) { n.unread = false; });
  if (typeof NOTIFS !== 'undefined') NOTIFS.forEach(function(n) { n.unread = false; });
  var badge = document.getElementById('notifCount');
  if (badge) badge.style.display = 'none';
  _renderNotifList();
  showToast('✅', 'O\'qildi', 'Barcha bildirishnomalar o\'qildi');
}
