'use strict';
// IDU — Chat module (SSE real-time)

var _chatRoomId  = null;
var _chatEventSrc = null;
var _chatPage    = 1;

// ── Open chat widget ──────────────────────────────────────────────────────────
function openChat() {
  var w = document.getElementById('chatWidget');
  if (!w) return;
  w.style.display = w.style.display === 'none' ? 'flex' : 'none';
  if (w.style.display === 'flex') {
    loadChatRooms();
  }
}

async function loadChatRooms() {
  var listEl = document.getElementById('chatRoomList');
  if (!listEl) return;
  listEl.innerHTML = '<div style="text-align:center;color:#94A3B8;padding:16px;font-size:12px">Yuklanmoqda...</div>';
  try {
    var rooms = await api('GET', '/messages/rooms');
    if (!rooms.length) {
      // Try joining public rooms
      var pub = await api('GET', '/messages/public-rooms').catch(()=>[]);
      if (pub.length) {
        await api('POST', '/messages/rooms/' + pub[0].id + '/join', {}).catch(()=>{});
        rooms = await api('GET', '/messages/rooms').catch(()=>[]);
      }
    }
    if (!rooms.length) {
      listEl.innerHTML = '<div style="text-align:center;color:#94A3B8;padding:16px;font-size:12px">Chat xonalari yo\'q</div>';
      return;
    }
    listEl.innerHTML = rooms.map(function(r) {
      var last = r.last_msg ? r.last_msg.slice(0, 35) + (r.last_msg.length > 35 ? '…' : '') : 'Xabar yo\'q';
      var t = r.last_at ? new Date(r.last_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) : '';
      return '<div class="chat-room-item" onclick="openChatRoom(' + r.id + ',\''+escHtml(r.name)+'\')" style="padding:10px 14px;cursor:pointer;border-bottom:1px solid #F1F5F9;display:flex;gap:10px;align-items:center">'
        + '<div style="width:38px;height:38px;border-radius:50%;background:linear-gradient(135deg,#1B4FD8,#4F46E5);display:flex;align-items:center;justify-content:center;color:#fff;font-size:14px;flex-shrink:0">'
        + r.name.charAt(0).toUpperCase() + '</div>'
        + '<div style="flex:1;min-width:0">'
        + '<div style="font-weight:700;font-size:13px;display:flex;justify-content:space-between"><span>' + escHtml(r.name) + '</span><span style="font-size:10px;color:#94A3B8">' + t + '</span></div>'
        + '<div style="font-size:11px;color:#94A3B8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + escHtml(last) + '</div>'
        + '</div></div>';
    }).join('');
  } catch(e) {
    listEl.innerHTML = '<div style="color:#DC2626;padding:16px;font-size:12px">Xato: ' + e.message + '</div>';
  }
}

async function openChatRoom(roomId, roomName) {
  _chatRoomId = roomId;
  // Switch to message view
  document.getElementById('chatRoomView').style.display = 'none';
  document.getElementById('chatMsgView').style.display  = 'flex';
  document.getElementById('chatRoomNameEl').textContent = roomName;
  document.getElementById('chatMsgList').innerHTML = '<div style="text-align:center;color:#94A3B8;padding:16px;font-size:12px">Yuklanmoqda...</div>';

  await loadMessages(roomId);
  subscribeSSE(roomId);
}

function backToRooms() {
  document.getElementById('chatRoomView').style.display = 'flex';
  document.getElementById('chatMsgView').style.display  = 'none';
  _chatRoomId = null;
  if (_chatEventSrc) { _chatEventSrc.close(); _chatEventSrc = null; }
}

async function loadMessages(roomId) {
  var el = document.getElementById('chatMsgList');
  try {
    var msgs = await api('GET', '/messages/rooms/' + roomId + '/messages?limit=50');
    renderMessages(msgs, el);
  } catch(e) {
    if (el) el.innerHTML = '<div style="color:#DC2626;padding:12px;font-size:12px">Xato: ' + e.message + '</div>';
  }
}

function renderMessages(msgs, el) {
  if (!el) return;
  var myId = window.CURRENT_USER ? window.CURRENT_USER.id : null;
  if (!msgs.length) {
    el.innerHTML = '<div style="text-align:center;color:#94A3B8;padding:20px;font-size:12px">Hali xabar yo\'q. Birinchi xabar yozing!</div>';
    return;
  }
  el.innerHTML = msgs.map(function(m) {
    var isMe = m.sender_id === myId;
    var t = new Date(m.created_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
    return '<div style="display:flex;flex-direction:' + (isMe?'row-reverse':'row') + ';gap:6px;margin-bottom:8px;align-items:flex-end">'
      + '<div style="width:28px;height:28px;border-radius:50%;background:' + (isMe?'#1B4FD8':'#E2E8F0') + ';flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:11px;color:' + (isMe?'#fff':'#64748B') + '">'
      + (m.sender_name||'?').charAt(0).toUpperCase() + '</div>'
      + '<div style="max-width:75%">'
      + (isMe?'':'<div style="font-size:10px;color:#94A3B8;margin-bottom:2px;' + (isMe?'text-align:right':'') + '">' + escHtml(m.sender_name||'') + '</div>')
      + '<div style="background:' + (isMe?'#1B4FD8':'#F1F5F9') + ';color:' + (isMe?'#fff':'#1E293B') + ';border-radius:' + (isMe?'12px 12px 2px 12px':'12px 12px 12px 2px') + ';padding:8px 12px;font-size:13px;line-height:1.4">'
      + escHtml(m.content) + '</div>'
      + '<div style="font-size:10px;color:#94A3B8;margin-top:2px;text-align:' + (isMe?'right':'left') + '">' + t + '</div>'
      + '</div></div>';
  }).join('');
  el.scrollTop = el.scrollHeight;
}

function appendMessage(m) {
  var el = document.getElementById('chatMsgList');
  if (!el) return;
  // Remove "no messages" placeholder
  if (el.querySelector('[style*="Hali xabar"]')) el.innerHTML = '';
  var myId = window.CURRENT_USER ? window.CURRENT_USER.id : null;
  var isMe = m.sender_id === myId;
  var t = new Date(m.created_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
  var div = document.createElement('div');
  div.style.cssText = 'display:flex;flex-direction:' + (isMe?'row-reverse':'row') + ';gap:6px;margin-bottom:8px;align-items:flex-end';
  div.innerHTML = '<div style="width:28px;height:28px;border-radius:50%;background:' + (isMe?'#1B4FD8':'#E2E8F0') + ';flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:11px;color:' + (isMe?'#fff':'#64748B') + '">'
    + (m.sender_name||'?').charAt(0).toUpperCase() + '</div>'
    + '<div style="max-width:75%">'
    + (isMe?'':'<div style="font-size:10px;color:#94A3B8;margin-bottom:2px">' + escHtml(m.sender_name||'') + '</div>')
    + '<div style="background:' + (isMe?'#1B4FD8':'#F1F5F9') + ';color:' + (isMe?'#fff':'#1E293B') + ';border-radius:12px;padding:8px 12px;font-size:13px">' + escHtml(m.content) + '</div>'
    + '<div style="font-size:10px;color:#94A3B8;margin-top:2px;text-align:' + (isMe?'right':'left') + '">' + t + '</div>'
    + '</div>';
  el.appendChild(div);
  el.scrollTop = el.scrollHeight;
}

function subscribeSSE(roomId) {
  if (_chatEventSrc) { _chatEventSrc.close(); _chatEventSrc = null; }
  var token = localStorage.getItem('idu_token') || '';
  var url = (window.API_BASE || '/api') + '/messages/rooms/' + roomId + '/sse';
  try {
    _chatEventSrc = new EventSource(url + '?token=' + encodeURIComponent(token));
    _chatEventSrc.onmessage = function(e) {
      try {
        var payload = JSON.parse(e.data);
        if (payload.type === 'message' && payload.data) {
          var myId = window.CURRENT_USER ? window.CURRENT_USER.id : null;
          if (payload.data.sender_id !== myId) appendMessage(payload.data);
        }
      } catch(err) {}
    };
    _chatEventSrc.onerror = function() {
      // Reconnect silently
    };
  } catch(e) {}
}

async function sendChatMessage() {
  if (!_chatRoomId) return;
  var inp = document.getElementById('chatInput');
  var content = inp ? inp.value.trim() : '';
  if (!content) return;

  inp.value = '';
  inp.focus();

  try {
    var msg = await api('POST', '/messages/rooms/' + _chatRoomId + '/messages', { content });
    appendMessage(msg);
  } catch(e) {
    showToast('❌', 'Chat', e.message || 'Xabar yuborilmadi');
    if (inp) inp.value = content; // restore
  }
}

function chatInputKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendChatMessage();
  }
}

function escHtml(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function showCreateRoomModal() {
  var m = document.getElementById('createRoomModal');
  if (m) m.style.display = 'flex';
}

async function createChatRoom() {
  var name = (document.getElementById('newRoomName') || {}).value || '';
  var type = (document.getElementById('newRoomType') || {}).value || 'group';
  if (!name.trim()) { showToast('⚠️', 'Chat', 'Xona nomini kiriting'); return; }
  try {
    await api('POST', '/messages/rooms', { name: name.trim(), type });
    document.getElementById('createRoomModal').style.display = 'none';
    document.getElementById('newRoomName').value = '';
    showToast('✅', 'Chat', 'Xona yaratildi');
    loadChatRooms();
  } catch(e) {
    showToast('❌', 'Xato', e.message);
  }
}

async function joinPublicRooms() {
  try {
    var pub = await api('GET', '/messages/public-rooms');
    if (!pub.length) { showToast('ℹ️', 'Chat', 'Ommaviy xonalar topilmadi'); return; }
    for (var r of pub) {
      await api('POST', '/messages/rooms/' + r.id + '/join', {}).catch(()=>{});
    }
    showToast('✅', 'Chat', pub.length + ' ta xonaga qo\'shildingiz');
    loadChatRooms();
  } catch(e) {
    showToast('❌', 'Xato', e.message);
  }
}

// Download transcript (student)
function downloadMyTranscript() {
  var uid = window.CURRENT_USER ? window.CURRENT_USER.id : null;
  if (!uid) { showToast('⚠️', 'Xato', 'Avval kiring'); return; }
  var base = (window.API_BASE || '/api').replace(/\/api$/, '');
  var token = localStorage.getItem('idu_token') || sessionStorage.getItem('idu_token') || '';
  // Open in new tab — browser handles PDF download
  window.open(base + '/api/documents/transcript/' + uid + '?token=' + encodeURIComponent(token), '_blank');
}

// Auto-init: create default rooms if teacher/dekanat
async function initDefaultChatRooms() {
  var user = window.CURRENT_USER;
  if (!user || (user.role !== 'teacher' && user.role !== 'dekanat' && user.role !== 'admin')) return;
  try {
    var pub = await api('GET', '/messages/public-rooms');
    if (!pub.length) {
      await api('POST', '/messages/rooms', { name: 'Umumiy chat', type: 'group' });
      await api('POST', '/messages/rooms', { name: "E'lonlar", type: 'announce' });
    }
  } catch(e) {}
}
