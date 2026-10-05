(()=>{'use strict';
window.WorkBroadcast=class{
 constructor(office){this.office=office;this.visible=true;this.el=document.createElement('nav');this.el.className='projection-controls';this.el.setAttribute('aria-label','三組完整作品直播');
  this.el.innerHTML=['A','B','C'].map((t,i)=>'<button data-screen="'+t+'" aria-label="平視第 '+(i+1)+' 組完整作品頁">'+(i+1)+' '+(t==='C'?'AI':i===0?'一處':'二處')+'<small data-live-count="'+t+'">0 BLOCKS</small></button>').join('');document.querySelector('.scene-area').append(this.el);this.el.onclick=e=>{const b=e.target.closest('[data-screen]');if(b){office?.focusScreen(b.dataset.screen);this.el.querySelectorAll('button').forEach(v=>v.classList.toggle('active',v===b));}};
 }
 toggle(builds,on){this.setBuilds(builds);if(on===false)this.office?.home();else this.office?.focusScreen();return true;}
 setBuilds(builds){this.builds=builds;this.office?.projection(builds);for(const t of['A','B','C'])this.el.querySelector('[data-live-count="'+t+'"]').textContent=Object.keys(builds[t]||{}).length+' BLOCKS';}
 ops(m,builds){this.setBuilds(builds);}
 state(s){this.office?.projection(null,s);}
 fx(m,s){if(this.office&&['sticker','banner','visit'].includes(m.kind)){const p=this.office.pages.find(p=>p.team===m.team);if(p){p.comment=(s.players.find(p=>p.id===m.by)?.name||'主管')+'：'+(m.text||'老闆巡視中');this.office.pageDirty=true;}}}
};})();