'use strict';
/**
 * IDU — Global Event Delegation  v1.0
 *
 * Replaces inline onclick="fn()" with data-action="fn" attributes.
 * This allows the Content-Security-Policy to eventually remove 'unsafe-inline'
 * from script-src-attr, making XSS harder.
 *
 * Usage in HTML:
 *   <button data-action="openLoginModal">Kirish</button>
 *   <button data-action="setLang" data-arg="uz">O'zbek</button>
 *   <div data-action="openChatRoomById" data-arg="42">Room name</div>
 *
 * The delegator reads data-action, looks it up in window scope,
 * and calls it with data-arg (if present) and the event.
 *
 * Existing inline onclick= attributes continue to work unchanged —
 * migration is progressive: move handlers to data-action as pages are edited.
 */

(function () {
  // ── Click delegation ─────────────────────────────────────────────────────────
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-action]');
    if (!el) return;

    var action = el.dataset.action;
    var arg    = el.dataset.arg;
    var fn     = window[action];

    if (typeof fn !== 'function') return; // not found — skip silently

    e.preventDefault();
    try {
      if (arg !== undefined) fn(arg, e);
      else                   fn(e);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[events] action "%s" threw:', action, err);
    }
  });

  // ── Input / change delegation ─────────────────────────────────────────────────
  document.addEventListener('change', function (e) {
    var el = e.target.closest('[data-onchange]');
    if (!el) return;
    var fn = window[el.dataset.onchange];
    if (typeof fn === 'function') fn(e.target.value, e);
  });

  // ── Keyboard shortcut: Escape closes topmost modal ─────────────────────────
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    // Find the topmost visible modal (highest z-index)
    var modals = document.querySelectorAll('.modal-bg, .login-modal-bg, [data-modal]');
    var top = null, topZ = 0;
    modals.forEach(function (m) {
      var vis = m.classList.contains('open') ||
                (m.style.display && m.style.display !== 'none');
      if (!vis) return;
      var z = parseInt(window.getComputedStyle(m).zIndex, 10) || 0;
      if (z >= topZ) { top = m; topZ = z; }
    });
    if (top) {
      top.classList.remove('open');
      top.style.display = 'none';
    }
  });

  // ── Focus trap inside open modals ────────────────────────────────────────────
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Tab') return;
    var openModal = document.querySelector('.login-modal-bg.open .login-modal, .modal-bg.open .modal-card');
    if (!openModal) return;

    var focusable = openModal.querySelectorAll(
      'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'
    );
    if (!focusable.length) return;

    var first = focusable[0];
    var last  = focusable[focusable.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus(); }
    } else {
      if (document.activeElement === last)  { e.preventDefault(); first.focus(); }
    }
  });
})();
