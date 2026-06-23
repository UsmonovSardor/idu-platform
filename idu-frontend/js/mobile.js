/* ═══════════════════════════════════════════════════════════════
   IDU Platform — Mobile Native Experience v1.0
   Swipe gestures · Pull-to-refresh · Haptics · PWA install
   ═══════════════════════════════════════════════════════════════ */
'use strict';

// ── Device detection ─────────────────────────────────────────────
var IS_TOUCH   = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
var IS_IOS     = /iphone|ipad|ipod/i.test(navigator.userAgent);
var IS_ANDROID = /android/i.test(navigator.userAgent);
var IS_MOBILE  = IS_TOUCH && window.innerWidth < 768;
var IS_PWA     = window.matchMedia('(display-mode: standalone)').matches ||
                 window.navigator.standalone === true;

// ── Haptic feedback ──────────────────────────────────────────────
function haptic(type) {
  if (!navigator.vibrate) return;
  var patterns = { light: [6], medium: [12], heavy: [20], success: [6, 50, 6], error: [20, 60, 20] };
  navigator.vibrate(patterns[type] || patterns.light);
}
window.haptic = haptic;

// Add haptic to all buttons and interactive elements on touch
document.addEventListener('touchstart', function(e) {
  var el = e.target.closest('.btn, .btn-primary, .btn-secondary, .btn-ghost, .btn-danger, .mob-nav-item, .sidebar-item, .quick-action, .erp-tile, .stat-card');
  if (el) {
    haptic('light');
    el.classList.add('_tap');
  }
}, { passive: true });
document.addEventListener('touchend', function(e) {
  document.querySelectorAll('._tap').forEach(function(el) { el.classList.remove('_tap'); });
}, { passive: true });

// ── iOS viewport keyboard fix ────────────────────────────────────
// When keyboard opens, scroll focused input into view (iOS 15 bug)
if (IS_IOS) {
  document.addEventListener('focusin', function(e) {
    var el = e.target;
    if (/input|textarea|select/i.test(el.tagName)) {
      setTimeout(function() {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 350);
    }
  });
}

// ── Visual viewport resize (keyboard avoidance) ──────────────────
if (window.visualViewport) {
  var _lastVH = window.visualViewport.height;
  window.visualViewport.addEventListener('resize', function() {
    var vh = window.visualViewport.height;
    var diff = _lastVH - vh;
    _lastVH = vh;
    // Keyboard opened (shrank by > 100px)
    if (diff > 100) {
      document.documentElement.style.setProperty('--keyboard-h', diff + 'px');
      document.body.classList.add('keyboard-open');
    } else if (diff < -100) {
      document.documentElement.style.setProperty('--keyboard-h', '0px');
      document.body.classList.remove('keyboard-open');
    }
  });
}

// ── Swipe gesture engine ─────────────────────────────────────────
(function() {
  var _swipeStart = null;

  document.addEventListener('touchstart', function(e) {
    if (e.touches.length !== 1) return;
    _swipeStart = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() };
  }, { passive: true });

  document.addEventListener('touchend', function(e) {
    if (!_swipeStart || e.changedTouches.length !== 1) return;
    var dx = e.changedTouches[0].clientX - _swipeStart.x;
    var dy = e.changedTouches[0].clientY - _swipeStart.y;
    var dt = Date.now() - _swipeStart.t;
    _swipeStart = null;

    var absX = Math.abs(dx), absY = Math.abs(dy);
    if (dt > 500 || (absX < 30 && absY < 30)) return;

    // Horizontal swipe
    if (absX > absY && absX > 40) {
      var sidebar = document.querySelector('.sidebar');
      var isOpen  = sidebar && sidebar.classList.contains('mobile-open');

      // Right swipe from left edge — open sidebar
      if (dx > 0 && e.changedTouches[0].clientX < 260) {
        if (sidebar && !isOpen && window.innerWidth < 768) {
          haptic('light');
          if (typeof openSidebarMobile === 'function') openSidebarMobile();
          else { sidebar.classList.add('mobile-open'); document.querySelector('.sidebar-backdrop') && document.querySelector('.sidebar-backdrop').classList.add('active'); }
        }
      }
      // Left swipe — close sidebar
      if (dx < 0 && isOpen) {
        haptic('light');
        if (typeof closeSidebarMobile === 'function') closeSidebarMobile();
        else { sidebar && sidebar.classList.remove('mobile-open'); document.querySelector('.sidebar-backdrop') && document.querySelector('.sidebar-backdrop').classList.remove('active'); }
      }
    }

    // Down swipe on modal bottom sheet
    if (dy > 60 && absY > absX * 1.5) {
      var sheet = document.querySelector('.modal-bg.open .modal-box, .modal-bg[style*="flex"] .modal-box');
      if (sheet && window.innerWidth < 768) {
        haptic('light');
        var closeBtn = document.querySelector('.modal-bg.open .modal-close, .modal-bg[style*="flex"] .modal-close');
        if (closeBtn) closeBtn.click();
        else if (typeof closeModal === 'function') closeModal();
      }
    }
  }, { passive: true });
})();

// ── Drag handle on modal bottom sheets ──────────────────────────
(function() {
  var observer = new MutationObserver(function(mutations) {
    document.querySelectorAll('.modal-box:not([data-handle])').forEach(function(box) {
      if (window.innerWidth < 768) {
        var handle = document.createElement('div');
        handle.className = 'modal-drag-handle';
        box.prepend(handle);
        box.setAttribute('data-handle', '1');
      }
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();

// ── Pull-to-refresh ──────────────────────────────────────────────
(function() {
  if (!IS_MOBILE) return;

  var indicator = document.createElement('div');
  indicator.id = 'idu-ptr';
  indicator.innerHTML = '<div class="ptr-spinner"></div><span class="ptr-text">Yangilash uchun torting</span>';
  document.body.appendChild(indicator);

  var _ptrStart = null;
  var _ptrActive = false;
  var PTR_THRESHOLD = 72;

  document.addEventListener('touchstart', function(e) {
    var mc = document.querySelector('.main-content');
    if (!mc || mc.scrollTop > 0) return;
    _ptrStart = e.touches[0].clientY;
  }, { passive: true });

  document.addEventListener('touchmove', function(e) {
    if (_ptrStart === null) return;
    var dy = e.touches[0].clientY - _ptrStart;
    if (dy < 10) { _ptrStart = null; return; }

    var pct = Math.min(dy / PTR_THRESHOLD, 1);
    indicator.style.transform = 'translateX(-50%) translateY(' + (dy * 0.45 - 56) + 'px)';
    indicator.style.opacity   = String(pct);
    indicator.style.scale     = '1';
    if (pct >= 1 && !_ptrActive) {
      _ptrActive = true;
      haptic('medium');
      indicator.classList.add('ptr-ready');
      indicator.querySelector('.ptr-text').textContent = 'Qo\'yib yuboring';
    }
  }, { passive: true });

  document.addEventListener('touchend', function() {
    if (_ptrStart === null) return;
    _ptrStart = null;
    if (_ptrActive) {
      _ptrActive = false;
      haptic('success');
      indicator.classList.add('ptr-loading');
      indicator.querySelector('.ptr-text').textContent = 'Yangilanmoqda...';
      // Refresh current page data
      var refreshFn = window.refreshCurrentPage || window.loadCurrentPage;
      if (typeof refreshFn === 'function') {
        refreshFn();
        setTimeout(resetPtr, 1200);
      } else {
        setTimeout(function() { location.reload(); }, 400);
      }
    } else {
      resetPtr();
    }
  });

  function resetPtr() {
    indicator.style.transform = '';
    indicator.style.opacity   = '0';
    indicator.style.scale     = '';
    indicator.classList.remove('ptr-ready', 'ptr-loading');
    indicator.querySelector('.ptr-text').textContent = 'Yangilash uchun torting';
  }
})();

// ── PWA Install prompt ───────────────────────────────────────────
(function() {
  if (IS_PWA) return; // already installed

  var _deferredPrompt = null;
  var _dismissed = false;

  try { _dismissed = !!localStorage.getItem('idu_pwa_dismissed'); } catch(_) {}
  if (_dismissed) return;

  window.addEventListener('beforeinstallprompt', function(e) {
    e.preventDefault();
    _deferredPrompt = e;
    // Show install banner after 5 seconds
    setTimeout(showInstallBanner, 5000);
  });

  function showInstallBanner() {
    if (!_deferredPrompt) return;
    var banner = document.getElementById('idu-install-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'idu-install-banner';
      banner.innerHTML =
        '<div class="install-icon">🎓</div>' +
        '<div class="install-body">' +
          '<div class="install-title">IDU\'ni o\'rnatish</div>' +
          '<div class="install-sub">Ilovaga aylantirish — tezroq, qulay</div>' +
        '</div>' +
        '<button class="install-btn-yes" id="idu-install-yes">O\'rnatish</button>' +
        '<button class="install-btn-no" id="idu-install-no">✕</button>';
      document.body.appendChild(banner);

      document.getElementById('idu-install-yes').addEventListener('click', function() {
        haptic('medium');
        _deferredPrompt.prompt();
        _deferredPrompt.userChoice.then(function(r) {
          if (r.outcome === 'accepted') { haptic('success'); hideBanner(); }
          _deferredPrompt = null;
        });
      });
      document.getElementById('idu-install-no').addEventListener('click', function() {
        hideBanner();
        try { localStorage.setItem('idu_pwa_dismissed', '1'); } catch(_) {}
      });
    }
    requestAnimationFrame(function() { banner.classList.add('visible'); });
  }

  function hideBanner() {
    var b = document.getElementById('idu-install-banner');
    if (b) { b.classList.remove('visible'); setTimeout(function() { b.remove(); }, 300); }
  }

  window.addEventListener('appinstalled', hideBanner);
})();

// ── Active state acceleration (skip :hover on touch) ────────────
// Prevents the 300ms ghost hover that lingers after a tap
(function() {
  if (!IS_TOUCH) return;
  var style = document.createElement('style');
  style.textContent = '@media (hover: none) { .btn:hover, .card:hover, .stat-card:hover, .sidebar-item:hover, .erp-tile:hover, .quick-action:hover { transform: none !important; box-shadow: inherit !important; } }';
  document.head.appendChild(style);
})();

// ── Bottom nav active tab highlight with bounce ──────────────────
document.addEventListener('click', function(e) {
  var item = e.target.closest('.mob-nav-item');
  if (!item) return;
  document.querySelectorAll('.mob-nav-item').forEach(function(i) { i.classList.remove('active'); });
  item.classList.add('active');
  var icon = item.querySelector('.mob-nav-icon');
  if (icon) {
    icon.animate([
      { transform: 'scale(1)' },
      { transform: 'scale(0.85)' },
      { transform: 'scale(1.15)' },
      { transform: 'scale(1)' }
    ], { duration: 300, easing: 'cubic-bezier(0.34,1.56,0.64,1)' });
  }
});

// ── Page slide transitions ───────────────────────────────────────
(function() {
  var _prevPage = null;

  // Hook into IDU's showPage function
  var _origShowPage = window.showPage;
  window.showPage = function(name) {
    var next = document.getElementById('page-' + name) || document.querySelector('[data-page="' + name + '"]');
    if (!next || !IS_MOBILE) {
      if (_origShowPage) return _origShowPage.apply(this, arguments);
      return;
    }

    // Determine direction — naive: no history tracking, always slide from right
    if (_prevPage && _prevPage !== next) {
      next.style.transform   = 'translateX(28px)';
      next.style.opacity     = '0';
      next.style.transition  = 'none';
      next.style.display     = 'block';
      requestAnimationFrame(function() {
        next.style.transition = 'transform 0.25s cubic-bezier(0.4,0,0.2,1), opacity 0.2s ease';
        next.style.transform  = 'translateX(0)';
        next.style.opacity    = '1';
      });
    }
    _prevPage = next;
    if (_origShowPage) _origShowPage.apply(this, arguments);
  };
})();

// ── Status bar color on scroll (dark → slightly lighter) ────────
(function() {
  if (!IS_PWA && !IS_IOS) return;
  var mc = document.querySelector('.main-content');
  if (!mc) return;

  var meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) return;

  mc.addEventListener('scroll', function() {
    meta.content = mc.scrollTop > 20 ? '#0d1629' : '#1e3a8a';
  }, { passive: true });
})();

// ── Double-tap zoom prevention on buttons ────────────────────────
(function() {
  if (!IS_TOUCH) return;
  var _lastTap = 0;
  document.addEventListener('touchend', function(e) {
    var now = Date.now();
    if (now - _lastTap < 300) {
      var el = e.target.closest('.btn, .mob-nav-item, .sidebar-item');
      if (el) e.preventDefault();
    }
    _lastTap = now;
  });
})();

// ── Mobile search shortcut ───────────────────────────────────────
// Long-press on any search icon → focus search input
document.addEventListener('touchstart', function(e) {
  var icon = e.target.closest('.search-icon, .nav-icon-btn[title*="Qidi"]');
  if (!icon) return;
  var t = setTimeout(function() {
    var inp = document.querySelector('.search-input, #globalSearch, input[placeholder*="Qidi"]');
    if (inp) { inp.focus(); haptic('medium'); }
  }, 500);
  icon.addEventListener('touchend', function() { clearTimeout(t); }, { once: true });
}, { passive: true });

console.log('[IDU Mobile] v1.0 loaded — IS_PWA:', IS_PWA, 'IS_IOS:', IS_IOS);
