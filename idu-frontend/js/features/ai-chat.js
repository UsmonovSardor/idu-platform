'use strict';
// IDU - features/ai-chat.js

async function sendAIMsg(){
  const inp=document.getElementById('aiInput');
  const txt=inp?.value.trim();if(!txt)return;
  inp.value='';
  appendMsg('user',txt);
  document.getElementById('aiSendBtn').disabled=true;
  appendMsg('ai','...');
  try {
    const data = await api('POST', '/ai/chat', { message: txt });
    const lastMsg = document.querySelector('#aiMessages .msg-ai:last-child');
    if(lastMsg) lastMsg.querySelector('.msg-text') ? lastMsg.querySelector('.msg-text').textContent = data.reply : lastMsg.textContent = data.reply;
    else appendMsg('ai', data.reply || 'Javob kelmadi');
  } catch(e) {
    const lastMsg = document.querySelector('#aiMessages .msg-ai:last-child');
  
   if(lastMsg) lastMsg.textContent = "Xatolik yuz berdi. Qayta urinib ko'ring.";
  }
  document.getElementById('aiSendBtn').disabled=false;
}

function askAI(q){document.getElementById('aiInput').value=q;sendAIMsg();}

function appendMsg(role,text){
  const mc=document.getElementById('aiMessages');if(!mc)return;
  const now=new Date().toLocaleTimeString('uz-UZ',{hour:'2-digit',minute:'2-digit'});
  const d=document.createElement('div');
  d.className=`chat-bubble-wrap ${role}`;
  d.innerHTML=`<div class="bubble-avatar ba-${role}">${role==='ai'?'🤖':(currentUser?.name||'?').split(' ').map(x=>x[0]).join('').slice(0,2)}</div>
    <div class="bubble-body"><div class="bubble">${text.replace(/\n/g,'<br>').replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>')}</div>
    <div class="bubble-time">${now}</div></div>`;
  mc.appendChild(d);
  mc.scrollTop=mc.scrollHeight;
}