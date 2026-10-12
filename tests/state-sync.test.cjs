const {test}=require('node:test'),assert=require('node:assert/strict');
const {diff,apply,Receiver}=require('../public/state-sync.js');
const {start,KEY,delay}=require('./helpers.cjs');
test('snapshot patches preserve additions, removals, nulls, arrays and game reset',()=>{
 const receiver=new Receiver();let before={players:[],phase:'lobby'};
 receiver.receive({t:'state',rev:1,s:before});
 const snapshots=[{players:[{id:'a',motion:{x:1.27,z:-5},nickname:null}],phase:'build',banner:'hello'},
 {players:[{id:'a',motion:{x:4,z:0},nickname:'first'}],phase:'review',values:[1,2]},
 {players:[],phase:'lobby',values:[]},{}];
 for(const [i,next]of snapshots.entries()){
  const changes=diff(before,next),m=receiver.receive({t:'delta',channel:'state',base:i+1,rev:i+2,changes});
  assert.deepEqual(m.s,next);assert.deepEqual(apply(structuredClone(before),changes),next);
  m.s.uiMutation=true;before=next;
 }
 assert.equal(receiver.receive({t:'delta',channel:'state',base:1,rev:20,changes:[]}),null);
});
test('independent streams and full repair cannot leak UI mutations',()=>{
 const r=new Receiver(),s={players:[{motion:{x:1}}]};r.receive({t:'state',rev:1,s});s.players[0].motion.x=99;
 r.receive({t:'play.frame',rev:100,s:{cars:[]}});
 assert.deepEqual(r.receive({t:'delta',channel:'state',base:1,rev:2,changes:[]}).s,{players:[{motion:{x:1}}]});
 assert.equal(r.receive({t:'delta',channel:'state',base:3,rev:4,changes:[]}),null);
 r.receive({t:'state',rev:8,s:{phase:'launch'}});
 assert.deepEqual(r.receive({t:'delta',channel:'state',base:8,rev:9,changes:[]}).s,{phase:'launch'});
});
test('50-row moving roster round-trips and reduces repeated state',()=>{
 const a={players:Array.from({length:50},(_,i)=>({id:'p'+i,name:'同仁'+i,appearance:{color:'#98aabb',body:1,hat:5},title:'研發工程師',motion:{x:i,z:2},play:{toilet:{phase:'waiting',dueAt:1000000+i}}}))};
 const b=structuredClone(a);b.players.forEach((p,i)=>p.motion.x+=i/100);
 const changes=diff(a,b);assert.deepEqual(apply(structuredClone(a),changes),b);
 assert.ok(JSON.stringify(changes).length<JSON.stringify(b).length*.4);
});
test('real sockets deliver equivalent legacy and delta states and recover a missing revision',{timeout:30000},async()=>{
 const app=await start();let ws;
 try{
  const host=await app.connect({host:true,key:KEY});
  const receiver=new Receiver(),received=[],packets=[];let missed=false,skip=false;
  ws=new WebSocket(app.base.replace('http:','ws:')+'/ws');
  ws.onmessage=e=>{const m=JSON.parse(e.data);packets.push(m);if(skip&&m.t==='delta'&&m.channel==='state'){skip=false;missed=true;return;}const normalized=receiver.receive(m);if(!normalized){ws.send(JSON.stringify({t:'sync',channel:m.channel}));return;}if(normalized.t==='state')received.push(normalized.s);};
  await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});ws.send(JSON.stringify({t:'hello',stateDelta:1}));
  for(let i=0;i<4;i++){host.send({t:'h.openLobby'});const state=(await host.wait(m=>m.t==='state'&&m.s.lobby.open)).s;for(let n=0;n<50&&!received.some(s=>s.serverNow===state.serverNow);n++)await delay(20);assert.deepEqual(received.find(s=>s.serverNow===state.serverNow),state);await delay(600);}
  assert.ok(packets.some(m=>m.t==='delta'&&m.channel==='state'));
  skip=true;host.send({t:'h.closeLobby'});await delay(600);host.send({t:'h.openLobby'});await delay(600);host.send({t:'h.closeLobby'});await delay(1000);
  assert.ok(missed);assert.equal(received.at(-1).lobby.open,false);
  assert.ok(packets.filter(m=>m.t==='state'&&m.rev).length>=2,'full snapshot repaired missing base');
 }finally{ws?.close();await app.stop();}
});
