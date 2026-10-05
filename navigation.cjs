'use strict';
// A small, deterministic campus grid. Furniture and walls share their footprints
// with the renderer, so a mouse destination never becomes a wall-crossing shortcut.
module.exports = function navigation(G) {
  const minX=-63,maxX=63,minZ=-58,maxZ=72,W=maxX-minX+1,H=maxZ-minZ+1;
  const core=G.ROOMS.find(r=>r.id==='core');
  const inside=(p,r,pad=0)=>Math.abs(p.x-r.x)<r.w/2+pad&&Math.abs(p.z-r.z)<r.d/2+pad;
  const solids=[...G.WALLS,...G.SOLIDS];
  const index=(x,z)=>(z-minZ)*W+x-minX;
  const point=i=>({x:i%W+minX,z:Math.floor(i/W)+minZ});
  const blocked=new Uint8Array(W*H);
  for(let z=minZ;z<=maxZ;z++)for(let x=minX;x<=maxX;x++)blocked[index(x,z)]=solids.some(r=>inside({x,z},r,.36));
  function walkable(p,allowCore=false) {
    return p.x>=minX&&p.x<=maxX&&p.z>=minZ&&p.z<=maxZ &&
      (allowCore||!inside(p,core,.15))&&!solids.some(r=>inside(p,r,.35));
  }
  const roomAt=p=>G.ROOMS.find(r=>!r.base&&inside(p,r))||G.ROOMS.find(r=>r.base);
  function nearest(p,room,allowCore) {
    let best=null,score=Infinity;
    for(let z=Math.max(minZ,Math.ceil(room?room.z-room.d/2+.6:p.z-5));z<=Math.min(maxZ,Math.floor(room?room.z+room.d/2-.6:p.z+5));z++)
      for(let x=Math.max(minX,Math.ceil(room?room.x-room.w/2+.6:p.x-5));x<=Math.min(maxX,Math.floor(room?room.x+room.w/2-.6:p.x+5));x++) {
        const i=index(x,z),d=(x-p.x)**2+(z-p.z)**2;
        if(d>=score||blocked[i]||!allowCore&&inside({x,z},core,.15))continue;
        best={x,z};score=d;
      }
    return best;
  }
  function clear(a,b,allowCore) {
    // Exact swept segment / expanded rectangle intersection, including corners.
    for(const r of allowCore?solids:[...solids,core]) {
      let enter=0,leave=1;
      for(const [axis,size] of [['x','w'],['z','d']]) {
        const lo=r[axis]-r[size]/2-.36,hi=r[axis]+r[size]/2+.36,d=b[axis]-a[axis];
        if(Math.abs(d)<1e-9){if(a[axis]<=lo||a[axis]>=hi){enter=2;break;}}
        else {const p=(lo-a[axis])/d,q=(hi-a[axis])/d;enter=Math.max(enter,Math.min(p,q));leave=Math.min(leave,Math.max(p,q));}
      }
      if(enter<=leave)return false;
    }
    return true;
  }
  function path(from,to,allowCore=false) {
    const start=nearest(from,null,allowCore),end=nearest(to,null,allowCore);if(!start||!end)return null;
    const si=index(start.x,start.z),ei=index(end.x,end.z),prev=new Int32Array(W*H).fill(-1),queue=new Int32Array(W*H);
    let head=0,tail=1;queue[0]=si;prev[si]=si;
    while(head<tail&&prev[ei]===-1) {
      const cur=queue[head++],x=cur%W,z=Math.floor(cur/W);
      for(const next of [x>0?cur-1:-1,x<W-1?cur+1:-1,z>0?cur-W:-1,z<H-1?cur+W:-1]) {
        if(next<0||blocked[next]||prev[next]!==-1||!allowCore&&inside(point(next),core,.15))continue;
        prev[next]=cur;queue[tail++]=next;
      }
    }
    if(prev[ei]===-1)return null;
    const raw=[];let i=ei;while(i!==si){raw.push(point(i));i=prev[i];}raw.push(start);raw.reverse();
    const smooth=[];let anchor=from,k=0;
    while(k<raw.length){let last=k;while(last+1<raw.length&&clear(anchor,raw[last+1],allowCore))last++;smooth.push([raw[last].x,raw[last].z]);anchor=raw[last];k=last+1;}
    return smooth;
  }
  return {path,nearest,walkable,roomAt,insideCore:p=>inside(p,core)};
};
