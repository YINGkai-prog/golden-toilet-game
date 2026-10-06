'use strict';
// Public 30-second management ballot, 10-second chair decision, 5-second reveal.
module.exports=function({getGame,G,changed,save,fx,clock=Date.now}){
 const eligible=()=>Object.values(getGame().players).filter(p=>!p.kicked&&['lead','manager'].includes(p.rank)).sort((a,b)=>a.joinIdx-b.joinIdx);
 const elapsed=()=>45000-(getGame().pausedRemaining??Math.max(0,(getGame().phaseEndsAt||clock())-clock()));
 function start(){getGame().brief={choice:null,auto:false,stage:'management',votes:{},autoVotes:{},recommended:null,tally:Array(G.BRIEFS.length).fill(0)};}
 function tally(){const b=getGame().brief;b.tally=Array(G.BRIEFS.length).fill(0);for(const p of eligible()){const v=b.votes[p.id];if(Number.isInteger(v)&&v>=0&&v<b.tally.length)b.tally[v]++;}return b.tally;}
 function recommendation(){const counts=tally();return counts.indexOf(Math.max(...counts));}
 function closeManagement(){const b=getGame().brief;if(b.stage!=='management')return;const pick=recommendation();for(const p of eligible())if(b.votes[p.id]==null){b.votes[p.id]=pick;b.autoVotes[p.id]=true;}b.recommended=recommendation();b.stage='chair';fx({kind:'brief.voteClosed',recommended:b.recommended});}
 function decide(choice,auto){const b=getGame().brief;b.choice=choice;b.auto=auto;b.stage='revealed';fx({kind:'brief',choice,auto});}
 function finish(){const b=getGame().brief;if(!b.stage)start();closeManagement();if(b.choice==null)decide(b.recommended??recommendation(),true);changed();save();}
 function tick(){const g=getGame(),b=g.brief;if(g.phase!=='brief'||g.pausedRemaining!=null)return;if(!b.stage)start();let dirty=false;if(elapsed()>=30000&&g.brief.stage==='management'){closeManagement();dirty=true;}if(elapsed()>=40000&&g.brief.choice==null){decide(g.brief.recommended??recommendation(),true);dirty=true;}if(dirty){changed();save();}}
 function handle(c,m){const g=getGame(),p=c.player;if(!p||p.kicked||g.phase!=='brief'||g.pausedRemaining!=null)return false;tick();const b=g.brief,i=m.choice;if(!Number.isInteger(i)||i<0||i>=G.BRIEFS.length)return false;
  if(m.t==='brief.vote'){if(b.stage!=='management'||elapsed()>=30000||!['lead','manager'].includes(p.rank))return false;b.votes[p.id]=i;delete b.autoVotes[p.id];tally();}
  else if(m.t==='brief'){if(p.rank!=='boss'||b.stage!=='chair'||elapsed()>=40000||b.choice!=null)return false;decide(i,false);}else return false;
  changed();save();return true;
 }
 return{start,tick,handle,finish};
};
