'use strict';
// ==============================================
//  IDU Platform — ui/toast.js
//  Bildirishnoma (toast) tizimi
// ==============================================

function showToast(icon,title,msg){
  const tc=document.getElementById('toastContainer');
  const t=document.createElement('div');
  t.className='toast-item';
  t.innerHTML=`<div class="toast-item-icon">${icon}</div>
    <div class="toast-item-body">
      <div class="toast-item-title">${title}</div>
      <div class="toast-item-msg">${msg}</div>
    </div>
    <button class="toast-item-close" onclick="this.parentElement.remove()">â</button>
    <div class="toast-item-bar"></div>`;
  tc.appendChild(t);
  setTimeout(()=>t.classList.add('show'),10);
  setTimeout(()=>{t.classList.remove('show');setTimeout(()=>t.remove(),400);},5000);
}

function showSecurityToast(msg) {
  showToast('ð', 'Xavfsizlik', msg);
}

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

function showVideoToast(){
  showToast('video','Video','Tez kunda qoshiladi!','blue');
}
