'use strict';
module.exports=function({getGame,clock=Date.now}){
 let previous=clock();
 const valid=p=>p&&!p.bot&&!p.kicked&&!p.aiControlled;
 const data=p=>p.engagement||(p.engagement={seconds:0,tasks:{},rooms:{}});
 function record(p,kind,key=kind){const g=getGame();if(!valid(p)||g.phase==='lobby'||g.phase==='launch'||g.pausedRemaining!=null||['err','chat','chat.send','input.active'].includes(kind))return;const d=data(p);d.tasks[kind+':'+key]=true;}
 function tick(){const t=clock(),dt=Math.min(1,Math.max(0,(t-previous)/1000));previous=t;const g=getGame();if(['lobby','launch'].includes(g.phase)||g.pausedRemaining!=null)return;for(const p of Object.values(g.players)){if(!valid(p)||!p.online||t-p.lastActionAt>12000)continue;const d=data(p);d.seconds+=dt;const r=p.motion?.room;if(r&&r!=='transit')d.rooms[r]=true;}}
 function choose(){const candidates=Object.values(getGame().players).filter(p=>!p.bot&&!p.kicked).map(p=>{const d=data(p),tasks=Object.keys(d.tasks),types=new Set(tasks.map(k=>k.split(':')[0])).size,seconds=Math.floor(d.seconds),rooms=Object.keys(d.rooms).length;return{id:p.id,seconds,tasks:tasks.length,types,rooms,score:Math.floor(Math.min(600,seconds)/5)+Math.min(6,types)*10+Math.min(20,tasks.length)+Math.min(4,rooms)*3,joinIdx:p.joinIdx};}).filter(p=>p.seconds>=15||p.tasks>=2).sort((a,b)=>b.score-a.score||b.seconds-a.seconds||a.joinIdx-b.joinIdx);return candidates[0]?{...candidates[0],prize:'7-11 現金卡',rule:'真人有效操作時間＋不同參與項目＋探索；聊天不加分，AI 代班不計入。同分以有效時間、報到順序決定。'}:null;}
 return{tick,record,choose};
};
