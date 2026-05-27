'use strict';
/* ══════════════════════════════════════════════════════════════
   Onboarding Flow — Notion / Linear style
   4-step spotlight for first-time users
══════════════════════════════════════════════════════════════ */

var ONBOARDING_STEPS = [
  {
    target: '#quickActionsWrap',
    title: '⚡ Tezkor navigatsiya',
    desc: 'Bu 6 ta tugma orqali istalgan sahifaga bir bosishda o\'tasiz — Jadval, Baholar, AI Tutor va boshqalar.',
    pos: 'below',
  },
  {
    target: '#dashStreakRow',
    title: '🔥 Streak va progress',
    desc: 'Har kuni kirganingizda streak oshib boradi. O\'ng tarafda GPA progress ringini ko\'rasiz.',
    pos: 'below',
  },
  {
    target: '#xpWidget',
    title: '🎮 Gamifikatsiya',
    desc: 'Har bir faoliyat uchun XP yig\'asiz. Level oshgan sari yangi imkoniyatlar ochiladi!',
    pos: 'below',
  },
  {
    target: '#cmdPaletteOpenBtn',
    title: '⌘K Buyruq paneli',
    desc: 'Ctrl+K bosib istalgan sahifaga o\'ting yoki harakatni bajaring. Eng tezkor usul!',
    pos: 'below',
  },
];

var _step = 0;
var _overlayEl = null;
var _tooltipEl = null;

function startOnboarding() {
  if (document.getElementById('onboardingOverlay')) return;

  _overlayEl = document.createElement('div');
  _overlayEl.id = 'onboardingOverlay';
  _overlayEl.style.cssText = 'position:fixed;inset:0;z-index:8888;pointer-events:none';
  document.body.appendChild(_overlayEl);

  _tooltipEl = document.createElement('div');
  _tooltipEl.id = 'onboardingTooltip';
  _tooltipEl.style.cssText = 'position:fixed;z-index:8889;display:none';
  document.body.appendChild(_tooltipEl);

  _step = 0;
  _showStep(0);
}

function _showStep(idx) {
  if (idx >= ONBOARDING_STEPS.length) { _finishOnboarding(); return; }
  var s = ONBOARDING_STEPS[idx];
  var target = document.querySelector(s.target);

  // SVG cutout overlay
  var W = window.innerWidth, H = window.innerHeight;
  var rect = target ? target.getBoundingClientRect() : { top: H/2-40, left: W/2-100, width: 200, height: 80 };
  var pad = 8;
  var x = rect.left - pad, y = rect.top - pad, w = rect.width + pad*2, h = rect.height + pad*2;

  _overlayEl.innerHTML =
    '<svg width="' + W + '" height="' + H + '" style="pointer-events:none">' +
      '<defs><mask id="om">' +
        '<rect width="' + W + '" height="' + H + '" fill="white"/>' +
        '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="12" fill="black"/>' +
      '</mask></defs>' +
      '<rect width="' + W + '" height="' + H + '" fill="rgba(15,23,42,0.7)" mask="url(#om)"/>' +
    '</svg>';

  // Tooltip
  var tipX = Math.max(12, Math.min(x, W - 340));
  var tipY = y + h + 14;
  if (tipY + 160 > H) tipY = y - 150;

  _tooltipEl.style.cssText = 'position:fixed;z-index:8889;left:' + tipX + 'px;top:' + tipY + 'px;width:320px';
  _tooltipEl.style.display = 'block';
  _tooltipEl.innerHTML =
    '<div style="background:var(--white);border:1px solid var(--border);border-radius:16px;padding:20px 22px;box-shadow:0 20px 60px rgba(0,0,0,0.25);animation:onboardIn 0.3s cubic-bezier(0.22,1,0.36,1)">' +
      '<style>@keyframes onboardIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}</style>' +
      '<div style="font-size:15px;font-weight:800;color:var(--text);margin-bottom:8px">' + s.title + '</div>' +
      '<div style="font-size:13px;color:var(--text2);line-height:1.65;margin-bottom:18px">' + s.desc + '</div>' +
      '<div style="display:flex;justify-content:space-between;align-items:center">' +
        '<div style="display:flex;gap:5px">' +
          ONBOARDING_STEPS.map(function(_,i){
            return '<div style="width:' + (i===idx?18:7) + 'px;height:7px;border-radius:4px;background:' + (i===idx?'var(--primary)':'var(--border2)') + ';transition:width 0.3s"></div>';
          }).join('') +
        '</div>' +
        '<div style="display:flex;gap:8px">' +
          '<button onclick="_skipOnboarding()" style="padding:7px 14px;background:var(--bg2);border:1px solid var(--border);border-radius:8px;font-family:inherit;font-size:12px;font-weight:600;cursor:pointer;color:var(--text2)">O\'tkazib yuborish</button>' +
          '<button onclick="_nextOnboardStep()" style="padding:7px 18px;background:var(--primary);color:#fff;border:none;border-radius:8px;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer">' +
            (idx < ONBOARDING_STEPS.length - 1 ? 'Keyingi →' : '✅ Tayyor!') +
          '</button>' +
        '</div>' +
      '</div>' +
    '</div>';
}

window._nextOnboardStep = function() { _showStep(++_step); };
window._skipOnboarding  = function() { _finishOnboarding(); };

function _finishOnboarding() {
  if (_overlayEl) _overlayEl.remove();
  if (_tooltipEl) _tooltipEl.remove();
  _overlayEl = _tooltipEl = null;
  localStorage.setItem('idu_onboarded', '1');
  if (typeof launchConfetti === 'function') launchConfetti();
}

// Auto-start on first student login
function maybeStartOnboarding() {
  if (localStorage.getItem('idu_onboarded')) return;
  var role = localStorage.getItem('currentRole') || (window.currentUser && window.currentUser.role);
  if (role !== 'student') return;
  setTimeout(startOnboarding, 1200);
}

console.log('✅ Onboarding loaded');
