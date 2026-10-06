'use strict';
// Authoritative office simulation. Clients request destinations, never positions or scores.
module.exports = function createSimulation({getGame, G, broadcast, stateChanged, save, computeRoles, buildOpen, pending, plan}) {
 const fail=(c,msg)=>c.reply({t:'err',msg});
 const room=id=>G.ROOMS.find(r=>r.id===id);
 const nav=require('./navigation.cjs')(G);
 const workflow=require('./workflow.cjs')({getGame,G,nav,changed:stateChanged});
 const traffic=require('./traffic.cjs')({getGame,nav});
 const home=p=>p.team==='A'?'A':p.team==='B'?'B':p.team==='M'?'M':'board';
 function init(p){
  if(!p.motion||p.motion.layout!==G.LAYOUT)workflow.arrive(p);
  if(!p.leisure)p.leisure={score:0,round:null,awaySeconds:0};
 }
 function travel(p,id,point){
  init(p);let r=room(id);const m=p.motion;const banned=p.indoorBanUntil>Date.now();if(p.expelPending)return false;
  if(!r||id==='core'&&p.rank!=='boss'||workflow.locked(p))return false;
  if(point&&Number.isFinite(point.x)&&Number.isFinite(point.z)&&r.base){r=nav.roomAt(point);id=r.id;if(id==='core'&&p.rank!=='boss')return false;}
  if(p.arrival&&p.arrival.stage!=='done'){p.arrival.next={id,point};return true;}
  const occupied=new Set(Object.values(getGame().players).filter(q=>q!==p&&!q.kicked&&(q.motion?.room===id||q.motion?.destination===id)).map(q=>q.motion.slot));
  let slot=0;while(occupied.has(slot))slot++;m.slot=slot;
  const cols=Math.max(2,Math.floor((r.w-4)/1.2));
  let tx=r.x-(cols-1)*.6+(slot%cols)*1.2,tz=r.z+r.d/2-2-Math.floor(slot/cols)*1.2;
  const desk=G.DESKS.filter(d=>d.room===id)[slot%Math.max(1,G.DESKS.filter(d=>d.room===id).length)];
  if(desk){tx=desk.x;tz=desk.z+2.8;}if(id==='arcade'){const machines=G.FIXTURES.filter(f=>f.type==='arcade');const f=machines[slot%machines.length];tx=f.x+(Math.floor(slot/3)%3-1)*1.5;tz=f.z+2.5+Math.floor(slot/9)*1.6;}const own=workflow.station(p);if(own&&id===p.team){tx=own.seatX;tz=own.seatZ;}
  if(point&&Number.isFinite(point.x)&&Number.isFinite(point.z)){
   tx=point.x;tz=point.z;
  }
  if(banned&&nav.insideOffice({x:tx,z:tz}))return false;
  let target=own&&id===p.team&&Math.hypot(tx-own.seatX,tz-own.seatZ)<.1?{x:own.seatX,z:own.seatZ}:nav.nearest({x:tx,z:tz},r,p.rank==='boss',banned);if(!target)return false;
  target=traffic.target(p,target,r);if(!target)return false;
  const path=nav.path(m,target,p.rank==='boss'||nav.insideCore(m),banned);if(!path)return false;
  m.path=path;
  m.destination=id;m.room='transit';p.leisure.round=null;return true;
 }
 function boardReady(){
  const g=getGame();const ids=Object.values(g.players).filter(p=>!p.kicked&&!p.supportTeam).sort((a,b)=>a.joinIdx-b.joinIdx).slice(0,3).map(p=>p.id);
  if(JSON.stringify(ids)!==JSON.stringify(g.board.members)){
   g.board={members:ids,votes:{},chair:null,round:g.board.round+1,tied:false};
   for(const p of Object.values(g.players))if(p.motion?.destination==='core'||p.motion?.room==='core')travel(p,'atrium');
  }
 }
 function handle(c,m){
  const g=getGame(),p=c.player;
  if(!['board.vote','office.move','arcade.start','arcade.hit','core.inspect','work.goto','exhibit.inspect'].includes(m.t))return false;
  if(!p||p.kicked){fail(c,'請先報到再操作角色');return true;}init(p);
  if(m.t==='work.goto'){const d=workflow.station(p);if(!d||!travel(p,p.team,{x:d.seatX,z:d.seatZ}))fail(c,workflow.locked(p)?`${p.distraction.label}，還要 ${Math.ceil((p.distraction.until-Date.now())/1000)} 秒。`:'請先完成報到，或等待 OMNI 解除門禁。');else{c.reply({t:'work.route',station:d,path:p.motion.path});stateChanged();save();}return true;}
  if(m.t==='exhibit.inspect'){if(!workflow.inspect(p))fail(c,'請在提案評選時，親自抵達董事長室看模型。');else{stateChanged();save();c.reply({t:'exhibit.ready',readyAt:p.inspection.readyAt,phaseAt:p.inspection.phaseAt});}return true;}
  if(m.t==='board.vote'){
   const b=g.board;
   if(b.chair){fail(c,'董事長已選出');return true;}
   if(b.members.length!==3||!b.members.includes(p.id)||!b.members.includes(m.candidate)){fail(c,'僅三位董事可互選董事長');return true;}
   if(m.candidate===p.id){fail(c,'不能投自己，請選擇另一位董事');return true;}
   if(m.round!==b.round){fail(c,'這一輪已結束，請依新一輪重新投票');return true;}
   b.votes[p.id]=m.candidate;b.tied=false;
   const counts={};Object.values(b.votes).forEach(id=>counts[id]=(counts[id]||0)+1);
   const winner=Object.keys(counts).find(id=>counts[id]>=2);
   if(winner){b.chair=winner;computeRoles();broadcast({t:'fx',kind:'elected',name:g.players[winner].name});}
   else if(Object.keys(b.votes).length===3){b.round++;b.votes={};b.tied=true;}
   stateChanged();save();return true;
  }
  if(m.t==='office.move'){
   if(typeof m.room!=='string'||!travel(p,m.room,{x:m.x,z:m.z})){fail(c,workflow.locked(p)?`${p.distraction.label}，還要 ${Math.ceil((p.distraction.until-Date.now())/1000)} 秒才能離開。`:p.expelPending?'OMNI 正在請你離開，稍等一下。':p.indoorBanUntil>Date.now()?'OMNI 門禁剩餘 '+Math.ceil((p.indoorBanUntil-Date.now())/1000)+' 秒，先去泳池或公頻吧。':'目的地無法抵達，機房僅董事長可進入');return true;}
   stateChanged();save();return true;
  }
  if(m.t==='core.inspect'){
   if(p.rank!=='boss'||p.motion.room!=='core'){fail(c,'請由董事長進入機房後查看');return true;}
   c.reply({t:'core.data',ai:{...g.ai,plan:undefined},strategy:'依開案題目切換材料、掃描兩隊進度、加速填補結構並持續優化；不需人類操作。'});return true;
  }
  if(p.motion.room!=='arcade'){fail(c,'抵達遊戲室才能玩；離開房間即中止回合');return true;}
  if(!['build','poster','lobby','roles'].includes(g.phase)){fail(c,'目前階段遊戲室暫停計分');return true;}
  if(m.t==='arcade.start'){
   if(p.leisure.round&&Date.now()<p.leisure.round.expires){fail(c,'目前回合尚未結束');return true;}
   const type=m.game==='memory'?'memory':'pulse';
   p.leisure.round={id:require('node:crypto').randomBytes(8).toString('hex'),type,step:0,score:0,expires:Date.now()+20000,ready:Date.now()+700,sequence:Array.from({length:5},()=>Math.floor(Math.random()*4)),target:Math.floor(Math.random()*4)};
  }else{
   const r=p.leisure.round;if(!r||m.round!==r.id||Date.now()>r.expires){fail(c,'回合已結束，請重新挑戰');return true;}
   if(Date.now()<r.ready)return true;
   const expected=r.type==='memory'?r.sequence[r.step%5]:r.target;
   if(m.tile===expected){r.score+=r.type==='memory'?30:10;p.leisure.score+=r.type==='memory'?30:10;r.step++;r.target=Math.floor(Math.random()*4);r.ready=Date.now()+(r.type==='memory'?250:400);}
   else{r.score=Math.max(0,r.score-5);r.ready=Date.now()+500;}
  }
  c.reply({t:'arcade.round',round:p.leisure.round,total:p.leisure.score});stateChanged();save();return true;
 }
 let previous=Date.now(),motionAt=0,aiAt=0,saveAt=0;
 function tick(){
  const g=getGame(),now=Date.now(),dt=Math.min(.25,(now-previous)/1000);previous=now;
  let moving=false;
  for(const p of Object.values(g.players)){
   if(p.kicked)continue;init(p);const m=p.motion;
   if(m.path.length){
    moving=true;const [x,z]=m.path[0],d=Math.hypot(x-m.x,z-m.z),step=dt*workflow.speed(p);
    if(traffic.advance(p,{x,z},step)){m.path.shift();if(!m.path.length){if(!workflow.arrived(p)){m.room=m.destination;m.destination=null;workflow.enter(p,m.room);const next=p.arrival?.next;if(next){delete p.arrival.next;p.arrival.distributed=true;travel(p,next.id,next.point);}else if(p.arrival?.stage==='done'&&!p.arrival.distributed){p.arrival.distributed=true;travel(p,home(p));}}stateChanged();}}
   }
   if(buildOpen()&&(p.online||p.bot)&&['A','B'].includes(p.team)&&m.room!==home(p))p.leisure.awaySeconds+=dt;
  }
  if(now-motionAt>100){motionAt=now;broadcast({t:'motion',players:Object.values(g.players).filter(p=>!p.kicked).map(p=>({id:p.id,...p.motion,path:undefined,status:workflow.status(p)}))});}
  if(now-saveAt>5000){saveAt=now;if(moving)save();}
  if(!buildOpen()||now-aiAt<900)return;
  aiAt=now;
  if(!g.ai.plan){
   const choice=g.brief.choice||0;
   g.ai.plan=plan('B').map(([x,y,z,c])=>[x,y,z,c===0?5:c===12?(choice===2?4:6):c]);
   // Add functional brief-specific supports, compact layout or a docking canopy.
   if(choice===1)for(let y=0;y<8;y++)for(const x of [2,11])g.ai.plan.push([x,y,6,5]);
   if(choice===4)for(let y=0;y<11;y++)for(const x of [2,11])g.ai.plan.push([x,y,11,11]);
   if(choice===5)g.ai.plan=g.ai.plan.filter(c=>c[0]>=5&&c[0]<=8);
   g.ai.plan.sort((a,b)=>a[1]-b[1]);g.ai.strategy=['NEON / 沉浸式電競','CARE / 輔助扶手','AURUM / 奢華材質','CAT / 共享平台','ORBIT / 零重力固定','NANO / 緊湊機構'][choice];
  }
  const leading=Math.max(Object.keys(g.builds.A).length,Object.keys(g.builds.B).length);
  const boost=leading>Object.keys(g.builds.C).length?3:0;
  const rate=Math.max(2,Math.ceil(g.ai.plan.length/(Math.max(20,g.settings.buildSec)*.6)));
  let n=0;
  for(const [x,y,z,col] of g.ai.plan){
   if(n>=rate+boost)break;const key=[x,y,z].join(',');if(g.builds.C[key])continue;
   g.builds.C[key]={c:col,by:'ai-core'};pending().C.push([1,x,y,z,col,'ai-core']);n++;
  }
  g.ai.cycles++;g.ai.progress=Math.round(Object.keys(g.builds.C).length/g.ai.plan.length*100);
  g.ai.mode=g.ai.progress>=100?'OPTIMIZING':boost?'ACCELERATING':'BUILDING';
  if(g.ai.progress>=100&&g.ai.cycles%4===0){const key=Object.keys(g.builds.C)[g.ai.cycles%Object.keys(g.builds.C).length];if(key){const b=g.builds.C[key];b.c=b.c===5?6:5;pending().C.push([1,...key.split(',').map(Number),b.c,'ai-core']);}}
  stateChanged();save();
 }
 return {handle,tick,init,travel,home,boardReady,...workflow};
};
