'use strict';
/* ══════════════════════════════════════════════════════════════
   Dark Mode — IDU Liquid Glass
   DEFAULT: dark mode always (unless user explicitly switched to light)
   Persists in localStorage
══════════════════════════════════════════════════════════════ */

(function() {
  function _applyTheme(dark) {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    localStorage.setItem('idu_theme', dark ? 'dark' : 'light');
    var btn = document.getElementById('darkModeBtn');
    if (btn) btn.textContent = dark ? '☀️' : '🌙';
    if (btn) btn.setAttribute('data-tip', dark ? 'Yorug\' rejim' : 'Qorong\'u rejim');
  }

  window.toggleDarkMode = function() {
    var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    _applyTheme(!isDark);
  };

  // Apply on load — DEFAULT is always dark
  var saved = localStorage.getItem('idu_theme');
  // Force dark: only respect saved 'light' preference, ignore old 'light' auto-detects
  if (saved === 'light') {
    _applyTheme(false);
  } else {
    // Dark by default — also overwrite any stale 'light' from system preference
    _applyTheme(true);
  }

  // Inject dark mode button into topnav-right when DOM ready
  function _injectBtn() {
    var right = document.querySelector('.topnav-right');
    if (!right || document.getElementById('darkModeBtn')) return;
    var btn = document.createElement('div');
    btn.id = 'darkModeBtn';
    btn.className = 'nav-icon-btn';
    var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    btn.textContent = isDark ? '☀️' : '🌙';
    btn.setAttribute('data-tip', isDark ? 'Yorug\' rejim' : 'Qorong\'u rejim');
    btn.style.cssText = 'font-size:17px;cursor:pointer';
    btn.onclick = window.toggleDarkMode;
    right.insertBefore(btn, right.firstChild);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _injectBtn);
  } else {
    _injectBtn();
  }
})();

console.log('✅ Dark Mode loaded');
