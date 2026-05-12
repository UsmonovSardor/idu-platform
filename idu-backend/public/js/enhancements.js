'use strict';
/* ═══════════════════════════════════════════════════════════════════
   IDU PLATFORM — ENHANCEMENTS v3.0
   1. Landing yashiriladi → to'g'ridan-to'g'ri login modal ochiladi
   2. URL routing: /dekanat  /professor  /investor  /proktor
   3. Proktor roli: faqat sesiya/test boshqaruvchisi (alohida odam)
   4. Dekanat navdan "Sesiya Boshqaruvi" olib tashlandi
   5. Login muammosi tuzatildi (BACKEND_URL ↔ API_BASE to'g'rilandi)
   6. Fullscreen test: copy, tab, screenshot to'liq blok
═══════════════════════════════════════════════════════════════════ */

// ── 0. BACKEND URL tuzatish (localhost → Railway) ────────────────
(function fixBackendURL() {
  // Eski kod localhost:8000 ishlatgan — Railway URLga almashtiramiz
  if (typeof window.BACKEND_URL !== 'undefined' &&
      (window.BACKEND_URL.includes('localhost') || window.BACKEND_URL.includes('127.0.0.1'))) {
    window.BACKEND_URL = '';
  }
  // API_BASE ham to'g'ri bo'lishi uchun
  if (typeof window.API_BASE === 'undefined') {
    window.API_BASE = '/api';
  }
})();

// ── 1. Landing page yashirish ────────────────────────────────────


// ── 2. URL-based routing ─────────────────────────────────────────
(function urlRouting() {
  var p = (window.location.pathname + window.location.hash + window.location.search).toLowerCase();
  if      (/dekanat/.test(p))                 window._IDU_URL_ROLE = 'dekanat';
  else if (/professor|\/teacher/.test(p))     window._IDU_URL_ROLE = 'teacher';
  else if (/investor/.test(p))               window._IDU_URL_ROLE = 'investor';
  else if (/proktor/.test(p))                window._IDU_URL_ROLE = 'proktor';
})();

// ── 3. Proktor foydalanuvchisi ───────────────────────────────────
var _PROKTOR = {
  login: 'proktor',
  pass:  'proktor123',
  name:  'Sesiya Admini',
  role:  'Proktor',
  phone: ''
};



function _applyUrlRoleHint(role) {
  var names = {
    dekanat:  '🏛️ Dekanat sifatida kirish',
    teacher:  '👨‍🏫 Professor sifatida kirish',
    investor: '💼 Investor sifatida kirish',
    proktor:  '🔑 Proktor sifatida kirish'
  };
  // Hint elementi
  var hint = document.getElementById('_idu_role_hint');
  if (!hint) {
    hint = document.createElement('div');
    hint.id = '_idu_role_hint';
    hint.style.cssText = [
      'text-align:center',
      'padding:9px 16px',
      'background:linear-gradient(135deg,#EEF3FF,#DBEAFE)',
      'border-radius:10px',
      'font-size:13px',
      'color:#1B4FD8',
      'font-weight:700',
      'margin:12px 0',
      'border:1px solid #BFDBFE'
    ].join(';');
    var loginBtn = document.getElementById('loginSubmitBtn');
    if (loginBtn && loginBtn.parentNode) loginBtn.parentNode.insertBefore(hint, loginBtn);
  }
  hint.textContent = names[role] || role;
  // placeholder
  var lEl = document.getElementById('mainLogin');
  if (lEl && role !== 'proktor') lEl.placeholder = role.charAt(0).toUpperCase() + role.slice(1) + ' logini';
}

// ── 5. Login patch: proktor qo'llab-quvvatlash ──────────────────
(function patchLoginForProktor() {
  function _patch() {
    if (typeof window.realAutoLogin !== 'function') {
      return setTimeout(_patch, 300);
    }
    var _orig = window.realAutoLogin;
    window.realAutoLogin = async function() {
      var login = ((document.getElementById('mainLogin') || {}).value || '').trim();
      var pass  = ((document.getElementById('mainPass')  || {}).value || '').trim();

      if (login === _PROKTOR.login && pass === _PROKTOR.pass) {
        _loginAsProktor();
        return;
      }
      return _orig.apply(this, arguments);
    };
  }
  _patch();
})();

function _loginAsProktor() {
  var errEl = document.getElementById('mainLoginError');
  if (errEl) errEl.classList.remove('show');
  var btn = document.getElementById('loginSubmitBtn');
  if (btn) { btn.innerHTML = '<span>Kirish...</span>'; btn.disabled = true; }

  window.currentUser = _PROKTOR;
  window.currentRole = 'proktor';
  if (typeof _ssSet === 'function') _ssSet('idu_active_role', 'PRK_5xWt2nMv');
  if (typeof saveSession === 'function') saveSession('proktor', _PROKTOR);
  if (typeof closeLoginModalForce === 'function') closeLoginModalForce();

  var authScr = document.getElementById('authScreen');
  if (authScr) authScr.style.display = 'none';
  var app = document.getElementById('appScreen');
  if (app) { app.style.display = 'flex'; app.classList.add('visible'); }

  _setupProktorSidebar();
  if (typeof setupChip === 'function') setupChip('proktor', _PROKTOR);
  if (btn) { btn.innerHTML = '<span>Kirish</span><span style="font-size:16px">&rarr;</span>'; btn.disabled = false; }
  _renderProktorDashboard();
}

// ── 6. Proktor logout patch ─────────────────────────────────────
(function patchLogout() {
  function _patch() {
    if (typeof window.logout !== 'function') return setTimeout(_patch, 400);
    var _orig = window.logout;
    window.logout = function() {
      if (window.currentRole === 'proktor') {
        window.currentUser = null;
        window.currentRole = null;
        try { localStorage.removeItem('idu_session'); } catch(e) {}
        var app = document.getElementById('appScreen');
        if (app) { app.classList.remove('visible'); app.style.display = 'none'; }
        var auth = document.getElementById('authScreen');
        if (auth) auth.style.display = 'flex';
        if (typeof openLoginModal === 'function') openLoginModal();
        return;
      }
      _orig.apply(this, arguments);
    };
  }
  _patch();
})();

// ── 7. Dekanat navidan "Sesiya Boshqaruvi" ni olib tashlash ─────
(function removeDekanatSesiyaTab() {
  function _remove() {
    if (typeof NAV_TABS === 'undefined') return setTimeout(_remove, 400);
    if (NAV_TABS.dekanat) {
      NAV_TABS.dekanat = NAV_TABS.dekanat.filter(function(t) {
        return t.id !== 'dekanat-sesiya';
      });
    }
  }
  _remove();
})();

// ── 8. Proktor sidebar ───────────────────────────────────────────
function _setupProktorSidebar() {
  var sb = document.getElementById('appSidebar');
  if (!sb) return;
  sb.innerHTML =
    '<div class="sidebar-section">' +
      '<div class="sidebar-label">PROKTOR PANELI</div>' +
      '<button class="sidebar-item active" id="si-proktor-dashboard" onclick="_renderProktorDashboard()">' +
        '<span class="si-icon">🎛️</span><span class="si-text">Boshqaruv</span>' +
      '</button>' +
      '<button class="sidebar-item" id="si-proktor-results" onclick="_renderProktorResults()">' +
        '<span class="si-icon">📊</span><span class="si-text">Natijalar</span>' +
      '</button>' +
      '<button class="sidebar-item" id="si-proktor-etirozlar" onclick="_renderProktorEtirozlar()">' +
        '<span class="si-icon">⚠️</span><span class="si-text">E\'tirozlar</span>' +
      '</button>' +
    '</div>' +
    '<div class="sidebar-divider"></div>' +
    '<div style="padding:16px 12px">' +
      '<div style="padding:14px;background:linear-gradient(135deg,#FEF3C7,#FDE68A);border-radius:12px;border:1px solid #FCD34D">' +
        '<div style="font-size:11px;font-weight:800;color:#92400E;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px">🔑 Proktor</div>' +
        '<div style="font-size:13px;font-weight:700;color:#78350F">Sesiya Admini</div>' +
        '<div style="font-size:11px;color:#92400E;margin-top:3px">Sesiya boshqaruvchisi</div>' +
      '</div>' +
    '</div>';
}

// ── 9. Proktor sahifalari: helper ───────────────────────────────
function _getProktorPage(id) {
  var existing = document.getElementById('page-' + id);
  if (existing) {
    document.querySelectorAll('.page').forEach(function(p) { p.classList.remove('active'); });
    existing.classList.add('active');
    return existing;
  }
  // sahifa yaratish
  var container = document.querySelector('.pages-container') ||
                  document.querySelector('.main-content') ||
                  document.querySelector('#appScreen main') ||
                  document.getElementById('appScreen');
  if (!container) return null;
  var div = document.createElement('div');
  div.id = 'page-' + id;
  div.className = 'page active';
  document.querySelectorAll('.page').forEach(function(p) { p.classList.remove('active'); });
  container.appendChild(div);
  return div;
}

function _activeSidebarBtn(id) {
  document.querySelectorAll('.sidebar-item').forEach(function(b) { b.classList.remove('active'); });
  var btn = document.getElementById(id);
  if (btn) btn.classList.add('active');
}

// ── 10. Proktor Dashboard ────────────────────────────────────────
function _renderProktorDashboard() {
  _activeSidebarBtn('si-proktor-dashboard');
  var page = _getProktorPage('proktor-dashboard');
  if (!page) return;

  var testOn = (typeof SESIYA_STATE !== 'undefined') ? SESIYA_STATE.test : false;
  var realOn = (typeof SESIYA_STATE !== 'undefined') ? SESIYA_STATE.real : false;
  var etirazCount = _getEtirozList().filter(function(e){ return e.status === 'pending'; }).length;
  var totalTest = _getEtirozList().filter(function(e){ return e.type === 'etiraz'; }).length;

  page.innerHTML = [
    '<div style="padding:28px 32px;max-width:1000px">',

    // Header
    '<div style="margin-bottom:28px">',
      '<div style="display:flex;align-items:center;gap:14px">',
        '<div style="width:52px;height:52px;border-radius:14px;background:linear-gradient(135deg,#D97706,#F59E0B);display:flex;align-items:center;justify-content:center;font-size:24px;box-shadow:0 4px 14px rgba(217,119,6,0.3)">🔑</div>',
        '<div>',
          '<h2 style="font-size:22px;font-weight:900;color:#0F172A;letter-spacing:-0.3px">Sesiya va Test Boshqaruvi</h2>',
          '<p style="color:#64748B;font-size:13.5px;margin-top:2px">Proktor — imtihon sessiyalarini boshqaradi va natijalarni kuzatadi</p>',
        '</div>',
      '</div>',
    '</div>',

    // Stat cards
    '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:24px">',
      _pStatCard('Kutilayotgan e\'tirozlar', etirazCount, etirazCount > 0 ? '#DC2626' : '#16A34A', '⚠️', etirazCount > 0 ? '#FEE2E2' : '#DCFCE7'),
      _pStatCard('Jami e\'tirozlar', totalTest, '#7C3AED', '📋', '#EDE9FE'),
      _pStatCard('Faol imtihonlar', (testOn ? 1 : 0) + (realOn ? 1 : 0), '#0D9488', '🎯', '#CCFBF1'),
    '</div>',

    // Mode cards
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px">',
      _buildModeCard('test', testOn),
      _buildModeCard('real', realOn),
    '</div>',

    // Log
    '<div style="background:#fff;border-radius:16px;border:1.5px solid #E2E8F0;padding:22px;box-shadow:0 2px 12px rgba(0,0,0,0.04)">',
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">',
        '<div style="font-size:15px;font-weight:800;color:#0F172A">📋 Faoliyat jurnali</div>',
        '<button onclick="_clearProktorLog()" style="padding:5px 12px;background:#F8FAFC;border:1.5px solid #E2E8F0;border-radius:7px;font-size:11.5px;font-weight:600;color:#64748B;cursor:pointer;font-family:\'Outfit\',sans-serif">Tozalash</button>',
      '</div>',
      '<div id="proktorLog" style="display:flex;flex-direction:column;gap:8px;max-height:260px;overflow-y:auto">',
        '<div style="text-align:center;padding:24px;color:#94A3B8;font-size:13px">Hali harakatlar yo\'q</div>',
      '</div>',
    '</div>',

    '</div>'
  ].join('');
}

function _pStatCard(label, val, color, icon, bg) {
  return [
    '<div style="background:' + (bg||'#F8FAFC') + ';border-radius:14px;padding:18px 20px;border:1.5px solid ' + color + '22">',
      '<div style="display:flex;align-items:center;gap:10px">',
        '<div style="width:40px;height:40px;border-radius:10px;background:' + color + '20;display:flex;align-items:center;justify-content:center;font-size:18px">' + icon + '</div>',
        '<div>',
          '<div style="font-size:26px;font-weight:900;color:' + color + ';line-height:1;font-family:\'DM Mono\',monospace">' + val + '</div>',
          '<div style="font-size:11.5px;color:#64748B;margin-top:3px;font-weight:500">' + label + '</div>',
        '</div>',
      '</div>',
    '</div>'
  ].join('');
}

function _buildModeCard(type, active) {
  var isTest  = type === 'test';
  var icon    = isTest ? '🧪' : '📋';
  var title   = isTest ? 'Test Rejim' : 'Sesiya Rejim';
  var desc    = isTest ? 'Sinov imtihon — baholar hisoblanmaydi' : 'Rasmiy imtihon — baholar rasmiy qayd etiladi';
  var acColor = active ? '#16A34A' : '#D97706';
  var acBg    = active ? '#DCFCE7' : '#FEF3C7';
  var acText  = active ? '🟢 Faol' : '🔒 Qulflangan';
  var borderC = active ? '#86EFAC' : '#E2E8F0';
  var gradOpen   = isTest ? '#16A34A,#22C55E' : '#DC2626,#EF4444';
  var gradClose  = '#475569,#64748B';

  return [
    '<div style="background:#fff;border:2px solid ' + borderC + ';border-radius:16px;padding:24px;box-shadow:0 2px 12px rgba(0,0,0,0.04);transition:all 0.3s">',
      '<div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:14px">',
        '<div style="display:flex;align-items:center;gap:12px">',
          '<div style="width:48px;height:48px;border-radius:13px;background:linear-gradient(135deg,' + (active ? '#DCFCE7,#BBF7D0' : '#F1F5F9,#E2E8F0') + ');display:flex;align-items:center;justify-content:center;font-size:22px">' + icon + '</div>',
          '<div>',
            '<div style="font-size:16px;font-weight:800;color:#0F172A">' + title + '</div>',
            '<div style="font-size:12px;color:#64748B;margin-top:2px">' + desc + '</div>',
          '</div>',
        '</div>',
        '<span style="padding:5px 14px;border-radius:20px;font-size:12px;font-weight:700;background:' + acBg + ';color:' + acColor + '">' + acText + '</span>',
      '</div>',

      // Progress bar
      active ? '<div style="height:4px;background:#DCFCE7;border-radius:4px;margin-bottom:14px;overflow:hidden"><div style="height:100%;width:100%;background:linear-gradient(90deg,#16A34A,#22C55E);border-radius:4px;animation:progressPulse 2s ease-in-out infinite"></div></div>' : '<div style="height:4px;background:#F1F5F9;border-radius:4px;margin-bottom:14px"></div>',

      '<div style="display:flex;gap:10px">',
        active
          ? '<button onclick="proktorSetState(\'' + type + '\',false)" style="flex:1;padding:11px;background:linear-gradient(135deg,' + gradClose + ');color:white;border:none;border-radius:9px;font-family:\'Outfit\',sans-serif;font-size:13px;font-weight:700;cursor:pointer;transition:all 0.2s;box-shadow:0 3px 10px rgba(71,85,105,0.25)">🔒 Qulflash</button>'
          : '<button onclick="proktorSetState(\'' + type + '\',true)" style="flex:1;padding:11px;background:linear-gradient(135deg,' + gradOpen + ');color:white;border:none;border-radius:9px;font-family:\'Outfit\',sans-serif;font-size:13px;font-weight:700;cursor:pointer;transition:all 0.2s;box-shadow:0 3px 10px rgba(22,163,74,0.25)">✅ Ochish</button>',
      '</div>',
    '</div>'
  ].join('');
}

// ── 11. Proktor: sesiya/test holatini o'zgartirish ───────────────
window.proktorSetState = function(type, active) {
  if (typeof SESIYA_STATE !== 'undefined') SESIYA_STATE[type] = active;
  if (typeof setSesiyaState === 'function') setSesiyaState(type, active);

  var now  = new Date();
  var time = now.getHours().toString().padStart(2,'0') + ':' + now.getMinutes().toString().padStart(2,'0') + ':' + now.getSeconds().toString().padStart(2,'0');
  var label = type === 'test' ? 'Test Rejim' : 'Sesiya';
  var emoji = active ? '✅' : '🔒';
  var action= active ? 'faollashtirildi' : 'qulflandi';

  _addProktorLog(emoji, label + ' ' + action, time, active ? '#DCFCE7,#86EFAC,#16A34A' : '#FEE2E2,#FCA5A5,#DC2626');
  if (typeof showToast === 'function') showToast(emoji, label, active ? 'Talabalar kira oladi!' : 'Qulflandi. Talabalar kira olmaydi.');
  _renderProktorDashboard();
};

function _addProktorLog(emoji, msg, time, colors) {
  var log = document.getElementById('proktorLog');
  if (!log) return;
  var parts = (colors || '#DCFCE7,#86EFAC,#16A34A').split(',');
  var empty = log.querySelector('[style*="text-align:center"]');
  if (empty) empty.remove();

  var entry = document.createElement('div');
  entry.style.cssText = 'display:flex;align-items:center;gap:12px;padding:11px 14px;background:' + parts[0] + ';border-radius:10px;border:1px solid ' + (parts[1]||'#E2E8F0') + ';font-size:13px;animation:fadeSlide 0.3s ease';
  entry.innerHTML = '<span style="font-size:16px">' + emoji + '</span>' +
    '<span style="font-weight:600;color:#0F172A;flex:1">' + msg + '</span>' +
    '<span style="color:' + (parts[2]||'#64748B') + ';font-size:11px;font-family:\'DM Mono\',monospace;font-weight:700">' + time + '</span>';
  log.insertBefore(entry, log.firstChild);
}

window._clearProktorLog = function() {
  var log = document.getElementById('proktorLog');
  if (log) log.innerHTML = '<div style="text-align:center;padding:24px;color:#94A3B8;font-size:13px">Hali harakatlar yo\'q</div>';
};

// ── 12. Natijalar sahifasi ───────────────────────────────────────
function _renderProktorResults() {
  _activeSidebarBtn('si-proktor-results');
  var page = _getProktorPage('proktor-results');
  if (!page) return;

  var students = (typeof STUDENTS_DATA !== 'undefined') ? STUDENTS_DATA : [];

  var rows = students.map(function(s) {
    var grade = s.avg >= 86 ? {t:'A\'lo', c:'#16A34A', bg:'#DCFCE7'} :
                s.avg >= 71 ? {t:'Yaxshi', c:'#1D4ED8', bg:'#DBEAFE'} :
                s.avg >= 56 ? {t:'Qoniqarli', c:'#D97706', bg:'#FEF3C7'} :
                              {t:'Qoniqarsiz', c:'#DC2626', bg:'#FEE2E2'};
    return '<tr style="border-bottom:1px solid #F8FAFC;transition:background 0.15s" onmouseover="this.style.background=\'#F8FAFC\'" onmouseout="this.style.background=\'\'">' +
      '<td style="padding:12px 16px">' +
        '<div style="display:flex;align-items:center;gap:10px">' +
          '<div style="width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,#1B4FD8,#3B82F6);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;color:white">' +
            s.name.split(' ').map(function(x){return x[0];}).join('') +
          '</div>' +
          '<div><div style="font-weight:700;font-size:13.5px">' + s.name + '</div><div style="font-size:11px;color:#94A3B8">' + (s.group||'—') + '</div></div>' +
        '</div>' +
      '</td>' +
      '<td style="padding:12px 16px"><span style="padding:4px 10px;background:#EEF3FF;color:#1B4FD8;border-radius:6px;font-size:12px;font-weight:700">' + (s.group||'—') + '</span></td>' +
      '<td style="padding:12px 16px;text-align:center;font-family:\'DM Mono\',monospace;font-size:16px;font-weight:900;color:#1B4FD8">' + (s.avg||0) + '</td>' +
      '<td style="padding:12px 16px;text-align:center"><span style="padding:5px 12px;border-radius:20px;font-size:12px;font-weight:700;background:' + grade.bg + ';color:' + grade.c + '">' + grade.t + '</span></td>' +
      '<td style="padding:12px 16px;text-align:center">' +
        '<div style="display:flex;align-items:center;justify-content:center;gap:6px">' +
          '<div style="flex:1;height:6px;background:#F1F5F9;border-radius:3px;max-width:60px;overflow:hidden">' +
            '<div style="height:100%;border-radius:3px;background:' + (s.att>=90?'#16A34A':s.att>=80?'#D97706':'#DC2626') + ';width:' + (s.att||0) + '%"></div>' +
          '</div>' +
          '<span style="font-weight:700;color:' + (s.att>=90?'#16A34A':s.att>=80?'#D97706':'#DC2626') + ';font-size:13px">' + (s.att||0) + '%</span>' +
        '</div>' +
      '</td>' +
      '<td style="padding:12px 16px;text-align:center;font-family:\'DM Mono\',monospace;font-weight:800;color:#7C3AED">' + (s.gpa||'—') + '</td>' +
    '</tr>';
  }).join('');

  var avgScore = students.length ? Math.round(students.reduce(function(s,x){return s+(x.avg||0);},0)/students.length) : 0;
  var passPct  = students.length ? Math.round(students.filter(function(s){return (s.avg||0)>=56;}).length/students.length*100) : 0;

  page.innerHTML = [
    '<div style="padding:28px 32px;max-width:1000px">',

    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px">',
      '<div>',
        '<h2 style="font-size:22px;font-weight:900;color:#0F172A;letter-spacing:-0.3px">📊 Talabalar Natijalari</h2>',
        '<p style="color:#64748B;font-size:13.5px;margin-top:2px">Barcha talabalar ball va davomat statistikasi</p>',
      '</div>',
      '<div style="display:flex;gap:12px">',
        _pStatCard('O\'rt. ball', avgScore, '#1B4FD8', '📈', '#EEF3FF'),
        _pStatCard('O\'tdi', passPct + '%', '#16A34A', '✅', '#DCFCE7'),
      '</div>',
    '</div>',

    '<div style="background:#fff;border-radius:16px;border:1.5px solid #E2E8F0;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.04)">',
      '<table style="width:100%;border-collapse:collapse">',
        '<thead>',
          '<tr style="background:linear-gradient(135deg,#F8FAFC,#F1F5F9)">',
            '<th style="padding:13px 16px;text-align:left;color:#64748B;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;font-weight:700">Talaba</th>',
            '<th style="padding:13px 16px;text-align:left;color:#64748B;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;font-weight:700">Guruh</th>',
            '<th style="padding:13px 16px;text-align:center;color:#64748B;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;font-weight:700">Ball</th>',
            '<th style="padding:13px 16px;text-align:center;color:#64748B;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;font-weight:700">Baho</th>',
            '<th style="padding:13px 16px;text-align:center;color:#64748B;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;font-weight:700">Davomat</th>',
            '<th style="padding:13px 16px;text-align:center;color:#64748B;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;font-weight:700">GPA</th>',
          '</tr>',
        '</thead>',
        '<tbody>',
          rows || '<tr><td colspan="6" style="text-align:center;padding:40px;color:#94A3B8">Ma\'lumot yo\'q</td></tr>',
        '</tbody>',
      '</table>',
    '</div>',

    '</div>'
  ].join('');
}

// ── 13. E'tirozlar sahifasi ──────────────────────────────────────
function _renderProktorEtirozlar() {
  _activeSidebarBtn('si-proktor-etirozlar');
  var page = _getProktorPage('proktor-etirozlar');
  if (!page) return;

  var list = _getEtirozList();
  var pending  = list.filter(function(e){ return e.status === 'pending'; });
  var resolved = list.filter(function(e){ return e.status !== 'pending'; });

  function _eRow(e) {
    var stC = e.status==='approved' ? {t:'✅ Tasdiqlandi', c:'#16A34A', bg:'#DCFCE7'} :
              e.status==='rejected' ? {t:'❌ Rad etildi',  c:'#DC2626', bg:'#FEE2E2'} :
                                      {t:'⏳ Kutilmoqda',  c:'#D97706', bg:'#FEF3C7'};
    return '<div style="background:#fff;border:1.5px solid ' + (e.status==='pending'?'#FED7AA':'#E2E8F0') + ';border-radius:14px;padding:18px 20px;margin-bottom:10px;transition:all 0.2s">' +
      '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:14px;flex-wrap:wrap">' +
        '<div style="flex:1;min-width:0">' +
          '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">' +
            '<div style="width:34px;height:34px;border-radius:9px;background:linear-gradient(135deg,#7C3AED,#A78BFA);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;color:white;flex-shrink:0">' +
              (e.studentName||'T').charAt(0) +
            '</div>' +
            '<div>' +
              '<div style="font-weight:700;font-size:13.5px;color:#0F172A">' + (e.studentName||'Noma\'lum') + '</div>' +
              '<div style="font-size:11px;color:#94A3B8">' + (e.group||'—') + ' · ' + (e.date||'—') + '</div>' +
            '</div>' +
          '</div>' +
          '<div style="font-size:13px;font-weight:600;color:#1B4FD8;margin-bottom:6px">' + (e.detail||'—').substring(0,80) + '</div>' +
          (e.note ? '<div style="background:#FFF7ED;border:1px solid #FED7AA;border-radius:8px;padding:10px 12px;font-size:12.5px;color:#92400E;line-height:1.6"><strong>E\'tiroz sababi:</strong> ' + e.note + '</div>' : '') +
        '</div>' +
        '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px">' +
          '<span style="padding:5px 12px;border-radius:20px;font-size:11.5px;font-weight:700;background:' + stC.bg + ';color:' + stC.c + ';white-space:nowrap">' + stC.t + '</span>' +
          (e.status === 'pending' ? [
            '<div style="display:flex;gap:7px">',
              '<button onclick="_proktorApprove(' + e.id + ')" style="padding:7px 14px;background:linear-gradient(135deg,#16A34A,#22C55E);border:none;border-radius:8px;color:white;font-size:12px;font-weight:700;cursor:pointer;font-family:\'Outfit\',sans-serif">✅ Tasdiqlash</button>',
              '<button onclick="_proktorReject(' + e.id + ')" style="padding:7px 14px;background:linear-gradient(135deg,#DC2626,#EF4444);border:none;border-radius:8px;color:white;font-size:12px;font-weight:700;cursor:pointer;font-family:\'Outfit\',sans-serif">❌ Rad etish</button>',
            '</div>'
          ].join('') : '') +
        '</div>' +
      '</div>' +
    '</div>';
  }

  page.innerHTML = [
    '<div style="padding:28px 32px;max-width:900px">',

    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px">',
      '<div>',
        '<h2 style="font-size:22px;font-weight:900;color:#0F172A;letter-spacing:-0.3px">⚠️ Talaba E\'tirozlari</h2>',
        '<p style="color:#64748B;font-size:13.5px;margin-top:2px">Imtihon savollari bo\'yicha talabalar e\'tirozlari</p>',
      '</div>',
      '<div style="display:flex;gap:10px">',
        _pStatCard('Kutilmoqda', pending.length, '#D97706', '⏳', '#FEF3C7'),
        _pStatCard('Hal qilindi', resolved.length, '#16A34A', '✅', '#DCFCE7'),
      '</div>',
    '</div>',

    pending.length === 0 && resolved.length === 0
      ? '<div style="background:#fff;border:1.5px solid #E2E8F0;border-radius:16px;padding:48px;text-align:center">' +
          '<div style="font-size:48px;margin-bottom:14px">📭</div>' +
          '<div style="font-size:16px;font-weight:700;color:#0F172A">Hali e\'tiroz yo\'q</div>' +
          '<div style="font-size:13px;color:#94A3B8;margin-top:6px">Talabalar e\'tiroz yuborganida bu yerda ko\'rinadi</div>' +
        '</div>'
      : '',

    pending.length > 0
      ? '<div style="margin-bottom:22px"><div style="font-size:14px;font-weight:800;color:#0F172A;margin-bottom:12px;display:flex;align-items:center;gap:8px"><span style="padding:3px 10px;background:#FEF3C7;color:#D97706;border-radius:20px;font-size:12px">⏳ ' + pending.length + ' ta</span> Kutilayotgan e\'tirozlar</div>' + pending.map(_eRow).join('') + '</div>'
      : '',

    resolved.length > 0
      ? '<div><div style="font-size:14px;font-weight:800;color:#64748B;margin-bottom:12px;display:flex;align-items:center;gap:8px"><span style="padding:3px 10px;background:#DCFCE7;color:#16A34A;border-radius:20px;font-size:12px">✅ ' + resolved.length + ' ta</span> Hal qilingan e\'tirozlar</div>' + resolved.map(_eRow).join('') + '</div>'
      : '',

    '</div>'
  ].join('');
}

function _getEtirozList() {
  if (typeof APPLICATIONS === 'undefined') return [];
  return APPLICATIONS.filter(function(a){ return a.type === 'etiraz'; }).sort(function(a,b){ return b.id - a.id; });
}

window._proktorApprove = function(id) {
  var app = (typeof APPLICATIONS !== 'undefined') && APPLICATIONS.find(function(a){ return a.id === id; });
  if (app) { app.status = 'approved'; if (typeof saveApplications === 'function') saveApplications(); }
  if (typeof updateAppBadges === 'function') updateAppBadges();
  _renderProktorEtirozlar();
  if (typeof showToast === 'function') showToast('✅', 'Tasdiqlandi', 'E\'tiroz tasdiqlandi');
};

window._proktorReject = function(id) {
  var app = (typeof APPLICATIONS !== 'undefined') && APPLICATIONS.find(function(a){ return a.id === id; });
  if (app) { app.status = 'rejected'; if (typeof saveApplications === 'function') saveApplications(); }
  if (typeof updateAppBadges === 'function') updateAppBadges();
  _renderProktorEtirozlar();
  if (typeof showToast === 'function') showToast('❌', 'Rad etildi', 'E\'tiroz rad etildi');
};

// ── 14. CSS animatsiyalar qo'shish ───────────────────────────────
(function addStyles() {
  if (document.getElementById('_idu_enh_css')) return;
  var style = document.createElement('style');
  style.id = '_idu_enh_css';
  style.textContent = [
    '@keyframes fadeSlide{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:none}}',
    '@keyframes progressPulse{0%,100%{opacity:1}50%{opacity:0.6}}',
    '#proktorLog::-webkit-scrollbar{width:4px}',
    '#proktorLog::-webkit-scrollbar-thumb{background:#E2E8F0;border-radius:4px}',
  ].join('');
  document.head.appendChild(style);
})();

console.log('[IDU Enhancements v3.0] ✓ Loaded — Proktor, URL routing, Login fix');
