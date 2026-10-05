'use strict';
const{test}=require('node:test'),assert=require('node:assert/strict'),G=require('../public/shared.js'),market=require('../market.cjs'),navigation=require('../navigation.cjs');
test('market evidence produces profit; overriding demand or price can bankrupt the company',()=>{
 const g={review:{votes:{a:'A',b:'A',c:'B'},weights:{a:2,b:2,c:1},bossPick:'A'},poster:{survey:{a:{price:30000},b:{price:32000},c:{price:29000}},officialPrice:null},builds:{A:{},B:{},C:{}}};for(let i=0;i<100;i++)for(const t of['A','B','C'])g.builds[t][i]={};
 const recommended=market(g);assert.equal(recommended.popular,'A');assert.equal(recommended.recommended,27000);assert.ok(recommended.profit>0);assert.equal(recommended.status,'profit');
 g.review.bossPick='C';assert.equal(market(g).status,'bankrupt');g.review.bossPick='A';g.poster.officialPrice=200000;assert.equal(market(g).status,'bankrupt');g.poster.officialPrice=0;assert.equal(market(g).status,'bankrupt');g.poster.officialPrice=13500;assert.equal(market(g).status,'loss');
 g.poster.survey={};g.review.votes={};assert.ok(Number.isFinite(market(g).profit));assert.equal(market(g).surveyCount,0);
});
test('50 arrivals and desk routes have no intersecting players; workstation, distraction and physical ballot rules',{timeout:120000},()=>{
 let clock=100000;const original=Date.now;Date.now=()=>clock;
 try{const g={players:{},phase:'lobby',phaseStartedAt:clock,board:{members:[],round:1},builds:{A:{},B:{},C:{}}},sim=require('../simulation.cjs')({getGame:()=>g,G,broadcast:()=>{},stateChanged:()=>{},save:()=>{},computeRoles:()=>{},buildOpen:()=>false});
 for(let i=0;i<50;i++){const p={id:'p'+i,joinIdx:i+1,rank:i<3?'board':'staff',team:i<3?null:i%5<2?'A':i%5<4?'B':'M',online:true};g.players[p.id]=p;sim.init(p);sim.travel(p,p.team||'board');}
 const ps=Object.values(g.players);let min=Infinity;for(let tick=0;tick<2400;tick++){clock+=50;sim.tick();for(let i=0;i<50;i++)for(let j=0;j<i;j++){const a=ps[i],b=ps[j],d=Math.hypot(a.motion.x-b.motion.x,a.motion.z-b.motion.z);min=Math.min(min,d);assert.ok(d>=1.259,`overlap ${i}/${j}: ${d}`);}if(ps.every(p=>p.arrival.stage==='done'&&!p.motion.path.length))break;}
 const stuck=ps.filter(p=>p.motion.path.length).map(p=>({id:p.id,stage:p.arrival.stage,m:p.motion}));if(stuck.length)console.log(JSON.stringify(ps.map(p=>({id:p.id,stage:p.arrival.stage,x:p.motion.x,z:p.motion.z,path:p.motion.path}))),null,2);assert.equal(stuck.length,0,'all 50 must reach their destinations');for(const p of ps.filter(p=>p.team))assert.ok(sim.atStation(p),p.id+' at assigned desk');
 const p=ps[4],nav=navigation(G),workflow=require('../workflow.cjs')({getGame:()=>g,G,nav,changed:()=>{},clock:()=>clock});
 workflow.enter(p,'arcade');assert.ok(workflow.locked(p));assert.equal(sim.travel(p,'A'),false);assert.equal(workflow.status(p).until-clock,20000);clock+=19999;assert.ok(workflow.locked(p));clock++;assert.equal(workflow.locked(p),false);
 workflow.enter(p,'lounge');assert.equal(workflow.status(p).until-clock,30000);clock+=30000;assert.equal(workflow.locked(p),false);
 g.phase='review';g.phaseStartedAt=clock;const b=G.ROOMS.find(r=>r.id==='board');p.motion={x:b.x,z:b.z,room:'board',path:[]};assert.equal(workflow.weight(p),1);assert.ok(workflow.inspect(p));clock+=1500;assert.equal(workflow.weight(p),2);p.motion.room='transit';assert.equal(workflow.weight(p),1);g.phaseStartedAt++;p.motion.room='board';assert.equal(workflow.weight(p),1);
 console.log(JSON.stringify({players:50,minimumCenterDistance:min,simulatedSeconds:(clock-100000)/1000}));
 }finally{Date.now=original;}
});
