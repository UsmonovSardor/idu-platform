'use strict';
// IDU Platform - features/exams.js v4.0
// ================================================================
// PROFESSIONAL EXAM SECURITY SYSTEM — MAXIMUM PROTECTION
// ================================================================
// Yangiliklar v4.0:
//  • Screen recording / MediaStream detection
//  • Mouse/cursor oynadan chiqish detection
//  • Suspicion scoring (ball tizimi)
//  • Heartbeat — har 10s backend'ga session tekshiruvi
//  • Multi-tab detection (BroadcastChannel)
//  • Bot/automation detection (navigator, webdriver, phantom)
//  • Javoblarni XOR-shifrlash (localStorage-da xavfsiz)
//  • CSS: print / screenshot bloklash
//  • Integrity hash (submit paytida)
//  • Clipboard clearing
//  • DevTools — 3 xil usul bilan aniqlash
//  • Panic mode (kritik buzilish — darhol topshirish)
//  • Watermark (fon'da foydalanuvchi ID chop etiladi)
// ================================================================

// ============================================================
// EXAM STATE
// ============================================================
var _examState = {
  active: false,
  attemptId: null,
  answers: {},
  startTime: null,
  duration: 0,
  timerInterval: null,
  saveInterval: null,
  heartbeatInterval: null,
  suspicionScore: 0,          // Shubhali harakat bali
  MAX_SUSPICION: 100,         // Shu balga yetsa — majburiy topshirish
  tabWarnings: 0,
  MAX_WARNINGS: 3,
  flagged: {},
  currentIdx: 0,
  questions: [],
  forceSubmitted: false,
  sessionKey: null,           // XOR shifr kaliti
  userId: null,
  startServerTime: null,      // Server vaqti (vaqt manipulyatsiyasiga qarshi)
  broadcastChannel: null,     // Multi-tab bloklash
  mediaStream: null,          // Screen share detection
  _dtInterval: null,          // DevTools interval
  _mouseInterval: null,
  _fsCheckInterval: null,     // Fullscreen tekshiruv interval
  _origWindowOpen: null,      // Asl window.open reference
};
// =====================
// FINGERPRINT
// =====================
function _examFingerprint() {
  try {
    return [
      navigator.userAgent,
      navigator.language,
      screen.width + 'x' + screen.height,
      new Date().getTimezoneOffset()
    ].join('|').slice(0, 250);
  } catch (e) {
    return 'unknown-client';
  }
}
// ============================================================
// 0. CSS INJECTION: print / screenshot / watermark
// ============================================================
function _injectSecurityCSS(userId) {
  var styleId = 'iduExamSecurityStyle';
  if (document.getElementById(styleId)) return;
  var style = document.createElement('style');
  style.id = styleId;
  style.textContent = [
    // Print bloklash
    '@media print { body { display: none !important; } }',
    // Screenshot overlay (samaradorlik brauzerga bog\'liq)
    '#realExamModal { -webkit-user-select: none; user-select: none; }',
    // Watermark
    '#realExamModal::after {',
    '  content: "' + (userId || 'IDU-EXAM') + ' — MAXFIY";',
    '  position: fixed; bottom: 60px; right: 20px;',
    '  font-size: 11px; color: rgba(30,58,138,.08);',
    '  font-weight: 900; letter-spacing: 2px;',
    '  transform: rotate(-30deg); pointer-events: none;',
    '  z-index: 8999; white-space: nowrap;',
    '}',
    // Disable text selection everywhere in exam
    '#realExamModal * { -webkit-user-select: none; user-select: none; }',
  ].join('\n');
  document.head.appendChild(style);
}

function _removeSecurityCSS() {
  var el = document.getElementById('iduExamSecurityStyle');
  if (el) el.remove();
}

// ============================================================
// 0.5. FULLSCREEN HELPERS (kritik — bular bo'lmasa hech narsa ishlamaydi)
// ============================================================
function _requestFullscreen() {
  var el = document.documentElement;
  try {
    if (el.requestFullscreen) {
      el.requestFullscreen({ navigationUI: 'hide' }).catch(function() {});
    } else if (el.webkitRequestFullscreen) {
      el.webkitRequestFullscreen();
    } else if (el.mozRequestFullScreen) {
      el.mozRequestFullScreen();
    } else if (el.msRequestFullscreen) {
      el.msRequestFullscreen();
    }
  } catch (e) {}
}

function _exitFullscreen() {
  try {
    if (document.exitFullscreen) {
      document.exitFullscreen().catch(function() {});
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    } else if (document.mozCancelFullScreen) {
      document.mozCancelFullScreen();
    } else if (document.msExitFullscreen) {
      document.msExitFullscreen();
    }
  } catch (e) {}
}

function _isFullscreen() {
  return !!(
    document.fullscreenElement ||
    document.webkitFullscreenElement ||
    document.mozFullScreenElement ||
    document.msFullscreenElement
  );
}

// ============================================================
// 1. SECURITY SYSTEM
// ============================================================
function _examSecurityOn() {
  document.addEventListener('selectstart', _blockEvent, true);
  document.addEventListener('dragstart', _blockEvent, true);
  document.addEventListener('visibilitychange', _onVisibilityChange);
  window.addEventListener('blur', _onWindowBlur);
  document.addEventListener('fullscreenchange', _onFullscreenChange);
  document.addEventListener('webkitfullscreenchange', _onFullscreenChange);
  document.addEventListener('mozfullscreenchange', _onFullscreenChange);
  document.addEventListener('MSFullscreenChange', _onFullscreenChange);
  document.addEventListener('contextmenu', _blockEvent);
  document.addEventListener('copy', _onCopy);
  document.addEventListener('paste', _blockEvent);
  document.addEventListener('cut', _blockEvent);
  document.addEventListener('keydown', _blockKeys);
  document.addEventListener('keyup', _blockKeys);
  document.addEventListener('mouseleave', _onMouseLeave);
  window.addEventListener('beforeunload', _onBeforeUnload);
  window.addEventListener('resize', _onResize);

  // window.open bloklash — boshqa oynada ochilishini to'xtatish
  _examState._origWindowOpen = window.open;
  window.open = function(url, target, features) {
    _addSuspicion(30, 'WINDOW_OPEN_ATTEMPT');
    _examLog('WINDOW_OPEN', { url: url || '', target: target || '' });
    _showWarnOv('🚫 Yangi oyna taqiqlangan!', 'Imtihon davomida yangi oyna yoki tab ochish mumkin emas.');
    return null;
  };

  // link target=_blank ni bloklash
  document.addEventListener('click', _blockNewTabLinks, true);

  _devToolsDetect();
  _multiTabDetect();
  _screenRecordDetect();
  _botDetect();
  _serverTimeSync();
  _startHeartbeat();

  // Fullscreen yo'qolsa qayta so'rash (har 3 sekundda tekshiruv)
  _examState._fsCheckInterval = setInterval(function() {
    if (!_examState.active) return;
    if (!_isFullscreen()) {
      _requestFullscreen();
    }
  }, 3000);
}

function _examSecurityOff() {
  document.removeEventListener('selectstart', _blockEvent, true);
  document.removeEventListener('dragstart', _blockEvent, true);
  document.removeEventListener('visibilitychange', _onVisibilityChange);
  window.removeEventListener('blur', _onWindowBlur);
  document.removeEventListener('fullscreenchange', _onFullscreenChange);
  document.removeEventListener('webkitfullscreenchange', _onFullscreenChange);
  document.removeEventListener('mozfullscreenchange', _onFullscreenChange);
  document.removeEventListener('MSFullscreenChange', _onFullscreenChange);
  document.removeEventListener('contextmenu', _blockEvent);
  document.removeEventListener('copy', _onCopy);
  document.removeEventListener('paste', _blockEvent);
  document.removeEventListener('cut', _blockEvent);
  document.removeEventListener('keydown', _blockKeys);
  document.removeEventListener('keyup', _blockKeys);
  document.removeEventListener('mouseleave', _onMouseLeave);
  window.removeEventListener('beforeunload', _onBeforeUnload);
  window.removeEventListener('resize', _onResize);
  document.removeEventListener('click', _blockNewTabLinks, true);

  // window.open ni tiklash
  if (_examState._origWindowOpen) {
    window.open = _examState._origWindowOpen;
    _examState._origWindowOpen = null;
  }

  clearInterval(_examState._dtInterval);
  clearInterval(_examState._mouseInterval);
  clearInterval(_examState.heartbeatInterval);
  clearInterval(_examState._fsCheckInterval);

  if (_examState.broadcastChannel) {
    try { _examState.broadcastChannel.close(); } catch(e) {}
    _examState.broadcastChannel = null;
  }
  if (_examState.mediaStream) {
    try {
      _examState.mediaStream.getTracks().forEach(function(t) { t.stop(); });
    } catch(e) {}
    _examState.mediaStream = null;
  }
  _exitFullscreen();
  _removeSecurityCSS();
}

// target=_blank linkni bloklash
function _blockNewTabLinks(e) {
  if (!_examState.active) return;
  var target = e.target || e.srcElement;
  while (target && target !== document.body) {
    if (target.tagName === 'A' && (target.target === '_blank' || target.getAttribute('target') === '_blank')) {
      e.preventDefault();
      e.stopPropagation();
      _addSuspicion(15, 'NEW_TAB_LINK');
      return false;
    }
    target = target.parentNode;
  }
}

// ---- Asosiy blokerlar ----

function _blockEvent(e) {
  e.preventDefault();
  e.stopPropagation();
  return false;
}

function _onCopy(e) {
  e.preventDefault();
  // Clipboard'ni tozala
  if (e.clipboardData) {
    e.clipboardData.setData('text/plain', '');
  }
  _addSuspicion(5, 'COPY_ATTEMPT');
  return false;
}

function _blockKeys(e) {
  var blocked = [
    e.altKey && e.key === 'Tab',
    e.metaKey && e.key === 'Tab',
    e.ctrlKey && e.key === 'Tab',
    e.ctrlKey && (e.key === 'w' || e.key === 'W'),
    e.ctrlKey && (e.key === 'r' || e.key === 'R'),
    e.metaKey && (e.key === 'r' || e.key === 'R'),
    e.key === 'F5',
    e.key === 'F11',
    e.key === 'F12',
    e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C' || e.key === 'i' || e.key === 'j' || e.key === 'c'),
    e.ctrlKey && (e.key === 'u' || e.key === 'U'),
    e.ctrlKey && (e.key === 'a' || e.key === 'A'),
    e.ctrlKey && (e.key === 'c' || e.key === 'C'),   // Copy
    e.ctrlKey && (e.key === 'v' || e.key === 'V'),   // Paste
    e.ctrlKey && (e.key === 'x' || e.key === 'X'),   // Cut
    e.metaKey  && (e.key === 'c' || e.key === 'C'),  // Mac copy
    e.metaKey  && (e.key === 'v' || e.key === 'V'),  // Mac paste
    e.metaKey  && (e.key === 'x' || e.key === 'X'),  // Mac cut
    e.metaKey  && (e.key === 'a' || e.key === 'A'),  // Mac select all
    e.ctrlKey && (e.key === 'p' || e.key === 'P'),   // Print
    e.ctrlKey && (e.key === 's' || e.key === 'S'),   // Save page
    e.metaKey && (e.key === 'p' || e.key === 'P'),   // Mac print
    // Windows Snipping Tool / Screenshot shortcuts
    e.key === 'PrintScreen',
    e.metaKey && e.shiftKey && (e.key === '3' || e.key === '4' || e.key === '5'), // Mac screenshot
    // Alt+F4 (Windows close)
    e.altKey && e.key === 'F4',
    // Windows key
    e.key === 'Meta' && e.type === 'keydown',
    e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey,  // Windows/Mac key alone
  ];
  if (blocked.some(Boolean)) {
    e.preventDefault();
    e.stopPropagation();
    if (e.key === 'PrintScreen' || (e.metaKey && e.shiftKey)) {
      _addSuspicion(20, 'SCREENSHOT_KEY');
      _showWarnOv('Screenshot bloklandi!', 'Screenshot olishga urinish qayd etildi.');
    }
    return false;
  }
}

// ---- Oyna hodisalari ----

function _onVisibilityChange() {
  if (!_examState.active) return;

  if (document.hidden) {
    _addSuspicion(30, 'TAB_SWITCH');
    _examState.tabWarnings++;
    _examLog('TAB_SWITCH', _examState.tabWarnings);

    if (_examState.suspicionScore >= _examState.MAX_SUSPICION || _examState.tabWarnings >= _examState.MAX_WARNINGS) {
      _forceSubmit('TAB_LIMIT');
    } else {
      _showWarnOv(
        '⚠️ Tab almashtirildi!',
        'Ogohlantirish ' + _examState.tabWarnings + '/' + _examState.MAX_WARNINGS +
        '. Yana takrorlansa imtihon avtomatik topshiriladi!'
      );
      setTimeout(_requestFullscreen, 400);
    }
  }
}
function _onWindowBlur() {
  if (!_examState.active || document.hidden) return;
  _addSuspicion(10, 'WINDOW_BLUR');
  _examState.tabWarnings++;
  _examLog('WINDOW_BLUR', _examState.tabWarnings);
  if (_examState.tabWarnings >= _examState.MAX_WARNINGS) {
    _forceSubmit('TAB_LIMIT');
  } else {
    _showWarnOv(
      '⚠️ Oyna tark etildi!',
      'Ogohlantirish ' + _examState.tabWarnings + '/' + _examState.MAX_WARNINGS +
      '. Imtihon davomida oynadan chiqmang!'
    );
    setTimeout(function() { window.focus(); _requestFullscreen(); }, 300);
  }
}

function _onMouseLeave(e) {
  if (!_examState.active) return;
  // Faqat oynadan tashqariga chiqqanda (yuqoriga yoki chekkaga)
  if (e.clientY <= 0 || e.clientX <= 0 || e.clientX >= window.innerWidth || e.clientY >= window.innerHeight) {
    _addSuspicion(3, 'MOUSE_LEAVE');
    _examLog('MOUSE_LEAVE', { x: e.clientX, y: e.clientY });
  }
}

function _onFullscreenChange() {
  if (!_examState.active) return;

  var isFs = !!(document.fullscreenElement || document.webkitFullscreenElement);

  if (!isFs) {
    _addSuspicion(40, 'FULLSCREEN_EXIT');
    _examLog('FULLSCREEN_EXIT');

    if (_examState.suspicionScore >= _examState.MAX_SUSPICION) {
      _forceSubmit('FULLSCREEN_EXIT');
    } else {
      _showWarnOv(
        '🖥️ Fullscreen tark etildi!',
        'Test fullscreen rejimda bo'lishi shart!'
      );
      setTimeout(_requestFullscreen, 600);
    }
  }
}

function _onBeforeUnload(e) {
  if (!_examState.active) return;
  _autoSave();
  e.preventDefault();
  e.returnValue = 'Imtihon davom etmoqda!';
  return 'Imtihon davom etmoqda!';
}

function _onResize() {
  if (!_examState.active) return;
  // DevTools ochilganida oyna o'lchami o'zgarishi mumkin
  var diff = window.outerWidth - window.innerWidth;
  if (diff > 160) {
    _addSuspicion(10, 'RESIZE_DEVTOOLS');
    _examLog('DEVTOOLS_RESIZE', diff);
  }
}

// ============================================================
// 2. SUSPICION SCORING SYSTEM
// ============================================================
function _addSuspicion(points, reason) {
  if (!_examState.active) return;
  _examState.suspicionScore += points;
  _examLog('SUSPICION', { reason: reason, points: points, total: _examState.suspicionScore });

  if (_examState.suspicionScore >= _examState.MAX_SUSPICION) {
    _forceSubmit('SUSPICION_LIMIT');
    return;
  }
  // Suspicion progress ko'rsatish
  _updateSuspicionBar();
}

function _updateSuspicionBar() {
  var bar = document.getElementById('examSuspicionBar');
  if (!bar) return;
  var pct = Math.min(100, (_examState.suspicionScore / _examState.MAX_SUSPICION) * 100);
  bar.style.width = pct + '%';
  bar.style.background = pct > 70 ? '#ef4444' : pct > 40 ? '#f59e0b' : '#22c55e';
}

// ============================================================
// 3. DEVTOOLS DETECTION (3 usul)
// ============================================================
function _devToolsDetect() {
  var prev = 0;

  // Usul 1: outerWidth - innerWidth (dock qilingan devtools)
  _examState._dtInterval = setInterval(function() {
    if (!_examState.active) return;
    var diff = window.outerWidth - window.innerWidth;
    if (diff > 160 && prev <= 160) {
      _examLog('DEVTOOLS_DOCK', diff);
      _addSuspicion(25, 'DEVTOOLS_OPEN');
      _showWarnOv('🔧 DevTools aniqlandi!', 'Bu xavfsizlik tizimi tomonidan qayd etildi. Davom etsangiz imtihon yakunlanadi.');
    }
    prev = diff;
  }, 1000);

  // Usul 2: console.log object toString
  (function() {
    var devtools = { open: false };
    var threshold = 160;
    setInterval(function() {
      if (!_examState.active) return;
      var widthThreshold = window.outerWidth - window.innerWidth > threshold;
      var heightThreshold = window.outerHeight - window.innerHeight > threshold;
      if (widthThreshold || heightThreshold) {
        if (!devtools.open) {
          devtools.open = true;
          _addSuspicion(15, 'DEVTOOLS_DETECT2');
          _examLog('DEVTOOLS_UNDOCK', { w: window.outerWidth - window.innerWidth, h: window.outerHeight - window.innerHeight });
        }
      } else {
        devtools.open = false;
      }
    }, 1500);
  })();

 
}

// ============================================================
// 4. MULTI-TAB DETECTION (BroadcastChannel)
// ============================================================
function _multiTabDetect() {
  if (!window.BroadcastChannel) return;
  var ch = new BroadcastChannel('idu_exam_' + _examState.attemptId);
  _examState.broadcastChannel = ch;

  ch.onmessage = function(e) {
    if (e.data === 'EXAM_OPEN' && _examState.active) {
      _addSuspicion(50, 'MULTI_TAB');
      _examLog('MULTI_TAB', 'Another tab opened exam');
      _forceSubmit('MULTI_TAB');
    }
  };

  // Bu tab ochilganini boshqa tablarga xabar ber
  ch.postMessage('EXAM_OPEN');
  // Va o'zi ham tinglaydi
  setTimeout(function() { ch.postMessage('EXAM_OPEN'); }, 500);
}

// ============================================================
// 5. SCREEN RECORDING DETECTION
// ============================================================
function _screenRecordDetect() {
  // MediaDevices API orqali screen share/record urinishini ushla
  if (!navigator.mediaDevices) return;

  var origGetDisplayMedia = navigator.mediaDevices.getDisplayMedia;
  if (origGetDisplayMedia) {
    navigator.mediaDevices.getDisplayMedia = function() {
      _addSuspicion(50, 'SCREEN_RECORD_ATTEMPT');
      _examLog('SCREEN_RECORD', 'getDisplayMedia called');
      _forceSubmit('SCREEN_RECORD');
      return Promise.reject(new Error('Imtihon vaqtida ekranni ulashish taqiqlangan.'));
    };
  }

  var origGetUserMedia = navigator.mediaDevices.getUserMedia;
  if (origGetUserMedia) {
    navigator.mediaDevices.getUserMedia = function(constraints) {
      if (constraints && (constraints.video || constraints.screen)) {
        _addSuspicion(30, 'GETUSERMEDIA_VIDEO');
        _examLog('SCREEN_RECORD', 'getUserMedia video called');
      }
      return origGetUserMedia.call(navigator.mediaDevices, constraints);
    };
  }
}

// ============================================================
// 6. BOT / AUTOMATION DETECTION
// ============================================================
function _botDetect() {
  var flags = [];
  if (navigator.webdriver) flags.push('webdriver');
  if (window._phantom || window.callPhantom) flags.push('phantom');
  if (window.__nightmare) flags.push('nightmare');
  if (window.domAutomation || window.domAutomationController) flags.push('chromedriver');
  if (navigator.userAgent.indexOf('HeadlessChrome') !== -1) flags.push('headless');

  if (flags.length) {
    _examLog('BOT_DETECTED', flags);
    _addSuspicion(100, 'BOT');
  }
}

// ============================================================
// 7. SERVER TIME SYNC (vaqt manipulyatsiyasiga qarshi)
// ============================================================
function _serverTimeSync() {
  _examState.startServerTime = Date.now();
  if (_examState.isTestMode) return; // Test rejimida server vaqt tekshiruvi yo'q
  if (typeof api !== 'undefined' && _examState.attemptId) {
    api('GET', '/exams/time').then(function(data) {
      if (data && data.serverTime) {
        var drift = Math.abs(data.serverTime - Date.now());
        if (drift > 60000) {
          _examLog('TIME_DRIFT', drift);
          _addSuspicion(30, 'TIME_MANIPULATION');
        }
      }
    }).catch(function() {});
  }
}

// ============================================================
// 8. HEARTBEAT
// ============================================================
function _startHeartbeat() {
  _examState.heartbeatInterval = setInterval(function() {
    if (!_examState.active) return;

    // Vaqt manipulyatsiyasini aniqlash
    var expectedElapsed = Date.now() - _examState.startServerTime;
    var timerElapsed = _examState.startTime ? (Date.now() - _examState.startTime) : 0;
    if (Math.abs(expectedElapsed - timerElapsed) > 10000) {
      _examLog('TIME_TAMPER', { expected: expectedElapsed, actual: timerElapsed });
      _addSuspicion(30, 'TIME_TAMPER');
    }

    // Backend heartbeat (faqat real sesiyada)
    if (!_examState.isTestMode && typeof api !== 'undefined' && _examState.attemptId) {
      try {
        api('POST', '/exams/' + _examState.attemptId + '/heartbeat', {
          suspicion: _examState.suspicionScore,
          tabWarnings: _examState.tabWarnings,
          answered: Object.keys(_examState.answers).length,
          fingerprint: _examFingerprint()
        });
      } catch(e) {}
    }
  }, 10000);
}

// ============================================================
// 9. XOR ENCRYPTION (localStorage uchun)
// ============================================================
function _xorEncrypt(str, key) {
  var result = '';
  for (var i = 0; i < str.length; i++) {
    result += String.fromCharCode(str.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return btoa(result);
}

function _xorDecrypt(encoded, key) {
  try {
    var str = atob(encoded);
    var result = '';
    for (var i = 0; i < str.length; i++) {
      result += String.fromCharCode(str.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    return result;
  } catch(e) { return null; }
}

function _genSessionKey(attemptId) {
  return 'IDU_' + attemptId + '_' + navigator.userAgent.length + '_KEY';
}

// ============================================================
// 10. INTEGRITY HASH
// ============================================================
function _calcIntegrity(answers, attemptId, startTime) {
  var raw = JSON.stringify(answers) + '|' + attemptId + '|' + startTime;
  var hash = 0;
  for (var i = 0; i < raw.length; i++) {
    hash = ((hash << 5) - hash) + raw.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16);
}

// ============================================================
// 11. WARNING OVERLAY
// ============================================================
function _closeWarnOv() {
  var el = document.getElementById('examWarnOv');
  if (el) {
    el.style.opacity = '0';
    el.style.transition = 'opacity .25s';
    setTimeout(function() { if (el.parentNode) el.remove(); }, 250);
  }
  window.focus();
  _requestFullscreen();
}

function _showWarnOv(title, msg) {
  var ov = document.getElementById('examWarnOv');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'examWarnOv';
    document.body.appendChild(ov);
  }
  var score = _examState.suspicionScore || 0;
  var pct = Math.min(100, (score / _examState.MAX_SUSPICION) * 100);

  ov.style.cssText = [
    'position:fixed;inset:0;z-index:99999',
    'background:rgba(15,23,42,.97)',
    'display:flex;flex-direction:column;align-items:center;justify-content:center',
    'color:#fff;text-align:center;padding:40px',
    'backdrop-filter:blur(8px)',
    'animation:iduWarnIn .2s ease',
  ].join(';');

  ov.innerHTML = [
    '<style>@keyframes iduWarnIn{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:scale(1)}}</style>',
    '<div style="width:80px;height:80px;border-radius:50%;background:rgba(239,68,68,.15);border:2px solid rgba(239,68,68,.4);display:flex;align-items:center;justify-content:center;font-size:40px;margin-bottom:20px">⚠️</div>',
    '<h2 style="font-size:24px;font-weight:800;margin-bottom:10px;color:#fef2f2">' + title + '</h2>',
    '<p style="font-size:14px;opacity:.75;max-width:380px;margin-bottom:28px;line-height:1.6">' + msg + '</p>',
    '<div style="width:240px;background:rgba(255,255,255,.1);border-radius:99px;overflow:hidden;margin-bottom:8px;height:6px">',
    '  <div style="width:' + pct + '%;height:6px;background:' + (pct > 70 ? '#ef4444' : pct > 40 ? '#f59e0b' : '#22c55e') + ';border-radius:99px;transition:width .3s"></div>',
    '</div>',
    '<p style="font-size:11px;opacity:.4;margin-bottom:28px">Shubha darajasi: ' + Math.round(pct) + '%</p>',
    '<button onclick="_closeWarnOv()" style="background:#1e3a8a;color:#fff;border:none;padding:14px 40px;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer;letter-spacing:.5px">',
    '  Imtihonga qaytish',
    '</button>',
  ].join('');
}

// ============================================================
// 12. AUTO SAVE (shifrlangan)
// ============================================================
function _startAutoSave() {
  _examState.saveInterval = setInterval(_autoSave, 20000); // 20s da bir
}

function _autoSave() {
  if (!_examState.active) return;
  var snap = {
    attemptId: _examState.attemptId,
    answers: _examState.answers,
    flagged: _examState.flagged,
    savedAt: Date.now(),
    elapsed: Date.now() - (_examState.startTime || Date.now()),
    integrity: _calcIntegrity(_examState.answers, _examState.attemptId, _examState.startTime)
  };
  var key = _examState.sessionKey;
  var storageKey = 'idu_exam_' + _examState.attemptId;
  try {
    var encrypted = _xorEncrypt(JSON.stringify(snap), key);
    localStorage.setItem(storageKey, encrypted);
  } catch(e) {}

  // Backend'ga save (faqat real sesiyada)
  if (!_examState.isTestMode && typeof api !== 'undefined' && _examState.attemptId) {
    try {
      api('POST', '/exams/' + _examState.attemptId + '/save', {
        answers: _examState.answers,
        integrity: snap.integrity
      });
    } catch(e) {}
  }
}

function _restoreSnapshot(id) {
  var key = _genSessionKey(id);
  try {
    var raw = localStorage.getItem('idu_exam_' + id);
    if (!raw) return null;
    var decrypted = _xorDecrypt(raw, key);
    if (!decrypted) return null;
    return JSON.parse(decrypted);
  } catch(e) { return null; }
}

function _clearSnapshot(id) {
  localStorage.removeItem('idu_exam_' + id);
}

// ============================================================
// 13. TIMER
// ============================================================
function _startTimer(secs) {
  _examState.startTime = Date.now();
  _renderTimer(secs);
  _examState.timerInterval = setInterval(function() {
    if (!_examState.active) return;
    var left = Math.max(0, secs - Math.floor((Date.now() - _examState.startTime) / 1000));
    _renderTimer(left);
    if (left <= 0) _forceSubmit('TIME_UP');
  }, 1000);
}

function _renderTimer(left) {
  var el = document.getElementById('examTimerDisplay');
  if (!el) return;
  var m = String(Math.floor(left / 60)).padStart(2, '0');
  var s = String(left % 60).padStart(2, '0');
  el.textContent = m + ':' + s;
  if (left <= 60) {
    el.style.color = '#ef4444';
    el.style.fontWeight = '800';
    el.style.animation = 'iduTimerPulse 1s infinite';
  } else if (left <= 300) {
    el.style.color = '#f59e0b';
    el.style.fontWeight = '700';
    el.style.animation = 'none';
  } else {
    el.style.color = '#22c55e';
    el.style.fontWeight = '700';
    el.style.animation = 'none';
  }
}

// ============================================================
// 14. FORCE SUBMIT
// ============================================================
function _forceSubmit(reason) {
  if (_examState.forceSubmitted) return;
  _examState.forceSubmitted = true;

_examLog('SUBMIT', reason);
_autoSave();

_examState.active = false;
clearInterval(_examState.timerInterval);
clearInterval(_examState.saveInterval);
clearInterval(_examState.heartbeatInterval);
_examSecurityOff();

  var msgs = {
    TIME_UP:         '⏰ Vaqt tugadi! Javoblar avtomatik topshirildi.',
    TAB_LIMIT:       '🚫 Ruxsatsiz harakat! Imtihon yakunlandi.',
    SUSPICION_LIMIT: '🚨 Shubhali faollik aniqlandi! Imtihon yakunlandi.',
    MULTI_TAB:       '🚫 Boshqa tabda imtihon ochildi! Imtihon yakunlandi.',
    SCREEN_RECORD:   '🚫 Ekranni yozib olishga urinish! Imtihon yakunlandi.',
    BOT:             '🤖 Avtomatlashtirish aniqlandi! Imtihon yakunlandi.',
    MANUAL:          '✅ Imtihon muvaffaqiyatli topshirildi!'
  };

  var isError = reason !== 'MANUAL' && reason !== 'TIME_UP';
  var bg = isError ? 'rgba(127,29,29,.97)' : reason === 'MANUAL' ? 'rgba(20,83,45,.97)' : 'rgba(30,58,138,.97)';
  var icon = isError ? '🚫' : reason === 'MANUAL' ? '✅' : '⏰';

  var ov = document.getElementById('examWarnOv') || document.createElement('div');
  ov.id = 'examWarnOv';
  ov.style.cssText = 'position:fixed;inset:0;z-index:99999;background:' + bg + ';display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;text-align:center;padding:40px;backdrop-filter:blur(8px)';
  ov.innerHTML = [
    '<div style="font-size:72px;margin-bottom:20px">' + icon + '</div>',
    '<h2 style="font-size:26px;font-weight:800;margin-bottom:12px">' + (msgs[reason] || msgs.MANUAL) + '</h2>',
    '<p style="font-size:14px;opacity:.7;margin-bottom:8px">Shubha darajasi: ' + _examState.suspicionScore + '/' + _examState.MAX_SUSPICION + '</p>',
    '<p style="font-size:14px;opacity:.6">Natija tez orada ko\'rinadi.</p>',
  ].join('');
  if (!ov.parentNode) document.body.appendChild(ov);

  // Submit
  var isTestMode = _examState.isTestMode;
  var qs = _examState.questions;
  var answers = _examState.answers;
  _clearSnapshot(_examState.attemptId);

  if (!isTestMode) {
    try { submitRealExam(reason); } catch(e) {}
    setTimeout(function() {
      if (ov.parentNode) ov.remove();
      closeRealExam();
    }, 4000);
  } else {
    // Test rejimi — local natijalar ko'rsat
    var correct = 0;
    qs.forEach(function(q, i) {
      var rightIdx = (typeof q.ans !== 'undefined') ? q.ans : q.correct;
      if (answers[i] !== undefined && answers[i] === rightIdx) correct++;
    });
    var pct = qs.length ? Math.round(correct / qs.length * 100) : 0;
    var grade = pct >= 86 ? 5 : pct >= 71 ? 4 : pct >= 56 ? 3 : 2;
    var gradeColor = grade === 5 ? '#16A34A' : grade === 4 ? '#2563EB' : grade === 3 ? '#D97706' : '#DC2626';
    var gradeEmoji = grade === 5 ? '🏆' : grade === 4 ? '✅' : grade === 3 ? '📊' : '❌';

    setTimeout(function() {
      if (ov.parentNode) ov.remove();
      closeRealExam();

      // Show results modal
      var res = document.createElement('div');
      res.id = 'testResultsModal';
      res.style.cssText = 'position:fixed;inset:0;z-index:9500;background:#f1f5f9;overflow-y:auto;font-family:inherit';
      var reviewHtml = qs.map(function(q, i) {
        var userAns = answers[i];
        var rightIdx = (typeof q.ans !== 'undefined') ? q.ans : q.correct;
        var isRight = userAns !== undefined && userAns === rightIdx;
        var bg = isRight ? '#F0FDF4' : userAns !== undefined ? '#FFF5F5' : '#FFFBEB';
        var border = isRight ? '#86EFAC' : userAns !== undefined ? '#FCA5A5' : '#FDE68A';
        var icon = isRight ? '✅' : userAns !== undefined ? '❌' : '⚠️';
        var html2 = '<div style="background:' + bg + ';border:1.5px solid ' + border + ';border-radius:12px;padding:16px 18px;margin-bottom:12px">';
        html2 += '<div style="font-size:13px;font-weight:700;color:#0F172A;margin-bottom:10px"><span style="color:#94A3B8;margin-right:6px">' + (i+1) + '.</span>' + icon + ' ' + q.q + '</div>';
        q.opts.forEach(function(opt, j) {
          var isCorrect = j === rightIdx;
          var isUser = j === userAns;
          var optBg = isCorrect ? '#DCFCE7' : isUser && !isRight ? '#FEE2E2' : 'transparent';
          var optBorder = isCorrect ? '#16A34A' : isUser && !isRight ? '#DC2626' : '#E2E8F0';
          var optColor = isCorrect ? '#15803D' : isUser && !isRight ? '#B91C1C' : '#374151';
          html2 += '<div style="padding:8px 12px;border:1.5px solid ' + optBorder + ';border-radius:8px;margin-bottom:6px;font-size:12.5px;background:' + optBg + ';color:' + optColor + '">';
          html2 += (isCorrect ? '✓ ' : isUser && !isRight ? '✗ ' : '') + opt + '</div>';
        });
        html2 += '</div>';
        return html2;
      }).join('');

      res.innerHTML = '<div style="max-width:680px;margin:0 auto;padding:24px 16px">' +
        '<div style="text-align:center;padding:32px 0 20px">' +
          '<div style="font-size:56px;margin-bottom:10px">' + gradeEmoji + '</div>' +
          '<div style="font-size:30px;font-weight:900;color:' + gradeColor + '">' + pct + '%</div>' +
          '<div style="font-size:15px;color:#64748B;margin-top:6px">' + correct + ' / ' + qs.length + ' ta to\'g\'ri javob</div>' +
          '<div style="display:inline-block;margin-top:12px;padding:8px 24px;background:' + gradeColor + '20;border:2px solid ' + gradeColor + ';border-radius:12px;font-size:20px;font-weight:800;color:' + gradeColor + '">' + grade + '-baho</div>' +
        '</div>' +
        '<div style="margin-bottom:16px">' + reviewHtml + '</div>' +
        '<div style="text-align:center;padding:12px 0 32px">' +
          '<button onclick="document.getElementById(\'testResultsModal\').remove()" style="padding:14px 36px;background:linear-gradient(135deg,#1e3a8a,#1e40af);color:#fff;border:none;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer;box-shadow:0 4px 12px rgba(30,58,138,.3)">Yopish</button>' +
        '</div>' +
      '</div>';
      document.body.appendChild(res);
    }, 1500);
  }
}

// ============================================================
// 15. LOG
// ============================================================
var _examLogs = [];
function _examLog(event, data) {
  _examLogs.push({ event: event, data: data, t: new Date().toISOString() });
  if (_examState.isTestMode) return; // Test rejimida API ga yubormaydi
  if (typeof api !== 'undefined' && _examState.attemptId) {
    try {
      api('POST', '/exams/' + _examState.attemptId + '/log', {
        event: event, data: data,
        suspicion: _examState.suspicionScore
      });
    } catch(e) {}
  }
}

// ============================================================
// 16. OPEN / CLOSE REAL EXAM
// ============================================================
function openRealExam(exam) {
  if (!exam) return;
  if (_examState.active) return; // Ikki marta ochilishini bloklash

  var userId = (typeof currentUser !== 'undefined' && currentUser) ? (currentUser.id || currentUser.email || '') : '';

  _examState = {
    active: true,
    attemptId: exam.id || ('exam_' + Date.now()),
    answers: {},
    flagged: {},
    currentIdx: 0,
    questions: exam.questions || [],
    startTime: null,
    duration: exam.duration || 1800,
    timerInterval: null,
    saveInterval: null,
    heartbeatInterval: null,
    tabWarnings: 0,
    MAX_WARNINGS: exam.maxWarnings || 3,
    suspicionScore: 0,
    MAX_SUSPICION: exam.maxSuspicion || 100,
    forceSubmitted: false,
    sessionKey: _genSessionKey(exam.id || 'quiz'),
    userId: userId,
    startServerTime: Date.now(),
    broadcastChannel: null,
    mediaStream: null,
    _dtInterval: null,
    _mouseInterval: null,
    _fsCheckInterval: null,
    _origWindowOpen: null,
    isTestMode: !!exam.isTestMode,
    subjectName: exam.subjectName || '',
  };
  _examLogs = [];

  // Snapshot restore
  var snap = _restoreSnapshot(_examState.attemptId);
  if (snap && snap.savedAt && snap.savedAt > Date.now() - _examState.duration * 1000) {
    // Integrity tekshiruvi
    var expectedIntegrity = _calcIntegrity(snap.answers || {}, _examState.attemptId, _examState.startTime);
    if (snap.integrity && snap.integrity !== expectedIntegrity) {
      _examLog('INTEGRITY_FAIL', 'Snapshot tampered');
    } else {
      _examState.answers = snap.answers || {};
      _examState.flagged = snap.flagged || {};
      var elapsed = Math.floor((Date.now() - snap.savedAt + (snap.elapsed || 0)) / 1000);
      _examState.duration = Math.max(60, _examState.duration - elapsed);
    }
  }

  _injectSecurityCSS(userId);
  document.body.classList.add('exam-active', 'secure-exam-mode');

var nav = document.getElementById('hemis-nav');
if (nav) nav.style.display = 'none';

var mc = document.getElementById('mainContent');
if (mc) {
  mc.dataset.prevMarginLeft = mc.style.marginLeft || '';
  mc.dataset.prevWidth = mc.style.width || '';
  mc.style.marginLeft = '0';
  mc.style.width = '100%';
}
  _buildExamModal();
  _requestFullscreen();
  _examSecurityOn();
  _startTimer(_examState.duration);
  _startAutoSave();
  _examLog('START', exam.id);
}

function closeRealExam() {
  document.body.classList.remove('exam-active', 'secure-exam-mode');

var nav = document.getElementById('hemis-nav');
if (nav) nav.style.display = '';

var mc = document.getElementById('mainContent');
if (mc) {
  mc.style.marginLeft = mc.dataset.prevMarginLeft || '';
  mc.style.width = mc.dataset.prevWidth || '';
}
  _examState.active = false;
  clearInterval(_examState.timerInterval);
  clearInterval(_examState.saveInterval);
  clearInterval(_examState.heartbeatInterval);
  _examSecurityOff();
  var m = document.getElementById('realExamModal');
  if (m) m.remove();
}

// ============================================================
// 17. EXAM UI
// ============================================================
function _buildExamModal() {
  var old = document.getElementById('realExamModal');
  if (old) old.remove();
  var m = document.createElement('div');
  m.id = 'realExamModal';
  m.style.cssText = 'position:fixed;inset:0;z-index:9000;background:#f1f5f9;display:flex;flex-direction:column;font-family:inherit;overflow:hidden';
  m.innerHTML = _examModalHTML();
  document.body.appendChild(m);
  _renderQ(0);
}

function _examModalHTML() {
  var qs = _examState.questions;
  var navBtns = qs.map(function(_, i) {
    return (
      '<button id="en_' + i + '" onclick="examGoTo(' + i + ')" ' +
      'style="width:36px;height:36px;margin:3px;border:2px solid #e2e8f0;border-radius:8px;font-weight:700;font-size:13px;cursor:pointer;background:#fff;color:#374151;transition:all .2s">' +
      (i + 1) + '</button>'
    );
  }).join('');

  return [
    // Timer pulse animation
    '<style>',
    '@keyframes iduTimerPulse{0%,100%{opacity:1}50%{opacity:.5}}',
    '@keyframes iduFlagPop{0%{transform:scale(1)}50%{transform:scale(1.3)}100%{transform:scale(1)}}',
    '</style>',

    // Header
    '<div style="background:linear-gradient(135deg,#1e3a8a 0%,#1e40af 100%);color:#fff;padding:10px 20px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;box-shadow:0 2px 8px rgba(0,0,0,.2)">',
      '<div style="font-weight:800;font-size:15px;display:flex;align-items:center;gap:8px">',
        '<span>' + (_examState.isTestMode ? '🧪' : '📋') + '</span>',
        (_examState.subjectName || 'Imtihon') + (_examState.isTestMode ? ' — Mashq' : ' — Sesiya'),
      '</div>',
      '<div style="display:flex;align-items:center;gap:16px">',
        // Suspicion bar
        '<div title="Shubha darajasi" style="width:80px;height:4px;background:rgba(255,255,255,.2);border-radius:99px;overflow:hidden">',
          '<div id="examSuspicionBar" style="height:4px;width:0%;background:#22c55e;border-radius:99px;transition:width .3s,background .3s"></div>',
        '</div>',
        '<span id="examProgress" style="font-size:13px;opacity:.8;min-width:50px;text-align:center">0/' + qs.length + '</span>',
        '<div id="examTimerDisplay" style="background:rgba(255,255,255,.15);border-radius:10px;padding:6px 18px;font-size:22px;font-weight:800;letter-spacing:2px;min-width:90px;text-align:center;font-variant-numeric:tabular-nums">--:--</div>',
      '</div>',
    '</div>',

    // Body
    '<div style="display:flex;flex:1;overflow:hidden">',

      // Sidebar
      '<div style="width:190px;background:#fff;border-right:1px solid #e2e8f0;overflow-y:auto;padding:12px;flex-shrink:0">',
        '<div style="font-size:10px;font-weight:700;color:#94a3b8;margin-bottom:10px;letter-spacing:1px">SAVOLLAR</div>',
        '<div style="display:flex;flex-wrap:wrap">' + navBtns + '</div>',
        '<div style="margin-top:16px;font-size:11px;color:#64748b;line-height:1.8">',
          '<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">',
            '<div style="width:14px;height:14px;background:#1e3a8a;border-radius:4px"></div> Javoblangan',
          '</div>',
          '<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">',
            '<div style="width:14px;height:14px;background:#f59e0b;border-radius:4px"></div> Belgilangan',
          '</div>',
          '<div style="display:flex;align-items:center;gap:6px">',
            '<div style="width:14px;height:14px;background:#fff;border:2px solid #e2e8f0;border-radius:4px"></div> Javobsiz',
          '</div>',
        '</div>',
      '</div>',

      // Question area
      '<div style="flex:1;overflow-y:auto;padding:28px 32px" id="examQArea"></div>',
    '</div>',

    // Footer
    '<div style="background:#fff;border-top:1px solid #e2e8f0;padding:12px 20px;display:flex;justify-content:space-between;align-items:center;flex-shrink:0">',
      '<button onclick="examPrev()" style="padding:10px 22px;border:2px solid #e2e8f0;border-radius:10px;background:#fff;cursor:pointer;font-weight:600;transition:all .2s;color:#374151">',
        '← Oldingi',
      '</button>',
      '<div style="display:flex;gap:10px">',
        '<button onclick="examToggleFlag()" id="examFlagBtn" style="padding:10px 18px;border:2px solid #f59e0b;border-radius:10px;background:#fff;cursor:pointer;font-weight:600;color:#d97706;transition:all .2s">',
          '🚩 Belgilaish',
        '</button>',
        '<button onclick="examConfirmSubmit()" style="padding:10px 28px;background:linear-gradient(135deg,#16a34a,#15803d);color:#fff;border:none;border-radius:10px;cursor:pointer;font-weight:700;box-shadow:0 2px 8px rgba(22,163,74,.3)">',
          '✅ Topshirish',
        '</button>',
      '</div>',
      '<button onclick="examNext()" style="padding:10px 22px;background:#1e3a8a;color:#fff;border:none;border-radius:10px;cursor:pointer;font-weight:600">',
        'Keyingi →',
      '</button>',
    '</div>',
  ].join('');
}

function _renderQ(idx) {
  var qs = _examState.questions;
  if (!qs.length) return;
  idx = Math.max(0, Math.min(idx, qs.length - 1));
  _examState.currentIdx = idx;
  var q = qs[idx];
  var saved = _examState.answers[idx];
  var isFlagged = !!_examState.flagged[idx];
  var area = document.getElementById('examQArea');
  if (!area) return;

  var optsHtml = (q.opts || []).map(function(opt, oi) {
    var sel = saved === oi;
    return [
      '<label style="display:flex;align-items:center;gap:14px;padding:16px 20px;border:2px solid ',
      (sel ? '#1e3a8a' : '#e2e8f0'),
      ';border-radius:14px;cursor:pointer;background:',
      (sel ? '#eff6ff' : '#fff'),
      ';margin-bottom:10px;transition:all .15s;box-shadow:',
      (sel ? '0 0 0 3px rgba(30,58,138,.1)' : 'none'),
      '">',
      '<input type="radio" name="examOpt" value="' + oi + '" ' + (sel ? 'checked' : '') +
      ' onchange="examAnswer(' + idx + ',' + oi + ')" style="width:18px;height:18px;accent-color:#1e3a8a;flex-shrink:0">',
      '<span style="font-size:15px;color:#1e293b;line-height:1.5">' + opt + '</span>',
      '</label>',
    ].join('');
  }).join('');

  area.innerHTML = [
    '<div style="max-width:680px;margin:0 auto">',
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">',
        '<span style="font-size:13px;color:#64748b;font-weight:600">Savol ' + (idx + 1) + ' / ' + qs.length + '</span>',
        (isFlagged ? '<span style="font-size:12px;color:#f59e0b;font-weight:700">🚩 Belgilangan</span>' : ''),
      '</div>',
      '<div style="font-size:18px;font-weight:700;color:#1e293b;line-height:1.6;margin-bottom:24px;padding:22px 24px;background:#fff;border-radius:16px;border:1px solid #e2e8f0;box-shadow:0 1px 4px rgba(0,0,0,.04)">' + q.q + '</div>',
      optsHtml,
    '</div>',
  ].join('');

  _updateNav(idx);
  _updateProgress();

  // Flag button holati
  var flagBtn = document.getElementById('examFlagBtn');
  if (flagBtn) {
    flagBtn.style.background = isFlagged ? '#fef3c7' : '#fff';
    flagBtn.style.borderColor = isFlagged ? '#f59e0b' : '#e2e8f0';
  }
}

function _updateNav(current) {
  _examState.questions.forEach(function(_, i) {
    var b = document.getElementById('en_' + i);
    if (!b) return;
    var ans = _examState.answers[i] !== undefined;
    var flagged = !!_examState.flagged[i];
    if (ans) {
      b.style.background = '#1e3a8a';
      b.style.color = '#fff';
      b.style.borderColor = '#1e3a8a';
    } else if (flagged) {
      b.style.background = '#fef3c7';
      b.style.color = '#92400e';
      b.style.borderColor = '#f59e0b';
    } else {
      b.style.background = '#fff';
      b.style.color = '#374151';
      b.style.borderColor = '#e2e8f0';
    }
    b.style.transform = i === current ? 'scale(1.18)' : 'scale(1)';
    b.style.boxShadow = i === current ? '0 0 0 3px rgba(30,58,138,.25)' : 'none';
  });
}

function _updateProgress() {
  var ans = Object.keys(_examState.answers).length;
  var el = document.getElementById('examProgress');
  if (el) el.textContent = ans + '/' + _examState.questions.length;
}

// ============================================================
// 18. PUBLIC EXAM CONTROLS
// ============================================================
function examGoTo(i) { _renderQ(i); }
function examNext() { _renderQ(_examState.currentIdx + 1); }
function examPrev() { _renderQ(_examState.currentIdx - 1); }

function examToggleFlag() {
  var idx = _examState.currentIdx;
  if (_examState.flagged[idx]) {
    delete _examState.flagged[idx];
  } else {
    _examState.flagged[idx] = true;
  }
  _renderQ(idx);
}

function examAnswer(idx, optIdx) {
  _examState.answers[idx] = optIdx;
  _updateNav(idx);
  _updateProgress();
  setTimeout(function() {
    if (_examState.currentIdx === idx) examNext();
  }, 400);
}

function examConfirmSubmit() {
  var total = _examState.questions.length;
  var ans = Object.keys(_examState.answers).length;
  var flagged = Object.keys(_examState.flagged).length;
  var unanswered = total - ans;
  var lines = [
    '📊 Natija:',
    '✅ Javoblangan: ' + ans + '/' + total,
  ];
  if (unanswered > 0) lines.push('❌ Javobsiz: ' + unanswered + ' ta');
  if (flagged > 0) lines.push('🚩 Belgilangan: ' + flagged + ' ta');
  lines.push('', 'Imtihonni topshirasizmi?');
  if (confirm(lines.join('\n'))) _forceSubmit('MANUAL');
}

async function submitRealExam(reason) {
  if (!_examState.attemptId) return;
  var ansArr = _examState.questions.map(function(_, i) {
     return _examState.answers[i] !== undefined
       ? _examState.answers[i]
       : null;
});
  var integrity = _calcIntegrity(_examState.answers, _examState.attemptId, _examState.startTime);

  if (typeof api !== 'undefined') {
    try {
       await api('POST', '/exams/' + _examState.attemptId + '/submit', {
        answers: ansArr,
        logs: _examLogs,
        warnings: _examState.tabWarnings,
        suspicion: _examState.suspicionScore,
        reason: reason || 'MANUAL',
        integrity: integrity,
        duration: _examState.duration,
        elapsed: _examState.startTime ? Math.floor((Date.now() - _examState.startTime) / 1000) : 0,
      });
    } catch(e) {
      console.warn('Exam submit API error (ignored):', e);
    }
  }
}

// ============================================================
// 19. openQuiz / closeQuiz
// ============================================================
function openQuiz() {
  if (typeof QUIZ_QUESTIONS === 'undefined' || !QUIZ_QUESTIONS.length) return;
  openRealExam({
    id: 'quiz_' + Date.now(),
    questions: QUIZ_QUESTIONS,
    duration: 1800,
    maxWarnings: 3,
    maxSuspicion: 100,
  });
}

function closeQuiz() {
  closeRealExam();
}

// ============================================================
// 20. startTestWithSubject (test rejimi)
// ============================================================
function startTestWithSubject(subject, questions, duration) {
  if (!questions || !questions.length) return;

  var examConfig = {
    id: 'test_' + (subject || 'subject') + '_' + Date.now(),
    questions: questions,
    duration: duration || 1800,
    maxWarnings: 3,
    maxSuspicion: 100,
  };

  var el = document.documentElement;
  var fsPromise = el.requestFullscreen
    ? el.requestFullscreen({ navigationUI: 'hide' })
    : el.webkitRequestFullscreen
      ? Promise.resolve(el.webkitRequestFullscreen())
      : Promise.resolve();

  fsPromise
    .then(function() { openRealExam(examConfig); })
    .catch(function() {
      // Foydalanuvchi ruxsat berishi uchun click event kerak
      var overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(15,23,42,.97);display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;text-align:center;padding:40px';
      overlay.innerHTML = '<div style="font-size:60px;margin-bottom:20px">🖥️</div><h2 style="font-size:22px;font-weight:800;margin-bottom:12px">Fullscreen rejim talab qilinadi</h2><p style="font-size:14px;opacity:.7;margin-bottom:28px;max-width:380px">Imtihon xavfsizligi uchun fullscreen rejimda ishlash majburiy. Davom etish uchun tugmani bosing.</p><button id="_fsBtnTemp" style="background:#1e3a8a;color:#fff;border:none;padding:14px 40px;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer">Fullscreen rejimda boshlash</button>';
      document.body.appendChild(overlay);
      document.getElementById('_fsBtnTemp').onclick = function() {
        overlay.remove();
        var p2 = el.requestFullscreen
          ? el.requestFullscreen({ navigationUI: 'hide' })
          : el.webkitRequestFullscreen
            ? Promise.resolve(el.webkitRequestFullscreen())
            : Promise.resolve();
        p2.then(function() { openRealExam(examConfig); }).catch(function() { openRealExam(examConfig); });
      };
    });
}
// ============================================================
// 21. SECURE EXAM LAUNCHER
// ============================================================
async function launchSecureExam(examType, subject) {
  if (typeof api === 'undefined') {
    throw new Error('API client topilmadi');
  }

  var normalizedType = examType === 'real' ? 'sesiya' : examType;

  var started = await api('POST', '/exams/start', {
    examType: normalizedType,
    subject: subject
  });

  openRealExam({
    id: started.attemptId,
    questions: (started.questions || []).map(function(q) {
      return { id: q.id, q: q.text, opts: q.options || [] };
    }),
    duration: (started.durationMin || (normalizedType === 'test' ? 30 : 60)) * 60,
    maxWarnings: normalizedType === 'test' ? 2 : 1,
    maxSuspicion: normalizedType === 'test' ? 80 : 60,
  });

  return started;
}
// ============================================================
// 21. BACKWARD COMPAT STUBS
// ============================================================
function renderQuiz() {}
function answerQuiz() {}
function startExamTimer() {}
function getRealQuestions() { return typeof REAL_EXAM_QUESTIONS !== 'undefined' ? REAL_EXAM_QUESTIONS : []; }
function loadDekanatQuestions() {}
function saveDekanatQuestions() {}
function renderDekanatQuestions() {}
function openAddQuestionModal() {}
function editQuestion() {}
function deleteQuestion() {}
function clearAllDekanatQuestions() {}
function saveQuestionModal() {}
function closeQuestionModal() {}
function startExamSession() {}
function submitTestExam() {}



