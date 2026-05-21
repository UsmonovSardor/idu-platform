'use strict';
// IDU — Attendance (QR davomat) module

// ── Teacher side ─────────────────────────────────────────────────────────────

var _attSession   = null;   // active session object
var _attPollTimer = null;   // polling interval

function openAttendanceModal() {
  var m = document.getElementById('attendanceModal');
  if (!m) return;
  // reset to step-1
  document.getElementById('att-step1').style.display = '';
  document.getElementById('att-step2').style.display = 'none';
  document.getElementById('att-step3').style.display = 'none';
  _stopAttPoll();
  m.classList.add('open');
}

function closeAttendanceModal() {
  var m = document.getElementById('attendanceModal');
  if (m) m.classList.remove('open');
  _stopAttPoll();
}

async function startAttendanceSession() {
  var subject  = (document.getElementById('attSubject')  || {}).value || '';
  var group    = (document.getElementById('attGroup')    || {}).value || '';
  var room     = (document.getElementById('attRoom')     || {}).value || '';
  var duration = parseInt((document.getElementById('attDuration') || {}).value || '15', 10);

  if (!subject || !group) { showToast('⚠️', 'Xato', 'Fan va guruhni tanlang'); return; }

  var btn = document.getElementById('attStartBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Yuklanmoqda...'; }

  try {
    var data = await api('POST', '/attendance/session', { subject, group, room, durationMinutes: duration });
    _attSession = data;
    _renderQR(data);
    document.getElementById('att-step1').style.display = 'none';
    document.getElementById('att-step2').style.display = '';
    _startAttPoll(data.id);
    showToast('✅', 'Davomat', 'Sessiya boshlandi — ' + data.session_code);
  } catch(e) {
    showToast('❌', 'Xato', e.message || 'Sessiya ochilmadi');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '📡 Sessiyan boshlash'; }
  }
}

function _renderQR(session) {
  var container = document.getElementById('attQrContainer');
  if (!container) return;

  // Build QR payload — students will send this token
  var payload = JSON.stringify({ token: session.qr_token, sub: session.subject, grp: session.group_name });

  // Use qrcode.js library (loaded via CDN)
  container.innerHTML = '';
  if (typeof QRCode !== 'undefined') {
    new QRCode(container, {
      text: payload,
      width: 220, height: 220,
      colorDark: '#1B4FD8', colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.M
    });
  } else {
    // Fallback: show token as text
    container.innerHTML = '<div style="font-family:monospace;font-size:13px;word-break:break-all;padding:8px;background:#F1F5F9;border-radius:8px">' + session.session_code + '</div>';
  }

  // Show short code
  var codeEl = document.getElementById('attShortCode');
  if (codeEl) codeEl.textContent = session.session_code;

  // Show expiry countdown
  _startCountdown(new Date(session.expires_at));
}

function _startCountdown(expiresAt) {
  var el = document.getElementById('attCountdown');
  if (!el) return;
  clearInterval(window._attCdTimer);
  window._attCdTimer = setInterval(function() {
    var diff = Math.max(0, expiresAt - Date.now());
    var min = Math.floor(diff / 60000);
    var sec = Math.floor((diff % 60000) / 1000);
    el.textContent = min + ':' + (sec < 10 ? '0' : '') + sec;
    el.style.color = diff < 60000 ? '#DC2626' : '#16A34A';
    if (diff === 0) {
      clearInterval(window._attCdTimer);
      el.textContent = 'Vaqt tugadi';
      showToast('⏰', 'Davomat', 'QR kodning vaqti tugadi');
    }
  }, 1000);
}

function _startAttPoll(sessionId) {
  _stopAttPoll();
  _attPollTimer = setInterval(function() {
    api('GET', '/attendance/session/' + sessionId).then(function(data) {
      var el = document.getElementById('attPresentList');
      if (!el) return;
      var count = data.records ? data.records.length : 0;
      var countEl = document.getElementById('attPresentCount');
      if (countEl) countEl.textContent = count;
      el.innerHTML = (data.records || []).map(function(r) {
        return '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #F1F5F9">'
          + '<div style="width:32px;height:32px;border-radius:50%;background:#DBEAFE;display:flex;align-items:center;justify-content:center;font-size:14px">👤</div>'
          + '<div><div style="font-weight:600;font-size:13px">' + (r.full_name || r.email) + '</div>'
          + '<div style="font-size:11px;color:#94A3B8">' + new Date(r.marked_at).toLocaleTimeString() + ' · ' + r.method + '</div></div>'
          + '</div>';
      }).join('') || '<div style="text-align:center;color:#94A3B8;padding:16px;font-size:13px">Hali hech kim kelmadi</div>';
    }).catch(function(){});
  }, 3000);
}

function _stopAttPoll() {
  if (_attPollTimer) { clearInterval(_attPollTimer); _attPollTimer = null; }
  if (window._attCdTimer) { clearInterval(window._attCdTimer); window._attCdTimer = null; }
}

async function closeAttSession() {
  if (!_attSession) return;
  try {
    await api('PATCH', '/attendance/session/' + _attSession.id + '/close', {});
    showToast('🔒', 'Davomat', 'Sessiya yopildi');
    _stopAttPoll();
    // show summary step
    document.getElementById('att-step2').style.display = 'none';
    document.getElementById('att-step3').style.display = '';
    _loadSessionSummary(_attSession.id);
  } catch(e) {
    showToast('❌', 'Xato', e.message);
  }
}

async function _loadSessionSummary(sessionId) {
  var el = document.getElementById('attSummaryBody');
  if (!el) return;
  try {
    var data = await api('GET', '/attendance/session/' + sessionId);
    var pct = data.totalCount > 0 ? Math.round(100 * data.presentCount / data.totalCount) : 0;
    el.innerHTML = '<div style="text-align:center;margin-bottom:16px">'
      + '<div style="font-size:48px;font-weight:900;color:#1B4FD8">' + pct + '%</div>'
      + '<div style="color:#64748B;font-size:13px">' + data.presentCount + ' / ' + data.totalCount + ' talaba keldi</div>'
      + '</div>'
      + '<div style="background:#F0FDF4;border-radius:10px;padding:12px;font-size:13px;color:#16A34A;font-weight:600">'
      + '✅ ' + data.subject + ' — ' + data.group_name + '</div>';
  } catch(e) {
    el.innerHTML = '<div style="color:#DC2626">Ma\'lumot yuklanmadi</div>';
  }
}

// ── Student side ──────────────────────────────────────────────────────────────

async function markAttendanceByCode() {
  var codeEl = document.getElementById('attCodeInput');
  var code   = (codeEl ? codeEl.value : '').trim().toUpperCase();
  if (code.length < 4) { showToast('⚠️', 'Xato', 'Kodni to\'liq kiriting'); return; }

  var btn = document.getElementById('attMarkBtn');
  if (btn) btn.disabled = true;

  try {
    var data = await api('POST', '/attendance/mark', { code });
    showToast('✅', 'Davomat', data.subject + ' — davomat belgilandi!');
    if (codeEl) codeEl.value = '';
    renderMyAttendance();
  } catch(e) {
    showToast('❌', 'Xato', e.message || 'Kod noto\'g\'ri');
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function markAttendanceByQR(token) {
  try {
    var data = await api('POST', '/attendance/mark', { token });
    showToast('✅', 'Davomat', data.subject + ' — davomat belgilandi!');
    renderMyAttendance();
  } catch(e) {
    showToast('❌', 'Xato', e.message || 'QR noto\'g\'ri');
  }
}

// ── Student: QR Scanner (jsQR via camera) ────────────────────────────────────

var _scannerActive = false;
var _videoStream   = null;

function openQRScanner() {
  var modal = document.getElementById('qrScanModal');
  if (!modal) return;
  modal.classList.add('open');
  _startQRScanner();
}

function closeQRScanner() {
  var modal = document.getElementById('qrScanModal');
  if (modal) modal.classList.remove('open');
  _stopQRScanner();
}

function _startQRScanner() {
  if (!navigator.mediaDevices) {
    showToast('❌', 'Kamera', 'Brauzer kamerani qo\'llab-quvvatlamaydi');
    return;
  }
  var video = document.getElementById('qrVideo');
  var canvas = document.getElementById('qrCanvas');
  if (!video || !canvas) return;

  navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
    .then(function(stream) {
      _videoStream = stream;
      video.srcObject = stream;
      video.play();
      _scannerActive = true;
      _scanFrame(video, canvas);
    })
    .catch(function(err) {
      showToast('❌', 'Kamera', 'Kamera ruxsati berilmadi: ' + err.message);
    });
}

function _stopQRScanner() {
  _scannerActive = false;
  if (_videoStream) {
    _videoStream.getTracks().forEach(function(t) { t.stop(); });
    _videoStream = null;
  }
}

function _scanFrame(video, canvas) {
  if (!_scannerActive) return;
  if (video.readyState === video.HAVE_ENOUGH_DATA) {
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    var ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    if (typeof jsQR !== 'undefined') {
      var code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'dontInvert' });
      if (code && code.data) {
        _stopQRScanner();
        closeQRScanner();
        try {
          var payload = JSON.parse(code.data);
          if (payload.token) {
            markAttendanceByQR(payload.token);
            return;
          }
        } catch(e) {}
        showToast('❌', 'QR', 'Noto\'g\'ri QR kod');
        return;
      }
    }
  }
  requestAnimationFrame(function() { _scanFrame(video, canvas); });
}

// ── Student: open attendance modal ───────────────────────────────────────────

function openStudentAttModal() {
  var m = document.getElementById('studentAttModal');
  if (!m) return;
  m.style.display = 'flex';
  renderMyAttendance();
}

// ── My attendance history (student) ─────────────────────────────────────────

async function renderMyAttendance() {
  var el = document.getElementById('myAttendanceList');
  if (!el) return;
  el.innerHTML = '<div style="text-align:center;color:#94A3B8;padding:16px">Yuklanmoqda...</div>';
  try {
    var rows = await api('GET', '/attendance/my');
    if (!rows.length) {
      el.innerHTML = '<div style="text-align:center;color:#94A3B8;padding:24px">Hali davomat yo\'q</div>';
      return;
    }
    el.innerHTML = rows.map(function(r) {
      var d = new Date(r.marked_at);
      return '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid #F1F5F9">'
        + '<div>'
        + '<div style="font-weight:700;font-size:13px">' + r.subject + '</div>'
        + '<div style="font-size:11px;color:#94A3B8">' + r.group_name + ' · ' + d.toLocaleDateString() + ' ' + d.toLocaleTimeString() + '</div>'
        + '</div>'
        + '<div style="background:#DCFCE7;color:#16A34A;font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px">✓ Keldi</div>'
        + '</div>';
    }).join('');
  } catch(e) {
    el.innerHTML = '<div style="color:#DC2626;text-align:center;padding:16px">Xato: ' + e.message + '</div>';
  }
}

// ── Dekanat: attendance report ───────────────────────────────────────────────

async function renderAttendanceReport() {
  var el = document.getElementById('attReportBody');
  if (!el) return;
  el.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#94A3B8;padding:24px">Yuklanmoqda...</td></tr>';

  var group   = (document.getElementById('attRptGroup')   || {}).value || '';
  var subject = (document.getElementById('attRptSubject') || {}).value || '';
  var from    = (document.getElementById('attRptFrom')    || {}).value || '';
  var to      = (document.getElementById('attRptTo')      || {}).value || '';

  var q = '?';
  if (group)   q += 'group=' + encodeURIComponent(group) + '&';
  if (subject) q += 'subject=' + encodeURIComponent(subject) + '&';
  if (from)    q += 'from=' + from + '&';
  if (to)      q += 'to=' + to + '&';

  try {
    var rows = await api('GET', '/attendance/report' + q);
    if (!rows.length) {
      el.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#94A3B8;padding:24px">Ma\'lumot topilmadi</td></tr>';
      return;
    }
    el.innerHTML = rows.map(function(r) {
      return '<tr>'
        + '<td style="padding:10px 12px;font-weight:600">' + new Date(r.created_at).toLocaleDateString() + '</td>'
        + '<td style="padding:10px 12px">' + r.subject + '</td>'
        + '<td style="padding:10px 12px">' + r.group_name + '</td>'
        + '<td style="padding:10px 12px">' + r.teacher_name + '</td>'
        + '<td style="padding:10px 12px;text-align:center"><span style="background:#DBEAFE;color:#1D4ED8;font-weight:700;padding:3px 10px;border-radius:20px">' + r.present_count + '</span></td>'
        + '<td style="padding:10px 12px"><span style="background:' + (r.closed_at ? '#F0FDF4' : '#FFF7ED') + ';color:' + (r.closed_at ? '#16A34A' : '#EA580C') + ';font-size:11px;padding:3px 8px;border-radius:12px">'
        + (r.closed_at ? '✓ Yopildi' : '● Faol') + '</span></td>'
        + '</tr>';
    }).join('');
  } catch(e) {
    el.innerHTML = '<tr><td colspan="6" style="color:#DC2626;padding:16px">' + e.message + '</td></tr>';
  }
}
