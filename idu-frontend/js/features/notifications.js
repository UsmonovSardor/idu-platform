'use strict';
// IDU Platform — features/notifications.js

function renderNotifications(){
  const el=document.getElementById('notifList');if(!el)return;
  el.innerHTML=NOTIFS.map(n=>`
    <div class="notif-item">
      <div class="notif-icon-wrap" style="background:${n.color}">${n.icon}</div>
      <div style="flex:1">
        <div class="notif-text"><span class="${n.unread?'notif-unread':''}">${n.title}</span> â ${n.text}</div>
        <div class="notif-time">${n.time}</div>
      </div>
    </div>`).join('');
}

function markAllRead(){
  NOTIFS.forEach(n=>n.unread=false);
  document.getElementById('notifCount').style.display='none';
  renderNotifications();
  showToast('â','O\'qildi','Barcha bildirishnomalar o\'qildi');
}