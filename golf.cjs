'use strict';
module.exports=({getGame,G,sim,clock,random,event,changed,save,blocked})=>{
 const state=()=>getGame().golf||(getGame().golf={lanes:Array.from({length:5},(_,i)=>({id:i,player:null,round:null,shot:null})),best:{}});
 const people=()=>Object.values(getGame().players).filter(p=>!p.kicked);
 const near=(p,i)=>p.motion&&Math.hypot(p.motion.x-G.GOLF_TEES[i].x,p.motion.z-G.GOLF_TEES[i].z)<2.4;
 const summary=()=>({...state(),top:Object.values(state().best).filter(r=>people().some(p=>p.id===r.id)).sort((a,b)=>b.distance-a.distance||a.at-b.at).slice(0,5)});
 const release=p=>{for(const l of state().lanes)if(l.player===p.id){l.player=null;l.round=null;}changed();};
 function handle(c,m){if(!m.t.startsWith('golf.'))return false;const p=c.player,now=clock();if(!p||p.kicked||getGame().pausedRemaining!=null||blocked(p,m.t)){c.reply({t:'err',msg:'先報到並完成眼前任務，才能打高爾夫。'});return true;}
  if(m.t==='golf.leave'){release(p);return true;}
  const i=Number(m.lane),l=state().lanes[i];if(!Number.isInteger(i)||!l||!near(p,i)){c.reply({t:'err',msg:'請走近自己的打席再揮桿。'});return true;}
  if(l.player&&l.player!==p.id){c.reply({t:'err',msg:'這個打席有人，請選另一席。'});return true;}
  if(m.t==='golf.start'){if(l.round||now<(l.readyAt||0))return true;release(p);l.player=p.id;l.round={id:require('crypto').randomBytes(6).toString('hex'),starts:now+700,duration:2400,target:.62+random()*.25};p.motion.path=[];p.motion.destination=null;event('golf-ready',p,'');}
  if(m.t==='golf.hit'){const r=l.round;if(!r||m.round!==r.id||now<r.starts)return true;const power=Math.min(1,Math.max(0,(now-r.starts)/r.duration)),error=Math.abs(power-r.target);const distance=now>r.starts+r.duration?0:Math.round((25+295*Math.max(0,1-error/.65)**3)*10)/10;l.shot={by:p.id,name:p.name,at:now,distance};l.round=null;l.readyAt=now+2500;const best=state().best[p.id];if(!best||distance>best.distance)state().best[p.id]={id:p.id,name:p.name,distance,points:Math.round(distance),at:now};event('golf-hit',p,`${p.name} 一桿 ${distance} 公尺！`,{distance,lane:i});save();}
  changed();return true;
 }
 let previous=clock();function tick(){const now=clock(),elapsed=now-previous;previous=now;for(const l of state().lanes){if(getGame().pausedRemaining!=null){if(l.round)l.round.starts+=elapsed;if(l.readyAt)l.readyAt+=elapsed;if(l.shot)l.shot.at+=elapsed;continue;}const p=getGame().players[l.player];if(l.player&&(!p||p.kicked||!p.online&&!p.bot&&!p.aiControlled||!near(p,l.id)||blocked(p,'golf.hit'))){l.player=null;l.round=null;changed();}if(l.round&&now>l.round.starts+l.round.duration+500){l.shot={by:l.player,at:now,distance:0};l.round=null;l.readyAt=now+1500;changed();}}}
 function bot(p,send){if(p.motion?.room!=='golf')return false;const s=state(),l=s.lanes.find(l=>l.player===p.id)||s.lanes.find(l=>!l.player);if(!l)return false;if(!near(p,l.id)){if(!p.motion.destination)sim.travel(p,'golf',G.GOLF_TEES[l.id]);return true;}if(!l.round){if(clock()>=(l.readyAt||0))send({t:'golf.start',lane:l.id});}else if(clock()>=l.round.starts+(l.round.target-.06+(p.joinIdx%5)*.025)*l.round.duration)send({t:'golf.hit',lane:l.id,round:l.round.id});return true;}
 return{summary,handle,tick,bot};
};
