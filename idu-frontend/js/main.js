// ══════════════════════════════════════════════════════════════════
//  v18 — API CLIENT + SECURITY LAYER
// ══════════════════════════════════════════════════════════════════

// Backend base URL — change to your deployed server URL in production
var API_BASE = 'https://idu-platform-production.up.railway.app/api';

// JWT token storage (memory-first, localStorage fallback for "remember me")
var _apiToken = null;

// Load saved JWT on page load
// Load saved JWT on page load
(function() {
  try {
    var saved = localStorage.getItem('idu_jwt');

    if (saved) {
      _apiToken = saved;
    }
  } catch(e) {}
})();

// 🔥 TOKEN SAVE (REAL LOGIN)
function saveAuthToken(token) {
  if (!token) return;

  _apiToken = token;

  localStorage.setItem('idu_jwt', token);
  

  if (typeof setToken === 'function') {
    setToken(token);
  }
}

// 🔥 REAL BACKEND LOGIN
async function loginWithBackend(role, login, password) {
  const res = await fetch(API_BASE + '/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
  body: JSON.stringify({ login: login, password: password })
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok || !data.token) {
    throw new Error(data.error || 'Login yoki parol noto‘g‘ri');
  }

  saveAuthToken(data.token);
  return data.user || data;
}
window.realAutoLogin = async function realAutoLogin() {
  const login = document.getElementById('mainLogin').value.trim();
  const pass = document.getElementById('mainPass').value.trim();
  const errEl = document.getElementById('mainLoginError');
  const errMsg = document.getElementById('mainLoginErrorMsg');
  const btn = document.getElementById('loginSubmitBtn');

  function stopLoading(){ if(btn){ btn.innerHTML = '<span>Kirish</span><span style="font-size:16px">&rarr;</span>'; btn.disabled = false; } }
  function showErr(msg){ stopLoading(); if(errMsg) errMsg.textContent = msg; if(errEl) errEl.classList.add('show'); }

  if (!login) return showErr('Login kiriting');
  if (!pass) return showErr('Parol kiriting');
  if (btn) { btn.innerHTML = '<span>Kirish...</span>'; btn.disabled = true; }

  try {
    const user = await loginWithBackend('auto', login, pass);
    const role = user.role || 'student';
    currentUser = { login: user.login || login, name: user.name || user.full_name || login, role: role, group: user.group || 'AI-2301', gpa: 0, phone: user.phone || '' };
    currentRole = role;
    _ssSet('idu_active_role', ROLE_TOKENS[role]);
    saveSession(role, currentUser);
    setupSidebar(role);
    setupChip(role, currentUser);
    closeLoginModalForce();
    document.getElementById('authScreen').style.display = 'none';
    const app = document.getElementById('appScreen');
    app.style.display = 'flex';
    app.classList.add('visible');
    if (role === 'student') showPage('dashboard');
   else if (role === 'teacher') showPage('teacher-dashboard');
   else if (role === 'dekanat') showPage('dekanat-dashboard');
   else if (role === 'investor') showPage('investor-dashboard');
   else if (role === 'admin') showPage('dekanat-sesiya');
    stopLoading();
    return;
 
     } catch (e) {
    showErr(e.message || 'Login yoki parol noto‘g‘ri');
  }
};

// ════════════════════════════════════
//  DATA
// ════════════════════════════════════
// ════════════════════════════════════
//  XAVFSIZLIK: Rol tokenları (cross-role kirish taqiqlash)
// ════════════════════════════════════
const ROLE_TOKENS = {
  student: 'STU_7x9Kq2mP',
  teacher: 'TCH_4mNp8wRz',
  dekanat: 'DEK_9zRt3vYk',
  investor: 'INV_2bLs6jQx',
  admin: 'ADM_TEST_MANAGER'
};

const USERS = {
  student: [],
  teacher: [],
  dekanat: [],
  investor: [],
  admin: []
};


const DAYS_UZ_WEEK = ['Dushanba','Seshanba','Chorshanba','Payshanba','Juma'];
const DAYS_RU_WEEK = ['Понедельник','Вторник','Среда','Четверг','Пятница'];
const DAYS_SHORT_UZ = ['Du','Se','Ch','Pa','Ju'];
const DAYS_SHORT_RU = ['Пн','Вт','Ср','Чт','Пт'];
const TYPE_RU={"Ma'ruza":'Лекция','Laboratoriya':'Лаборатория','Amaliyot':'Практика','Seminar':'Семинар'};
// Keep backward compat
const DAYS = DAYS_UZ_WEEK;
const DAYS_SHORT = DAYS_SHORT_UZ;
const TIMES = [
  '08:30–10:00','10:15–11:45','12:30–14:00','14:15–15:45','16:00–17:30'
];

const SUBJECTS_COLORS = {
  // AI yo'nalishi
  'Machine Learning':'tt-purple','Python for AI':'tt-blue','Deep Learning':'tt-purple',
  'Matematika (AI uchun)':'tt-blue','Data Science':'tt-teal','Computer Vision':'tt-green',
  'Neural Networks':'tt-purple','Natural Language Processing':'tt-teal',
  // Cybersecurity yo'nalishi
  'Network Security':'tt-red','Ethical Hacking':'tt-red','Web Application Security':'tt-orange',
  'Kriptografiya':'tt-teal','Digital Forensics':'tt-orange','Cloud Security':'tt-blue',
  'IDS/IPS Tizimlari':'tt-red','Incident Response':'tt-orange',
  // Computing & IT yo'nalishi
  'Dasturlash Asoslari':'tt-purple',"Ma'lumotlar Tuzilmasi":'tt-blue','Algoritmlar':'tt-red',
  'Web Dasturlash':'tt-green',"Ma'lumotlar Bazasi":'tt-teal',
  'Kompyuter Tarmoqlari':'tt-blue','Operatsion Tizimlar':'tt-orange',
  'Software Engineering':'tt-purple','Cloud Computing':'tt-teal',
  // Digital Business yo'nalishi
  'Raqamli Marketing':'tt-orange','E-Tijorat':'tt-green','Biznes Analitika':'tt-blue',
  'Raqamli Transformatsiya':'tt-purple','Loyiha Boshqaruvi':'tt-teal',
  'Moliyaviy Texnologiyalar':'tt-orange','Tadbirkorlik':'tt-green',
  // Umumiy fanlar
  'Ingliz tili (Tech)':'tt-orange','Ingliz tili':'tt-orange',
  'Matematika':'tt-blue','Fizika':'tt-green','Algoritmlar va Dasturlash':'tt-red'
};

// Dars jadvali backend API dan olinadi
const SCHEDULE = {};
// Baholar backend API dan olinadi
const GRADES_DATA = [];

// ═══════════════════════════════════════════════════════════
// BARCHA MA'LUMOTLAR REAL API DAN OLINADI
// Bu massivlar bo'sh — dekanat paneli orqali kiritiladi
// ═══════════════════════════════════════════════════════════
const STUDENTS_DATA = [];
const TEACHERS_DATA = [];
const TASKS_DATA    = [];
const NOTIFS        = [];
let   IDEAS         = [];
const QUIZ_QUESTIONS = [];

// ════════════════════════════════════
//  STATE
// ════════════════════════════════════
let currentUser = null;
let currentRole = null;
let selectedRole = null;
let currentPage = '';
let quizIdx = 0, quizScore = 0, quizAnswered = false;
let ideaFormVisible = false;
let currentTTGroup = 'CS-2301';
let currentDekScheduleGroup = 'CS-2301';
// ── Backend URL (Railway production server) ──────────────────
// Eski: 'http://localhost:8000' → Railway deployga o'zgartirildi
const BACKEND_URL = 'https://idu-platform-production.up.railway.app';

// ── Xavfsiz storage (sandbox va private rejimda ham ishlaydi) ──
const _mem = {};
const _smem = {};

// ── XAVFSIZLIK: login urinishlar soni (brute-force himoyasi) ──
function recordFailedAttempt(key) {
  try {
    const data = JSON.parse(_lsGet('idu_lockout_' + key) || '{}');
    data.attempts = (data.attempts || 0) + 1;
    data.lastAttempt = Date.now();
    if (data.attempts >= MAX_ATTEMPTS) { data.lockedUntil = Date.now() + LOCKOUT_MS; data.attempts = 0; }
    _lsSet('idu_lockout_' + key, JSON.stringify(data));
  } catch(e) {}
}

// ════════════════════════════════════
//  OTP TIZIMI (ikki bosqichli tasdiqlash)
// ════════════════════════════════════
let _otpCode = null;
let _otpRole = null;
let _otpUser = null;
let _otpRemember = false;
let _otpPhone = null;
let _resendInterval = null;

function generateOTP() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function realLoginStart(role, loginInputId, passInputId, btnId) {
  const loginEl = document.getElementById(loginInputId);
  const passEl = document.getElementById(passInputId);

  const login = loginEl ? loginEl.value.trim() : '';
  const pass = passEl ? passEl.value.trim() : '';

  if (!login || !pass) {
    alert('Login va parolni kiriting');
    return;
  }

  try {
    _setLoginLoading(btnId, true);

    const user = await loginWithBackend(role, login, pass);

    const realRole = user.role || role;

    currentUser = {
      login: user.login || login,
      name: user.name || user.full_name || login,
      role: realRole,
      group: user.group || 'AI-2301',
      gpa: user.gpa || 0,
      phone: user.phone || ''
    };

    currentRole = realRole;

    _ssSet('idu_active_role', ROLE_TOKENS[realRole]);

    if (typeof saveSession === 'function') {
      saveSession(realRole, currentUser);
    }

    setupSidebar(realRole);
    setupChip(realRole, currentUser);

    const loginModal = document.getElementById('loginModal');
    if (loginModal) loginModal.style.display = 'none';

    const authScreen = document.getElementById('authScreen');
    if (authScreen) authScreen.style.display = 'none';

    const app = document.getElementById('appScreen');
    if (app) {
      app.style.display = 'flex';
      app.classList.add('visible');
    }

    if (realRole === 'student') showPage('dashboard');
    else if (realRole === 'teacher') showPage('teacher-dashboard');
    else if (realRole === 'dekanat') showPage('dekanat-dashboard');
    else if (realRole === 'investor') showPage('investor-dashboard');
    else if (realRole === 'admin') showPage('dekanat-sesiya');

  } catch (e) {
    alert(e.message || 'Login yoki parol noto‘g‘ri');
  } finally {
    _setLoginLoading(btnId, false);
  }
}

async function showOTPStep(role, user, phone, remember) {
  _otpRole = role;
  _otpUser = user;
  _otpRemember = remember;
  _otpPhone = phone;
  _otpCode = null;

  if (phone) {
    user.phone = '998' + phone;
    _lsSet('idu_phone_' + role + ':' + user.login, '998' + phone);
  }

  const fullPhone = '998' + phone;
  const masked = '+998 ' + phone.slice(0, 2) + ' *** ** ' + phone.slice(-2);

  const phoneShow = document.getElementById('otpPhoneShow');
  const demoBox = document.getElementById('otpDemoBox');
  const otpInput = document.getElementById('otpInput');
  const otpError = document.getElementById('otpError');

  if (phoneShow) phoneShow.textContent = masked;
  if (demoBox) demoBox.style.display = 'none';
  if (otpInput) otpInput.value = '';
  if (otpError) otpError.classList.remove('show');

  showStep('step-otp');

  try {
    const res = await fetch(BACKEND_URL + '/api/send-otp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        phone: fullPhone,
        purpose: 'login'
      })
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.detail || data.error || 'OTP yuborishda xato');
    }

    if (data.demo && data.demo_code) {
      _otpCode = data.demo_code;
    }

  } catch (e) {
    _otpCode = null;
    showToast('⚠️', 'SMS', 'Server bilan aloqa yo‘q');
  }
}

async function resendOTP() {
  if (!_otpPhone) {
    showToast('⚠️', 'SMS', 'Telefon raqam topilmadi');
    return;
  }

  const fullPhone = '998' + _otpPhone;

  const otpInput = document.getElementById('otpInput');
  const otpError = document.getElementById('otpError');
  const demoBox = document.getElementById('otpDemoBox');

  if (otpInput) otpInput.value = '';
  if (otpError) otpError.classList.remove('show');
  if (demoBox) demoBox.style.display = 'none';

  if (typeof startResendTimer === 'function') {
    startResendTimer();
  }

  try {
    const res = await fetch(BACKEND_URL + '/api/send-otp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        phone: fullPhone,
        purpose: 'login'
      })
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.detail || data.error || 'OTP yuborishda xato');
    }

    if (data.demo && data.demo_code) {
      _otpCode = data.demo_code;
    }

    showToast('✅', 'SMS', 'Kod qayta yuborildi');

  } catch (e) {
    _otpCode = null;
    showToast('⚠️', 'SMS', 'Server bilan aloqa yo‘q');
  }
}
// ── v18: API-first login with local USERS fallback ────────────────────────────

function _setLoginLoading(btnId, loading) {
  var btn = document.getElementById(btnId);
  if (!btn) return;
  btn.disabled = loading;
  btn.style.opacity = loading ? '0.6' : '1';
}

// ── Eski checkPhoneAndLaunch (endi ishlatilmaydi, qoldirildi) ──
let _pendingLaunchRole = null, _pendingLaunchUser = null;

// XAVFSIZLIK: Sahifaga kirish tekshiruvi (talaba dekanat oynasini ochishga urinsa)
function secureShowPage(pageId) {
  const dekanatPages = ['dekanat-dashboard','dekanat-schedule','dekanat-students','dekanat-teachers','dekanat-grades','dekanat-attendance','dekanat-applications','dekanat-questions','dekanat-report'];
  if (dekanatPages.includes(pageId)) {
    const role = currentUser && currentUser.role;
    // admin va dekanat dekanat sahifalarini ko'rishi mumkin
    if (role !== 'dekanat' && role !== 'admin') {
      showSecurityToast('Sizda bu bo\'limga kirish huquqi yo\'q!');
      return false;
    }
  }
  // dekanat-sesiya: faqat admin va proktor
  if (pageId === 'dekanat-sesiya') {
    const role = currentUser && currentUser.role;
    if (role !== 'admin' && role !== 'proktor' && role !== 'dekanat') {
      showSecurityToast('Sizda bu bo\'limga kirish huquqi yo\'q!');
      return false;
    }
  }
  return true;
}

// ── Mobile sidebar helpers (v18) ──────────────────────────────────────────────
function toggleMobileSidebar() {
  var sb   = document.querySelector('.sidebar');
  var bd   = document.getElementById('sidebarBackdrop');
  if (!sb) return;
  var open = sb.classList.toggle('mobile-open');
  if (bd) bd.classList.toggle('active', open);
}
// Close mobile sidebar when a nav item is tapped
var _origShowPage = typeof showPage === 'function' ? showPage : null;
document.addEventListener('DOMContentLoaded', function() {
  // Patch showPage after it's defined to close sidebar on mobile
  var __origSP = window.showPage;
  if (__origSP) {
    window.showPage = function(p) {
      closeMobileSidebar();
      __origSP(p);
    };
  }
});

// ── Xavfsizlik toast xabari (original showToast dan alohida) ──
function showSecurityToast(msg) {
  showToast('🔒', 'Xavfsizlik', msg);
}

// ════════════════════════════════════
//  PAROLNI UNUTDIM funksiyalari
// ════════════════════════════════════
let _fpRole = null, _fpUser = null, _fpOtp = null;
function showFpStep1() {
  ['fp-step1','fp-step2','fp-step3','fp-step4'].forEach(id => document.getElementById(id).style.display = 'none');
  document.getElementById('fp-step1').style.display = 'block';
}
async function sendForgotOTP() {
  const rawPhone = document.getElementById('fpPhone').value.trim().replace(/\D/g,'');
  const fullPhone = '998' + rawPhone;

  // Foydalanuvchini topish (lokal)
  let found = null, foundRole = _fpRole;
  const searchRoles = _fpRole ? [_fpRole] : Object.keys(USERS);
  for (const r of searchRoles) {
    const u = (USERS[r]||[]).find(x => {
      const stored = _lsGet('idu_phone_' + r + ':' + x.login);
      return (x.phone === fullPhone) || (stored === fullPhone);
    });
    if (u) { found = u; foundRole = r; break; }
  }
  if (!found) { document.getElementById('fpError').style.display = 'flex'; return; }
  document.getElementById('fpError').style.display = 'none';
  _fpUser = found; _fpRole = foundRole;

  const masked = '+998 ' + rawPhone.slice(0,2) + ' *** ** ' + rawPhone.slice(-2);
  document.getElementById('fpPhoneDisplay').textContent = masked;
  document.getElementById('fpOtpDemo').style.display = 'none';

  // Backend ga OTP so'rovi
  try {
    const res = await fetch(BACKEND_URL + '/api/forgot-send', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ phone: fullPhone, role: foundRole, login: found.login })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Xato');
    if (data.demo && data.demo_code) {
      _fpOtp = data.demo_code;
      document.getElementById('fpOtpDemo').textContent = _fpOtp;
      document.getElementById('fpOtpDemo').style.display = 'block';
    }

    
  } catch(e) {
    _fpOtp = null;
    showToast('⚠️', 'SMS', 'Server bilan aloqa yo‘q');
  }
  try {
    const fullPhone = '998' + document.getElementById('fpPhone').value.trim().replace(/\D/g,'');
    const res = await fetch(BACKEND_URL + '/api/forgot-verify', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ phone: fullPhone, code: entered, purpose: 'forgot' })
    });
    const data = await res.json();
    if (!res.ok) { document.getElementById('fpOtpError').style.display='block'; return; }

    // Yangi credentials backenddan keldi
    setPassOverride(_fpRole, _fpUser.login, data.new_password);
    document.getElementById('fpNewLogin').textContent = data.login;
    document.getElementById('fpCredPass').textContent = data.new_password;
    ['fp-step1','fp-step2','fp-step3','fp-step4'].forEach(id => document.getElementById(id).style.display='none');
    document.getElementById('fp-step4').style.display = 'block';
    showToast('✅', 'Ma\'lumotlar tayyor', 'Yangi parol SMS ga yuborildi!');

  } catch(e) {
    // Fallback: lokal tekshirish
    if (entered !== _fpOtp) { document.getElementById('fpOtpError').style.display='block'; return; }
    document.getElementById('fpOtpError').style.display='none';
    generateNewCredentialsLocal();
  }
}

// ════════════════════════════════════
//  NAV
// ════════════════════════════════════
const NAV_TABS = {
  student: [
    {id:'dashboard',icon:'🏠',label:'Bosh sahifa',labelRu:'Главная'},
    {id:'timetable',icon:'📅',label:'Jadval',labelRu:'Расписание'},
    {id:'grades',icon:'📊',label:'Baholar',labelRu:'Оценки'},
    {id:'tasks',icon:'📝',label:'Vazifalar',labelRu:'Задания',badge:5},
    {id:'startup',icon:'🚀',label:'Startup',labelRu:'Стартап'},
    {id:'rating',icon:'🏆',label:'Reyting',labelRu:'Рейтинг'},
    {id:'aitutor',icon:'🤖',label:'AI Tutor',labelRu:'AI Репетитор'},
    {id:'professors',icon:'⭐',label:'Ustozlar',labelRu:'Преподаватели'},
    {id:'notifications',icon:'🔔',label:'Xabarlar',labelRu:'Уведомления',badge:3},
    {id:'sesiya-test',icon:'🧪',label:'Test Rejim',labelRu:'Пробный экзамен'},
    {id:'sesiya-real',icon:'📝',label:'Sesiya',labelRu:'Сессия'},
  ],
  teacher: [
    {id:'teacher-dashboard',icon:'🏠',label:'Bosh sahifa',labelRu:'Главная'},
    {id:'teacher-timetable',icon:'📅',label:'Mening jadvalim',labelRu:'Моё расписание'},
    {id:'teacher-students',icon:'👥',label:'Talabalar',labelRu:'Студенты'},
    {id:'teacher-grade',icon:'✏️',label:'Baholash',labelRu:'Оценивание'},
    {id:'teacher-attendance',icon:'📋',label:'Davomat',labelRu:'Посещаемость'},
    {id:'teacher-assignments',icon:'📝',label:'Vazifalar',labelRu:'Задания'},
    {id:'startup',icon:'🚀',label:'Startup',labelRu:'Стартап'},
    {id:'notifications',icon:'🔔',label:'Xabarlar',labelRu:'Уведомления',badge:2},
  ],
  dekanat: [
    {id:'dekanat-dashboard',icon:'🏛️',label:'Bosh sahifa',labelRu:'Главная'},
    {id:'dekanat-schedule',icon:'📅',label:'Jadval',labelRu:'Расписание'},
    {id:'dekanat-students',icon:'🎓',label:'Talabalar',labelRu:'Студенты'},
    {id:'dekanat-teachers',icon:'👨‍🏫',label:'O\'qituvchilar',labelRu:'Преподаватели'},
    {id:'dekanat-grades',icon:'📊',label:'Baholar',labelRu:'Оценки'},
    {id:'dekanat-attendance',icon:'📋',label:'Davomat',labelRu:'Посещаемость'},
    {id:'startup',icon:'🚀',label:'Startup',labelRu:'Стартап'},
    {id:'dekanat-applications',icon:'📬',label:'Arizalar',labelRu:'Заявки',badge:0,badgeId:'dekAppBadge'},
    {id:'dekanat-questions',icon:'📝',label:'Savollar',labelRu:'Вопросы'},
    {id:'dekanat-report',icon:'📈',label:'Hisobotlar',labelRu:'Отчёты'},
    // Sesiya Boshqaruvi olib tashlandi — bu funksiya Proktor roli uchun
    // {id:'dekanat-sesiya',icon:'🗝️',label:'Sesiya Boshqaruvi',labelRu:'Управление сессией'},
  ],
  investor: [
    {id:'investor-dashboard',icon:'💼',label:'Dashboard',labelRu:'Дашборд'},
    {id:'startup',icon:'🚀',label:'Startup G\'oyalar',labelRu:'Стартап-идеи'},
  ],
  admin: [
  {id:'dekanat-sesiya',icon:'🗝️',label:'Test/Sesiya boshqaruvi',labelRu:'Управление тестом'},
  {id:'dekanat-questions',icon:'📝',label:'Test savollari',labelRu:'Вопросы'},
  {id:'dekanat-report',icon:'📈',label:'Natijalar',labelRu:'Результаты'},
  {id:'notifications',icon:'🔔',label:'Xabarlar',labelRu:'Уведомления'}
],
};
function setupSidebar(role){
  const base = NAV_TABS[role] || [];
  const extra = (typeof NAV_EXTRA!=='undefined' && NAV_EXTRA[role]) ? NAV_EXTRA[role] : [];
  const isRu = currentLang==='ru';
  let html = '';
  if(role==='dekanat'){
    const sections = [
      {label:isRu?'ОСНОВНОЕ':'ASOSIY',items:base.slice(0,2)},
      {label:isRu?'ДАННЫЕ':"MA'LUMOTLAR",items:base.slice(2,6)},
      {label:isRu?'ДРУГОЕ':'BOSHQA',items:base.slice(6)}
    ];
    html = sections.map(sec=>`
      <div class="sidebar-section">
        <div class="sidebar-label">${sec.label}</div>
        ${sec.items.map(it=>`
          <button class="sidebar-item" onclick="showPage('${it.id}')" id="si-${it.id}">
            <span class="si-icon">${it.icon}</span>
            <span class="si-text">${_tl(it)}</span>
            ${it.badge?`<span class="si-badge">${it.badge}</span>`:''}
          </button>`).join('')}
      </div>`).join('');
  } else {
    html = `<div class="sidebar-section"><div class="sidebar-label">${isRu?'МЕНЮ':'MENYU'}</div>
      ${base.map(it=>`
        <button class="sidebar-item" onclick="showPage('${it.id}')" id="si-${it.id}">
          <span class="si-icon">${it.icon}</span>
          <span class="si-text">${_tl(it)}</span>
          ${it.badge?`<span class="si-badge">${it.badge}</span>`:''}
        </button>`).join('')}
    </div>`;
  }
  if(extra.length){
    html += `<div class="sidebar-divider"></div>
    <div class="sidebar-section"><div class="sidebar-label">${isRu?'ДОПОЛНИТЕЛЬНО':"QO'SHIMCHA"}</div>
      ${extra.map(it=>`
        <button class="sidebar-item" onclick="showPage('${it.id}')" id="si-${it.id}">
          <span class="si-icon">${it.icon}</span>
          <span class="si-text">${_tl(it)}</span>
        </button>`).join('')}
    </div>`;
  }
  if(role==='student'){
    html += `<div class="sidebar-divider"></div>
    <div style="padding:10px;background:var(--bg);border-radius:var(--r);border:1px solid var(--border)">
      <div style="font-size:10px;color:var(--text3);font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px">${isRu?'УРОВЕНЬ':'DARAJA'}</div>
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
        <div style="width:28px;height:28px;border-radius:7px;background:linear-gradient(135deg,var(--purple),#A78BFA);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;color:white" id="sidebarLevel">1</div>
        <div style="flex:1"><div style="font-size:12px;font-weight:600" id="sidebarLevelName">Yangi boshlovchi</div></div>
      </div>
      <div class="xp-bar-wrap"><div class="xp-bar-fill" id="sidebarXPBar" style="width:0%"></div></div>
      <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--text3);margin-top:3px">
        <span id="sidebarXP">0 XP</span>
        <div class="coin-badge" style="font-size:10px;padding:1px 7px" id="sidebarCoins">🪙 0</div>
      </div>
    </div>`;
  }
  document.getElementById('appSidebar').innerHTML = html;
}
function showPage(id){
  // XAVFSIZLIK: dekanat sahifalariga ruxsatsiz kirishni bloklash
  if (!secureShowPage(id)) return;
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  const pg=document.getElementById('page-'+id);
  if(pg) pg.classList.add('active');
  currentPage=id;
  document.querySelectorAll('.topnav-tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.sidebar-item').forEach(t=>t.classList.remove('active'));
  const tab=document.getElementById('tab-'+id);
  if(tab) tab.classList.add('active');
  const si=document.getElementById('si-'+id);
  if(si) si.classList.add('active');
  // Lazy render — original pages
  if(id==='dashboard') renderStudentDashboard();
  else if(id==='timetable') renderTimetable();
  else if(id==='teacher-timetable') renderTeacherTimetable();
  else if(id==='grades') { renderGrades(); }
  else if(id==='tasks') renderTasks();
  else if(id==='materials') renderMaterials();
  else if(id==='rating') renderRating();
  else if(id==='notifications') renderNotifications();
  else if(id==='startup') renderIdeas();
  else if(id==='teacher-students') renderStudentList();
  else if(id==='teacher-grade') loadGradeGroup();
  else if(id==='teacher-attendance') initAttendance();
  else if(id==='teacher-assignments') renderTeacherAssignments();
  else if(id==='tasks') renderStudentAssignments();
  else if(id==='dekanat-students') renderDekanatStudents();
  else if(id==='dekanat-teachers') renderDekanatTeachers();
  else if(id==='dekanat-schedule') renderDekanatSchedule();
  else if(id==='dekanat-grades') renderDekanatGrades();
  else if(id==='dekanat-attendance') renderDekanatAttendance();
  else if(id==='dekanat-report') renderFullReport();
  else if(id==='dekanat-groups') renderGroupsPage();
  else if(id==='dekanat-applications') renderDekanatApplications();
  else if(id==='dekanat-questions') renderDekanatQuestions();
  else if(id==='my-applications') renderMyApplications();
  else if(id==='dekanat-dashboard') renderDekanatDashboard();
  else if(id==='investor-dashboard') renderInvestorDashboard();
  else if(id==='sesiya-test') renderSesiyaTest();
  else if(id==='sesiya-real') renderSesiyaReal();
  else if(id==='dekanat-sesiya') renderDekanatSesiya();
  // Lazy render — addon pages
  else if(id==='games') { if(typeof renderGameHub==='function') renderGameHub(); }
  else if(id==='gamification') { if(typeof renderGamification==='function') renderGamification(); }
  else if(id==='time') { if(typeof renderTimePage==='function') renderTimePage(); }
  else if(id==='idu-premium') { if(typeof renderPremiumPage==='function') renderPremiumPage(); }
  else if(id==='professors') { if(typeof renderProfessorsPage==='function') renderProfessorsPage(); }
}

// ════════════════════════════════════
//  DATES & INIT
// ════════════════════════════════════
const MONTHS_UZ=['Yanvar','Fevral','Mart','Aprel','May','Iyun','Iyul','Avgust','Sentabr','Oktabr','Noyabr','Dekabr'];
const MONTHS_RU=['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
const DAYS_UZ=['Yakshanba','Dushanba','Seshanba','Chorshanba','Payshanba','Juma','Shanba'];
const DAYS_RU=['Воскресенье','Понедельник','Вторник','Среда','Четверг','Пятница','Суббота'];

// ════════════════════════════════════
//  TIMETABLE (EduPage style)
// ════════════════════════════════════
function renderTimetable(){
  const grp = currentUser&&currentUser.group ? currentUser.group : 'AI-2301';
  currentTTGroup = grp;
  // Update week label
  const offset = ttWeekOffset || 0;
  const baseDate = new Date();
  const dow = baseDate.getDay();
  const monday = new Date(baseDate);
  monday.setDate(baseDate.getDate() - (dow===0?6:dow-1) + offset*7);
  const friday = new Date(monday); friday.setDate(monday.getDate()+4);
  const months=_months();
  const isRuLbl = currentLang==='ru';
  const lbl = document.getElementById('ttWeekLabel');
  if(lbl){
    const range=`${monday.getDate()} ${months[monday.getMonth()]} – ${friday.getDate()} ${months[friday.getMonth()]}`;
    if(offset===0) lbl.textContent=isRuLbl?`Текущая неделя: ${range}`:`Joriy hafta: ${range}`;
    else if(offset<0) lbl.textContent=isRuLbl?`${Math.abs(offset)} нед. назад: ${range}`:`${Math.abs(offset)} hafta oldin: ${range}`;
    else lbl.textContent=isRuLbl?`Через ${offset} нед.: ${range}`:`${offset} hafta keyin: ${range}`;
  }
  buildTTTable('ttHead','ttBody',grp,false);
  buildTTLegend(grp);
  renderWeekNav();
}

// Week offset for student timetable
let ttWeekOffset = 0;
function renderRoomStatus(grp){
  const el=document.getElementById('roomStatusGrid');if(!el)return;
  const rooms=['Lab-AI','Lab-CS','Lab-IT','A-101','A-102','A-201','A-202','A-301','B-101','B-201','B-301'];
  const sched=SCHEDULE[grp]||[];
  const busyRooms=new Set(sched.flat().filter(Boolean).map(l=>l.room));
  el.innerHTML=rooms.map(room=>{
    const busy=busyRooms.has(room);
    return`<div style="padding:10px 12px;border-radius:var(--r);border:1.5px solid ${busy?'#86EFAC':'var(--border)'};background:${busy?'var(--green-light)':'var(--bg)'}">
      <div style="font-size:12px;font-weight:700;color:${busy?'var(--green)':'var(--text2)'}">${room}</div>
      <div style="font-size:10px;margin-top:3px;color:${busy?'var(--green)':'var(--text3)'}">${busy?'🔴 Band':'🟢 Bo\'sh'}</div>
    </div>`;
  }).join('');
}

// ════════════════════════════════════
//  STUDENT DASHBOARD — API-driven
// ════════════════════════════════════
var _dashLoaded = false;

async function renderStudentDashboard() {
  // Skeleton ko'rsatish
  _setDashSkeleton();

  // Bugungi sana
  var dateEl = document.getElementById('dashDate');
  if (dateEl) {
    var now = new Date();
    var days = ['Yakshanba','Dushanba','Seshanba','Chorshanba','Payshanba','Juma','Shanba'];
    var months = ['Yanvar','Fevral','Mart','Aprel','May','Iyun','Iyul','Avgust','Sentabr','Oktabr','Noyabr','Dekabr'];
    dateEl.textContent = days[now.getDay()] + ', ' + now.getDate() + ' ' + months[now.getMonth()] + ' ' + now.getFullYear();
  }

  // Jadval va vazifalar (lokal)
  renderDashboardSchedule();
  renderDashboardTasks();

  // API dan baholar va statistika
  try {
    var stats = await api('GET', '/grades/my-stats');
    _updateDashStats(stats);
    _dashLoaded = true;
  } catch(e) {
    _updateDashStats(null);
  }

  // So'nggi baholar
  try {
    var data = await api('GET', '/grades/my');
    _renderRecentGrades(data.grades || []);
    if (data.gpa) {
      var gpaEl = document.querySelector('#page-dashboard .stat-card-val');
      if (gpaEl) {
        gpaEl.textContent = parseFloat(data.gpa).toFixed(2);
        gpaEl.style.color = data.gpa >= 3.5 ? 'var(--green)' : data.gpa >= 2.5 ? 'var(--primary)' : 'var(--orange)';
      }
    }
  } catch(e) {
    _renderRecentGrades([]);
  }
}

function _setDashSkeleton() {
  // Stat kartlar — skeleton
  document.querySelectorAll('#page-dashboard .stat-card-val').forEach(function(el) {
    el.innerHTML = '<span class="skel skel-line" style="width:60px;height:28px;display:inline-block"></span>';
  });
  // Jadval — skeleton
  var ts = document.getElementById('todaySchedule');
  if (ts) ts.innerHTML = [1,2,3].map(function() {
    return '<div style="display:flex;gap:10px;margin-bottom:10px">' +
      '<div class="skel" style="width:4px;height:60px;border-radius:4px"></div>' +
      '<div style="flex:1"><div class="skel skel-line" style="width:70%;margin-bottom:6px"></div>' +
      '<div class="skel skel-line" style="width:50%"></div></div></div>';
  }).join('');
  // Grades — skeleton
  var gb = document.getElementById('recentGradesBody');
  if (gb) gb.innerHTML = [1,2,3].map(function() {
    return '<tr>' + [1,2,3,4,5,6,7].map(function() {
      return '<td><div class="skel skel-line" style="width:' + (Math.random()*30+40).toFixed(0) + 'px"></div></td>';
    }).join('') + '</tr>';
  }).join('');
}

function _updateDashStats(stats) {
  var cards = document.querySelectorAll('#page-dashboard .stat-card');
  if (!cards.length) return;

  // GPA card (index 0) — from grades/my endpoint
  // Umumiy ball card (index 1)
  var totalCard = cards[1] ? cards[1].querySelector('.stat-card-val') : null;
  if (totalCard) {
    if (stats && stats.total_courses > 0) {
      totalCard.textContent = stats.avg_total ? Math.round(stats.avg_total) : '—';
      totalCard.style.color = 'var(--green)';
    } else {
      totalCard.innerHTML = '<span style="font-size:14px;color:var(--text3)">Ma\'lumot yo\'q</span>';
    }
  }
  var totalChange = cards[1] ? cards[1].querySelector('.stat-card-change') : null;
  if (totalChange && stats) {
    totalChange.textContent = (stats.total_courses || 0) + ' ta fan';
    totalChange.className = 'stat-card-change sc-flat';
  }

  // A'lo baholar (reyting o'rni o'rniga)
  var ratingCard = cards[2] ? cards[2].querySelector('.stat-card-val') : null;
  var ratingLabel = cards[2] ? cards[2].querySelector('.stat-card-label') : null;
  if (ratingLabel) ratingLabel.textContent = 'A\'lo baholar';
  if (ratingCard) {
    if (stats && stats.a_count > 0) {
      ratingCard.textContent = stats.a_count + ' ta';
      ratingCard.style.color = 'var(--green)';
    } else {
      ratingCard.textContent = '0 ta';
      ratingCard.style.color = 'var(--text3)';
    }
  }
  var ratingChange = cards[2] ? cards[2].querySelector('.stat-card-change') : null;
  if (ratingChange) {
    ratingChange.textContent = '86+ ball';
    ratingChange.className = 'stat-card-change sc-flat';
  }
}

function _renderRecentGrades(grades) {
  var tbody = document.getElementById('recentGradesBody');
  if (!tbody) return;
  if (!grades.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--text3)">' +
      '<div style="font-size:28px;margin-bottom:6px">📊</div>' +
      '<div style="font-size:13px">Hali baholar kiritilmagan</div>' +
      '<div style="font-size:11px;color:var(--text3);margin-top:4px">O\'qituvchi baholarni kiritganda bu yerda ko\'rinadi</div>' +
    '</td></tr>';
    return;
  }
  var recent = grades.slice(0, 5);
  tbody.innerHTML = recent.map(function(g) {
    var total = Number(g.total) || 0;
    var grade = total >= 86 ? {l:'A',c:'var(--green)'} : total >= 71 ? {l:'B',c:'var(--primary)'} :
                total >= 56 ? {l:'C',c:'var(--orange)'} : {l:'F',c:'var(--red)'};
    return '<tr>' +
      '<td style="font-weight:600;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + (g.course_name || '—') + '</td>' +
      '<td style="text-align:center">' + (g.jn || 0) + '</td>' +
      '<td style="text-align:center">' + (g.on_score || 0) + '</td>' +
      '<td style="text-align:center">' + (g.yn || 0) + '</td>' +
      '<td style="text-align:center">' + (g.mi || 0) + '</td>' +
      '<td style="text-align:center;font-weight:700">' + total + '</td>' +
      '<td style="text-align:center"><span style="padding:2px 8px;border-radius:6px;font-weight:800;font-size:12px;background:' + grade.c + '20;color:' + grade.c + '">' + grade.l + '</span></td>' +
    '</tr>';
  }).join('');
}

function renderDashboardTasks() {
  var el = document.getElementById('upcomingTasks');
  if (!el) return;
  if (!TASKS_DATA.length) {
    el.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text3)">' +
      '<div style="font-size:24px;margin-bottom:6px">✅</div>' +
      '<div style="font-size:13px">Vazifalar yo\'q</div>' +
      '<div style="font-size:11px;margin-top:4px">O\'qituvchi vazifa berganda bu yerda ko\'rinadi</div>' +
    '</div>';
    return;
  }
  var urgent = TASKS_DATA.filter(function(t) { return t.urgent || t.status === 'pending'; }).slice(0, 4);
  el.innerHTML = urgent.map(function(t) {
    return '<div style="padding:10px 0;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px">' +
      '<div style="width:8px;height:8px;border-radius:50%;background:' + (t.urgent ? 'var(--red)' : 'var(--orange)') + ';flex-shrink:0"></div>' +
      '<div style="flex:1"><div style="font-size:13px;font-weight:600;color:var(--text1)">' + (t.title || t.name) + '</div>' +
      '<div style="font-size:11px;color:var(--text3)">' + (t.due || t.subject || '') + '</div></div>' +
      '</div>';
  }).join('');
}

// ════════════════════════════════════
//  DASHBOARD WIDGETS
// ════════════════════════════════════
function renderDashboardSchedule(){
  const el=document.getElementById('todaySchedule');if(!el)return;
  const grp=currentUser?.group||'CS-2301';
  const today=new Date().getDay()-1;
  const todayIdx=Math.max(0,Math.min(today,4));
  const lessons=(SCHEDULE[grp]||[])[todayIdx]||[];
  const items=lessons.map((l,i)=>l?`
    <div class="sched-item${i===1?' now':''}">
      ${i===1?`<div class="sched-now-label">${currentLang==='ru'?'СЕЙЧАС':'HOZIR'}</div>`:''}
      <div class="sched-stripe" style="background:${getDotColor(l.sub)}"></div>
      <div class="sched-time">${TIMES[i]}</div>
      <div class="sched-body">
        <div class="sched-name">${l.sub}</div>
        <div class="sched-meta">
          <span>👨‍🏫 ${l.teacher}</span>
          <span class="sched-room-tag">🚪 ${l.room}</span>
          <span style="font-size:10.5px;color:var(--text3)">${_type(l.type)}</span>
        </div>
      </div>
    </div>`:'').filter(Boolean).join('');
  const noClass = currentLang==='ru'?'Сегодня нет занятий':'Bugun dars yo\'q';
  el.innerHTML=items||`<div class="empty-state"><div class="empty-state-icon">😴</div><div>${noClass}</div></div>`;
}
let _stGradeFilter='all';

// ════════════════════════════════════
//  MATERIALS
// ════════════════════════════════════
const MATERIALS=[
  {sub:'Dasturlash',title:'Python OOP — 6-ma\'ruza',type:'lecture',icon:'📄',size:'2.4 MB'},
  {sub:'Matematika',title:'Integral hisoblash video',type:'video',icon:'🎥',size:'145 MB'},
  {sub:'Ingliz tili',title:'Business English — PDF',type:'pdf',icon:'📑',size:'1.8 MB'},
  {sub:'Fizika',title:'Elektromagnetizm — ma\'ruza',type:'lecture',icon:'📄',size:'3.1 MB'},
  {sub:'Algoritmlar',title:'Sorting algoritmlar video',type:'video',icon:'🎥',size:'98 MB'},
  {sub:'Matematika',title:'Algebra formulalar jadvali',type:'pdf',icon:'📑',size:'0.5 MB'},
];
const SAVED_GRADES={};
let _curSub='Machine Learning';
let _curGrp='AI-2301';
// Dynamic groups list (starts with defaults, dekanat can add more)
// Guruhlar dekanat paneli orqali kiritiladi
let GROUPS_LIST = [];

function getGroupNames(){ return GROUPS_LIST.map(g=>g.name); }

// ── GROUPS PAGE ──
function renderGroupsPage(){
  renderGroupsOverview();
  renderGroupsStudentTable();
  populateMoveSelects();
}
function renderGroupsOverview(){
  const el=document.getElementById('groupsOverviewGrid');if(!el)return;
  el.innerHTML=GROUPS_LIST.map(g=>{
    const count=STUDENTS_DATA.filter(s=>s.group===g.name).length||g.count;
    const avg=STUDENTS_DATA.filter(s=>s.group===g.name).reduce((a,s)=>a+s.avg,0)/Math.max(1,STUDENTS_DATA.filter(s=>s.group===g.name).length)||0;
    const colors={'Sun\'iy Intellekt':'var(--purple)','Kiberxavfsizlik':'var(--red)','Computing & IT':'var(--primary)','Digital Business':'var(--orange)'};
    const color=colors[g.dir]||'var(--primary)';
    return`<div class="card" style="border-left:4px solid ${color};padding:18px 20px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <div style="font-size:18px;font-weight:800;color:${color}">${g.name}</div>
        <div style="display:flex;gap:6px">
          <button class="btn btn-sm btn-secondary" onclick="openEditGroupModal('${g.name}')" title="Tahrirlash">✏️</button>
          <button class="btn btn-sm" style="background:var(--red-light);color:var(--red);border:1px solid #FCA5A5" onclick="deleteGroup('${g.name}')" title="O'chirish">🗑️</button>
        </div>
      </div>
      <div style="font-size:12px;color:var(--text2);margin-bottom:8px">🎓 ${g.dir} · ${g.course}-kurs</div>
      <div style="display:flex;gap:16px">
        <div><div style="font-size:22px;font-weight:800;color:${color}">${count}</div><div style="font-size:11px;color:var(--text3)">Talaba</div></div>
        ${avg>0?`<div><div style="font-size:22px;font-weight:800;color:var(--green)">${avg.toFixed(1)}</div><div style="font-size:11px;color:var(--text3)">O'rt. ball</div></div>`:''}
      </div>
    </div>`;
  }).join('');
}
function populateMoveSelects(){
  const stuSel=document.getElementById('moveStudentSelect');
  const grpSel=document.getElementById('moveToGroup');
  if(stuSel) stuSel.innerHTML='<option value="">— Talabani tanlang —</option>'+STUDENTS_DATA.map(s=>`<option value="${s.id}">${s.name} (${s.group})</option>`).join('');
  if(grpSel) grpSel.innerHTML='<option value="">— Guruhni tanlang —</option>'+getGroupNames().map(g=>`<option>${g}</option>`).join('');
}
function quickChangeGroup(id, newGroup){
  const s=STUDENTS_DATA.find(s=>s.id===id);
  if(!s) return;
  const old=s.group; s.group=newGroup;
  showToast('✅','Guruh o\'zgardi',`${s.name}: ${old} → ${newGroup}`);
  renderGroupsOverview();
}
function quickChangeCourse(id, newCourse){
  const s=STUDENTS_DATA.find(s=>s.id===id);
  if(!s) return;
  s.course=parseInt(newCourse);
  showToast('✅','Kurs o\'zgardi',`${s.name}: ${newCourse}-kursga o'tkazildi`);
}
function saveNewGroup(){
  const name=document.getElementById('newGroupName').value.trim().toUpperCase();
  const dir=document.getElementById('newGroupDir').value;
  const course=parseInt(document.getElementById('newGroupCourse').value);
  const count=parseInt(document.getElementById('newGroupCount').value)||25;
  if(!name){ showToast('⚠️','Xato','Guruh nomini kiriting'); return; }
  const existing=GROUPS_LIST.findIndex(g=>g.name===name);
  if(existing>=0){
    GROUPS_LIST[existing]={name,dir,course,count};
    showToast('✅','Yangilandi',`${name} guruhi yangilandi`);
  } else {
    GROUPS_LIST.push({name,dir,course,count});
    showToast('✅','Yaratildi',`${name} yangi guruh yaratildi`);
  }
  document.getElementById('addGroupModal').style.display='none';
  renderGroupsPage();
  // Also update all group dropdowns
  refreshAllGroupDropdowns();
}
function deleteGroup(name){
  const inUse=STUDENTS_DATA.some(s=>s.group===name);
  if(inUse){ showToast('⚠️','O\'chirib bo\'lmadi',`${name} guruhida talabalar bor. Avval ularni ko'chiring.`); return; }
  if(!confirm(`${name} guruhini o'chirishni tasdiqlaysizmi?`)) return;
  GROUPS_LIST=GROUPS_LIST.filter(g=>g.name!==name);
  showToast('🗑️','O\'chirildi',`${name} guruhi o'chirildi`);
  renderGroupsPage();
  refreshAllGroupDropdowns();
}
function refreshAllGroupDropdowns(){
  const groups=getGroupNames();
  // Update all group selects across the app
  ['studentGroupFilter','dekScheduleGroup','dekGradeGroup','dekAttGroup','gradeGroupSelect','attGroupSelect','studGroupFilter','editStudentGroup','moveToGroup'].forEach(id=>{
    const sel=document.getElementById(id);if(!sel)return;
    const cur=sel.value;
    const hasAll=sel.options[0]?.value===''||sel.options[0]?.text.includes('Barcha')||sel.options[0]?.text.includes('tanlang');
    const prefix=hasAll?[`<option value="">${sel.options[0].text}</option>`]:[];
    sel.innerHTML=prefix.join('')+groups.map(g=>`<option value="${g}">${g}</option>`).join('');
    if(groups.includes(cur)) sel.value=cur;
  });
}
function renderDekanatTeachers(){
  const el=document.getElementById('dekanatTeacherBody');if(!el)return;
  el.innerHTML=TEACHERS_DATA.map((t,i)=>`
    <tr>
      <td>${i+1}</td>
      <td><div style="display:flex;align-items:center;gap:8px">
        <div class="dt-avatar" style="background:#16A34A">${t.name.split(' ').map(x=>x[0]).join('')}</div>
        ${t.name}
      </div></td>
      <td>${t.dept}</td>
      <td>${t.subjects.join(', ')}</td>
      <td>${t.groups.join(', ')}</td>
      <td>${t.hours}</td>
      <td>⭐ ${t.rating}</td>
      <td><span class="status-tag st-active">Faol</span></td>
    </tr>`).join('');
}
var _dekFilter='all';
function renderDekanatAttendance(){
  const el=document.getElementById('dekAttBody');if(!el)return;
  el.innerHTML='<tr><td colspan="5" style="text-align:center;color:#94A3B8;padding:20px">Davomat ma\'lumotlari yo\'q</td></tr>';
}

// ---- REPORT: tab switcher ----
function switchRTab(name, btn){
  document.querySelectorAll('.rtab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.report-panel').forEach(p=>p.classList.remove('active'));
  if(btn) btn.classList.add('active');
  var panel=document.getElementById('rpanel-'+name);
  if(panel) panel.classList.add('active');
  // render on demand
  if(name==='overview') renderFullReport();
  else if(name==='groups') renderGroupDetailReport();
  else if(name==='teachers') renderTeacherPerformance();
  else if(name==='risk') renderRiskStudents();
  else if(name==='compare') renderSemesterCompare();
}

function renderGroupAvgChart(){
  var el=document.getElementById('groupAvgChart');if(!el)return;
  var groups=['AI-2301','CS-2301','IT-2301','DB-2301'];
  var colors=['#1B4FD8','#7C3AED','#16A34A','#EA580C'];
  var gdata=groups.map(function(grp,gi){
    var ss=STUDENTS_DATA.filter(function(s){return s.group===grp;});
    if(!ss.length) return {g:grp,avg:[76,81,75,73][gi],cnt:ss.length||38,c:colors[gi]};
    var sums=ss.map(function(s){
      return GRADES_DATA.reduce(function(acc,g){
        var key=s.id+'_'+g.sub;var sv=SAVED_GRADES[key];
        return acc+(sv?sv.jn:g.jn)+(sv?sv.on:g.on)+(sv?sv.yn:g.yn)+(sv?sv.mi:g.mi);
      },0)/GRADES_DATA.length;
    });
    var avg=parseFloat((sums.reduce(function(a,b){return a+b;},0)/sums.length).toFixed(1));
    return {g:grp,avg:avg,cnt:ss.length,c:colors[gi]};
  });
  var maxV=Math.max.apply(null,gdata.map(function(d){return d.avg;}))+8;
  el.innerHTML='<div style="display:flex;align-items:flex-end;gap:10px;height:120px;padding:0 8px;margin-bottom:8px">'
    +gdata.map(function(d){
      var h=Math.round((d.avg/maxV)*95);
      return '<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px">'
        +'<span style="font-size:11px;font-weight:800;font-family:\'DM Mono\',monospace;color:'+d.c+'">'+d.avg+'</span>'
        +'<div style="width:100%;background:'+d.c+';border-radius:6px 6px 0 0;height:'+h+'px;opacity:0.88;transition:height 0.4s"></div>'
        +'<div style="font-size:9px;color:#94A3B8;text-align:center;line-height:1.3">'+d.g+'<br><span style="color:#CBD5E1">'+d.cnt+' ta</span></div>'
        +'</div>';
    }).join('')
  +'</div>';
}

function renderSubjectAvgTable(){
  var el=document.getElementById('subjectAvgTable');if(!el)return;
  var subjects=GRADES_DATA.map(function(g){return g.sub;});
  var rows=subjects.map(function(sub){
    var g=GRADES_DATA.find(function(x){return x.sub===sub;});
    if(!g) return null;
    var totals=STUDENTS_DATA.map(function(s){
      var key=s.id+'_'+sub;var sv=SAVED_GRADES[key];
      return (sv?sv.jn:g.jn)+(sv?sv.on:g.on)+(sv?sv.yn:g.yn)+(sv?sv.mi:g.mi);
    });
    var avg=parseFloat((totals.reduce(function(a,b){return a+b;},0)/totals.length).toFixed(1));
    var alo=totals.filter(function(t){return t>=86;}).length;
    var fail=totals.filter(function(t){return t<56;}).length;
    var tc=avg>=80?'#166534':avg>=65?'#1E40AF':'#991B1B';
    var tb=avg>=80?'#DCFCE7':avg>=65?'#DBEAFE':'#FEE2E2';
    return {sub:sub,avg:avg,alo:alo,fail:fail,tc:tc,tb:tb};
  }).filter(Boolean);
  rows.sort(function(a,b){return b.avg-a.avg;});
  el.innerHTML='<table style="width:100%;border-collapse:collapse;font-size:13px">'
    +'<thead><tr>'
      +'<th style="text-align:left;padding:8px 12px;border-bottom:1.5px solid #E2E8F0;font-size:11px;font-weight:700;color:#94A3B8;text-transform:uppercase">#</th>'
      +'<th style="text-align:left;padding:8px 12px;border-bottom:1.5px solid #E2E8F0;font-size:11px;font-weight:700;color:#94A3B8;text-transform:uppercase">Fan nomi</th>'
      +'<th style="text-align:center;padding:8px 12px;border-bottom:1.5px solid #E2E8F0;font-size:11px;font-weight:700;color:#94A3B8;text-transform:uppercase">O\'rt. ball</th>'
      +'<th style="text-align:center;padding:8px 12px;border-bottom:1.5px solid #E2E8F0;font-size:11px;font-weight:700;color:#94A3B8;text-transform:uppercase">A\'lochilar</th>'
      +'<th style="text-align:center;padding:8px 12px;border-bottom:1.5px solid #E2E8F0;font-size:11px;font-weight:700;color:#94A3B8;text-transform:uppercase">Qoniqarsiz</th>'
      +'<th style="padding:8px 12px;border-bottom:1.5px solid #E2E8F0"></th>'
    +'</tr></thead>'
    +'<tbody>'
    +rows.map(function(r,i){
      var barW=Math.round(r.avg);
      return '<tr>'
        +'<td style="padding:10px 12px;border-bottom:1px solid #F8FAFC;color:#94A3B8;font-size:12px">'+(i+1)+'</td>'
        +'<td style="padding:10px 12px;border-bottom:1px solid #F8FAFC;font-weight:600">'+r.sub+'</td>'
        +'<td style="padding:10px 12px;border-bottom:1px solid #F8FAFC;text-align:center">'
          +'<span style="background:'+r.tb+';color:'+r.tc+';padding:3px 11px;border-radius:7px;font-weight:800;font-family:\'DM Mono\',monospace">'+r.avg+'</span>'
        +'</td>'
        +'<td style="padding:10px 12px;border-bottom:1px solid #F8FAFC;text-align:center;color:#16A34A;font-weight:700">'+r.alo+'</td>'
        +'<td style="padding:10px 12px;border-bottom:1px solid #F8FAFC;text-align:center;color:'+( r.fail>0?'#DC2626':'#94A3B8')+';font-weight:700">'+r.fail+'</td>'
        +'<td style="padding:10px 12px;border-bottom:1px solid #F8FAFC;min-width:120px">'
          +'<div style="height:5px;background:#F1F5F9;border-radius:3px;overflow:hidden">'
            +'<div style="height:100%;background:'+r.tc+';border-radius:3px;width:'+barW+'%"></div>'
          +'</div>'
        +'</td>'
      +'</tr>';
    }).join('')
    +'</tbody></table>';
}

function renderTeacherPerformance(){
  var tList=document.getElementById('teacherPerfList');
  var tLoad=document.getElementById('teacherLoadChart');
  var tBody=document.getElementById('teacherDetailBody');
  if(!tList||!tLoad||!tBody) return;
  var teachers=TEACHERS_DATA;
  if(!teachers.length){
    if(tList) tList.innerHTML='<div class="empty-box"><div class="empty-box-icon">👨‍🏫</div><div class="empty-box-title">O\'qituvchilar yo\'q</div><div class="empty-box-sub">Dekanat panelidan o\'qituvchilarni qo\'shing</div></div>';
    if(tLoad) tLoad.innerHTML='';
    if(tBody) tBody.innerHTML='<tr><td colspan="7" style="text-align:center;color:#94A3B8;padding:20px">Ma\'lumot yo\'q</td></tr>';
    return;
  }
  var bgPalette=['#1B4FD8','#7C3AED','#16A34A','#EA580C','#0D9488'];
  // Performance list
  var sorted=[...teachers].sort(function(a,b){return b.rating-a.rating;});
  tList.innerHTML=sorted.map(function(t,i){
    var ini=t.name.replace('Prof. ','').split(' ').map(function(x){return x[0];}).join('');
    var pct=Math.round((t.rating/5)*100);
    var bg=bgPalette[i%bgPalette.length];
    var medal=i===0?'🥇':i===1?'🥈':i===2?'🥉':'';
    return '<div class="teacher-perf-row">'
      +'<div class="tpr-avatar" style="background:'+bg+'">'+ini+'</div>'
      +'<div style="flex:1">'
        +'<div class="tpr-name">'+medal+' '+t.name+'</div>'
        +'<div class="tpr-dept">'+t.dept+' · '+t.subjects.length+' ta fan</div>'
        +'<div class="tpr-bar-wrap" style="margin-top:5px">'
          +'<div class="tpr-bar-fill" style="width:'+pct+'%;background:'+bg+'"></div>'
        +'</div>'
      +'</div>'
      +'<div style="text-align:right">'
        +'<div class="tpr-score" style="color:'+bg+'">'+t.rating.toFixed(1)+'</div>'
        +'<div style="font-size:9.5px;color:#94A3B8;margin-top:2px">/ 5.0</div>'
      +'</div>'
    +'</div>';
  }).join('');
  // Load chart
  var maxH=Math.max.apply(null,teachers.map(function(t){return t.hours;}));
  tLoad.innerHTML='<div style="display:flex;align-items:flex-end;gap:8px;height:110px;padding:0 4px">'
    +teachers.map(function(t,i){
      var h=Math.round((t.hours/maxH)*85);
      var bg=bgPalette[i%bgPalette.length];
      var ini=t.name.replace('Prof. ','').split(' ').map(function(x){return x[0];}).join('');
      return '<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:3px">'
        +'<span style="font-size:10px;font-weight:700;font-family:\'DM Mono\',monospace;color:'+bg+'">'+t.hours+'s</span>'
        +'<div style="width:100%;background:'+bg+';opacity:0.82;border-radius:5px 5px 0 0;height:'+h+'px"></div>'
        +'<div style="font-size:9.5px;color:#94A3B8;text-align:center;line-height:1.2">'+ini+'</div>'
      +'</div>';
    }).join('')
  +'</div><div style="font-size:10px;color:#94A3B8;text-align:center;margin-top:6px">Haftalik dars soati (soat)</div>';
  // Detail table
  tBody.innerHTML=teachers.map(function(t,i){
    var bg=bgPalette[i%bgPalette.length];
    var ini=t.name.replace('Prof. ','').split(' ').map(function(x){return x[0];}).join('');
    var aloP=Math.round(30+t.rating*8+Math.random()*10);
    var baseAvg=(60+t.rating*6).toFixed(1);
    return '<tr>'
      +'<td>'+(i+1)+'</td>'
      +'<td><div style="display:flex;align-items:center;gap:9px">'
        +'<div style="background:'+bg+';width:32px;height:32px;border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:#fff">'+ini+'</div>'
        +'<span style="font-weight:600">'+t.name+'</span>'
      +'</div></td>'
      +'<td>'+t.dept+'</td>'
      +'<td style="text-align:center">'+t.subjects.length+'</td>'
      +'<td>'+t.groups.join(', ')+'</td>'
      +'<td style="text-align:center;font-family:\'DM Mono\',monospace;font-weight:700;color:#1B4FD8">'+baseAvg+'</td>'
      +'<td style="text-align:center;color:#16A34A;font-weight:700">'+aloP+'%</td>'
      +'<td><span style="display:flex;align-items:center;gap:3px;font-weight:700;color:#D97706">⭐ '+t.rating.toFixed(1)+'</span></td>'
    +'</tr>';
  }).join('');
}

function renderSemesterCompare(){
  var bodyEl=document.getElementById('semCmpBody');
  var chartEl=document.getElementById('subjectCmpChart');
  if(!bodyEl) return;
  var cmpData=[
    {grp:'AI-2301',avg1:78.4,avg2:83.1,pass1:84,pass2:89},
    {grp:'CS-2301',avg1:75.2,avg2:80.7,pass1:81,pass2:86},
    {grp:'IT-2301',avg1:71.8,avg2:74.9,pass1:78,pass2:82},
    {grp:'DB-2301',avg1:70.1,avg2:73.5,pass1:75,pass2:79},
  ];
  bodyEl.innerHTML=cmpData.map(function(d){
    var deltaAvg=(d.avg2-d.avg1).toFixed(1);
    var deltaPass=d.pass2-d.pass1;
    var upAvg=parseFloat(deltaAvg)>0;
    var upPass=deltaPass>0;
    return '<tr>'
      +'<td style="font-weight:700">'+d.grp+'</td>'
      +'<td style="font-family:\'DM Mono\',monospace;font-weight:600;text-align:center">'+d.avg1+'</td>'
      +'<td style="font-family:\'DM Mono\',monospace;font-weight:700;text-align:center;color:#1B4FD8">'+d.avg2+'</td>'
      +'<td style="text-align:center" class="'+(upAvg?'delta-up':'delta-dn')+'">'+( upAvg?'↑ +':' ↓ ')+Math.abs(deltaAvg)+'</td>'
      +'<td style="font-family:\'DM Mono\',monospace;text-align:center">'+d.pass1+'%</td>'
      +'<td style="font-family:\'DM Mono\',monospace;text-align:center;font-weight:700;color:#1B4FD8">'+d.pass2+'%</td>'
      +'<td style="text-align:center" class="'+(upPass?'delta-up':'delta-dn')+'">'+( upPass?'↑ +':' ↓ ')+Math.abs(deltaPass)+'%</td>'
    +'</tr>';
  }).join('');
  if(!chartEl) return;
  var subCmp=[
    {sub:'Machine Learning',s1:74,s2:81},{sub:'Python for AI',s1:79,s2:84},
    {sub:'Deep Learning',s1:68,s2:76},{sub:'Data Science',s1:72,s2:78},
    {sub:'Matematika',s1:66,s2:71},{sub:'Ingliz tili',s1:80,s2:85},
  ];
  chartEl.innerHTML='<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:13px">'
    +'<thead><tr>'
      +'<th style="text-align:left;padding:8px 12px;border-bottom:1.5px solid #E2E8F0;font-size:11px;font-weight:700;color:#94A3B8;text-transform:uppercase">Fan</th>'
      +'<th style="text-align:center;padding:8px 12px;border-bottom:1.5px solid #E2E8F0;font-size:11px;font-weight:700;color:#94A3B8;text-transform:uppercase">I semestr</th>'
      +'<th style="text-align:center;padding:8px 12px;border-bottom:1.5px solid #E2E8F0;font-size:11px;font-weight:700;color:#94A3B8;text-transform:uppercase">II semestr</th>'
      +'<th style="text-align:left;padding:8px 12px;border-bottom:1.5px solid #E2E8F0;font-size:11px;font-weight:700;color:#94A3B8;text-transform:uppercase">O\'zgarish</th>'
    +'</tr></thead>'
    +'<tbody>'
    +subCmp.map(function(r){
      var delta=r.s2-r.s1;
      var up=delta>0;
      var barColor=up?'#16A34A':'#DC2626';
      return '<tr>'
        +'<td style="padding:9px 12px;border-bottom:1px solid #F8FAFC;font-weight:600">'+r.sub+'</td>'
        +'<td style="padding:9px 12px;border-bottom:1px solid #F8FAFC;text-align:center;font-family:\'DM Mono\',monospace;color:#64748B">'+r.s1+'</td>'
        +'<td style="padding:9px 12px;border-bottom:1px solid #F8FAFC;text-align:center;font-family:\'DM Mono\',monospace;font-weight:800;color:#1B4FD8">'+r.s2+'</td>'
        +'<td style="padding:9px 12px;border-bottom:1px solid #F8FAFC">'
          +'<div style="display:flex;align-items:center;gap:8px">'
            +'<span style="font-weight:700;color:'+barColor+'">'+(up?'↑ +':' ↓ ')+Math.abs(delta)+'</span>'
            +'<div style="flex:1;height:5px;background:#F1F5F9;border-radius:3px;overflow:hidden;max-width:80px">'
              +'<div style="height:100%;background:'+barColor+';border-radius:3px;width:'+Math.min(Math.abs(delta)*12,100)+'%"></div>'
            +'</div>'
          +'</div>'
        +'</td>'
      +'</tr>';
    }).join('')
    +'</tbody></table></div>';
}

// ════════════════════════════════════
//  STARTUP IDEAS
// ════════════════════════════════════

// Cached student list for team search
var _startupStudents = [];

async function _loadStartupStudents() {
  if (_startupStudents.length) return;
  try {
    var data = await api('GET', '/students?limit=200');
    _startupStudents = (data.students || data || []).map(function(s) {
      return { name: s.full_name || s.name || '', login: s.login || '', group: s.group_name || '' };
    });
  } catch(e) {
    // fallback to empty — user can still type manually
  }
}

function _ideaMsgKey(id) { return 'idu_startup_chat_' + id; }

function _ideaMessages(id) {
  try { return JSON.parse(_lsGet(_ideaMsgKey(id)) || '[]'); } catch(e) { return []; }
}

function _saveIdeaMessages(id, msgs) {
  try { _lsSet(_ideaMsgKey(id), JSON.stringify(msgs)); } catch(e) {}
}

function _seedDemoIdeas() {
  IDEAS = [
    {
      id: 1001, title: 'EduBot — AI o\'qituvchi', category: 'edu',
      desc: 'Sun\'iy intellekt asosida ishlaydigan shaxsiylashtirilgan o\'qituvchi. Har bir talabaning bilim darajasini aniqlab, moslashtirilgan darslar tayyorlaydi.',
      team: ['Alisher Nazarov', 'Dilnoza Yusupova', 'Jasur Mirzayev'],
      investment: '30,000$', likes: 24, investorRating: 4, comments: [
        { author: 'Sardor Rahimov', text: 'Ajoyib g\'oya! Bu talabalar uchun juda foydali bo\'ladi.', time: '2 soat oldin' }
      ]
    },
    {
      id: 1002, title: 'MediTrack — Sog\'liq monitoring', category: 'health',
      desc: 'Smartfon orqali sog\'liq ko\'rsatkichlarini kuzatuvchi platforma. Shifokor bilan real-vaqt muloqot va tahlil imkoniyati.',
      team: ['Nodira Hamidova', 'Bobur Toshmatov'],
      investment: '50,000$', likes: 18, investorRating: 3, comments: []
    },
    {
      id: 1003, title: 'AgriTech UZ — Aqlli dehqonchilik', category: 'tech',
      desc: 'IoT sensorlar va AI yordamida dehqonchilikni optimallashtirish. Suv sarfini 40% kamaytiradi, hosildorlikni oshiradi.',
      team: ['Sherzod Umarov', 'Malika Sodiqova', 'Firdavs Qodirov', 'Zulfiya Ergasheva'],
      investment: '75,000$', likes: 31, investorRating: 5, comments: [
        { author: 'Investor Pro', text: 'Bu loyiha katta kelajakka ega!', time: '1 kun oldin' }
      ]
    },
    {
      id: 1004, title: 'PayEasy — To\'lov ekotizimi', category: 'fintech',
      desc: 'Mahalliy bizneslar uchun sodda va arzon to\'lov echimlari. QR kod orqali bir soniyada to\'lov, komisyon 0.5%.',
      team: ['Otabek Xolmatov', 'Gulnora Askarova'],
      investment: '25,000$', likes: 15, investorRating: 3, comments: []
    }
  ];
}

function renderIdeas(filter) {
  filter = filter || 'all';
  const el = document.getElementById('ideasList'); if (!el) return;

  // Seed demo ideas if empty
  if (!IDEAS.length) _seedDemoIdeas();

  // Show/hide add button based on role (more reliable than launchApp override)
  var addBtn = document.getElementById('addIdeaBtn');
  if (addBtn) addBtn.style.display = (currentRole === 'student' || currentRole === 'dekanat') ? '' : 'none';

  const catColors = { tech:'cat-tech', health:'cat-health', edu:'cat-edu', fintech:'cat-fintech', social:'cat-social' };
  const catNames  = { tech:'💻 Texnologiya', health:'🏥 Sog\'liqni saqlash', edu:'📚 Ta\'lim', fintech:'💰 Fintech', social:'🌍 Ijtimoiy' };
  const filtered  = filter === 'all' ? IDEAS : IDEAS.filter(function(i) { return i.category === filter; });
  const cs        = ['#1B4FD8','#16A34A','#7C3AED','#EA580C'];
  const me        = currentUser ? (currentUser.name || '') : '';

  if (!filtered.length) {
    el.innerHTML = '<div style="padding:60px 20px;text-align:center;color:#94A3B8"><div style="font-size:48px;margin-bottom:12px">🚀</div><div style="font-size:15px;font-weight:700">Hali g\'oyalar yo\'q</div><div style="font-size:13px;margin-top:6px">Birinchi startup g\'oyangizni qo\'shing!</div></div>';
    return;
  }

  el.innerHTML = filtered.map(function(idea) {
    var inTeam = idea.team.indexOf(me) !== -1 || (me && idea.team.some(function(t){ return t.toLowerCase() === me.toLowerCase(); }));
    var msgs = _ideaMessages(idea.id);
    var unreadCount = msgs.filter(function(m) { return !m.read; }).length;

    return '<div class="idea-card" id="idea-' + idea.id + '">' +
      // Header
      '<div class="idea-header">' +
        '<div>' +
          '<span class="idea-category ' + (catColors[idea.category]||'cat-tech') + '">' + (catNames[idea.category]||idea.category) + '</span>' +
          '<div class="idea-title">' + idea.title + '</div>' +
        '</div>' +
        '<div style="display:flex;align-items:center;gap:8px">' +
          (currentRole === 'investor' ? '<div class="investor-badge">💼 Investor</div>' : '') +
          (inTeam ? '<span style="padding:3px 9px;border-radius:20px;font-size:11px;font-weight:700;background:#DCFCE7;color:#16A34A">✅ Jamoa a\'zosi</span>' : '') +
        '</div>' +
      '</div>' +
      // Desc + investment
      '<div class="idea-desc">' + idea.desc + '</div>' +
      (idea.investment ? '<div style="font-size:13px;color:var(--text2);margin-bottom:10px">💰 Kerakli investitsiya: <strong>' + idea.investment + '</strong></div>' : '') +
      // Team members
      '<div class="idea-team">' +
        idea.team.map(function(m, i) {
          return '<div class="team-member">' +
            '<div class="tm-avatar" style="background:' + cs[i%4] + '">' + (m.split(' ').map(function(x){return x[0]||'';}).join('')) + '</div>' +
            m +
          '</div>';
        }).join('') +
        (!inTeam && currentRole === 'student' ?
          '<div class="team-member" onclick="inviteToTeam(' + idea.id + ')" style="cursor:pointer;border:1.5px dashed #CBD5E1;background:transparent;color:#64748B;padding:5px 10px;border-radius:20px;font-size:12px">+ Qo\'shilish so\'rovi</div>'
          : '') +
      '</div>' +
      // Footer
      '<div class="idea-footer">' +
        '<div class="idea-stats">' +
          '<div class="idea-stat" onclick="likeIdea(' + idea.id + ')">❤️ ' + idea.likes + '</div>' +
          '<div class="idea-stat" onclick="toggleIdeaChat(' + idea.id + ')" style="cursor:pointer;position:relative">' +
            '💬 ' + msgs.length +
            (unreadCount > 0 ? '<span style="position:absolute;top:-4px;right:-4px;width:14px;height:14px;background:#EF4444;border-radius:50%;font-size:9px;color:#fff;display:flex;align-items:center;justify-content:center">' + unreadCount + '</span>' : '') +
          '</div>' +
          (currentRole === 'investor' || currentRole === 'dekanat' ?
            '<div style="display:flex;align-items:center;gap:6px"><span style="font-size:12px;color:var(--text2)">Baho:</span>' +
            '<div class="star-rating" id="stars-' + idea.id + '">' +
              [1,2,3,4,5].map(function(n) {
                return '<span class="star' + (n <= idea.investorRating ? ' filled' : '') + '" onclick="rateIdea(' + idea.id + ',' + n + ')">★</span>';
              }).join('') +
            '</div></div>'
            : '') +
        '</div>' +
        (currentRole === 'investor' ? '<button class="invest-btn" onclick="expressInterest(' + idea.id + ')">💼 Qiziqish bildirish</button>' : '') +
      '</div>' +
      // Public comments section
      '<div class="idea-comments">' +
        '<div style="font-size:13px;font-weight:700;margin-bottom:10px">Izohlar (' + idea.comments.length + ')</div>' +
        idea.comments.map(function(c) {
          return '<div class="comment-item">' +
            '<div class="comment-avatar" style="background:#7C3AED">' + (c.author[0]||'?') + '</div>' +
            '<div class="comment-body">' +
              '<div class="comment-author">' + c.author + '</div>' +
              '<div class="comment-text">' + c.text + '</div>' +
              '<div class="comment-time">' + c.time + '</div>' +
            '</div>' +
          '</div>';
        }).join('') +
        '<div class="add-comment-row">' +
          '<input class="comment-input" placeholder="Izoh yozing..." id="comment-input-' + idea.id + '" onkeydown="if(event.key===\'Enter\')addComment(' + idea.id + ')">' +
          '<button class="comment-send" onclick="addComment(' + idea.id + ')">Yuborish</button>' +
        '</div>' +
      '</div>' +
      // Team chat (hidden by default)
      '<div id="idea-chat-' + idea.id + '" style="display:none;margin-top:12px;border-top:1.5px solid #E2E8F0;padding-top:14px">' +
        '<div style="font-size:13px;font-weight:700;color:#1B4FD8;margin-bottom:10px">💬 Jamoa chati ' +
          (inTeam ? '<span style="font-size:11px;color:#16A34A;font-weight:600;background:#DCFCE7;padding:2px 8px;border-radius:10px;margin-left:6px">Siz a\'zo</span>' : '<span style="font-size:11px;color:#64748B;font-weight:600;margin-left:6px">— faqat a\'zolar yozishi mumkin</span>') +
        '</div>' +
        '<div id="idea-chat-msgs-' + idea.id + '" style="max-height:240px;overflow-y:auto;display:flex;flex-direction:column;gap:8px;margin-bottom:10px">' +
          _renderIdeaMsgs(msgs, me) +
        '</div>' +
        (inTeam ?
          '<div style="display:flex;gap:8px">' +
            '<input id="idea-chat-inp-' + idea.id + '" type="text" placeholder="Xabar yozing..." ' +
              'style="flex:1;padding:9px 13px;border:1.5px solid #E2E8F0;border-radius:10px;font-size:13px;font-family:inherit;outline:none" ' +
              'onkeydown="if(event.key===\'Enter\')sendIdeaMessage(' + idea.id + ')" ' +
              'onfocus="this.style.borderColor=\'#1B4FD8\'" onblur="this.style.borderColor=\'#E2E8F0\'">' +
            '<button onclick="sendIdeaMessage(' + idea.id + ')" style="padding:9px 18px;background:#1B4FD8;color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer">📤</button>' +
          '</div>'
          : '<div style="font-size:12px;color:#94A3B8;text-align:center;padding:8px;background:#F8FAFC;border-radius:8px">Jamoa a\'zolari yozishi mumkin</div>'
        ) +
      '</div>' +
    '</div>';
  }).join('');
}

function _renderIdeaMsgs(msgs, me) {
  if (!msgs.length) return '<div style="font-size:12px;color:#94A3B8;text-align:center;padding:16px">Hali xabarlar yo\'q</div>';
  return msgs.map(function(m) {
    var isMine = m.author === me;
    return '<div style="display:flex;flex-direction:' + (isMine?'row-reverse':'row') + ';gap:8px;align-items:flex-end">' +
      '<div style="width:28px;height:28px;border-radius:50%;background:' + (isMine?'#1B4FD8':'#7C3AED') + ';color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0">' +
        (m.author ? m.author[0].toUpperCase() : '?') +
      '</div>' +
      '<div style="max-width:70%;background:' + (isMine?'#1B4FD8':'#F1F5F9') + ';color:' + (isMine?'#fff':'#1E293B') + ';padding:8px 12px;border-radius:' + (isMine?'12px 12px 2px 12px':'12px 12px 12px 2px') + ';font-size:13px;line-height:1.45">' +
        (!isMine ? '<div style="font-size:10px;font-weight:700;color:' + (isMine?'rgba(255,255,255,0.7)':'#1B4FD8') + ';margin-bottom:3px">' + m.author + '</div>' : '') +
        m.text +
        '<div style="font-size:10px;opacity:0.55;margin-top:3px;text-align:' + (isMine?'left':'right') + '">' + (m.time||'') + '</div>' +
      '</div>' +
    '</div>';
  }).join('');
}

function toggleIdeaChat(ideaId) {
  var el = document.getElementById('idea-chat-' + ideaId); if (!el) return;
  var open = el.style.display !== 'none';
  el.style.display = open ? 'none' : 'block';
  if (!open) {
    var msgsEl = document.getElementById('idea-chat-msgs-' + ideaId);
    if (msgsEl) msgsEl.scrollTop = msgsEl.scrollHeight;
  }
}

function sendIdeaMessage(ideaId) {
  var inp = document.getElementById('idea-chat-inp-' + ideaId); if (!inp) return;
  var text = inp.value.trim(); if (!text) return;
  var me = currentUser ? (currentUser.name || currentUser.login || '') : '';
  var msgs = _ideaMessages(ideaId);
  var now = new Date();
  msgs.push({
    author: me,
    text: text,
    time: now.toLocaleTimeString('uz-UZ', { hour:'2-digit', minute:'2-digit' }),
    read: true
  });
  _saveIdeaMessages(ideaId, msgs);
  inp.value = '';
  var msgsEl = document.getElementById('idea-chat-msgs-' + ideaId);
  if (msgsEl) { msgsEl.innerHTML = _renderIdeaMsgs(msgs, me); msgsEl.scrollTop = msgsEl.scrollHeight; }
}

function inviteToTeam(ideaId) {
  var idea = IDEAS.find(function(i){ return i.id === ideaId; }); if (!idea) return;
  var me = currentUser ? (currentUser.name || '') : '';
  if (!me) { showToast('⚠️', 'Xato', 'Avval tizimga kiring'); return; }
  if (idea.team.indexOf(me) !== -1) { showToast('ℹ️', 'Ma\'lumot', 'Siz allaqachon jamoa a\'zosisiz'); return; }
  if (idea.team.length >= 5) { showToast('⚠️', 'To\'liq', 'Jamoa to\'ldi (max 5 kishi)'); return; }
  idea.team.push(me);
  renderIdeas();
  showToast('✅', 'Qo\'shildingiz!', '"' + idea.title + '" jamoasiga qo\'shildingiz');
}

function filterIdeas(f, el) {
  document.querySelectorAll('#page-startup .filter-chip').forEach(function(c){ c.classList.remove('active'); });
  if (el) el.classList.add('active');
  renderIdeas(f);
}

function likeIdea(id) {
  const idea = IDEAS.find(function(i){ return i.id === id; }); if (!idea) return;
  idea.likes++; renderIdeas(); showToast('❤️', 'Like!', 'Qiziqishingiz belgilandi');
}

function rateIdea(id, stars) {
  const idea = IDEAS.find(function(i){ return i.id === id; }); if (!idea) return;
  idea.investorRating = stars;
  renderIdeas();
  showToast('⭐', 'Baholandi!', 'G\'oya ' + stars + ' yulduz bilan baholandi');
  const ic = document.getElementById('investorRatedCount'); if (ic) ic.textContent = parseInt(ic.textContent || '0') + 1;
}

function addComment(id) {
  const inp = document.getElementById('comment-input-' + id); if (!inp) return;
  const text = inp.value.trim(); if (!text) return;
  const idea = IDEAS.find(function(i){ return i.id === id; }); if (!idea) return;
  idea.comments.push({ author: (currentUser && currentUser.name) || 'Foydalanuvchi', text: text, time: 'Hozir' });
  inp.value = '';
  renderIdeas();
  showToast('💬', 'Izoh qo\'shildi', 'Izohingiz muvaffaqiyatli qo\'shildi');
}

function toggleIdeaForm() {
  ideaFormVisible = !ideaFormVisible;
  const fc = document.getElementById('ideaFormCard');
  if (fc) fc.style.display = ideaFormVisible ? 'block' : 'none';
  const btn = document.getElementById('addIdeaBtn');
  if (btn) btn.textContent = ideaFormVisible ? '✕ Yopish' : '+ G\'oya qo\'shish';
  if (ideaFormVisible) { _loadStartupStudents(); _renderTeamSearchSlots(); }
}

// ── Team member search ──────────────────────────────────────
var _teamSelected = [];

function _renderTeamSearchSlots() {
  var row = document.getElementById('teamMembersRow'); if (!row) return;
  // Ensure current user is pre-added as slot 0
  var myName = currentUser ? (currentUser.name || '') : '';
  if (!_teamSelected.length && myName) _teamSelected = [myName];
  row.innerHTML = '';
  for (var i = 0; i < 4; i++) {
    (function(idx) {
      var val = _teamSelected[idx] || '';
      var slotHtml = '<div style="position:relative;flex:1;min-width:160px">' +
        '<input class="form-input" id="tm-inp-' + idx + '" ' +
          'value="' + (val.replace(/"/g,'&quot;')) + '" ' +
          'placeholder="' + (idx === 0 ? 'Siz (a\'zo 1)' : (idx + 1) + '-a\'zo ismi') + '" ' +
          'autocomplete="off" ' +
          'oninput="_filterTeamSearch(this,' + idx + ')" ' +
          (idx === 0 && val ? 'readonly style="background:#F0FDF4;color:#16A34A;font-weight:700"' : '') +
          '>' +
        '<div id="tm-sug-' + idx + '" style="display:none;position:absolute;top:100%;left:0;right:0;background:#fff;border:1.5px solid #1B4FD8;border-radius:10px;z-index:500;box-shadow:0 8px 24px rgba(0,0,0,0.12);max-height:180px;overflow-y:auto"></div>' +
      '</div>';
      row.insertAdjacentHTML('beforeend', slotHtml);
    })(i);
  }
}

function _filterTeamSearch(input, idx) {
  var q = input.value.trim().toLowerCase();
  var sug = document.getElementById('tm-sug-' + idx); if (!sug) return;
  _teamSelected[idx] = input.value;
  if (q.length < 2) { sug.style.display = 'none'; return; }
  var results = _startupStudents.filter(function(s) {
    return s.name.toLowerCase().includes(q);
  }).slice(0, 8);
  if (!results.length) { sug.style.display = 'none'; return; }
  sug.style.display = 'block';
  sug.innerHTML = results.map(function(s) {
    return '<div onclick="_selectTeamMember(' + idx + ',\'' + s.name.replace(/'/g, "\\'") + '\')" ' +
      'style="padding:9px 13px;cursor:pointer;border-bottom:1px solid #F1F5F9;font-size:13px;display:flex;align-items:center;gap:8px" ' +
      'onmouseover="this.style.background=\'#EFF6FF\'" onmouseout="this.style.background=\'\'">' +
      '<div style="width:30px;height:30px;border-radius:50%;background:#1B4FD8;color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0">' +
        s.name.split(' ').map(function(x){return x[0]||'';}).join('').substring(0,2) +
      '</div>' +
      '<div><div style="font-weight:600">' + s.name + '</div>' +
      (s.group ? '<div style="font-size:11px;color:#94A3B8">' + s.group + '</div>' : '') +
      '</div></div>';
  }).join('');
}

function _selectTeamMember(idx, name) {
  _teamSelected[idx] = name;
  var inp = document.getElementById('tm-inp-' + idx);
  if (inp) inp.value = name;
  var sug = document.getElementById('tm-sug-' + idx);
  if (sug) sug.style.display = 'none';
}

function submitIdea() {
  const title = (document.getElementById('ideaTitle') || {}).value.trim();
  const desc  = (document.getElementById('ideaDesc')  || {}).value.trim();
  const cat   = (document.getElementById('ideaCategory') || {}).value;
  const inv   = (document.getElementById('ideaInvestment') || {}).value.trim();
  if (!title || !desc) { showToast('⚠️', 'Xato', 'Sarlavha va tavsif kiritilishi shart!'); return; }
  // Gather from search slots
  var slots = [];
  for (var i = 0; i < 4; i++) {
    var inp = document.getElementById('tm-inp-' + i);
    var v = inp ? inp.value.trim() : (_teamSelected[i] || '');
    if (v) slots.push(v);
  }
  if (slots.length < 2) { showToast('⚠️', 'Xato', 'Kamida 2 ta jamoa a\'zosi kerak!'); return; }
  const newIdea = {
    id: Date.now(), title: title, category: cat, desc: desc,
    team: slots, investment: inv || null,
    likes: 0, stars: 0, comments: [], investorRating: 0
  };
  IDEAS.unshift(newIdea);
  _teamSelected = [];
  toggleIdeaForm();
  ['ideaTitle','ideaDesc','ideaInvestment'].forEach(function(id) {
    var el = document.getElementById(id); if (el) el.value = '';
  });
  renderIdeas();
  showToast('🚀', 'G\'oya yuborildi!', 'Startup g\'oyangiz muvaffaqiyatli qo\'shildi');
}

// ════════════════════════════════════
//  INVESTOR
// ════════════════════════════════════
function renderInvestorDashboard(){
  const el=document.getElementById('topIdeasList');if(!el)return;
  const top=[...IDEAS].sort((a,b)=>b.investorRating-a.investorRating).slice(0,3);
  el.innerHTML=top.map(idea=>`
    <div style="display:flex;align-items:center;gap:14px;padding:13px 0;border-bottom:1px solid #F8FAFC">
      <div style="font-size:24px">🚀</div>
      <div style="flex:1">
        <div style="font-size:14px;font-weight:700">${idea.title}</div>
        <div style="font-size:12px;color:var(--text2)">Jamoa: ${idea.team.slice(0,2).join(', ')}</div>
      </div>
      <div style="display:flex;gap:2px">${[1,2,3,4,5].map(n=>`<span style="color:${n<=idea.investorRating?'#F59E0B':'#E2E8F0'};font-size:16px">★</span>`).join('')}</div>
    </div>`).join('');
  const cn=document.getElementById('investorCompanyName');
  if(cn&&currentUser?.company)cn.textContent=currentUser.company;
}

// ════════════════════════════════════
//  MISC
// ════════════════════════════════════
function syncData(){
  showToast('🔄','Yangilanmoqda...','HEMIS tizimiga ulanildi');
  setTimeout(()=>showToast('✅','Yangilandi!','Barcha ma\'lumotlar joriy'),2000);
}

// ════════════════════════════════════
//  AI TUTOR
// ════════════════════════════════════
const AI_RESPONSES = {
  'python':['Python — eng ommabop dasturlash tillaridan biri. Keling, OOP (Ob\'yektga yo\'naltirilgan dasturlash) asoslarini ko\'rib chiqaylik:\n\n**Klass va ob\'yekt:**\n```\nclass Talaba:\n    def __init__(self, ism):\n        self.ism = ism\n    def salomlash(self):\n        return f"Salom, {self.ism}!"\n```\nBu misolda `Talaba` klass, `t = Talaba("Ali")` esa ob\'yekt hisoblanadi.'],
  'algebra':['Algebra asosiy formulalari:\n\n📐 **Kvadrat tenglamalar:** ax² + bx + c = 0\nYechim: x = (-b ± √(b²-4ac)) / 2a\n\n📐 **Faktorlash:** (a+b)² = a² + 2ab + b²\n\n📐 **Logarifm:** log(ab) = log(a) + log(b)'],
  'fizika':['Fizikaning asosiy qonunlari:\n\n⚛️ **Nyuton qonunlari:**\n- 1-qonun: Tana harakatini o\'zgartirish uchun kuch kerak\n- 2-qonun: F = ma (kuch = massa × tezlanish)\n- 3-qonun: Har bir ta\'sirga teng qarama-qarshi ta\'sir bor'],
  'default':['Savolingizni tushundim! Keling, batafsil ko\'rib chiqaylik. Qaysi fandan yordam kerak — Matematika, Dasturlash, Fizika yoki Ingliz tili? Men har birida sizga yordam bera olaman! 📚','Bu mavzu juda qiziqarli. Avval asosiy tushunchalardan boshlaylik, keyin murakkab misollarga o\'tamiz. Tayyor bo\'lsangiz, "davom et" deb yozing! 💡']
};

// ════════════════════════════════════
//  INIT
// ════════════════════════════════════
window.addEventListener('load',()=>{
  var _bn=document.getElementById('btnNext'); if(_bn) _bn.disabled=true;
});
// ════════════════════════════════════
//  GAMIFICATION STATE
// ════════════════════════════════════
let playerXP = 0, playerLevel = 1, playerCoins = 0, gamesPlayed = 0;
let streakDays = parseInt(localStorage.getItem('idu_streak')||'0');
let streakRecord = parseInt(localStorage.getItem('idu_streak_record')||'0');
let pomoSessions = 0, pomoTodaySessions = 0;
let pomoRunning = false, pomoInterval = null;
let pomoDuration = 25*60, pomoRemaining = 25*60;
let gameActive = false, gameTimerInt = null;
let currentGame = '', gameScore = 0, gameStreak = 0, gameQNum = 0;
let warnCount = 0, maxWarnings = 3;
let anticheatActive = false;
const XP_PER_LEVEL = 100;
const LEVEL_NAMES = ['Yangi boshlovchi','Izlovchi','O\'rganuvchi','Faol talaba','Mohir talaba','Ekspert','Master','Grandmaster','Chempion','IDU Ustasi'];

// ════════════════════════════════════
//  NEW NAV ITEMS (extend existing)
// ════════════════════════════════════
const NAV_EXTRA = {
  student: [
    {id:'idu-premium',icon:'🤝',label:'Hamkorlar',labelRu:'Партнёры'},
  ],
  teacher: [{id:'idu-premium',icon:'💰',label:'IDU Premium',labelRu:'IDU Premium'}],
  dekanat: [{id:'idu-premium',icon:'💰',label:'Daromad',labelRu:'Доход'}],
  investor: [{id:'idu-premium',icon:'📈',label:'Statistika',labelRu:'Статистика'}],
};
function addCoins(amount, reason){
  playerCoins += amount;
  updateXPDisplays();
  if(reason) showToast('🪙','Coin qo\'shildi',`+${amount} IDU Coin — ${reason}`);
}

// ════════════════════════════════════
//  ANTI-CHEAT SYSTEM
// ════════════════════════════════════
function initAntiCheat(){
  // Tab visibility detection
  document.addEventListener('visibilitychange',()=>{
    if(anticheatActive && document.hidden){
      triggerWarning('⚠️ Siz testdan CHIQIB KETDINGIZ! Tab almashtirish qayd etildi!');
    }
  });
  // Right-click disable during game/test
  document.addEventListener('contextmenu',(e)=>{
    if(anticheatActive){e.preventDefault();triggerWarning('🚫 Test vaqtida o\'ng tugma ishlamaydi!');}
  });
  // Copy-paste disable
  document.addEventListener('copy',(e)=>{
    if(anticheatActive){e.preventDefault();showToast('🚫','Bloklandi','Test vaqtida nusxa olish mumkin emas!');}
  });
  // Copy path va drag-drop bloklash
document.addEventListener('dragover', function(e){ e.preventDefault(); });
document.addEventListener('drop', function(e){ e.preventDefault(); });

// Yangi oynaga ochishni bloklash (middle-click, Ctrl+click)
document.addEventListener('auxclick', function(e){
  if(e.button === 1) e.preventDefault(); // middle click
});
document.addEventListener('keydown', function(e){
  // Ctrl+N — yangi oyna bloklash
  if(e.ctrlKey && (e.key==='n'||e.key==='N')){
    e.preventDefault();
    return false;
  }
  // Ctrl+T — yangi tab bloklash  
  if(e.ctrlKey && (e.key==='t'||e.key==='T')){
    e.preventDefault();
    return false;
  }
});
  document.addEventListener('keydown',(e)=>{
    if(!anticheatActive)return;
    // Block F12, Ctrl+Shift+I, Ctrl+U, Ctrl+C
    if(e.key==='F12'||(e.ctrlKey&&e.shiftKey&&e.key==='I')||(e.ctrlKey&&e.key==='u')){
      e.preventDefault();
      triggerWarning('🔒 DevTools ochish taqiqlangan! Bu harakat qayd etildi.');
    }
  });
  // DevTools size detection
  setInterval(()=>{
    if(anticheatActive){
      const threshold=160;
      if(window.outerWidth-window.innerWidth>threshold||window.outerHeight-window.innerHeight>threshold){
        triggerWarning('🔍 DevTools ochiganligini aniqladik! Faoliyatingiz qayd etildi.');
      }
    }
  },2000);
}

function triggerWarning(msg){
  warnCount++;
  const overlay=document.getElementById('anticheatOverlay');
  const msgEl=document.getElementById('anticheatMsg');
  if(msgEl)msgEl.textContent=msg+` (${warnCount}/${maxWarnings} ogohlantirish)`;
  // Update warn dots
  const wc=document.getElementById('warnCounter');
  if(wc){
    wc.innerHTML=[1,2,3].map(i=>`<div class="warn-dot${i<=warnCount?' active':''}"></div>`).join('');
  }
  if(overlay)overlay.classList.add('show');
  if(warnCount>=maxWarnings){
    setTimeout(()=>{
      forceSubmitGame();
      overlay.classList.remove('show');
      showToast('🚨','Test yakunlandi!','3 ta ogohlantirish — test avtomatik topshirildi. Dekanatga xabar yuborildi.');
    },3000);
  }
}
function dismissWarning(){
  document.getElementById('anticheatOverlay')?.classList.remove('show');
}
initAntiCheat();

// ════════════════════════════════════
//  GAME ENGINE
// ════════════════════════════════════
const GAME_CONFIGS = {
  math:   {title:'🔢 Matematika챔피온', time:60, coins:50,  xp:80,  questions:10},
  prog:   {title:'💻 Kod to\'ldirish',  time:90, coins:70,  xp:100, questions:8},
  english:{title:'🌍 So\'z juftlash',   time:45, coins:40,  xp:60,  questions:1},
  physics:{title:'⚛️ Formula izlash',   time:60, coins:60,  xp:90,  questions:8},
  algo:   {title:'📊 Tartiblash o\'yini',time:30, coins:80,  xp:120, questions:5},
  logic:  {title:'🧩 Mantiq masalasi',  time:120,coins:90,  xp:130, questions:6},
};

const MATH_QUESTIONS = [
  {expr:'12 × 8 = ?',   answer:96,  opts:[84,96,98,104]},
  {expr:'√144 = ?',     answer:12,  opts:[11,12,13,14]},
  {expr:'15² = ?',      answer:225, opts:[200,215,225,230]},
  {expr:'2⁸ = ?',       answer:256, opts:[128,256,512,264]},
  {expr:'∫x dx = ?',    answer:'x²/2',opts:['x²','x²/2','2x','x/2']},
  {expr:'log₂(64) = ?', answer:6,   opts:[4,5,6,8]},
  {expr:'3! + 2! = ?',  answer:8,   opts:[6,7,8,10]},
  {expr:'sin(90°) = ?', answer:1,   opts:['0','1','√2/2','√3/2']},
  {expr:'GCD(48, 18) = ?',answer:6, opts:[3,6,9,12]},
  {expr:'47 + 58 = ?',  answer:105, opts:[95,105,115,100]},
];

const CODE_QUESTIONS = [
  {
    code:`<span class="kw-purple">def</span> <span class="kw-blue">factorial</span>(n):\n    <span class="kw-purple">if</span> n <span class="kw-blue">==</span> ___:\n        <span class="kw-purple">return</span> <span class="kw-green">1</span>\n    <span class="kw-purple">return</span> n <span class="kw-blue">*</span> factorial(n <span class="kw-blue">-</span> <span class="kw-green">1</span>)`,
    blank:'0',opts:['0','1','n','None'],answer:'0',
    hint:'Rekursiya asosi: 0! = 1'
  },
  {
    code:`<span class="kw-purple">for</span> i <span class="kw-purple">in</span> <span class="kw-blue">range</span>(<span class="kw-orange">___</span>):\n    <span class="kw-blue">print</span>(i)`,
    blank:'10',opts:['5','10','range(10)','len()'],answer:'10',
    hint:'0 dan 9 gacha chiqarish uchun range(10)'
  },
  {
    code:`my_list = [<span class="kw-green">3</span>, <span class="kw-green">1</span>, <span class="kw-green">4</span>, <span class="kw-green">1</span>, <span class="kw-green">5</span>]\nmy_list.<span class="kw-orange">___</span>()`,
    blank:'sort',opts:['sort','order','arrange','sorted'],answer:'sort',
    hint:'Ro\'yxatni joyida tartiblash metodi'
  },
  {
    code:`<span class="kw-purple">class</span> <span class="kw-blue">Animal</span>:\n    <span class="kw-purple">def</span> <span class="kw-blue">__init__</span>(<span class="kw-orange">___</span>, name):\n        self.name = name`,
    blank:'self',opts:['self','this','cls','obj'],answer:'self',
    hint:'Python klasslarida birinchi parametr'
  },
  {
    code:`numbers = [<span class="kw-green">1</span>,<span class="kw-green">2</span>,<span class="kw-green">3</span>,<span class="kw-green">4</span>,<span class="kw-green">5</span>]\nresult = ___(<span class="kw-purple">lambda</span> x: x%<span class="kw-green">2</span>==<span class="kw-green">0</span>, numbers)`,
    blank:'filter',opts:['filter','map','reduce','list'],answer:'filter',
    hint:'Shartga mos elementlarni filtrlovchi funksiya'
  },
  {
    code:`d = {<span class="kw-red">"a"</span>: <span class="kw-green">1</span>, <span class="kw-red">"b"</span>: <span class="kw-green">2</span>}\nkeys = list(d.___())`,
    blank:'keys',opts:['keys','values','items','get'],answer:'keys',
    hint:'Lug\'atning kalitlarini olish'
  },
  {
    code:`<span class="kw-purple">try</span>:\n    x = <span class="kw-green">1</span> / <span class="kw-green">0</span>\n<span class="kw-orange">___</span> ZeroDivisionError:\n    <span class="kw-blue">print</span>(<span class="kw-red">"Xato!"</span>)`,
    blank:'except',opts:['except','catch','error','handle'],answer:'except',
    hint:'Python da xatolarni ushlash kalit so\'zi'
  },
  {
    code:`import ___\nnum = math.sqrt(<span class="kw-green">16</span>)`,
    blank:'math',opts:['math','cmath','numpy','calc'],answer:'math',
    hint:'Python ning matematik modul nomi'
  },
];

const ENGLISH_PAIRS = [
  ['Algorithm','Algoritm'],['Variable','O\'zgaruvchi'],['Function','Funksiya'],
  ['Database','Ma\'lumotlar bazasi'],['Network','Tarmoq'],['Security','Xavfsizlik'],
  ['Interface','Interfeys'],['Software','Dasturiy ta\'minot'],['Hardware','Apparat ta\'minot'],
  ['Compiler','Kompilyator'],['Debugger','Disk\'yuger'],['Framework','Freymvork'],
];

const PHYSICS_FORMULAS = [
  {expr:'F = ma',      name:'Nyuton 2-qonuni'},
  {expr:'E = mc²',     name:'Ekvivalentlik (Einstein)'},
  {expr:'V = IR',      name:'Om qonuni'},
  {expr:'P = mv',      name:'Impuls'},
  {expr:'W = Fd',      name:'Ish'},
  {expr:'KE = ½mv²',   name:'Kinetik energiya'},
  {expr:'λf = v',      name:'To\'lqin tenglamasi'},
  {expr:'PV = nRT',    name:'Ideal gaz qonuni'},
];

const LOGIC_QUESTIONS = [
  {q:'Bir qutida 3 ta qizil, 5 ta ko\'k shar bor. 2 ta shar tasodifiy olinsa, ikkalasi ham qizil bo\'lish ehtimoli qancha?', opts:['1/28','3/28','6/28','1/8'], ans:1},
  {q:'ABCDE harflaridan nechta 3 harfli kombinatsiya tuzish mumkin (takrorsiz)?', opts:['60','120','20','30'], ans:0},
  {q:'Agar barcha mushuklar hayvon bo\'lsa, va ba\'zi hayvonlar uy bilan yashasa, demak...', opts:['Ba\'zi mushuklar uy bilan yashaydi','Barcha mushuklar uy bilan yashaydi','Uy bilan yashaydigan hech narsa mushuk emas','Hech qaysi mushuk uy bilan yashamaydi'], ans:0},
  {q:'1, 1, 2, 3, 5, 8, 13, ... Keyingi son qaysi?', opts:['18','20','21','22'], ans:2},
  {q:'Agar n juft son bo\'lsa, n² ham juft bo\'ladi. 36 juft son. Demak...', opts:['36² juft','36 toq','36 juft emas','Hech narsa aniq emas'], ans:0},
  {q:'3 ta quti bor: A(2 olma), B(2 apelsin), C(1 olma+1 apelsin). Barchasiga noto\'g\'ri yorliq yopishtirilgan. A qutidan bitta olinsa — olma. A qutidagi nima?', opts:['2 olma','2 apelsin','1 olma+1 apelsin','Noma\'lum'], ans:0},
];

let currentGameData = {};
function onCorrect(pts=10){
  gameScore += pts + (gameStreak>=3?5:0);
  gameStreak++;
  gameQNum++;
  updateGameHeader();
  const cfg = GAME_CONFIGS[currentGame];
  if(gameQNum >= cfg.questions){clearInterval(gameTimerInt);finishGame(false);}
}
function onWrong(){
  gameStreak = 0;
  updateGameHeader();
}

// Math Game
let mathIdx = 0;

// Prog Game
let progIdx = 0;
function renderProgQ(){
  const q = CODE_QUESTIONS[progIdx % CODE_QUESTIONS.length];
  currentGameData = q;
  document.getElementById('gameContent').innerHTML = `
    <div style="margin-bottom:12px;font-size:13px;color:var(--text2)">🔍 Bo'sh joyni to'g'ri variant bilan to'ldiring:</div>
    <div class="code-block">${q.code.replace(q.blank,`<span class="code-blank" id="codeBlank">___</span>`)}</div>
    <div style="font-size:12px;color:var(--text3);margin-bottom:10px">💡 Maslahat: ${q.hint}</div>
    <div class="code-opts">
      ${q.opts.map(o=>`<div class="code-opt" onclick="checkCodeOpt(this,'${o}','${q.answer}')">${o}</div>`).join('')}
    </div>
    <div id="progFeedback" style="font-size:14px;font-weight:700;min-height:24px;margin-top:8px"></div>`;
}
function checkCodeOpt(el, chosen, correct){
  document.querySelectorAll('.code-opt').forEach(o=>o.classList.add('used'));
  const blank = document.getElementById('codeBlank');
  const fb = document.getElementById('progFeedback');
  if(chosen===correct){
    if(blank){blank.textContent=chosen;blank.style.color='#4ADE80';blank.style.borderColor='#4ADE80';}
    if(fb){fb.textContent='✅ To\'g\'ri! Kodni yaxshi bilasiz!';fb.style.color='var(--green)';}
    onCorrect(15);
    progIdx++;
    setTimeout(()=>renderProgQ(),900);
  } else {
    if(blank){blank.style.borderColor='var(--red)';blank.style.color='var(--red)';}
    if(fb){fb.textContent=`❌ Noto'g'ri. To'g'ri: ${correct}`;fb.style.color='var(--red)';}
    onWrong();
    setTimeout(()=>{progIdx++;renderProgQ();},1300);
  }
}

// English Word Match Game
let engSelected = {left:null, right:null};
let engMatched = new Set();
let engPairs = [];

// Physics Formula Game
let physMatched = new Set();
let physSelected = null;
function selectFormula(idx, expr){
  document.querySelectorAll('[id^=pf]').forEach(e=>{if(!e.classList.contains('matched'))e.classList.remove('selected');});
  const el = document.getElementById('pf'+idx);
  if(el.classList.contains('matched'))return;
  el.classList.add('selected');
  physSelected = {idx, expr, el};
}
function matchFormula(idx, expr, name){
  if(!physSelected)return;
  const el = document.getElementById('pn'+idx);
  if(el.classList.contains('matched'))return;
  const fb = document.getElementById('physFeedback');
  if(physSelected.expr===expr){
    physSelected.el.classList.remove('selected');
    physSelected.el.classList.add('matched');
    el.classList.add('matched');
    physMatched.add(expr);
    if(fb){fb.textContent='✅ To\'g\'ri! '+physSelected.expr+' = '+name;fb.style.color='var(--green)';}
    onCorrect(15);
    physSelected = null;
    if(physMatched.size>=5) setTimeout(()=>finishGame(false),500);
  } else {
    physSelected.el.classList.remove('selected');
    el.classList.add('wrong-sel');
    if(fb){fb.textContent='❌ Noto\'g\'ri! Qayta urinib ko\'ring.';fb.style.color='var(--red)';}
    onWrong();
    setTimeout(()=>el.classList.remove('wrong-sel'),600);
    physSelected = null;
  }
}

// Algo Sorting Game
let sortArr=[], sortStep=0;
let selectedBar = null;
function renderSortBars(){
  const el = document.getElementById('sortBars');
  if(!el)return;
  const colors=['#3B82F6','#7C3AED','#16A34A','#EA580C','#DB2777','#0D9488'];
  el.innerHTML = sortArr.map((v,i)=>`
    <div class="sort-bar" id="sb${i}" onclick="clickSortBar(${i})">
      <div class="sort-bar-val">${v}</div>
      <div class="sort-bar-rect" style="height:${v}px;background:${colors[i%colors.length]}"></div>
    </div>`).join('');
}
function clickSortBar(i){
  if(selectedBar===null){
    selectedBar=i;
    document.getElementById('sb'+i)?.style.setProperty('opacity','0.5');
  } else {
    // Swap
    [sortArr[selectedBar],sortArr[i]]=[sortArr[i],sortArr[selectedBar]];
    document.getElementById('sb'+selectedBar)?.style.setProperty('opacity','1');
    selectedBar=null;
    sortStep++;
    renderSortBars();
    onCorrect(5);
  }
}
function checkSorted(){
  const sorted=[...sortArr].sort((a,b)=>a-b);
  const isSorted=sortArr.every((v,i)=>v===sorted[i]);
  const fb=document.getElementById('algoFeedback');
  if(isSorted){
    document.querySelectorAll('.sort-bar-rect').forEach(b=>b.style.background='var(--green)');
    if(fb){fb.textContent='🎉 Ajoyib! Massiv to\'g\'ri tartibga solingan!';fb.style.color='var(--green)';}
    onCorrect(20);
    setTimeout(()=>finishGame(false),1500);
  } else {
    if(fb){fb.textContent='❌ Hali tartiblanmagan, davom eting!';fb.style.color='var(--red)';}
  }
}

// Logic Game
let logicIdx=0;
function renderLogicQ(){
  const q=LOGIC_QUESTIONS[logicIdx%LOGIC_QUESTIONS.length];
  document.getElementById('gameContent').innerHTML=`
    <div style="background:var(--bg);border-radius:var(--r2);padding:18px;margin-bottom:16px;border:1.5px solid var(--border)">
      <div style="font-size:12px;font-weight:700;color:var(--purple);margin-bottom:8px;text-transform:uppercase;letter-spacing:0.5px">🧩 Mantiq masalasi ${logicIdx+1}/${LOGIC_QUESTIONS.length}</div>
      <div style="font-size:15px;font-weight:600;line-height:1.6">${q.q}</div>
    </div>
    <div style="display:flex;flex-direction:column;gap:8px">
      ${q.opts.map((o,i)=>`<div class="quiz-opt" onclick="checkLogic(this,${i},${q.ans})">
        <div class="opt-ltr">${'ABCD'[i]}</div>${o}
      </div>`).join('')}
    </div>
    <div id="logicFeedback" style="font-size:14px;font-weight:700;min-height:28px;margin-top:10px;text-align:center"></div>`;
}
function checkLogic(el,chosen,correct){
  document.querySelectorAll('#gameContent .quiz-opt').forEach((o,i)=>{
    o.classList.add('locked');
    if(i===correct)o.classList.add('correct');
    else if(i===chosen&&chosen!==correct)o.classList.add('wrong');
  });
  const fb=document.getElementById('logicFeedback');
  if(chosen===correct){
    if(fb){fb.textContent='🧠 Aqlli! To\'g\'ri javob!';fb.style.color='var(--green)';}
    onCorrect(20);
  } else {
    if(fb){fb.textContent='❌ Noto\'g\'ri! Mantiqni qayta o\'ylang.';fb.style.color='var(--red)';}
    onWrong();
  }
  logicIdx++;
  setTimeout(()=>renderLogicQ(),1000);
}

function startDailyChallenge(){
  const d=new Date();
  const end=new Date(d.getFullYear(),d.getMonth(),d.getDate()+1);
  const el=document.getElementById('dcCountdown');
  if(el){
    clearInterval(window.dcInt);
    window.dcInt=setInterval(()=>{
      const now=new Date();
      const diff=end-now;
      const h=Math.floor(diff/3600000);
      const m=Math.floor((diff%3600000)/60000);
      const s=Math.floor((diff%60000)/1000);
      el.textContent=`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    },1000);
  }
}
function updateStreak(){
  const today=new Date().toDateString();
  const lastDay=localStorage.getItem('idu_last_day');
  if(lastDay!==today){
    localStorage.setItem('idu_last_day',today);
    streakDays++;
    if(streakDays>streakRecord){streakRecord=streakDays;localStorage.setItem('idu_streak_record',streakRecord);}
    localStorage.setItem('idu_streak',streakDays);
    const sn=document.getElementById('streakNum');if(sn)sn.textContent=streakDays;
    const sr=document.getElementById('streakRecord');if(sr)sr.textContent=streakRecord;
    showToast('🔥','Streak!',`${streakDays} kunlik streak davom etmoqda!`);
  }
}

function renderTimePage(){
  updatePomoDisplay();
  const sn=document.getElementById('streakNum');if(sn)sn.textContent=streakDays;
  const sr=document.getElementById('streakRecord');if(sr)sr.textContent=streakRecord;
  renderWeeklyGoals();
}

// Weekly Goals
let goals=[
  {text:'Matematika fanini o\'rganing (2 soat)',done:false,xp:30},
  {text:'Dasturlash mashqlarini bajaring',done:true,xp:25},
  {text:'Ingliz tili so\'z o\'rganing (20 ta)',done:false,xp:20},
  {text:'3 ta Pomodoro sessiyasi o\'tkazing',done:false,xp:40},
  {text:'Quiz yechimlarini tekshiring',done:true,xp:15},
  {text:'Startup g\'oyangizni yangilang',done:false,xp:35},
  {text:'Davomat 100% bo\'lsin',done:true,xp:50},
];
function renderWeeklyGoals(){
  const el=document.getElementById('weeklyGoals');if(!el)return;
  el.innerHTML=goals.map((g,i)=>`
    <div class="goal-item">
      <div class="goal-checkbox${g.done?' done':''}" onclick="toggleGoal(${i})">${g.done?'✓':''}</div>
      <div class="goal-text${g.done?' done':''}">${g.text}</div>
      <div class="goal-xp">+${g.xp} XP</div>
    </div>`).join('');
  const done=goals.filter(g=>g.done).length;
  const pb=document.getElementById('weeklyProgressBar');if(pb)pb.style.width=(done/goals.length*100)+'%';
  const pt=document.getElementById('weeklyProgressText');if(pt)pt.textContent=`${done}/${goals.length}`;
}
function toggleGoal(i){
  const was=goals[i].done;
  goals[i].done=!goals[i].done;
  if(!was){addXP(goals[i].xp,'Maqsad bajarildi');addCoins(5);}
  renderWeeklyGoals();
}
function addGoal(){
  const text=prompt('Yangi maqsad kiriting:');
  if(text)goals.push({text,done:false,xp:20});
  renderWeeklyGoals();
}
function setMood(val,el){
  document.querySelectorAll('.mood-btn').forEach(b=>b.classList.remove('selected'));
  el.classList.add('selected');
  const advices={
    5:'Ajoyib! Bugungi kunda maksimal samaraga erishing! 🚀',
    4:'Yaxshi kayfiyat — o\'qish uchun ideal vaqt! 📚',
    3:'Normal kun. Pomodoro taymeri bilan boshlang! 🍅',
    2:'Yomon kun bo\'lsa ham, 1 soat o\'qish kifoya. 💪',
    1:'Charchadingiz — dam oling. 30 daqiqa yotib turing! 😴'
  };
  const el2=document.getElementById('moodAdvice');
  if(el2){el2.textContent=advices[val];el2.style.display='block';}
  addXP(5,'Kayfiyat belgilandi');
}

// ════════════════════════════════════
//  GAMIFICATION PAGE
// ════════════════════════════════════
const ACHIEVEMENTS=[
  {icon:'🎮',name:'Birinchi o\'yin',desc:'Birinchi o\'yinni o\'ynadi',earned:false},
  {icon:'🔥',name:'3 kunlik streak',desc:'3 kun ketma-ket o\'qish',earned:false},
  {icon:'🧠',name:'Matematik daho',desc:'Matematika o\'yinida 90%+',earned:false},
  {icon:'💻',name:'Dasturchi',desc:'Kod o\'yinida 5 marta to\'g\'ri',earned:false},
  {icon:'🏆',name:'Top 10',desc:'Guruh reytingida Top 10',earned:true},
  {icon:'🌟',name:'100 ta o\'yin',desc:'100 ta o\'yin o\'ynaldi',earned:false},
  {icon:'🪙',name:'Millioner',desc:'1000 IDU Coin to\'plansin',earned:false},
  {icon:'⚡',name:'5-daraja',desc:'5-darajaga yeting',earned:false},
];
const REWARDS=[
  {emoji:'📜',name:'Sertifikat shabloni',cost:200},
  {emoji:'🎨',name:'Maxsus profil rasmi',cost:150},
  {emoji:'🏷️',name:'Noyob nishon',cost:300},
  {emoji:'⏰',name:'Ekstra Pomodoro',cost:50},
  {emoji:'🔓',name:'Qo\'shimcha test urinish',cost:100},
  {emoji:'🎭',name:'Animatsiyali avatar',cost:500},
];
const LB_DATA=[];
function renderGamification(){
  updateXPDisplays();
  renderAchievements();
  renderLB('xp');
  renderRewardShop();
}
function renderAchievements(){
  const el=document.getElementById('achievementsList');if(!el)return;
  el.innerHTML=ACHIEVEMENTS.map(a=>`
    <div class="badge-row" style="opacity:${a.earned?'1':'0.5'}">
      <div class="badge-icon">${a.icon}</div>
      <div><div class="badge-name">${a.name}</div><div class="badge-desc">${a.desc}</div></div>
      ${a.earned?`<div class="badge-reward" style="font-size:16px">✅</div>`:
      `<div style="font-size:11px;color:var(--text3);margin-left:auto">🔒</div>`}
    </div>`).join('');
}
function renderLB(key){
  const el=document.getElementById('gamificationLeaderboard');if(!el)return;
  const sorted=[...LB_DATA].sort((a,b)=>b[key]-a[key]);
  el.innerHTML=sorted.map((s,i)=>`
    <div class="rank-row">
      <div class="rank-pos${i<3?' rp-'+(i+1):''}">${i<3?['🥇','🥈','🥉'][i]:i+1}</div>
      <div class="rank-info"><div class="rank-name">${s.name}</div></div>
      <div class="rank-score">${key==='coins'?'🪙':key==='games'?'🎮':'⚡'} ${s[key]}</div>
    </div>`).join('');
}
function switchLB(key,el){
  document.querySelectorAll('.lb-tab').forEach(t=>t.classList.remove('active'));
  el.classList.add('active');
  renderLB(key);
}

// ════════════════════════════════════
//  APPLICATIONS SYSTEM
// ════════════════════════════════════
let APPLICATIONS = []; // {id, studentName, group, type:'cert'|'job', detail, price, company, date, status:'pending'|'approved'|'rejected', note}
let appIdCounter = 1;

// ════════════════════════════════════
//  PROFESSORS DATA — real API dan olinadi
// ════════════════════════════════════
const PROFESSORS_DATA = [];

let _profReviewTarget = null; // professor being reviewed
let _prmStarVal = 0;
let _prmCatVals = [0,0,0,0];
let _profFilterDept = 'all';

function getProfAvgRating(prof){
  if(!prof.ratings.length) return 0;
  return prof.ratings.reduce((s,r)=>s+r.overall,0)/prof.ratings.length;
}
function getProfCatAvg(prof, catIdx){
  if(!prof.ratings.length) return 0;
  return prof.ratings.reduce((s,r)=>s+(r.cats[catIdx]||0),0)/prof.ratings.length;
}
function starsHtml(rating, size){
  const full=Math.floor(rating); const half=rating-full>=0.4;
  let h=''; for(let i=1;i<=5;i++){
    if(i<=full) h+=`<span style="font-size:${size||14}px;color:#FBBF24">★</span>`;
    else if(i===full+1&&half) h+=`<span style="font-size:${size||14}px;color:#FBBF24">½</span>`;
    else h+=`<span style="font-size:${size||14}px;color:#E2E8F0">★</span>`;
  } return h;
}
function getRatingDist(prof){
  const dist={1:0,2:0,3:0,4:0,5:0};
  prof.ratings.forEach(r=>{ dist[r.overall]=(dist[r.overall]||0)+1; });
  return dist;
}

function renderProfessorsPage(){
  const isRu = currentLang==='ru';
  // update page title
  const ptEl=document.getElementById('prof-page-title');
  if(ptEl) ptEl.textContent=isRu?'⭐ Оценки преподавателей':'⭐ Ustozlarni baholash';
  const psEl=document.getElementById('prof-page-sub');
  if(psEl) psEl.textContent=isRu?'Анонимные отзывы — ваше имя никогда не будет показано':'Anonim sharh va reyting — faqat siz ko\'rsatasiz, ism ko\'rinmaydi';

  const query=(document.getElementById('profSearchInput')?.value||'').toLowerCase();
  let profs = PROFESSORS_DATA.filter(p=>{
    const matchQ = !query || p.name.toLowerCase().includes(query) || p.subject.toLowerCase().includes(query) || p.tags.some(t=>t.toLowerCase().includes(query));
    const matchF = _profFilterDept==='all' || p.dept===_profFilterDept;
    return matchQ && matchF;
  });
  // Sort by avg rating desc
  profs.sort((a,b)=>getProfAvgRating(b)-getProfAvgRating(a));

  // Stats row
  const totalReviews = PROFESSORS_DATA.reduce((s,p)=>s+p.ratings.length,0);
  const allRatings = PROFESSORS_DATA.flatMap(p=>p.ratings.map(r=>r.overall));
  const globalAvg = allRatings.length ? (allRatings.reduce((s,r)=>s+r,0)/allRatings.length).toFixed(1) : '—';
  const statsEl=document.getElementById('profStatsRow');
  if(statsEl) statsEl.innerHTML=`
    <div class="prof-stat-card"><div class="prof-stat-val">${PROFESSORS_DATA.length}</div><div class="prof-stat-lbl">${isRu?'Преподавателей':'Ustozlar'}</div></div>
    <div class="prof-stat-card"><div class="prof-stat-val">${totalReviews}</div><div class="prof-stat-lbl">${isRu?'Отзывов':'Sharhlar'}</div></div>
    <div class="prof-stat-card"><div class="prof-stat-val">${globalAvg}★</div><div class="prof-stat-lbl">${isRu?'Средний рейтинг':'O\'rtacha reyting'}</div></div>
  `;

  // Filter row
  const depts = ['all',...new Set(PROFESSORS_DATA.map(p=>p.dept))];
  const filterEl=document.getElementById('profFilterRow');
  if(filterEl) filterEl.innerHTML=depts.map(d=>`
    <button class="filter-chip${_profFilterDept===d?' active':''}" onclick="_profFilterDept='${d}';renderProfessorsPage()">
      ${d==='all'?(isRu?'Все':'Barchasi'):d}
    </button>`).join('');

  // Professor grid
  const gridEl=document.getElementById('profGrid');
  if(!gridEl) return;
  if(!profs.length){
    gridEl.innerHTML=`<div style="grid-column:1/-1;text-align:center;padding:40px;color:#64748B">${isRu?'Преподаватели не найдены':'Ustoz topilmadi'}</div>`;
    return;
  }
  gridEl.innerHTML=profs.map(p=>{
    const avg=getProfAvgRating(p);
    const dist=getRatingDist(p);
    const recentReviews=p.ratings.slice(-2).reverse();
    const cats=[
      isRu?'📚 Объяснение':'📚 Tushuntirish',
      isRu?'⏰ Пунктуальность':'⏰ Vaqtinchalik',
      isRu?'🤝 Отношение':'🤝 Munosabat',
      isRu?'📝 Задания':'📝 Vazifalar'
    ];
    return `
    <div class="prof-card" id="profcard-${p.id}">
      <div class="prof-card-head">
        <div class="prof-avatar" style="background:${p.color}">${p.short}</div>
        <div style="flex:1">
          <div class="prof-name">${p.name}</div>
          <div class="prof-subject" style="font-size:11.5px">${p.subject}</div>
          <div style="font-size:10px;color:#94A3B8;margin-top:2px">🏛️ ${p.dept}</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:20px;font-weight:900;color:#0F172A;line-height:1">${avg>0?avg.toFixed(1):'—'}</div>
          <div style="font-size:10px;color:#64748B">${isRu?`${p.ratings.length} отзывов`:`${p.ratings.length} sharh`}</div>
        </div>
      </div>
      <!-- Rating bar -->
      <div style="margin-bottom:10px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
          <div>${starsHtml(avg,15)}</div>
          <div style="font-size:11px;color:#94A3B8">${avg>0?avg.toFixed(1)+'/5':'—'}</div>
        </div>
        <div class="prof-rating-bar-wrap"><div class="prof-rating-bar-fill" style="width:${avg/5*100}%"></div></div>
      </div>
      <!-- Distribution (compact) -->
      ${p.ratings.length>0?`<div style="margin-bottom:10px">${[5,4,3,2,1].map(n=>`
        <div class="rating-dist-row">
          <div class="rating-dist-label">${n}★</div>
          <div class="rating-dist-bar"><div class="rating-dist-fill" style="width:${p.ratings.length?(dist[n]/p.ratings.length*100):0}%"></div></div>
          <div class="rating-dist-count">${dist[n]}</div>
        </div>`).join('')}</div>`:''}
      <!-- Tags -->
      <div class="prof-tags">${p.tags.map(t=>`<span class="prof-tag">${t}</span>`).join('')}</div>
      <!-- Category averages -->
      ${p.ratings.length>0?`<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px">
        ${cats.map((cat,ci)=>{
          const catAvg=getProfCatAvg(p,ci);
          return `<div style="background:#F8FAFC;border-radius:8px;padding:7px 10px">
            <div style="font-size:10px;color:#64748B;margin-bottom:3px">${cat}</div>
            <div style="font-size:12px;font-weight:700;color:#0F172A">${catAvg>0?catAvg.toFixed(1)+'★':'—'}</div>
          </div>`;
        }).join('')}
      </div>`:''}
      <!-- Recent reviews -->
      ${recentReviews.length?`<div class="prof-reviews-preview">
        <div style="font-size:11px;font-weight:700;color:#0F172A;margin-bottom:5px">${isRu?'Последние отзывы:':'So\'nggi sharhlar:'}</div>
        ${recentReviews.map(r=>`
          <div class="prof-review-item">
            <div class="prof-anon-badge">🔒 ${isRu?'Анонимно':'Anonim'} · ${r.time} · ${'★'.repeat(r.overall)}</div>
            ${r.comment?`<div>${r.comment}</div>`:''}
          </div>`).join('')}
      </div>`:'<div style="font-size:12px;color:#94A3B8;text-align:center;padding:8px">'+(isRu?'Ещё нет отзывов':'Hali sharh yo\'q')+'</div>'}
      <!-- Rate button -->
      <button class="prof-btn-rate" onclick="openProfReview(${p.id})">
        ⭐ ${isRu?'Оценить преподавателя':'Ustozni baholash'}
      </button>
    </div>`;
  }).join('');
}
function setPrmStar(n){
  _prmStarVal=n;
  updatePrmStarsUI();
  const hints=['','😞 Juda yomon','😕 Yomon','😐 O\'rtacha','🙂 Yaxshi','😄 A\'lo'];
  const hintsRu=['','😞 Очень плохо','😕 Плохо','😐 Нормально','🙂 Хорошо','😄 Отлично'];
  const hintEl=document.getElementById('prmStarHint');
  if(hintEl) hintEl.textContent=(currentLang==='ru'?hintsRu:hints)[n]||'';
}
function updatePrmStarsUI(){
  const stars=document.querySelectorAll('#prmStarsRow .prm-star');
  stars.forEach((s,i)=>{
    s.classList.toggle('active',i<_prmStarVal);
  });
}
function setPrmCat(catIdx, n){
  _prmCatVals[catIdx-1]=n;
  updatePrmCatUI(catIdx);
}
function updatePrmCatUI(catIdx){
  const stars=document.querySelectorAll('#prmCat'+catIdx+' .prm-cat-star');
  stars.forEach((s,i)=>{
    s.classList.toggle('active',i<_prmCatVals[catIdx-1]);
  });
}
function submitProfReview(){
  const isRu=currentLang==='ru';
  if(!_prmStarVal){
    showToast('⚠️',isRu?'Ошибка':'Xato',isRu?'Umumiy baho qo\'yishingiz kerak!':'Umumiy baho qo\'yishingiz kerak!');
    return;
  }
  const comment=document.getElementById('prmComment').value.trim();
  const now=new Date();
  const timeStr=isRu?`Только что`:`Hozirgina`;
  const review={
    overall:_prmStarVal,
    cats:[..._prmCatVals],
    comment,
    time:timeStr
  };
  _profReviewTarget.ratings.push(review);
  _profReviewTarget.totalReviews++;
  closeProfReview();
  showToast('✅',isRu?'Отзыв отправлен!':'Sharh yuborildi!',isRu?'Fikringiz anonim saqlanadi':'Fikringiz anonim saqlanadi');
  renderProfessorsPage();
}

const PARTNERS=[
  {
    id:1, logo:'🛒', name:'Uzum Market', type:'IT kompaniya', color:'#F97316',
    desc:'O\'zbekistonning yetakchi e-commerce platformasi. 10M+ mijoz, 50M+ mahsulot.',
    website:'uzum.uz', location:'Toshkent', employees:'1000+',
    vacancies:[
      {id:101,title:'Junior Frontend Developer',salary:'3,000,000 – 5,000,000',stype:'Full-time',tags:['React','JavaScript','CSS'],desc:'React asosida foydalanuvchi interfeyslari yaratish va qo\'llab-quvvatlash.',requirements:['JavaScript va React bilimi','Git tajribasi','GPA 3.0+','Jamoa bilan ishlash qobiliyati']},
      {id:102,title:'Data Analyst',salary:'4,000,000 – 7,000,000',stype:'Full-time',tags:['Python','SQL','Tableau'],desc:'Sotuvlar va foydalanuvchi xulqini tahlil qilish, dashboard yaratish.',requirements:['Python va SQL bilimi','Statistika asoslari','Vizualizatsiya tajribasi']},
      {id:103,title:'QA Engineer',salary:'2,500,000 – 4,500,000',stype:'Full-time',tags:['Testing','Selenium','Manual'],desc:'Mobil va web ilovalarni manual va avtomatik testlash.',requirements:['Testing metodologiyasi','E\'tibor va aniqlik','JIRA bilan ishlash']},
    ]
  },
  {
    id:2, logo:'🚀', name:'EPAM Uzbekistan', type:'Global Software', color:'#1B4FD8',
    desc:'50+ mamlakatda faoliyat yurituvchi global IT xizmatlar kompaniyasi.',
    website:'epam.com', location:'Toshkent / Remote', employees:'58,000+',
    vacancies:[
      {id:201,title:'Software Engineer Trainee',salary:'2,000,000 – 4,000,000',stype:'Amaliyot',tags:['Java','Python','OOP'],desc:'EPAM Learning Lab dasturi — amaliyot va professional o\'sish imkoniyati.',requirements:['OOP bilimi','Ingliz tili B1+','Loyiha tajribasi yoki portfolio']},
      {id:202,title:'DevOps Engineer',salary:'8,000,000 – 15,000,000',stype:'Full-time',tags:['Docker','Kubernetes','CI/CD'],desc:'Infratuzilma avtomatlashtirish va deployment pipeline yaratish.',requirements:['Linux tajribasi 2+ yil','Docker va Kubernetes','CI/CD amaliyoti']},
      {id:203,title:'Business Analyst',salary:'5,000,000 – 9,000,000',stype:'Full-time',tags:['BPMN','Jira','Requirements'],desc:'Biznes talablarini texnik spesifikatsiyaga aylantirish va jamoani yo\'naltirish.',requirements:['BA asoslari','BPMN modellash','Ingliz tili B2+']},
      {id:204,title:'QA Automation Engineer',salary:'6,000,000 – 10,000,000',stype:'Full-time',tags:['Selenium','Java','TestNG'],desc:'Avtomatik test skriptlari yozish va test framework qurish.',requirements:['Java yoki Python','Selenium tajribasi','TestNG/JUnit bilimi']},
      {id:205,title:'Project Manager',salary:'7,000,000 – 12,000,000',stype:'Full-time',tags:['Agile','Scrum','PMP'],desc:'IT loyihalarni boshqarish, jamoani koordinatsiya qilish.',requirements:['PM tajribasi 2+ yil','Scrum/Kanban','Ingliz tili C1']},
    ]
  },
  {
    id:3, logo:'💻', name:'IT Park',type:'Texnopark', color:'#0D9488',
    desc:'O\'zbekistondagi IT ekotizimini rivojlantiruvchi davlat texnoparkasi.',
    website:'itpark.uz', location:'Toshkent', employees:'200+',
    vacancies:[
      {id:301,title:'Startup Coordinator',salary:'3,500,000 – 5,500,000',stype:'Full-time',tags:['Startup','Mentoring','Events'],desc:'Startap jamoalarini qo\'llab-quvvatlash va akselerator dasturlarini boshqarish.',requirements:['Startap ekotizimi bilimlari','Kommunikatsiya ko\'nikmalari','Loyiha boshqaruvi']},
      {id:302,title:'IT Specialist',salary:'4,000,000 – 6,000,000',stype:'Full-time',tags:['Network','Windows','Linux'],desc:'IT Park infratuzilmasini saqlash va texnik yordam ko\'rsatish.',requirements:['Tarmoq asoslari','Windows/Linux admin','Muammoni tezkor hal qilish']},
      {id:303,title:'Marketing Manager',salary:'4,500,000 – 7,000,000',stype:'Full-time',tags:['SMM','Content','Analytics'],desc:'IT Park ijtimoiy tarmoqlar, PR va brending strategiyasi.',requirements:['SMM tajribasi','Ijodiy yozish','Ingliz tili B1+']},
      {id:304,title:'Community Manager',salary:'3,000,000 – 4,500,000',stype:'Part-time',tags:['Events','Networking','Community'],desc:'IT hamjamiyat tadbirlarini tashkil etish va a\'zolar bilan muloqot.',requirements:['Tashkilotchilik','Ijtimoiy ko\'nikmalar','Telegram/Discord']},
      {id:305,title:'Grant Manager',salary:'5,000,000 – 8,000,000',stype:'Full-time',tags:['Grants','Finance','Reporting'],desc:'IT kompaniyalarga grant va subsidiya dasturlarini boshqarish.',requirements:['Moliya asoslari','Grant yozish','Ingliz tili B2+']},
      {id:306,title:'HR Specialist',salary:'3,500,000 – 5,000,000',stype:'Full-time',tags:['Recruitment','HR','Training'],desc:'IT Park xodimlari ishga qabul va o\'qitish dasturlari.',requirements:['HR asoslari','Intervyu o\'tkazish','Kuchli kommunikatsiya']},
    ]
  },
  {
    id:4, logo:'📡', name:'Beeline Uzbekistan', type:'Telekommunikatsiya', color:'#FBBF24',
    desc:'O\'zbekistondagi yetakchi telekommunikatsiya operatori. 10M+ abonent.',
    website:'beeline.uz', location:'Toshkent', employees:'3000+',
    vacancies:[
      {id:401,title:'Network Engineer',salary:'6,000,000 – 10,000,000',stype:'Full-time',tags:['Cisco','5G','Networking'],desc:'Tarmoq infratuzilmasini rejalashtirish va optimallashtirish.',requirements:['CCNA/CCNP sertifikati','3+ yil tajriba','5G texnologiyalari']},
      {id:402,title:'IT Support Specialist',salary:'3,000,000 – 5,000,000',stype:'Full-time',tags:['Helpdesk','Windows','Hardware'],desc:'Korporativ foydalanuvchilarga texnik yordam ko\'rsatish.',requirements:['IT asoslari','Muloqotchanlik','Stressga chidamlilik']},
    ]
  },
  {
    id:5, logo:'💳', name:'Humans.uz', type:'Fintech', color:'#7C3AED',
    desc:'O\'zbekistondagi fintech yetakchisi — to\'lov, kredit va bank xizmatlari.',
    website:'humans.uz', location:'Toshkent', employees:'500+',
    vacancies:[
      {id:501,title:'Mobile Developer (Flutter)',salary:'7,000,000 – 12,000,000',stype:'Full-time',tags:['Flutter','Dart','iOS/Android'],desc:'Humans super-app mobil ilovasi funksionallarini ishlab chiqish.',requirements:['Flutter/Dart 2+ yil','REST API integratsiya','iOS/Android publish tajribasi']},
      {id:502,title:'Backend Developer',salary:'8,000,000 – 14,000,000',stype:'Full-time',tags:['Python','Django','PostgreSQL'],desc:'To\'lov tizimi va API backend ishlab chiqish va qo\'llab-quvvatlash.',requirements:['Python/Django 2+ yil','PostgreSQL/Redis','Fintech bilimi + bonus']},
      {id:503,title:'Product Manager',salary:'9,000,000 – 16,000,000',stype:'Full-time',tags:['Product','Roadmap','Analytics'],desc:'Mahsulot strategiyasini belgilash va rivojlantirish yo\'nalishini boshqarish.',requirements:['PM tajribasi 3+ yil','Fintech tushunish','Ma\'lumotlarga asoslangan qaror']},
      {id:504,title:'UI/UX Designer',salary:'5,000,000 – 9,000,000',stype:'Full-time',tags:['Figma','UX','Design System'],desc:'Humans ilovasi dizayn tizimini rivojlantirish va yangi funksiyalar prototiplash.',requirements:['Figma/Adobe XD','UX tadqiqot metodlari','Portfolio talab qilinadi']},
    ]
  },
  {
    id:6, logo:'🏗️', name:'Texnoservis', type:'IT Outsourcing', color:'#059669',
    desc:'O\'rta Osiyo bo\'yicha IT outsourcing va digital transformation xizmatlari.',
    website:'texnoservis.uz', location:'Toshkent / Samarqand', employees:'150+',
    vacancies:[
      {id:601,title:'Full Stack Developer',salary:'5,000,000 – 10,000,000',stype:'Full-time',tags:['Node.js','React','MongoDB'],desc:'Mijozlar uchun web ilovalar yaratish — frontenddan backendgacha.',requirements:['Node.js va React bilimi','MongoDB/PostgreSQL','API dizayn tajribasi']},
      {id:602,title:'Python Developer (Intern)',salary:'1,500,000 – 2,500,000',stype:'Amaliyot',tags:['Python','Django','REST'],desc:'Boshlang\'ich darajadagi Python dasturchilarga amaliyot imkoniyati.',requirements:['Python asoslari','Django/Flask kirish darajasi','Ishlash va o\'rganish istagi']},
      {id:603,title:'System Administrator',salary:'4,500,000 – 7,500,000',stype:'Full-time',tags:['Linux','VMware','Backup'],desc:'Server va virtual infratuzilmani boshqarish va monitoring.',requirements:['Linux 2+ yil','VMware/HyperV','Zabbix/Nagios monitoring']},
    ]
  },
];

// ── Hamkorlar state ─────────────────────────────────
let _activeJobFilter = 'all';
let _activeDetailVacancy = null;
let _activeDetailPartner = null;
let _activePartnersTab = 'vacancies';

function renderPremiumPage(){
  // Update stats
  const totalVac = PARTNERS.reduce((s,p)=>s+p.vacancies.length,0);
  const myAppsCount = APPLICATIONS.filter(a=>a.studentName===currentUser?.name).length;
  const el1 = document.getElementById('hstat-vacancies'); if(el1) el1.textContent = totalVac;
  const el2 = document.getElementById('hstat-apps'); if(el2) el2.textContent = myAppsCount;
  // App badge
  const badge = document.getElementById('appCountBadge');
  if(badge){ badge.textContent=myAppsCount; badge.style.display=myAppsCount?'flex':'none'; }
  // Render current tab
  if(_activePartnersTab === 'vacancies') renderVacancies();
  else if(_activePartnersTab === 'companies') renderCompanies();
}

function switchPartnersTab(tab){
  _activePartnersTab = tab;
  ['vacancies','companies','certs'].forEach(t=>{
    const el = document.getElementById('tab-'+t); if(el) el.style.display = t===tab?'block':'none';
    const btn = document.getElementById('ptab-'+t); if(btn) btn.classList.toggle('active', t===tab);
  });
  if(tab==='vacancies') renderVacancies();
  else if(tab==='companies') renderCompanies();
}

function setJobFilter(type, btn){
  _activeJobFilter = type;
  document.querySelectorAll('.jf-chip').forEach(c=>c.classList.remove('active'));
  if(btn) btn.classList.add('active');
  renderVacancies();
}

function renderVacancies(){
  const el = document.getElementById('vacancyList'); if(!el) return;
  const q = (document.getElementById('vacancySearch')?.value||'').toLowerCase();
  const filter = _activeJobFilter;

  let html = '';
  let count = 0;
  PARTNERS.forEach(p=>{
    p.vacancies.forEach(v=>{
      if(filter !== 'all' && v.stype !== filter) return;
      if(q && !v.title.toLowerCase().includes(q) && !v.tags.join(' ').toLowerCase().includes(q) && !p.name.toLowerCase().includes(q)) return;
      count++;
      const alreadyApplied = APPLICATIONS.some(a=>a.studentName===currentUser?.name&&a.company===p.name&&a.detail===v.title);
      const stypeClass = v.stype==='Full-time'?'stype-full':v.stype==='Part-time'?'stype-part':'stype-intern';
      html += `
      <div class="vacancy-card" onclick="showJobDetail(${p.id},${v.id})">
        <div class="vc-top">
          <div class="vc-logo" style="background:${p.color}22">${p.logo}</div>
          <div style="flex:1;min-width:0">
            <div class="vc-company">${p.name} · ${p.location}</div>
            <div class="vc-title">${v.title}</div>
          </div>
          <div class="vc-salary">${v.salary} so'm</div>
        </div>
        <div class="vc-tags">${v.tags.map(t=>`<span class="vc-tag">${t}</span>`).join('')}</div>
        <div class="vc-bottom">
          <span class="stype-badge ${stypeClass}">${v.stype}</span>
          <span class="vc-location">📍 ${p.location}</span>
          <div style="margin-left:auto;display:flex;gap:8px">
            ${alreadyApplied
              ? `<span style="padding:5px 12px;background:var(--green-light);color:var(--green);border-radius:7px;font-size:12px;font-weight:700">✅ Yuborilgan</span>`
              : `<button class="btn btn-primary btn-sm" onclick="event.stopPropagation();applyJobDirect(${p.id},${v.id})">Ariza yuborish</button>`
            }
          </div>
        </div>
      </div>`;
    });
  });

  if(!count) html = `<div class="empty-state"><div class="empty-state-icon">🔍</div><div>Vakansiya topilmadi</div><div style="font-size:13px;color:var(--text3);margin-top:4px">Qidiruv so'zini o'zgartiring yoki filterni olib tashlang</div></div>`;
  el.innerHTML = html;
}

function renderCompanies(){
  const el = document.getElementById('companyGrid'); if(!el) return;
  el.innerHTML = PARTNERS.map(p=>`
    <div class="company-big-card" onclick="filterByCompany('${p.name}')">
      <div class="cbc-header" style="background:${p.color}"></div>
      <div class="cbc-body">
        <div class="cbc-logo">${p.logo}</div>
        <div class="cbc-name">${p.name}</div>
        <div class="cbc-type">${p.type} · ${p.employees} xodim</div>
        <div class="cbc-desc">${p.desc}</div>
        <div class="cbc-footer">
          <span class="cbc-vaccount">+${p.vacancies.length} vakansiya</span>
          <button class="btn btn-primary btn-sm">Ko'rish →</button>
        </div>
      </div>
    </div>`).join('');
}

function filterByCompany(name){
  _activeJobFilter = 'all';
  switchPartnersTab('vacancies');
  const search = document.getElementById('vacancySearch');
  if(search){ search.value = name; }
  document.querySelectorAll('.jf-chip').forEach(c=>c.classList.remove('active'));
  const allChip = document.querySelector('.jf-chip');
  if(allChip) allChip.classList.add('active');
  renderVacancies();
}

function showJobDetail(partnerId, vacancyId){
  const p = PARTNERS.find(x=>x.id===partnerId);
  const v = p?.vacancies.find(x=>x.id===vacancyId);
  if(!p||!v) return;
  _activeDetailPartner = p;
  _activeDetailVacancy = v;

  document.getElementById('jdmLogo').textContent = p.logo;
  document.getElementById('jdmLogo').style.background = p.color+'22';
  document.getElementById('jdmTitle').textContent = v.title;
  document.getElementById('jdmCompany').textContent = `${p.name} · ${p.type} · ${p.location}`;

  const stypeClass = v.stype==='Full-time'?'stype-full':v.stype==='Part-time'?'stype-part':'stype-intern';
  document.getElementById('jdmMeta').innerHTML = `
    <span class="stype-badge ${stypeClass}" style="padding:5px 12px">${v.stype}</span>
    <span style="padding:5px 12px;background:var(--green-light);color:var(--green);border-radius:7px;font-size:12px;font-weight:700">💰 ${v.salary} so'm</span>
    <span style="padding:5px 12px;background:var(--bg2);color:var(--text2);border-radius:7px;font-size:12px">📍 ${p.location}</span>`;

  document.getElementById('jdmDesc').textContent = v.desc;
  document.getElementById('jdmReqs').innerHTML = v.requirements.map(r=>`
    <div class="jdm-req-item"><span style="color:var(--green);font-size:16px;flex-shrink:0">✓</span> ${r}</div>`).join('');
  document.getElementById('jdmTags').innerHTML = v.tags.map(t=>`<span class="vc-tag" style="font-size:13px;padding:5px 12px">${t}</span>`).join('');

  const already = APPLICATIONS.some(a=>a.studentName===currentUser?.name&&a.company===p.name&&a.detail===v.title);
  const btn = document.getElementById('jdmApplyBtn');
  if(already){ btn.textContent='✅ Ariza allaqachon yuborilgan'; btn.disabled=true; btn.style.opacity='0.6'; }
  else { btn.textContent='📩 Ariza yuborish'; btn.disabled=false; btn.style.opacity='1'; }

  document.getElementById('jobDetailModal').style.display = 'flex';
}

function applyFromDetail(){
  if(!_activeDetailPartner || !_activeDetailVacancy) return;
  closeJobDetail();
  applyJobDirect(_activeDetailPartner.id, _activeDetailVacancy.id);
}

function applyJobDirect(partnerId, vacancyId){
  const p = PARTNERS.find(x=>x.id===partnerId);
  const v = p?.vacancies.find(x=>x.id===vacancyId);
  if(!p||!v) return;
  applyJob(p.name, p.type, p.vacancies.length, v.title, v.stype);
}

// ── LEGACY applyJob (updated signature) ─────────────

// ════ JOB APPLY MODAL ════
let currentApplyCompany = null;
let resumeFileData = null;

function applyJob(companyName, companyType, vacancy, preselectedPosition, positionType){
  if(!currentUser){ showToast('⚠️','Xato','Iltimos avval tizimga kiring'); return; }
  currentApplyCompany = {name:companyName, type:companyType, vacancy};

  // Find partner
  const partner = PARTNERS.find(p=>p.name===companyName);
  const positions = partner ? partner.vacancies.map(v=>v.title) : ['Umumiy ariza'];

  // Pre-fill user info
  const nameParts = (currentUser.name||'').split(' ');
  document.getElementById('applyFirstName').value = nameParts[1]||nameParts[0]||'';
  document.getElementById('applyLastName').value = nameParts[0]||'';
  document.getElementById('applyEmail').value = (currentUser.login||'')+'@idu.uz';
  document.getElementById('applyPhone').value = '';
  document.getElementById('applyBio').value = '';
  document.getElementById('applyFormError').style.display='none';

  // Set positions dropdown
  const sel = document.getElementById('applyPosition');
  sel.innerHTML = positions.map(p=>`<option>${p}</option>`).join('');
  if(preselectedPosition){ sel.value = preselectedPosition; }

  // Logo & title
  document.getElementById('jobModalLogo').textContent = partner?.logo||'🏢';
  document.getElementById('jobModalTitle').textContent = companyName;
  document.getElementById('jobModalSub').textContent = `${companyType} · +${vacancy} vakansiya`;

  // Check already applied
  const already = APPLICATIONS.find(a=>a.studentName===currentUser.name&&a.company===companyName&&a.type==='job'&&(!preselectedPosition||a.detail===preselectedPosition));
  document.getElementById('alreadyAppliedWarn').style.display = already ? 'block' : 'none';

  // Reset resume
  clearResume();

  // Open modal
  document.getElementById('jobApplyModal').style.display='flex';
}

function handleResumeSelect(input){
  const file = input.files[0];
  if(!file) return;
  setResumeFile(file);
}

function handleResumeDrop(event){
  event.preventDefault();
  const file = event.dataTransfer.files[0];
  if(!file) return;
  document.getElementById('resumeDropZone').style.borderColor='var(--border2)';
  document.getElementById('resumeDropZone').style.background='var(--bg)';
  setResumeFile(file);
}

function setResumeFile(file){
  const allowed = ['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
  if(!allowed.includes(file.type) && !file.name.match(/\.(pdf|doc|docx)$/i)){
    showToast('❌','Noto\'g\'ri fayl turi','Faqat PDF, DOC, DOCX fayllar qabul qilinadi');
    return;
  }
  if(file.size > 5*1024*1024){
    showToast('❌','Fayl juda katta','Maksimal hajm: 5MB');
    return;
  }
  resumeFileData = {name: file.name, size: file.size, type: file.type};
  document.getElementById('resumeDropZone').style.display='none';
  const info = document.getElementById('resumeFileInfo');
  info.style.display='flex';
  document.getElementById('resumeFileName').textContent = file.name;
  const kb = (file.size/1024).toFixed(1);
  document.getElementById('resumeFileSize').textContent = kb > 1024 ? (kb/1024).toFixed(1)+' MB' : kb+' KB';
  document.getElementById('resumeDropText').textContent = file.name;
}

function clearResume(){
  resumeFileData = null;
  document.getElementById('resumeFileInput').value='';
  document.getElementById('resumeDropZone').style.display='block';
  document.getElementById('resumeFileInfo').style.display='none';
  document.getElementById('resumeDropText').textContent='Faylni bu yerga tashlang yoki bosing';
}

function submitJobApplication(){
  const firstName = document.getElementById('applyFirstName').value.trim();
  const lastName = document.getElementById('applyLastName').value.trim();
  const phone = document.getElementById('applyPhone').value.trim();
  const email = document.getElementById('applyEmail').value.trim();
  const position = document.getElementById('applyPosition').value;
  const bio = document.getElementById('applyBio').value.trim();
  const errEl = document.getElementById('applyFormError');

  // Validation
  if(!firstName || !lastName){
    errEl.textContent='❌ Ism va familiya to\'ldirilishi shart!'; errEl.style.display='block'; return;
  }
  if(!phone || phone.replace(/\s/g,'').length < 9){
    errEl.textContent='❌ Telefon raqam to\'g\'ri kiriting (9 raqam)!'; errEl.style.display='block'; return;
  }
  if(!resumeFileData){
    errEl.textContent='❌ Resume fayl yuklash majburiy!'; errEl.style.display='block'; return;
  }
  errEl.style.display='none';

  const now = new Date();
  const app = {
    id: appIdCounter++,
    studentName: currentUser.name,
    group: currentUser.group||'—',
    type: 'job',
    detail: position,
    company: currentApplyCompany.name,
    price: '—',
    phone: '+998 '+phone,
    email: email,
    fullName: lastName+' '+firstName,
    bio: bio,
    resumeFile: resumeFileData.name,
    resumeSize: resumeFileData.size,
    date: now.toLocaleDateString('uz-UZ'),
    dateRaw: now,
    status: 'pending',
    note: ''
  };
  APPLICATIONS.push(app);
  updateAppBadges();
  closeJobModal();
  showToast('📩','Ariza muvaffaqiyatli yuborildi!',`${currentApplyCompany?.name||'Kompaniya'} ga "${position}" lavozimi uchun ariza qabul qilindi`);
  addCoins(10,'Ish arizasi bonusi');
}

function buyCert(certName, price){
  if(!currentUser){ showToast('⚠️','Xato','Iltimos avval tizimga kiring'); return; }
  const already = APPLICATIONS.find(a=>a.studentName===currentUser.name&&a.detail===certName&&a.type==='cert');
  if(already){
    showToast('⚠️','Allaqachon buyurtma qilingan',`${certName} sertifikati uchun ariza berilgan (Holat: ${getStatusLabel(already.status)})`);
    return;
  }
  const now = new Date();
  const app = {
    id: appIdCounter++,
    studentName: currentUser.name,
    group: currentUser.group||'—',
    type: 'cert',
    detail: certName,
    company: 'IDU Sertifikat markazi',
    price: price+" so'm",
    date: now.toLocaleDateString('uz-UZ'),
    dateRaw: now,
    status: 'pending',
    note: ''
  };
  APPLICATIONS.push(app);
  updateAppBadges();
  showToast('🎓','Buyurtma qabul qilindi!',`${certName} sertifikati uchun ariza yuborildi. Dekanat tekshiradi.`);
  addCoins(20,'Sertifikat buyurtma bonusi');
}

function getStatusLabel(status){
  return {pending:'⏳ Kutilmoqda', approved:'✅ Tasdiqlandi', rejected:'❌ Rad etildi'}[status]||status;
}
function getStatusStyle(status){
  return {
    pending:'background:var(--yellow-light);color:var(--yellow)',
    approved:'background:var(--green-light);color:var(--green)',
    rejected:'background:var(--red-light);color:var(--red)'
  }[status]||'';
}

function updateAppBadges(){
  const pending = APPLICATIONS.filter(a=>a.status==='pending').length;
  // Dekanat badge
  const dekBadge = document.getElementById('dekAppBadge');
  if(dekBadge){ dekBadge.textContent=pending; }
  // Also update si-badge in sidebar for dekanat
  document.querySelectorAll('.sidebar-item').forEach(btn=>{
    if(btn.id==='si-dekanat-applications'){
      let sb=btn.querySelector('.si-badge');
      if(!sb&&pending>0){ sb=document.createElement('span'); sb.className='si-badge'; btn.appendChild(sb); }
      if(sb) sb.textContent=pending;
    }
  });
  // Student badge
  if(currentRole==='student'){
    const myApps = APPLICATIONS.filter(a=>a.studentName===currentUser?.name);
    const badge = document.getElementById('appCountBadge');
    if(badge){ badge.textContent=myApps.length; badge.style.display=myApps.length?'flex':'none'; }
  }
}

function renderMyApplications(){
  const el=document.getElementById('myApplicationsList');if(!el)return;
  const myApps = APPLICATIONS.filter(a=>a.studentName===currentUser?.name).sort((a,b)=>b.id-a.id);
  if(!myApps.length){
    el.innerHTML='<div class="empty-state"><div class="empty-state-icon">📭</div><div>Hali ariza yo\'q</div><div style="font-size:13px;color:var(--text3);margin-top:6px">Sertifikat buyurtma qiling yoki ish arizasi yuboring</div></div>';
    return;
  }
  el.innerHTML=myApps.map(a=>`
    <div class="card" style="margin-bottom:12px">
      <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">
        <div style="font-size:28px">${a.type==='cert'?'🎓':'💼'}</div>
        <div style="flex:1">
          <div style="font-size:15px;font-weight:700">${a.detail}</div>
          <div style="font-size:12px;color:var(--text2);margin-top:2px">🏢 ${a.company}</div>
          <div style="font-size:12px;color:var(--text3);margin-top:2px">📅 ${a.date}${a.price!=='—'?' · 💰 '+a.price:''}</div>
          ${a.note?`<div style="margin-top:6px;padding:8px 10px;background:var(--bg);border-radius:8px;font-size:12px;color:var(--text2)">💬 Dekanat izohi: <strong>${a.note}</strong></div>`:''}
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px">
          <span style="padding:5px 12px;border-radius:20px;font-size:12px;font-weight:700;${getStatusStyle(a.status)}">${getStatusLabel(a.status)}</span>
          <span style="font-size:11px;color:var(--text3)">#${a.id} · ${a.type==='cert'?'Sertifikat':a.type==='etiraz'?"⚠️ E'tiroz":'Ish arizasi'}</span>
        </div>
      </div>
    </div>`).join('');
}

let currentAppFilter = 'all';
function filterApps(filter, el){
  currentAppFilter = filter;
  document.querySelectorAll('#page-dekanat-applications .filter-chip').forEach(c=>c.classList.remove('active'));
  if(el) el.classList.add('active');
  renderDekanatApplications();
}

async function renderDekanatApplications(){
  // Fetch from backend and merge with local
  if (typeof api !== 'undefined') {
    try {
      var apiApps = await api('GET', '/applications');
      if (Array.isArray(apiApps) && apiApps.length) {
        var localIds = new Set(APPLICATIONS.map(function(a){ return a.apiId; }).filter(Boolean));
        apiApps.forEach(function(a) {
          if (!localIds.has(a.id)) {
            APPLICATIONS.push({
              id: a.id, apiId: a.id,
              studentName: a.student_name || a.studentName || '',
              fullName: a.student_name || a.studentName || '',
              group: a.student_id_number || '',
              type: a.type,
              detail: a.detail || '',
              company: a.company || '',
              price: '—',
              date: a.created_at ? new Date(a.created_at).toLocaleDateString('uz-UZ') : '',
              status: a.status || 'pending',
              note: a.note || '',
              phone: '', email: ''
            });
            localIds.add(a.id);
          }
        });
        saveApplications();
      }
    } catch(e) {}
  }
  // Etiraz faqat test panelda ko'rinadi — bu yerda chiqarilmaydi
  let apps = [...APPLICATIONS].filter(a=>a.type!=='etiraz').sort((a,b)=>b.id-a.id);
  if(currentAppFilter==='cert') apps=apps.filter(a=>a.type==='cert');
  else if(currentAppFilter==='job') apps=apps.filter(a=>a.type==='job');
  else if(currentAppFilter==='pending') apps=apps.filter(a=>a.status==='pending');

  // Update stats
  const el=document.getElementById('totalAppsCount');if(el)el.textContent=APPLICATIONS.length;
  const pe=document.getElementById('pendingAppsCount');if(pe)pe.textContent=APPLICATIONS.filter(a=>a.status==='pending').length;
  const ae=document.getElementById('approvedAppsCount');if(ae)ae.textContent=APPLICATIONS.filter(a=>a.status==='approved').length;

  const tbody=document.getElementById('applicationsBody');if(!tbody)return;
  if(!apps.length){
    tbody.innerHTML='<tr><td colspan="9" style="text-align:center;color:var(--text3);padding:30px">Hali ariza yo\'q</td></tr>';
    return;
  }
  tbody.innerHTML=apps.map(a=>`
    <tr>
      <td><strong>#${a.id}</strong></td>
      <td>
        <div style="font-weight:700">${a.fullName||a.studentName}</div>
        <div style="font-size:11px;color:var(--text3)">${a.studentName}</div>
        ${a.phone?`<div style="font-size:11px;color:var(--text2)">📞 ${a.phone}</div>`:''}
        ${a.email?`<div style="font-size:11px;color:var(--text2)">✉️ ${a.email}</div>`:''}
      </td>
      <td><span class="card-badge cb-blue">${a.group}</span></td>
      <td>${a.type==='cert'?'🎓 Sertifikat':a.type==='etiraz'?'<span style="padding:3px 8px;background:#FFF7ED;border:1px solid #FED7AA;border-radius:6px;font-size:11px;font-weight:700;color:#EA580C">⚠️ E\'tiroz</span>':'💼 Ish arizasi'}</td>
      <td>
        <div style="font-weight:600">${a.detail}</div>
        <div style="font-size:11px;color:var(--text2)">📚 ${a.company}${a.price!=='—'?' · 💰 '+a.price:''}</div>
        ${a.note&&a.type==='etiraz'?`<div style="margin-top:6px;background:#FFF7ED;border:1px solid #FED7AA;border-radius:7px;padding:6px 10px;font-size:12px;color:#92400E;max-width:260px">💬 <strong>Sabab:</strong> ${a.note}</div>`:''}
        ${a.resumeFile?`<div style="margin-top:4px;display:inline-flex;align-items:center;gap:5px;background:var(--primary-light);color:var(--primary);padding:3px 8px;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer" onclick="showToast('📄','Resume','${a.resumeFile}')">📎 ${a.resumeFile}</div>`:''}
        ${a.bio?`<div style="font-size:11px;color:var(--text3);margin-top:3px;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${a.bio}">💬 ${a.bio}</div>`:''}
      </td>
      <td style="font-size:12px;color:var(--text3)">${a.date}</td>
      <td><span style="padding:4px 10px;border-radius:20px;font-size:11px;font-weight:700;${getStatusStyle(a.status)}">${getStatusLabel(a.status)}</span></td>
      <td>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          ${a.status==='pending'?`
            <button class="btn btn-sm" style="background:var(--green-light);color:var(--green);border:1px solid #86EFAC" onclick="updateAppStatus(${a.id},'approved')">✅ Tasdiqlash</button>
            <button class="btn btn-sm" style="background:var(--red-light);color:var(--red);border:1px solid #FCA5A5" onclick="updateAppStatus(${a.id},'rejected')">❌ Rad</button>
          `:`<button class="btn btn-sm btn-secondary" onclick="updateAppStatus(${a.id},'pending')">↩ Qaytarish</button>`}
          <button class="btn btn-sm btn-secondary" onclick="addNoteToApp(${a.id})">💬 Izoh</button>
        </div>
        ${a.note?`<div style="margin-top:6px;font-size:11px;color:var(--text2);background:var(--bg);padding:4px 8px;border-radius:6px">💬 ${a.note}</div>`:''}
      </td>
    </tr>`).join('');
}

function updateAppStatus(id, status){
  const app = APPLICATIONS.find(a=>a.id===id);
  if(!app) return;
  app.status = status;
  updateAppBadges();
  renderDekanatApplications();
  const msg = status==='approved'?`${app.studentName}ga ariza tasdiqlandi!`:status==='rejected'?`Ariza rad etildi`:'Ariza qaytarildi';
  showToast(status==='approved'?'✅':status==='rejected'?'❌':'↩','Holat yangilandi', msg);
}

function addNoteToApp(id){
  const app = APPLICATIONS.find(a=>a.id===id);
  if(!app) return;
  const note = prompt('Talabaga izoh yozing:', app.note||'');
  if(note !== null){ app.note = note; renderDekanatApplications(); showToast('💬','Izoh saqlandi',''); }
}

function exportApplicationsExcel() {
  var apps = [...APPLICATIONS].sort(function(a,b){ return b.id - a.id; });
  if (!apps.length) { showToast('⚠️','Ma\'lumot yo\'q','Hali ariza mavjud emas'); return; }
  var header = ['#','Talaba','Guruh','Ariza turi','Tafsilot','Izoh','Sana','Holat'];
  var typeMap = { cert: 'Sertifikat', job: 'Ish ariza', etiraz: "E'tiroz", other: 'Boshqa' };
  var statusMap = { pending: 'Kutilmoqda', approved: 'Tasdiqlandi', rejected: 'Rad etildi', reviewing: "Ko'rib chiqilmoqda" };
  var rows = apps.map(function(a, i) {
    return [
      i + 1,
      a.fullName || a.studentName || '',
      a.group || '',
      typeMap[a.type] || a.type || '',
      (a.detail || '').replace(/,/g, ';'),
      (a.note || '').replace(/,/g, ';'),
      a.date || '',
      statusMap[a.status] || a.status || ''
    ].join(',');
  });
  var csv = '﻿' + header.join(',') + '\n' + rows.join('\n');
  var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'arizalar_' + new Date().toISOString().slice(0,10) + '.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('📥', 'Excel', 'Arizalar yuklab olindi');
}

// ════════════════════════════════════
//  STARTUP ROLE TWEAK
// ════════════════════════════════════
// Fix add idea button visibility
const _origLaunchApp = launchApp;
launchApp = function(role,user){
  _origLaunchApp(role,user);
  const btn=document.getElementById('addIdeaBtn');
  if(btn) btn.style.display=(role==='student'||role==='dekanat')?'':'none';
};

// ════════ HEMIS NAV FUNCTIONS ════════

/* Smooth scroll to landing page section */
function navScrollTo(sectionId){
  const el = document.getElementById(sectionId);
  if(el){ el.scrollIntoView({behavior:'smooth', block:'start'}); }
}

/* Guide modal data per role */
const GUIDE_DATA = {
  student: {
    icon:'🎓', title:'Talabalar uchun yo\'riqnoma',
    steps:[
      {num:'1', title:'Tizimga kirish', desc:'Telefon raqamingizni kiriting, keyin SMS orqali tasdiqlash kodi yuboriladi. Kod bilan kirib, parolingizni tasdiqlang.'},
      {num:'2', title:'Dashboard', desc:'Tizimga kirganingizdan so\'ng siz o\'z dashboard-ingizni ko\'rasiz: fanlar, vazifalar, xabarlar va XP ball.'},
      {num:'3', title:'Vazifalar', desc:'Har bir fan bo\'yicha berilgan vazifalarni ko\'rib chiqing. Muddatiga e\'tibor bering va topshiriqlarni o\'z vaqtida yuboring.'},
      {num:'4', title:'Vaqt boshqaruvi', desc:'Pomodoro taymeri yordamida o\'qish sessiyalaringizni rejalashtiring. Har 25 daqiqada 5 daqiqa dam oling.'},
      {num:'5', title:'Hamkorlar', desc:'Ishga kirish imkoniyatlarini ko\'ring. Vakansiyalarga ariza topshiring va kompaniyalar bilan bog\'laning.'},
      {num:'6', title:'Parolni unutdim', desc:'Agar parolni unutsangiz, "Parolni unutdim" tugmasini bosing va telefon raqamingizga yangi ma\'lumotlar yuboring.'},
    ]
  },
  teacher: {
    icon:'👨‍🏫', title:'O\'qituvchilar uchun yo\'riqnoma',
    steps:[
      {num:'1', title:'Tizimga kirish', desc:'Login va parolingiz dekanat tomonidan beriladi. SMS tasdiqlash orqali tizimga kiring.'},
      {num:'2', title:'Fanlar boshqaruvi', desc:'O\'z fanlaringizni, ma\'ruza materiallarni va amaliy topshiriqlarni boshqaring.'},
      {num:'3', title:'Vazifalar berish', desc:'Talabalarga vazifalar bering, muddatlarini belgilang va baholash mezonlarini ko\'rsating.'},
      {num:'4', title:'Davomat', desc:'Har bir dars uchun talabalar davomat ma\'lumotlarini kiriting va hisobotlarni ko\'ring.'},
      {num:'5', title:'Baholash', desc:'Talabalar topshiriqlarini baholang, izohlar qo\'shing va natijalarni rasman tasdiqlang.'},
      {num:'6', title:'Startup loyihalari', desc:'Talabalar startup g\'oyalarini ko\'rib chiqing va mentorlik qiling.'},
    ]
  },
  dekanat: {
    icon:'🏛️', title:'Dekanat uchun yo\'riqnoma',
    steps:[
      {num:'1', title:'Tizimga kirish', desc:'Dekanat hisobi bilan login qiling. Barcha bo\'lim ma\'lumotlariga kirish imkoni bo\'ladi.'},
      {num:'2', title:'Talabalar ro\'yxati', desc:'Barcha talabalar, ularning o\'qish holati, to\'lovlari va fanlariga kirish.'},
      {num:'3', title:'O\'qituvchilar', desc:'O\'qituvchilar yuklama, darslar jadvali va baholash natijalarini kuzating.'},
      {num:'4', title:'Hisobotlar', desc:'Statistik hisobotlar: davomat, baholar, to\'lov holati — Excel-ga eksport qilish.'},
      {num:'5', title:'E\'lonlar', desc:'Barcha talabalar va o\'qituvchilarga xabar va e\'lonlar yuboring.'},
      {num:'6', title:'IDU Premium', desc:'Startup loyihalarini, hamkorlik takliflarini ko\'rib chiqing va tasdiqlang.'},
    ]
  },
  admin: {
    icon:'⚙️', title:'Administrator uchun yo\'riqnoma',
    steps:[
      {num:'1', title:'Admin paneli', desc:'Tizimning barcha funksiyalariga to\'liq kirish huquqi mavjud.'},
      {num:'2', title:'Foydalanuvchilar', desc:'Talabalar, o\'qituvchilar va dekanat hisoblarini yaratish, tahrirlash, o\'chirish.'},
      {num:'3', title:'Sozlamalar', desc:'Tizim parametrlarini, akademik yil va semestrlarga tegishli sozlamalarni o\'zgartirish.'},
      {num:'4', title:'SMS/OTP', desc:'Eskiz.uz integratsiyasini boshqaring. Demo/real rejimni almashtiring.'},
      {num:'5', title:'Xavfsizlik', desc:'Kirish jurnallarini ko\'ring, shubhali faoliyatni bloklang.'},
      {num:'6', title:'Zaxira', desc:'Ma\'lumotlar bazasini zahira nusxasini oling va tiklang.'},
    ]
  },
  kafedra: {
    icon:'📚', title:'Kafedra mudiri uchun yo\'riqnoma',
    steps:[
      {num:'1', title:'Kafedra paneli', desc:'O\'z kafedrangizdagi fanlar, o\'qituvchilar va talabalarni boshqaring.'},
      {num:'2', title:'O\'quv reja', desc:'Fanlar ro\'yxatini tahrirlang, kredit soatlarini belgilang.'},
      {num:'3', title:'O\'qituvchilar yuklamasi', desc:'Kafedra o\'qituvchilariga fanlar taqsimlanishini ko\'ring va yangilang.'},
      {num:'4', title:'Hisobotlar', desc:'Kafedra bo\'yicha statistika: o\'rtacha baholar, davomat, fan natijalari.'},
      {num:'5', title:'Nazorat', desc:'Imtihon natijalari va talabalar ishlarini monitoring qiling.'},
      {num:'6', title:'Hamkorlik', desc:'Tashqi tashkilotlar bilan hamkorlik takliflarini ko\'rib chiqing.'},
    ]
  },
};

const FAQ_DATA = [
  {q:'IDU tizimiga qanday kirish mumkin?', a:'Talabalar — student hisobi, o\'qituvchilar — teacher hisobi, dekanat — dekanat hisobi bilan kirishadi. Login va parol sms orqali yuboriladi.'},
  {q:'Parolni unutsam nima qilaman?', a:'"Parolni unutdim" tugmasini bosing, telefon raqamingizni kiriting. SMS orqali yangi login va parol yuboriladi.'},
  {q:'OTP (tasdiqlash kodi) kelmasa nima qilaman?', a:'30 soniya kutib, "Qayta yuborish" tugmasini bosing. Agar kelmasa, telefon raqamingiz to\'g\'ri ekanligini tekshiring.'},
  {q:'Hamkorlar bo\'limida qanday vakansiya topaman?', a:'Hamkorlar bo\'limiga o\'ting → "Vakansiyalar" tabini oching → Qidiruv yoki filtr orqali o\'zingizga mosini toping.'},
  {q:'Pomodoro taymer qanday ishlaydi?', a:'25 daqiqa o\'qish + 5 daqiqa dam olish = 1 sessiya. Har sessiyadan +20 XP olasiz. Vaqt bo\'limidan foydalaning.'},
  {q:'XP ball nima uchun kerak?', a:'XP ball orqali siz tizimda daraja oshirasiz va maxsus imtiyozlarga ega bo\'lasiz. Vazifalar, pomodoro, startup — barchasi XP beradi.'},
  {q:'Startup loyihasini qanday topshiraman?', a:'Startup bo\'limiga o\'ting, "Yangi g\'oya" tugmasini bosing va ma\'lumotlarni to\'ldiring. Dekanat ko\'rib chiqadi.'},
  {q:'Tizim qaysi brauzerda ishlaydi?', a:'Chrome, Firefox, Safari, Edge — barcha zamonaviy brauzerlar qo\'llab-quvvatlanadi. Eng yaxshi tajriba uchun Chrome tavsiya etiladi.'},
  {q:'Mobil qurilmada foydalanish mumkinmi?', a:'Ha, tizim to\'liq mobil qurilmalarga moslashtirilgan (responsive dizayn).'},
  {q:'Ma\'lumotlarim xavfsizmi?', a:'Ha. Barcha ma\'lumotlar shifrlangan, OTP 5 daqiqada o\'chadi, rate-limiting qo\'llaniladi. Parollar hech qachon ochiq saqlanmaydi.'},
];

function _openModal(id){
  const el=document.getElementById(id);
  if(el){el.style.display='flex';document.body.style.overflow='hidden';}
}
function _closeModal(id){
  const el=document.getElementById(id);
  if(el){el.style.display='none';document.body.style.overflow='';}
}
function toggleFaq(i){
  const ans=document.getElementById('faq-a-'+i);
  const arr=document.getElementById('faq-arr-'+i);
  if(!ans) return;
  if(ans.style.display==='none'){ans.style.display='block';arr.textContent='▲';}
  else{ans.style.display='none';arr.textContent='▼';}
}

// Close modals on background click
['guideModal','faqModal','aboutModal','featModal'].forEach(id=>{
  const el = document.getElementById(id);
  if(el) el.addEventListener('click', function(e){
    if(e.target === this){
      _closeModal(id);
      document.body.style.overflow='';
    }
  });
});

// Dropdown toggle for Yo'riqnomalar
function toggleGuidesDropdown(e){
  e.stopPropagation();
  const menu = document.getElementById('navGuidesMenu');
  if(!menu) return;
  const isOpen = menu.style.display === 'block';
  // Close all dropdowns first
  document.querySelectorAll('.hn-drop-menu').forEach(m => m.style.display='none');
  if(!isOpen){ menu.style.display = 'block'; }
}
document.addEventListener('click', function(){
  document.querySelectorAll('.hn-drop-menu').forEach(m => m.style.display='none');
});
function showVideoToast(){
  showToast('video','Video','Tez kunda qoshiladi!','blue');
}

// ════════ LANG DROPDOWN ════════
var currentLang='uz';
function toggleLangDrop(){
  var d=document.getElementById('langDrop');
  d.classList.toggle('open');
  document.removeEventListener('click',closeLangOnOutside);
  if(d.classList.contains('open')){
    setTimeout(function(){document.addEventListener('click',closeLangOnOutside);},10);
  }
}

var LANG_DATA = {
  uz:{
    flag:'🇺🇿', code:'UZ', name:"O'zbek",
    welcome:"Xush kelibsiz!",chooseRole:"Tizimga kirish uchun rolingizni tanlang",
    cont:"Davom etish",demo:"Demo hisoblar",back:"Orqaga qaytish",loginBtn:"Kirish",
    errCred:"Login yoki parol noto'g'ri",llLogin:"Login",llPass:"Parol",
    llCourse:"Kurs",llGroup:"Guruh",srvLogin:"Xizmat login",dept:"Bo'lim",adminLogin:"Admin login",company:"Kompaniya",
    stTitle:"Talaba kirishi",stSub:"Login va parolingizni kiriting",
    tcTitle:"Professor kirishi",tcSub:"Tizim hisobingiz ma'lumotlarini kiriting",
    dkTitle:"Dekanat kirishi",dkSub:"Dekanat administrator login ma'lumotlari",
    invTitle:"Investor kirishi",invSub:"Startup g'oyalarni ko'rish va baholash",
    stat1:"Talabalar",stat2:"O'qituvchilar",stat3:"Muvaffaqiyat",stat4:"Onlayn",stat5:"Fanlar",stat6:"Hamkorlar",
    badge:"",heroT:"International Digital University",
    heroS:"Zamonaviy ta'lim platformasi — talabalar, o'qituvchilar, dekanat va investorlar uchun yagona raqamli muhit.",
    video:"Video",kirish:"Kirish",navAbout:"Tizim haqida",navFeat:"Imkoniyatlar",navFaq:"FAQS",
    c1:"I kurs",c2:"II kurs",c3:"III kurs",c4:"IV kurs",optCh:"Tanlang",
    sdemo:"Talaba",tdemo:"O'qituvchi",idemo:"Investor"
  },
  ru:{
    flag:'🇷🇺', code:'RU', name:"Русский",
    welcome:"Добро пожаловать!",chooseRole:"Выберите свою роль для входа",
    cont:"Продолжить",demo:"Демо аккаунты",back:"Назад",loginBtn:"Войти",
    errCred:"Неверный логин или пароль",llLogin:"Логин",llPass:"Пароль",
    llCourse:"Курс",llGroup:"Группа",srvLogin:"Служебный логин",dept:"Кафедра",adminLogin:"Логин администратора",company:"Компания",
    stTitle:"Вход студента",stSub:"Введите логин и пароль",
    tcTitle:"Вход преподавателя",tcSub:"Введите данные вашего аккаунта",
    dkTitle:"Вход деканата",dkSub:"Данные администратора деканата",
    invTitle:"Вход инвестора",invSub:"Просмотр и оценка стартап-идей",
    stat1:"Студенты",stat2:"Преподаватели",stat3:"Успеваемость",stat4:"Онлайн",stat5:"Дисциплины",stat6:"Партнёры",
    badge:"Новая версия 5.0 доступна",heroT:"Интеллектуальная Цифровая Университет платформа",
    heroS:"Современная образовательная платформа — единая цифровая среда для студентов, преподавателей, деканата и инвесторов.",
    video:"Видео",kirish:"Войти",navAbout:"О системе",navFeat:"Возможности",navFaq:"FAQS",
    c1:"I курс",c2:"II курс",c3:"III курс",c4:"IV курс",optCh:"Выбрать",
    sdemo:"Студент",tdemo:"Преподаватель",idemo:"Инвестор"
  }
};

function setLang(lang){
  currentLang=lang;
  var L=LANG_DATA[lang];
  // Dropdown UI
  var d=document.getElementById('langDrop');
  if(d) d.classList.remove('open');
  document.removeEventListener('click',closeLangOnOutside);
  var flag=document.getElementById('lcFlag'); if(flag) flag.textContent=L.flag;
  var txt=document.getElementById('lcText'); if(txt) txt.textContent=L.code;
  var optUz=document.getElementById('lopt-uz'); if(optUz) optUz.classList.toggle('active',lang==='uz');
  var optRu=document.getElementById('lopt-ru'); if(optRu) optRu.classList.toggle('active',lang==='ru');

  function s(id,v){var el=document.getElementById(id);if(el)el.textContent=v;}
  // Navbar
  s('nav-about',L.navAbout); s('nav-features',L.navFeat); s('nav-faq',L.navFaq);
  s('nav-kirish',L.kirish);
  // Hero
  s('hero-title-text',L.heroT); s('hero-sub',L.heroS);
  s('hero-video',L.video);
  s('hstat1',L.stat1); s('hstat2',L.stat2); s('hstat3',L.stat3); s('hstat4',L.stat4); s('hstat5',L.stat5); s('hstat6',L.stat6);
  // Modal step-role
  s('t-welcome',L.welcome); s('t-choose-role',L.chooseRole); s('t-continue',L.cont); s('t-demo',L.demo);
  document.querySelectorAll('.role-card-title[data-uz]').forEach(function(el){el.textContent=lang==='uz'?el.dataset.uz:el.dataset.ru;});
  document.querySelectorAll('.role-card-sub[data-uz]').forEach(function(el){el.textContent=lang==='uz'?el.dataset.uz:el.dataset.ru;});
  // Student
  s('t-student-title',L.stTitle+' 🎓'); s('t-student-sub',L.stSub);
  s('t-err-cred',L.errCred); s('t-err-cred2',L.errCred);
  s('t-label-login',L.llLogin); s('t-label-pass',L.llPass);
  s('t-label-course',L.llCourse); s('t-label-group',L.llGroup);
  s('t-login-btn',L.loginBtn); s('t-login-btn2',L.loginBtn); s('t-login-btn3',L.loginBtn); s('t-login-btn4',L.loginBtn);
  s('t-back',L.back); s('t-back2',L.back); s('t-back3',L.back); s('t-back4',L.back);
  s('t-student-demo',L.sdemo);
  s('t-course1',L.c1); s('t-course2',L.c2); s('t-course3',L.c3); s('t-course4',L.c4);
  s('t-opt-choose',L.optCh);
  // Teacher
  s('t-teacher-title',L.tcTitle); s('t-teacher-sub',L.tcSub);
  s('t-srv-login',L.srvLogin); s('t-dept',L.dept); s('t-teacher-demo',L.tdemo);
  // Dekanat
  s('t-dekanat-title',L.dkTitle); s('t-dekanat-sub',L.dkSub); s('t-admin-login',L.adminLogin);
  // Investor
  s('t-investor-title',L.invTitle); s('t-investor-sub',L.invSub);
  s('t-company',L.company); s('t-investor-demo',L.idemo);
}

// ════ SMOOTH SCROLL ════
function goTo(id){
  var el=document.getElementById(id);
  if(el){el.scrollIntoView({behavior:'smooth',block:'start'});}
}

// ════ LANG DROPDOWN ════
var currentLang='uz';
function toggleLangDrop(){
  var d=document.getElementById('langDrop');
  d.classList.toggle('open');
  document.removeEventListener('click',closeLangOut);
  if(d.classList.contains('open')){
    setTimeout(function(){document.addEventListener('click',closeLangOut);},10);
  }
}

var LD={
  uz:{flag:'🇺🇿',code:'UZ',
    navAbout:'Tizim haqida',navFeat:'Imkoniyatlar',navCont:'Kontaktlar',navPart:'Hamkorlar',
    kirish:'Kirish',
    heroT:"International Digital University",
    heroS:"Zamonaviy ta'lim platformasi — talabalar, o'qituvchilar, dekanat va investorlar uchun yagona raqamli muhit.",
    st1:'Talabalar',st2:"O'qituvchilar",st3:'Muvaffaqiyat',st4:'Onlayn',st5:'Fanlar',st6:'Hamkorlar',
    welcome:"Xush kelibsiz!",chooseRole:"Rolingizni tanlang",cont:"Davom etish",demo:"Demo hisoblar",
    back:"Orqaga qaytish",btn:"Kirish",err:"Login yoki parol noto'g'ri",
    ll:"Login",lp:"Parol",lc:"Kurs",lg:"Guruh",sl:"Xizmat login",dp:"Bo'lim",
    al:"Admin login",comp:"Kompaniya",
    stT:"Talaba kirishi",stS:"Login va parolingizni kiriting",
    tcT:"Professor kirishi",tcS:"Tizim hisobingiz ma'lumotlarini kiriting",
    dkT:"Dekanat kirishi",dkS:"Administrator login ma'lumotlari",
    invT:"Investor kirishi",invS:"Startup g'oyalarni ko'rish va baholash",
    c1:"I kurs",c2:"II kurs",c3:"III kurs",c4:"IV kurs",cho:"Tanlang",
    sd:"Talaba",td:"O'qituvchi",id:"Investor",
    // Sections
    saBadge:"Platforma haqida",saTitle:"Nima uchun IDU?",saSub:"Zamonaviy ta'lim tizimi — barcha jarayonlar yagona platformada.",
    saC1t:"Talabalar uchun",saC2t:"O'qituvchilar uchun",saC3t:"Dekanat uchun",
    sfBadge:"Xususiyatlar",sfTitle:"Asosiy imkoniyatlar",sfSub:"IDU platformasi ta'lim jarayonini to'liq raqamlashtiradi.",
    scBadge:"Bog'lanish",scTitle:"Kontaktlar",scSub:"Biz bilan bog'laning — javob berishdan mamnunmiz.",
    scLoc:"Manzil",scPhone:"Telefon",scEmail:"Email",scSocial:"Ijtimoiy tarmoqlar",scSocialSub:"Yangiliklar uchun kuzating",
    spBadge:"Hamkorlik",spTitle:"Bizning hamkorlar",spSub:"Yetakchi tashkilotlar va universitetlar bilan hamkorlik.",
    spCtaT:"Hamkor bo'lmoqchimisiz?",spCtaS:"IDU platformasi bilan birgalikda ta'limni yaxshilang.",spCtaBtn:"Bog'lanish →",
    // App UI — Dashboard
    appDashTitle:'Bosh sahifa',appBtnJadval:"📅 Jadval",appBtnQuiz:"🧠 Quiz boshlash",
    appBannerTitle:"IDU Platform — HEMIS o'rnini bosuvchi tizim",
    appBannerSub:"Oxirgi yangilanish: bugun 08:42 · Barcha ma'lumotlar joriy",
    appHb1:"Talabalar",appHb2:"Fanlar",appHb3:"Davomat",appHb4:"O'qituvchilar",
    appStatTotal:"Umumiy ball",appStatRating:"Reyting o'rni",appStatDavomat:"Davomat",appStatSemester:"Joriy semestr",
    appTodayTitle:"Bugungi darslar",appTasksTitle:"Yaqinlashayotgan vazifalar",appTasksBadge:"5 ta",
    appGradesTitle:"So'nggi baholar",appGradesAll:"Barchasi →",
    appAchTitle:"Yutuqlar 🏆",
    appAch1Name:"A'lochi talaba",appAch1Desc:"GPA 3.5+ saqlash",
    appAch2Name:"Devomli talaba",appAch2Desc:"95%+ davomat",
    appAch3Name:"Innovator",appAch3Desc:"Startup g'oya kiritish",
    appThFan:"Fan",appThJn:"JN",appThOn:"ON",appThYn:"YN",appThMi:"MI",appThJami:"Jami",appThBaho:"Baho",
    appChiqish:"Chiqish",
  },
  ru:{flag:'🇷🇺',code:'RU',
    navAbout:'О системе',navFeat:'Возможности',navCont:'Контакты',navPart:'Партнёры',
    kirish:'Войти',
    heroT:"International Digital University",
    heroS:"Современная образовательная платформа — единая цифровая среда для студентов, преподавателей, деканата и инвесторов.",
    st1:'Студенты',st2:'Преподаватели',st3:'Успеваемость',st4:'Онлайн',st5:'Дисциплины',st6:'Партнёры',
    welcome:"Добро пожаловать!",chooseRole:"Выберите роль",cont:"Продолжить",demo:"Демо аккаунты",
    back:"Назад",btn:"Войти",err:"Неверный логин или пароль",
    ll:"Логин",lp:"Пароль",lc:"Курс",lg:"Группа",sl:"Служебный логин",dp:"Кафедра",
    al:"Логин администратора",comp:"Компания",
    stT:"Вход студента",stS:"Введите логин и пароль",
    tcT:"Вход преподавателя",tcS:"Введите данные аккаунта",
    dkT:"Вход деканата",dkS:"Данные администратора",
    invT:"Вход инвестора",invS:"Просмотр стартап-идей",
    c1:"I курс",c2:"II курс",c3:"III курс",c4:"IV курс",cho:"Выбрать",
    sd:"Студент",td:"Преподаватель",id:"Инвестор",
    saBadge:"О платформе",saTitle:"Почему IDU?",saSub:"Современная система — все процессы в единой платформе.",
    saC1t:"Для студентов",saC2t:"Для преподавателей",saC3t:"Для деканата",
    sfBadge:"Функции",sfTitle:"Основные возможности",sfSub:"IDU полностью оцифровывает учебный процесс.",
    scBadge:"Связаться",scTitle:"Контакты",scSub:"Свяжитесь с нами — мы рады ответить.",
    scLoc:"Адрес",scPhone:"Телефон",scEmail:"Email",scSocial:"Социальные сети",scSocialSub:"Следите за новостями",
    spBadge:"Партнёрство",spTitle:"Наши партнёры",spSub:"Сотрудничество с ведущими организациями и университетами.",
    spCtaT:"Хотите стать партнёром?",spCtaS:"Вместе с IDU улучшайте образование.",spCtaBtn:"Связаться →",
    // App UI — Dashboard
    appDashTitle:'Главная',appBtnJadval:'📅 Расписание',appBtnQuiz:'🧠 Начать квиз',
    appBannerTitle:'IDU Platform — замена системы HEMIS',
    appBannerSub:'Последнее обновление: сегодня 08:42 · Все данные актуальны',
    appHb1:'Студенты',appHb2:'Дисциплины',appHb3:'Посещаемость',appHb4:'Преподаватели',
    appStatTotal:'Общий балл',appStatRating:'Место в рейтинге',appStatDavomat:'Посещаемость',appStatSemester:'Текущий семестр',
    appTodayTitle:'Сегодняшние занятия',appTasksTitle:'Предстоящие задания',appTasksBadge:'5 шт.',
    appGradesTitle:'Последние оценки',appGradesAll:'Все →',
    appAchTitle:'Достижения 🏆',
    appAch1Name:'Отличник',appAch1Desc:'Сохранять GPA 3.5+',
    appAch2Name:'Посещаемый студент',appAch2Desc:'Посещаемость 95%+',
    appAch3Name:'Инноватор',appAch3Desc:'Подать стартап-идею',
    appThFan:'Дисциплина',appThJn:'СКЗ',appThOn:'ОКЗ',appThYn:'ЯКЗ',appThMi:'ЭКЗ',appThJami:'Итого',appThBaho:'Оценка',
    appChiqish:'Выйти',
  }
};

function setLang(lang){
  currentLang=lang;
  var L=LD[lang];
  var d=document.getElementById('langDrop');if(d)d.classList.remove('open');
  document.removeEventListener('click',closeLangOut);
  var flag=document.getElementById('lcFlag');if(flag)flag.textContent=L.flag;
  var txt=document.getElementById('lcText');if(txt)txt.textContent=L.code;
  var ou=document.getElementById('lopt-uz');if(ou)ou.classList.toggle('active',lang==='uz');
  var or2=document.getElementById('lopt-ru');if(or2)or2.classList.toggle('active',lang==='ru');
  function s(id,v){var el=document.getElementById(id);if(el)el.textContent=v;}
  s('nav-about',L.navAbout);s('nav-features',L.navFeat);s('nav-contacts',L.navCont);s('nav-partners',L.navPart);
  s('nav-kirish',L.kirish);
  s('hero-title-text',L.heroT);s('hero-sub',L.heroS);
  s('hstat1',L.st1);s('hstat2',L.st2);s('hstat3',L.st3);s('hstat4',L.st4);s('hstat5',L.st5);s('hstat6',L.st6);
  // Sections
  s('sa-badge',L.saBadge);s('sa-title',L.saTitle);s('sa-sub',L.saSub);
  s('sa-c1t',L.saC1t);s('sa-c2t',L.saC2t);s('sa-c3t',L.saC3t);
  s('sf-badge',L.sfBadge);s('sf-title',L.sfTitle);s('sf-sub',L.sfSub);
  s('sc-badge',L.scBadge);s('sc-title',L.scTitle);s('sc-sub',L.scSub);
  s('sc-loc',L.scLoc);s('sc-phone',L.scPhone);s('sc-email',L.scEmail);
  s('sc-social',L.scSocial);s('sc-social-sub',L.scSocialSub);
  s('sp-badge',L.spBadge);s('sp-title',L.spTitle);s('sp-sub',L.spSub);
  s('sp-cta-t',L.spCtaT);s('sp-cta-s',L.spCtaS);s('sp-cta-btn',L.spCtaBtn);
  // Modal
  s('t-welcome',L.welcome);s('t-choose-role',L.chooseRole);s('t-continue',L.cont);s('t-demo',L.demo);
  document.querySelectorAll('.role-card-title[data-uz]').forEach(function(el){el.textContent=lang==='uz'?el.dataset.uz:el.dataset.ru;});
  document.querySelectorAll('.role-card-sub[data-uz]').forEach(function(el){el.textContent=lang==='uz'?el.dataset.uz:el.dataset.ru;});
  s('t-student-title',L.stT);s('t-student-sub',L.stS);
  s('t-err-cred',L.err);s('t-err-cred2',L.err);
  s('t-label-login',L.ll);s('t-label-pass',L.lp);s('t-label-course',L.lc);s('t-label-group',L.lg);
  s('t-login-btn',L.btn);s('t-login-btn2',L.btn);s('t-login-btn3',L.btn);s('t-login-btn4',L.btn);
  s('t-back',L.back);s('t-back2',L.back);s('t-back3',L.back);s('t-back4',L.back);
  s('t-student-demo',L.sd);
  s('t-course1',L.c1);s('t-course2',L.c2);s('t-course3',L.c3);s('t-course4',L.c4);
  s('t-opt-choose',L.cho);
  s('t-teacher-title',L.tcT);s('t-teacher-sub',L.tcS);s('t-srv-login',L.sl);s('t-dept',L.dp);s('t-teacher-demo',L.td);
  s('t-dekanat-title',L.dkT);s('t-dekanat-sub',L.dkS);s('t-admin-login',L.al);
  s('t-investor-title',L.invT);s('t-investor-sub',L.invS);s('t-company',L.comp);s('t-investor-demo',L.id);

  // ── App UI refresh (when user is already logged in) ──
  if(currentUser && currentRole){
    setupNav(currentRole);
    setupSidebar(currentRole);
    setupChip(currentRole, currentUser);
    // Re-activate current tab highlight
    if(currentPage){
      document.querySelectorAll('.topnav-tab').forEach(function(t){t.classList.remove('active');});
      document.querySelectorAll('.sidebar-item').forEach(function(t){t.classList.remove('active');});
      var tabEl=document.getElementById('tab-'+currentPage);
      var siEl=document.getElementById('si-'+currentPage);
      if(tabEl) tabEl.classList.add('active');
      if(siEl) siEl.classList.add('active');
    }
    // Re-render dynamic content with new language
    if(typeof initDates==='function') initDates();
    if(typeof renderTimetable==='function') renderTimetable();
    if(currentPage==='timetable' || currentPage==='teacher-timetable'){
      if(typeof renderTimetable==='function') renderTimetable();
    }

    // Update static dashboard IDs after render (setTimeout ensures DOM is settled)
    var _L = L;
    setTimeout(function(){
      function u(id,v){var e=document.getElementById(id);if(e)e.textContent=v;}
      u('dash-page-title',_L.appDashTitle);
      u('dash-btn-jadval',_L.appBtnJadval);
      u('dash-btn-quiz',_L.appBtnQuiz);
      u('dash-banner-title',_L.appBannerTitle);
      u('dash-banner-sub',_L.appBannerSub);
      u('dash-hb1',_L.appHb1);u('dash-hb2',_L.appHb2);u('dash-hb3',_L.appHb3);u('dash-hb4',_L.appHb4);
      u('dash-stat-total',_L.appStatTotal);u('dash-stat-rating',_L.appStatRating);
      u('dash-stat-davomat',_L.appStatDavomat);u('dash-stat-semester',_L.appStatSemester);
      u('dash-today-title',_L.appTodayTitle);u('dash-tasks-title',_L.appTasksTitle);
      u('dash-tasks-badge',_L.appTasksBadge);
      u('dash-grades-title',_L.appGradesTitle);u('dash-grades-all',_L.appGradesAll);
      u('dash-achieve-title',_L.appAchTitle);
      u('dash-ach1-name',_L.appAch1Name);u('dash-ach1-desc',_L.appAch1Desc);
      u('dash-ach2-name',_L.appAch2Name);u('dash-ach2-desc',_L.appAch2Desc);
      u('dash-ach3-name',_L.appAch3Name);u('dash-ach3-desc',_L.appAch3Desc);
      u('th-fan',_L.appThFan);u('th-jn',_L.appThJn);u('th-on',_L.appThOn);u('th-yn',_L.appThYn);
      u('th-mi',_L.appThMi);u('th-jami',_L.appThJami);u('th-baho',_L.appThBaho);
      // Stat changes
      var isRu=currentLang==='ru';
      u('dash-gpa-change', isRu?'↑ +0.2 прошлый семестр':"↑ +0.2 o'tgan semestr");
      u('dash-total-change', isRu?'↑ +23 эта неделя':'↑ +23 bu hafta');
      u('dash-rating-change', isRu?'↑ из 156':'↑ 156 ichida');
      // Timetable page buttons
      var isRuTT=currentLang==='ru';
      u('tt-page-title', isRuTT?'📅 Расписание':'📅 Dars jadvali');
      u('tt-btn-prev', isRuTT?'← Прошлая неделя':'← Oldingi hafta');
      u('tt-btn-cur',  isRuTT?'Текущая неделя':'Joriy hafta');
      u('tt-btn-next', isRuTT?'Следующая неделя →':'Keyingi hafta →');
      u('tt-btn-weekly', isRuTT?'Недельный':'Haftalik');
      u('tt-btn-daily',  isRuTT?'Дневной':'Kunlik');
      // Sidebar level name
      u('sidebarLevelName', isRuTT?'Новичок':'Yangi boshlovchi');
      // Chiqish / Выйти button
      var chiqishEl=document.querySelector('[onclick="logout()"]');
      if(chiqishEl) chiqishEl.textContent=_L.appChiqish||chiqishEl.textContent;
    }, 30);
  }
}

// ════════════════════════════════════
//  SAHIFA YUKLANGANDA: saqlangan sessiyani tekshirish
// ════════════════════════════════════
// ── v18: Global error handlers ────────────────────────────────────────────────
window.onerror = function(msg, src, line, col, err) {
  console.error('[IDU Error]', msg, 'at', src + ':' + line + ':' + col, err);
  return false; // don't suppress default
};
window.addEventListener('unhandledrejection', function(evt) {
  console.error('[IDU Unhandled Promise Rejection]', evt.reason);
});

window.addEventListener('DOMContentLoaded', function() {
  const saved = _lsGet('idu_session');
  if (saved) {
    loadSavedSession();
  }
  // Login oynasi endi avtomatik ochilmaydi. Foydalanuvchi yuqoridagi “Kirish” tugmasini bosganda ochiladi.
  // ── LIVE DATE & TIME BAR ──
  var DAYS_UZ=['Yakshanba','Dushanba','Seshanba','Chorshanba','Payshanba','Juma','Shanba'];
  var MONTHS_UZ=['Yanvar','Fevral','Mart','Aprel','May','Iyun','Iyul','Avgust','Sentabr','Oktabr','Noyabr','Dekabr'];
  function pad(n){return n<10?'0'+n:n;}
  function updateClock(){
    var now=new Date();
    var dayEl=document.getElementById('dtbDay');
    var dateEl=document.getElementById('dtbDate');
    var clockEl=document.getElementById('dtbClock');
    if(dayEl)dayEl.textContent=DAYS_UZ[now.getDay()];
    if(dateEl)dateEl.textContent=now.getDate()+' '+MONTHS_UZ[now.getMonth()]+' '+now.getFullYear()+' y.';
    if(clockEl)clockEl.textContent=pad(now.getHours())+':'+pad(now.getMinutes())+':'+pad(now.getSeconds());
  }
  updateClock();
  setInterval(updateClock,1000);
});

// ════════════════════════════════════
//  SESIYA STATE
// ════════════════════════════════════
var SESIYA_STATE = { test: false, real: false };
// ═══════════════════════════════════════════════
// TEST REJIM — SAVOLLAR BANKI (har bir fanda 20 ta)
// ═══════════════════════════════════════════════
var TEST_QUESTIONS_DB = {
  algo: [
    {q:"Quyidagi algoritmlardan qaysi biri O(n log n) vaqt murakkabligiga ega?", opts:["Bubble Sort","Merge Sort","Linear Search","Insertion Sort"], ans:1, izoh:"Merge Sort — bo'lib-bo'lib tartiblash (divide & conquer) usuli bo'lib, O(n log n) murakkablikka ega. Bubble va Insertion Sort O(n²), Linear Search esa O(n)."},
    {q:"Stack ma'lumotlar tuzilmasida qaysi tamoyil qo'llaniladi?", opts:["FIFO","LIFO","LILO","FILO"], ans:1, izoh:"Stack LIFO (Last In, First Out) tamoyilida ishlaydi — oxirgi kiritilgan element birinchi chiqariladi."},
    {q:"Binary Search algoritmi qaysi turdagi massivlarda ishlaydi?", opts:["Tartibsiz massiv","Tartiblangan massiv","Faqat raqamli massiv","Faqat matnli massiv"], ans:1, izoh:"Binary Search faqat tartiblangan massivlarda ishlaydi. U o'rtadan boshlayib, har safar massivning yarmini kesib tashlaydi — O(log n)."},
    {q:"Queue ma'lumotlar tuzilmasida qaysi tamoyil qo'llaniladi?", opts:["LIFO","FILO","FIFO","LILO"], ans:2, izoh:"Queue FIFO (First In, First Out) tamoyilida ishlaydi — birinchi kiritilgan element birinchi chiqariladi. Navbat kabi ishlaydi."},
    {q:"Rekursiv algoritmda nima bo'lmasa cheksiz rekursiya yuzaga keladi?", opts:["Parametr","Base case (to'xtash sharti)","Qaytish qiymati","O'zgaruvchi"], ans:1, izoh:"Base case — rekursiyaning to'xtash sharti. Bu bo'lmasa, funksiya o'zini cheksiz chaqirib, stack overflow xatosini keltirib chiqaradi."},
    {q:"Bubble Sort ning eng yomon holda vaqt murakkabligi qanday?", opts:["O(n)","O(log n)","O(n log n)","O(n²)"], ans:3, izoh:"Bubble Sort O(n²) murakkablikka ega, chunki har bir element boshqa barcha elementlar bilan taqqoslanadi."},
    {q:"Graf algoritmi DFS ning to'liq nomi nima?", opts:["Data First Search","Depth First Search","Direct Flow Search","Dynamic First Scan"], ans:1, izoh:"DFS — Depth First Search (Chuqurlik bo'yicha qidirish). Bitta yo'nalishda to'xtatilgunga qadar davom etadi, keyin orqaga qaytadi."},
    {q:"Hash table da kolliziya nima?", opts:["Xotira to'lishi","Ikkita kalit bir xil indeksga tushishi","Elementni o'chirish","Jadval hajmini o'zgartirish"], ans:1, izoh:"Kolliziya — ikki xil kalit bir xil hash indeksini hosil qilganda yuzaga keladi. Uni hal qilish uchun chaining yoki open addressing usullari ishlatiladi."},
    {q:"Dynamic Programming (DP) asosiy g'oyasi nima?", opts:["Muammoni bo'lib tashlash","Kichik muammolar natijalarini saqlash va qayta ishlatish","Tasodifiy qidirish","Parallel hisoblash"], ans:1, izoh:"DP — kichik muammolarning natijalarini memoization yoki tabulation orqali saqlash va qayta hisoblashni oldini olish."},
    {q:"Linked List da elementga kirish vaqt murakkabligi qanday?", opts:["O(1)","O(log n)","O(n)","O(n²)"], ans:2, izoh:"Linked List da elementlar ketma-ket bog'langan. n-chi elementga yetish uchun boshidan boshlab o'tish kerak — O(n)."},
    {q:"Quick Sort ning o'rtacha vaqt murakkabligi qanday?", opts:["O(n)","O(n log n)","O(n²)","O(log n)"], ans:1, izoh:"Quick Sort o'rtacha holda O(n log n) murakkablikka ega. Eng yomon holda (tartiblanmagan pivot) O(n²) bo'lishi mumkin."},
    {q:"Binary Tree da nechta bola tugun bo'lishi mumkin?", opts:["1 ta","2 ta","3 ta","Cheksiz"], ans:1, izoh:"Binary Tree da har bir tugunning maksimal 2 ta bolasi bo'ladi: chap (left) va o'ng (right)."},
    {q:"Greedy algoritm qanday strategiyadan foydalanadi?", opts:["Global optimalni qidirish","Har bir qadamda mahalliy optimal tanlov qilish","Barcha imkoniyatlarni sinash","Tasodifiy tanlov"], ans:1, izoh:"Greedy (ochko'z) algoritm har qadamda o'sha paytdagi eng yaxshi tanlovni qiladi, keyingi qadamlarni hisobga olmaydi."},
    {q:"Array va Linked List ning asosiy farqi nima?", opts:["Array katta, Linked List kichik","Array o'zgarmas, Linked List o'zgaruvchan","Array ketma-ket xotirada, Linked List tarqoq xotirada","Array sekin, Linked List tez"], ans:2, izoh:"Array elementlari xotirada ketma-ket joylashgan (index orqali O(1) kirish). Linked List esa tarqoq xotirada, pointerlar bilan bog'langan."},
    {q:"Dijkstra algoritmi nima uchun ishlatiladi?", opts:["Eng qisqa yo'l topish","Tartiblash","Qidirish","Kompressiya"], ans:0, izoh:"Dijkstra algoritmi grafda manba tugunidan barcha boshqa tugunlarga eng qisqa yo'lni topadi (musbat og'irlikli graflar uchun)."},
    {q:"Time Complexity va Space Complexity farqi nima?", opts:["Bir xil narsa","Time — vaqt, Space — xotira sarfi","Time — xotira, Space — vaqt","Ikkisi ham faqat xotira haqida"], ans:1, izoh:"Time Complexity algoritmning bajarilish vaqtini, Space Complexity esa ishlatiladigan xotira miqdorini o'lchaydi."},
    {q:"Selection Sort qanday ishlaydi?", opts:["Har safar minimal elementni topib, to'g'ri joyiga qo'yadi","Qo'shni elementlarni solishtiradi","Pivot orqali bo'ladi","Yarmini kesib tashlaydi"], ans:0, izoh:"Selection Sort har iteratsiyada massivning tartiblangan bo'lmagan qismidan minimal elementni topib, uni to'g'ri joyiga qo'yadi."},
    {q:"Palindrom so'zni tekshirishda qaysi ma'lumotlar tuzilmasi qulay?", opts:["Graf","Queue","Stack","Tree"], ans:2, izoh:"Stack yordamida so'zni teskari o'qish mumkin. Teskari o'qilganda asl so'z bilan bir xil bo'lsa — palindrom."},
    {q:"AVL tree qanday xususiyatga ega?", opts:["Har doim to'la (complete) bo'ladi","Har tugun uchun chap va o'ng daraxt balandligi farqi 1 dan oshmasligi","Faqat 3 darajali bo'ladi","Barcha tugunlar bir xil qiymatga ega"], ans:1, izoh:"AVL tree — o'z-o'zini muvozanatlaydigan BST. Har bir tugun uchun chap va o'ng subtree balandligi farqi maksimal 1 bo'ladi."},
    {q:"Fibonacci ketma-ketligini hisoblashda DP va rekursiya farqi nima?", opts:["Farq yo'q","DP keshlashtiradi, rekursiya qayta hisoblaydi","Rekursiya tezroq","DP ko'proq xotira ishlatmaydi"], ans:1, izoh:"Oddiy rekursiya Fibonacci(n) uchun O(2^n) vaqt ketkazadi (qayta hisoblaydi). DP memoization bilan O(n) ga tushiradi."}
  ],
  ai: [
    {q:"Machine Learning da 'overfitting' muammosi nima?", opts:["Model hech narsani o'rgana olmaydi","Model o'quv ma'lumotlariga juda yaxshi mos keladi, yangilarda yomon ishlaydi","Model barcha ma'lumotlarda bir xil ishlaydi","Model juda tez o'rganadi"], ans:1, izoh:"Overfitting — model o'quv ma'lumotlaridagi shovqin va tasodifiy naqshlarni ham o'rganib olishi. Natijada yangi ma'lumotlarda yomon ishlaydi (yuqori variance)."},
    {q:"Neyron tarmoqda 'activation function' nima uchun kerak?", opts:["Tezlikni oshirish uchun","Chiziqli bo'lmagan (non-linear) munosabatlarni o'rganish uchun","Xotira tejash uchun","Faqat chiqish qatlamida ishlatiladi"], ans:1, izoh:"Activation function neyron tarmoqqa chiziqli bo'lmagan (non-linear) imkoniyatlar qo'shadi. Ularsiz tarmoq faqat chiziqli funksiyalarni o'rganadi."},
    {q:"Supervised learning va Unsupervised learning farqi nima?", opts:["Supervised ko'proq ma'lumot talab qiladi","Supervised belgilangan (labeled) ma'lumot ishlatadi, Unsupervised yo'q","Unsupervised aniqroq","Farq yo'q"], ans:1, izoh:"Supervised learning belgilangan (label/javob mavjud) ma'lumotlar bilan o'rganadi. Unsupervised esa belgilanmagan ma'lumotlarda yashirin naqshlarni topadi."},
    {q:"CNN (Convolutional Neural Network) qaysi sohalarda keng ishlatiladi?", opts:["Matn tahlili","Rasm/Tasvirni aniqlash","Audio qayta ishlash","Faqat o'yinlarda"], ans:1, izoh:"CNN tasvirlar bilan ishlash uchun mo'ljallangan. Convolution operatsiyasi orqali rasmdan xususiyatlar (edge, texture, shape) oladi."},
    {q:"Gradient Descent algoritmining maqsadi nima?", opts:["Modelni tezlashtirish","Loss funksiyasini minimallash","Ma'lumotlarni tartiblash","Overfitting oldini olish"], ans:1, izoh:"Gradient Descent loss (xato) funksiyasini minimallash uchun model parametrlarini (weights, biases) gradient teskari yo'nalishida yangilaydi."},
    {q:"Reinforcement Learning da 'reward' nima?", opts:["O'quv ma'lumoti","Agent harakatiga berilgan rag'bat yoki jazo signali","Neyron tarmoq qatlami","Ma'lumotlar to'plami"], ans:1, izoh:"Reward — agentning muhitdagi harakatiga berilgan raqamli baho. Agent umumiy reward ni maksimallashtirishga o'rganadi (Q-learning, PPO)."},
    {q:"Natural Language Processing (NLP) da tokenization nima?", opts:["Matnni kriptolash","Matnni kichik bo'laklarga (token) ajratish","Matnni tarjima qilish","Grammatikani tekshirish"], ans:1, izoh:"Tokenization — matnni so'zlar, so'z bo'laklari yoki harflarga ajratish jarayoni. NLP modellar matnni to'g'ridan-to'g'ri emas, token indekslari orqali qayta ishlaydi."},
    {q:"Transfer Learning qanday ishlaydi?", opts:["Yangi modelni noldan o'rgatish","Oldindan o'rgatilgan modelni yangi vazifaga moslash","Ma'lumotlarni ko'chirish","Modelni soddalash"], ans:1, izoh:"Transfer Learning — katta ma'lumotlarda o'rgatilgan modelning bilimlarini yangi, kichikroq ma'lumotli vazifaga ko'chirish. Fine-tuning orqali amalga oshiriladi."},
    {q:"Random Forest qanday algoritmdan iborat?", opts:["Bitta kuchli qaror daraxti","Ko'p qaror daraxtlari yig'indisi (ensemble)","Klasterlash algoritmi","Chiziqli regressiya"], ans:1, izoh:"Random Forest — bagging asosidagi ensemble metod. Ko'plab qaror daraxtlari (decision trees) o'rgatiladi va ular ovoz berish (voting) orqali natija chiqaradi."},
    {q:"K-Means algoritmi qaysi guruhga kiradi?", opts:["Supervised learning","Unsupervised learning (klasterlash)","Reinforcement learning","Semi-supervised"], ans:1, izoh:"K-Means — unsupervised klasterlash algoritmi. U K ta markaz (centroid) atrofida ma'lumot nuqtalarini guruhlaydi, belgilangan ma'lumotlarsiz."},
    {q:"Precision va Recall o'lchovlarining farqi nima?", opts:["Bir xil narsa","Precision — to'g'ri musbat/jami musbat topilgan, Recall — to'g'ri musbat/jami haqiqiy musbat","Precision tezlik, Recall aniqlik","Faqat ikkilik klassifikatsiyada farq qiladi"], ans:1, izoh:"Precision = TP/(TP+FP): topilganlarning qanchasini to'g'ri. Recall = TP/(TP+FN): haqiqiy musbatlarning qanchasini topdik. F1-score ularning garmonik o'rtachasi."},
    {q:"LSTM nima uchun oddiy RNN dan yaxshiroq?", opts:["Tezroq o'rganadi","Uzoq muddatli bog'liqliklarni saqlaydi (vanishing gradient muammosini hal qiladi)","Kamroq parametrga ega","Faqat matn uchun"], ans:1, izoh:"LSTM (Long Short-Term Memory) — gate mexanizmlari (forget, input, output) orqali uzoq muddatli bog'liqliklarni saqlaydi. Oddiy RNN vanishing gradient muammosiga duchor bo'ladi."},
    {q:"Confusion matrix da True Positive nima?", opts:["Model noto'g'ri musbat dedi","Model to'g'ri musbat dedi","Model noto'g'ri manfiy dedi","Model to'g'ri manfiy dedi"], ans:1, izoh:"True Positive (TP) — model musbat dedi VA haqiqatda musbat. False Positive — model musbat dedi lekin manfiy. False Negative — model manfiy dedi lekin musbat edi."},
    {q:"Attention mechanism (Transformer) asosiy g'oyasi nima?", opts:["Barcha kirish elementlariga bir xil e'tibor","Muhim elementlarga ko'proq e'tibor qaratish","Ma'lumotlarni kompressiya qilish","Rekurrent bog'liqliklarni hisoblash"], ans:1, izoh:"Attention mexanizmi har bir element uchun boshqa barcha elementlar bilan aloqadorlikni hisoblaydi va muhimroqlarga katta og'irlik beradi. GPT, BERT asosi."},
    {q:"Batch Normalization nima uchun ishlatiladi?", opts:["Tezlikni oshirish","Trening jarayonini barqarorlashtirish va tezlashtirish","Xotira tejash","Overfitting uchun"], ans:1, izoh:"Batch Normalization har qatlam kirishini normallashtiradi. Bu gradient yo'qolishi/portlashini kamaytiradi, katta learning rate ishlatish imkonini beradi."},
    {q:"Dropout regularization nima?", opts:["Ma'lumotlarni o'chirish","Trening vaqtida tasodifiy neyronlarni o'chirish","Modelni kichraytirish","Aktivatsiya funksiyasini o'zgartirish"], ans:1, izoh:"Dropout — trening paytida har iteratsiyada neyronlarning bir qismini tasodifiy o'chiradi. Bu neyronlar bir-biriga haddan tashqari tayanmasligiga olib keladi (overfitting kamaytiradi)."},
    {q:"Support Vector Machine (SVM) asosiy g'oyasi nima?", opts:["Daraxt strukturasini qurish","Sinflar orasidagi maksimal chegarani (margin) topish","K ta klaster hosil qilish","Ehtimollik hisoblash"], ans:1, izoh:"SVM ikkita sinf orasidagi eng katta bo'shliqni (margin) ta'minlovchi ajratuvchi giperyuzani topadi. Support vectors — bu giperyuzaga eng yaqin nuqtalar."},
    {q:"Logistic Regression qaysi turdagi masalalar uchun ishlatiladi?", opts:["Regression (raqam taxmin qilish)","Klassifikatsiya (kategoriya aniqlash)","Klasterlash","Dimensiya qisqartirish"], ans:1, izoh:"Logistic Regression nomiga qaramay — klassifikatsiya algoritmi. Sigmoid funksiya orqali 0 va 1 orasidagi ehtimollik chiqaradi."},
    {q:"PCA (Principal Component Analysis) nima uchun kerak?", opts:["Model o'rgatish uchun","Ma'lumotlarning o'lchovini kamaytirish (dimensionality reduction)","Klasifikatsiya uchun","Overfitting uchun"], ans:1, izoh:"PCA ma'lumotlarni eng ko'p dispersiya saqlanadigan yangi o'qlar (principal components) ga proyeksiyalaydi. Ko'p o'lchovli ma'lumotlarni vizualizatsiya va siqish uchun ishlatiladi."},
    {q:"AI modelini baholashda Cross-Validation nima uchun kerak?", opts:["Modelni tezlashtirish","Modelning umumlashuvini (generalization) to'g'ri baholash","Ma'lumotlarni tozalash","Neyronlar sonini aniqlash"], ans:1, izoh:"Cross-Validation (k-fold) ma'lumotlarni k ta qismga bo'ladi va k marta o'rgatib-test qiladi. Bu modelning yangi ma'lumotlarda qanday ishlashini ishonchli baholaydi."}
  ],
  math: [
    {q:"Chiziqli algebra da matritsa determinanti nima uchun kerak?", opts:["Matritsani qo'shish uchun","Teskari matritsaning mavjudligini tekshirish va transformatsiyani ifodalash uchun","Matritsani ko'paytirish uchun","Matritsa izini topish uchun"], ans:1, izoh:"Determinant nolga teng bo'lmagan matritsa inversga (teskari) ega. Geometrik ma'noda — matritsa ifodalagan transformatsiyaning sirt yuzasini o'zgartirish koeffitsienti."},
    {q:"Gradient vektori nima?", opts:["Funksiyaning qiymati","Funksiyaning eng tez o'sish yo'nalishi va tezligi","Funksiyaning o'rtacha qiymati","Funksiyaning minimum nuqtasi"], ans:1, izoh:"Gradient — ko'p o'zgaruvchili funksiyaning barcha qisman hosilalaridan iborat vektor. U funksiya eng tez ortadigan yo'nalishni ko'rsatadi. Gradient Descent undan foydalanadi."},
    {q:"Ehtimollik nazariyasida Bayes teoremasi nima?", opts:["P(A|B) = P(B|A) · P(A) / P(B)","P(A|B) = P(A) + P(B)","P(A∩B) = P(A) · P(B)","P(A∪B) = P(A) - P(B)"], ans:0, izoh:"Bayes teoremasi shartli ehtimollikni qayta hisoblashga imkon beradi: P(A|B) = P(B|A)·P(A)/P(B). Naive Bayes, Bayesian inference asosi."},
    {q:"Eigenvalue va Eigenvector nima?", opts:["Matritsa elementlari","Av = λv tenglamasini qanoatlantiruvchi skalyar va vektor","Matritsa iz va determinanti","Tasodifiy vektorlar"], ans:1, izoh:"Eigenvector — matritsa bilan ko'paytirilganda yo'nalishi o'zgarmaydigan vektor. Eigenvalue — shu vektorning qanchaga cho'zilganini bildiradi (Av = λv)."},
    {q:"Chiziqli regression da 'least squares' metodi nima?", opts:["Hato kvadratlarini maksimallash","Hato kvadratlari yig'indisini minimallash","Hatoni 0 ga tenglashtirish","Barcha nuqtalardan o'tuvchi chiziq topish"], ans:1, izoh:"Least Squares — barcha nuqtalardan vertikal masofalar kvadratlari yig'indisini minimallaydi. Bu eng yaxshi moslik chizig'ini beradi."},
    {q:"Integral hisoblashning asosiy maqsadi nima?", opts:["Hosilani topish","Funksiya ostidagi maydonni topish","Funksiyaning maksimumini topish","Funksiyani soddalashtirish"], ans:1, izoh:"Aniq integral funksiya grafigi ostidagi maydonni hisoblaydi. Noaniq integral esa hosilasi berilgan funksiyadan — anthosilani topadi."},
    {q:"Korrelyatsiya koeffitsienti r = 1 bo'lsa, bu nimani anglatadi?", opts:["Bog'liqlik yo'q","To'liq musbat chiziqli bog'liqlik","To'liq manfiy bog'liqlik","Qisman bog'liqlik"], ans:1, izoh:"r = 1 — ikkita o'zgaruvchi orasida to'liq musbat chiziqli korrelyatsiya. Biri ortsa, ikkinchisi mutanosib ravishda ortadi. r = -1 teskari yo'nalishda."},
    {q:"Konveksiya (convexity) muammolarda nima kafolatlaydi?", opts:["Bitta mahalliy minimum mavjud","Ixtiyoriy mahalliy minimum — global minimum","Ko'p minimum mavjud","Minimum yo'q"], ans:1, izoh:"Konveks funksiyada ixtiyoriy mahalliy minimum — global minimum. Shuning uchun ML da konveks loss funksiyalar ishlash osonroq (Gradient Descent kafolatlangan holda yaqinlashadi)."},
    {q:"Softmax funksiyasi nima uchun ishlatiladi?", opts:["Ikkilik klassifikatsiya uchun","Ko'p sinfli klassifikatsiyada natijani ehtimollik vektoriga aylantirish uchun","Gradient hisoblash uchun","Aktivatsiya uchun"], ans:1, izoh:"Softmax ko'p sinf uchun chiqish vektorini ehtimollikka aylantiradi: e^zi / Σe^zj. Natijalar yig'indisi 1 ga teng bo'ladi."},
    {q:"Dispersion (variance) nima?", opts:["O'rtacha qiymat","Qiymatlarning o'rtachadan og'ishining kvadrat o'rtachasi","Maksimum va minimum farqi","Median qiymat"], ans:1, izoh:"Variance = E[(X - μ)²] — qiymatlar o'rtachadan qanchalik tarqalganini o'lchaydi. Standard deviation — variance ning kvadrat ildizi."},
    {q:"Eksponensial funksiya f(x) = e^x ning hosilasi nima?", opts:["x·e^(x-1)","e^x","x·e^x","1/e^x"], ans:1, izoh:"f(x) = e^x ning hosilasi o'zi — e^x. Bu matematik jihatdan noyob xususiyat: eksponensial funksiya o'z hosiliga teng."},
    {q:"Chiziqli mustaqillik (linear independence) nima degani?", opts:["Vektorlar bir xil yo'nalishda","Birorta vektorni boshqalari chiziqli kombinatsiyasi orqali ifodalab bo'lmaydi","Vektorlar bir-biriga tik","Vektorlar bir xil uzunlikda"], ans:1, izoh:"Chiziqli mustaqil vektorlar — ularning birontasini boshqalari chiziqli kombinatsiyasi bilan ifodalab bo'lmaydi. Bu matritsa rangini aniqlashda muhim."},
    {q:"Chi-squared (χ²) testi nima uchun ishlatiladi?", opts:["O'rtachalarni taqqoslash","Kategorik o'zgaruvchilar orasidagi bog'liqlikni tekshirish","Regressiya uchun","Klassifikatsiya uchun"], ans:1, izoh:"Chi-squared testi — kuzatilgan va kutilgan chastotalar o'rtasidagi farqni baholaydi. Kategorik ma'lumotlardagi bog'liqlik va mos kelishlikni tekshirishda ishlatiladi."},
    {q:"Logarifmik o'lchovning asosiy foydasi nima?", opts:["Hisob-kitobni qiyinlashtiradi","Katta sonlarni siqadi, eksponensial o'sishni chiziqli ko'rinishga keltiradi","Hamma qiymatlarni birga tenglashtiradi","Manfiy sonlarni musbatga aylantiradi"], ans:1, izoh:"Logarifm katta diapazonli ma'lumotlarni kichraytiradi (log scale). ML da cross-entropy loss log asosida, chunki ehtimolliklarni ko'paytirish o'rniga yig'indiga aylantiriladi."},
    {q:"Dot product (skalyar ko'paytma) a·b nima?", opts:["Vektor ko'paytmasi","Σ(ai·bi) — mos komponentlar ko'paytmasi yig'indisi","Vektorlar uzunligi ko'paytmasi","Vektorlar farqi"], ans:1, izoh:"Dot product a·b = Σ(ai·bi). Bu geometrik ma'noda |a|·|b|·cos(θ). Neyron tarmoqlarda har qatlam dot product + aktivatsiya funksiyasi orqali ishlaydi."},
    {q:"Funksiyaning ikkinchi tartibli hosila nima ko'rsatadi?", opts:["Funksiyaning qiymatini","Egilish (concavity) yo'nalishini — qavariqligi yoki botiqligini","Funksiyaning o'sish tezligini","Funksiyaning o'rtacha qiymatini"], ans:1, izoh:"Ikkinchi tartibli hosila f''(x) > 0 bo'lsa funksiya konveks (qavariq), f''(x) < 0 bo'lsa konkav (botiq). Optimizatsiyada mahalliy min/max aniqlashda ishlatiladi."},
    {q:"Monte Carlo metodi nima?", opts:["Analitik yechim usuli","Tasodifiy namunalar yordamida matematik miqdorlarni hisoblash","Deterministic algoritm","Matritsa operatsiyasi"], ans:1, izoh:"Monte Carlo — tasodifiy namunalar (simulation) orqali integralni, ehtimollikni yoki boshqa miqdorlarni hisoblash. Ko'p o'lchovli masalalar uchun samarali."},
    {q:"Rang (rank) matritsa uchun nima anglatadi?", opts:["Matritsa o'lchami","Chiziqli mustaqil satrlar (yoki ustunlar) soni","Matritsa determinanti","Matritsadagi nollar soni"], ans:1, izoh:"Matritsa rangi — chiziqli mustaqil satrlar yoki ustunlar maksimal soni. Chiziqli tenglamalar sistemasining yechimlari sonini aniqlaydi."},
    {q:"Normal taqsimot (Gaussian) qanday shaklga ega?", opts:["To'g'ri to'rtburchak","Qo'ng'iroqsimon (bell curve)","Uchburchak","Eksponensial"],  ans:1, izoh:"Normal taqsimot μ (o'rtacha) atrofida simmetrik qo'ng'iroqsimon shaklga ega. σ (standart og'ish) qanchalik katta bo'lsa, shu qadar keng tarqalgan."},
    {q:"Chiziqli algebra da vektor proyeksiyasi nima uchun kerak?", opts:["Vektorlarni qo'shish uchun","Bir vektorni boshqasi yo'nalishidagi tashkil etuvchisini topish uchun","Vektori uzunligini aniqlash uchun","Vektorlarni ko'paytirish uchun"], ans:1, izoh:"Proyeksiya — a vektorining b yo'nalishidagi tashkil etuvchisi: proj_b(a) = (a·b/|b|²)·b. PCA, Gram-Schmidt, attention mexanizmi asosi."}
  ],
  db: [
    {q:"SQL da PRIMARY KEY ning asosiy xususiyati nima?", opts:["NULL qabul qiladi","Noyob va NULL bo'lmagan qiymat kafolatlaydi","Faqat bitta jadvalda bo'ladi","Ko'p qatorlarda bir xil bo'lishi mumkin"], ans:1, izoh:"Primary Key — jadvaldagi har bir qatorni noyob identifikatsiya qiladi. NULL bo'lmasligi va noyobligi shart. Bitta jadvalda faqat bitta PK bo'lishi mumkin."},
    {q:"INNER JOIN va LEFT JOIN farqi nima?", opts:["Farq yo'q","INNER JOIN ikkala jadvalda mos qatorlarni, LEFT JOIN chap jadvalning barchasini qaytaradi","LEFT JOIN faqat chap jadval, INNER JOIN faqat o'ng jadval","INNER JOIN yangi jadval yaratadi"], ans:1, izoh:"INNER JOIN — faqat ikkala jadvalda mos yozuv bo'lganda qaytaradi. LEFT JOIN — chap jadvalning barcha qatorlarini, o'ngda mos yo'q bo'lsa NULL bilan qaytaradi."},
    {q:"Normalizatsiya (1NF, 2NF, 3NF) maqsadi nima?", opts:["Ma'lumotlarni siqish","Takrorlanishni kamaytirish va ma'lumotlar yaxlitligini ta'minlash","So'rovlarni tezlashtirish","Jadval sonini kamaytirish"], ans:1, izoh:"Normalizatsiya — ma'lumotlar takrorlanishini (redundancy) kamaytiradi va anomaliyalarni (insert, update, delete anomalies) oldini oladi."},
    {q:"Index (indeks) ma'lumotlar bazasida nima qiladi?", opts:["Ma'lumotlarni shifrlaydi","Qidirish va saralash so'rovlarini tezlashtiradi","Ma'lumotlarni arxivlaydi","Jadval hajmini kamaytiradi"], ans:1, izoh:"Index — ma'lumotlarning alohida ko'rsatkichi. Qidirish uchun butun jadvalni ko'rib chiqish o'rniga, index orqali to'g'ridan-to'g'ri kerakli qatorga boriladi."},
    {q:"ACID xususiyatlari nima?", opts:["Atomicity, Consistency, Isolation, Durability","Accuracy, Correctness, Integrity, Dependability","Availability, Consistency, Isolation, Delivery","Access, Control, Input, Data"], ans:0, izoh:"ACID — tranzaksiyalar xavfsizligini ta'minlovchi 4 xususiyat: Atomicity (hammasi yoki hech nima), Consistency (ma'lumotlar yaxlitligi), Isolation (tranzaksiyalar bir-birini ko'rmaydi), Durability (saqlangan ma'lumot yo'qolmaydi)."},
    {q:"NoSQL va SQL ma'lumotlar bazasining asosiy farqi nima?", opts:["NoSQL tezroq","SQL jadvallar, NoSQL moslashuvchan sxema (hujjat, kalit-qiymat, graf)","NoSQL SQL dan eski","SQL faqat kichik ma'lumotlar uchun"], ans:1, izoh:"SQL — relyatsion, qat'iy sxema, jadvallar. NoSQL — moslashuvchan: MongoDB (hujjat), Redis (kalit-qiymat), Neo4j (graf). Katta ma'lumotlar va gorizontal kengayish uchun qulay."},
    {q:"Stored Procedure nima?", opts:["Saqlangan jadval","Ma'lumotlar bazasida saqlangan, qayta foydalanish mumkin bo'lgan SQL buyruqlar to'plami","Indeks turi","Tranzaksiya turi"], ans:1, izoh:"Stored Procedure — serverda saqlangan va chaqirilganda bajariladigan SQL kodlar bloki. Murakkab operatsiyalarni markazlashtiradi, tarmoq yukini kamaytiradi."},
    {q:"FOREIGN KEY qanday cheklash (constraint) o'rnatadi?", opts:["Qiymat noyob bo'lishini ta'minlaydi","Boshqa jadvalning PRIMARY KEY ga mos qiymat bo'lishini ta'minlaydi (referential integrity)","NULL qiymatga yo'l qo'ymaydi","Qiymatlar doirasini cheklaydi"], ans:1, izoh:"Foreign Key — referential integrity: bir jadvalning ustuni boshqa jadval PK ga ishora qiladi. Bog'liq qatorni o'chirishga yoki bo'lmagan PK ni qo'shishga yo'l qo'ymaydi."},
    {q:"SQL da GROUP BY nima uchun ishlatiladi?", opts:["Ma'lumotlarni tartiblash uchun","Bir xil qiymatli qatorlarni guruhlash va agregat funksiya (COUNT, SUM, AVG) qo'llash uchun","Jadvallarni birlashtirish uchun","Dublikatlarni o'chirish uchun"], ans:1, izoh:"GROUP BY ma'lumotlarni ustun qiymati bo'yicha guruhlaydi. Har bir guruh uchun COUNT(), SUM(), AVG(), MAX(), MIN() funksiyalari qo'llaniladi."},
    {q:"Tranzaksiya rollback nima?", opts:["Tranzaksiyani tasdiqlash","Tranzaksiyani bekor qilish — barcha o'zgarishlarni qaytarish","Tranzaksiyani saqlash","Yangi tranzaksiya boshlash"], ans:1, izoh:"ROLLBACK — tranzaksiya ichidagi barcha o'zgarishlarni bekor qiladi va ma'lumotlarni tranzaksiya boshlanishidagi holatga qaytaradi."},
    {q:"Denormalization qachon qo'llaniladi?", opts:["Ma'lumotlar yaxlitligini oshirish uchun","O'qish so'rovlarini tezlashtirish uchun yozish tezligini qurbon qilish","Saqlash hajmini kamaytirish uchun","Normalizatsiya bilan bir xil"], ans:1, izoh:"Denormalization — jadvallarni birlashtirish yoki ma'lumotlarni takrorlash orqali JOIN larni kamaytiradi. O'qish juda ko'p, yozish kam bo'lgan sistemalarda (data warehouse) ishlatiladi."},
    {q:"ORM (Object-Relational Mapping) nima?", opts:["Ma'lumotlar bazasi interfeysi","Dastur ob'ektlarini jadval qatorlariga mos keltiradigan abstraktsiya qatlami","SQL optimizatsiya vositasi","Backup mexanizmi"], ans:1, izoh:"ORM (Django ORM, SQLAlchemy, Hibernate) — kod ob'ektlarini SQL jadvallariga avtomatik mos keltiradigan kutubxona. SQL yozmasdan Python/Java class lar bilan ishlash imkonini beradi."},
    {q:"Sharding ma'lumotlar bazasida nima?", opts:["Zaxira nusxasi yaratish","Ma'lumotlarni bir nechta server bo'ylab gorizontal taqsimlash","Jadvallarni indekslash","Tranzaksiyalarni boshqarish"], ans:1, izoh:"Sharding — katta ma'lumotlar bazasini mayda bo'laklarga (shard) bo'lib, alohida serverlariga joylash. Bu gorizontal kengayish (horizontal scaling) ni ta'minlaydi."},
    {q:"SQL da HAVING vs WHERE farqi nima?", opts:["Bir xil narsa","WHERE qatorlarni filtrdan o'tkazadi (guruhlanishdan oldin), HAVING guruhlarni filtrdan o'tkazadi (GROUP BY dan keyin)","HAVING yangi ustun yaratadi","WHERE faqat raqamlar uchun"], ans:1, izoh:"WHERE — GROUP BY bajarilishidan oldin qatorlarni filtrlaydi. HAVING — guruhlangandan keyin guruh shartlarini filtrlaydi (masalan: HAVING COUNT(*) > 5)."},
    {q:"Cursor (kursorlar) ma'lumotlar bazasida nima uchun?", opts:["Foydalanuvchi interfeysi uchun","So'rov natijasini qator-qator qayta ishlash uchun","Jadval yaratish uchun","Indeks yaratish uchun"], ans:1, izoh:"Cursor — so'rov natijasini bir butun sifatida emas, qator-qator qayta ishlash imkonini beradi. Stored procedure va murakkab ma'lumot qayta ishlashda ishlatiladi."},
    {q:"B-tree indeks qanday ma'lumotlarda samarali?", opts:["Faqat raqamlarda","Tartiblash va diapazon so'rovlarida (>, <, BETWEEN)","Faqat matnlarda","Faqat LIKE so'rovlarida"], ans:1, izoh:"B-tree (Balanced tree) indeks — tartiblangan ma'lumotlar uchun. = dan tashqari >, <, BETWEEN, ORDER BY kabi diapazon so'rovlarda ham samarali."},
    {q:"Replication (replikatsiya) nimani ta'minlaydi?", opts:["Ma'lumotlarni siqish","Yuqori mavjudlik (high availability) va yuk balansi uchun ma'lumotlar nusxasini saqlash","Tranzaksiyalar xavfsizligi","Normalizatsiya"], ans:1, izoh:"Replication — master/slave arxitekturasida ma'lumotlar asosiy serverdan secondary serverlarga ko'chiriladi. O'qish yukini taqsimlaydi va xato holatida zaxira bo'ladi."},
    {q:"SQL da VIEW nima?", opts:["Haqiqiy jadval","Virtual jadval — saqlangan so'rov natijasi","Takrorlangan jadval","Vaqtinchalik jadval"], ans:1, izoh:"VIEW — saqlangan SELECT so'rovi. Jadval kabi ishlatiladi, lekin ma'lumotlar yo'q — so'rov chaqirilganda bajariladi. Murakkab so'rovlarni soddalashtiradi."},
    {q:"Ma'lumotlar bazasida trigger nima?", opts:["Foydalanuvchi tugmasi","Jadvalda qo'shish/o'zgartirish/o'chirish hodisasida avtomatik bajariladigan kod","Tranzaksiya turlari","Backup jarayoni"], ans:1, izoh:"Trigger — DML operatsiya (INSERT, UPDATE, DELETE) sodir bo'lganda avtomatik ishlaydigan saqlangan kod. Ma'lumotlar yaxlitligini tekshirish yoki audit uchun ishlatiladi."},
    {q:"CAP teoremasi nimani anglatadi?", opts:["Consistency, Availability, Performance","Consistency, Availability, Partition tolerance — taqsimlangan tizim uchta xususiyatdan faqat ikkitasini kafolat beradi","Control, Access, Protection","Concurrency, Atomicity, Persistence"], ans:1, izoh:"CAP teoremasi: taqsimlangan tizim Consistency (barcha nodlarda bir xil ma'lumot), Availability (har doim javob beradi) va Partition tolerance (tarmoq bo'linishiga chidamli) dan faqat ikkitasini bir vaqtda ta'minlay oladi."}
  ],
  web: [
    {q:"HTML da semantic tag larning maqsadi nima?", opts:["Dizaynni yaxshilash","Kontent ma'nosini ifoda etish, qidiruvchi motorlar va ekran o'quvchilar uchun tushunarliroq qilish","Sahifani tezlashtirish","JavaScript bilan ishlash"], ans:1, izoh:"Semantic HTML (<header>, <nav>, <main>, <article>, <footer>) teglar — kontent ma'nosini ifodalaydi. SEO uchun muhim va accessibility (ekran o'quvchilar) ni yaxshilaydi."},
    {q:"CSS Box Model da margin, padding, border tartibini to'g'ri ko'rsating:", opts:["Margin > Border > Padding > Content","Border > Margin > Padding > Content","Padding > Border > Margin > Content","Content > Margin > Padding > Border"], ans:0, izoh:"CSS Box Model tashqaridan: Margin (element atrofidagi bo'sh joy) → Border (chegara) → Padding (ichki bo'sh joy) → Content (haqiqiy kontent)."},
    {q:"JavaScript da 'closure' nima?", opts:["Funksiyani yopish","Ichki funksiyaning tashqi funksiya o'zgaruvchilariga kirishini saqlab qolishi","Ob'ektni yaratish","Prototip zanjiri"], ans:1, izoh:"Closure — ichki funksiya tashqi funksiya bajarilib bo'lgandan keyin ham uning o'zgaruvchilarini 'eslaydi'. Bu private state va factory function larni yaratishga imkon beradi."},
    {q:"HTTP va HTTPS ning asosiy farqi nima?", opts:["HTTPS tezroq","HTTPS SSL/TLS bilan ma'lumotlarni shifrlaydi","HTTP yangi protokol","Farq yo'q"], ans:1, izoh:"HTTPS — HTTP + SSL/TLS shifrlash. Ma'lumotlar uchuvchi (man-in-the-middle hujumdan) himoyalanadi. Zamonaviy brauzerlar HTTP ni xavfli deb belgilaydi."},
    {q:"RESTful API da HTTP metodlari qanday ishlatiladi?", opts:["Faqat GET va POST","GET (o'qish), POST (yaratish), PUT (yangilash), DELETE (o'chirish)","Faqat POST","GET va DELETE"], ans:1, izoh:"REST konvensiyasi: GET — ma'lumot olish, POST — yangi yaratish, PUT/PATCH — yangilash, DELETE — o'chirish. Har bir metod ma'lum operatsiya uchun mo'ljallangan."},
    {q:"JavaScript da 'event loop' qanday ishlaydi?", opts:["Parallel threadlarda","Call stack, Web API, Callback Queue — asinxron operatsiyalar boshqaruvi","Faqat sinxron","Operatsion tizim tomonidan"], ans:1, izoh:"JS single-threaded. Event loop: Call Stack bo'sh bo'lganda, Callback Queue dagi funksiyalarni stack ga qo'yadi. setTimeout, fetch, DOM events — Web API tomonidan boshqariladi."},
    {q:"CSS Flexbox da 'justify-content: space-between' nima qiladi?", opts:["Elementlarni markazlashtiradi","Elementlar orasidagi bo'shliqni teng taqsimlaydi, birinchi va oxirgi elementlar chetlarga","Elementlarni stretches qiladi","Elementlarni vertikal joylashtiradi"], ans:1, izoh:"justify-content: space-between — flex elementlar orasidagi bo'shliqni teng taqsimlaydi, birinchi element boshiga, oxirgi element oxiriga yopishib turadi."},
    {q:"DOM (Document Object Model) nima?", opts:["Ma'lumotlar bazasi","HTML hujjatning dasturiy interfeysi — JavaScript bilan boshqarish imkoni","CSS qoidalar to'plami","Brauzer tizimi"], ans:1, izoh:"DOM — HTML hujjatning daraxt strukturasidagi dasturiy ko'rinishi. JavaScript DOM API orqali elementlarni qo'shish, o'zgartirish, o'chirish va hodisalarni boshqarish mumkin."},
    {q:"Asynchronous JavaScript da Promise nima?", opts:["Sinxron funksiya","Kelajakdagi qiymatni ifodalovchi ob'ekt — pending/fulfilled/rejected holatlari bilan","Loop turi","Ma'lumot turi"], ans:1, izoh:"Promise — asinxron operatsiyaning natijasini ifodalaydi. 3 holat: pending (kutilmoqda), fulfilled (muvaffaqiyatli), rejected (xato). .then()/.catch() yoki async/await bilan ishlatiladi."},
    {q:"CSS da 'position: absolute' va 'position: relative' farqi nima?", opts:["Bir xil","relative — o'z normal o'rniga nisbatan, absolute — eng yaqin positioned ajdodiga nisbatan joylashadi","absolute tezroq ishlaydi","relative faqat flexbox da"], ans:1, izoh:"position: relative — elementni normal oqimda qoldiradi, top/left/right/bottom uni shu joyga nisbatan ko'chiradi. position: absolute — normal oqimdan chiqaradi, eng yaqin positioned ajdodga nisbatan joylashadi."},
    {q:"Git da 'merge' va 'rebase' farqi nima?", opts:["Bir xil narsa","merge — birlashtirish tarixi saqlanadi, rebase — tarix chiziqli bo'ladi","rebase xavfliroq","merge yangi fayllar yaratadi"], ans:1, izoh:"Git merge — ikkala branch tarixini saqlab yangi 'merge commit' yaratadi. Git rebase — bir branch commit larini boshqasining ustiga ko'chiradi, tarix chiziqli va toza ko'rinadi."},
    {q:"Web da 'viewport' meta tag nima uchun kerak?", opts:["Faqat mobil uchun","Sahifaning mobil qurilmalardagi o'lchovini boshqarish uchun","JavaScript uchun","Brauzer versiyasi uchun"], ans:1, izoh:"<meta name='viewport' content='width=device-width, initial-scale=1'> — mobil brauzerga sahifa kengligini qurilma kengligi bilan tenglashtiradi. Responsive dizayn uchun zarur."},
    {q:"localStorage va sessionStorage farqi nima?", opts:["Bir xil","localStorage brauzer yopilganda ham saqlanadi, sessionStorage faqat joriy sessiya uchun","localStorage ko'proq hajm","sessionStorage xavfsizroq"], ans:1, izoh:"localStorage — brauzer yopilganda ham ma'lumotlar o'chmaydi (persistent). sessionStorage — tab yoki brauzer yopilganda o'chadi. Ikkisi ham ~5MB ga qadar saqlaydi."},
    {q:"CORS (Cross-Origin Resource Sharing) nima uchun kerak?", opts:["Sahifani tezlashtirish","Brauzerning xavfsizlik siyosatini boshqarish — boshqa domaindan so'rov yuborishga ruxsat berish/rad etish","SSL sertifikati uchun","Cache boshqarish uchun"], ans:1, izoh:"CORS — brauzer xavfsizligi: A.com saytidan B.com API ga so'rov yuborilganda, B.com server CORS headerlar orqali ruxsat berishi yoki rad etishi mumkin."},
    {q:"Web Performance da 'lazy loading' nima?", opts:["Resurslarni oldindan yuklash","Resurslarni (rasm, video) faqat ko'rinish maydoniga kirganda yuklash","Keshdan yuklash","Ma'lumotlarni siqish"], ans:1, izoh:"Lazy loading — rasmlар, video va boshqa resurslarni sahifa ochilganda emas, foydalanuvchi scroll qilib yetib borganida yuklaydi. Bu dastlabki yuklash vaqtini kamaytiradi."},
    {q:"JavaScript da '===' va '==' farqi nima?", opts:["Bir xil","=== qat'iy tenglik (tur va qiymat), == faqat qiymat (tur konversiyasi bilan)","=== faqat raqamlar uchun","== yangi operator"], ans:1, izoh:"=== strict equality: '5' === 5 → false (string vs number). == loose equality: '5' == 5 → true (tur konversiyasi qo'llaniladi). Aksariyat holatlarda === afzalroq."},
    {q:"CSS Grid va Flexbox ning asosiy farqi nima?", opts:["Bir xil narsa","Flexbox bir o'qli (1D), Grid ikki o'qli (2D) layout uchun","Grid yangi, Flexbox eski","Flexbox sahifa uchun, Grid komponent uchun"], ans:1, izoh:"Flexbox — bir yo'nalishda (qator yoki ustun) elementlarni joylashtirishda eng samarali. CSS Grid — ikki o'lchovli (rows + columns) murakkab sahifa layoutlari uchun."},
    {q:"JSON formati nima?", opts:["Dasturlash tili","JavaScript Object Notation — insonlar va mashinalar o'qiy oladigan ma'lumot almashinuv formati","Ma'lumotlar bazasi","Protokol"], ans:1, izoh:"JSON — engil ma'lumot almashish formati. { \"key\": \"value\" } ko'rinishida. REST API lar orqali front-end va back-end o'rtasida ma'lumot uzatishda standart format."},
    {q:"SPA (Single Page Application) va MPA (Multi Page Application) farqi nima?", opts:["Bir xil narsa","SPA bir sahifada dinamik kontent yuklaydi, MPA har sahifa o'tishida yangi HTML yuklanadi","SPA sekinroq","MPA zamonaviyroq"], ans:1, izoh:"SPA (React, Vue, Angular) — bir HTML fayli, kontent JavaScript bilan dinamik yuklanadi, sahifa yangilanmaydi. MPA — har o'tishda server yangi HTML yuboradi. SPA UX yaxshi, MPA SEO yaxshi."},
    {q:"Web Security da XSS (Cross-Site Scripting) nima?", opts:["Serverni buzish","Hujumchi zararli JavaScript ni saytga kiritib, foydalanuvchi brauzerida ijro etishi","Parolni buzish","DDOS hujumi"], ans:1, izoh:"XSS — hujumchi zararli skriptni sahifaga kiritadi (input orqali). Boshqa foydalanuvchi sahifani ochganda, skript ularning brauzerida ijro etiladi — cookie o'g'irlash, phishing uchun ishlatiladi."}
  ]
};

// ═══════════════════════════════════════════════
// SESIYA — QO'SHIMCHA 10 SAVOL (har bir fanda)
// TEST (20) + QO'SHIMCHA (10) = SESIYA (30 ta)
// ═══════════════════════════════════════════════
var REAL_EXTRA_QUESTIONS = {
  algo: [
    {q:"Topological sort qaysi turdagi graflarda ishlaydi?", opts:["Yo'naltirilmagan graflar","Yo'naltirilgan asiklik graflar (DAG)","Og'irli graflar","Har qanday graflar"], ans:1, izoh:"Topological sort faqat DAG (Directed Acyclic Graph) larda ishlaydi. Tsikli grafda topologik tartib mavjud emas, chunki hech bir vertex boshqasidan oldin kela olmaydi."},
    {q:"Amortized analysis nima uchun kerak?", opts:["Eng yomon holni hisoblash","Ko'p operatsiyalar uchun o'rtacha narxni hisoblash","Faqat yaxshi holni hisoblash","Xotira sarfini hisoblash"], ans:1, izoh:"Amortized analysis — ko'plab operatsiyalarning umumiy narxini operatsiyalar soniga bo'lib topadi. Dynamic array push() O(1) amortized, chunki resizing kamdan-kam bo'ladi."},
    {q:"Two-pointer texnikasi qaysi muammolar uchun eng samarali?", opts:["Graf qidirish","Tartiblangan arrayda ikkita element yig'indisi/muammosi","Rekursiv muammolar","Graf daraxtlari"], ans:1, izoh:"Two-pointer (ikkita ko'rsatkich) texnikasi tartiblangan arrayda, pallindrom tekshirishda, oyna harakatida O(n²) dan O(n) ga tushiradi."},
    {q:"Bellman-Ford va Dijkstra algoritmining asosiy farqi nima?", opts:["Bellman-Ford tezroq","Bellman-Ford manfiy og'irlikli qirralarni ham qayta ishlaydi","Dijkstra barcha graflar uchun","Farq yo'q"], ans:1, izoh:"Dijkstra faqat musbat og'irliklar uchun. Bellman-Ford manfiy og'irliklar bilan ham ishlaydi va manfiy tsiklni aniqlaydi, lekin O(VE) murakkablikka ega."},
    {q:"Segment Tree ma'lumotlar tuzilmasi nima uchun ishlatiladi?", opts:["Tartiblash uchun","Diapazon so'rovlari (sum, min, max) ni O(log n) da qayta ishlash uchun","Graflarni saqlash uchun","Tasodifiy qidirish uchun"], ans:1, izoh:"Segment Tree — massivning qismlarida (diapazon) sum, min, max, gcd kabi so'rovlarni O(log n) da bajaradi. O'zgartirish ham O(log n)."},
    {q:"Trie (Prefix Tree) ma'lumotlar tuzilmasi nima uchun eng ko'p ishlatiladi?", opts:["Sonlarni tartiblash","Matnli ma'lumotlarda prefiks qidirish va autocomplete","Graf algoritmlari","Ikkilik qidirish"], ans:1, izoh:"Trie — so'zlarni harf-harf saqlaydi. Prefiks bo'yicha qidirish O(m), m — so'z uzunligi. Autocomplete, spell checker, IP routing uchun ishlatiladi."},
    {q:"0/1 Knapsack muammosi Dynamic Programming bilan O(?) murakkablikda yechiladi?", opts:["O(n)","O(n log n)","O(nW) — n element, W kapasitet","O(2^n)"], ans:2, izoh:"0/1 Knapsack DP bilan O(nW) — n ta element, W kapasitet. 2D DP jadvali quriladi: dp[i][w] = i-element bilan w kapasitetda maksimal qiymat."},
    {q:"Floyd-Warshall algoritmi nima hisoblaydi?", opts:["Faqat bitta manba shortest path","Barcha juft vertexlar orasidagi eng qisqa yo'l","Minimum spanning tree","Graf tsikllarini topish"], ans:1, izoh:"Floyd-Warshall — barcha juft (i,j) vertexlar orasidagi eng qisqa yo'lni O(V³) da hisoblaydi. Manfiy og'irliklar bilan ham ishlaydi."},
    {q:"Iterative deepening DFS (IDDFS) nima ustunlikka ega?", opts:["BFS dan tezroq","DFS ning kam xotira sarfi + BFS ning to'liqlik kafolati","Kamroq vaqt sarfi","Faqat daraxtlarda ishlaydi"], ans:1, izoh:"IDDFS — DFS kabi kam xotira (O(d)) sarflaydi, lekin BFS kabi eng qisqa yo'lni kafolatlaydi. Chuqurlik limiti sekin oshirib boriladi."},
    {q:"Space complexity: rekursiv DFS vs iterativ DFS qanday farqlanadi?", opts:["Bir xil","Rekursiv O(h) call stack, iterativ O(h) explicit stack — ikkalasi ham O(h)","Rekursiv O(1)","Iterativ O(n²)"], ans:1, izoh:"Rekursiv DFS — call stack da O(h) (h = daraxt balandligi) joy oladi. Iterativ DFS — explicit stack da O(h) joy oladi. Ikkalasi asimptotik bir xil, lekin rekursiv stack overflow xavfi ko'proq."}
  ],
  ai: [
    {q:"Encoder-decoder arxitekturasi qaysi vazifa uchun mo'ljallangan?", opts:["Ikkilik klassifikatsiya","Ketma-ketlikdan ketma-ketlikka (seq2seq): tarjima, xulosa","Klasterlash","Rasm klassifikatsiyasi"], ans:1, izoh:"Encoder-decoder (seq2seq) arxitekturasi kirish ketma-ketligini qisqartirib (encode), keyin yangi ketma-ketlik hosil qiladi (decode). Tarjima, matn xulosa, chatbot uchun."},
    {q:"L1 va L2 regularization farqi nima?", opts:["Bir xil narsa","L1 (Lasso) — siyrak weights, L2 (Ridge) — kichik weights, L1 ba'zi weightlarni nolga tushiradi","L2 tezroq","L1 faqat chiziqli modellarda"], ans:1, izoh:"L1 regularization ba'zi vazn (weight) larni to'liq nolga aylantiradi — bu feature selection vazifasini bajaradi. L2 barcha vazn larni kichraytiradi, lekin nolga tushirmaydi."},
    {q:"Batch size kichik bo'lganda nima bo'ladi?", opts:["Model tezroq yaqinlashadi","Gradient noisier bo'ladi, katta batch size ga nisbatan regularizatsiya effekti beradi","Model o'qimaydi","Ko'proq xotira kerak bo'ladi"], ans:1, izoh:"Kichik batch — noisier gradient, lekin regularizatsiya effekti beradi va local minimumdan chiqishga yordam beradi. Katta batch — aniqroq gradient, lekin katta xotira talab qiladi."},
    {q:"Word2Vec nima?", opts:["So'zlarni tartiblash algoritmi","So'zlarni real vektorial ko'rinishda ifodalovchi embedding modeli","Matn klassifikatori","Grammatika tekshiruvchi"], ans:1, izoh:"Word2Vec — so'zlarni yuqori o'lchovli vektor fazosiga joylaydi, bunda ma'nodosh so'zlar geometrik jihatdan yaqin bo'ladi. Skip-gram va CBOW arxitekturalari mavjud."},
    {q:"GAN (Generative Adversarial Network) da generator va discriminator nima qiladi?", opts:["Ikkisi ham bir vazifa","Generator soxta ma'lumot yaratadi, discriminator haqiqiy/soxta ajratadi","Generator klassifikatsiya qiladi","Discriminator ma'lumot yaratadi"], ans:1, izoh:"Generator — discriminatorni aldaydigan haqiqiydek soxta ma'lumot yaratadi. Discriminator — haqiqiy/soxta ajratishni o'rganadi. Ikkovlashin raqobati natijasida generator mukammallashadi."},
    {q:"Autoencoder nima uchun ishlatiladi?", opts:["Klassifikatsiya uchun","Dimensionality reduction, denoising, anomaly detection uchun","Regressiya uchun","Reinforcement learning uchun"], ans:1, izoh:"Autoencoder — kirish ma'lumotini kichik latent fazoga kodlab (encode), keyin qayta tiklaydi (decode). Siqish, shovqinni tozalash, anomaliya topishda ishlatiladi."},
    {q:"Learning rate juda katta bo'lsa nima bo'ladi?", opts:["Model tezroq o'rganadi","Model yaqinlashmaydi — loss oscillate yoki diverge bo'ladi","Overfitting ko'payadi","Hech nima o'zgarmaydi"], ans:1, izoh:"Katta learning rate — gradient descent minimum atrofida sakrashda davom etadi (oscillate) yoki loss ortib ketadi (diverge). Kichik learning rate esa juda sekin yaqinlashadi."},
    {q:"Semantic segmentation nima?", opts:["Rasmni ikkilik ajratish","Rasmning har bir pikselini ma'lum bir sinfga tegishli deb belgilash","Ob'ekt koordinatalarini topish","Rasmni klassifikatsiya qilish"], ans:1, izoh:"Semantic segmentation — rasmning har bir pikseliga sinf yorlig'i beradi (ko'cha, mashina, piyoda). Object detection faqat bounding box beradi, segmentation esa piksel darajasida ishlaydi."},
    {q:"Hyperparameter tuning da Random Search vs Grid Search farqi nima?", opts:["Bir xil","Random Search tasodifiy kombinatsiyalar sinaydi, Grid Search barcha kombinatsiyalarni", "Grid Search tezroq","Random Search har doim yaxshiroq"], ans:1, izoh:"Grid Search — barcha parametr kombinatsiyalarini tekshiradi (O(n^k) vaqt). Random Search — tasodifiy kombinatsiyalar sinaydi va ko'pincha tezroq yaxshi natija beradi, ayniqsa ko'p parametr bo'lsa."},
    {q:"BERT va GPT arxitekturasining asosiy farqi nima?", opts:["Bir xil narsa","BERT — bidirectional (ikki tomonlama) encoder, GPT — unidirectional (chap→o'ng) decoder","BERT generativ, GPT klassifikator","BERT kattaroq"], ans:1, izoh:"BERT — kontekstni ikki tomondan (chap va o'ng) ko'radi, shuning uchun tushunish (classification, QA) ga yaxshi. GPT — faqat chap kontekstni ko'radi, shuning uchun matn generatsiyasiga yaxshi."}
  ],
  math: [
    {q:"Jacobian matritsa nima?", opts:["Matritsa ko'paytmasi","Ko'p o'zgaruvchili funksiyaning barcha qisman hosilalaridan tashkil topgan matritsa","Matritsa teskari","Eigenvalue matritsa"], ans:1, izoh:"Jacobian J — vektorial funksiyaning barcha birinchi tartibli qisman hosilalari matritsasi. Backpropagation, Newton metodi, koordinat transformatsiyasi uchun muhim."},
    {q:"Shannon entropiyasi nima uchun kerak?", opts:["Ma'lumot siqish uchun faqat","Ma'lumot belirsizligi yoki axborot miqdorini o'lchash uchun","Matritsa hisoblash uchun","Vaqt murakkabligini hisoblash uchun"], ans:1, izoh:"Shannon entropiyasi H(X) = -Σ p(x) log p(x) — tasodifiy o'zgaruvchining belirsizligi yoki axborot miqdorini o'lchaydi. Cross-entropy loss ML da entropiya asosida qurilgan."},
    {q:"KL divergence (Kullback-Leibler) nima o'lchaydi?", opts:["Ikkita sonning farqi","Ikki ehtimollik taqsimoti orasidagi farqni o'lchaydi","Matritsa determinanti","Gradient yo'nalishi"], ans:1, izoh:"KL(P||Q) — P taqsimotdan Q ga nisbatan qanchalik ma'lumot yo'qolishini o'lchaydi. Variational autoencoders, information theory da keng ishlatiladi. Simmetrik emas: KL(P||Q) ≠ KL(Q||P)."},
    {q:"Markov zanjiri (Markov Chain) asosiy xususiyati nima?", opts:["Barcha o'tgan holatlarga bog'liq","Keyingi holat faqat joriy holatga bog'liq, o'tgan holatlarga bog'liq emas (Markov property)","Deterministik sistema","Ehtimollik yo'q"], ans:1, izoh:"Markov property — kelajak faqat hozirgi holat bilan aniqlanadi, tarix muhim emas. P(Xn+1|Xn, Xn-1,..., X0) = P(Xn+1|Xn). Reinforcement learning, NLP da ishlatiladi."},
    {q:"Merkez limit teoremasi (Central Limit Theorem) nima deydi?", opts:["Katta sonlar qonuni","Ixtiyoriy taqsimotdan olingan katta miqdordagi namunalar yig'indisi normal taqsimotga yaqinlashadi","Barcha ma'lumotlar normal taqsimotda","Faqat diskret ma'lumotlar uchun"], ans:1, izoh:"CLT — ixtiyoriy taqsimotda n katta bo'lganda, namunalar o'rtachasi normal taqsimotga yaqinlashadi. Bu statistika va ML da keng qo'llaniladigan fundamental teoreма."},
    {q:"Kovariansiya matritsasi (Covariance matrix) nima ko'rsatadi?", opts:["O'zgaruvchilarning o'rtacha qiymatlari","O'zgaruvchilar orasidagi chiziqli bog'liqliklarni","Taqsimotning o'rtacha qiymati","Determinanti"], ans:1, izoh:"Kovariansiya matritsasi Σ — d o'zgaruvchili ma'lumot uchun barcha juft o'zgaruvchilar orasidagi kovariansiyalarni saqlaydi. PCA, Gaussian distribution, Kalman filter da asosiy rol o'ynaydi."},
    {q:"Singular Value Decomposition (SVD) nima?", opts:["Matritsa determinanti","A = UΣV^T ko'rinishida matritsani uchta maxsus matritsa ko'paytmasiga ajratish","Matritsani inverslashtirish","Matritsani qo'shish"], ans:1, izoh:"SVD — ixtiyoriy matritsani A = UΣV^T ko'rinishda faktorizatsiya qiladi. PCA, recommendation systems (matrits faktorizatsiya), pseudo-inverse hisoblashda ishlatiladi."},
    {q:"Katta sonlar qonuni (Law of Large Numbers) nima deydi?", opts:["Katta sonlar murakkab","Namuna soni ortishi bilan namuna o'rtachasi haqiqiy o'rtachaga yaqinlashadi","Hamma sonlar teng","Tasodifiylik ortadi"], ans:1, izoh:"Katta sonlar qonuni — n→∞ da namuna o'rtachasi μ ga yaqinlashadi. Bu Monte Carlo simulatsiya, statistik taxmin, ML modellarning asosiy nazariy asosi."},
    {q:"Fourier transform nima uchun kerak?", opts:["Sonlarni tartiblash","Signalni vaqt domenidan chastota domeniga o'tkazish","Matritsa ko'paytirish","Gradient hisoblash"], ans:1, izoh:"Fourier transform — signalning tarkibiy chastotalarini topadi. Audio qayta ishlash, rasm siqish (JPEG), signal filtrlash, ba'zi ML modellarida ishlatiladi."},
    {q:"Beta taqsimoti qayerda ishlatiladi?", opts:["Diskret ma'lumotlar uchun","Ehtimollik o'zi ehtimollik sifatida ko'rilganda (Bayesian inference)","Faqat binomial taqsimot uchun","Normal taqsimot o'rnida"], ans:1, izoh:"Beta(α,β) taqsimoti [0,1] oralig'ida. Bayesian statistikada binomial taqsimot uchun prior sifatida ishlatiladi (Beta-Binomial conjugate pair). Click-through rate, conversion rate modellashtirish uchun qulay."}
  ],
  db: [
    {q:"EXPLAIN buyrugi SQL da nima uchun ishlatiladi?", opts:["Jadval yaratish uchun","So'rov bajarish rejasini (query plan) ko'rish va optimallash uchun","Jadval o'chirish uchun","Trigger yaratish uchun"], ans:1, izoh:"EXPLAIN — SQL so'rovining qanday bajarilishini ko'rsatadi: qaysi indeks ishlatilayotgani, join algoritmi, qator soni taxmini. Sekin so'rovlarni optimallashtirishda asosiy vosita."},
    {q:"Full-text search va LIKE operatori farqi nima?", opts:["Bir xil narsa","Full-text search inverted index ishlatadi va relevanlik bo'yicha tartiblaydi, LIKE esa simple pattern matching","LIKE tezroq","Full-text faqat bitta so'z uchun"], ans:1, izoh:"LIKE '%matn%' — to'liq table scan (O(n)), indeks ishlatmaydi. Full-text search (MATCH...AGAINST) — inverted index bilan O(log n), relevance ranking, stemming qo'llab-quvvatlaydi."},
    {q:"Connection pooling nima uchun kerak?", opts:["Ma'lumotlarni siqish uchun","Ma'lumotlar bazasiga yangi ulanish yaratish xarajatini tejash uchun ko'p marta qayta ishlatish","Tranzaksiyalarni boshqarish uchun","Indeks yaratish uchun"], ans:1, izoh:"Har safar yangi DB ulanish yaratish vaqt va resurs talab qiladi. Connection pool — oldindan yaratilgan ulanishlar to'plami. So'rov kelganda mavjud ulanish olinadi va qaytarilganda pool ga qaytariladi."},
    {q:"Optimistik va pessimistik bloklash (locking) farqi nima?", opts:["Bir xil narsa","Pessimistik — o'qishda ham bloklaydi, Optimistik — yozishda versiya tekshiradi","Optimistik tezroq har doim","Pessimistik faqat NoSQL da"], ans:1, izoh:"Pessimistik locking — to'qnashuv bo'ladi deb hisoblab darhol bloklaydi (SELECT...FOR UPDATE). Optimistik locking — to'qnashuv kam deb hisoblab, versiya/timestamp bilan yozishda tekshiradi."},
    {q:"Partitioning va Sharding farqi nima?", opts:["Bir xil narsa","Partitioning — bitta serverda mantiqiy bo'lish, Sharding — turli serverlarga gorizontal taqsimlash","Partitioning tashqi, Sharding ichki","Sharding vertikal"], ans:1, izoh:"Partitioning — bitta server ichida jadval ma'lumotlarini mantiqiy bo'laklarga ajratish (range, list, hash). Sharding — ma'lumotlarni bir nechta fizik serverlarga taqsimlash (gorizontal scale-out)."},
    {q:"Materialized View va oddiy View farqi nima?", opts:["Bir xil narsa","Materialized View natijalarni fizik saqlaydi, oddiy View faqat so'rov hisoblanadi","Materialized View yangi jadval","View ko'proq xotira"], ans:1, izoh:"View — har safar chaqirilganda so'rov bajariladi. Materialized View — natijalar fizik saqlanadi va vaqti-vaqti bilan yangilanadi. O'qish juda tez, lekin xotira sarfi ko'proq."},
    {q:"Event Sourcing pattern nima?", opts:["Faqat joriy holatni saqlash","Tizim holatini o'zgarishlar ro'yxati (event log) sifatida saqlash","Faqat oxirgi o'zgarishni saqlash","Tarqatilgan tranzaksiya"], ans:1, izoh:"Event Sourcing — tizim holati o'zgarishlar ketma-ketligi sifatida saqlanadi. Joriy holat barcha event larni qayta o'ynatish orqali tiklanadi. Audit trail, time travel, CQRS bilan ishlatiladi."},
    {q:"Two-Phase Commit (2PC) nima uchun kerak?", opts:["Bitta serverda tranzaksiya uchun","Taqsimlangan tranzaksiyalarda barcha nodalarda atomiklikni ta'minlash uchun","Replikatsiya uchun","Index optimallashtirish uchun"], ans:1, izoh:"2PC — taqsimlangan sistemada bir nechta serverda tranzaksiya: 1-faza: barcha nodlar 'tayyor' deydi, 2-faza: koordinator commit yoki rollback buyuradi. Atomiklikni kafolatlaydi."},
    {q:"Graph database qaysi hollarda relyatsion MB dan afzal?", opts:["Har doim afzal","Ko'p darajali bog'liqliklarni tez traversal qilishda (ijtimoiy tarmoq, yo'l topish)","Faqat kichik ma'lumotlar uchun","Faqat NoSQL deb ataladigan hollarda"], ans:1, izoh:"Graph DB (Neo4j, Amazon Neptune) — tugunlar va qirralar orqali murakkab bog'liqliklarni O(1) da traversal qiladi. Ijtimoiy tarmoqlar, recommendation engine, fraud detection uchun optimal."},
    {q:"MVCC (Multi-Version Concurrency Control) qanday ishlaydi?", opts:["Faqat bitta versiyani saqlaydi","Har bir yozishda yangi versiya yaratadi, o'qish eski versiyani ko'radi — lock yo'q","Barcha tranzaksiyalarni kutadi","Faqat PostgreSQL da"], ans:1, izoh:"MVCC — yozuvchi o'quvchini, o'quvchi yozuvchini bloklamaydi. Har bir tranzaksiya ma'lumotning o'z momentidagi snapshottini ko'radi. PostgreSQL, Oracle MVCC dan foydalanadi."}
  ],
  web: [
    {q:"Service Worker nima va nima uchun kerak?", opts:["CSS fayli","Brauzer va tarmoq orasida ishlaydigan proksi — offline ishlash, push notifications uchun","JavaScript framework","Server texnologiyasi"], ans:1, izoh:"Service Worker — fon da ishlaydigan JS skript. Tarmoq so'rovlarini ushlab qoladi (cache), offline rejimni, background sync va push notifications ni ta'minlaydi. PWA (Progressive Web App) asosi."},
    {q:"WebSocket va Server-Sent Events (SSE) farqi nima?", opts:["Bir xil narsa","WebSocket ikki tomonlama real-time, SSE faqat server→client bir tomonlama","SSE tezroq","WebSocket faqat chat uchun"], ans:1, izoh:"WebSocket — to'liq duplex (ikki tomonlama) real-time aloqa (chat, multiplayer o'yin). SSE — server→client bir tomonlama stream (yangiliklar lentasi, live updates). SSE simpleiroq, HTTP orqali ishlaydi."},
    {q:"Tree shaking JavaScript da nima?", opts:["DOM ni tozalash","Foydalanilmagan kod (dead code) ni bundle dan olib tashlash","Daraxt tuzilmasini saqlash","CSS tozalash"], ans:1, izoh:"Tree shaking — ES modules static import/export tahlili orqali foydalanilmagan kodni bundle dan chiqarib tashlaydi. Webpack, Rollup, Vite qo'llab-quvvatlaydi. Bundle hajmini kamaytiradi."},
    {q:"Virtual DOM nima va nima uchun kerak?", opts:["Brauzerning DOM dan ko'chirma","Real DOM ning JS ob'ektidagi yengil nusxasi — DOM yangilanishlarini optimallashtirish uchun","Server tomonida ishlaydi","CSS abstraktsiyasi"], ans:1, izoh:"Virtual DOM (React, Vue) — real DOM o'zgarishlarini to'g'ridan-to'g'ri qilish o'rniga, virtual nusxada solishtiradi (diffing) va faqat o'zgargan qismlarni yangilaydi. DOM operatsiyalari qimmat bo'lgani uchun samarali."},
    {q:"Content Security Policy (CSP) nima qiladi?", opts:["Kontent siqadi","XSS hujumlariga qarshi — qaysi manbalardan skript, rasm, stil yuklanishiga ruxsat beradi","CORS bilan bir xil","Faqat parollarni himoya qiladi"], ans:1, izoh:"CSP — HTTP header yoki meta tag orqali brauzerga qaysi domenlardan resurs (JS, CSS, rasm) yuklanishga ruxsat berilishini bildiradi. XSS hujumlarini katta darajada kamaytiradi."},
    {q:"HTTP/2 ning HTTP/1.1 dan asosiy ustunligi nima?", opts:["Xavfsizroq","Multiplexing — bitta ulanishda parallel so'rovlar, header kompressiya, server push","Yangi protokol","Tezroq DNS"], ans:1, izoh:"HTTP/2 — bitta TCP ulanishda bir nechta so'rovni parallel yuboradi (multiplexing). HTTP/1.1 da har so'rov uchun yangi ulanish kerak edi (yoki HOL blocking muammosi). Header compression ham qo'shildi."},
    {q:"OAuth 2.0 qanday ishlaydi (asosiy oqim)?", opts:["Foydalanuvchi parolini uchinchi tomonga beradi","Foydalanuvchi autorizatsiya serverida kiradi, access token oladi — parol emas, token ishlatiladi","Faqat API kalitlari","Parolni shifrlaydi"], ans:1, izoh:"OAuth 2.0 — resource owner (foydalanuvchi) → authorization server → access token. Uchinchi tomon ilovalar foydalanuvchi paroliga kirmasdan, faqat ruxsat berilgan resurslardan foydalana oladi."},
    {q:"WebAssembly (WASM) nima va qachon ishlatiladi?", opts:["JavaScript uchun yangi sintaksis","Brauzerda near-native tezlikda bajariladigan binary format — CPU-intensive vazifalar uchun","CSS preprocessor","Yangi HTML standart"], ans:1, izoh:"WebAssembly — C/C++/Rust kabi tillarni brauzerda near-native tezlikda bajarish imkonini beradi. 3D o'yinlar, video/audio encoding, kriptografiya, CAD vositalar uchun ishlatiladi."},
    {q:"Micro-frontends arxitekturasi nima?", opts:["CSS micro animatsiyalar","Katta frontend ilovani kichik, mustaqil, alohida deploy qilinadigan qismlarga bo'lish","Bitta komponent qilish","Mobile arxitektura"], ans:1, izoh:"Micro-frontends — backend microservices g'oyasini frontendga ko'chirish. Har bir jamoa mustaqil ravishda o'z qismini ishlab chiqadi va deploy qiladi. Module Federation (Webpack 5) keng ishlatiladi."},
    {q:"Progressive Enhancement va Graceful Degradation farqi nima?", opts:["Bir xil narsa","Progressive Enhancement — asosiy funksionallikdan boshlab, imkoniyatlar qo'shiladi; Graceful Degradation — to'liq funksionallikdan boshlab, eski brauzerlarda soddalashadi","Faqat mobile dizayn","CSS metodologiyasi"], ans:1, izoh:"Progressive Enhancement — avval barcha brauzerlarda ishlaydigan asosiy versiya, keyin zamonaviy xususiyatlar qo'shiladi. Graceful Degradation — zamonaviy versiyadan boshlanib, eski muhitlar uchun osonlashtiriladi."}
  ]
};

var _currentRealSubject = null;
var _currentRealQuestions = [];
var _realAnswers = {};

var _currentTestSubject = null;
var _currentTestQuestions = [];
var _testAnswers = {};
var _testTimer = null, _realTimer = null;
var _testSec = 30*60, _realSec = 90*60;

function setSesiyaState(type, active, noToast) {
  SESIYA_STATE[type] = active;
  var now = new Date();
  var timeStr = now.getHours().toString().padStart(2,'0') + ':' + now.getMinutes().toString().padStart(2,'0');
  var label = type === 'test' ? 'Test Rejim' : 'Sesiya';
  var action = active ? 'faollashtirildi' : 'bloklandi';
  var emoji = active ? '✅' : '🔒';
  // Update log — only when user actually clicks (noToast = page render, skip log)
  if (!noToast) {
    var log = document.getElementById('sesiyaLog');
    if (log) {
      var oldEmpty = log.querySelector('[style*="text-align:center"]');
      if (oldEmpty) oldEmpty.remove();
      var entry = document.createElement('div');
      entry.style.cssText = 'padding:10px 14px;background:' + (active ? '#DCFCE7' : '#FEE2E2') + ';border-radius:9px;border:1px solid ' + (active ? '#86EFAC' : '#FCA5A5') + ';font-size:13px;color:#0F172A;display:flex;align-items:center;gap:10px';
      entry.innerHTML = '<span style="font-size:16px">' + emoji + '</span><span><strong>' + label + '</strong> ' + action + '</span><span style="margin-left:auto;color:#94A3B8;font-size:11px;font-family:monospace">' + timeStr + '</span>';
      log.insertBefore(entry, log.firstChild);
    }
  }
  // Update card UI
  if (type === 'test') {
    var badge = document.getElementById('testStatusBadge');
    var btnU = document.getElementById('btnUnlockTest');
    var btnL = document.getElementById('btnLockTest');
    var card = document.getElementById('cardTestMode');
    if (badge) { badge.textContent = active ? '✅ Faol' : '🔒 Qulflangan'; badge.style.background = active ? '#DCFCE7' : '#FEF3C7'; badge.style.color = active ? '#16A34A' : '#D97706'; }
    if (btnU) btnU.style.display = active ? 'none' : '';
    if (btnL) btnL.style.display = active ? '' : 'none';
    if (card) card.style.borderColor = active ? '#86EFAC' : '#E2E8F0';
  } else {
    var badge2 = document.getElementById('realStatusBadge');
    var btnU2 = document.getElementById('btnUnlockReal');
    var btnL2 = document.getElementById('btnLockReal');
    var card2 = document.getElementById('cardRealMode');
    if (badge2) { badge2.textContent = active ? '🟢 Faol' : '🔒 Qulflangan'; badge2.style.background = active ? '#DCFCE7' : '#FEF3C7'; badge2.style.color = active ? '#16A34A' : '#D97706'; }
    if (btnU2) btnU2.style.display = active ? 'none' : '';
    if (btnL2) btnL2.style.display = active ? '' : 'none';
    if (card2) card2.style.borderColor = active ? '#FCA5A5' : '#E2E8F0';
  }
  if (!noToast) showToast(emoji, label, active ? 'Talabalar uchun faollashtirildi!' : 'Qulflandi. Talabalar kira olmaydi.', active ? 'green' : 'red');
}

function renderSesiyaTest() {
  var locked = document.getElementById('stest-locked');
  var instr = document.getElementById('stest-instructions');
  var active = document.getElementById('stest-active');
  var results = document.getElementById('stest-results');
  if (!locked) return;
  if (SESIYA_STATE.test) {
    locked.style.display = 'none';
    active.style.display = 'none';
    results.style.display = 'none';
    instr.style.display = 'block';
    document.getElementById('testPageSub').textContent = 'Fan tanlang va testni boshlang';
  } else {
    locked.style.display = 'flex';
    instr.style.display = 'none';
    active.style.display = 'none';
    results.style.display = 'none';
    if (_testTimer) { clearInterval(_testTimer); _testTimer = null; }
  }
}

function showTestInstructions() {
  var _nav=document.getElementById('hemis-nav'); if(_nav)_nav.style.display='';
  var _mc=document.getElementById('mainContent'); if(_mc){_mc.style.marginLeft='';_mc.style.width='';}
  document.body.classList.remove('exam-active');
  window.onbeforeunload=null;
  try{document.exitFullscreen();}catch(e){}
  if (_testTimer) { clearInterval(_testTimer); _testTimer = null; }
  _testAnswers = {};
  document.getElementById('stest-instructions').style.display = 'block';
  document.getElementById('stest-active').style.display = 'none';
  document.getElementById('stest-results').style.display = 'none';
  document.getElementById('testPageSub').textContent = 'Fan tanlang va testni boshlang';
}

function renderActiveTestQuestions() {
  var icons = {algo:'💻', ai:'🤖', math:'📐', db:'🗄️', web:'🌐'};
  var names = {algo:'Algoritmlar va Dasturlash', ai:"Sun'iy Intellekt", math:'Matematika (AI uchun)', db:"Ma'lumotlar Bazasi", web:'Web Dasturlash'};
  var subj = _currentTestSubject;
  var iconEl = document.getElementById('testSubjectIcon');
  var nameEl = document.getElementById('testSubjectName');
  var progEl = document.getElementById('testProgressLabel');
  var barEl  = document.getElementById('testProgressBar');
  if (iconEl) iconEl.textContent = icons[subj] || '📝';
  if (nameEl) nameEl.textContent = names[subj] || subj;
  if (progEl) progEl.textContent = '0/' + _currentTestQuestions.length;
  if (barEl)  barEl.style.width = '0%';
  var sub = document.getElementById('testPageSub');
  if (sub) sub.textContent = (names[subj] || subj) + ' · Mashq rejimi';
  // Render questions
  var container = document.getElementById('testQuestionsContainer');
  if (container) {
    var html = '';
    _currentTestQuestions.forEach(function(q, i) { html += _buildTestQHtml(q, i, 'test'); });
    container.innerHTML = html;
  }
  // Start timer
  if (_testTimer) clearInterval(_testTimer);
  _testSec = 30 * 60;
  var timerEl = document.getElementById('testTimerDisplay');
  if (timerEl) timerEl.textContent = '30:00';
  _testTimer = setInterval(function() {
    _testSec--;
    var m = Math.floor(_testSec / 60).toString().padStart(2, '0');
    var s = (_testSec % 60).toString().padStart(2, '0');
    var el = document.getElementById('testTimerDisplay');
    if (el) { el.textContent = m + ':' + s; el.style.color = _testSec < 300 ? '#DC2626' : '#1B4FD8'; }
    if (_testSec <= 0) { clearInterval(_testTimer); _testTimer = null; submitTestExam(); }
  }, 1000);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function startTestWithSubject(subj) {
  try {
    _currentTestSubject = subj;
    _currentTestQuestions = TEST_QUESTIONS_DB[subj] || [];

    if (!_currentTestQuestions.length) {
      alert('Bu fan uchun test savollari topilmadi');
      return;
    }

    _testAnswers = {};

    document.getElementById('stest-instructions').style.display = 'none';
    document.getElementById('stest-active').style.display = 'block';
    document.getElementById('stest-results').style.display = 'none';

    renderActiveTestQuestions();
  } catch (e) {
    console.error(e);
    alert('Testni boshlashda xatolik');
  }
}

function onTestAnswer(qi, optIdx) {
  _testAnswers[qi] = optIdx;
  var hidden = document.getElementById('tq' + qi + 'ans');
  if (hidden) hidden.value = optIdx;
  // Use _currentTestQuestions (works for both DB and dekanat questions)
  var qs = _currentTestQuestions[qi];
  if (qs && qs.opts) {
    qs.opts.forEach(function(_, j) {
      var lbl = document.getElementById('tq-' + qi + '-opt-' + j);
      if (lbl) {
        lbl.style.borderColor = j === optIdx ? '#1B4FD8' : '#E2E8F0';
        lbl.style.background  = j === optIdx ? '#EEF3FF' : 'white';
      }
    });
  }
  var card = document.getElementById('tq-' + qi);
  if (card) card.style.borderColor = '#86EFAC';
  var answered = Object.keys(_testAnswers).length;
  var total = _currentTestQuestions.length;
  var pct = Math.round(answered / total * 100);
  var pb = document.getElementById('testProgressBar');
  if (pb) pb.style.width = pct + '%';
  var pl = document.getElementById('testProgressLabel');
  if (pl) pl.textContent = answered + '/' + total;
  var ac = document.getElementById('testAnsweredCount');
  if (ac) ac.textContent = answered + ' ta savol javob berildi';
}

// submitTestExam — exams.js da bo'sh, bu yerda to'liq implementatsiya
function submitTestExam() {
  if (_testTimer) { clearInterval(_testTimer); _testTimer = null; }
  var qs = _currentTestQuestions;
  var total = qs.length;
  var correct = 0;
  qs.forEach(function(q, i) {
    var ans = _testAnswers[i];
    var rightIdx = (typeof q.ans !== 'undefined') ? q.ans : q.correct;
    if (ans !== undefined && ans === rightIdx) correct++;
  });
  var pct = total ? Math.round(correct / total * 100) : 0;
  var grade = pct >= 86 ? 5 : pct >= 71 ? 4 : pct >= 56 ? 3 : 2;
  var gradeColor = grade === 5 ? '#16A34A' : grade === 4 ? '#2563EB' : grade === 3 ? '#D97706' : '#DC2626';
  var gradeEmoji = grade === 5 ? '🏆' : grade === 4 ? '✅' : grade === 3 ? '📊' : '❌';

  // Build results HTML
  var html = '<div style="text-align:center;padding:24px 0 16px">';
  html += '<div style="font-size:52px;margin-bottom:8px">' + gradeEmoji + '</div>';
  html += '<div style="font-size:28px;font-weight:900;color:' + gradeColor + '">' + pct + '%</div>';
  html += '<div style="font-size:15px;color:#64748B;margin-top:4px">' + correct + ' / ' + total + ' ta to\'g\'ri javob</div>';
  html += '<div style="display:inline-block;margin-top:10px;padding:6px 20px;background:' + gradeColor + '20;border:2px solid ' + gradeColor + ';border-radius:10px;font-size:18px;font-weight:800;color:' + gradeColor + '">' + grade + '-baho</div>';
  html += '</div>';
  // Answer review
  html += '<div style="margin-top:16px">';
  qs.forEach(function(q, i) {
    var userAns = _testAnswers[i];
    var rightIdx = (typeof q.ans !== 'undefined') ? q.ans : q.correct;
    var isRight = userAns !== undefined && userAns === rightIdx;
    var bg = isRight ? '#F0FDF4' : '#FFF5F5';
    var border = isRight ? '#86EFAC' : '#FCA5A5';
    var icon = isRight ? '✅' : '❌';
    html += '<div style="background:' + bg + ';border:1.5px solid ' + border + ';border-radius:10px;padding:12px 16px;margin-bottom:10px">';
    html += '<div style="font-size:13px;font-weight:700;color:#0F172A;margin-bottom:6px">' + icon + ' ' + (i+1) + '. ' + q.q + '</div>';
    if (!isRight && userAns !== undefined) {
      html += '<div style="font-size:12px;color:#DC2626">Sizning javobingiz: ' + (q.opts[userAns] || '—') + '</div>';
    }
    if (userAns === undefined) {
      html += '<div style="font-size:12px;color:#94A3B8">Javob berilmadi</div>';
    }
    html += '<div style="font-size:12px;color:#16A34A;font-weight:600">To\'g\'ri javob: ' + (q.opts[rightIdx] || '—') + '</div>';
    if (q.izoh) html += '<div style="font-size:11.5px;color:#64748B;margin-top:4px;font-style:italic">' + q.izoh + '</div>';
    html += '</div>';
  });
  html += '</div>';

  var rc = document.getElementById('testResultsContent');
  if (rc) rc.innerHTML = html;
  document.getElementById('stest-active').style.display = 'none';
  document.getElementById('stest-results').style.display = 'block';
  window.scrollTo({ top: 0, behavior: 'smooth' });
  showToast(gradeEmoji, 'Test yakunlandi', correct + '/' + total + ' to\'g\'ri · ' + pct + '%');
}

function toggleEtirozBox(qi) {
  var box = document.getElementById('etirozBox' + qi);
  if (box) box.style.display = box.style.display === 'none' ? 'block' : 'none';
}

function submitEtiraz(qi) {
  // Support both new (etirozText_N) and old (etirozTextN) HTML structures
  var textEl = document.getElementById('etirozText_' + qi) || document.getElementById('etirozText' + qi);
  var text = textEl ? textEl.value.trim() : '';
  if (!text) { showToast('⚠️', 'Xato', "Iltimos, e'tiroz sababini yozing"); return; }

  var examSt = (typeof _examState !== 'undefined') ? _examState : null;
  var q = examSt ? examSt.questions[qi] : (_currentTestQuestions ? _currentTestQuestions[qi] : null);
  var user = currentUser || { name: "Noma'lum talaba", group: '' };
  var now = new Date();
  var dateStr = now.getDate() + '.' + (now.getMonth()+1) + '.' + now.getFullYear();
  var subjectName = examSt ? (examSt.subjectName || '') : ((document.getElementById('testSubjectName')||{}).textContent || '');
  var qText = q ? q.q : '';
  var detail = (qi+1) + "-savol: " + text;

  // Push to local APPLICATIONS for immediate dekanat panel update
  APPLICATIONS.push({
    id: Date.now(),
    studentName: user.name,
    fullName: user.name,
    group: user.group || '',
    type: 'etiraz',
    detail: detail,
    company: subjectName,
    price: '—',
    date: dateStr,
    status: 'pending',
    note: qText ? ('Savol: ' + qText.substring(0, 200)) : '',
    phone: '',
    email: ''
  });
  updateAppBadges();
  saveApplications();

  // Send to backend API (persists across deployments)
  if (typeof api !== 'undefined') {
    api('POST', '/applications', {
      type: 'etiraz',
      detail: detail,
      note: qText ? ('Savol matni: ' + qText) : '',
      questionIndex: qi,
      examType: (examSt && examSt.isRealSesiya) ? 'sesiya' : 'test',
      subject: (typeof _currentTestSubject !== 'undefined' && _currentTestSubject) ? _currentTestSubject : ''
    }).catch(function(){});
  }

  // Clear textarea after send
  if (textEl) textEl.value = '';
  // Hide old-style etirazBox if present
  var oldBox = document.getElementById('etirozBox' + qi);
  if (oldBox) oldBox.style.display = 'none';

  showToast('✅', "E'tiroz yuborildi!", "Dekanat ko'rib chiqadi");
}

function renderSesiyaReal() {
  var locked = document.getElementById('sreal-locked');
  var instr = document.getElementById('sreal-instructions');
  var active = document.getElementById('sreal-active');
  var results = document.getElementById('sreal-results');
  if (!locked) return;
  if (SESIYA_STATE.real) {
    locked.style.display = 'none';
    active.style.display = 'none';
    results.style.display = 'none';
    instr.style.display = 'block';
    document.getElementById('realPageSub').textContent = 'Fanni tanlang va imtihonni boshlang';
  } else {
    locked.style.display = 'flex';
    instr.style.display = 'none';
    active.style.display = 'none';
    results.style.display = 'none';
    if (_realTimer) { clearInterval(_realTimer); _realTimer = null; }
  }
}

function startRealWithSubject(subj) {
  try {
    _currentRealSubject = subj;

    var baseQs = TEST_QUESTIONS_DB[subj] || TEST_QUESTIONS_DB.algo || [];
    _currentRealQuestions = [];

    for (var i = 0; i < 30; i++) {
      _currentRealQuestions.push(baseQs[i % baseQs.length]);
    }

    _realAnswers = {};

    var icons = {algo:'💻', ai:'🤖', math:'📐', db:'🗄️', web:'🌐'};
    var names = {
      algo:'Algoritmlar va Dasturlash',
      ai:"Sun'iy Intellekt",
      math:'Matematika (AI uchun)',
      db:"Ma'lumotlar Bazasi",
      web:'Web Dasturlash'
    };

    document.getElementById('realSubjectIcon').textContent = icons[subj] || '📝';
    document.getElementById('realSubjectName').textContent = names[subj] || subj;
    document.getElementById('realProgressLabel').textContent = '0/30';
    document.getElementById('realProgressBar').style.width = '0%';
    document.getElementById('realPageSub').textContent = (names[subj] || subj) + ' · Rasmiy imtihon';

    var container = document.getElementById('realQuestionsContainer');
    var html = '';

    _currentRealQuestions.forEach(function(q, i) {
      html += _buildTestQHtml(q, i, 'real');
    });

    container.innerHTML = html;

    document.getElementById('sreal-instructions').style.display = 'none';
    document.getElementById('sreal-active').style.display = 'block';
    document.getElementById('sreal-results').style.display = 'none';

    if (_realTimer) clearInterval(_realTimer);

    _realSec = 90 * 60;
    document.getElementById('realTimerDisplay').textContent = '90:00';

    _realTimer = setInterval(function() {
      _realSec--;

      var m = Math.floor(_realSec / 60).toString().padStart(2, '0');
      var s = (_realSec % 60).toString().padStart(2, '0');
      var el = document.getElementById('realTimerDisplay');

      if (el) {
        el.textContent = m + ':' + s;
        el.style.color = _realSec < 600 ? '#B91C1C' : '#DC2626';
      }

      if (_realSec <= 0) {
        clearInterval(_realTimer);
        _realTimer = null;
        submitRealExam();
      }
    }, 1000);

    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (e) {
    console.error(e);
    alert('Imtihonni boshlashda xatolik');
  }
}
function onRealAnswer(qi, optIdx) {
  _realAnswers[qi] = optIdx;
  var hidden = document.getElementById('rq' + qi + 'ans');
  if (hidden) hidden.value = optIdx;
  var qs = _currentRealQuestions[qi];
  qs.opts.forEach(function(_, j) {
    var lbl = document.getElementById('rq-' + qi + '-opt-' + j);
    if (lbl) {
      lbl.style.borderColor = j === optIdx ? '#DC2626' : '#E2E8F0';
      lbl.style.background = j === optIdx ? '#FFF5F5' : 'white';
    }
  });
  var card = document.getElementById('rq-' + qi);
  if (card) card.style.borderColor = '#86EFAC';
  var answered = Object.keys(_realAnswers).length;
  var total = _currentRealQuestions.length;
  var pct = Math.round(answered / total * 100);
  var pb = document.getElementById('realProgressBar');
  if (pb) pb.style.width = pct + '%';
  var pl = document.getElementById('realProgressLabel');
  if (pl) pl.textContent = answered + '/' + total;
  var ac = document.getElementById('realAnsweredCount');
  if (ac) ac.textContent = answered + ' ta savol javob berildi';
}

function toggleRealEtirozBox(qi) {
  var box = document.getElementById('realEtirozBox' + qi);
  if (box) box.style.display = box.style.display === 'none' ? 'block' : 'none';
}

function submitRealEtiraz(qi) {
  var textEl = document.getElementById('realEtirozText' + qi);
  var text = textEl ? textEl.value.trim() : '';
  if (!text) { showToast('⚠️', 'Xato', "Iltimos, e'tiroz sababini yozing"); return; }
  var q = _currentRealQuestions[qi];
  var user = currentUser || {name:'Noma\'lum talaba', group:'Guruh'};
  var now = new Date();
  var dateStr = now.getDate() + '.' + (now.getMonth()+1) + '.' + now.getFullYear();
  var subjectName = (document.getElementById('realSubjectName')||{textContent:''}).textContent;
  var detail = "E'tiroz (Sesiya): " + (qi+1) + "-savol — «" + q.q.substring(0,60) + (q.q.length>60?'...':'') + "»";

  APPLICATIONS.push({
    id: APPLICATIONS.length + 1,
    studentName: user.name,
    fullName: user.name,
    group: user.group || 'A-101',
    type: 'etiraz',
    detail: detail,
    company: "Sesiya: " + subjectName,
    price: '—',
    date: dateStr,
    status: 'pending',
    note: text,
    phone: '',
    email: ''
  });
  updateAppBadges();
  saveApplications(); // localStorage persistence

  // Also send to backend API
  apiSubmitApplication({
    type: 'etiraz',
    detail: detail,
    company: 'Sesiya: ' + subjectName,
    note: text,
    questionIndex: qi,
    examType: 'sesiya',
    subject: _currentRealSubject || ''
  }).catch(function(){});

  document.getElementById('realEtirozBox' + qi).style.display = 'none';
  showToast('✅', "E'tiroz yuborildi!", "Dekanat ko'rib chiqadi", 'green');
}

function renderDekanatSesiya() {
  // Re-sync UI with current state (silent — no toast on page open)
  setSesiyaState('test', SESIYA_STATE.test, true);
  setSesiyaState('real', SESIYA_STATE.real, true);
  loadSesiyaEtirazlar();
}

async function loadSesiyaEtirazlar() {
  var el = document.getElementById('sesiyaEtirazList');
  if (!el) return;

  el.innerHTML = '<div style="padding:16px;text-align:center;font-size:13px;color:#94A3B8">Yuklanmoqda...</div>';

  var items = [];
  try {
    var apps = await api('GET', '/applications');
    if (Array.isArray(apps)) {
      items = apps.filter(function(a) { return a.type === 'etiraz'; });
    }
  } catch(e) {
    el.innerHTML = '<div style="padding:16px;text-align:center;font-size:13px;color:#EF4444">Serverga ulanishda xato</div>';
    return;
  }

  if (!items.length) {
    el.innerHTML = '<div style="padding:20px;text-align:center;font-size:13px;color:#94A3B8">Hozircha e\'tiroz yo\'q</div>';
    return;
  }

  var statusColor = { pending:'#FEF3C7', approved:'#DCFCE7', rejected:'#FEE2E2' };
  var statusLabel = { pending:'⏳ Kutilmoqda', approved:'✅ Ko\'rib chiqildi', rejected:'❌ Rad' };

  el.innerHTML = items.map(function(a) {
    var sc = statusColor[a.status] || '#F8FAFC';
    var sl = statusLabel[a.status] || a.status;
    var date = a.created_at ? new Date(a.created_at).toLocaleString('uz-UZ', {day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}) : '';
    return '<div style="background:#FFF7ED;border:1.5px solid #FED7AA;border-radius:12px;padding:14px 16px;display:flex;flex-direction:column;gap:6px">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px">' +
        '<div style="font-size:13px;font-weight:700;color:#92400E">⚠️ ' + (a.student_name || 'Talaba') + '</div>' +
        '<div style="display:flex;align-items:center;gap:8px">' +
          '<span style="font-size:11px;color:#64748B">' + date + '</span>' +
          '<span style="padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;background:' + sc + '">' + sl + '</span>' +
        '</div>' +
      '</div>' +
      '<div style="font-size:13px;color:#1E293B;font-weight:600">' + (a.detail || '') + '</div>' +
      (a.note ? '<div style="font-size:12px;color:#64748B;background:#fff;border-radius:8px;padding:8px 10px;border:1px solid #FED7AA">' + a.note + '</div>' : '') +
      (a.company ? '<div style="font-size:11px;color:#EA580C">📚 ' + a.company + '</div>' : '') +
      '<div style="display:flex;gap:8px;margin-top:4px;flex-wrap:wrap">' +
        (a.status === 'pending' ?
          '<button onclick="updateEtirazStatus(' + a.id + ',\'approved\')" style="padding:5px 14px;background:#16A34A;color:#fff;border:none;border-radius:7px;font-size:12px;font-weight:700;cursor:pointer">✅ Ko\'rib chiqildi</button>' +
          '<button onclick="updateEtirazStatus(' + a.id + ',\'rejected\')" style="padding:5px 14px;background:#DC2626;color:#fff;border:none;border-radius:7px;font-size:12px;font-weight:700;cursor:pointer">❌ Rad</button>'
        : '') +
        '<button onclick="deleteEtiraz(' + a.id + ')" style="padding:5px 12px;background:#F1F5F9;border:none;border-radius:7px;font-size:12px;font-weight:700;color:#64748B;cursor:pointer;margin-left:auto">🗑 O\'chirish</button>' +
      '</div>' +
    '</div>';
  }).join('');
}

async function updateEtirazStatus(id, status) {
  try {
    await api('PATCH', '/applications/' + id + '/status', { status: status });
    showToast('✅', 'Yangilandi', status === 'approved' ? "E'tiroz ko'rib chiqildi" : "E'tiroz rad etildi");
    loadSesiyaEtirazlar();
  } catch(e) {
    showToast('❌', 'Xato', 'Serverga ulanishda muammo');
  }
}

async function deleteEtiraz(id) {
  if (!confirm("Bu e'tirozni o'chirmoqchimisiz?")) return;
  try {
    await api('DELETE', '/applications/' + id);
    showToast('🗑', 'O\'chirildi', "E'tiroz o'chirildi");
    loadSesiyaEtirazlar();
  } catch(e) {
    showToast('❌', 'Xato', 'O\'chirishda muammo');
  }
}

// ═══════════════════════════════════════════════
// LOCALSTORAGE PERSISTENCE — APPLICATIONS
// ═══════════════════════════════════════════════
function saveApplications() {
  try { localStorage.setItem('idu_applications', JSON.stringify(APPLICATIONS)); } catch(e) {}
}
function loadApplications() {
  try {
    var s = localStorage.getItem('idu_applications');
    if (s) { var arr = JSON.parse(s); if (Array.isArray(arr)) APPLICATIONS = arr; }
  } catch(e) {}
}

// Override APPLICATIONS.push to auto-save
var _origAppPush = Array.prototype.push;
(function() {
  var _savedApps = APPLICATIONS;
  Object.defineProperty(window, 'APPLICATIONS', {
    get: function() { return _savedApps; },
    set: function(v) { _savedApps = v; },
    configurable: true
  });
})();

// Patch updateAppStatus and submitEtiraz to auto-save
var _origUpdateAppStatus = updateAppStatus;
updateAppStatus = function(id, status) {
  _origUpdateAppStatus(id, status);
  saveApplications();
};

// Load on startup
loadApplications();

// ═══════════════════════════════════════════════
// DEKANAT QUESTIONS — LOCALSTORAGE
// ═══════════════════════════════════════════════
var DEKANAT_QUESTIONS = [];
// _editingQId, _currentQFilter — dekanat.js da let bilan e'lon qilingan, takrorlanmaydi
loadDekanatQuestions();

// Override question sources: use dekanat questions when available
// Both test rejim and sesiya now use openRealExam for fullscreen + full security
var _examSubjectNames = {algo:'Algoritmlar va Dasturlash', ai:"Sun'iy Intellekt", math:'Matematika (AI uchun)', db:"Ma'lumotlar Bazasi", web:'Web Dasturlash'};

startTestWithSubject = function(subj) {
  var dekQs = DEKANAT_QUESTIONS.filter(function(q) { return q.subject === subj && (q.type === 'test' || q.type === 'both'); });
  var qs = dekQs.length >= 10
    ? dekQs.slice(0, 20)
    : (TEST_QUESTIONS_DB[subj] || []).slice(0, 20);

  if (!qs.length) { alert('Bu fan uchun test savollari topilmadi'); return; }

  _currentTestSubject = subj;
  _currentTestQuestions = qs;
  _testAnswers = {};

  openRealExam({
    id: 'test_' + subj + '_' + Date.now(),
    questions: qs,
    duration: 30 * 60,
    maxWarnings: 2,
    maxSuspicion: 200,
    isTestMode: true,
    subjectName: _examSubjectNames[subj] || subj,
  });
};

startRealWithSubject = async function(subj) {
  var dekQs = DEKANAT_QUESTIONS.filter(function(q) { return q.subject === subj && (q.type === 'real' || q.type === 'both'); });
  var baseQs = TEST_QUESTIONS_DB[subj] || TEST_QUESTIONS_DB.algo || [];

  // API orqali boshlashga urinish (dekanat sesiyani ochgan bo'lsa)
  if (typeof api !== 'undefined') {
    try {
      var started = await api('POST', '/exams/start', { examType: 'sesiya', subject: subj });
      if (started && started.attemptId) {
        var apiQs = (started.questions || []).map(function(q) {
          return { id: q.id, q: q.text || q.question_text, opts: q.options || [] };
        });
        _currentRealSubject = subj;
        _currentRealQuestions = apiQs;
        openRealExam({
          id: started.attemptId,
          questions: apiQs,
          duration: (started.durationMin || 90) * 60,
          maxWarnings: 2,
          maxSuspicion: 80,
          isTestMode: false,
          isRealSesiya: true,
          subjectName: _examSubjectNames[subj] || subj,
        });
        return;
      }
    } catch(e) { /* fallback to local */ }
  }

  // Mahalliy savollar bilan (sesiya ochilmagan yoki API yo'q)
  var qs;
  if (dekQs.length >= 20) {
    qs = dekQs.slice(0, 30);
  } else {
    qs = [];
    for (var i = 0; i < 30; i++) qs.push(baseQs[i % baseQs.length]);
  }

  _currentRealSubject = subj;
  _currentRealQuestions = qs;
  _realAnswers = {};

  openRealExam({
    id: 'local_real_' + subj + '_' + Date.now(),
    questions: qs,
    duration: 90 * 60,
    maxWarnings: 2,
    maxSuspicion: 80,
    isTestMode: true,
    isRealSesiya: true,
    subjectName: (_examSubjectNames[subj] || subj) + ' — Mashq sesiyasi',
  });
};

function _buildTestQHtml(q, i, mode) {
  var isReal = mode === 'real';
  var acColor = isReal ? '#DC2626' : '#1B4FD8';
  var hoverColor = isReal ? '#DC2626' : '#1B4FD8';
  var hoverBg = isReal ? '#FFF5F5' : '#F8FBFF';
  var prefix = isReal ? 'r' : 't';
  var eBox = isReal ? 'realEtirozBox' : 'etirozBox';
  var eText = isReal ? 'realEtirozText' : 'etirozText';
  var ansHandler = isReal ? 'onRealAnswer' : 'onTestAnswer';
  var eToggle = isReal ? 'toggleRealEtirozBox' : 'toggleEtirozBox';
  var eSubmit = isReal ? 'submitRealEtiraz' : 'submitEtiraz';
  var html = '<div id="' + prefix + 'q-' + i + '" style="background:white;border:1.5px solid #E2E8F0;border-radius:12px;padding:18px 20px;margin-bottom:14px;transition:border-color 0.2s">';
  html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:14px">';
  html += '<div style="font-size:13.5px;font-weight:700;color:#0F172A;line-height:1.5"><span style="color:#94A3B8;margin-right:6px">' + (i+1) + '.</span>' + q.q + '</div>';
  html += '<button onclick="' + eToggle + '(' + i + ')" style="white-space:nowrap;padding:4px 10px;background:#FFF7ED;border:1px solid #FED7AA;border-radius:6px;font-size:11px;font-weight:600;color:#EA580C;cursor:pointer;font-family:\'Outfit\',sans-serif">⚠️ E\'tiroz</button>';
  html += '</div>';
  html += '<div style="display:flex;flex-direction:column;gap:8px">';
  q.opts.forEach(function(opt, j) {
    html += '<label id="' + prefix + 'q-' + i + '-opt-' + j + '" style="display:flex;align-items:center;gap:10px;padding:10px 14px;border:1.5px solid #E2E8F0;border-radius:8px;cursor:pointer;font-size:13px;transition:all 0.15s">';
    html += '<input type="radio" name="' + prefix + 'q' + i + '" value="' + j + '" style="accent-color:' + acColor + ';width:16px;height:16px" onchange="' + ansHandler + '(' + i + ',' + j + ')"> ' + opt;
    html += '</label>';
  });
  html += '</div>';
  html += '<input type="hidden" id="' + prefix + 'q' + i + 'ans" value="">';
  html += '<div id="' + eBox + i + '" style="display:none;margin-top:12px;background:#FFF7ED;border:1.5px solid #FED7AA;border-radius:10px;padding:14px">';
  html += '<div style="font-size:12px;font-weight:700;color:#92400E;margin-bottom:8px">⚠️ ' + (i+1) + '-savol bo\'yicha e\'tiroz:</div>';
  html += '<textarea id="' + eText + i + '" placeholder="E\'tirozingiz sababini yozing..." style="width:100%;padding:10px;border:1.5px solid #FED7AA;border-radius:8px;font-family:\'Outfit\',sans-serif;font-size:13px;resize:vertical;min-height:70px;outline:none;box-sizing:border-box"></textarea>';
  html += '<div style="display:flex;gap:8px;margin-top:8px">';
  html += '<button onclick="' + eSubmit + '(' + i + ')" style="padding:7px 16px;background:#EA580C;color:white;border:none;border-radius:7px;font-family:\'Outfit\',sans-serif;font-size:12.5px;font-weight:700;cursor:pointer">📤 Dekanatga yuborish</button>';
  html += '<button onclick="document.getElementById(\'' + eBox + i + '\').style.display=\'none\'" style="padding:7px 14px;background:white;border:1.5px solid #E2E8F0;border-radius:7px;font-family:\'Outfit\',sans-serif;font-size:12.5px;cursor:pointer">Bekor</button>';
  html += '</div></div></div>';
  return html;
}

// ═══════════════════════════════════════════════
// DEKANAT QUESTIONS — UI FUNCTIONS
// ═══════════════════════════════════════════════
var SUBJ_LABELS = {algo:'💻 Algo', ai:'🤖 AI', math:'📐 Math', db:'🗄️ DB', web:'🌐 Web'};
var TYPE_LABELS = {test:'🧪 Test', real:'📋 Sesiya', both:'📝 Ikkalasi'};

function _updateQStats() {
  var total = DEKANAT_QUESTIONS.length;
  var testQ = DEKANAT_QUESTIONS.filter(function(q) { return q.type === 'test' || q.type === 'both'; }).length;
  var realQ = DEKANAT_QUESTIONS.filter(function(q) { return q.type === 'real' || q.type === 'both'; }).length;
  var subjs = [...new Set(DEKANAT_QUESTIONS.map(function(q) { return q.subject; }))].length;
  var e1 = document.getElementById('qStatTotal'); if(e1) e1.textContent = total;
  var e2 = document.getElementById('qStatTest'); if(e2) e2.textContent = testQ;
  var e3 = document.getElementById('qStatReal'); if(e3) e3.textContent = realQ;
  var e4 = document.getElementById('qStatSubjects'); if(e4) e4.textContent = subjs;
}

function filterQs(filter, el) {
  _currentQFilter = filter;
  document.querySelectorAll('#page-dekanat-questions .filter-chip').forEach(function(c) { c.classList.remove('active'); });
  if (el) el.classList.add('active');
  _renderQTable(filter);
}

function _renderQTable(filter) {
  var qs = [...DEKANAT_QUESTIONS];
  if (filter === 'test') qs = qs.filter(function(q) { return q.type === 'test' || q.type === 'both'; });
  else if (filter === 'real') qs = qs.filter(function(q) { return q.type === 'real' || q.type === 'both'; });
  else if (['algo','ai','math','db','web'].includes(filter)) qs = qs.filter(function(q) { return q.subject === filter; });
  var tbody = document.getElementById('questionsTableBody');
  if (!tbody) return;
  if (!qs.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text3);padding:40px"><div style="font-size:28px;margin-bottom:8px">📝</div><div>Hali savol kiritilmagan</div></td></tr>';
    return;
  }
  tbody.innerHTML = qs.map(function(q, i) {
    return '<tr>' +
      '<td><strong>' + (i+1) + '</strong></td>' +
      '<td><span style="padding:3px 8px;background:#EEF3FF;border-radius:6px;font-size:11.5px;font-weight:700;color:#1B4FD8">' + (SUBJ_LABELS[q.subject] || q.subject) + '</span></td>' +
      '<td><span style="padding:3px 8px;border-radius:6px;font-size:11.5px;font-weight:700;background:' + (q.type==='test'?'#DCFCE7':q.type==='real'?'#FEE2E2':'#F3E8FF') + ';color:' + (q.type==='test'?'#16A34A':q.type==='real'?'#DC2626':'#7C3AED') + '">' + (TYPE_LABELS[q.type] || q.type) + '</span></td>' +
      '<td style="max-width:300px"><div style="font-weight:600;font-size:13px;line-height:1.4">' + q.q.substring(0,80) + (q.q.length>80?'...':'') + '</div>' +
        '<div style="font-size:11px;color:#64748B;margin-top:3px">✅ ' + (q.opts[q.ans]||'').substring(0,50) + '</div></td>' +
      '<td style="font-size:12px;color:#16A34A;font-weight:600">' + ['A','B','C','D'][q.ans] + ' – ' + (q.opts[q.ans]||'').substring(0,20) + '</td>' +
      '<td><div style="display:flex;gap:5px">' +
        '<button onclick="editQuestion(' + q.id + ')" style="padding:5px 10px;background:#EEF3FF;border:none;border-radius:6px;color:#1B4FD8;font-size:12px;cursor:pointer;font-weight:600">✏️</button>' +
        '<button onclick="deleteQuestion(' + q.id + ')" style="padding:5px 10px;background:#FEE2E2;border:none;border-radius:6px;color:#DC2626;font-size:12px;cursor:pointer;font-weight:600">🗑️</button>' +
      '</div></td>' +
    '</tr>';
  }).join('');
}

// Auto-save APPLICATIONS after push (monkey-patch submitEtiraz)
var _origSubmitEtiraz = submitEtiraz;
submitEtiraz = function(qi) {
  _origSubmitEtiraz(qi);
  saveApplications();
};
var _origSubmitRealEtiraz = submitRealEtiraz;
submitRealEtiraz = function(qi) {
  _origSubmitRealEtiraz(qi);
  saveApplications();
};

// Patch applyFromDetail and orderCert to also save
setTimeout(function() {
  var origApply = window.applyFromDetail;
  if (origApply) window.applyFromDetail = function() { origApply.apply(this, arguments); saveApplications(); };
  var origJobDirect = window.applyJobDirect;
  if (origJobDirect) window.applyJobDirect = function() { origJobDirect.apply(this, arguments); saveApplications(); };
}, 500);
