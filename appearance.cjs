'use strict';
const {randomInt}=require('node:crypto');
module.exports=function({players,clients}){
 const SIZE=4096;
 function color(id){const h=(id*137.508)%360,s=62+(id%3)*9,l=51+(Math.floor(id/3)%3)*6;const a=s*Math.min(l,100-l)/100;const f=n=>{const k=(n+h/30)%12;return Math.round(255*(l-a*Math.max(-1,Math.min(k-3,9-k,1)))/100).toString(16).padStart(2,'0');};return '#'+f(0)+f(8)+f(4);}
 function look(id){return{id,body:id%4,hat:Math.floor(id/4)%8,pack:Math.floor(id/32)%4,face:Math.floor(id/128)%4,pattern:Math.floor(id/512)%8};}
 function used(field,except){const out=new Set(players().filter(p=>!p.kicked&&p!==except).map(p=>p.appearance?.[field]).filter(v=>v!=null));for(const c of clients())if(c.offer?.expires>Date.now())for(const v of c.offer[field==='lookId'?'looks':'colors'])out.add(v.id);return out;}
 function free(set){let id=randomInt(SIZE);for(let i=0;i<SIZE;i++,id=(id+1)%SIZE)if(!set.has(id)){set.add(id);return id;}throw Error('Appearance pool exhausted');}
 function offer(c){c.offer=null;const ls=used('lookId'),cs=used('colorId');const taken=new Set(players().filter(p=>!p.kicked).map(p=>p.appearance?.color));c.offer={expires:Date.now()+300000,looks:Array.from({length:3},()=>look(free(ls))),colors:Array.from({length:3},()=>{let id;do{id=free(cs);}while(taken.has(color(id)));taken.add(color(id));return{id,hex:color(id)};})};return c.offer;}
 function choose(c,m={}){let li,ci;if(m.lookId!=null||m.colorId!=null){if(!c.offer||c.offer.expires<Date.now()||!c.offer.looks.some(l=>l.id===m.lookId)||!c.offer.colors.some(l=>l.id===m.colorId))return null;li=m.lookId;ci=m.colorId;if(players().some(p=>!p.kicked&&(p.appearance?.lookId===li||p.appearance?.color===color(ci))))return null;}else{li=free(used('lookId'));const cs=used('colorId'),taken=new Set(players().filter(p=>!p.kicked).map(p=>p.appearance?.color));do{ci=free(cs);}while(taken.has(color(ci)));}c.offer=null;return{lookId:li,colorId:ci,color:color(ci),...look(li)};}
 // Preserve saved outfits; assign a distinct outfit to older saved players.
 for(const p of players())if(!p.kicked&&!p.appearance)p.appearance=choose({});
 return{offer,choose};
};
