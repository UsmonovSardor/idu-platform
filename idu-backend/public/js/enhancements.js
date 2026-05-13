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


console.log('✅ Enhancements FIXED loaded (no auto login)');
