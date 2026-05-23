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
    // Save rooms for search filtering
    listEl._allRooms = rooms;
    _renderRoomList(rooms, listEl);
  } catch(e) {
    listEl.innerHTML = '<div style="color:#DC2626;padding:16px;font-size:12px">Xato: ' + e.message + '</div>';
  }
}

async function openChatRoom(roomId, roomName, roomType) {
  _chatRoomId = roomId;
  document.getElementById('chatRoomView').style.display = 'none';
  document.getElementById('chatMsgView').style.display  = 'flex';
  document.getElementById('chatRoomNameEl').textContent = roomName;
  var meta = document.getElementById('chatRoomMeta');
  if (meta) meta.textContent = roomType === 'announce' ? '📢 E\'lonlar kanali' : roomType === 'direct' ? '👤 Shaxsiy' : '👥 Guruh chat';
  document.getElementById('chatMsgList').innerHTML = '<div style="text-align:center;color:#94A3B8;padding:30px;font-size:13px"><div style="font-size:24px;margin-bottom:8px">⏳</div>Yuklanmoqda...</div>';
  await loadMessages(roomId);
  subscribeSSE(roomId);
}

// Room colors palette
var _roomColors = ['#1B4FD8','#7C3AED','#059669','#DC2626','#D97706','#0891B2','#BE185D'];
function _roomColor(id) { return _roomColors[id % _roomColors.length]; }

// Global rooms cache — avoids putting room names directly into onclick strings.
// Room names can contain apostrophes (E'lonlar) which break onclick="...('name')..."
var _chatRoomCache = {};

function openChatRoomById(id) {
  var r = _chatRoomCache[id];
  if (r) openChatRoom(r.id, r.name, r.type);
}

function _renderRoomList(rooms, listEl) {
  if (!rooms || !rooms.length) {
    listEl.innerHTML = '<div style="text-align:center;color:#94A3B8;padding:30px 16px"><div style="font-size:36px;margin-bottom:10px">💬</div><div style="font-size:13px;font-weight:600">Xonalar yo\'q</div><div style="font-size:12px;margin-top:4px">Yangi xona yarating</div></div>';
    return;
  }
  // Cache rooms by id so onclick only passes the id (no string injection risk)
  rooms.forEach(function(r) { _chatRoomCache[r.id] = r; });

  listEl.innerHTML = rooms.map(function(r) {
    var last = r.last_msg ? r.last_msg.slice(0,38) + (r.last_msg.length>38?'…':'') : '<i>Hali xabar yo\'q</i>';
    var t = r.last_at ? _chatTime(r.last_at) : '';
    var initials = r.name.substring(0,2).toUpperCase();
    var color = _roomColor(r.id);
    var typeIcon = r.type === 'announce' ? '📢' : r.type === 'direct' ? '👤' : '👥';
    // Safe: only pass numeric id — room name stays in cache, never embedded in JS string
    return '<div class="chat-room-item" onclick="openChatRoomById('+r.id+')">'
      + '<div class="chat-room-avatar" style="background:'+color+';color:#fff">'+initials+'</div>'
      + '<div class="chat-room-info">'
      +   '<div class="chat-room-name">'+typeIcon+' '+escHtml(r.name)+'</div>'
      +   '<div class="chat-room-last">'+last+'</div>'
      + '</div>'
      + (t ? '<div style="font-size:10px;color:#CBD5E1;flex-shrink:0">'+t+'</div>' : '')
      + '</div>';
  }).join('');
}

function _chatTime(iso) {
  var d = new Date(iso), now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
  var diff = Math.floor((now-d)/86400000);
  if (diff === 1) return 'Kecha';
  if (diff < 7) return ['Yak','Du','Se','Cho','Pay','Ju','Sha'][d.getDay()];
  return d.toLocaleDateString([],{day:'numeric',month:'short'});
}

function filterChatRooms(q) {
  var listEl = document.getElementById('chatRoomList');
  if (!listEl || !listEl._allRooms) return;
  var filtered = q ? listEl._allRooms.filter(function(r){ return r.name.toLowerCase().includes(q.toLowerCase()); }) : listEl._allRooms;
  _renderRoomList(filtered, listEl);
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

function _msgHtml(m, myId) {
  var isMe = m.sender_id === myId;
  var t = new Date(m.created_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
  var init = (m.sender_name||'?').charAt(0).toUpperCase();
  return '<div class="chat-msg-wrap' + (isMe?' me':'') + '">'
    + '<div class="chat-msg-avatar" style="background:' + (isMe?'linear-gradient(135deg,#1B4FD8,#3B82F6)':'#E2E8F0') + ';color:' + (isMe?'#fff':'#475569') + '">' + init + '</div>'
    + '<div class="chat-msg-body">'
    +   (isMe?'':'<div class="chat-msg-name">'+escHtml(m.sender_name||'')+'</div>')
    +   '<div class="chat-bubble ' + (isMe?'me':'other') + '">'+escHtml(m.content)+'</div>'
    +   '<div class="chat-bubble-time">'+t+'</div>'
    + '</div></div>';
}

function renderMessages(msgs, el) {
  if (!el) return;
  var myId = window.CURRENT_USER ? window.CURRENT_USER.id : null;
  if (!msgs.length) {
    el.innerHTML = '<div style="text-align:center;color:#94A3B8;padding:30px 16px"><div style="font-size:32px;margin-bottom:10px">💬</div><div style="font-size:13px;font-weight:600">Hali xabar yo\'q</div><div style="font-size:12px;margin-top:4px">Birinchi bo\'lib xabar yozing!</div></div>';
    return;
  }
  el.innerHTML = msgs.map(function(m){ return _msgHtml(m, myId); }).join('');
  el.scrollTop = el.scrollHeight;
}

function appendMessage(m) {
  var el = document.getElementById('chatMsgList');
  if (!el) return;
  if (el.querySelector('.chat-msg-body') === null && el.innerHTML.includes('Hali xabar')) el.innerHTML = '';
  var myId = window.CURRENT_USER ? window.CURRENT_USER.id : null;
  var div = document.createElement('div');
  div.innerHTML = _msgHtml(m, myId);
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
