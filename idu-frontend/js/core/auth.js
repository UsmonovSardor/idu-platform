'use strict';
// IDU - core/auth.js
// Login, logout, OTP
function simpleHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) { h = ((h << 5) - h) + str.charCodeAt(i); h |= 0; }
  return Math.abs(h).toString(36);
}

function _lsGet(k) { try { return localStorage.getItem(k); } catch(e) { return _mem[k]||null; } }

function _lsSet(k,v) { try { localStorage.setItem(k,v); } catch(e) { _mem[k]=v; } }

function _lsDel(k) { try { localStorage.removeItem(k); } catch(e) { delete _mem[k]; } }

function _ssGet(k) { try { return sessionStorage.getItem(k); } catch(e) { return _smem[k]||null; } }

function _ssSet(k,v) { try { sessionStorage.setItem(k,v); } catch(e) { _smem[k]=v; } }

function _ssDel(k) { try { sessionStorage.removeItem(k); } catch(e) { delete _smem[k]; } }

function checkLockout(key) {
  try {
    const data = JSON.parse(_lsGet('idu_lockout_' + key) || '{}');
    if (data.lockedUntil && Date.now() < data.lockedUntil) {
      const left = Math.ceil((data.lockedUntil - Date.now()) / 1000);
      return `Tizim ${left} soniyaga bloklangan. Iltimos kuting.`;
    }
  } catch(e) {}
  return null;
}

function clearAttempts(key) { try { _lsDel('idu_lockout_' + key); } catch(e) {} }

function getEffectivePass(role, login) {
  try {
    const overrides = JSON.parse(_lsGet('idu_pass_overrides') || '{}');
    return overrides[role + ':' + login] || null;
  } catch(e){ return null; }
}

function setPassOverride(role, login, newPass) {
  try {
    const overrides = JSON.parse(_lsGet('idu_pass_overrides') || '{}');
    overrides[role + ':' + login] = newPass;
    _lsSet('idu_pass_overrides', JSON.stringify(overrides));
  } catch(e){}
}

function startResendTimer() {
  clearInterval(_resendInterval);
  let sec = 60;
  document.getElementById('resendLink').style.display = 'none';
  document.getElementById('resendTimer').style.display = 'inline';
  document.getElementById('resendCount').textContent = sec;
  _resendInterval = setInterval(() => {
    sec--;
    document.getElementById('resendCount').textContent = sec;
    if (sec <= 0) {
      clearInterval(_resendInterval);
      document.getElementById('resendLink').style.display = 'inline';
      document.getElementById('resendTimer').style.display = 'none';
    }
  }, 1000);
}

function getPhoneFromInput(role) {
  const ids = { student: 'sPhone', teacher: 'tPhone', dekanat: 'dPhone' };
  const el = document.getElementById(ids[role]);
  return el ? el.value.trim().replace(/\D/g,'') : '';
}

function togglePassEye() {
  const pEl = document.getElementById('mainPass');
  const btn = document.getElementById('eyeBtn');
  if (!pEl) return;
  if (pEl.type === 'password') {
    pEl.type = 'text';
    if (btn) btn.innerHTML = '&#x1F648;';
  } else {
    pEl.type = 'password';
    if (btn) btn.innerHTML = '&#x1F441;';
  }
}

function checkPhoneAndLaunch(role, user) {
  launchApp(role, user);
}

function savePhoneSetup() {
  const val = document.getElementById('setupPhone').value.trim();
  if (val.length < 9) { document.getElementById('setupPhoneError').style.display='block'; return; }
  document.getElementById('setupPhoneError').style.display='none';
  _lsSet('idu_phone_' + _pendingLaunchRole + ':' + _pendingLaunchUser.login, '998' + val);
  _pendingLaunchUser.phone = '998' + val;
  document.getElementById('phoneSetupModal').style.display='none';
  launchApp(_pendingLaunchRole, _pendingLaunchUser);
}

function skipPhoneSetup() {
  document.getElementById('phoneSetupModal').style.display='none';
  launchApp(_pendingLaunchRole, _pendingLaunchUser);
}

function saveSession(role, user) {
  _lsSet('idu_session', JSON.stringify({role, login:user.login, ts:Date.now()}));
}

function loadSavedSession() {
  try {
    const s = JSON.parse(_lsGet('idu_session') || 'null');
    if (!s) return;
    if (Date.now() - s.ts > 7 * 24 * 3600 * 1000) { _lsDel('idu_session'); return; }
    const u = USERS[s.role] && USERS[s.role].find(x => x.login === s.login);
    if (u) {
      const storedPhone = _lsGet('idu_phone_' + s.role + ':' + s.login);
      if (storedPhone && !u.phone) u.phone = storedPhone;
      launchApp(s.role, u);
    }
  } catch(e){}
}

function launchApp(role, user) {
  // XAVFSIZLIK: Faqat to'g'ri rol tokenini saqlash
  _ssSet('idu_active_role', ROLE_TOKENS[role]);
  _ssSet('idu_active_login', user.login);

  currentRole = role; currentUser = user;
  document.getElementById('authScreen').style.display='none';
  const app=document.getElementById('appScreen');
  app.style.display='flex'; app.classList.add('visible');
  closeLoginModalForce();
  setupNav(role);
  setupSidebar(role);
  setupChip(role,user);
  const defPage = {student:'dashboard',teacher:'teacher-dashboard',dekanat:'dekanat-dashboard',investor:'investor-dashboard'}[role];
  showPage(defPage);
  initDates();
  const btn=document.getElementById('addIdeaBtn');
  if(btn) btn.style.display = (role==='student'||role==='dekanat') ? '' : 'none';
}

function doAutoLogin() {
  const l = document.getElementById('mainLogin').value.trim();
  const p = document.getElementById('mainPass').value.trim();
  const errEl = document.getElementById('mainLoginError');
  const errMsg = document.getElementById('mainLoginErrorMsg');
  if (!l) { errMsg.textContent = 'Login kiriting'; errEl.classList.add('show'); document.getElementById('mainLogin').focus(); return; }
  if (!p) { errMsg.textContent = 'Parol kiriting'; errEl.classList.add('show'); document.getElementById('mainPass').focus(); return; }

  const btn = document.getElementById('loginSubmitBtn');
  if (btn) { btn.innerHTML = '<span>Kirish...</span>'; btn.disabled = true; }

  apiLogin('auto', l, p, false).then(function(res) {
    if (res.ok) {
      if (btn) { btn.innerHTML = '<span>Kirish</span><span style="font-size:16px">&rarr;</span>'; btn.disabled = false; }
      errEl.classList.remove('show');
      // Map API role → local user object
      const role = res.user.role;
      const u = { login: l, name: res.user.name, role: role,
                  group: 'CS-2301', gpa: 0, phone: res.user.phone || '' };
      launchApp(role, u);
       } else {
      if (btn) {
        btn.innerHTML = '<span>Kirish</span><span style="font-size:16px">&rarr;</span>';
        btn.disabled = false;
      }

      errMsg.textContent = res.error || "Login yoki parol noto'g'ri";
      errEl.classList.add('show');
      document.getElementById('mainLogin').select();
    }
  }).catch(function() {
    if (btn) {
      btn.innerHTML = '<span>Kirish</span><span style="font-size:16px">&rarr;</span>';
      btn.disabled = false;
    }

    errMsg.textContent = "Server bilan aloqa yo'q";
    errEl.classList.add('show');
  });
}

async function verifyLoginOTP() {
  const entered = document.getElementById('otpInput').value.trim();
  if (!entered || entered.length !== 6) {
    document.getElementById('otpError').classList.add('show');
    return;
  }
  const btn = document.querySelector('#step-otp .btn-auth');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Tekshirilmoqda...'; }

  try {
    const fullPhone = '998' + _otpPhone;
    const res = await fetch(BACKEND_URL + '/api/verify-otp', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ phone: fullPhone, code: entered, purpose: 'login' })
    });
    const data = await res.json();
    if (!res.ok) {
      document.getElementById('otpError').classList.add('show');
      document.getElementById('otpInput').value = '';
      document.getElementById('otpInput').focus();
      if (btn) { btn.disabled = false; btn.textContent = '✅ Tasdiqlash va kirish'; }
      return;
    }
    // Muvaffaqiyat
    document.getElementById('otpError').classList.remove('show');
    clearInterval(_resendInterval);
    if (_otpRemember) saveSession(_otpRole, _otpUser);
    launchApp(_otpRole, _otpUser);
  } catch(e) {
    // Backend yo'q — lokal demo tekshirish
    if (entered !== _otpCode) {
      document.getElementById('otpError').classList.add('show');
      document.getElementById('otpInput').value = '';
      document.getElementById('otpInput').focus();
      if (btn) { btn.disabled = false; btn.textContent = '✅ Tasdiqlash va kirish'; }
      return;
    }
    document.getElementById('otpError').classList.remove('show');
    clearInterval(_resendInterval);
    if (_otpRemember) saveSession(_otpRole, _otpUser);
    launchApp(_otpRole, _otpUser);
  }
  if (btn) { btn.disabled = false; btn.textContent = '✅ Tasdiqlash va kirish'; }
}

function fillMainLogin(login, pass) {
  const lEl = document.getElementById('mainLogin');
  const pEl = document.getElementById('mainPass');
  if (lEl) lEl.value = login;
  if (pEl) { pEl.value = pass; pEl.type = 'password'; }
  const eyeBtn = document.getElementById('eyeBtn');
  if (eyeBtn) eyeBtn.innerHTML = '&#x1F441;';
  const errEl = document.getElementById('mainLoginError');
  if (errEl) errEl.classList.remove('show');
}

function loginStudent() {
  const l=document.getElementById('sLogin').value.trim();
  const p=document.getElementById('sPass').value.trim();
  const phone = getPhoneFromInput('student');
  const errEl = document.getElementById('studentError');

  const lockMsg = checkLockout('student:' + l);
  if (lockMsg) { errEl.querySelector('span').textContent=lockMsg; errEl.classList.add('show'); return; }
  if (!p) { errEl.querySelector('span').textContent='Parolni kiriting'; errEl.classList.add('show'); return; }
  if (!phone || phone.length < 9) { errEl.querySelector('span').textContent='📱 Telefon raqamni to\'g\'ri kiriting'; errEl.classList.add('show'); return; }

  _setLoginLoading('sLoginBtn', true);
  const remember = document.getElementById('sRemember').checked;

  // Build email from login (if not already email format, append domain)
 apiLogin('student', l, p, remember).then(function(res) {
    _setLoginLoading('sLoginBtn', false);
    if (res.ok) {
      // API success: map API user to local user format
      const u = { login: l, name: res.user.name, phone: '998' + phone, role: 'student',
                  group: res.user.group || 'CS-2301', gpa: res.user.gpa || 0 };
      clearAttempts('student:' + l); errEl.classList.remove('show');
      showOTPStep('student', u, phone, remember);
    } else if (res.offline) {
      // Offline fallback — use local USERS
      const override = getEffectivePass('student', l);
      const u = USERS.student.find(x=>x.login===l&&(override?override===p:x.pass===p));
      if (!u) { recordFailedAttempt('student:'+l); errEl.querySelector('span').textContent='Login yoki parol noto\'g\'ri'; errEl.classList.add('show'); return; }
      clearAttempts('student:'+l); errEl.classList.remove('show');
      showOTPStep('student', u, phone, remember);
    } else {
      recordFailedAttempt('student:'+l);
      errEl.querySelector('span').textContent = res.error || 'Login yoki parol noto\'g\'ri';
      errEl.classList.add('show');
    }
  }).catch(function() {
    _setLoginLoading('sLoginBtn', false);
    // Network error — use local fallback
    const override = getEffectivePass('student', l);
    const u = USERS.student.find(x=>x.login===l&&(override?override===p:x.pass===p));
    if (!u) { recordFailedAttempt('student:'+l); errEl.querySelector('span').textContent='Login yoki parol noto\'g\'ri'; errEl.classList.add('show'); return; }
    clearAttempts('student:'+l); errEl.classList.remove('show');
    showOTPStep('student', u, phone, remember);
  });
}

function loginTeacher(){
  const l=document.getElementById('tLogin').value.trim();
  const p=document.getElementById('tPass').value.trim();
  const phone = getPhoneFromInput('teacher');
  const errEl = document.getElementById('teacherError');

  const lockMsg = checkLockout('teacher:' + l);
  if (lockMsg) { errEl.querySelector('span').textContent=lockMsg; errEl.classList.add('show'); return; }
  if (!phone || phone.length < 9) { errEl.querySelector('span').textContent='📱 Telefon raqamni to\'g\'ri kiriting'; errEl.classList.add('show'); return; }

  _setLoginLoading('tLoginBtn', true);
  const remember = document.getElementById('tRemember').checked;
   apiLogin('teacher', l, p, remember).then(function(res) {
    _setLoginLoading('tLoginBtn', false);
    if (res.ok) {
      const u = { login: l, name: res.user.name, phone: '998' + phone, dept: res.user.department || '' };
      clearAttempts('teacher:'+l); errEl.classList.remove('show');
      showOTPStep('teacher', u, phone, remember);
    } else if (res.offline) {
      const override = getEffectivePass('teacher', l);
      const u = USERS.teacher.find(x=>x.login===l&&(override?override===p:x.pass===p));
      if (!u) { recordFailedAttempt('teacher:'+l); errEl.querySelector('span').textContent='Login yoki parol noto\'g\'ri'; errEl.classList.add('show'); return; }
      clearAttempts('teacher:'+l); errEl.classList.remove('show');
      showOTPStep('teacher', u, phone, remember);
    } else {
      recordFailedAttempt('teacher:'+l);
      errEl.querySelector('span').textContent = res.error || 'Login yoki parol noto\'g\'ri';
      errEl.classList.add('show');
    }
  }).catch(function() {
    _setLoginLoading('tLoginBtn', false);
    const override = getEffectivePass('teacher', l);
    const u = USERS.teacher.find(x=>x.login===l&&(override?override===p:x.pass===p));
    if (!u) { recordFailedAttempt('teacher:'+l); errEl.querySelector('span').textContent='Login yoki parol noto\'g\'ri'; errEl.classList.add('show'); return; }
    clearAttempts('teacher:'+l); errEl.classList.remove('show');
    showOTPStep('teacher', u, phone, remember);
  });
}

function loginDekanat(){
  const l=document.getElementById('dLogin').value.trim();
  const p=document.getElementById('dPass').value.trim();
  const phone = getPhoneFromInput('dekanat');
  const errEl = document.getElementById('dekanatError');

  const lockMsg = checkLockout('dekanat:' + l);
  if (lockMsg) { errEl.querySelector('span').textContent=lockMsg; errEl.classList.add('show'); return; }
  if (!phone || phone.length < 9) { errEl.querySelector('span').textContent='📱 Telefon raqamni to\'g\'ri kiriting'; errEl.classList.add('show'); return; }

  _setLoginLoading('dLoginBtn', true);
  const remember = document.getElementById('dRemember').checked;
  apiLogin('dekanat', l, p, remember).then(function(res) {
    _setLoginLoading('dLoginBtn', false);
    if (res.ok) {
      const u = { login: l, name: res.user.name, phone: '998' + phone, role: 'Dekan yordamchisi' };
      clearAttempts('dekanat:'+l); errEl.classList.remove('show');
      showOTPStep('dekanat', u, phone, remember);
    } else if (res.offline) {
      const override = getEffectivePass('dekanat', l);
      const u = USERS.dekanat.find(x=>x.login===l&&(override?override===p:x.pass===p));
      if (!u) { recordFailedAttempt('dekanat:'+l); errEl.querySelector('span').textContent='Login yoki parol noto\'g\'ri'; errEl.classList.add('show'); return; }
      clearAttempts('dekanat:'+l); errEl.classList.remove('show');
      showOTPStep('dekanat', u, phone, remember);
    } else {
      recordFailedAttempt('dekanat:'+l);
      errEl.querySelector('span').textContent = res.error || 'Login yoki parol noto\'g\'ri';
      errEl.classList.add('show');
    }
  }).catch(function() {
    _setLoginLoading('dLoginBtn', false);
    const override = getEffectivePass('dekanat', l);
    const u = USERS.dekanat.find(x=>x.login===l&&(override?override===p:x.pass===p));
    if (!u) { recordFailedAttempt('dekanat:'+l); errEl.querySelector('span').textContent='Login yoki parol noto\'g\'ri'; errEl.classList.add('show'); return; }
    clearAttempts('dekanat:'+l); errEl.classList.remove('show');
    showOTPStep('dekanat', u, phone, remember);
  });
}

function loginInvestor(){
  const l=document.getElementById('iLogin').value.trim();
  const p=document.getElementById('iPass').value.trim();
  const override = getEffectivePass('investor', l);
  const u=USERS.investor.find(x=>x.login===l&&(override?override===p:x.pass===p));
  if(!u){document.getElementById('investorError').classList.add('show');return;}
  document.getElementById('investorError').classList.remove('show');
  u.company = document.getElementById('iCompany').value || u.company;
  launchApp('investor', u);
}

function toggleUserMenu(e) {
  e.stopPropagation();
  var dd = document.getElementById('userDropdown');
  if (!dd) return;
  var isOpen = dd.style.display !== 'none';
  dd.style.display = isOpen ? 'none' : 'block';
  // Ism va rolni to'ldirish
  var dn = document.getElementById('dropName');
  var dr = document.getElementById('dropRole');
  if (dn) dn.textContent = document.getElementById('chipName')?.textContent || '';
  if (dr) dr.textContent = document.getElementById('chipRole')?.textContent || '';
  // Tashqarida click qilganda yopish
  if (!isOpen) {
    setTimeout(function() {
      document.addEventListener('click', function _close() {
        dd.style.display = 'none';
        document.removeEventListener('click', _close);
      });
    }, 0);
  }
}

function logout(){
  currentUser=null; currentRole=null;
  _ssDel('idu_active_role');
  _ssDel('idu_active_login');
  _lsDel('idu_session');
  // Clear httpOnly cookie on server + in-memory token
  if (typeof apiLogout === 'function') apiLogout();
  document.getElementById('appScreen').classList.remove('visible');
  document.getElementById('appScreen').style.display='none';
  document.getElementById('authScreen').style.display='flex';
  selectedRole=null;
  openLoginModal();
}

function showForgotPassword(role) {
  _fpRole = role; _fpUser = null; _fpOtp = null;
  document.getElementById('fpPhone').value = '';
  document.getElementById('fpOtpInput').value = '';
  document.getElementById('fpNewPass').value = '';
  document.getElementById('fpNewPass2').value = '';
  document.getElementById('fpError').style.display = 'none';
  document.getElementById('fpOtpError').style.display = 'none';
  document.getElementById('fpPassError').style.display = 'none';
  showFpStep1();
  document.getElementById('forgotModal').style.display = 'flex';
  document.getElementById('loginModalBg').classList.remove('open');
}

function generateNewCredentialsLocal() {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  let newPass = '';
  for (let i = 0; i < 8; i++) newPass += chars[Math.floor(Math.random() * chars.length)];
  setPassOverride(_fpRole, _fpUser.login, newPass);
  document.getElementById('fpNewLogin').textContent = _fpUser.login;
  document.getElementById('fpCredPass').textContent = newPass;
  ['fp-step1','fp-step2','fp-step3','fp-step4'].forEach(id => document.getElementById(id).style.display='none');
  document.getElementById('fp-step4').style.display = 'block';
  showToast('✅', 'Ma\'lumotlar tayyor', 'Yangi login va parol tayyor!');
}

function selectRole(role, el) {
  selectedRole = role;
  document.querySelectorAll('.role-card').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  const btn = document.getElementById('btnNext');
  if(btn){ btn.disabled = false; btn.style.opacity='1'; btn.style.cursor='pointer'; }
}

function goToLogin() {
  if (!selectedRole) return;
  showStep('step-' + selectedRole);
}

function backToRole() { showStep('step-role'); }

function showStep(id) {
  document.querySelectorAll('.auth-step').forEach(s => s.classList.remove('active'));
  var el = document.getElementById(id); if(el) el.classList.add('active');
}
