'use strict';
/* ══════════════════════════════════════════════════════════════
   Dark Mode — Notion / Linear / Vercel style
   Toggle: moon/sun button in topnav
   Persists in localStorage, auto-detects system preference
══════════════════════════════════════════════════════════════ */

(function() {
  function _applyTheme(dark) {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    localStorage.setItem('idu_theme', dark ? 'dark' : 'light');
    var btn = document.getElementById('darkModeBtn');
    if (btn) btn.textContent = dark ? '☀️' : '🌙';
    var tip = btn && btn.getAttribute('data-tip');
    if (btn) btn.setAttribute('data-tip', dark ? 'Yorug\' rejim' : 'Qorong\'u rejim');
  }

  window.toggleDarkMode = function() {
    var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    _applyTheme(!isDark);
  };

  // Apply on load
  var saved = localStorage.getItem('idu_theme');
  if (saved) {
    _applyTheme(saved === 'dark');
  } else {
    // Auto-detect system preference
    var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    _applyTheme(prefersDark);
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

  // Listen for system preference changes
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function(e) {
      if (!localStorage.getItem('idu_theme')) _applyTheme(e.matches);
    });
  }
})();

console.log('✅ Dark Mode loaded');
