'use strict';
// Authoritative office simulation. Clients request destinations, never positions or scores.
module.exports = function createSimulation({getGame, G, broadcast, stateChanged, save, computeRoles, buildOpen, pending, plan}) {
 const fail=(c,msg)=>c.reply({t:'err',msg});
 const room=id=>G.ROOMS.find(r=>r.id===id);
 const home=p=>p.team==='A'?'A':p.team==='B'?'B':p.team==='M'?'M':'board';
 function init(p){
  if(!p.motion)p.motion={x:6+(p.joinIdx%5)*.7,z:12+Math.floor(p.joinIdx/5)*.2,room:'atrium',destination:null,path:[]};
  if(!p.leisure)p.leisure={score:0,round:null,awaySeconds:0};
 }
 function travel(p,id,point){
  init(p);const r=room(id),m=p.motion;
  if(!r||id==='core'&&p.rank!=='boss')return false;
  const current=room(m.room)||room('atrium');
  // Doorways connect through the open spine; no straight-line teleport through walls.
  const occupied=new Set(Object.values(getGame().players).filter(q=>q!==p&&!q.kicked&&(q.motion?.room===id||q.motion?.destination===id)).map(q=>q.motion.slot));
  let slot=0;while(occupied.has(slot))slot++;m.slot=slot;
  const cols=Math.max(2,Math.floor((r.w-2)/1.05));
  let tx=r.x-(cols-1)*.525+(slot%cols)*1.05+(p.joinIdx%3-1)*.13,tz=r.z+r.d/2-2.1-Math.floor(slot/cols)*1.05+(p.joinIdx%4)*.12;
  if(point&&Number.isFinite(point.x)&&Number.isFinite(point.z)){
   tx=Math.max(r.x-r.w/2+.8,Math.min(r.x+r.w/2-.8,point.x));
   // Interaction lanes keep characters clear of desks and fixed furniture.
   tz=Math.max(r.z+r.d/2-2.7,Math.min(r.z+r.d/2-.7,point.z));
  }
  const exit=current.route||[current.door];
  const entry=r.route||[r.door];
  const spine=m.path.findIndex(p=>p[1]===8);
  const outgoing=m.room==='transit'&&spine>=0?m.path.slice(0,spine+1):[current.door,...exit];
  m.path=[...outgoing,...entry.slice().reverse(),r.door,[tx,tz]];
  m.destination=id;m.room='transit';p.leisure.round=null;return true;
 }
 function boardReady(){
  const g=getGame();const ids=Object.values(g.players).filter(p=>!p.kicked).sort((a,b)=>a.joinIdx-b.joinIdx).slice(0,3).map(p=>p.id);
  if(JSON.stringify(ids)!==JSON.stringify(g.board.members)){
   g.board={members:ids,votes:{},chair:null,round:g.board.round+1,tied:false};
   for(const p of Object.values(g.players))if(p.motion?.destination==='core'||p.motion?.room==='core')travel(p,'atrium');
  }
 }
 function handle(c,m){
  const g=getGame(),p=c.player;
  if(!['board.vote','office.move','arcade.start','arcade.hit','core.inspect'].includes(m.t))return false;
  if(!p||p.kicked){fail(c,'請先報到再操作角色');return true;}init(p);
  if(m.t==='board.vote'){
   const b=g.board;
   if(b.chair){fail(c,'董事長已選出');return true;}
   if(b.members.length!==3||!b.members.includes(p.id)||!b.members.includes(m.candidate)){fail(c,'僅三位董事可互選董事長');return true;}
   if(m.candidate===p.id){fail(c,'不能投自己，請選擇另一位董事');return true;}
   if(m.round!==b.round){fail(c,'這一輪已結束，請依新一輪重新投票');return true;}
   b.votes[p.id]=m.candidate;b.tied=false;
   if(Object.keys(b.votes).length===3){
    const counts={};Object.values(b.votes).forEach(id=>counts[id]=(counts[id]||0)+1);
    const winner=Object.keys(counts).find(id=>counts[id]>=2);
    if(winner){b.chair=winner;computeRoles();broadcast({t:'fx',kind:'elected',name:g.players[winner].name});}
    else{b.round++;b.votes={};b.tied=true;}
   }
   stateChanged();save();return true;
  }
  if(m.t==='office.move'){
   if(typeof m.room!=='string'||!travel(p,m.room,{x:m.x,z:m.z})){fail(c,'機房門禁：僅董事長可進入');return true;}
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
    moving=true;const [x,z]=m.path[0],d=Math.hypot(x-m.x,z-m.z),step=dt*5;
    if(d<=step){m.x=x;m.z=z;m.path.shift();if(!m.path.length){m.room=m.destination;m.destination=null;stateChanged();}}
    else{m.x+=(x-m.x)/d*step;m.z+=(z-m.z)/d*step;}
   }
   if(buildOpen()&&p.online&&['A','B'].includes(p.team)&&m.room!==home(p))p.leisure.awaySeconds+=dt;
  }
  if(moving&&now-motionAt>100){motionAt=now;broadcast({t:'motion',players:Object.values(g.players).filter(p=>!p.kicked).map(p=>({id:p.id,...p.motion,path:undefined}))});}
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
 return {handle,tick,init,travel,home,boardReady};
};
