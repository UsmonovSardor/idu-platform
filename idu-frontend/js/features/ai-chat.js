'use strict';
// IDU - features/ai-chat.js

async function sendAIMsg(){
  const inp=document.getElementById('aiInput');
  const txt=inp?.value.trim();if(!txt)return;
  inp.value='';
  appendMsg('user',txt);
  const btn=document.getElementById('aiSendBtn');
  if(btn) btn.disabled=true;

  // Add placeholder bubble with typing indicator (returns the element so we can update it)
  const placeholder=appendMsg('ai','<span class="ai-typing"><span></span><span></span><span></span></span>',true);
  try {
    const data = await api('POST', '/ai/chat', { message: txt });
    const reply = (data && data.reply) || 'Javob kelmadi';
    // Replace placeholder bubble content with real reply
    if (placeholder) {
      const bubble = placeholder.querySelector('.bubble');
      if (bubble) {
        bubble.innerHTML = String(reply)
          .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
          .replace(/\n/g,'<br>')
          .replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>');
      } else {
        placeholder.textContent = reply;
      }
    }
  } catch(e) {
    if (placeholder) {
      const bubble = placeholder.querySelector('.bubble');
      if (bubble) bubble.innerHTML = "⚠️ Xatolik yuz berdi. Qayta urinib ko'ring.";
      else placeholder.textContent = "⚠️ Xatolik yuz berdi. Qayta urinib ko'ring.";
    }
  } finally {
    if(btn) btn.disabled=false;
    if(inp) inp.focus();
  }
}

function askAI(q){document.getElementById('aiInput').value=q;sendAIMsg();}

function appendMsg(role,text,rawHtml){
  const mc=document.getElementById('aiMessages');if(!mc)return null;
  const now=new Date().toLocaleTimeString('uz-UZ',{hour:'2-digit',minute:'2-digit'});
  const d=document.createElement('div');
  d.className=`chat-bubble-wrap ${role}`;
  const body = rawHtml
    ? text
    : String(text).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
        .replace(/\n/g,'<br>').replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>');
  d.innerHTML=`<div class="bubble-avatar ba-${role}">${role==='ai'?'🤖':(currentUser?.name||'?').split(' ').map(x=>x[0]).join('').slice(0,2)}</div>
    <div class="bubble-body"><div class="bubble">${body}</div>
    <div class="bubble-time">${now}</div></div>`;
  mc.appendChild(d);
  mc.scrollTop=mc.scrollHeight;
  return d;
}