'use strict';
/* IDU Platform — Micro-interactions & Effects v1.0
   ripple · count-up · skeleton · empty-state · keyboard shortcuts */
(function () {

  /* ── 1. RIPPLE EFFECT ──────────────────────────────────────────────
     Only on explicit button/tab elements — NOT on cards or large containers.
     overflow:hidden is handled by CSS (.ripple-host), NOT set via JS. */
  var RIPPLE_TARGETS = [
    '.btn', 'button:not([data-no-ripple])', '.nav-icon-btn',
    '.topnav-tab', '.filter-tab',
    '.hn-kirish', '.login-submit', '.btn-auth', '.hb-primary',
    '.lp-btn-primary', '.lp-btn-outline', '.sidebar-item'
  ].join(',');

  function createRipple(e) {
    var target = e.target.closest(RIPPLE_TARGETS);
    if (!target || target.disabled || target.getAttribute('disabled')) return;

    var rect  = target.getBoundingClientRect();
    // Use a fixed small size relative to click point, not element size
    var size  = Math.min(rect.width, rect.height, 60) * 2;
    var x     = e.clientX - rect.left - size / 2;
    var y     = e.clientY - rect.top  - size / 2;

    var bg    = window.getComputedStyle(target).backgroundColor;
    var dark  = bg && bg !== 'rgba(0, 0, 0, 0)' && isColorDark(bg);
    var color = dark ? 'rgba(255,255,255,0.3)' : 'rgba(30,64,175,0.12)';

    // Add ripple-host class so CSS handles overflow:hidden (not inline style)
    target.classList.add('ripple-host');

    var wave = document.createElement('span');
    wave.className = 'ripple-wave';
    wave.style.cssText =
      'width:'  + size + 'px;height:' + size + 'px;' +
      'left:'   + x   + 'px;top:'    + y    + 'px;' +
      'background:' + color + ';';
    target.appendChild(wave);

    // Remove after animation completes
    setTimeout(function () {
      wave.remove();
    }, 500);
  }

  function isColorDark(rgb) {
    var m = rgb.match(/\d+/g);
    if (!m || m.length < 3) return false;
    return (0.299 * m[0] + 0.587 * m[1] + 0.114 * m[2]) < 140;
  }

  document.addEventListener('click', createRipple);

  /* ── 2. PRESS SCALE FEEDBACK ───────────────────────────────────────
     Slight shrink on mousedown for tactile feel */
  var PRESS_TARGETS = '.btn,.nav-icon-btn,.filter-tab,.hn-kirish';
  var _pressed = null;

  document.addEventListener('mousedown', function (e) {
    var t = e.target.closest(PRESS_TARGETS);
    if (t && !t.disabled) {
      _pressed = t;
      t.classList.add('pressing');
    }
  });
  document.addEventListener('mouseup', function () {
    if (_pressed) { _pressed.classList.remove('pressing'); _pressed = null; }
  });
  document.addEventListener('mouseleave', function () {
    if (_pressed) { _pressed.classList.remove('pressing'); _pressed = null; }
  });

  /* ── 3. COUNT-UP ANIMATION ─────────────────────────────────────────
     Watches for stat-card-val elements and animates their numbers */
  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

  function countUp(el, target, duration) {
    if (isNaN(target) || target < 0) return;
    var startTime = null;
    var isFloat   = !Number.isInteger(target);
    var suffix    = el.getAttribute('data-suffix') || '';

    function step(now) {
      if (!startTime) startTime = now;
      var progress = Math.min((now - startTime) / duration, 1);
      var value    = target * easeOutCubic(progress);
      el.textContent = (isFloat ? value.toFixed(1) : Math.round(value)) + suffix;
      if (progress < 1) requestAnimationFrame(step);
      else el.textContent = (isFloat ? target.toFixed(1) : target) + suffix;
    }
    el.textContent = '0' + suffix;
    requestAnimationFrame(step);
  }

  function tryCountUp(el) {
    if (el._counted) return;
    var raw = el.textContent.replace(/[^\d.]/g, '');
    var num = parseFloat(raw);
    if (!isNaN(num) && num > 0) {
      el._counted = true;
      el.setAttribute('data-suffix', el.textContent.replace(/[\d.\s]/g, '').trim());
      setTimeout(function () { countUp(el, num, 1000); }, 80);
    }
  }

  // Observe DOM for dynamically rendered stat values
  var countObserver = new MutationObserver(function (mutations) {
    mutations.forEach(function (m) {
      m.addedNodes.forEach(function (node) {
        if (node.nodeType !== 1) return;
        var vals = node.classList && node.classList.contains('stat-card-val')
          ? [node]
          : node.querySelectorAll('.stat-card-val');
        vals.forEach(tryCountUp);
      });
    });
  });
  countObserver.observe(document.body, { childList: true, subtree: true });

  /* ── 4. SKELETON LOADER ────────────────────────────────────────────
     Call showSkeleton(container, type, count) before fetch,
     then fill the container with real content after */
  window.showSkeleton = function (container, type, count) {
    if (!container) return;
    count = count || 4;
    var html = '';

    if (type === 'cards') {
      html = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:14px">' +
        Array(count).fill(0).map(function (_, i) {
          return '<div class="skeleton-card" style="animation-delay:' + (i * 0.07) + 's"></div>';
        }).join('') + '</div>';

    } else if (type === 'rows') {
      html = Array(count).fill(0).map(function (_, i) {
        return '<div class="skeleton-row" style="animation-delay:' + (i * 0.05) + 's"></div>';
      }).join('');

    } else if (type === 'table') {
      html = '<div class="skeleton-table">' +
        Array(count).fill(0).map(function (_, i) {
          return '<div class="skeleton-tr" style="animation-delay:' + (i * 0.04) + 's">' +
            '<div class="skeleton-td" style="width:40%"></div>' +
            '<div class="skeleton-td" style="width:20%"></div>' +
            '<div class="skeleton-td" style="width:15%"></div>' +
            '<div class="skeleton-td" style="width:15%"></div>' +
            '</div>';
        }).join('') + '</div>';

    } else if (type === 'stat') {
      html = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:14px">' +
        Array(count).fill(0).map(function (_, i) {
          return '<div class="skeleton-stat" style="animation-delay:' + (i * 0.07) + 's">' +
            '<div class="skeleton-line" style="width:60%;height:11px;margin-bottom:12px"></div>' +
            '<div class="skeleton-line" style="width:40%;height:28px;margin-bottom:8px"></div>' +
            '<div class="skeleton-line" style="width:80%;height:9px"></div>' +
            '</div>';
        }).join('') + '</div>';
    }

    container.innerHTML = html;
  };

  window.hideSkeleton = function (container) {
    if (container) container.innerHTML = '';
  };

  /* ── 5. EMPTY STATE ────────────────────────────────────────────────
     Returns HTML for a nice empty state illustration */
  window.emptyState = function (icon, title, desc, actionHtml) {
    return '<div class="empty-state">' +
      '<div class="es-icon">' + icon + '</div>' +
      '<div class="es-title">' + title + '</div>' +
      (desc ? '<div class="es-desc">' + desc + '</div>' : '') +
      (actionHtml ? '<div class="es-action">' + actionHtml + '</div>' : '') +
      '</div>';
  };

  /* ── 6. TOOLTIP (data-tip attribute) ───────────────────────────────
     <button data-tip="Qayta yuklash"> — shows tooltip on hover */
  function setupTooltips() {
    document.querySelectorAll('[data-tip]').forEach(function (el) {
      if (el._tipReady) return;
      el._tipReady = true;
      if (window.getComputedStyle(el).position === 'static') {
        el.style.position = 'relative';
      }
    });
  }
  // Run once + watch for new elements
  setupTooltips();
  var tipObserver = new MutationObserver(setupTooltips);
  tipObserver.observe(document.body, { childList: true, subtree: true });

  /* ── 7. KEYBOARD SHORTCUTS ─────────────────────────────────────────
     /        → focus search input
     Escape   → close topmost modal
     Ctrl+K   → focus search (power user)
     Ctrl+,   → open settings / profile */
  document.addEventListener('keydown', function (e) {
    var tag = e.target.tagName;
    var isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

    // Escape: close any open modal
    if (e.key === 'Escape') {
      var modal = document.querySelector(
        '.modal-bg.open, .login-modal-bg.open, ' +
        '#guideModal.open, #faqModal.open, #aboutModal.open, ' +
        '#forgotModal.open, #featModal.open'
      );
      if (modal) {
        modal.classList.remove('open');
        return;
      }
    }

    // / or Ctrl+K — focus search
    if (((e.key === '/' && !isInput) || ((e.ctrlKey || e.metaKey) && e.key === 'k'))) {
      e.preventDefault();
      var search = document.querySelector(
        '.search-input, input[type="search"], ' +
        'input[placeholder*="smi"], input[placeholder*="Qidirish"], ' +
        'input[placeholder*="qidirish"]'
      );
      if (search) { search.focus(); search.select(); showSearchPulse(search); }
      return;
    }

    // Ctrl+Shift+H — go to home/dashboard
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'H') {
      e.preventDefault();
      var homeBtn = document.querySelector('[data-page="dashboard"], .sidebar-item[onclick*="dashboard"]');
      if (homeBtn) homeBtn.click();
    }
  });

  function showSearchPulse(input) {
    input.style.transition = 'box-shadow 0.2s';
    input.style.boxShadow = '0 0 0 4px rgba(8,145,178,0.25)';
    setTimeout(function () { input.style.boxShadow = ''; }, 600);
  }

  /* ── 8. SMOOTH SCROLL TO TOP ON PAGE CHANGE ────────────────────── */
  var mainContent = document.querySelector('.main-content');
  if (mainContent) {
    var pageObserver = new MutationObserver(function (mutations) {
      mutations.forEach(function (m) {
        if (m.attributeName === 'class') {
          var el = m.target;
          if (el.classList.contains('page') && el.classList.contains('active')) {
            mainContent.scrollTo({ top: 0, behavior: 'smooth' });
          }
        }
      });
    });
    document.querySelectorAll('.page').forEach(function (p) {
      pageObserver.observe(p, { attributes: true });
    });
  }

})();
