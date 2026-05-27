'use strict';

/* ═══════════════════════════════════════════════════════════════════
   IDU PLATFORM — ENHANCEMENTS FIXED
   ✅ Login avtomatik chiqmaydi
   ✅ Faqat "Kirish" bosilganda ochiladi
   ✅ Role hint ishlaydi
═══════════════════════════════════════════════════════════════════ */


// ── 0. API BASE — config.js da aniqlanadi (enhancements.js override qilmaydi)


// ── 1. Landing page o‘chirilmasin ────────────────────────────────
document.addEventListener('DOMContentLoaded', function () {
  const hero = document.querySelector('.hemis-hero');
  if (hero) hero.style.display = '';

  document.querySelectorAll('.hn-link, .hn-drop').forEach(el => {
    el.style.display = '';
  });
});


// ── 2. URL ROLE DETECT ───────────────────────────────────────────
(function () {
  const p = (location.pathname + location.hash + location.search).toLowerCase();

  if (p.includes('dekanat')) window._IDU_URL_ROLE = 'dekanat';
  else if (p.includes('teacher') || p.includes('professor')) window._IDU_URL_ROLE = 'teacher';
  else if (p.includes('investor')) window._IDU_URL_ROLE = 'investor';
  else if (p.includes('proktor')) window._IDU_URL_ROLE = 'proktor';
})();


// ── 3. LOGIN MODAL AUTO OCHILISHNI O‘CHIRDIK ─────────────────────
// ❗ ENG MUHIM QISM
window.addEventListener('DOMContentLoaded', function () {
  setTimeout(function () {
    if (window._IDU_URL_ROLE) {
      window._IDU_PENDING_ROLE_HINT = window._IDU_URL_ROLE;
    }
  }, 200);
});


// ── 4. ROLE HINT (login ochilganda chiqadi) ──────────────────────
function _applyUrlRoleHint(role) {
  const names = {
    dekanat: '🏛️ Dekanat sifatida kirish',
    teacher: '👨‍🏫 Professor sifatida kirish',
    investor: '💼 Investor sifatida kirish',
    proktor: '🔑 Proktor sifatida kirish'
  };

  let hint = document.getElementById('_idu_role_hint');

  if (!hint) {
    hint = document.createElement('div');
    hint.id = '_idu_role_hint';
    hint.style.cssText =
      'text-align:center;padding:8px;background:#EEF3FF;border-radius:8px;margin:10px 0;font-weight:600;color:#1B4FD8';

    const btn = document.getElementById('loginSubmitBtn');
    if (btn && btn.parentNode) {
      btn.parentNode.insertBefore(hint, btn);
    }
  }

  hint.textContent = names[role] || role;
}


// ── 5. openLoginModal patch ──────────────────────────────────────
(function () {
  function patch() {
    if (typeof window.openLoginModal !== 'function') {
      return setTimeout(patch, 300);
    }

    if (window.openLoginModal._patched) return;

    const original = window.openLoginModal;

    window.openLoginModal = function () {
      const res = original.apply(this, arguments);

      setTimeout(() => {
        if (window._IDU_PENDING_ROLE_HINT) {
          _applyUrlRoleHint(window._IDU_PENDING_ROLE_HINT);
        }
      }, 100);

      return res;
    };

    window.openLoginModal._patched = true;
  }

  patch();
})();


// ── 6. MOBILE BOTTOM NAVIGATION ────────────────────────────────────
// Role bo'yicha bottom nav itemlari
var MOB_NAV_ITEMS = {
  student: [
    { id: 'dashboard',    icon: '🏠', label: 'Bosh sahifa' },
    { id: 'timetable',   icon: '📅', label: 'Jadval' },
    { id: 'grades',      icon: '📊', label: 'Baholar' },
    { id: 'aitutor',     icon: '🤖', label: 'AI Tutor' },
    { id: '__more__',    icon: '☰',  label: 'Ko\'proq', more: true },
  ],
  teacher: [
    { id: 'teacher-dashboard', icon: '🏠', label: 'Bosh sahifa' },
    { id: 'teacher-timetable', icon: '📅', label: 'Jadval' },
    { id: 'teacher-students',  icon: '👥', label: 'Talabalar' },
    { id: 'teacher-grade',     icon: '✏️', label: 'Baholash' },
    { id: '__more__',          icon: '☰',  label: 'Ko\'proq', more: true },
  ],
  dekanat: [
    { id: 'dekanat-dashboard',  icon: '🏛️', label: 'Bosh sahifa' },
    { id: 'dekanat-students',   icon: '🎓', label: 'Talabalar' },
    { id: 'dekanat-grades',     icon: '📊', label: 'Baholar' },
    { id: 'dekanat-applications', icon: '📬', label: 'Arizalar', badgeId: 'dekAppBadge' },
    { id: '__more__',           icon: '☰',  label: 'Ko\'proq', more: true },
  ],
  investor: [
    { id: 'investor-dashboard', icon: '💼', label: 'Dashboard' },
    { id: 'startup',            icon: '🚀', label: 'Startup' },
    { id: '__more__',           icon: '☰',  label: 'Ko\'proq', more: true },
  ],
  admin: [
    { id: 'dekanat-dashboard',  icon: '🏛️', label: 'Bosh sahifa' },
    { id: 'dekanat-students',   icon: '🎓', label: 'Talabalar' },
    { id: 'dekanat-questions',  icon: '📝', label: 'Savollar' },
    { id: '__more__',           icon: '☰',  label: 'Ko\'proq', more: true },
  ],
};

function setupMobNav(role) {
  var nav = document.getElementById('mobNavInner');
  if (!nav) return;

  var items = MOB_NAV_ITEMS[role] || MOB_NAV_ITEMS['student'];

  nav.innerHTML = items.map(function(item) {
    var onclick = item.more
      ? 'toggleMobileSidebar()'
      : 'showPage(\'' + item.id + '\')';

    return (
      '<button class="mob-nav-item' + (item.more ? ' mob-more' : '') + '"' +
      ' id="mni-' + item.id + '"' +
      ' onclick="' + onclick + '"' +
      ' aria-label="' + item.label + '">' +
      '<span class="mob-nav-icon">' + item.icon +
        (item.badgeId
          ? '<span class="mob-nav-badge" id="mob_' + item.badgeId + '" style="display:none">0</span>'
          : '') +
      '</span>' +
      '<span class="mob-nav-label">' + item.label + '</span>' +
      '</button>'
    );
  }).join('');
}

function updateMobNavActive(pageId) {
  var items = document.querySelectorAll('.mob-nav-item:not(.mob-more)');
  items.forEach(function(btn) {
    var id = btn.id.replace('mni-', '');
    btn.classList.toggle('active', id === pageId);
  });
}

// showPage hook — bottom nav'ni yangilash uchun
(function() {
  function patchShowPage() {
    if (typeof window.showPage !== 'function') {
      return setTimeout(patchShowPage, 200);
    }
    if (window.showPage._mobNavPatched) return;

    var orig = window.showPage;
    window.showPage = function(id) {
      var result = orig.apply(this, arguments);
      updateMobNavActive(id);
      // Mobile sidebar'ni yopish
      if (window.closeMobileSidebar) closeMobileSidebar();
      return result;
    };
    window.showPage._mobNavPatched = true;
  }
  patchShowPage();
})();

// setupSidebar hook — bottom nav'ni role bilan setup qilish
(function() {
  function patchSetupSidebar() {
    if (typeof window.setupSidebar !== 'function') {
      return setTimeout(patchSetupSidebar, 200);
    }
    if (window.setupSidebar._mobNavPatched) return;

    var orig = window.setupSidebar;
    window.setupSidebar = function(role) {
      var result = orig.apply(this, arguments);
      setupMobNav(role);
      return result;
    };
    window.setupSidebar._mobNavPatched = true;
  }
  patchSetupSidebar();
})();


// ── 7. BETTER SCROLLBAR for sidebar ─────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
  var sidebar = document.getElementById('appSidebar');
  if (sidebar) {
    sidebar.style.scrollbarWidth = 'none';
  }
});


// ── 8. Touch swipe for mobile sidebar ───────────────────────────────
(function() {
  var touchStartX = 0;
  var touchStartY = 0;
  var SWIPE_THRESHOLD = 60;
  var EDGE_ZONE = 24; // px from left edge to trigger open

  document.addEventListener('touchstart', function(e) {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }, { passive: true });

  document.addEventListener('touchend', function(e) {
    if (!e.changedTouches.length) return;
    var dx = e.changedTouches[0].clientX - touchStartX;
    var dy = e.changedTouches[0].clientY - touchStartY;
    if (Math.abs(dy) > Math.abs(dx)) return; // vertical scroll, ignore

    var sidebar = document.getElementById('appSidebar');
    if (!sidebar) return;

    var isOpen = sidebar.classList.contains('mobile-open');

    // Swipe right from left edge → open
    if (!isOpen && dx > SWIPE_THRESHOLD && touchStartX < EDGE_ZONE) {
      if (typeof toggleMobileSidebar === 'function') toggleMobileSidebar();
    }
    // Swipe left → close
    if (isOpen && dx < -SWIPE_THRESHOLD) {
      if (typeof closeMobileSidebar === 'function') closeMobileSidebar();
    }
  }, { passive: true });
})();


// ── 9. Swipe left/right to navigate between pages (mobile) ──────────────────
(function() {
  // Student page order (matches sidebar)
  var STUDENT_PAGES = [
    'dashboard','timetable','grades','tasks','leaderboard',
    'aitutor','notifications','student-exams','sesiya-test','sesiya-real'
  ];
  var SWIPE_THRESHOLD = 72;
  var EDGE_IGNORE = 28; // ignore swipes starting from left edge (sidebar zone)
  var _swX = 0, _swY = 0, _swTime = 0;
  var _hintTimer = null;

  // Create hint overlay once
  var hint = document.createElement('div');
  hint.id = 'swipeHint';
  document.body.appendChild(hint);

  function showHint(text) {
    hint.textContent = text;
    hint.classList.add('show');
    clearTimeout(_hintTimer);
    _hintTimer = setTimeout(function() { hint.classList.remove('show'); }, 900);
  }

  function getCurrentPageId() {
    var active = document.querySelector('.page.active');
    return active ? active.id.replace('page-', '') : null;
  }

  document.addEventListener('touchstart', function(e) {
    _swX = e.touches[0].clientX;
    _swY = e.touches[0].clientY;
    _swTime = Date.now();
  }, { passive: true });

  document.addEventListener('touchend', function(e) {
    if (!e.changedTouches.length) return;
    var dx = e.changedTouches[0].clientX - _swX;
    var dy = e.changedTouches[0].clientY - _swY;
    var dt = Date.now() - _swTime;

    // Only fast horizontal swipes (not scroll, not too slow)
    if (Math.abs(dy) > Math.abs(dx)) return;
    if (Math.abs(dx) < SWIPE_THRESHOLD) return;
    if (dt > 450) return; // too slow → probably scroll
    if (_swX < EDGE_IGNORE) return; // edge zone reserved for sidebar

    // Only on mobile
    if (window.innerWidth > 768) return;

    // Check sidebar is closed
    var sidebar = document.getElementById('appSidebar');
    if (sidebar && sidebar.classList.contains('mobile-open')) return;

    var cur = getCurrentPageId();
    if (!cur) return;
    var idx = STUDENT_PAGES.indexOf(cur);
    if (idx < 0) return;

    if (dx < 0) {
      // Swipe left → next page
      var next = STUDENT_PAGES[idx + 1];
      if (next && typeof window.showPage === 'function') {
        showHint('→ ' + _pageLabel(next));
        window.showPage(next);
      }
    } else {
      // Swipe right → previous page
      var prev = STUDENT_PAGES[idx - 1];
      if (prev && typeof window.showPage === 'function') {
        showHint('← ' + _pageLabel(prev));
        window.showPage(prev);
      }
    }
  }, { passive: true });

  var PAGE_LABELS = {
    'dashboard':'Bosh sahifa','timetable':'Jadval','grades':'Baholar',
    'tasks':'Vazifalar','leaderboard':'Reyting','aitutor':'AI Tutor',
    'notifications':'Xabarlar','student-exams':'Imtihonlar',
    'sesiya-test':'Test rejim','sesiya-real':'Sesiya'
  };
  function _pageLabel(id) { return PAGE_LABELS[id] || id; }
})();

console.log('✅ Enhancements v8 loaded (mobNav + swipe + streak + ring + notifs)');
