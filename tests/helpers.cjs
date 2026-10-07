'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');
const { setTimeout: delay } = require('node:timers/promises');
const ROOT = path.resolve(__dirname, '..');
const KEY = 'isolated-office-test';
async function start() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'golden-office-test-'));
  fs.copyFileSync(path.join(ROOT, 'server.js'), path.join(tmp, 'server.js'));
  fs.copyFileSync(path.join(ROOT,'simulation.cjs'),path.join(tmp,'simulation.cjs'));
  fs.copyFileSync(path.join(ROOT,'navigation.cjs'),path.join(tmp,'navigation.cjs'));
  for(const file of ['golf.cjs','play.cjs','brief.cjs','appearance.cjs','recreation.cjs','campus.cjs','workflow.cjs','traffic.cjs','market.cjs','party.cjs','engagement.cjs'])fs.copyFileSync(path.join(ROOT,file),path.join(tmp,file));
  fs.cpSync(path.join(ROOT, 'public'), path.join(tmp, 'public'), { recursive: true });
  const port = await new Promise(resolve => { const s = net.createServer(); s.listen(0,'127.0.0.1',()=>{ const p=s.address().port;s.close(()=>resolve(p)); }); });
  // A file log also works in Windows sandboxes that cannot create Node pipes.
  const logPath = path.join(tmp, 'server.log');
  const logFd = fs.openSync(logPath, 'a');
  let child;
  try {
    child = spawn(process.execPath, [path.join(tmp,'server.js')], { cwd: tmp, env: { ...process.env, PORT:String(port),HOST_KEY:KEY,CLOUD:'1' }, stdio:['ignore',logFd,logFd], windowsHide:true });
  } finally { fs.closeSync(logFd); }
  let launchError = null;
  child.once('error', error => { launchError = error; });
  const base = 'http://127.0.0.1:' + port;
  const peers = [];
  const stop = async () => {
    for (const p of peers) p.close();
    if (child.pid && child.exitCode === null && !child.killed) { const done = new Promise(r=>child.once('exit',r)); child.kill('SIGTERM'); await done; }
    if (tmp.startsWith(path.join(os.tmpdir(),'golden-office-test-'))) fs.rmSync(tmp,{recursive:true,force:true});
  };
  let ready=false;
  for(let i=0;i<100;i++){if(launchError || child.exitCode!==null)break;try{if((await fetch(base+'/api/info')).ok){ready=true;break;}}catch{}await delay(100);}
  if(!ready){const logs=fs.readFileSync(logPath,'utf8');await stop();throw new Error('Server failed: '+(launchError || logs));}
  return { base, stop, connect:async hello=>{
    const p = await connect(base,hello);peers.push(p);return p;
  }};
}
async function connect(base,hello={}) {
  const activeTimer=setInterval(()=>{if(ws.readyState===1)ws.send(JSON.stringify({t:"input.active"}));},10000);
  const ws = new WebSocket(base.replace('http:','ws:')+'/ws');
  const queue = []; const pending = [];
  ws.addEventListener('message',e=>{
    const m=JSON.parse(e.data);
    const i=pending.findIndex(w=>w.match(m));
    if(i>=0){const w=pending.splice(i,1)[0];clearTimeout(w.timer);w.resolve(m);}
    else { queue.push(m);if(queue.length>500)queue.shift(); }
  });
  const wait=match=>{
    if(typeof match==='string'){const type=match;match=m=>m.t===type;}
    const i=queue.findIndex(match);if(i>=0)return Promise.resolve(queue.splice(i,1)[0]);
    return new Promise((resolve,reject)=>{const item={match,resolve,reject};item.timer=setTimeout(()=>{const n=pending.indexOf(item);if(n>=0)pending.splice(n,1);reject(new Error('Timed out: '+match.toString()+'; recent: '+JSON.stringify(queue.slice(-3).map(m=>({t:m.t,msg:m.msg})))));},60000);pending.push(item);});
  };
  await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('WebSocket open timeout')),10000);
    ws.addEventListener('open',()=>{clearTimeout(timer);resolve();},{once:true});
    ws.addEventListener('error',()=>{clearTimeout(timer);reject(new Error('WebSocket error'));},{once:true});
  });
  activeTimer.unref();
  const peer={idle:()=>clearInterval(activeTimer),send:m=>ws.send(JSON.stringify(m)),wait,close:()=>{clearInterval(activeTimer);for(const w of pending){clearTimeout(w.timer);w.reject(new Error('Peer closed'));}pending.length=0;ws.close();},queue};
  peer.send({t:'hello',...hello});
  peer.welcome=await wait('welcome');
  return peer;
}
async function join50(app,host){
  const peers = await Promise.all(Array.from({length:50},()=>app.connect()));
  host.send({t:'h.openLobby'});
  const open = await host.wait(m=>m.t==='state'&&m.s.lobby.open);
  await delay(Math.max(0,open.s.lobby.openAt-Date.now())+50);
  for(let i=0;i<peers.length;i++){peers[i].send({t:'join',name:'同仁'+String(i+1).padStart(2,'0')});peers[i].you=(await peers[i].wait('you')).you;}
  const state=(await host.wait(m=>m.t==='state'&&m.s.players.length===50)).s;
  return {peers,state};
}
module.exports={start,join50,KEY,delay};

