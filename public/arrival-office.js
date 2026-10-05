/* Shared arrivals, assigned desks, physical exhibition and the poster sky gallery. */
(()=>{'use strict';const T=THREE,Base=window.Office,G=GAME;
window.Office=class extends Base{
 constructor(el,move){super(el,move);this.exhibits=[];this.posterPage=-1;this.makeExhibition();this.makePosterSky();this.makeDeskGuide();this.perf={frames:0,start:performance.now()+6000};}
 avatar(p){const a=super.avatar(p),mount=new T.Group();a.group.add(mount);a.mount=mount;
  const mode=p.arrival?.mode||'run',color=p.appearance?.color||'#b8d5ca';
  const box=(c,x,y,z,w,h,d)=>this.box(c,x,y,z,w,h,d,mount),ball=(c,x,y,z,w,h,d)=>this.ball(c,x,y,z,w,h,d,mount);
  const wheel=(x,z,r=.38)=>{const m=this.cylinder('#18272d',x,r,z,r,.16,mount);m.rotation.z=Math.PI/2;return m;};
  if(mode==='car'){box(color,0,.8,0,2.3,.85,4);box('#385965',0,1.55,-.35,2,.68,2);box('#b8d9d6',0,1.4,.67,1.8,.45,.08);for(const x of[-1.15,1.15])for(const z of[-1.25,1.25])wheel(x,z,.46);for(const x of[-.75,.75])box('#ffe7ae',x,.83,2.02,.45,.2,.04);}
  if(mode==='scooter'||mode==='bicycle'){for(const z of[-.85,.85])wheel(0,z,mode==='bicycle'?.51:.38);box(color,0,.65,0,.45,.18,1.5);box('#aec4c4',0,1.1,.66,.09,.95,.09);box('#bbc6be',0,1.55,.65,.95,.09,.09);box('#20383c',0,1.05,-.4,.45,.15,.65);if(mode==='scooter')box(color,0,.92,.57,.72,.92,.2);}
  if(mode==='horse'){ball('#9b7860',0,1.05,0,.6,.6,1.25);ball('#b69976',0,1.92,.95,.33,.65,.32);ball('#ac8a65',0,2.29,1.2,.37,.33,.58);for(const x of[-.37,.37])for(const z of[-.78,.78])box('#604b3b',x,.55,z,.19,1,.23);box('#293235',0,1.6,0,.8,.12,.76);for(const x of[-.2,.2])box('#795c43',x,2.64,1.08,.15,.4,.16);box('#493b33',0,1.06,-1.3,.16,1.1,.16);}
  for(const m of [...mount.children])m.userData.vehicle=true;this.actorBatchDirty=true;return a;
 }
 animateActor(a,time,moving){const mode=a.p.arrival?.mode,arriving=a.p.arrival&&a.p.arrival.stage!=='done',mounted=arriving&&a.p.arrival.stage==='road'&&['car','scooter','bicycle','horse'].includes(mode);a.mount?.scale.setScalar(mounted?1:0);
  a.body.rotation.x=0;if(mounted){a.body.position.y=mode==='horse'?1.1:mode==='car'?.6:.25;a.limbs.forEach((l,i)=>l.rotation.x=i%2?-1.2:-.65);}
  if(arriving&&mode==='crawl'){a.body.rotation.x=Math.PI/2;a.body.position.y=.6;a.limbs.forEach((l,i)=>l.rotation.x=Math.PI/2+Math.sin(time*.009+a.seed+i)*.2);}
 }
 makeDeskGuide(){this.deskMarker=new T.Mesh(new T.RingGeometry(.85,1.04,28),new T.MeshBasicMaterial({color:'#c5f9c2',side:T.DoubleSide,transparent:true,opacity:.85,depthWrite:false}));this.deskMarker.rotation.x=-Math.PI/2;this.deskMarker.visible=false;this.scene.add(this.deskMarker);
  this.deskArrow=new T.Mesh(new T.ConeGeometry(.35,.65,4),new T.MeshBasicMaterial({color:'#d2f5ad'}));this.deskArrow.rotation.z=Math.PI;this.deskArrow.visible=false;this.scene.add(this.deskArrow);
  const line=new T.Line(new T.BufferGeometry(),new T.LineBasicMaterial({color:'#bdddab',transparent:true,opacity:.65}));line.visible=false;this.scene.add(line);this.workRoute=line;
  for(const d of G.DESKS){const hit=new T.Mesh(new T.BoxGeometry(2.5,2.2,1.5),new T.MeshBasicMaterial({visible:false}));hit.position.set(d.x,1.2,d.z);hit.userData.room='desk:'+d.room;this.scene.add(hit);this.hits.push(hit);}
 }
 workGoal(station,path){if(!this.deskMarker||!station)return;this.deskStation=station;this.deskMarker.position.set(station.seatX,.24,station.seatZ);this.deskArrow.position.set(station.x,3.25,station.z);this.deskMarker.visible=this.deskArrow.visible=true;
  if(path?.length){this.workRoute.geometry.dispose();this.workRoute.geometry=new T.BufferGeometry().setFromPoints(path.map(([x,z])=>new T.Vector3(x,.29,z)));this.workRoute.visible=true;}
 }
 makeExhibition(){for(const [i,team]of['A','B','C'].entries()){const x=20.5+i*5.5,group=new T.Group();group.position.set(x,1.32,29);group.scale.setScalar(.24);this.scene.add(group);const mesh=new T.InstancedMesh(this.boxGeo,new T.MeshStandardMaterial({color:'#ffffff',roughness:.55}),3136);mesh.count=0;group.add(mesh);this.exhibits.push({group,mesh,team,count:-1});
   const display=new T.Mesh(new T.PlaneGeometry(8,5),new T.MeshBasicMaterial({map:this.pages[i].texture,side:T.DoubleSide}));display.position.set(17.6+i*8.4,5.4,21.5);this.scene.add(display);
   const tag=new T.Sprite(new T.SpriteMaterial({map:this.text(team+' / '+G.TEAMS[team].name,'#e9e6c5',26),depthWrite:false}));tag.position.set(x,4.8,29);tag.scale.set(4.7,.88,1);this.scene.add(tag);
  }
 }
 updateModels(){if(!this.exhibits)return;const mat=new T.Matrix4(),col=new T.Color();for(const e of this.exhibits){const entries=Object.entries(this.projectionBuilds[e.team]||{});let i=0;for(const [key,b]of entries){const [x,y,z]=key.split(',').map(Number);e.mesh.setMatrixAt(i,mat.makeTranslation(x-6.5,y+.5,z-6.5));e.mesh.setColorAt(i++,col.set(G.COLORS[b.c]?.hex||'#eeeecc'));}e.mesh.count=i;e.mesh.instanceMatrix.needsUpdate=true;if(e.mesh.instanceColor)e.mesh.instanceColor.needsUpdate=true;e.count=i;}}
 makePosterSky(){const cv=document.createElement('canvas');cv.width=2048;cv.height=720;const tx=new T.CanvasTexture(cv);tx.encoding=T.sRGBEncoding;tx.minFilter=T.LinearFilter;tx.generateMipmaps=false;
  this.posterSky=new T.Group();this.scene.add(this.posterSky);this.posterSky.visible=false;this.posterCanvas=cv;this.posterTexture=tx;this.posterCloth=new T.Mesh(new T.PlaneGeometry(102,35.85),new T.MeshBasicMaterial({map:tx,side:T.DoubleSide}));this.posterCloth.position.set(0,64,-59);this.posterCloth.userData.room='posters';this.posterSky.add(this.posterCloth);this.hits.push(this.posterCloth);
  this.posterDrones=[];for(const x of[-48,-16,16,48]){const drone=new T.Group();drone.position.set(x,86,-59);this.posterSky.add(drone);this.dynamicBox(drone,'#d1e0de',0,0,0,1.7,.5,1.1);const rotors=[];for(const dx of[-1.3,1.3])for(const dz of[-.9,.9]){this.dynamicBox(drone,'#799999',dx*.5,0,dz*.5,1.6,.1,.15).rotation.y=-Math.atan2(dz,dx);rotors.push(this.dynamicBox(drone,'#d0e9d7',dx,.2,dz,1.6,.025,.09));}const cable=new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(x,85.7,-59),new T.Vector3(x,81.93,-59)]),new T.LineBasicMaterial({color:'#c0ccb1'}));this.posterSky.add(cable);this.posterDrones.push({drone,rotors,cable});}
 }
 drawPosters(){const ps=this.projectionState?.poster?.posters?.filter(p=>p.hasImg)||[];if(!ps.length){this.posterSky.visible=false;return;}if(!this.posterSky.visible){this.posterLiftAt=performance.now();this.posterSky.visible=true;}
  const all=this.posterPage<0,list=all?ps:ps.slice(this.posterPage*6,this.posterPage*6+6),c=this.posterCanvas.getContext('2d');c.fillStyle='#0b2029';c.fillRect(0,0,2048,720);c.fillStyle='#d9e4b6';c.font='32px Microsoft JhengHei';c.fillText('金馬桶上市海報展  /  '+ps.length+' 件共同創作',38,52);c.fillStyle='#89b6af';c.font='19px Microsoft JhengHei';c.fillText(all?'ALL POSTERS / 全部海報 · 按海報展可拉近平視':'第 '+(this.posterPage+1)+' / '+Math.ceil(ps.length/6)+' 頁 · 按左右鍵翻頁',1290,51);
  const cols=Math.min(list.length,all&&ps.length>12?10:6),rows=Math.ceil(list.length/cols),cw=1980/cols,ch=625/rows;
  list.forEach((p,i)=>{const x=34+(i%cols)*cw,y=83+Math.floor(i/cols)*ch;const img=this.posterImages.get(p.author+':'+p.v);c.fillStyle='#18383e';c.fillRect(x+4,y,cw-10,ch-8);if(img?.complete&&img.naturalWidth){const scale=Math.min((cw-26)/img.naturalWidth,(ch-65)/img.naturalHeight),w=img.naturalWidth*scale,h=img.naturalHeight*scale;c.drawImage(img,x+(cw-w)/2,y+9,w,h);}c.fillStyle='#e3e5cb';c.font=Math.max(13,Math.min(23,cw/13))+'px Microsoft JhengHei';c.fillText(p.name.slice(0,16),x+13,y+ch-32,cw-25);c.fillStyle='#8db6ad';c.font='16px Microsoft JhengHei';c.fillText((this.projectionState.players.find(v=>v.id===p.author)?.name||'行銷同仁')+' · '+(this.projectionState.gallery.tally[p.author]||0)+' 票',x+13,y+ch-12,cw-25);});this.posterTexture.needsUpdate=true;this.el.dataset.posterCount=ps.length;
 }
 turnPosters(delta){const total=this.projectionState?.poster?.posters.filter(p=>p.hasImg).length||0;if(!total)return;if(delta===0)this.posterPage=-1;else this.posterPage=(this.posterPage+delta+Math.ceil(total/6))%Math.ceil(total/6);this.drawPosters();this.focusPosters();}
 focusPosters(){if(!this.posterSky?.visible)return;this.follow=false;this.desiredFocus.set(0,64,-59);this.goal={theta:0,phi:.015,radius:130};this.el.dataset.focusScreen='posters';document.body.classList.add('screen-focus');}
 inspect(id){super.inspect(id);if(id==='board'){this.desiredFocus.set(23,2,28);this.goal={theta:.1,phi:.65,radius:38};}}
 select(id,point){if(id==='posters')return this.focusPosters();if(id?.startsWith('desk:')){if(id.slice(5)!==this.actors.get(this.me)?.p.team)return U.toast('請找你所屬處的發光機台。');this.onMove('workstation');return;}super.select(id,point);}
 projection(builds,s){super.projection(builds,s);if(builds)this.modelsDirty=true;this.postersDirty=true;}
 home(){super.home();if(this.posterSky?.visible){this.desiredFocus.set(0,31,-7);this.goal={theta:.08,phi:.5,radius:265};}}
 update(s,me){super.update(s,me);const p=s.players.find(p=>p.id===me);if(p?.workstation&&s.phase==='build'){this.workGoal(p.workstation);if(p.atWorkstation)this.workRoute.visible=false;}else if(this.deskMarker){this.deskMarker.visible=this.deskArrow.visible=this.workRoute.visible=false;}
  if(p?.arrival?.stage!=='done'&&p?.arrival&&!this.arrivalFocused){this.arrivalFocused=true;this.follow=true;this.goal.radius=60;}if(this.arrivalFocused&&p?.arrival?.stage==='done'&&!this.arrivalFinished){this.arrivalFinished=true;this.home();}
 }
 loop(time){if(this.posterSky){if(this.modelsDirty&&time-(this.modelAt||0)>180){this.modelAt=time;this.modelsDirty=false;this.updateModels();}if((this.postersDirty||this.pageDirty)&&time-(this.posterAt||0)>1000){this.posterAt=time;this.postersDirty=false;this.drawPosters();}
  if(this.posterSky.visible){const lift=this.reduced?1:Math.min(1,(time-this.posterLiftAt)/2400);this.posterCloth.scale.y=Math.max(.025,lift);this.posterCloth.position.y=46.075+17.925*lift;for(const d of this.posterDrones){d.drone.position.y=50.15+35.85*lift;for(const r of d.rotors)r.rotation.y=this.reduced?0:time*.055;const pos=d.cable.geometry.attributes.position;pos.setY(0,d.drone.position.y-.3);pos.setY(1,46.075+35.85*lift);pos.needsUpdate=true;}}
  if(this.deskArrow.visible)this.deskArrow.position.y=3.25+(this.reduced?0:Math.sin(time*.004)*.15);
  if(this.perf&&time>=this.perf.start){this.perf.frames++;const elapsed=time-this.perf.start;if(elapsed>4000){const fps=1000*this.perf.frames/elapsed,ratio=this.renderer.getPixelRatio();if(fps<42&&ratio>.65)this.renderer.setPixelRatio(Math.max(.65,ratio*.85));this.perf={frames:0,start:time};}}
 }super.loop(time);}
};})();
