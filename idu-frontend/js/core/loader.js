'use strict';
/**
 * Role-based script lazy loader.
 *
 * Instead of loading all 32 JS files upfront for every visitor,
 * we load only what each role actually needs — after login.
 *
 * Savings per role (approx):
 *   student  : skips dekanat.js, rector.js, teacher*.js, bulk-export.js, reports.js
 *   teacher  : skips dekanat.js, rector.js, student-only games/competitions
 *   dekanat  : skips teacher-exams.js, games.js, ai-chat.js
 *   rector   : skips nearly everything
 */

// Version tag — update on each deploy to bust browser cache
var LOADER_V = '20260611a';

var COMMON_SCRIPTS = [
  'js/features/dark-mode.js',
  'js/features/animations.js',
  'js/features/command-palette.js',
  'js/features/notifications.js',
  'js/features/chat.js',
  'js/features/profile.js',
];

var ROLE_SCRIPTS = {
  student: [
    'js/pages/student.js',
    'js/features/schedule.js',
    'js/features/grades.js',
    'js/features/assignments.js',
    'js/features/ai-chat.js',
    'js/features/exams.js',
    'js/features/games.js',
    'js/features/stats.js',
    'js/features/attendance.js',
    'js/features/gamification.js',
    'js/features/engagement.js',
    'js/features/onboarding.js',
    'js/features/calendar.js',
    'js/features/competitions.js',
    'js/features/forum.js',
  ],
  teacher: [
    'js/pages/teacher.js',
    'js/features/schedule.js',
    'js/features/grades.js',
    'js/features/assignments.js',
    'js/features/attendance.js',
    'js/features/stats.js',
    'js/features/teacher-exams.js',
    'js/features/calendar.js',
  ],
  dekanat: [
    'js/pages/dekanat.js',
    'js/features/grades.js',
    'js/features/attendance.js',
    'js/features/stats.js',
    'js/features/reports.js',
    'js/features/bulk-export.js',
    'js/features/calendar.js',
    'js/features/competitions.js',
    'js/features/forum.js',
  ],
  rector: [
    'js/pages/rector.js',
    'js/features/stats.js',
    'js/features/reports.js',
  ],
  investor: [
    'js/pages/investor.js',
    'js/features/stats.js',
  ],
  admin: [
    'js/pages/dekanat.js',
    'js/features/grades.js',
    'js/features/attendance.js',
    'js/features/stats.js',
    'js/features/reports.js',
    'js/features/bulk-export.js',
    'js/features/calendar.js',
  ],
};

var _loaded = {};

function loadScript(src) {
  var versioned = src + '?v=' + LOADER_V;
  if (_loaded[src]) return _loaded[src];
  _loaded[src] = new Promise(function(resolve, reject) {
    if (document.querySelector('script[data-lazy="' + src + '"]')) {
      return resolve();
    }
    var s = document.createElement('script');
    s.src = versioned;
    s.defer = true;
    s.dataset.lazy = src;
    s.onload  = resolve;
    s.onerror = function() {
      delete _loaded[src];
      reject(new Error('Failed to load: ' + src));
    };
    document.head.appendChild(s);
  });
  return _loaded[src];
}

/**
 * Load all scripts for the given role in parallel.
 * Returns a Promise that resolves when all scripts are ready.
 */
function loadStylesheet(href) {
  if (document.querySelector('link[data-lazy-css="' + href + '"]')) {
    return Promise.resolve();
  }
  return new Promise(function(resolve) {
    var link = document.createElement('link');
    link.rel = 'stylesheet'; link.href = href;
    link.dataset.lazyCss = href;
    link.onload = resolve; link.onerror = resolve; // non-fatal
    document.head.appendChild(link);
  });
}

window.IDULoader = {
  loadRole: function(role) {
    var scripts = (COMMON_SCRIPTS).concat(ROLE_SCRIPTS[role] || []);
    return Promise.all(scripts.map(loadScript));
  },
  // KaTeX — only when math rendering is needed (exams, AI chat formulas)
  loadKaTeX: function() {
    var CDN = 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/';
    return loadStylesheet(CDN + 'katex.min.css').then(function() {
      return loadScript(CDN + 'katex.min.js');
    });
  },
  // DOMPurify — only after login, when chat/forum HTML sanitization is needed
  loadDOMPurify: function() {
    return loadScript('https://cdn.jsdelivr.net/npm/dompurify@3.1.5/dist/purify.min.js');
  },
  // Preload QR lib only for teacher/dekanat
  loadQR: function() {
    return loadScript('https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js');
  },
};
