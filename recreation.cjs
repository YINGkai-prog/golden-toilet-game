'use strict';
const {randomBytes}=require('node:crypto');
module.exports=function({getGame,broadcast,changed,save,clock=Date.now}){
 const uid=()=>randomBytes(6).toString('hex'),active=()=>Object.values(getGame().players).filter(p=>!p.kicked);
 function state(){const g=getGame();return g.recreation||(g.recreation={football:{x:0,z:1,vx:0,vz:0,score:[0,0],resetAt:0,last:null},coffee:null});}
 function summary(){const s=state();return{...s,activities:active().filter(p=>p.mini||p.dancing).map(p=>({id:p.id,type:p.dancing?'dance':p.mini.type,score:p.mini?.score||0,expires:p.mini?.expires||0}))};}
 const err=(c,msg)=>c.reply({t:'err',msg});
 const round=(p,c)=>{const msg={t:'mini.round',round:p.mini};if(c)c.reply(msg);else broadcast(msg,c=>c.player?.id===p.id);};
 function handle(c,m){if(!['mini.start','mini.input','coffee.join','coffee.step','dance'].includes(m.t))return false;
  const p=c.player,now=clock();if(!p||p.kicked){err(c,'先報到，再開始摸魚。');return true;}
  const room=p.motion?.room;
  if(m.t.startsWith('coffee.')||m.t==='dance'){
   if(room!=='lounge'){err(c,'請先抵達茶水間');return true;}
   if(m.t==='dance'){p.dancing=!p.dancing;changed();return true;}
   let r=state().coffee;
   if(m.t==='coffee.join'){
    if(r&&now>=r.ends&&now<r.ends+8000){err(c,'本輪結果展示中，8 秒後可開始下一輪');return true;}
    if(!r||now>=r.ends){r=state().coffee={id:uid(),starts:now+3000,ends:now+33000,entries:{},winners:[],finished:false};}
    if(!r.entries[p.id])r.entries[p.id]={cups:0,step:0,ready:r.starts};
    c.reply({t:'toast',msg:'30 秒咖啡競賽：研磨 → 萃取 → 出杯。加班費另計。'});changed();save();return true;
   }
   const e=r?.entries[p.id];if(!e||m.round!==r.id||now<r.starts||now>=r.ends||e.forfeited){err(c,'咖啡競賽尚未開始或已結束');return true;}
   if(m.step!==e.step||now<e.ready)return true;
   e.step++;e.ready=now+(e.step===1?450:e.step===2?850:350);
   if(e.step===3){e.step=0;e.cups++;p.leisure.score+=5;}
   p.dancing=false;changed();save();return true;
  }
  if(room!=='arcade'){err(c,'請先抵達遊戲室');return true;}
  if(m.t==='mini.start'){
   if(!['darts','pinball'].includes(m.game)){err(c,'找不到這款遊戲');return true;}
   if(p.mini&&now<p.mini.expires){err(c,'這一局還没結束');return true;}
   p.leisure.round=null;p.mini={id:uid(),type:m.game,started:now,expires:now+(m.game==='darts'?30000:45000),ready:now+700,score:0,shots:0,seed:Math.random()*6.28,ball:{x:50,y:20,vx:24,vy:4},lives:3,left:0,right:0};round(p,c);changed();return true;
  }
  const r=p.mini;if(!r||m.round!==r.id||now>=r.expires||now<r.ready)return true;
  if(r.type==='darts'){
   if(m.action!=='throw'||r.shots>=10)return true;
   const t=(now-r.started)/1000,x=Math.sin(t*1.7+r.seed)*.85,y=Math.cos(t*2.3+r.seed)*.85,d=Math.hypot(x,y);
   const points=d<.14?50:d<.35?25:d<.65?10:d<1?5:0;r.last={x,y,points};r.score+=points;r.shots++;r.ready=now+650;p.leisure.score+=points;if(r.shots===10)r.expires=now;round(p,c);changed();save();
  }else if(['left','right'].includes(m.action)){r[m.action]=now+170;r.ready=now+80;}
  return true;
 }
 let previous=clock(),frameAt=0;
 function tick(){const now=clock(),dt=Math.min(.1,(now-previous)/1000);previous=now;const s=state(),ps=active();
  for(const p of ps){if(p.motion?.room!=='lounge')p.dancing=false;if(p.mini&&(p.motion?.room!=='arcade'||now>=p.mini.expires)){round(p);p.mini=null;changed();}const e=s.coffee?.entries[p.id];if(e&&!s.coffee.finished&&now<s.coffee.ends&&p.motion?.room!=='lounge')e.forfeited=true;}
  const r=s.coffee;if(r&&!r.finished&&now>=r.ends){r.finished=true;const eligible=Object.entries(r.entries).filter(([id,e])=>!e.forfeited&&ps.some(p=>p.id===id));const max=Math.max(0,...eligible.map(([,e])=>e.cups));r.winners=max?eligible.filter(([,e])=>e.cups===max).map(([id])=>id):[];broadcast({t:'toast',msg:r.winners.length?'咖啡賽結束！'+r.winners.map(id=>getGame().players[id].name).join('、')+'：'+max+' 杯，今晚精神獎！':'咖啡賽結束，大家都去忙正事了。'});changed();save();}
  const b=s.football;if(b.resetAt&&now>=b.resetAt){Object.assign(b,{x:0,z:1,vx:0,vz:0,resetAt:0});}
  if(!b.resetAt){
   b.x+=b.vx*dt;b.z+=b.vz*dt;b.vx*=Math.exp(-.5*dt);b.vz*=Math.exp(-.5*dt);
   if(Math.abs(b.x)>9){if(Math.abs(b.z-1)<2.6){b.score[b.x>0?0:1]++;b.resetAt=now+1600;b.vx=b.vz=0;broadcast({t:'toast',msg:'進球！這一腳比企劃進度還快。'});save();}else{b.x=Math.sign(b.x)*9;b.vx*=-.88;}}
   if(b.z< -6.7||b.z>8.7){b.z=Math.max(-6.7,Math.min(8.7,b.z));b.vz*=-.88;}
   for(const p of ps){const m=p.motion;if(!m||(!p.online&&!p.bot)||Math.hypot(m.x-b.x,m.z-b.z)>1.15||(p.lastKick&&now-p.lastKick<550))continue;const d=Math.hypot(b.x-m.x,b.z-m.z),dx=d>.05?(b.x-m.x)/d:(p.joinIdx%2?1:-1),dz=d>.05?(b.z-m.z)/d:.12;b.vx=dx*32;b.vz=dz*32;b.last=p.id;p.lastKick=now;b.x+=dx*.3;b.z+=dz*.3;}
  }
  for(const p of ps){const r=p.mini;if(!r||r.type!=='pinball')continue;const b=r.ball;
   // Small substeps keep fast balls from tunnelling through a bumper or flipper.
   for(let k=0;k<4;k++){const step=dt/4;b.vy+=55*step;b.x+=b.vx*step;b.y+=b.vy*step;
    if(b.x<5||b.x>95){b.x=Math.max(5,Math.min(95,b.x));b.vx*=-.94;}if(b.y<5){b.y=5;b.vy=Math.abs(b.vy);}
    for(const [x,y] of [[28,28],[72,28],[50,47]]){const dx=b.x-x,dy=b.y-y,d=Math.hypot(dx,dy);if(d<10){const nx=dx/(d||1),ny=dy/(d||1);b.x=x+nx*10.1;b.y=y+ny*10.1;b.vx=nx*48;b.vy=ny*48;r.score+=10;p.leisure.score+=10;}}
    if(b.y>78&&b.y<90&&b.vy>0&&((b.x<52&&r.left>now)||(b.x>=48&&r.right>now))){b.vy=-91;b.vx=b.x<50?29:-29;b.y=78;r.score+=2;p.leisure.score+=2;}
    if(b.y>103){r.lives--;if(r.lives<=0){r.expires=now;break;}Object.assign(b,{x:50,y:16,vx:(r.lives%2?1:-1)*24,vy:0});}
   }
  }
  if(now-frameAt>=100){frameAt=now;broadcast({t:'leisure.frame',s:summary()});for(const p of ps)if(p.mini?.type==='pinball')round(p);}
 }
 return{handle,tick,summary};
};
