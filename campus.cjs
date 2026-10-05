'use strict';
// Shared campus rules. No client supplies scores, identities, positions or ban times.
module.exports=function({getGame,G,broadcast,changed,save,clock=Date.now}){
 const nav=require('./navigation.cjs')(G),players=()=>Object.values(getGame().players).filter(p=>!p.kicked);
 const side=p=>['A','B'].includes(p.team)?p.team:(p.joinIdx%2?'A':'B');
 function state(){const g=getGame();return g.campus||(g.campus={chat:[],serial:0,omni:{x:0,z:20,mode:'welcome',node:0,path:[],flipAt:0,target:null},volley:{x:48,z:28,y:2.5,vx:0,vz:0,vy:0,score:[0,0],resetAt:0,last:null,serve:'A',rally:0}});}
 function summary(includeHistory=true){const s=state();return{...s,chat:includeHistory?s.chat:undefined,omni:{...s.omni,path:undefined},serverNow:clock()};}
 function message(name,text,kind='chat',by=null,rank=null){const s=state();const m={id:++s.serial,at:clock(),name,text,kind,by,rank};s.chat.push(m);s.chat=s.chat.slice(-60);broadcast({t:'chat',message:m});save();return m;}
 function activity(p){if(!p||p.bot||p.kicked)return;p.lastActionAt=clock();if(p.aiControlled){p.aiControlled=false;p.motion.path=[];p.motion.destination=null;p.motion.room=nav.roomAt(p.motion).id;changed();broadcast({t:'assist',id:p.id,active:false});}}
 function handle(c,m){if(!['chat.send','input.active','sports.hit'].includes(m.t))return false;
  const p=c.player;if(m.t==='input.active'){activity(p);return true;}
  if(m.t==='chat.send'){
   if(!c.host&&(!p||p.kicked)){c.reply({t:'err',msg:'報到後即可加入公頻'});return true;}
   const now=clock();if(c.chatAt!=null&&now-c.chatAt<1200){c.reply({t:'err',msg:'慢一點，讓同事也說一句。'});return true;}
   if(typeof m.text!=='string')return true;
   const text=Array.from(m.text.replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g,' ').trim()).slice(0,120).join('');if(!text)return true;
   c.chatAt=now;message(p?.name||'主持台',text,'chat',p?.id||null,p?.rank||'host');return true;
  }
  if(!p||p.kicked||p.expelPending)return true;const now=clock(),pos=p.motion;
  if(m.game==='volley'){
   const b=state().volley;if(b.resetAt||Math.hypot(pos.x-b.x,pos.z-b.z)>3||b.y>3.5||now-(p.volleyAt||0)<450)return true;
   strikeVolley(p,b,now);return true;
  }
  const b=getGame().recreation?.football;if(!b||b.resetAt||Math.hypot(pos.x-b.x,pos.z-b.z)>2.4||now-(p.lastKick||0)<450)return true;
  // Aim toward the opponent's goal; presence and cooldown are server checked.
  const dx=side(p)==='A'?1:-1,dz=(1-b.z)*.12,len=Math.hypot(dx,dz);kick(p,b,dx/len,dz/len,now);return true;
 }
 function kick(p,b,dx,dz,now){b.vx=dx*32;b.vz=dz*32;b.last=p.id;b.kickedAt=now;p.lastKick=now;b.x+=dx*.25;b.z+=dz*.25;}
 function strikeVolley(p,b,now){const team=side(p),target=team==='A'?57:47;const dx=target-b.x;b.y=Math.max(.8,b.y);const flight=(8.8+Math.sqrt(8.8*8.8+20*(b.y-.45)))/10;b.vx=dx/flight;b.vz=(28-b.z)/flight;b.vy=8.8;b.last=p.id;b.lastSide=team;b.hitAt=now;b.rally++;p.volleyAt=now;}
 function award(b,index,sport,now){b.score[index]++;b.resetAt=now+2200;b.vx=b.vz=0;b.vy=0;const p=getGame().players[b.last];b.scorer=p?{id:p.id,name:p.name,title:p.title,team:side(p)}:null;b.goalAt=now;b.goalSide=index;
  const team=index===0?'研發一處':'研發二處';message(sport==='足球'?'⚽ 黃金右腳':'🏐 水上排球',`${team} +1！${p?.name||'同仁'}${p&&side(p)!==(index===0?'A':'B')?' 意外助攻對方，今晚的笑點有了。':sport==='足球'?' 射門得分，進球高手！':' 贏下這一球！'}`,'event');changed();save();}
 function football(b,ps,now,dt){
  if(b.resetAt){if(now>=b.resetAt)Object.assign(b,{x:0,z:1,vx:0,vz:0,resetAt:0,last:null});return;}
  // Substeps stop fast kicks skipping the mascot or the posts.
  for(let step=0;step<4;step++){
   b.x+=b.vx*dt/4;b.z+=b.vz*dt/4;b.vx*=Math.exp(-.5*dt/4);b.vz*=Math.exp(-.5*dt/4);
   const o=state().omni,p=getGame().players[b.last];
   if(p&&!p.kicked&&o.mode!=='chase'&&Math.hypot(b.vx,b.vz)>5&&Math.hypot(o.x-b.x,o.z-b.z)<1.15){
    o.mode='chase';o.target=p.id;o.path=nav.path(o,p.motion,false)||[];o.catchAt=now+2800;p.expelPending=true;p.motion.path=[];p.motion.destination=null;
    b.vx*=-.55;b.vz*=-.55;b.resetAt=now+1800;
    message('OMNI',`${p.name}！接待服務不包含頭球。請跟我到外面冷靜兩分鐘。`,'event');changed();break;
   }
   if(Math.abs(b.x)>9){if(Math.abs(b.z-1)<2.6){award(b,b.x>0?0:1,'足球',now);break;}b.x=Math.sign(b.x)*9;b.vx*=-.88;}
   if(b.z< -6.7||b.z>8.7){b.z=Math.max(-6.7,Math.min(8.7,b.z));b.vz*=-.88;}
  }
  if(b.resetAt)return;
  for(const p of ps){const m=p.motion;if(!m||p.expelPending||(!p.online&&!p.bot&&!p.aiControlled)||Math.hypot(m.x-b.x,m.z-b.z)>1.15||now-(p.lastKick||0)<550)continue;
   const d=Math.hypot(b.x-m.x,b.z-m.z);kick(p,b,d>.05?(b.x-m.x)/d:side(p)==='A'?1:-1,d>.05?(b.z-m.z)/d:0,now);
  }
 }
 function volleyball(ps,now,dt){const b=state().volley;
  if(b.resetAt){if(now>=b.resetAt){const x=b.serve==='A'?47:57;Object.assign(b,{x,z:28,y:2.8,vx:0,vz:0,vy:0,resetAt:0,last:null,rally:0});}return;}
  // Unserved balls hover gently so either side can walk up and start a rally.
  if(b.last){const oldX=b.x;b.vy-=10*dt;b.x+=b.vx*dt;b.z+=b.vz*dt;b.y+=b.vy*dt;
   if((oldX-52)*(b.x-52)<0&&b.y<2.1){b.x=oldX;b.vx*=-.6;b.vy=2;}
   if(b.y<.45||b.x<43||b.x>61||b.z<18||b.z>38){const out=b.x<43||b.x>61||b.z<18||b.z>38;const win=out?(b.lastSide==='A'?1:0):(b.x<52?1:0);b.serve=win===0?'A':'B';award(b,win,'排球',now);return;}
  }
  for(const p of ps){if(!p.motion||p.motion.room!=='pool'||p.expelPending||(!p.online&&!p.bot&&!p.aiControlled)||b.y>2.8||Math.hypot(p.motion.x-b.x,p.motion.z-b.z)>1.7||now-(p.volleyAt||0)<700)continue;
   if(b.last===p.id&&now-(b.hitAt||0)<1000)continue;strikeVolley(p,b,now);break;
  }
 }
 function robot(ps,now,dt){const o=state().omni;
  if(o.mode==='chase'){
   const p=getGame().players[o.target];if(!p||p.kicked){o.mode='patrol';o.target=null;o.path=[];return;}
   if(now>=o.catchAt||Math.hypot(o.x-p.motion.x,o.z-p.motion.z)<1.2){
    p.expelPending=false;p.indoorBanUntil=now+120000;p.dancing=false;p.mini=null;
    Object.assign(p.motion,{x:0,z:54,room:'terrace',destination:null,path:[]});o.mode='cooldown';o.x=0;o.z=46;o.path=[];o.until=now+4000;o.target=null;
    message('OMNI',`${p.name} 已被請出辦公室，120 秒後解除門禁。戶外泳池與公頻照常開放。`,'event');changed();save();return;
   }
  }else if(o.mode==='cooldown'){if(now<o.until)return;o.mode='patrol';}
  else if(!o.path.length){const waypoints=[[6,28],[0,35],[6,18],[0,1],[-5,5],[0,20]];const [x,z]=waypoints[o.node++%waypoints.length];o.path=nav.path(o,{x,z},false)||[];o.flipAt=now;o.mode='patrol';}
  let distance=dt*(o.mode==='chase'?18:3.2);
  while(distance>0&&o.path.length){const [x,z]=o.path[0],dx=x-o.x,dz=z-o.z,d=Math.hypot(dx,dz);o.heading=Math.atan2(dx,dz);if(d<=distance){o.x=x;o.z=z;distance-=d;o.path.shift();}else{o.x+=dx/d*distance;o.z+=dz/d*distance;distance=0;}}
  for(const p of ps){if(!p.omniWelcomed&&p.motion&&Math.hypot(p.motion.x-o.x,p.motion.z-o.z)<7){p.omniWelcomed=true;broadcast({t:'omni.greet',id:p.id,text:`${p.name}，歡迎加班！咖啡免費，明天再改不免費。`});}}
 }
 let previous=clock(),frameAt=0;
 function tick(){const now=clock(),dt=Math.max(0,Math.min(.1,(now-previous)/1000));previous=now;const ps=players();
  for(const p of ps){if(p.bot)continue;if(p.lastActionAt==null)p.lastActionAt=now;
   if(!p.aiControlled&&now-p.lastActionAt>=30000){p.aiControlled=true;broadcast({t:'assist',id:p.id,active:true});changed();}
   if(p.indoorBanUntil&&now>=p.indoorBanUntil){p.indoorBanUntil=0;message('OMNI',`${p.name} 的門禁解除。歡迎回來，這次請把球踢向球門。`,'event');changed();}
  }
  robot(ps,now,dt);const ball=getGame().recreation?.football;if(ball)football(ball,ps,now,dt);volleyball(ps,now,dt);
  if(now-frameAt>=100){frameAt=now;broadcast({t:'campus.frame',s:{omni:{...state().omni,path:undefined},volley:state().volley,serverNow:now}});}
 }
 return{tick,handle,summary,activity,side,message};
};
