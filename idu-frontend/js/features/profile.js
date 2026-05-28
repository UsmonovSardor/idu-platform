'use strict';
/* ══════════════════════════════════════════════════════════════
   Profile page — view/edit own info, password, push subscription
══════════════════════════════════════════════════════════════ */

var _profileData = null;

async function loadProfile() {
  try {
    var me = await api('GET', '/auth/me');
    _profileData = me;
    _fillProfileForm(me);
    _renderProfileHeader(me);
    _updatePushButton();
  } catch (e) {
    if (typeof showToast === 'function') showToast('⚠️', 'Xato', 'Profil yuklanmadi');
  }
}

function _fillProfileForm(me) {
  var set = function(id, val) {
    var el = document.getElementById(id);
    if (el) el.value = val || '';
  };
  set('pf_full_name', me.full_name);
  set('pf_email',     me.email);
  set('pf_phone',     me.phone);
  set('pf_login',     me.login);
  set('pf_bio',       me.bio);
}

function _renderProfileHeader(me) {
  var avatar = document.getElementById('profileAvatar');
  if (avatar) {
    if (me.avatar_url) {
      avatar.style.background = 'url(' + me.avatar_url + ') center/cover';
      avatar.textContent = '';
    } else {
      var initials = (me.full_name || '?').split(' ').map(function(p) { return p[0]; }).join('').slice(0,2).toUpperCase();
      avatar.textContent = initials;
      avatar.style.background = 'linear-gradient(135deg,#1B4FD8,#3B82F6)';
    }
  }
  var nameEl = document.getElementById('profileName');
  if (nameEl) nameEl.textContent = me.full_name || '—';
  var roleEl = document.getElementById('profileRole');
  if (roleEl) {
    var roleMap = { student:'Talaba', teacher:'O\'qituvchi', dekanat:'Dekanat', investor:'Investor', admin:'Administrator' };
    roleEl.textContent = roleMap[me.role] || me.role;
  }
  var metaEl = document.getElementById('profileMeta');
  if (metaEl) {
    var parts = [];
    if (me.faculty)       parts.push('🎓 ' + me.faculty);
    if (me.year_of_study) parts.push(me.year_of_study + '-kurs');
    if (me.gpa != null)   parts.push('GPA: ' + Number(me.gpa).toFixed(2));
    metaEl.textContent = parts.join(' · ') || '—';
  }
}

async function saveProfile() {
  var body = {
    full_name: document.getElementById('pf_full_name').value.trim(),
    email:     document.getElementById('pf_email').value.trim() || undefined,
    phone:     document.getElementById('pf_phone').value.trim() || undefined,
    bio:       document.getElementById('pf_bio').value.trim() || undefined,
  };
  // Remove undefined / empty (PATCH only what's set)
  Object.keys(body).forEach(function(k) { if (body[k] === undefined || body[k] === '') delete body[k]; });
  try {
    await api('PATCH', '/auth/me', body);
    if (typeof showToast === 'function') showToast('✅', 'Saqlandi', 'Profil yangilandi');
    loadProfile();
  } catch (e) {
    if (typeof showToast === 'function') showToast('⚠️', 'Xato', e.message || 'Saqlanmadi');
  }
}

async function savePassword() {
  var cur  = document.getElementById('pf_curpass').value;
  var nw   = document.getElementById('pf_newpass').value;
  var nw2  = document.getElementById('pf_newpass2').value;
  if (nw !== nw2) {
    if (typeof showToast === 'function') showToast('⚠️', 'Xato', 'Yangi parollar mos kelmadi');
    return;
  }
  try {
    await api('PATCH', '/auth/password', { currentPassword: cur, newPassword: nw });
    if (typeof showToast === 'function') showToast('✅', 'Yangilandi', 'Parol o\'zgartirildi');
    document.getElementById('passForm').reset();
  } catch (e) {
    if (typeof showToast === 'function') showToast('⚠️', 'Xato', e.message || 'O\'zgartirilmadi');
  }
}

async function onProfileAvatarChange(evt) {
  var file = evt.target.files && evt.target.files[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) {
    if (typeof showToast === 'function') showToast('⚠️', 'Xato', 'Maksimal 2MB');
    return;
  }
  // Convert to base64 dataURL (no upload backend yet — stored inline)
  var reader = new FileReader();
  reader.onload = async function() {
    var dataUrl = reader.result;
    // For real prod: upload to /api/upload first then store URL.
    // For now: limit to small images (already <2MB → base64 ~3MB acceptable for avatar).
    try {
      await api('PATCH', '/auth/me', { avatar_url: dataUrl });
      if (typeof showToast === 'function') showToast('✅', 'Yangilandi', 'Avatar saqlandi');
      loadProfile();
    } catch (e) {
      if (typeof showToast === 'function') showToast('⚠️', 'Xato', e.message || 'Yuklanmadi');
    }
  };
  reader.readAsDataURL(file);
}

// ── Push subscription handling ────────────────────────────────────────────────
function _updatePushButton() {
  var btn = document.getElementById('pushSubBtn');
  if (!btn) return;
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    btn.textContent = 'Brauzer qo\'llab-quvvatlamaydi';
    btn.disabled = true;
    return;
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
      _updatePushButton();
      return;
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

console.log('✅ Profile module loaded');
