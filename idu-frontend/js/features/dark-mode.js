'use strict';
/* ══════════════════════════════════════════════════════════════
   IDU Theme System — 3 themes: dark · light · blue
   Persists in localStorage as 'idu_theme'
   DEFAULT: dark
══════════════════════════════════════════════════════════════ */

(function () {
  var THEMES = ['dark', 'light', 'blue'];
  var DEFAULT = 'dark';

  function _applyTheme(theme) {
    if (!THEMES.includes(theme)) theme = DEFAULT;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('idu_theme', theme);
    _updateToggleUI(theme);
  }

  function _updateToggleUI(theme) {
    document.querySelectorAll('.lp-theme-btn').forEach(function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-t') === theme);
    });
    // App topnav dark-mode btn (legacy)
    var legacyBtn = document.getElementById('darkModeBtn');
    if (legacyBtn) {
      legacyBtn.textContent = theme === 'dark' ? '☀️' : theme === 'light' ? '🌙' : '💎';
      legacyBtn.setAttribute('data-tip',
        theme === 'dark' ? "Yorug' rejim" :
        theme === 'light' ? "Qorong'u rejim" : 'Ko\'k rejim');
    }
  }

  // Public API
  window.setTheme = _applyTheme;
  window.toggleDarkMode = function () {
    var cur = document.documentElement.getAttribute('data-theme') || DEFAULT;
    var next = cur === 'dark' ? 'light' : cur === 'light' ? 'blue' : 'dark';
    _applyTheme(next);
  };

  // Apply saved or default
  var saved = localStorage.getItem('idu_theme');
  _applyTheme(THEMES.includes(saved) ? saved : DEFAULT);

  // Inject legacy dark-mode button into app topnav
  function _injectLegacyBtn() {
    var right = document.querySelector('.topnav-right');
    if (!right || document.getElementById('darkModeBtn')) return;
    var btn = document.createElement('div');
    btn.id = 'darkModeBtn';
    btn.className = 'nav-icon-btn';
    var cur = document.documentElement.getAttribute('data-theme') || DEFAULT;
    btn.textContent = cur === 'dark' ? '☀️' : cur === 'light' ? '🌙' : '💎';
    btn.setAttribute('data-tip', "Tema o'zgartirish");
    btn.style.cssText = 'font-size:17px;cursor:pointer';
    btn.onclick = window.toggleDarkMode;
    right.insertBefore(btn, right.firstChild);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _injectLegacyBtn);
  } else {
    _injectLegacyBtn();
  }
})();

console.log('✅ Dark Mode loaded');
