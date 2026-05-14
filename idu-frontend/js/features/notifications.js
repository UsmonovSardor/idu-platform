'use strict';

var _notifsCache = [];

async function renderNotifications() {
  const el = document.getElementById('notifList');
  if (!el) return;

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

  // Local announcements (always shown)
  var local = typeof NOTIFS !== 'undefined' ? NOTIFS : [];
  combined = combined.concat(local);

  var role = (typeof currentUser !== 'undefined' && currentUser) ? currentUser.role : '';

  if (typeof api !== 'undefined') {
    // Dekanat/admin: exam results only (etiraz is in sesiya panel, NOT here)
    if (role === 'dekanat' || role === 'admin') {
      try {
        var attempts = await api('GET', '/exams/history');
        if (Array.isArray(attempts)) {
          attempts.slice(0, 20).forEach(function(a) {
            var passed = a.letter_grade && a.letter_grade !== 'F';
            combined.push({
              icon: passed ? '✅' : '❌',
              color: passed ? '#F0FDF4' : '#FFF1F2',
              title: (a.student_name || 'Talaba') + ' — ' + (a.subject || '') +
                     ' ' + (a.exam_type === 'sesiya' ? 'Sesiya' : 'Test'),
              text: 'Ball: ' + (a.score || 0) + '% | Baho: ' + (a.letter_grade || '—') +
                    ' | ' + (a.correct_count || 0) + '/' + (a.total_count || 0),
              time: a.submitted_at ? _timeAgo(a.submitted_at) : '',
              unread: false
            });
          });
        }
      } catch(e) {}
    }

    // Teacher: new submissions notification
    if (role === 'teacher') {
      try {
        var asgns = await api('GET', '/assignments');
        var list = Array.isArray(asgns) ? asgns : (asgns.assignments || []);
        var total = list.reduce(function(s, a) { return s + (a.submission_count || 0); }, 0);
        if (total > 0) {
          combined.push({
            icon: '📝',
            color: '#EFF6FF',
            title: "Yangi javoblar",
            text: total + " ta talaba topshiriq yubordi — Vazifalar bo'limini ko'ring",
            time: '',
            unread: total > 0
          });
        }
      } catch(e) {}
    }

    // Student: submitted assignments feedback
    if (role === 'student') {
      try {
        var subs = await api('GET', '/submissions/my');
        var graded = (subs.submissions || []).filter(function(s) {
          return s.teacher_score !== null && s.teacher_score !== undefined;
        });
        graded.slice(0, 10).forEach(function(s) {
          combined.push({
            icon: '📊',
            color: '#F0FDF4',
            title: (s.assignment_title || 'Vazifa') + " — Baholandi",
            text: 'Yakuniy ball: ' + s.teacher_score + (s.teacher_comment ? ' | ' + s.teacher_comment : ''),
            time: s.updated_at ? _timeAgo(s.updated_at) : '',
            unread: false
          });
        });
      } catch(e) {}
    }
  }

  _notifsCache = combined;

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
