/* One synchronized clock for players, host and projector. Also unit-testable. */
(function(root){'use strict';
 function describe(s,now,plan){
  const i=plan.findIndex(p=>p.id===s.phase),p=plan[i];if(!p)return null;
  let title=p.title,next=plan[i+1]?.title||'自由探索',remaining=s.pausedRemaining!=null?s.pausedRemaining/1000:s.phaseEndsAt!=null?Math.max(0,(s.phaseEndsAt-now)/1000):null;
  const paused=s.pausedRemaining!=null,stage=s.phase==='brief'?(s.brief?.stage||'management'):'';
  if(s.phase==='brief'){
   title=stage==='management'?'處長＋部長公開投票':stage==='chair'?'董事長拍板':'開案方向公布';
   next=stage==='management'?'董事長 10 秒拍板':stage==='chair'?'開案方向公布':'一起蓋馬桶';
   remaining=Math.max(0,(remaining??45)-(stage==='management'?15:stage==='chair'?5:0));
  }
  if(s.phase==='roles'&&!s.board?.chair&&s.board?.deadline)remaining=Math.max(0,(s.board.deadline-(paused?s.serverNow:now))/1000);
  const seconds=remaining==null?null:Math.max(0,Math.ceil(remaining));
  return {title,next,seconds,paused,key:[s.gameId,s.phaseStartedAt,s.phase,stage].join(':'),active:!!s.show?.active||s.phase!=='lobby'||s.phaseEndsAt!=null,critical:!paused&&seconds>0&&seconds<=5};
 }
 class Sounds{
  constructor(){this.seen=new Set();this.key=null;}
  next(d){if(!d||!d.active||d.paused||d.seconds==null)return null;if(this.key!==d.key){this.key=d.key;this.seen.clear();}const n=d.seconds;if(n>10||n<0||this.seen.has(n))return null;this.seen.add(n);return n===10?'countdown':n===0?'phase-end':n<=5?'phase-tick':null;}
 }
 const api={describe,Sounds};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.PhaseCues=api;
})(typeof window!=='undefined'?window:globalThis);
