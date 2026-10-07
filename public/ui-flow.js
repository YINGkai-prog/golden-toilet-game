/* Notifications have their own reserved row. They never share a game's hit area. */
(()=>{'use strict';
 const rail=document.createElement('aside');rail.className='feedback-rail';rail.setAttribute('aria-label','階段廣播與操作訊息');
 rail.innerHTML='<div class="broadcast-slot"></div><div class="phase-slot"></div><div class="feedback-line"><span class="feedback-text" role="status" aria-live="polite">公司即時動態 · 操作結果會顯示在這裡</span><button class="urgent-shortcut" hidden>前往廁所 →</button></div>';
 document.querySelector('.masthead').after(rail);
 const text=rail.querySelector('.feedback-text'),urgent=rail.querySelector('.urgent-shortcut');let ownUntil=0,lastEvent='',active=null;
 window.UIFlow={
  rail,
  notice(message,personal=false){if(personal){ownUntil=Date.now()+3500;}else{lastEvent=message;if(Date.now()<ownUntil)return;}text.textContent=message;text.title=message;},
  broadcast(node){rail.querySelector('.broadcast-slot').append(node);},
  phase(node){rail.querySelector('.phase-slot').append(node);},
  mount(node){document.querySelector('.scene-area').append(node);node.classList.add('activity-panel');},
  open(node){if(active&&active!==node)active.dispatchEvent(new Event('interaction-close'));active=node;node.hidden=false;document.body.classList.add('activity-open');},
  close(node){node.hidden=true;if(active===node){active=null;document.body.classList.remove('activity-open');}},
  busy(node){return active&&active!==node&&!active.hidden;},
  urgent(on,action){urgent.hidden=!on;urgent.onclick=action;},
 };
 setInterval(()=>{if(ownUntil&&Date.now()>ownUntil){ownUntil=0;if(lastEvent){text.textContent=lastEvent;text.title=lastEvent;}}},500);
 U.toast=message=>UIFlow.notice(String(message),true);
 // Hover details must not float over a control after opening a game or a dialog.
 document.addEventListener('pointerdown',()=>document.querySelectorAll('.crew-tooltip').forEach(e=>e.hidden=true),true);
 document.addEventListener('click',e=>{if(active&&e.target.closest('#chatToggle,[data-action="expand"]'))active.dispatchEvent(new Event('interaction-close'));},true);
})();
