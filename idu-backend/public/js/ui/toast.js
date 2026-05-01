'use strict';
// IDU - ui/toast.js

function showSecurityToast(msg) {
  showToast('🔒', 'Xavfsizlik', msg);
}

function showToast(icon,title,msg){
  const tc=document.getElementById('toastContainer');
  const t=document.createElement('div');
  t.className='toast-item';
  t.innerHTML=`<div class="toast-item-icon">${icon}</div>
    <div class="toast-item-body">
      <div class="toast-item-title">${title}</div>
      <div class="toast-item-msg">${msg}</div>
    </div>
    <button class="toast-item-close" onclick="this.parentElement.remove()">✕</button>
    <div class="toast-item-bar"></div>`;
  tc.appendChild(t);
  setTimeout(()=>t.classList.add('show'),10);
  setTimeout(()=>{t.classList.remove('show');setTimeout(()=>t.remove(),400);},5000);
}

function showVideoToast(){
  showToast('video','Video','Tez kunda qoshiladi!','blue');
}