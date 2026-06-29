'use strict';
// ════════════════════════════════════════════════════════════════
//  IDU URL Router
//  /          → Student login to'g'ridan-to'g'ri (landing yashiriladi)
//  /teacher   → O'qituvchi login
//  /dekanat   → Dekanat login
//  /investor  → Investor login
//  /test      → Imtihon tizimi (student login → exams sahifasi)
//  /rector    → Rektor paneli login
// ════════════════════════════════════════════════════════════════

(function () {
  var ROLE_MAP = {
    '/teacher':  { role: 'teacher',  label: "O'qituvchi paneli", icon: '👨‍🏫', color: '#0891b2', allowedRoles: ['teacher','admin'] },
    '/dekanat':  { role: 'dekanat',  label: 'Dekanat paneli',    icon: '🏛️',  color: '#7c3aed', allowedRoles: ['dekanat','admin'] },
    '/investor': { role: 'investor', label: 'Investor paneli',   icon: '💼',  color: '#059669', allowedRoles: ['investor','admin'] },
    '/test':     { role: 'test',     label: 'Imtihon tizimi',    icon: '📝',  color: '#dc2626', allowedRoles: ['student','admin'], redirectPage: 'exams' },
    '/rector':   { role: 'rector',   label: 'Rektor paneli',     icon: '🎓',  color: '#1e3a8a', allowedRoles: ['rector','admin'] }
  };

  var path = window.location.pathname.replace(/\/+$/, '') || '/';
  var cfg  = ROLE_MAP[path];

  // ── / → Student login to'g'ridan-to'g'ri ──────────────────────
  if (path === '' || path === '/') {
    window._iduUrlRoute    = 'student';
    window._iduUrlRouteCfg = null;
    document.addEventListener('DOMContentLoaded', activateStudentDirectLogin);
    return;
  }

  // ── Noma'lum URL — oddiy landing page ─────────────────────────
  if (!cfg) return;

  window._iduUrlRoute    = cfg.role;
  window._iduUrlRouteCfg = cfg;

  // Landing ni yashirib, rol login ekranini ko'rsatish
  var st = document.createElement('style');
  st.textContent = '#authScreen{display:none!important}#idu-role-login{display:flex!important}';
  document.head.appendChild(st);

  document.addEventListener('DOMContentLoaded', function () {
    buildRoleLoginScreen(cfg);
  });

  // ── Rol login ekranini qurish ──────────────────────────────────
  function buildRoleLoginScreen(cfg) {
    var el = document.getElementById('idu-role-login');
    if (!el) return;
    el.innerHTML =
      '<div class="irl-wrap">' +
        '<div class="irl-left" style="--role-color:' + cfg.color + '">' +
          '<div class="irl-logo-box">IDU</div>' +
          '<div class="irl-icon">' + cfg.icon + '</div>' +
          '<div class="irl-role-name">' + cfg.label + '</div>' +
          '<div class="irl-tagline">International Digital University<br><span>Toshkent · O\'zbekiston</span></div>' +
          '<a href="/" class="irl-back-link">← Asosiy sahifa</a>' +
        '</div>' +
        '<div class="irl-right">' +
          '<div class="irl-form-title">Tizimga kirish</div>' +
          '<div class="irl-form-sub">Login va parolni kiriting</div>' +
          '<div class="login-error-box" id="irlError"><span>⚠️</span>&nbsp;<span id="irlErrorMsg">Login yoki parol noto\'g\'ri</span></div>' +
          '<div class="login-input-wrap">' +
            '<span class="login-input-icon">&#x1F464;</span>' +
            '<input class="login-input-field" id="irlLogin" type="text" placeholder="Login" autocomplete="off"' +
            ' onkeydown="if(event.key===\'Enter\')document.getElementById(\'irlPass\').focus()">' +
          '</div>' +
          '<div class="login-input-wrap">' +
            '<span class="login-input-icon">&#x1F512;</span>' +
            '<input class="login-input-field" id="irlPass" type="password" placeholder="Parol"' +
            ' onkeydown="if(event.key===\'Enter\')irlDoLogin()">' +
            '<button class="login-eye" id="irlEyeBtn" onclick="irlToggleEye()">&#x1F441;</button>' +
          '</div>' +
          '<button class="login-submit" id="irlSubmitBtn" onclick="irlDoLogin()">' +
            '<span>Kirish</span><span style="font-size:16px">&#8594;</span>' +
          '</button>' +
          '<div class="irl-note">Login va parol universitet administratsiyasi tomonidan beriladi.</div>' +
        '</div>' +
      '</div>';

    setTimeout(function () {
      var el = document.getElementById('irlLogin');
      if (el) el.focus();
    }, 100);
  }
})();

// ── / sahifasi: student login to'g'ridan-to'g'ri ──────────────
function activateStudentDirectLogin() {
  // JWT mavjud bo'lsa auto-login o'zi hal qiladi
  try { if (localStorage.getItem('idu_jwt')) return; } catch(e) {}

  var authScreen = document.getElementById('authScreen');
  if (!authScreen) return;

  // Desktop uchun: landing yashirib, modal inline ko'rsatamiz
  // (Mobile uchun mobile.js allaqachon #lpMobLoginScreen ni ko'rsatadi)
  var isMobile = window.innerWidth <= 768;
  if (isMobile) return; // mobile.js hal qiladi

  authScreen.style.cssText = 'display:flex!important;align-items:center;justify-content:center;min-height:100vh;background:var(--bg,#07152a)';

  // Landing elementlarini yashiramiz
  authScreen.querySelectorAll('.lp-nav,.lp-hero,.lp-testimonials,.lp-stats,.lp-features,.lp-cta,.lp-footer,.lp-section,[class^="lp-"]').forEach(function (el) {
    if (!el.closest('#loginModalBg')) el.style.display = 'none';
  });

  // Modal backdrop olib, inline ko'rsatamiz
  var modalBg = document.getElementById('loginModalBg');
  if (modalBg) {
    modalBg.style.cssText = 'display:flex!important;position:static!important;background:none!important;padding:16px;width:100%;justify-content:center';
    var closeBtn = modalBg.querySelector('.lm-close');
    if (closeBtn) closeBtn.style.display = 'none';
    modalBg.onclick = null;
    var modal = document.getElementById('loginModal');
    if (modal) { modal.style.maxWidth = '820px'; modal.style.width = '100%'; }
  }

  setTimeout(function () {
    var el = document.getElementById('mainLogin');
    if (el) el.focus();
  }, 150);
}

// ── Rol login tugmasi ──────────────────────────────────────────
function irlToggleEye() {
  var p = document.getElementById('irlPass');
  var b = document.getElementById('irlEyeBtn');
  if (!p) return;
  p.type = p.type === 'password' ? 'text' : 'password';
  if (b) b.innerHTML = p.type === 'password' ? '&#x1F441;' : '&#x1F648;';
}

function irlDoLogin() {
  var loginVal = (document.getElementById('irlLogin') || {}).value || '';
  var passVal  = (document.getElementById('irlPass')  || {}).value || '';
  var errEl    = document.getElementById('irlError');
  var errMsg   = document.getElementById('irlErrorMsg');
  var btn      = document.getElementById('irlSubmitBtn');
  var cfg      = window._iduUrlRouteCfg || {};
  var allowed  = cfg.allowedRoles || [];

  loginVal = loginVal.trim();
  passVal  = passVal.trim();

  function showErr(msg) {
    if (errMsg) errMsg.textContent = msg;
    if (errEl)  errEl.classList.add('show');
    if (btn) { btn.innerHTML = '<span>Kirish</span><span style="font-size:16px">&#8594;</span>'; btn.disabled = false; }
  }

  if (!loginVal) return showErr('Login kiriting');
  if (!passVal)  return showErr('Parol kiriting');

  if (btn) { btn.innerHTML = '<span>Kirish...</span>'; btn.disabled = true; }
  if (errEl) errEl.classList.remove('show');

  loginWithBackend('auto', loginVal, passVal)
    .then(function (user) {
      var role = user.role;
      if (allowed.length && allowed.indexOf(role) === -1) {
        return showErr('Bu panel uchun ruxsatingiz yo\'q');
      }
      if (btn) { btn.innerHTML = '<span>Kirish</span><span style="font-size:16px">&#8594;</span>'; btn.disabled = false; }

      var roleEl = document.getElementById('idu-role-login');
      if (roleEl) roleEl.style.display = 'none';

      var u = { login: user.login || loginVal, name: user.name || user.full_name || loginVal,
                role: role, group: user.group || '', gpa: user.gpa || 0, phone: user.phone || '' };

      if (typeof launchApp === 'function') {
        launchApp(role, u);
        if (cfg.redirectPage && typeof showPage === 'function') {
          setTimeout(function () { showPage(cfg.redirectPage); }, 300);
        }
      }
    })
    .catch(function (e) {
      showErr((e && e.message) || 'Login yoki parol noto\'g\'ri');
    });
}
