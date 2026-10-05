'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {start,join50,KEY}=require('./helpers.cjs');
test('50 independent connections retain roles and complete the product workflow', {timeout:60000}, async t=>{
  const app=await start();t.after(()=>app.stop());
  const host=await app.connect({host:true,key:KEY,office:true});
  assert.equal(host.welcome.host,true);
  const info=await (await fetch(app.base+'/api/info')).json();
  assert.equal(info.release,'office-2026.10.05');
  for(const url of ['/','/host','/common.css','/theme.css','/office.js','/player.js','/host.js','/shared.js','/three.min.js']){
    const response=await fetch(app.base+url);assert.equal(response.status,200,url);assert.ok((await response.text()).length>100,url);
  }
  for(const f of fs.readdirSync(path.join(__dirname,'../public')).filter(f=>f.endsWith('.js'))){
    new vm.Script(fs.readFileSync(path.join(__dirname,'../public',f),'utf8'),{filename:f});
  }
  const {peers,state}=await join50(app,host);
  assert.equal(state.players.length,50);
  assert.equal(new Set(state.players.map(p=>p.id)).size,50);
  assert.equal(state.players[0].rank,'boss');
  assert.deepEqual(state.players.slice(1,4).map(p=>p.rank),['lead','lead','lead']);
  assert.equal(state.players[49].rank,'staff');
  assert.ok(state.players.every((p,i)=>p.id===peers[i].you.id&&p.joinIdx===i+1));
  const reconnect=await app.connect({token:peers[49].you.token,office:true});
  assert.equal(reconnect.welcome.you.id,peers[49].you.id);
  assert.equal(reconnect.welcome.s.players.length,50);
  assert.equal(reconnect.welcome.s.players[49].rank,'staff');
  const connectionFor=p=>peers.find(q=>q.you.id===p.id);
  const builder=connectionFor(state.players.find(p=>p.rank==='staff'&&p.team==='A'));
  const manager=connectionFor(state.players.find(p=>p.rank==='manager'&&p.team==='A'));
  const maker=connectionFor(state.players.find(p=>p.team==='M'));
  const boss=peers[0];
  host.send({t:'h.phase',phase:'build'});
  await host.wait(m=>m.t==='state'&&m.s.phase==='build');
  builder.send({t:'place',x:0,y:0,z:0,c:4});
  const placed=await host.wait(m=>m.t==='ops'&&m.team==='A'&&m.ops.some(o=>o[0]===1));
  assert.equal(placed.ops[0][5],builder.you.id);
  manager.send({t:'remove',x:0,y:0,z:0});
  const removed=await host.wait(m=>m.t==='ops'&&m.team==='A'&&m.ops.some(o=>o[0]===0));
  assert.equal(removed.ops[0][4],manager.you.id);
  assert.equal(removed.ops[0][5],builder.you.id);
  host.send({t:'h.phase',phase:'review'});
  await host.wait(m=>m.t==='state'&&m.s.phase==='review');
  builder.send({t:'vote',team:'B'});
  await host.wait(m=>m.t==='act'&&m.k==='vote'&&m.id===builder.you.id);
  boss.send({t:'bossPick',team:'B'});
  await host.wait(m=>m.t==='state'&&m.s.review.bossPick==='B');
  host.send({t:'h.phase',phase:'poster'});
  await host.wait(m=>m.t==='state'&&m.s.phase==='poster');
  maker.send({t:'poster',img:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==',name:'金盒一號',slogan:'一起完成的馬桶',final:true});
  await host.wait(m=>m.t==='fx'&&m.kind==='posterDone');
  const poster=await fetch(app.base+'/poster/'+maker.you.id+'.jpg');
  assert.equal(poster.status,200);assert.match(poster.headers.get('content-type'),/image\/png/);
  host.send({t:'h.phase',phase:'gallery'});await host.wait(m=>m.t==='state'&&m.s.phase==='gallery');
  boss.send({t:'gpick',author:maker.you.id});await host.wait(m=>m.t==='state'&&m.s.gallery.bossPick===maker.you.id);
  host.send({t:'h.phase',phase:'launch'});
  const launch=(await host.wait(m=>m.t==='state'&&m.s.phase==='launch')).s;
  assert.equal(launch.launch.winner,'B');assert.equal(launch.launch.official,maker.you.id);
  const denied=await fetch(app.base+'/api/results.zip?key=wrong');assert.equal(denied.status,403);
  const zip=await fetch(app.base+'/api/results.zip?key='+KEY);assert.equal(zip.status,200);
  assert.equal(launch.players.length,50);
});

