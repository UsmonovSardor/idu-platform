'use strict';
/* ══════════════════════════════════════════════════════════════
   Profile v2.0 — avatar upload (compressed), status badges,
   stats bar, password toggle/strength, dekanat-visible changes
══════════════════════════════════════════════════════════════ */

var _profileData = null;

// ── Load & render ────────────────────────────────────────────────────────────
async function loadProfile() {
  try {
    var me = await api('GET', '/auth/me');
    _profileData = me;
    _fillProfileForm(me);
    _renderProfileHeader(me);
    _renderStatsBar(me);
    _updatePushButton();
  } catch (e) {
    if (typeof showToast === 'function') showToast('⚠️', 'Xato', 'Profil yuklanmadi');
  }
}

function _fillProfileForm(me) {
  var set = function(id, val) { var el = document.getElementById(id); if (el) el.value = val || ''; };
  set('pf_full_name', me.full_name);
  set('pf_email',     me.email);
  set('pf_phone',     me.phone);
  set('pf_login',     me.login);
  set('pf_bio',       me.bio);
  set('pf_nickname',  me.nickname);
}

function _renderProfileHeader(me) {
  // Avatar
  var av = document.getElementById('profileAvatar');
  if (av) {
    if (me.avatar_url) {
      av.style.backgroundImage = 'url("' + me.avatar_url + '")';
      av.style.backgroundSize  = 'cover';
      av.style.backgroundPosition = 'center';
      av.textContent = '';
    } else {
      var ini = (me.full_name || '?').split(' ').filter(Boolean).map(function(p){ return p[0]; }).join('').slice(0,2).toUpperCase();
      av.textContent = ini;
      av.style.backgroundImage = '';
      av.style.background = 'linear-gradient(135deg,#1B4FD8,#3B82F6)';
    }
  }

  // Name
  var nameEl = document.getElementById('profileName');
  if (nameEl) nameEl.textContent = me.full_name || '—';

  // Nickname
  var nickEl = document.getElementById('profileNickname');
  if (nickEl) {
    if (me.nickname) {
      nickEl.textContent = '@' + me.nickname;
      nickEl.style.display = '';
    } else {
      nickEl.style.display = 'none';
    }
  }

  // Role chip + user_code
  var roleEl = document.getElementById('profileRole');
  if (roleEl) {
    var roleMap = { student:'🎓 Talaba', teacher:"👨‍🏫 O'qituvchi", dekanat:'🏛 Dekanat', investor:'💼 Investor', admin:'⚙️ Admin' };
    roleEl.textContent = roleMap[me.role] || me.role;
  }
  var codeEl = document.getElementById('profileUserCode');
  if (codeEl) {
    if (me.user_code) {
      // Format: XXXX XXXX XXXX XXXX (like a card number)
      var c = String(me.user_code);
      var fmt = c.slice(0,4) + ' ' + c.slice(4,8) + ' ' + c.slice(8,12) + ' ' + c.slice(12,16);
      codeEl.textContent = fmt;
      codeEl.style.display = '';
    } else {
      codeEl.style.display = 'none';
    }
  }

  // Meta
  var metaEl = document.getElementById('profileMeta');
  if (metaEl) {
    var parts = [];
    if (me.faculty)         parts.push(me.faculty);
    if (me.year_of_study)   parts.push(me.year_of_study + '-kurs');
    if (me.department)      parts.push(me.department);
    if (me.student_id_number) parts.push('ID: ' + me.student_id_number);
    metaEl.textContent = parts.join(' · ') || '—';
  }

  // Badges
  var badgesEl = document.getElementById('profileBadges');
  if (badgesEl) {
    var badges = _computeBadges(me);
    badgesEl.innerHTML = badges.map(function(b) {
      return '<span class="profile-badge" style="background:' + b.bg + ';color:' + b.color + ';border-color:' + b.border + '">' + b.icon + ' ' + b.label + '</span>';
    }).join('');
  }
}

function _computeBadges(me) {
  var badges = [];
  var gpa = me.gpa ? parseFloat(me.gpa) : 0;

  if (gpa >= 3.7) {
    badges.push({ icon:'⭐', label:"A'lochi",        bg:'rgba(245,158,11,0.1)', color:'#b45309', border:'rgba(245,158,11,0.3)' });
  } else if (gpa >= 3.0) {
    badges.push({ icon:'📚', label:'Yaxshi talaba',  bg:'rgba(37,99,235,0.08)', color:'#1d4ed8', border:'rgba(37,99,235,0.2)' });
  } else if (gpa >= 2.5) {
    badges.push({ icon:'📖', label:'Qoniqarli',      bg:'rgba(16,185,129,0.08)', color:'#065f46', border:'rgba(16,185,129,0.2)' });
  }

  // Role badge only for non-student roles (students already have role chip)
  if (me.role === 'dekanat') {
    badges.push({ icon:'🏛', label:'Dekanat', bg:'rgba(99,102,241,0.08)', color:'#4338ca', border:'rgba(99,102,241,0.2)' });
  } else if (me.role === 'admin') {
    badges.push({ icon:'⚙️', label:'Admin',   bg:'rgba(239,68,68,0.08)', color:'#dc2626', border:'rgba(239,68,68,0.2)' });
  }

  return badges;
}

function _renderStatsBar(me) {
  var el = document.getElementById('profileStatsBar');
  if (!el) return;
  if (me.role !== 'student') { el.style.display = 'none'; return; }

  var gpa  = me.gpa ? parseFloat(me.gpa).toFixed(2) : '—';
  var year = me.year_of_study ? me.year_of_study + '-kurs' : '—';
  var fac  = me.faculty || '—';

  el.style.display = '';
  el.innerHTML =
    '<div class="psb-item"><div class="psb-val" style="color:#2563eb">' + gpa + '</div><div class="psb-key">GPA</div></div>' +
    '<div class="psb-item"><div class="psb-val" style="color:#0891b2">' + year + '</div><div class="psb-key">Kurs</div></div>' +
    '<div class="psb-item"><div class="psb-val" style="color:#6366f1;font-size:13px;letter-spacing:-0.2px">' + fac.substring(0,16) + '</div><div class="psb-key">Fakultet</div></div>' +
    '<div class="psb-item"><div class="psb-val" style="color:#059669">' + (me.role === 'student' ? '✅' : '—') + '</div><div class="psb-key">Faol</div></div>';
}

// ── Save profile ──────────────────────────────────────────────────────────────
async function saveProfile() {
  var nickRaw = (document.getElementById('pf_nickname') ? document.getElementById('pf_nickname').value : '').trim();
  // Validate nickname client-side
  if (nickRaw && !/^[a-zA-Z0-9_]{3,30}$/.test(nickRaw)) {
    if (typeof showToast === 'function') showToast('⚠️', 'Xato', 'Nickname: 3-30 ta harf/raqam/_');
    return;
  }
  var body = {
    full_name: (document.getElementById('pf_full_name').value || '').trim(),
    email:     (document.getElementById('pf_email').value     || '').trim() || undefined,
    phone:     (document.getElementById('pf_phone').value     || '').trim() || undefined,
    bio:       (document.getElementById('pf_bio').value       || '').trim() || undefined,
    nickname:  nickRaw || undefined,
  };
  Object.keys(body).forEach(function(k) { if (body[k] === undefined) delete body[k]; });
  try {
    await api('PATCH', '/auth/me', body);
    if (typeof showToast === 'function') showToast('✅', 'Saqlandi', 'Profil yangilandi');
    loadProfile();
    // Update top-bar name if function exists
    if (typeof loadUserInfo === 'function') loadUserInfo();
  } catch (e) {
    if (typeof showToast === 'function') showToast('⚠️', 'Xato', e.message || 'Saqlanmadi');
  }
}

// ── Save password ─────────────────────────────────────────────────────────────
async function savePassword() {
  var cur  = document.getElementById('pf_curpass').value;
  var nw   = document.getElementById('pf_newpass').value;
  var nw2  = document.getElementById('pf_newpass2').value;

  if (nw !== nw2) {
    if (typeof showToast === 'function') showToast('⚠️', 'Xato', 'Yangi parollar mos kelmadi');
    return;
  }
  if (nw.length < 6) {
    if (typeof showToast === 'function') showToast('⚠️', 'Xato', 'Parol kamida 6 belgidan iborat bo\'lsin');
    return;
  }
  try {
    await api('PATCH', '/auth/password', { currentPassword: cur, newPassword: nw });
    if (typeof showToast === 'function') showToast('✅', 'Yangilandi', 'Parol muvaffaqiyatli o\'zgartirildi');
    document.getElementById('passForm').reset();
    document.getElementById('passStrengthFill').style.width = '0';
    document.getElementById('passStrengthLabel').textContent = '';
  } catch (e) {
    if (typeof showToast === 'function') showToast('⚠️', 'Xato', e.message || 'O\'zgartirilmadi');
  }
}

// ── Avatar: compress + save ───────────────────────────────────────────────────
async function onProfileAvatarChange(evt) {
  var file = evt.target.files && evt.target.files[0];
  if (!file) return;
  if (file.size > 8 * 1024 * 1024) {
    if (typeof showToast === 'function') showToast('⚠️', 'Xato', 'Maksimal 8MB');
    return;
  }
  try {
    // Client-side compress to max 300×300, JPEG 0.82
    var dataUrl = await _compressImage(file, 300, 300, 0.82);
    await api('PATCH', '/auth/me', { avatar_url: dataUrl });
    if (typeof showToast === 'function') showToast('✅', 'Yangilandi', 'Profil rasmi saqlandi');
    loadProfile();
    // Refresh top-bar avatar
    if (typeof loadUserInfo === 'function') loadUserInfo();
  } catch (e) {
    if (typeof showToast === 'function') showToast('⚠️', 'Xato', e.message || 'Yuklanmadi');
  }
}

function _compressImage(file, maxW, maxH, quality) {
  return new Promise(function(resolve, reject) {
    var reader = new FileReader();
    reader.onload = function(e) {
      var img = new Image();
      img.onload = function() {
        var w = img.width, h = img.height;
        var ratio = Math.min(maxW / w, maxH / h, 1);
        var cw = Math.round(w * ratio);
        var ch = Math.round(h * ratio);
        var canvas = document.createElement('canvas');
        canvas.width  = cw;
        canvas.height = ch;
        canvas.getContext('2d').drawImage(img, 0, 0, cw, ch);
        resolve(canvas.toDataURL('image/jpeg', quality || 0.82));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ── Password UI helpers ───────────────────────────────────────────────────────
function togglePassVis(inputId, btn) {
  var inp = document.getElementById(inputId);
  if (!inp) return;
  var isText = inp.type === 'text';
  inp.type = isText ? 'password' : 'text';
  btn.textContent = isText ? '👁' : '🙈';
}

function checkPassStrength(val) {
  var fill  = document.getElementById('passStrengthFill');
  var label = document.getElementById('passStrengthLabel');
  if (!fill || !label) return;

  var score = 0;
  if (val.length >= 6)  score++;
  if (val.length >= 10) score++;
  if (/[A-Z]/.test(val)) score++;
  if (/[0-9]/.test(val)) score++;
  if (/[^A-Za-z0-9]/.test(val)) score++;

  var map = [
    { w:'0%',   color:'transparent', text:'' },
    { w:'20%',  color:'#ef4444',     text:'Juda zaif' },
    { w:'40%',  color:'#f97316',     text:'Zaif' },
    { w:'60%',  color:'#eab308',     text:'O\'rtacha' },
    { w:'80%',  color:'#22c55e',     text:'Yaxshi' },
    { w:'100%', color:'#15803d',     text:'Kuchli 💪' },
  ];
  var s = map[Math.min(score, 5)];
  fill.style.width  = s.w;
  fill.style.background = s.color;
  fill.style.transition = 'width 0.3s,background 0.3s';
  label.textContent = s.text;
  label.style.color = s.color;
}

// ── Push subscription ─────────────────────────────────────────────────────────
function _updatePushButton() {
  var btn = document.getElementById('pushSubBtn');
  if (!btn) return;
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    btn.textContent = 'Brauzer qo\'llab-quvvatlamaydi';
    btn.disabled = true; return;
  }
  navigator.serviceWorker.ready.then(function(reg) {
    reg.pushManager.getSubscription().then(function(sub) {
      btn.textContent = sub ? 'O\'chirish' : 'Yoqish';
      btn.dataset.subscribed = sub ? '1' : '0';
    });
  });
}

function urlBase64ToUint8Array(base64) {
  var pad = '='.repeat((4 - base64.length % 4) % 4);
  var b64 = (base64 + pad).replace(/-/g, '+').replace(/_/g, '/');
  var raw = atob(b64);
  var arr = new Uint8Array(raw.length);
  for (var i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

async function togglePushSubscription() {
  var btn = document.getElementById('pushSubBtn');
  if (!btn) return;
  try {
    var reg = await navigator.serviceWorker.ready;
    var existing = await reg.pushManager.getSubscription();
    if (existing) {
      await existing.unsubscribe();
      try { await api('POST', '/push/unsubscribe', { endpoint: existing.endpoint }); } catch(e){}
      if (typeof showToast === 'function') showToast('🔕', 'O\'chirildi', 'Push bildirishnomalar to\'xtatildi');
      _updatePushButton(); return;
    }
    var perm = await Notification.requestPermission();
    if (perm !== 'granted') {
      if (typeof showToast === 'function') showToast('🔕', 'Rad etildi', 'Bildirishnomalar yoqilmadi');
      return;
    }
    var vapidRes = await api('GET', '/push/vapid-public');
    if (!vapidRes.publicKey) {
      if (typeof showToast === 'function') showToast('⚠️', 'Xato', 'Server VAPID kalitsiz');
      return;
    }
    var sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidRes.publicKey),
    });
    await api('POST', '/push/subscribe', sub.toJSON());
    if (typeof showToast === 'function') showToast('🔔', 'Yoqildi!', 'Endi dars va imtihondan xabardor bo\'lasiz');
    _updatePushButton();
  } catch (e) {
    if (typeof showToast === 'function') showToast('⚠️', 'Xato', e.message || 'Push yoqilmadi');
  }
}

// ── User search by nickname / ID ──────────────────────────────────────────────
var _searchTimer = null;

function onNicknameSearchInput(val) {
  var q = val.trim();
  var box = document.getElementById('nickSearchResults');
  var inp = document.getElementById('nickSearchInput');
  if (!box) return;
  if (!q || q.length < 2) { box.innerHTML = ''; box.style.display = 'none'; return; }
  // Position the fixed dropdown under the input
  if (inp) {
    var r = inp.getBoundingClientRect();
    box.style.top    = (r.bottom + 6) + 'px';
    box.style.left   = r.left + 'px';
    box.style.width  = r.width + 'px';
  }
  clearTimeout(_searchTimer);
  _searchTimer = setTimeout(function() { _doNicknameSearch(q, box); }, 350);
}

async function _doNicknameSearch(q, box) {
  try {
    var results = await api('GET', '/auth/search?q=' + encodeURIComponent(q));
    if (!results || !results.length) {
      box.innerHTML = '<div class="nick-sr-empty">Foydalanuvchi topilmadi</div>';
      box.style.display = 'block'; return;
    }
    box.innerHTML = results.map(function(u) {
      var ini = (u.full_name || '?').split(' ').filter(Boolean).map(function(p){return p[0];}).join('').slice(0,2).toUpperCase();
      var avHtml = u.avatar_url
        ? '<div class="nick-sr-av"><img src="'+u.avatar_url+'" onerror="this.parentNode.innerHTML=\''+ini+'\'" alt=""></div>'
        : '<div class="nick-sr-av">'+ini+'</div>';
      var roleMap  = { student:'🎓 Talaba', teacher:"👨‍🏫 O'qituvchi", dekanat:'🏛 Dekanat', admin:'⚙️ Admin', investor:'💼 Investor' };
      var roleColors = { student:'rgba(37,99,235,0.18)', teacher:'rgba(16,185,129,0.18)', dekanat:'rgba(124,58,237,0.18)', admin:'rgba(239,68,68,0.18)', investor:'rgba(234,88,12,0.18)' };
      var roleTxt  = { student:'#60a5fa', teacher:'#34d399', dekanat:'#a78bfa', admin:'#f87171', investor:'#fb923c' };
      var rBg  = roleColors[u.role]  || 'rgba(59,130,246,0.1)';
      var rClr = roleTxt[u.role] || '#60a5fa';
      var roleBadge = '<span style="font-size:10.5px;font-weight:700;color:'+rClr+';background:'+rBg+';border-radius:6px;padding:2px 7px;display:inline-block">'+(roleMap[u.role]||u.role)+'</span>';
      var meta = (u.year_of_study ? u.year_of_study+'-kurs' : '') + (u.faculty ? (u.year_of_study?' · ':'')+u.faculty.substring(0,20) : '');
      var codeStr = u.user_code ? u.user_code.slice(0,4)+' '+u.user_code.slice(4,8)+' '+u.user_code.slice(8,12)+' '+u.user_code.slice(12) : '#'+u.id;
      return '<div class="nick-sr-item" onclick="showUserCard('+u.id+')">'
        + avHtml
        + '<div class="nick-sr-info">'
        + '<div class="nick-sr-name" style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">'+_esc(u.full_name)+(u.nickname ? '<span class="nick-sr-at">@'+_esc(u.nickname)+'</span>' : '')+roleBadge+'</div>'
        + (meta ? '<div class="nick-sr-meta">'+_esc(meta)+'</div>' : '')
        + '</div>'
        + '<div class="nick-sr-id" style="font-family:monospace;letter-spacing:1px">'+codeStr+'</div>'
        + '</div>';
    }).join('');
    box.style.display = 'block';
  } catch(e) { box.innerHTML = ''; box.style.display = 'none'; }
}

function _esc(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// Close search dropdown when clicking outside
document.addEventListener('click', function(e) {
  var wrap = document.getElementById('nickSearchWrap');
  var box  = document.getElementById('nickSearchResults');
  if (box && wrap && !wrap.contains(e.target)) { box.innerHTML = ''; box.style.display = 'none'; }
});

// Show user mini-card modal
async function showUserCard(userId) {
  var box = document.getElementById('nickSearchResults');
  if (box) { box.innerHTML = ''; box.style.display = 'none'; }
  try {
    var results = await api('GET', '/auth/search?q=' + userId);
    var u = results && results[0];
    if (!u) return;
    var ini = (u.full_name || '?').split(' ').filter(Boolean).map(function(p){return p[0];}).join('').slice(0,2).toUpperCase();
    var avHtml = u.avatar_url
      ? '<div style="width:72px;height:72px;border-radius:50%;background-image:url(\''+u.avatar_url+'\');background-size:cover;background-position:center;margin:0 auto 12px"></div>'
      : '<div style="width:72px;height:72px;border-radius:50%;background:linear-gradient(135deg,#1B4FD8,#3B82F6);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:22px;margin:0 auto 12px">'+ini+'</div>';
    var roleMap = { student:'🎓 Talaba', teacher:"👨‍🏫 O'qituvchi", dekanat:'🏛 Dekanat', admin:'⚙️ Admin', investor:'💼 Investor' };
    var modal = document.getElementById('userCardModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'userCardModal';
      modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';
      modal.onclick = function(e){ if(e.target===modal) modal.remove(); };
      document.body.appendChild(modal);
    }
    modal.innerHTML = '<div style="background:#0d1b2e;border:1px solid rgba(59,130,246,0.25);border-radius:18px;padding:28px;max-width:320px;width:100%;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.5)">'
      + '<button onclick="document.getElementById(\'userCardModal\').remove()" style="float:right;background:none;border:none;color:#7d93b5;font-size:20px;cursor:pointer;margin-top:-8px">✕</button>'
      + avHtml
      + '<div style="font-size:18px;font-weight:700;color:#f0f6ff;margin-bottom:4px">'+_esc(u.full_name)+'</div>'
      + (u.nickname ? '<div style="color:#60a5fa;font-size:13px;margin-bottom:8px">@'+_esc(u.nickname)+'</div>' : '')
      + '<div style="color:#8fa5c8;font-size:13px;margin-bottom:6px">'+( roleMap[u.role]||u.role )+'</div>'
      + (u.faculty ? '<div style="color:#7d93b5;font-size:12px">'+_esc(u.faculty)+(u.year_of_study?' · '+u.year_of_study+'-kurs':'')+'</div>' : '')
      + (u.user_code ? '<div style="color:#64748b;font-size:12px;font-family:monospace;letter-spacing:2px;margin-top:8px;background:rgba(148,163,184,0.08);border:1px solid rgba(148,163,184,0.15);border-radius:7px;padding:4px 10px;display:inline-block">'
        + u.user_code.slice(0,4)+' '+u.user_code.slice(4,8)+' '+u.user_code.slice(8,12)+' '+u.user_code.slice(12,16)+'</div>' : '')
      + '<div style="color:#475569;font-size:11px;margin-top:8px">ID: #'+u.id+'</div>'
      + '</div>';
    modal.style.display = 'flex';
  } catch(e) {}
}

console.log('✅ Profile module loaded (v2.1 — nickname + user search)');
