'use strict';
const{test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');const{start,join50,KEY,delay}=require('./helpers.cjs');
test('a real idle WebSocket player is assisted after 30s, moves and builds, immediately returns to human control',{timeout:100000},async t=>{
 const app=await start();t.after(()=>app.stop());const host=await app.connect({host:true,key:KEY}),{peers,state}=await join50(app,host);const index=state.players.findIndex(p=>p.rank==='staff'&&p.team==='A'),peer=peers[index],id=peer.you.id;
 peers[1].send({t:'board.vote',candidate:peers[0].you.id,round:state.board.round});peers[2].send({t:'board.vote',candidate:peers[0].you.id,round:state.board.round});await host.wait(m=>m.t==='state'&&m.s.board.chair===peers[0].you.id);
 host.send({t:'h.phase',phase:'build'});await host.wait(m=>m.t==='state'&&m.s.phase==='build');peer.send({t:'office.move',room:'courtyard',x:4,z:7});await peer.wait(m=>m.t==='state'&&m.s.players.find(p=>p.id===id)?.motion.room==='courtyard');peer.send({t:'input.active'});peer.idle();const idleAt=Date.now();await delay(12000);
 const taken=(await host.wait(m=>m.t==='state'&&m.s.players.find(p=>p.id===id)?.aiControlled)).s;assert.ok(Date.now()-idleAt>=29800);assert.equal(taken.players.find(p=>p.id===id).bot,false);
 const worked=(await host.wait(m=>m.t==='state'&&m.s.players.find(p=>p.id===id)?.owned>0)).s;assert.equal(worked.players.find(p=>p.id===id).motion.room,'A');peer.send({t:'input.active'});
 const back=(await peer.wait(m=>m.t==='state'&&m.s.players.find(p=>p.id===id)?.aiControlled===false)).s;assert.equal(back.players.find(p=>p.id===id).bot,false);host.send({t:'h.removeBots'});await delay(600);assert.equal((await app.connect()).welcome.s.players.length,50);
 fs.writeFileSync('artifacts/assistance-verification.json',JSON.stringify({passed:true,realSockets:50,checks:['30s-real-clock','AI-moves-and-builds','human-immediately-regains-control','human-not-test-bot','remove-bots-preserves-all-humans'],at:new Date().toISOString()},null,2));
});
