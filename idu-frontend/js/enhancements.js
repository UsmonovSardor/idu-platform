'use strict';

/* ═══════════════════════════════════════════════════════════════════
   IDU PLATFORM — ENHANCEMENTS FIXED
   ✅ Login avtomatik chiqmaydi
   ✅ Faqat "Kirish" bosilganda ochiladi
   ✅ Role hint ishlaydi
═══════════════════════════════════════════════════════════════════ */


// ── 0. API BASE (Railway uchun) ──────────────────────────────────
(function () {
  if (!window.API_BASE) {
    window.API_BASE = '/api';
  }
})();


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


console.log('✅ Enhancements v7 loaded (mobNav + swipe + skeleton)');
