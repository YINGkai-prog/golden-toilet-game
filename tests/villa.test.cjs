'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {start,KEY,delay}=require('./helpers.cjs');const G=require('../public/shared.js');
test('villa routes avoid walls and furniture, and all public rooms are reachable',()=>{
 const nav=require('../navigation.cjs')(G);assert.equal(G.DESKS.length,60);
 const from={x:0,z:39};
 for(const r of G.ROOMS.filter(r=>!r.base)){
  const target=nav.nearest({x:r.x,z:r.z+r.d/2-2},r,true),route=nav.path(from,target,true);assert.ok(route?.length,r.id+' route');
  let last=from;for(const [x,z] of route){const steps=Math.ceil(Math.hypot(x-last.x,z-last.z)*5);for(let i=0;i<=steps;i++)assert.ok(nav.walkable({x:last.x+(x-last.x)*i/(steps||1),z:last.z+(z-last.z)*i/(steps||1)},true),r.id+' clear segment');last={x,z};}
 }
 assert.equal(nav.nearest({x:29,z:-22},G.ROOMS.find(r=>r.id==='core'),false),null);
});
test('fill 50 is host-only, idempotent, counts queued bots, elects human chair and removes only bots',{timeout:110000},async t=>{
 const app=await start();t.after(()=>app.stop());const host=await app.connect({host:true,key:KEY}),human=await app.connect();
 human.send({t:'h.fillPlayers'});await delay(150);assert.equal((await app.connect()).welcome.s.players.length,0);
 host.send({t:'h.openLobby'});const open=(await host.wait(m=>m.t==='state'&&m.s.lobby.open)).s;await delay(open.lobby.openAt-Date.now()+50);
 human.send({t:'join',name:'真人設計師'});const you=(await human.wait('you')).you;
 for(let i=0;i<3;i++)host.send({t:'h.fillPlayers'});
 await host.wait(m=>m.t==='state'&&m.s.testPlayers.pending===49);
 let full=(await host.wait(m=>m.t==='state'&&m.s.players.length===50&&m.s.board.chair===you.id)).s;
 assert.equal(full.players.filter(p=>p.bot).length,49);assert.equal(full.testPlayers.pending,0);
 assert.equal(Object.values(full.board.votes).filter(v=>v===you.id).length,2);assert.ok(Object.entries(full.board.votes).every(([id,v])=>id!==v));
 host.send({t:'h.fillPlayers'});await delay(200);assert.equal((await app.connect()).welcome.s.players.length,50);
 const guest=await app.connect();guest.send({t:'join',name:'真人訪客'});const guestYou=(await guest.wait('you')).you;
 guest.send({t:'office.move',room:'grounds',x:29,z:-22});assert.match((await guest.wait('err')).msg,/僅董事長/);
 host.send({t:'h.settings',buildSec:60});host.send({t:'h.phase',phase:'build'});
 await host.wait(m=>m.t==='state'&&m.s.phase==='build'&&m.s.counts.A>3&&m.s.counts.B>3&&m.s.counts.C>3);
 const moving=(await app.connect()).welcome.s;assert.ok(moving.players.some(p=>p.bot&&p.motion.room!=='atrium'));assert.ok(moving.players.some(p=>p.bot&&p.motion.room===p.team));
 host.send({t:'h.removeBots'});const clean=(await host.wait(m=>m.t==='state'&&m.s.phase==='build'&&m.s.players.length===2&&m.s.testPlayers.active===0)).s;assert.deepEqual(clean.players.map(p=>p.id),[you.id,guestYou.id]);assert.equal(clean.testPlayers.pending,0);assert.equal(clean.counts.A,0);assert.equal(clean.counts.B,0);
 await delay(700);const snapshot=(await app.connect()).welcome;assert.equal(Object.keys(snapshot.builds.A).length,0);assert.equal(snapshot.s.players.length,2);
 fs.writeFileSync('artifacts/villa-bots-partial.json',JSON.stringify({passed:true,humansPreserved:2,testPlayers:49,checks:['host-only','repeat-idempotent','queued-capacity','human-chair-two-votes','no-self-vote','physical-work','AI-work','core-no-ground-bypass','remove-only-bots'],at:new Date().toISOString()},null,2));
});
test('empty lobby fills to 50 and test crew can complete every phase autonomously',{timeout:180000},async t=>{
 const app=await start();t.after(()=>app.stop());const host=await app.connect({host:true,key:KEY});host.send({t:'h.fillPlayers'});
 const full=(await host.wait(m=>m.t==='state'&&m.s.players.length===50&&!!m.s.board.chair)).s;assert.equal(full.players.filter(p=>p.bot).length,50);
 host.send({t:'h.settings',buildSec:60,posterSec:30});host.send({t:'h.phase',phase:'brief'});await host.wait(m=>m.t==='state'&&m.s.brief.choice!==null);
 host.send({t:'h.phase',phase:'build'});await host.wait(m=>m.t==='state'&&m.s.counts.A>5&&m.s.counts.B>5&&m.s.counts.C>5);
 host.send({t:'h.phase',phase:'review'});await host.wait(m=>m.t==='state'&&m.s.review.bossPick&&Object.values(m.s.review.tally).reduce((a,b)=>a+b,0)>40);
 host.send({t:'h.phase',phase:'poster'});await host.wait(m=>m.t==='state'&&m.s.poster.posters.filter(p=>p.submitted).length>0&&m.s.poster.surveyCount>15);
 host.send({t:'h.phase',phase:'gallery'});await host.wait(m=>m.t==='state'&&m.s.gallery.bossPick);
 host.send({t:'h.phase',phase:'launch'});const launch=(await host.wait(m=>m.t==='state'&&m.s.phase==='launch')).s;assert.ok(launch.launch.official);assert.ok(launch.launch.blocks>0);assert.equal(launch.players.length,50);
 fs.writeFileSync('artifacts/villa-bots-full.json',JSON.stringify({passed:true,players:50,phases:['election','brief','build','review','poster','gallery','launch'],at:new Date().toISOString()},null,2));
});
