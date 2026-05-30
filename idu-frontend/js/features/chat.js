'use strict';
// IDU — Chat module (socket.io real-time + SSE fallback)

var _chatRoomId   = null;
var _chatEventSrc = null;   // SSE fallback
var _chatSocket   = null;   // socket.io connection (preferred)
var _chatPage     = 1;
var _typingTimer  = null;
var _replyTo      = null;   // {id, name, text} when composing a reply
var _editing      = null;   // {id} when editing a message
var _chatMsgs     = [];     // last-rendered messages cache (for edit prefill, read ticks)
var _lastMaxMsgId = 0;      // highest message id seen in current room

// ── Inject premium chat CSS once ────────────────────────────────────────────
function _chatInjectStyles() {
  if (document.getElementById('chatPremStyles')) return;
  var css = ''
    + '.chat-msg-wrap{position:relative}'
    + '.chat-bubble{position:relative}'
    + '.chat-bubble-txt{white-space:pre-wrap;word-break:break-word}'
    + '.chat-bubble.deleted{font-style:italic;opacity:.6;background:#f1f5f9 !important;color:#94a3b8 !important}'
    + '.chat-reply-prev{border-left:3px solid #3B82F6;padding:3px 8px;margin:0 0 5px;background:rgba(59,130,246,.08);border-radius:6px;font-size:12px;display:flex;flex-direction:column;gap:1px;cursor:pointer}'
    + '.chat-bubble.me .chat-reply-prev{border-left-color:#fff;background:rgba(255,255,255,.18)}'
    + '.chat-reply-who{font-weight:800;font-size:11px}'
    + '.chat-reply-txt{opacity:.85;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
    + '.chat-att-img img{max-width:200px;max-height:220px;border-radius:10px;display:block;margin-bottom:4px}'
    + '.chat-att-file{display:inline-block;background:rgba(0,0,0,.06);padding:6px 10px;border-radius:8px;margin-bottom:4px;font-size:13px;text-decoration:none;color:inherit}'
    + '.chat-edited{font-size:10px;opacity:.6;margin-right:5px;font-style:italic}'
    + '.chat-ticks{font-size:11px;color:#94a3b8;margin-left:3px}'
    + '.chat-ticks.read{color:#2563eb;font-weight:800}'
    + '.chat-rx{display:flex;gap:4px;flex-wrap:wrap;margin-top:3px}'
    + '.chat-msg-wrap.me .chat-rx{justify-content:flex-end}'
    + '.chat-rx-chip{background:#eef2ff;border:1px solid #c7d2fe;border-radius:999px;padding:1px 8px;font-size:12px;cursor:pointer;user-select:none;transition:transform .1s}'
    + '.chat-rx-chip:active{transform:scale(.9)}'
    + '.chat-rx-chip.mine{background:#dbeafe;border-color:#3b82f6;font-weight:700}'
    + '.chat-acts{position:absolute;top:-14px;'
    + ('') + 'display:none;gap:1px;background:#fff;border:1px solid #e2e8f0;border-radius:10px;box-shadow:0 4px 14px rgba(0,0,0,.12);padding:2px;z-index:5}'
    + '.chat-msg-wrap.me .chat-acts{left:-6px}'
    + '.chat-msg-wrap:not(.me) .chat-acts{right:-6px}'
    + '.chat-bubble:hover .chat-acts{display:flex}'
    + '.chat-acts button{border:none;background:transparent;cursor:pointer;font-size:14px;padding:3px 5px;border-radius:7px;line-height:1}'
    + '.chat-acts button:hover{background:#f1f5f9}'
    + '.chat-react-pop{position:fixed;background:#fff;border:1px solid #e2e8f0;border-radius:999px;box-shadow:0 8px 24px rgba(0,0,0,.16);padding:5px 8px;display:flex;gap:4px;z-index:9999}'
    + '.chat-react-pop span{font-size:20px;cursor:pointer;transition:transform .12s}'
    + '.chat-react-pop span:hover{transform:scale(1.35)}'
    + '.chat-reply-bar{display:flex;align-items:center;gap:8px;padding:6px 12px;background:#f1f5f9;border-top:1px solid #e2e8f0;font-size:12px}'
    + '.chat-reply-bar .crb-x{margin-left:auto;cursor:pointer;font-size:16px;color:#94a3b8}'
    + '.chat-reply-bar .crb-txt{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
    + '.chat-presence{font-size:11px;font-weight:600}'
    + '.chat-presence.online{color:#16a34a}';
  var s = document.createElement('style');
  s.id = 'chatPremStyles'; s.textContent = css;
  document.head.appendChild(s);
}

// ── Connection status indicator (top-right floating pill) ────────────────────
function _showConnIndicator(text, color) {
  var el = document.getElementById('chatConnIndicator');
  if (!el) {
    el = document.createElement('div');
    el.id = 'chatConnIndicator';
    el.style.cssText = 'position:fixed;top:74px;right:20px;z-index:9000;padding:8px 16px;border-radius:24px;font-size:12px;font-weight:700;color:#fff;background:#f59e0b;box-shadow:0 6px 20px rgba(0,0,0,0.18);transition:opacity 0.3s,transform 0.3s;font-family:"Outfit",sans-serif';
    document.body.appendChild(el);
  }
  el.style.background = color || '#f59e0b';
  el.textContent = text;
  el.style.opacity = '1';
  el.style.transform = 'translateY(0)';
}
function _hideConnIndicator() {
  var el = document.getElementById('chatConnIndicator');
  if (!el) return;
  el.style.opacity = '0';
  el.style.transform = 'translateY(-8px)';
}

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
  _replyTo = null; _editing = null; _chatMsgs = []; _lastMaxMsgId = 0; _chatPeerId = null;
  if (typeof _renderComposeBar === 'function') _renderComposeBar();
  document.getElementById('chatRoomView').style.display = 'none';
  document.getElementById('chatMsgView').style.display  = 'flex';
  document.getElementById('chatRoomNameEl').textContent = roomName;
  var meta = document.getElementById('chatRoomMeta');
  if (meta) meta.textContent = roomType === 'announce' ? '📢 E\'lonlar kanali' : roomType === 'direct' ? '👤 Shaxsiy' : '👥 Guruh chat';
  document.getElementById('chatMsgList').innerHTML = '<div style="text-align:center;color:#94A3B8;padding:30px;font-size:13px"><div style="font-size:24px;margin-bottom:8px">⏳</div>Yuklanmoqda...</div>';
  await loadMessages(roomId);
  subscribeRealtime(roomId);
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
  _disconnectRealtime();
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

// Quick-reaction palette
var _chatEmojis = ['👍','❤️','😂','🔥','👏','😮'];

function _reactionsHtml(m) {
  var rx = m.reactions || [];
  if (!rx.length) return '';
  return '<div class="chat-rx">' + rx.map(function(r){
    var mine = r.mine ? ' mine' : '';
    return '<span class="chat-rx-chip'+mine+'" onclick="toggleReaction('+m.id+',\''+r.emoji+'\')">'+r.emoji+' '+(r.count||r.cnt||0)+'</span>';
  }).join('') + '</div>';
}

function _attachmentHtml(m) {
  if (!m.attachment_url) return '';
  var url = escHtml(m.attachment_url);
  if (m.attachment_type === 'image') {
    return '<a class="chat-att-img" href="'+url+'" target="_blank" rel="noopener"><img src="'+url+'" alt="rasm" loading="lazy"></a>';
  }
  return '<a class="chat-att-file" href="'+url+'" target="_blank" rel="noopener">📎 '+escHtml(m.attachment_name||'Fayl')+'</a>';
}

function _msgHtml(m, myId) {
  if (m.is_deleted) {
    return '<div class="chat-msg-wrap'+(m.sender_id===myId?' me':'')+'" data-mid="'+m.id+'">'
      + '<div class="chat-msg-avatar" style="background:#E2E8F0;color:#94A3B8">🗑</div>'
      + '<div class="chat-msg-body"><div class="chat-bubble deleted">🚫 Xabar o\'chirilgan</div></div></div>';
  }
  var isMe = m.sender_id === myId;
  var t = new Date(m.created_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
  var init = (m.sender_name||'?').charAt(0).toUpperCase();
  var isStaff = window.CURRENT_USER && ['teacher','dekanat','admin'].indexOf(window.CURRENT_USER.role) >= 0;

  // Reply preview block
  var reply = '';
  if (m.reply_to_id && (m.reply_sender_name || m.reply_content)) {
    reply = '<div class="chat-reply-prev">'
      + '<span class="chat-reply-who">'+escHtml(m.reply_sender_name||'')+'</span>'
      + '<span class="chat-reply-txt">'+escHtml((m.reply_content||'').slice(0,80)||'📎 ilova')+'</span></div>';
  }

  // Edited tag + read ticks
  var edited = m.edited_at ? '<span class="chat-edited">tahrirlangan</span>' : '';
  var ticks = '';
  if (isMe) ticks = '<span class="chat-ticks'+(m._read?' read':'')+'" data-mid="'+m.id+'">'+(m._read?'✓✓':'✓')+'</span>';

  // Hover action bar
  var act = '<div class="chat-acts">'
    + '<button title="Reaksiya" onclick="openReactPicker('+m.id+',this)">😊</button>'
    + '<button title="Javob" onclick="startReply('+m.id+')">↩</button>'
    + (isMe ? '<button title="Tahrir" onclick="startEdit('+m.id+')">✏️</button>' : '')
    + ((isMe||isStaff) ? '<button title="O\'chirish" onclick="deleteMessage('+m.id+')">🗑</button>' : '')
    + '</div>';

  return '<div class="chat-msg-wrap' + (isMe?' me':'') + '" data-mid="'+m.id+'">'
    + '<div class="chat-msg-avatar" style="background:' + (isMe?'linear-gradient(135deg,#1B4FD8,#3B82F6)':'#E2E8F0') + ';color:' + (isMe?'#fff':'#475569') + '">' + init + '</div>'
    + '<div class="chat-msg-body">'
    +   (isMe?'':'<div class="chat-msg-name">'+escHtml(m.sender_name||'')+'</div>')
    +   '<div class="chat-bubble ' + (isMe?'me':'other') + '">'
    +     reply + _attachmentHtml(m)
    +     (m.content?'<span class="chat-bubble-txt">'+escHtml(m.content)+'</span>':'')
    +     act
    +   '</div>'
    +   '<div class="chat-bubble-time">'+edited+t+' '+ticks+'</div>'
    +   _reactionsHtml(m)
    + '</div></div>';
}

function renderMessages(msgs, el) {
  if (!el) return;
  _chatInjectStyles();
  var myId = window.CURRENT_USER ? window.CURRENT_USER.id : null;
  _chatMsgs = msgs || [];
  if (!msgs.length) {
    el.innerHTML = '<div style="text-align:center;color:#94A3B8;padding:30px 16px"><div style="font-size:32px;margin-bottom:10px">💬</div><div style="font-size:13px;font-weight:600">Hali xabar yo\'q</div><div style="font-size:12px;margin-top:4px">Birinchi bo\'lib xabar yozing!</div></div>';
    return;
  }
  el.innerHTML = msgs.map(function(m){ return _msgHtml(m, myId); }).join('');
  el.scrollTop = el.scrollHeight;
  msgs.forEach(function(m){ if (m.id > _lastMaxMsgId) _lastMaxMsgId = m.id; });
  _markRoomRead();
}

function appendMessage(m) {
  var el = document.getElementById('chatMsgList');
  if (!el) return;
  if (el.querySelector('.chat-msg-body') === null && el.innerHTML.includes('Hali xabar')) el.innerHTML = '';
  var myId = window.CURRENT_USER ? window.CURRENT_USER.id : null;
  var div = document.createElement('div');
  div.innerHTML = _msgHtml(m, myId);
  el.appendChild(div.firstChild);
  el.scrollTop = el.scrollHeight;
  _chatMsgs.push(m);
  if (m.id > _lastMaxMsgId) _lastMaxMsgId = m.id;
  // Mark read when an incoming (not mine) message arrives while room is open
  if (m.sender_id !== myId) _markRoomRead();
}

// ── Mark the open room as read up to the latest message ─────────────────────
function _markRoomRead() {
  if (!_chatRoomId || !_lastMaxMsgId) return;
  api('POST', '/messages/rooms/' + _chatRoomId + '/read', { message_id: _lastMaxMsgId }).catch(function(){});
}

// ── Reactions ───────────────────────────────────────────────────────────────
function openReactPicker(mid, btn) {
  var old = document.querySelector('.chat-react-pop'); if (old) old.remove();
  var pop = document.createElement('div');
  pop.className = 'chat-react-pop';
  pop.innerHTML = _chatEmojis.map(function(e){ return '<span onclick="toggleReaction('+mid+',\''+e+'\')">'+e+'</span>'; }).join('');
  document.body.appendChild(pop);
  var r = btn.getBoundingClientRect();
  pop.style.top  = Math.max(8, r.top - 46) + 'px';
  pop.style.left = Math.min(window.innerWidth - pop.offsetWidth - 8, r.left) + 'px';
  setTimeout(function(){
    document.addEventListener('click', function h(ev){ if (!pop.contains(ev.target)) { pop.remove(); document.removeEventListener('click', h); } });
  }, 10);
}

async function toggleReaction(mid, emoji) {
  var pop = document.querySelector('.chat-react-pop'); if (pop) pop.remove();
  try { await api('POST', '/messages/messages/' + mid + '/react', { emoji: emoji }); }
  catch(e) { showToast('❌','Chat','Reaksiya qo\'shilmadi'); }
}

function _applyReaction(mid, reactions) {
  var myId = window.CURRENT_USER ? window.CURRENT_USER.id : null;
  var m = _chatMsgs.find(function(x){ return x.id === mid; });
  if (m) {
    // server sends [{emoji,count}] aggregate; preserve "mine" from local toggle awareness
    var prevMine = {};
    (m.reactions||[]).forEach(function(r){ if (r.mine) prevMine[r.emoji] = true; });
    m.reactions = reactions.map(function(r){ return { emoji: r.emoji, count: r.count, mine: !!prevMine[r.emoji] }; });
  }
  var wrap = document.querySelector('.chat-msg-wrap[data-mid="'+mid+'"] .chat-msg-body');
  if (wrap && m) {
    var existing = wrap.querySelector('.chat-rx');
    var html = _reactionsHtml(m);
    if (existing) existing.outerHTML = html || '<div class="chat-rx"></div>';
    else if (html) wrap.insertAdjacentHTML('beforeend', html);
  }
}

// ── Reply ───────────────────────────────────────────────────────────────────
function startReply(mid) {
  var m = _chatMsgs.find(function(x){ return x.id === mid; });
  if (!m) return;
  _replyTo = { id: mid, name: m.sender_name || '', text: m.content || (m.attachment_url ? '📎 ilova' : '') };
  _editing = null;
  _renderComposeBar();
  var inp = document.getElementById('chatInput'); if (inp) inp.focus();
}
function cancelReply() { _replyTo = null; _editing = null; _renderComposeBar(); }

function _renderComposeBar() {
  var input = document.getElementById('chatInput');
  if (!input) return;
  var holder = document.getElementById('chatComposeBar');
  if (!holder) {
    holder = document.createElement('div');
    holder.id = 'chatComposeBar';
    input.parentNode.insertBefore(holder, input.parentNode.firstChild);
  }
  if (_editing) {
    holder.className = 'chat-reply-bar';
    holder.innerHTML = '<span>✏️</span><span class="crb-txt"><b>Tahrirlash</b></span><span class="crb-x" onclick="cancelReply()">×</span>';
    holder.style.display = 'flex';
  } else if (_replyTo) {
    holder.className = 'chat-reply-bar';
    holder.innerHTML = '<span>↩</span><span class="crb-txt"><b>'+escHtml(_replyTo.name)+'</b>: '+escHtml((_replyTo.text||'').slice(0,60))+'</span><span class="crb-x" onclick="cancelReply()">×</span>';
    holder.style.display = 'flex';
  } else {
    holder.style.display = 'none';
    holder.innerHTML = '';
  }
}

// ── Edit ────────────────────────────────────────────────────────────────────
function startEdit(mid) {
  var m = _chatMsgs.find(function(x){ return x.id === mid; });
  if (!m) return;
  _editing = { id: mid };
  _replyTo = null;
  var inp = document.getElementById('chatInput');
  if (inp) { inp.value = m.content || ''; inp.focus(); }
  _renderComposeBar();
}

// ── Delete ──────────────────────────────────────────────────────────────────
async function deleteMessage(mid) {
  if (!confirm('Xabarni o\'chirasizmi?')) return;
  try { await api('DELETE', '/messages/messages/' + mid); }
  catch(e) { showToast('❌','Chat','O\'chirib bo\'lmadi'); }
}

function _applyEdited(d) {
  var m = _chatMsgs.find(function(x){ return x.id === d.id; });
  if (m) { m.content = d.content; m.edited_at = d.edited_at; }
  var bub = document.querySelector('.chat-msg-wrap[data-mid="'+d.id+'"] .chat-bubble-txt');
  if (bub) bub.textContent = d.content;
  var tw = document.querySelector('.chat-msg-wrap[data-mid="'+d.id+'"] .chat-bubble-time');
  if (tw && !tw.querySelector('.chat-edited')) tw.insertAdjacentHTML('afterbegin', '<span class="chat-edited">tahrirlangan</span>');
}

function _applyDeleted(id) {
  var m = _chatMsgs.find(function(x){ return x.id === id; });
  if (m) m.is_deleted = true;
  var wrap = document.querySelector('.chat-msg-wrap[data-mid="'+id+'"]');
  var myId = window.CURRENT_USER ? window.CURRENT_USER.id : null;
  if (wrap && m) { var d = document.createElement('div'); d.innerHTML = _msgHtml(m, myId); wrap.replaceWith(d.firstChild); }
}

function _applyRead(data) {
  // Someone read up to data.message_id — mark my sent ticks as read
  var myId = window.CURRENT_USER ? window.CURRENT_USER.id : null;
  if (data.user_id === myId) return; // ignore my own read events
  document.querySelectorAll('.chat-ticks').forEach(function(t){
    var mid = parseInt(t.getAttribute('data-mid'), 10);
    if (data.message_id && mid <= data.message_id) { t.textContent = '✓✓'; t.classList.add('read'); }
  });
}

// ── Real-time subscription: socket.io first, SSE fallback ────────────────────
function subscribeRealtime(roomId) {
  // Disconnect previous subscriptions
  _disconnectRealtime();

  // 1. Try socket.io (preferred — works across instances)
  if (typeof io !== 'undefined') {
    _subscribeSocketIO(roomId);
  } else {
    // socket.io not loaded yet — try SSE
    _subscribeSSE(roomId);
  }
}

function _subscribeSocketIO(roomId) {
  var myId = window.CURRENT_USER ? window.CURRENT_USER.id : null;
  var token = window._apiToken || localStorage.getItem('idu_jwt') || '';
  // Derive WebSocket base from API_BASE so it works even when frontend
  // and backend are on different domains (e.g. captivating-growth + idu-platform)
  var _apiOrigin = (window.API_BASE || '').replace(/\/api.*$/, '').replace(/^http/, 'ws') ||
                   ((window.location.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + window.location.host);
  var wsBase = _apiOrigin;

  try {
    _chatSocket = io(wsBase, {
      auth:       { token: token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      timeout: 12000,
    });

    _chatSocket.on('connect', function() {
      _chatSocket.emit('join:room', roomId);
      _hideConnIndicator();
    });

    _chatSocket.on('chat:message', function(msg) {
      // Don't double-render our own messages (already appended on send)
      if (msg.room_id && msg.room_id !== roomId) return;
      if (msg.sender_id !== myId) appendMessage(msg);
    });

    _chatSocket.on('chat:typing', function(data) {
      _renderTypingIndicator(data);
    });

    // Premium real-time events
    _chatSocket.on('chat:edited',   function(d){ _applyEdited(d); });
    _chatSocket.on('chat:deleted',  function(d){ _applyDeleted(d.id); });
    _chatSocket.on('chat:reaction', function(d){ _applyReaction(d.message_id, d.reactions || []); });
    _chatSocket.on('chat:read',     function(d){ _applyRead(d); });
    _chatSocket.on('presence:update', function(d){ _applyPresence(d); });

    _chatSocket.on('disconnect', function(reason) {
      _showConnIndicator('🔄 Qayta ulanmoqda...', '#f59e0b');
    });
    _chatSocket.on('reconnect_attempt', function(n) {
      _showConnIndicator('🔄 Qayta ulanish (' + n + '-urinish)...', '#f59e0b');
    });
    _chatSocket.on('reconnect', function() {
      _showConnIndicator('✅ Qayta ulandi', '#16a34a');
      setTimeout(_hideConnIndicator, 2000);
      _chatSocket.emit('join:room', roomId);
    });

    _chatSocket.on('connect_error', function(err) {
      // After many failed attempts, fall back to SSE
      if (_chatSocket && _chatSocket.io && _chatSocket.io.reconnectionAttempts > 5) {
        _showConnIndicator('⚠️ SSE rejimiga o\'tildi', '#dc2626');
        _chatSocket.disconnect();
        _chatSocket = null;
        _subscribeSSE(roomId);
      }
    });
  } catch(e) {
    _subscribeSSE(roomId);
  }
}

function _subscribeSSE(roomId) {
  var myId  = window.CURRENT_USER ? window.CURRENT_USER.id : null;
  var token = window._apiToken || localStorage.getItem('idu_jwt') || '';
  var url   = (window.API_BASE || '/api') + '/messages/rooms/' + roomId + '/sse';
  try {
    _chatEventSrc = new EventSource(url + '?token=' + encodeURIComponent(token));
    _chatEventSrc.onmessage = function(e) {
      try {
        var payload = JSON.parse(e.data);
        if (payload.type === 'message' && payload.data) {
          if (payload.data.sender_id !== myId) appendMessage(payload.data);
        }
      } catch(err) {}
    };
  } catch(e) {}
}

function _disconnectRealtime() {
  if (_chatEventSrc) { _chatEventSrc.close(); _chatEventSrc = null; }
  if (_chatSocket)   { _chatSocket.disconnect(); _chatSocket = null; }
}

function _renderTypingIndicator(data) {
  var el = document.getElementById('chatTypingIndicator');
  if (!el) return;
  if (data.isTyping) {
    el.textContent = (data.userName || 'Kimdir') + ' yozmoqda...';
    el.style.display = 'block';
  } else {
    el.style.display = 'none';
  }
}

async function sendChatMessage() {
  if (!_chatRoomId) return;
  var inp = document.getElementById('chatInput');
  var content = inp ? inp.value.trim() : '';
  if (!content) return;

  // Edit mode → PATCH instead of new message
  if (_editing) {
    var mid = _editing.id;
    inp.value = ''; _editing = null; _renderComposeBar();
    try { await api('PATCH', '/messages/messages/' + mid, { content: content }); }
    catch(e) { showToast('❌','Chat','Tahrirlanmadi'); if (inp) inp.value = content; }
    return;
  }

  var replyId = _replyTo ? _replyTo.id : null;
  inp.value = '';
  inp.focus();
  _replyTo = null; _renderComposeBar();

  // Reply uses REST (socket handler doesn't carry reply_to yet); plain msg via socket
  if (!replyId && _chatSocket && _chatSocket.connected) {
    _chatSocket.emit('chat:message', { roomId: _chatRoomId, content }, function(ack) {
      if (ack && ack.ok && ack.message) appendMessage(ack.message);
      else if (ack && ack.error) { showToast('❌', 'Chat', ack.error); inp.value = content; }
    });
    return;
  }

  // REST API (also path for replies & attachments)
  try {
    var body = { content: content };
    if (replyId) body.reply_to_id = replyId;
    var msg = await api('POST', '/messages/rooms/' + _chatRoomId + '/messages', body);
    appendMessage(msg);
  } catch(e) {
    showToast('❌', 'Chat', e.message || 'Xabar yuborilmadi');
    if (inp) inp.value = content;
  }
}

// ── Presence (header for direct chats) ──────────────────────────────────────
var _chatPeerId = null; // other user's id in a direct room
function _applyPresence(d) {
  if (!_chatPeerId || d.userId !== _chatPeerId) return;
  _setPresenceHeader(d.online, d.last_seen);
}
function _setPresenceHeader(online, lastSeen) {
  var meta = document.getElementById('chatRoomMeta');
  if (!meta) return;
  if (online) { meta.innerHTML = '<span class="chat-presence online">● onlayn</span>'; }
  else if (lastSeen) { meta.innerHTML = '<span class="chat-presence">oxirgi: ' + _chatTime(lastSeen) + '</span>'; }
}

function chatInputKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendChatMessage();
    return;
  }
  // Typing indicator via socket
  if (_chatSocket && _chatSocket.connected && _chatRoomId) {
    _chatSocket.emit('chat:typing', { roomId: _chatRoomId, isTyping: true });
    clearTimeout(_typingTimer);
    _typingTimer = setTimeout(function() {
      if (_chatSocket) _chatSocket.emit('chat:typing', { roomId: _chatRoomId, isTyping: false });
    }, 2000);
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
