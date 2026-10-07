const test=require('node:test'),assert=require('node:assert/strict'),G=require('../public/shared.js'),fs=require('node:fs');
test('50 AI colleagues finish random toilet tasks through real navigation and three shared stalls',{timeout:120000},()=>{
 let clock=100000;const original=Date.now;Date.now=()=>clock;
 try{const g={gameId:'crowd',players:{},phase:'lobby',board:{members:[],round:1},builds:{A:{},B:{},C:{}}},sim=require('../simulation.cjs')({getGame:()=>g,G,broadcast:()=>{},stateChanged:()=>{},save:()=>{},computeRoles:()=>{},buildOpen:()=>false});
 for(let i=0;i<50;i++){const p={id:'p'+i,name:'同仁'+i,joinIdx:i+1,rank:'staff',team:i%3===0?'M':i%2?'A':'B',online:true,bot:true};g.players[p.id]=p;sim.init(p);sim.travel(p,p.team);}
 const ps=Object.values(g.players);for(let i=0;i<3000;i++){clock+=50;sim.tick();if(ps.every(p=>p.arrival.stage==='done'&&!p.motion.path.length))break;}assert.ok(ps.every(p=>p.arrival.stage==='done'));
 let seed=3;const random=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);const play=require('../play.cjs')({getGame:()=>g,G,sim,clock:()=>clock,random,broadcast:()=>{},changed:()=>{},save:()=>{},message:()=>{}});g.phase='build';const began=clock;let min=Infinity;
 for(let tick=0;tick<10000;tick++){clock+=50;play.tick();sim.tick();if(tick%10===0){for(const p of ps)play.bot(p,m=>play.handle({player:p,reply:()=>{}},m));for(let i=0;i<ps.length;i++)for(let j=0;j<i;j++)min=Math.min(min,Math.hypot(ps[i].motion.x-ps[j].motion.x,ps[i].motion.z-ps[j].motion.z));}if(ps.every(p=>p.play.toilet.phase==='done'))break;}
 const pending=ps.filter(p=>p.play.toilet.phase!=='done').map(p=>({id:p.id,t:p.play.toilet,m:p.motion}));fs.writeFileSync('artifacts/toilet-crowd.json',JSON.stringify({completed:50-pending.length,seconds:(clock-began)/1000,min,pending},null,2));assert.equal(pending.length,0,'everyone must finish without a blocked restroom');assert.ok(min>=1.259,'no player overlap');console.log('50 toilet tasks completed in simulated seconds',(clock-began)/1000);
 }finally{Date.now=original;}
});
