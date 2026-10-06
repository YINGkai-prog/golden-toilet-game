'use strict';
const P=require('./public/party-shared.js');
module.exports=({getGame,clock,broadcast,changed,save})=>{
 const state=()=>{const g=getGame();return g.party||(g.party={rounds:[],active:null,buildAt:null});};
 const tally=p=>p.options.map((_,i)=>Object.values(p.votes).filter(v=>v===i).length);
 function finish(){const s=state(),p=s.active;if(!p)return;const counts=tally(p),max=Math.max(...counts),winners=max?counts.map((v,i)=>v===max?i:null).filter(i=>i!==null):[];p.counts=counts;p.winners=winners;p.closedAt=clock();s.rounds.push(p);s.active=null;broadcast({t:'campus.event',message:{text:'📣 '+(winners.length?winners.map(i=>p.options[i]).join(' ／ ')+'（'+max+' 票）':'大家忙著蓋馬桶，本提案自動撤案')+'。'+(P.polls[p.index]?.line||'')}});changed();save();}
 let previous=clock();
 function tick(){const t=clock(),delta=Math.max(0,t-previous);previous=t;const g=getGame(),s=state();if(g.phase!=='build'){if(s.active)finish();return;}if(s.buildAt!==g.phaseStartedAt){s.buildAt=g.phaseStartedAt;s.rounds=[];s.active=null;}
  if(g.pausedRemaining!=null){if(s.active)s.active.endsAt+=delta;return;}const elapsed=((g.show?.active?210:g.settings.buildSec)*1000-(g.phaseEndsAt-t))/1000;
  if(s.active){if(clock()>=s.active.endsAt||g.timeUp)finish();return;}const index=P.polls.findIndex((p,i)=>elapsed>=p.at&&!s.rounds.some(r=>r.index===i));if(index<0||g.timeUp)return;const p=P.polls[index];s.active={id:g.phaseStartedAt+':'+index,index,title:p.title,options:p.options,votes:{},endsAt:clock()+18000};broadcast({t:'campus.event',message:{text:'📣 全公司荒謬提案：'+p.title+'（18 秒三選一，不影響上市評分）'}});changed();save();}
 function handle(c,m){if(m.t!=='party.vote')return false;const g=getGame(),s=state(),p=s.active,q=c.player;if(!q||q.kicked||!p||m.id!==p.id||g.phase!=='build'||g.pausedRemaining!=null||clock()>=p.endsAt||!Number.isInteger(m.choice)||m.choice<0||m.choice>=p.options.length)return true;p.votes[q.id]=m.choice;changed();save();return true;}
 function summary(){const s=state();return{active:s.active?{...s.active,votes:undefined,counts:tally(s.active),voters:Object.keys(s.active.votes).length}:null,rounds:s.rounds.map(p=>({...p,votes:undefined}))};}
 return{tick,handle,summary};
};
