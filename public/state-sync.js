/* Versioned snapshot deltas. Transport state is isolated from UI interpolation. */
(function(root){
 'use strict';
 const copy=value=>JSON.parse(JSON.stringify(value));
 function diff(before,after,path=[],out=[]){
  if(before===after)return out;
  if(before&&after&&typeof before==='object'&&typeof after==='object'&&Array.isArray(before)===Array.isArray(after)&&(!Array.isArray(after)||before.length===after.length)){
   for(const key of Object.keys(before))if(!Object.hasOwn(after,key))out.push([path.concat(key)]);
   for(const key of Object.keys(after)){
    if(!Object.hasOwn(before,key))out.push([path.concat(key),after[key]]);
    else diff(before[key],after[key],path.concat(key),out);
   }
  }else out.push([path,after]);
  return out;
 }
 function apply(value,changes){
  for(const [path,next]of changes){
   if(!path.length){value=copy(next);continue;}
   if(path.some(k=>['__proto__','prototype','constructor'].includes(k)))throw Error('Invalid state path');
   let target=value;for(let i=0;i<path.length-1;i++)target=target[path[i]];
   if(next===undefined)delete target[path.at(-1)];else target[path.at(-1)]=copy(next);
  }
  return value;
 }
 class Receiver{
  constructor(){this.streams=new Map();}
  receive(m){
   if(m.t==='delta'){
    const previous=this.streams.get(m.channel);
    if(!previous||previous.rev!==m.base)return null;
    const s=apply(previous.s,m.changes);this.streams.set(m.channel,{rev:m.rev,s});
    return{t:m.channel,s:copy(s)};
   }
   if(m.rev&&m.s)this.streams.set(m.t,{rev:m.rev,s:copy(m.s)});
   return m;
  }
 }
 const api={diff,apply,Receiver};if(typeof module!=='undefined')module.exports=api;else root.StateSync=api;
})(typeof globalThis==='undefined'?this:globalThis);
