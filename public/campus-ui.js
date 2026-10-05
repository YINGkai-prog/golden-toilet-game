(()=>{'use strict';
window.CampusUI=class{
 constructor({send,me,now,office}){Object.assign(this,{send,me,now,office});this.messages=[];
  const el=document.createElement('section');el.className='public-chat';el.setAttribute('aria-label','全公司公頻');el.innerHTML='<div class="chat-head"><b>◌ 公司公頻</b><small>ALL HANDS / LIVE</small><button id="chatToggle" aria-expanded="true" aria-label="收合聊天室">−</button></div><div class="chat-log" role="log" aria-live="polite" aria-relevant="additions" aria-label="公頻訊息"></div><form id="chatForm"><label class="sr-only" for="chatInput">公頻訊息，最多 120 字</label><input id="chatInput" maxlength="240" autocomplete="off" placeholder="一起蓋馬桶，也一起嘴兩句…"><button type="submit" aria-label="送出公頻訊息">↗</button></form><div class="chat-presets"></div>';
  document.querySelector('.scene-area').append(el);this.el=el;this.log=el.querySelector('.chat-log');this.input=el.querySelector('input');this.input.disabled=true;
  const presets=['👏','😂','🚽','☕','⚽','🏐','我回去蓋馬桶了','只改一點點','救命！AI 快交稿了'];for(const text of presets){const b=document.createElement('button');b.type='button';b.textContent=text;b.setAttribute('aria-label','公頻：'+text);b.onclick=()=>send('chat.send',{text});el.querySelector('.chat-presets').append(b);}
  el.querySelector('form').onsubmit=e=>{e.preventDefault();const text=this.input.value.trim();if(text){send('chat.send',{text});this.input.value='';}};
  el.querySelector('#chatToggle').onclick=e=>{const closed=el.classList.toggle('compact');e.currentTarget.setAttribute('aria-expanded',!closed);e.currentTarget.textContent=closed?'+':'−';};
  this.effects=document.createElement('div');this.effects.className='campus-effects';this.effects.setAttribute('aria-live','polite');document.querySelector('.scene-area').append(this.effects);
  this.status=document.createElement('div');this.status.className='personal-status';document.querySelector('.scene-area').append(this.status);
  const goal=document.createElement('div');goal.className='main-goal';goal.innerHTML='<b>🚽 今晚的正事：一起蓋馬桶</b><span>1 處 × 2 處 × AI ／ 共創 → 評選 → 海報 → 上市</span>';document.querySelector('.scene-area').append(goal);
  this.sport=document.createElement('button');this.sport.className='sport-hit hidden';document.querySelector('.scene-area').append(this.sport);this.sport.onclick=()=>this.hit();
  const active=()=>{if(this.me()&&now()-(this.lastActive||0)>3000){this.lastActive=now();send('input.active');}};
  for(const event of['pointerdown','keydown','wheel','pointermove'])document.addEventListener(event,e=>{if(e.isTrusted)active();},{passive:true});
  document.addEventListener('keydown',e=>{if(e.code==='Space'&&!e.repeat&&!/INPUT|TEXTAREA|SELECT|BUTTON/.test(e.target.tagName)&&['pool','courtyard'].includes(this.me()?.motion?.room)){e.preventDefault();this.hit();}});
  setInterval(()=>this.updateStatus(),250);
 }
 hit(){const p=this.me();if(p)this.send('sports.hit',{game:p.motion?.room==='pool'?'volley':'football'});}
 state(s,host=false){this.s=s;this.input.disabled=!host&&!this.me();this.el.querySelectorAll('.chat-presets button,form button').forEach(b=>b.disabled=this.input.disabled);
  if(this.gameId!==s.gameId){this.gameId=s.gameId;this.messages=[];this.log.replaceChildren();}
  for(const m of s.campus?.chat||[])this.message(m);this.updateStatus();
 }
 event(m){if(!m)return;const e=document.createElement('div');e.textContent=m.text;this.effects.append(e);while(this.effects.children.length>3)this.effects.firstChild.remove();setTimeout(()=>e.remove(),4500);}
 message(m){if(!m||m.kind==='event')return;if(this.messages.some(x=>x.id===m.id))return;this.messages.push(m);if(this.messages.length>60){this.messages.shift();this.log.firstChild?.remove();}
  const nearBottom=this.log.scrollHeight-this.log.scrollTop-this.log.clientHeight<50,line=document.createElement('div');line.className='chat-message '+(m.kind==='event'?'event':'');const author=document.createElement('b'),body=document.createElement('span');author.textContent=m.name+' ';body.textContent=m.text;line.append(author,body);line.title=new Date(m.at).toLocaleTimeString();this.log.append(line);if(nearBottom)this.log.scrollTop=this.log.scrollHeight;
 }
 updateStatus(){const p=this.me();this.sport.classList.toggle('hidden',!['pool','courtyard'].includes(p?.motion?.room));this.sport.textContent=p?.motion?.room==='pool'?'🏐 托球 / 空白鍵':'⚽ 射向對方球門 / 空白鍵';
  if(!p){this.status.hidden=true;return;}const ban=Math.max(0,Math.ceil(((p.indoorBanUntil||0)-this.now())/1000));this.status.hidden=false;const lock=p.distraction?.until>this.now()?`${p.distraction.label} · ${Math.ceil((p.distraction.until-this.now())/1000)} 秒後可離開`:'';const text=lock?lock:p.expelPending?'OMNI 正在趕過來！':ban?`OMNI 門禁 ${Math.floor(ban/60)}:${String(ban%60).padStart(2,'0')} · 可去泳池 / 公頻`:p.aiControlled?'◈ AI 代班中 · 點一下即可接回角色':'◉ 你身上的流光就是定位 · 30 秒無操作會 AI 代班';
  const key=text+'|'+p.aiControlled;if(this.statusKey!==key){this.statusKey=key;this.status.replaceChildren(document.createTextNode(text));if(p.aiControlled){const b=document.createElement('button');b.textContent='我回來了';b.onclick=()=>this.send('input.active');this.status.append(b);}}
 }
};})();
