'use strict';
// Server-authoritative, swept-circle traffic. A move never intersects another actor.
module.exports=({getGame,nav,clock=Date.now})=>{
 const radius=p=>p.play?.carId?1.8:p.arrival?.stage==='road'&&['car','scooter','horse','bicycle'].includes(p.arrival.mode)?1.45:.63;
 const peers=p=>Object.values(getGame().players).filter(q=>q!==p&&!q.kicked&&q.motion);
 function clear(p,to){const from=p.motion,dx=to.x-from.x,dz=to.z-from.z,l=dx*dx+dz*dz;
  if(!nav.walkable(to,p.rank==='boss'||nav.insideCore(from),p.indoorBanUntil>clock())||!nav.clear(from,to,p.rank==='boss'||nav.insideCore(from),p.indoorBanUntil>clock()))return false;
  return peers(p).every(q=>{const t=l?Math.max(0,Math.min(1,((q.motion.x-from.x)*dx+(q.motion.z-from.z)*dz)/l)):0;return Math.hypot(from.x+t*dx-q.motion.x,from.z+t*dz-q.motion.z)>=radius(p)+radius(q)-.001;});
 }
 function target(p,to,r){const others=peers(p),free=v=>others.every(q=>{const end=q.motion.path?.at(-1)||[q.motion.x,q.motion.z];return Math.hypot(v.x-end[0],v.z-end[1])>=radius(p)+radius(q)+.08;});if(free(to))return to;
  for(let d=1.5;d<=14;d+=1.5)for(let i=0;i<16;i++){const a=i*Math.PI/8,v=nav.nearest({x:to.x+Math.cos(a)*d,z:to.z+Math.sin(a)*d},r,p.rank==='boss',p.indoorBanUntil>clock());if(v&&free(v))return v;}return null;
 }
 function advance(p,to,step){const m=p.motion,dx=to.x-m.x,dz=to.z-m.z,d=Math.hypot(dx,dz);if(d<.12||p.arrival?.stage==='road'&&d<2.7)return true;if(m.path.length>1&&d<1.2&&nav.clear(m,{x:m.path[1][0],z:m.path[1][1]},p.rank==='boss'))return true;const n=Math.min(d,step),angle=Math.atan2(dz,dx);
  const key=to.x+','+to.z;if(p.routeProgress?.key!==key||d<p.routeProgress.distance-.3)p.routeProgress={key,distance:d,at:clock()};
  if(clock()-p.routeProgress.at>1400){p.routeProgress.at=clock();const end=m.path.at(-1),path=nav.path(m,{x:end[0],z:end[1]},p.rank==='boss'||nav.insideCore(m),p.indoorBanUntil>clock(),peers(p).map(q=>({x:q.motion.x,z:q.motion.z,r:radius(p)+radius(q)})));if(path?.length){m.path=path;return false;}}
  for(const turn of [0,.4,-.4,.8,-.8,1.2,-1.2,1.55,-1.55]){const v={x:m.x+Math.cos(angle+turn)*n,z:m.z+Math.sin(angle+turn)*n};if(clear(p,v)){m.x=v.x;m.z=v.z;return turn===0&&d<=step;}}
  return false;
 }
 return{radius,clear,target,advance};
};
