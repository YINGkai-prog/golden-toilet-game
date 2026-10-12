'use strict';
// Local-only, unmodified production server; 50 real player sockets + host/projector.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {start,KEY,delay}=require('./helpers.cjs');
const {Receiver}=require('../public/state-sync.js');
const duration=Number(process.env.DURATION_MS||1800000);
const out=path.resolve(__dirname,'../artifacts'), peers=[],totals={},phases={},rtts=[],errors=[];
let app,state,started=0,phase='setup',finished=false;
function bump(table,key,bytes){const a=table[key]||(table[key]={messages:0,payloadBytes:0,frameBytes:0});a.messages++;a.payloadBytes+=bytes;a.frameBytes+=bytes+(bytes<126?2:bytes<65536?4:10);}
async function connect(label,hello={}){
 const ws=new WebSocket(app.base.replace('http:','ws:')+'/ws'), p={label,ws,receiver:new Receiver(),bytes:0,messages:0,pending:[],queue:[]};peers.push(p);
 p.send=m=>ws.send(JSON.stringify(m));
 p.wait=pred=>{const i=p.queue.findIndex(pred);if(i>=0)return Promise.resolve(p.queue.splice(i,1)[0]);return new Promise((resolve,reject)=>{const w={pred,resolve,timer:setTimeout(()=>reject(Error('timeout '+label)),20000)};p.pending.push(w);});};
 ws.addEventListener('message',e=>{const bytes=Buffer.byteLength(e.data),raw=JSON.parse(e.data);p.bytes+=bytes;p.messages++;bump(totals,raw.t==='delta'?'delta:'+raw.channel:raw.t,bytes);bump(phases,phase,bytes);const m=p.receiver.receive(raw);if(!m){errors.push({label,type:'revision-mismatch',channel:raw.channel});p.send({t:'sync',channel:raw.channel});return;}if(label==='host'&&['state','welcome'].includes(m.t)&&m.s){state=m.s;phase=state.phase;}if(m.t==='you')p.you=m.you;if(m.t==='pong')rtts.push(Date.now()-m.n);const i=p.pending.findIndex(w=>w.pred(m));if(i>=0){const w=p.pending.splice(i,1)[0];clearTimeout(w.timer);w.resolve(m);}else if(['welcome','you','appearance.offer'].includes(m.t)){p.queue.push(m);}});
 ws.addEventListener('close',()=>{if(!finished)errors.push({label,type:'unexpected-close',at:Date.now()});});
 await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});p.send({t:'hello',office:true,stateDelta:1,...hello});p.welcome=await p.wait(m=>m.t==='welcome');return p;
}
(async()=>{try{
 fs.mkdirSync(out,{recursive:true});
 app=await start();fs.writeFileSync(path.join(out,'bandwidth-session.json'),JSON.stringify({base:app.base,key:KEY,startedAt:new Date().toISOString(),pid:process.pid}));
 const host=await connect('host',{host:true,key:KEY});await connect('projector');host.send({t:'h.openLobby'});await delay(4000);
 for(let i=0;i<50;i++){const p=await connect('player-'+(i+1));p.send({t:'join',name:'實測同仁'+String(i+1).padStart(2,'0')});p.you=(await p.wait(m=>m.t==='you')).you;}
 console.log('JOINED',peers.length,'real WebSockets,',state?.players?.length,'players');
 const players=peers.slice(2);players[1].send({t:'board.vote',candidate:players[0].you.id,round:state.board.round});players[2].send({t:'board.vote',candidate:players[0].you.id,round:state.board.round});
 await delay(500);const setupPayloadBytes=peers.reduce((n,p)=>n+p.bytes,0);started=Date.now();host.send({t:'h.startShow',auto:true});
 let lastMinute=-1,tenMinutes=null;const samples=[];
 while(Date.now()-started<duration){
  await delay(1000);const elapsed=Date.now()-started;
  if(!tenMinutes&&elapsed>=600000){tenMinutes={elapsedMs:elapsed,payloadBytes:peers.reduce((n,p)=>n+p.bytes,0),frameBytes:Object.values(totals).reduce((n,v)=>n+v.frameBytes,0),phase:state.phase,counts:state.counts};fs.writeFileSync(path.join(out,'bandwidth-ten-minute-checkpoint.json'),JSON.stringify(tenMinutes,null,2));}
  // Ping every connected player. Ping does not suppress the game's existing AI assistance.
  for(const p of players)p.send({t:'ping',n:Date.now()});
  // Real chat traffic from rotating player sockets, while built-in AI assistance exercises tasks.
  if(Math.floor(elapsed/1000)%12===0){const p=players[Math.floor(elapsed/12000)%50];p.send({t:'chat.send',text:'馬桶專案進度回報：大家加油！🚽'});}
  const minute=Math.floor(elapsed/60000);if(minute!==lastMinute){lastMinute=minute;const row={elapsedMs:elapsed,phase:state?.phase,connections:peers.filter(p=>p.ws.readyState===1).length,players:state?.players?.length,counts:state?.counts,totalPayloadBytes:peers.reduce((n,p)=>n+p.bytes,0)};samples.push(row);console.log(JSON.stringify(row));fs.writeFileSync(path.join(out,'bandwidth-progress.json'),JSON.stringify({samples,types:totals},null,2));}
 }
 fs.writeFileSync(path.join(out,'bandwidth-timing.json'),JSON.stringify({setupPayloadBytes,startedAt:started,endedAt:Date.now(),tenMinutes,finalState:{phase:state.phase,show:state.show,counts:state.counts,players:state.players.length}},null,2));rtts.sort((a,b)=>a-b);finished=true;
 const report={at:new Date().toISOString(),release:'office-performance-2026.10.12',sourceSha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(out,'../server.js'))).digest('hex'),scenario:'50 real player WebSockets plus host and projector; unmodified server, 1800 real seconds (default), existing AI takeover after inactivity, rotating scripted chat, 1 Hz local RTT probes. Not 50 rendered browsers.',durationMs:Date.now()-started,connections:52,playerCount:state?.players?.length,finalPhase:state?.phase,completedShow:!!state?.show?.completedAt,buildCounts:state?.counts,posterCount:state?.poster?.posters?.length,totals,phases,samples,peers:peers.map(p=>({label:p.label,payloadBytes:p.bytes,messages:p.messages})),payloadBytes:peers.reduce((n,p)=>n+p.bytes,0),websocketFrameBytes:Object.values(totals).reduce((n,v)=>n+v.frameBytes,0),rtt:{samples:rtts.length,p50:rtts[Math.floor(rtts.length*.5)],p95:rtts[Math.floor(rtts.length*.95)],max:rtts.at(-1)},errors,limitations:['Local loopback latency is not Taiwan-to-Singapore latency.','Counts WS application payload and frame headers, not TLS/TCP/IP, HTTP assets or platform billing adjustments.','AI-assisted scripted workload is a reproducible scenario, not a guarantee of all human behavior.']};
 fs.writeFileSync(path.join(out,'bandwidth-50-30min.json'),JSON.stringify(report,null,2));console.log('COMPLETE',JSON.stringify({payloadBytes:report.payloadBytes,frameBytes:report.websocketFrameBytes,phase:report.finalPhase,rtt:report.rtt,errors}));
 }finally{finished=true;for(const p of peers)p.ws.close();await app?.stop();}})().catch(e=>{console.error(e);process.exitCode=1;});
