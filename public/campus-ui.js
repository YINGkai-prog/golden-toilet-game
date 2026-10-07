(()=>{'use strict';
window.CampusUI=class{
 constructor({send,me,now,office}){Object.assign(this,{send,me,now,office});this.messages=[];
  const el=document.createElement('section');el.className='public-chat';el.setAttribute('aria-label','全公司公頻');el.innerHTML='<div class="chat-head"><b>◌ 公司公頻</b><small>ALL HANDS / LIVE</small><button id="chatToggle" aria-expanded="true" aria-label="收合聊天室">−</button></div><div class="chat-log" role="log" aria-live="polite" aria-relevant="additions" aria-label="公頻訊息"></div><form id="chatForm"><label class="sr-only" for="chatInput">公頻訊息，最多 120 字</label><input id="chatInput" maxlength="240" autocomplete="off" placeholder="一起蓋馬桶，也一起嘴兩句…"><button type="submit" aria-label="送出公頻訊息">↗</button></form><div class="chat-presets"></div>';
  document.querySelector('.scene-area').append(el);this.el=el;this.log=el.querySelector('.chat-log');this.input=el.querySelector('input');this.input.disabled=true;
  this.presetRound=0;this.presetCategory='room';this.presetRoot=el.querySelector('.chat-presets');
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
 refreshPresets(host){const p=this.me(),sig=[p?.id,p?.motion?.room,p?.rank,this.presetRound,this.presetCategory,host].join('|');if(sig===this.presetSig)return;this.presetSig=sig;const root=this.presetRoot;root.replaceChildren();const controls=document.createElement('div');controls.className='preset-controls';for(const [key,label]of[['room','這個地方'],['rank','我的職位'],['all','全公司']]){const b=document.createElement('button');b.textContent=label;b.classList.toggle('active',this.presetCategory===key);b.onclick=()=>{this.presetCategory=key;this.refreshPresets(host);};controls.append(b);}const shuffle=document.createElement('button');shuffle.textContent='↻ 換一批';shuffle.onclick=()=>{this.presetRound++;this.refreshPresets(host);};controls.append(shuffle);root.append(controls);const options=OfficeParty.pack({id:p?.id||'host',joinIdx:p?.joinIdx||0,room:p?.motion?.room,rank:p?.rank,round:this.presetRound,category:this.presetCategory});for(const text of options){const b=document.createElement('button');b.className='preset-message';b.textContent=text;b.title=text;b.disabled=!host&&!p;b.onclick=()=>this.send('chat.send',{text});root.append(b);}const emoji=document.createElement('div');emoji.className='preset-emoji';for(const text of['👏','😂','🚽','☕','⚽','🏐','🫠','🙏','💩','🔥','💸','🦆']){const b=document.createElement('button');b.textContent=text;b.disabled=!host&&!p;b.onclick=()=>this.send('chat.send',{text});emoji.append(b);}root.append(emoji);}
 hit(){const p=this.me();if(p)this.send('sports.hit',{game:p.motion?.room==='pool'?'volley':'football'});}
 state(s,host=false){this.s=s;this.refreshPresets(host);this.input.disabled=!host&&!this.me();this.el.querySelectorAll('.chat-presets button,form button').forEach(b=>b.disabled=this.input.disabled);
  if(this.gameId!==s.gameId){this.gameId=s.gameId;this.messages=[];this.log.replaceChildren();}
  for(const m of s.campus?.chat||[])this.message(m);this.updateStatus();
 }
 event(m){if(m?.text)UIFlow.notice(m.text);}
 message(m){if(!m||m.kind==='event')return;if(this.messages.some(x=>x.id===m.id))return;this.messages.push(m);if(this.messages.length>60){this.messages.shift();this.log.firstChild?.remove();}
  const nearBottom=this.log.scrollHeight-this.log.scrollTop-this.log.clientHeight<50,line=document.createElement('div');line.className='chat-message '+(m.kind==='event'?'event':'');const author=document.createElement('b'),body=document.createElement('span');line.dataset.rank=['boss','board','lead','manager','chief','host'].includes(m.rank)?m.rank:'staff';author.textContent=(m.bot?'AI · ':'')+m.name+' '+(GAME.RANKS[m.rank]?.name||'主持')+' ';body.textContent=m.text;line.append(author,body);line.title=new Date(m.at).toLocaleTimeString();this.log.append(line);if(nearBottom)this.log.scrollTop=this.log.scrollHeight;
 }
 updateStatus(){const p=this.me();this.sport.classList.toggle('hidden',!['pool','courtyard'].includes(p?.motion?.room));this.sport.textContent=p?.motion?.room==='pool'?'🏐 托球 / 空白鍵':'⚽ 射向對方球門 / 空白鍵';
  if(!p){this.status.hidden=true;return;}const ban=Math.max(0,Math.ceil(((p.indoorBanUntil||0)-this.now())/1000));this.status.hidden=false;const lock=p.distraction?.until>this.now()?`${p.distraction.label} · ${Math.ceil((p.distraction.until-this.now())/1000)} 秒後可離開`:'';const text=lock?lock:p.expelPending?'OMNI 正在趕過來！':ban?`OMNI 門禁 ${Math.floor(ban/60)}:${String(ban%60).padStart(2,'0')} · 可去泳池 / 公頻`:p.aiControlled?'◈ AI 代班中 · 點一下即可接回角色':'◉ 你身上的流光就是定位 · 30 秒無操作會 AI 代班';
  const key=text+'|'+p.aiControlled;if(this.statusKey!==key){this.statusKey=key;this.status.replaceChildren(document.createTextNode(text));if(p.aiControlled){const b=document.createElement('button');b.textContent='我回來了';b.onclick=()=>this.send('input.active');this.status.append(b);}}
 }
};})();
