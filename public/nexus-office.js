/* Golden Box · original miniature office, smooth camera & animated crew. */
(()=>{'use strict';const T=THREE,G=GAME;
class Office {
 constructor(el,onMove){
  this.el=el;this.onMove=onMove;this.actors=new Map();this.me=null;this.follow=false;this.reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  this.scene=new T.Scene();this.scene.background=new T.Color('#07171e');this.scene.fog=new T.Fog('#07171e',130,530);
  this.camera=new T.PerspectiveCamera(38,1,.3,1000);this.focus=new T.Vector3(0,0,8);this.desiredFocus=this.focus.clone();this.theta=.38;this.phi=.92;this.radius=152;this.goal={theta:.38,phi:.92,radius:152};
  this.renderer=new T.WebGLRenderer({antialias:true,powerPreference:"high-performance"});this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.25));this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.autoUpdate=false;this.renderer.shadowMap.needsUpdate=true;this.renderer.shadowMap.type=T.PCFSoftShadowMap;this.renderer.outputEncoding=T.sRGBEncoding;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.05;
  this.renderer.domElement.setAttribute('aria-label','可互動的 3D 辦公室，點擊房間移動角色，拖曳旋轉');el.appendChild(this.renderer.domElement);
  this.scene.add(new T.HemisphereLight(0x6996b5,0x142820,.65));const sun=new T.DirectionalLight(0x9bbfde,.5);sun.position.set(-45,90,35);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-80,right:80,top:80,bottom:-80,near:1,far:220});sun.shadow.bias=-.0005;this.scene.add(sun);const rim=new T.DirectionalLight(0x8bdfe6,.35);rim.position.set(20,15,-20);this.scene.add(rim);
  this.materials=new Map();this.boxGeo=new T.BoxGeometry(1,1,1);this.ballGeo=new T.SphereGeometry(1,12,8);this.farBallGeo=new T.SphereGeometry(1,8,6);this.cylGeo=new T.CylinderGeometry(1,1,1,16);this.hits=[];this.world();this.batchStatic();
  this.ray=new T.Raycaster();this.pointer=new T.Vector2();this.bind();this.resize=new ResizeObserver(()=>{let w=el.clientWidth,h=el.clientHeight;if(w&&h){this.maxRatio=this.renderScale?this.renderScale(w,h):Math.max(1,Math.min(devicePixelRatio,2));this.renderer.setPixelRatio(this.maxRatio);this.renderer.setSize(w,h,false);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();}});this.resize.observe(el);this.last=performance.now();this.loop=this.loop.bind(this);this.frame=requestAnimationFrame(this.loop);
 }
 batchStatic(){
  this.scene.updateMatrixWorld(true);const groups=new Map();const all=[];
  this.scene.traverse(m=>{if(!m.isMesh||![this.boxGeo,this.ballGeo,this.farBallGeo,this.cylGeo].includes(m.geometry)||m===this.coreCover)return;all.push(m);});
  for(const m of all){const plain=m.material.isMeshStandardMaterial&&!m.material.map&&!m.material.transparent;const key=m.geometry.uuid+(plain?(m.material.emissiveIntensity?'emissive':'plain'):m.material.uuid)+m.castShadow;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(m);}
  for(const list of groups.values()){const first=list[0].material,plain=first.isMeshStandardMaterial&&!first.map&&!first.transparent,material=plain?(first.emissiveIntensity?new T.MeshBasicMaterial({color:'#ffffff'}):new T.MeshStandardMaterial({color:'#ffffff',roughness:.7,metalness:.07})):first;const mesh=new T.InstancedMesh(list[0].geometry,material,list.length);list.forEach((m,i)=>{mesh.setMatrixAt(i,m.matrixWorld);if(plain)mesh.setColorAt(i,m.material.color);m.parent.remove(m);});mesh.castShadow=list[0].castShadow;mesh.receiveShadow=true;this.scene.add(mesh);}
 }
 batchActors(){
  for(const b of this.actorBatches||[]){this.scene.remove(b.mesh);b.mesh.dispose?.();}
  const groups=new Map();
  for(const a of this.actors.values())a.group.traverse(m=>{
   if(!m.isMesh||!m.userData.crewDecoration&&![this.boxGeo,this.ballGeo,this.cylGeo].includes(m.geometry))return;
   m.visible=false;m.castShadow=false;const key=m.geometry.uuid+(m.material.emissiveIntensity?'glow:'+m.material.uuid:m.material.isMeshBasicMaterial?'basic:'+m.material.uuid:'solid');
   if(!groups.has(key))groups.set(key,[]);groups.get(key).push({part:m,actor:a});
  });
  this.actorBatches=[];
  for(const items of groups.values()){
   const first=items[0].part,mesh=new T.InstancedMesh(first.geometry,first.material.emissiveIntensity||first.material.isMeshBasicMaterial?first.material:this.mat('#ffffff'),items.length);if(!first.material.emissiveIntensity)items.forEach(({part},i)=>mesh.setColorAt(i,part.material.color));
   mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);mesh.frustumCulled=false;mesh.castShadow=false;this.scene.add(mesh);this.actorBatches.push({mesh,items});
  }
  this.actorBatchDirty=false;
 }
 mat(color,glow=false){let key=color+glow;if(!this.materials.has(key))this.materials.set(key,new T.MeshStandardMaterial({color,roughness:.78,metalness:.06,emissive:glow?color:0,emissiveIntensity:glow?.8:0}));return this.materials.get(key);}
 mesh(geo,color,x,y,z,sx,sy,sz,parent=this.scene,glow=false){let m=new T.Mesh(geo,this.mat(color,glow));m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
 box(c,x,y,z,w,h,d,p,glow){return this.mesh(this.boxGeo,c,x,y,z,w,h,d,p,glow);}
 ball(c,x,y,z,w,h,d,p){return this.mesh(this.ballGeo,c,x,y,z,w,h,d,p);}
 cylinder(c,x,y,z,r,h,p){return this.mesh(this.cylGeo,c,x,y,z,r,h,r,p);}
 text(text,color='#334942',size=34){let c=document.createElement('canvas');c.width=512;c.height=96;let ctx=c.getContext('2d');ctx.font=`600 ${size}px "Microsoft JhengHei",sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=color;ctx.fillText(text,256,48);let texture=new T.CanvasTexture(c);texture.encoding=T.sRGBEncoding;return texture;}
 label(text,x,z,w=6,color){const m=new T.Mesh(new T.PlaneGeometry(w,w*96/512),new T.MeshBasicMaterial({map:this.text(text,color),transparent:true,depthWrite:false}));m.rotation.x=-Math.PI/2;m.position.set(x,.18,z);this.scene.add(m);}
 plant(x,z,scale=1){const group=new T.Group();group.position.set(x,0,z);group.scale.setScalar(scale);this.scene.add(group);this.cylinder('#c5c4b0',0,.36,0,.4,.72,group);this.cylinder('#607b54',0,1.1,0,.08,1.3,group);for(let i=0;i<5;i++){let a=i*2.4;let l=this.ball('#769973',Math.cos(a)*.25,1.2+i*.18,Math.sin(a)*.25,.32,.5,.22,group);l.rotation.z=Math.cos(a)*.5;}}

 desk(x,z,col){
  this.box('#cbd5d0',x,.05,z+.4,3.1,.04,3.1);
  this.box('#fbfcf8',x,1.15,z,2.85,.15,1.35);
  for(let dx of [-1.14,1.14]){this.box('#d8e0dc',x+dx,.56,z,.12,1.1,1.13);this.box('#a9b8b3',x+dx,.06,z,.42,.1,1.2);}
  this.box('#dde7e2',x,1.32,z-.32,.1,.34,.18);this.box('#e9efec',x,1.81,z-.38,1.7,.95,.15);
  this.box('#354e56',x,1.81,z-.29,1.53,.78,.025);this.box(col,x-.4,1.79,z-.26,.43,.51,.03);
  for(let i=0;i<3;i++)this.box('#b6d4d3',x+.32,1.95-i*.16,z-.26,.62,.035,.03,undefined,true);
  this.box('#a3b4b0',x-.13,1.27,z+.35,1.2,.06,.38);this.box('#fbfcf8',x+.95,1.35,z+.28,.33,.26,.4);
  this.box('#f5f8f3',x-1.01,.55,z,.38,.95,.75);this.box(col,x-1.01,.86,z+.39,.25,.035,.025,undefined,true);
  this.cylinder('#8f9e99',x,.45,z+1.55,.09,.8);this.cylinder('#a5b4ac',x,.14,z+1.55,.47,.1);
  this.box('#ecf2ea',x,.86,z+1.55,.88,.22,.8);this.box(col,x,1.36,z+1.91,.87,.9,.16);
  for(let dx of [-.5,.5])this.box('#b8c7bf',x+dx,1.07,z+1.5,.11,.1,.65);
 }
 tree(x,z,size=1,far=false){
  const part=(m)=>{if(far)m.castShadow=false;return m;};
  part(this.cylinder('#8a8c76',x,2.2*size,z,.27*size,4.4*size));
  for(let i=0;i<3;i++){const a=i*2.5+x;part(this.mesh(far?this.farBallGeo:this.ballGeo,i===1?'#183e35':'#244d3f',x+Math.cos(a)*1.15*size,(4.7+i*.8)*size,z+Math.sin(a)*size,2.7*size,2.3*size,2.5*size));}
 }
 fixture(f){
  const {x,z}=f,p=f.type==='rack'?this.core:undefined;
  if(f.type==='coffee'){
   this.box('#eaf0e9',x,1,z,4,2,2);this.box('#fbfcf8',x,2.06,z,4.1,.13,2.1);this.box('#b3bfb5',x,1.05,z+1.02,3.7,.02,.025);
   this.box('#dce5df',x-.7,2.6,z,1.3,1.02,1);this.box('#334a4b',x-.7,2.63,z+.52,.95,.7,.025);this.cylinder('#fafbf4',x+.7,2.26,z+.3,.2,.32);this.box('#e6eadd',x+1.35,2.28,z,.35,.38,.35);
  }else if(f.type==='sofa'){
   this.box('#c6c9b6',x,.65,z,5,.7,2.3);this.box('#d8d9c9',x,1.3,z-.9,5,1.1,.4);for(let dx of [-2.3,2.3])this.box('#d8d9c9',x+dx,1,z,.4,.9,2.5);this.cylinder('#f3f2e4',x,.6,z+2,.95,.14);
  }else if(f.type==='arcade'){
   this.box('#f2f1ed',x,1.13,z,2.1,2.25,1.65);this.box('#cbd7d3',x,2.5,z-.25,2.1,1.2,1.1);this.box('#334650',x,2.55,z+.32,1.72,.93,.04);
   this.box('#a9cad1',x,2.55,z+.35,.9,.42,.025,undefined,true);this.box('#afa1c5',x,1.57,z+.65,2.1,.18,.7);
   this.cylinder('#5d7375',x-.5,1.85,z+.72,.1,.4);for(let j=0;j<3;j++)this.cylinder(j===0?'#d2b3a2':'#8cbead',x+.1+j*.36,1.73,z+.8,.12,.07);
  }else if(f.type==='gameTable'){
   this.box('#fafcf6',x,1,z,7,.3,3);this.box('#4b7070',x,1.17,z,6.5,.03,2.5);this.box('#e4eddf',x,1.45,z,.05,.5,2.5);for(let dx of [-2.8,2.8])this.box('#cedad0',x+dx,.5,z,.2,1,2.5);this.ball('#f4dbc1',x+1.2,1.32,z+.5,.12,.12,.12);
  }else if(f.type==='toilet'){
   this.box('#fcfdf6',x,1,z-.7,1.35,2,.6);this.ball('#fcfdf6',x,.7,z+.25,.8,.62,1.05);this.ball('#9ab7b5',x,1.08,z+.3,.52,.08,.66);this.box('#d1dcd4',x-1.3,1.15,z,.13,2.3,3);
  }else if(f.type==='boardTable'){
   this.box('#a9bcb3',x,.05,z,16,.04,8);this.box('#f7f8f1',x,1.1,z,14,.24,3.6);for(let dx of [-5,5])this.box('#b3c3bb',x+dx,.54,z,1.1,1.1,2.6);
   for(let dx of [-5,-3,-1,1,3,5])for(let side of [-1,1]){this.box('#c2c9b3',x+dx,.7,z+side*2.7,1,.2,1);this.box('#b4bfa7',x+dx,1.2,z+side*3.15,1,1,.15);this.box('#b5c7c3',x+dx,1.26,z+side*.8,.9,.08,.6);}
  }else if(f.type==='reception'){
   this.box('#f7faf3',x,1,z,8,2,2);this.box('#a8bfb7',x,1.18,z+1.02,7.4,.035,.03,undefined,true);this.box('#d9e5de',x-1.5,2.3,z,1.4,.8,.13);this.label('G O L D E N  T O I L E T',x,z+5,12,'#627b6d');
  }else if(f.type==='planter'){
   this.box('#b6c7b0',x,.18,z,8,.32,8);this.box('#a6b597',x,.37,z,7.5,.08,7.5);this.tree(x,z,1.35);for(let dx of [-3.8,3.8])this.box('#f1f2e7',x+dx,.56,z,1,.65,8.6);
  }else if(f.type==='patio'){
   this.cylinder('#e9ecde',x,.96,z,1.1,.14);this.cylinder('#8d9b8b',x,.5,z,.13,1);for(let dx of [-1.65,1.65]){this.box('#9fafa0',x+dx,.59,z,.8,.16,.8);this.box('#aebcaa',x+dx,1.06,z+.37,.8,.9,.13);}
  }else if(f.type==='smoking'){
   this.box('#c3c8b5',x,.6,z,5,.65,1.6);this.box('#cdd2c1',x,1.1,z-.7,5,.8,.12);this.cylinder('#7d9387',x+3.7,.7,z,.3,1.4);this.cylinder('#cad4c9',x+3.7,1.42,z,.36,.1);
   for(let dx of [-4,4])this.box('#ecf0e5',x+dx,2.3,z-1,.2,4.6,.2);for(let dx=-4;dx<=4;dx+=.8)this.box('#e8eddf',x+dx,4.7,z,.22,.15,5);
  }else if(f.type==='rack'){
   this.box('#e1e9e1',x,1.8,z,3.6,3.6,2.3,p);this.box('#425952',x,1.8,z+1.17,3.25,3.24,.06,p);
   for(let j=0;j<18;j++){this.box('#738b89',x,.28+j*.18,z+1.23,2.95,.12,.07,p);this.box('#263d42',x+.4,.28+j*.18,z+1.28,1.65,.07,.025,p);}
  }else if(f.type==='printer'){
   this.box('#e7eee5',x,1.15,z,2,2.3,2);this.box('#344d51',x,1.4,z+1.02,1.7,1.25,.05);this.box('#a3c8bf',x,1.17,z+1.06,.75,.6,.035);this.box('#93b6a8',x,2.15,z+1.04,.9,.06,.03,undefined,true);
  }
 }
 world(){
  this.box('#112d26',0,-.37,0,1800,.45,1800).castShadow=false;
  this.box('#183c30',0,-.11,3,132,.09,120);this.box('#284337',0,-.04,9,90,.08,100);
  // The road continues beyond the campus into a softly fading forest city.
  for(let x of [-92,92])this.box('#87948e',x,-.02,0,13,.06,1400).castShadow=false;
  for(let z of [65,-90,170,-210]){
   this.box('#84918d',0,-.015,z,1400,.08,12).castShadow=false;
   this.box('#ced5c4',0,.02,z-7.2,1400,.12,2.4).castShadow=false;this.box('#ced5c4',0,.02,z+7.2,1400,.12,2.4).castShadow=false;
   for(let x=-350;x<350;x+=12)this.box('#dce0ce',x,.04,z,4,.025,.15).castShadow=false;
  }
  for(let z=60;z<=70;z+=1.4)this.box('#e4e7da',0,.07,z,6,.035,.6);
  this.box('#e5e9dc',0,.04,56,8,.08,8);
  // Plinth, generous galleries, and the open-air courtyard.
  this.box('#c8d3c8',0,-.13,5,83,.32,71);this.box('#e5ece2',0,.04,5,82,.08,70);
  this.box('#d7dcca',0,.06,49,86,.08,9);
  // One terrace slab; omit coplanar room floors and subpixel grout geometry.
  this.core=new T.Group();this.scene.add(this.core);
  for(const r of G.ROOMS){
   if(!r.base){
    const floor=r.outdoor?(r.id==='road'?'#84918d':r.id==='terrace'?'#d7dcca':r.id==='smoking'?'#d5dccb':r.id==='courtyard'?'#d6dec9':'#204638'):(r.id==='M'||r.id==='board'?'#e7e8de':'#f0f3ed');
    if(!['terrace','road','pool'].includes(r.id))this.box(floor,r.x,.075,r.z,r.w-.08,.05,r.d-.08).castShadow=false;
    if(!r.outdoor)this.box(r.color,r.x,.13,r.z+r.d/2-.3,3.5,.04,.12,undefined,true);
    this.label(r.name,r.x,r.z+r.d/2-1.15,Math.min(r.w-2,8),'#4c6761');
   }
   const hit=new T.Mesh(new T.PlaneGeometry(r.w,r.d),new T.MeshBasicMaterial({visible:false}));hit.rotation.x=-Math.PI/2;hit.position.set(r.x,r.base?.115:.14,r.z);hit.userData.room=r.id;this.scene.add(hit);this.hits.push(hit);
  }
  // Cutaway villa: white plaster, low partitions, clerestory frames, wide doors.
  for(const w of G.WALLS){this.box('#fafbf4',w.x,.82,w.z,w.w,1.5,w.d);this.box('#b9cbbf',w.x,1.6,w.z,w.w+.04,.09,w.d+.04);}
  for(let z of [-30,39]){
   this.box('#f5f7ed',0,4.5,z,82,.45,.75);
   for(let x=-40;x<=40;x+=8){if(z===39&&x===0)continue;this.box('#eff4e9',x,2.2,z,.4,4.4,.4);if(z===-30)this.box('#afc6b9',x+3.5,3.1,z,6.1,.035,.08);}
  }
  for(let x of [-40,40]){this.box('#eff4e9',x,4.5,4.5,.65,.45,69);for(let z=-23;z<39;z+=8)this.box('#eff4e9',x,2.2,z,.4,4.4,.4);}
  for(let z of [-11,19.5]){this.box('#f7f8ed',0,3.7,z,80,.2,.45);for(let x of [-39,-13,13,39])this.box('#f3f6eb',x,1.9,z,.3,3.8,.3);}
  for(let x of [-10.5,10.5]){this.box('#ecf2e7',x,3.8,22,.32,.3,45);for(let z of [-6,10,29,43])this.box('#e5eee0',x,1.85,z,.3,3.7,.3);}
  // Laboratory workstations: sixty actual desks, each with monitor, hardware and chair.
  for(const d of G.DESKS)this.desk(d.x,d.z,d.color);
  for(const f of G.FIXTURES)this.fixture(f);
  for(const x of [-36,-16,16,36]){this.box('#e0e9e0',x,1.45,-6.8,3,2.9,1);for(let y=.5;y<2.8;y+=.65)this.box('#b8cbc2',x,y,-6.27,2.65,.05,.04);}
  for(const x of [-26,26]){this.box('#edf3e8',x,3.35,-6.55,5,1,.18);this.box('#789c95',x,3.35,-6.43,4.6,.65,.04);for(let i=0;i<4;i++)this.box('#c7e7d4',x-1.6+i*1.1,3.25,-6.39,.6,.12+i*.1,.025,undefined,true);}
  for(const x of [-34,-18,18,34])for(const z of [-1,9])this.box('#f9ffe9',x,3.75,z,4.2,.075,.35,undefined,true);
  this.coreCover=this.box('#83cbe2',29,2,-22,23.5,3.8,15.5);this.coreCover.material=new T.MeshPhysicalMaterial({color:'#86c5d3',transparent:true,opacity:.13,roughness:.1,metalness:.05,depthWrite:false,side:T.DoubleSide});this.coreCover.castShadow=false;this.label('C / AUTHORIZED ACCESS',29,-15.7,13,'#587764');
  this.label('GB300 / AI COMPUTE',29,-18.5,13,'#9ff6d9');
  // Gardens, outdoor seating, specimen beds and a sheltered smoking terrace.
  for(const [x,z] of [[-38,17],[38,17],[-38,37],[38,37],[-7,23],[7,23],[-7,41],[7,41],[-38,-16],[-21,-16],[14,-16]])this.plant(x,z,1.5);
  for(const x of [47,58])for(const z of [-32,-18,-4]){this.tree(x,z,1.2);this.box('#8ca681',x,.3,z,4,.45,4);}
  this.box('#d6ddc7',52,.115,-15,3,.045,44);
  for(const z of [-25,-11,3]){this.box('#adbca6',56,.48,z,4,.65,1.3);this.box('#bdc8b1',56,.9,z+.5,4,.8,.12);}
  for(const x of [-51,-38,-24,-10,5,21,37,53]){this.tree(x,-53,1.5);this.tree(x,-40,1.2);}
  this.box('#d3d8be',0,.115,-46,124,.05,2.6);
  for(const x of [-48,48]){this.box('#d4deca',x,.09,35,5,.08,25);if(x<0)for(const z of [34,46])this.tree(x-7,z,1.25);}
  // Deterministic low-poly forest and city blocks continue to the fog horizon.
  let seed=73;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<310;i++){
   const x=(rand()-.5)*960,z=(rand()-.5)*960;
   if(Math.abs(x)<68&&z>-60&&z<80||Math.abs(Math.abs(x)-92)<10||[65,-90,170,-210].some(a=>Math.abs(z-a)<12))continue;
   this.tree(x,z,.8+rand()*2.7,true);
  }
  for(let i=0;i<110;i++){
   const x=(rand()-.5)*390,z=(rand()-.5)*390;
   if(Math.abs(x)<68&&z>-61&&z<81||Math.abs(Math.abs(x)-92)<11||[65,-90,170,-210].some(a=>Math.abs(z-a)<13))continue;
   this.tree(x,z,1.3+rand()*1.4,true);
  }
  for(let row=0;row<2;row++)for(let i=0;i<8;i++){
   const x=-150+i*43,z=-127-row*45,h=15+(i*7+row*11)%23,w=14+(i%3)*3;
   this.box('#2c4147',x,h/2,z,w,h,16).castShadow=false;
   for(let y=3;y<h;y+=3.3)this.box('#d0ae71',x,y,z+8.04,w-1.2,1.35,.06).castShadow=false;
   this.box('#a5b9a7',x,h,z,w+.5,.3,16.5).castShadow=false;
  }
  for(let i=0;i<76;i++){
   const x=(rand()-.5)*860,z=(rand()-.5)*860;if(Math.hypot(x,z)<145||Math.abs(Math.abs(x)-92)<20||[65,-90,170,-210].some(a=>Math.abs(z-a)<20))continue;
   const h=8+rand()*33,w=9+rand()*12,d=8+rand()*12;
   this.box(i%3?'#263c43':'#304a50',x,h/2-.1,z,w,h,d).castShadow=false;
   for(let y=3;y<h;y+=3.5)this.box('#cfb77f',x,y,z+d/2+.02,w-.7,1.4,.06).castShadow=false;
   this.box('#aebfa9',x,h,z,w+.4,.2,d+.4).castShadow=false;
  }
  // Parked electric cars and street lamps establish the villa's urban scale.
  for(const x of [-57,-35,35,57]){this.cylinder('#869b8e',x,3,57,.09,6);this.box('#f2f5e8',x+.5,6,57,1.3,.17,.4,undefined,true);}
  this.beacon=new T.Mesh(new T.RingGeometry(.65,.82,32),new T.MeshBasicMaterial({color:'#317d67',side:T.DoubleSide,transparent:true}));this.beacon.rotation.x=-Math.PI/2;this.beacon.visible=false;this.scene.add(this.beacon);
 }
 avatar(p){
  const group=new T.Group();const color=G.TEAMS[p.team]?.color||'#e7ce87';const body=new T.Group();group.add(body);this.ball('#e8eee0',0,.98,0,.46,.55,.33,body);this.box(color,0,1.14,.32,.53,.22,.035,body);this.box('#344851',0,.6,0,.54,.22,.43,body);this.ball('#e3d8bc',0,1.66,0,.46,.44,.42,body);this.ball('#3c565c',0,1.69,.33,.35,.19,.12,body);this.box('#d8f3da',-.1,1.72,.44,.12,.05,.02,body,true);this.box('#243e44',0,1.1,-.31,.48,.59,.21,body);this.box('#edf2da',.16,1.09,.3,.11,.16,.03,body);const limbs=[];
  for(let side of [-1,1]){let arm=new T.Group();arm.position.set(side*.43,1.26,0);body.add(arm);this.ball(color,0,-.23,0,.13,.3,.14,arm);this.ball('#e3d8bc',0,-.5,0,.13,.14,.13,arm);let leg=new T.Group();leg.position.set(side*.19,.62,0);group.add(leg);this.box('#30474d',0,-.19,0,.2,.42,.22,leg);this.ball('#dde2cf',0,-.4,.075,.16,.12,.24,leg);limbs.push(arm,leg);}
  const shadow=new T.Mesh(new T.CircleGeometry(.5,18),new T.MeshBasicMaterial({color:'#172b30',transparent:true,opacity:.25,depthWrite:false}));shadow.rotation.x=-Math.PI/2;shadow.position.y=.075;group.add(shadow);
  const sprite=new T.Sprite(new T.SpriteMaterial({map:this.text(p.name,'#254d40',40),depthTest:false,transparent:true}));sprite.position.set(0,2.5,0);sprite.scale.set(3,.56,1);group.add(sprite);const halo=new T.Mesh(new T.RingGeometry(.56,.66,24),new T.MeshBasicMaterial({color:'#216e58',side:T.DoubleSide}));halo.rotation.x=-Math.PI/2;halo.position.y=.08;group.add(halo);
  this.scene.add(group);let a={group,body,limbs,sprite,halo,p,target:new T.Vector3(p.motion?.x||0,0,p.motion?.z||0),seed:p.joinIdx*2};group.position.copy(a.target);this.actors.set(p.id,a);this.actorBatchDirty=true;return a;
 }
 update(s,me){this.me=me;const isBoss=s.players.find(p=>p.id===me)?.rank==='boss';this.core.visible=true;this.coreCover.visible=true;for(const [id,a] of this.actors)if(!s.players.some(p=>p.id===id)){this.scene.remove(a.group);a.sprite.material.map.dispose();a.sprite.material.dispose();this.actors.delete(id);this.actorBatchDirty=true;}for(const p of s.players){let a=this.actors.get(p.id)||this.avatar(p);a.p=p;if(p.motion)a.target.set(p.motion.x,0,p.motion.z);if(a.halo.userData.crewDecoration)a.halo.userData.show=p.id===me;else a.halo.visible=p.id===me;a.sprite.visible=p.id===me||s.players.length<12;a.group.visible=true;}}
 motion(players){for(const p of players){const a=this.actors.get(p.id);if(a){a.target.set(p.x,0,p.z);a.p.motion={...a.p.motion,...p};if(p.status)a.p.status=p.status;}}}
 home(){this.follow=false;this.goal={theta:.38,phi:.92,radius:152};this.desiredFocus.set(0,0,8);}
 campus(){this.follow=false;this.goal={theta:.2,phi:.59,radius:280};this.desiredFocus.set(0,0,-18);}
 inspect(id){const r=G.ROOMS.find(r=>r.id===id);if(!r)return;this.follow=false;this.desiredFocus.set(r.x,0,r.z);this.goal.radius=r.outdoor?75:48;this.goal.phi=.95;}
 focusMe(){this.follow=!this.follow;if(this.follow)this.goal.radius=42;else this.home();}
 select(id,point){const r=G.ROOMS.find(r=>r.id===id);if(!r)return;this.beacon.position.set(point?.x??r.x,.2,point?.z??r.z);this.beacon.visible=true;this.beaconAt=performance.now();this.onMove(id,point);}
 bind(){let down=null,dist=0,pointers=new Map();const cv=this.renderer.domElement;cv.style.touchAction='none';cv.addEventListener('pointerdown',e=>{cv.setPointerCapture(e.pointerId);pointers.set(e.pointerId,[e.clientX,e.clientY]);down={x:e.clientX,y:e.clientY,pan:e.button===2||e.shiftKey};this.follow=false;dist=0;});cv.addEventListener('pointermove',e=>{if(!pointers.has(e.pointerId))return;let old=pointers.get(e.pointerId);if(pointers.size===2){let other=[...pointers.entries()].find(([id])=>id!==e.pointerId)[1];let before=Math.hypot(old[0]-other[0],old[1]-other[1]),after=Math.hypot(e.clientX-other[0],e.clientY-other[1]);this.goal.radius=Math.max(22,Math.min(285,this.goal.radius+(before-after)*.08));dist=99;}else if(down){const dx=e.clientX-down.x,dy=e.clientY-down.y;dist+=Math.hypot(dx,dy);if(down.pan){const speed=this.radius*.0014;this.desiredFocus.x=Math.max(-130,Math.min(130,this.desiredFocus.x+(-Math.cos(this.theta)*dx-Math.sin(this.theta)*dy)*speed));this.desiredFocus.z=Math.max(-130,Math.min(130,this.desiredFocus.z+(Math.sin(this.theta)*dx-Math.cos(this.theta)*dy)*speed));}else{this.goal.theta-=dx*.005;this.goal.phi=Math.max(.015,Math.min(1.3,this.goal.phi+dy*.004));}down.x=e.clientX;down.y=e.clientY;}pointers.set(e.pointerId,[e.clientX,e.clientY]);});cv.addEventListener('pointerup',e=>{pointers.delete(e.pointerId);if(down&&!down.pan&&dist<7){const rect=cv.getBoundingClientRect();this.pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);this.ray.setFromCamera(this.pointer,this.camera);let hits=this.ray.intersectObjects(this.hits);if(hits[0])this.select(hits[0].object.userData.room,hits[0].point);}down=null;});cv.addEventListener('pointercancel',e=>{pointers.delete(e.pointerId);down=null;});cv.addEventListener('wheel',e=>{e.preventDefault();this.goal.radius=Math.max(22,Math.min(285,this.goal.radius+e.deltaY*.04));},{passive:false});cv.addEventListener('contextmenu',e=>e.preventDefault());}
 loop(time){const dt=Math.min(.05,(time-this.last)/1000);this.last=time;const ease=1-Math.exp(-dt*10);if(this.follow&&this.actors.has(this.me))this.desiredFocus.copy(this.actors.get(this.me).group.position);this.focus.lerp(this.desiredFocus,ease);for(const k of ['theta','phi','radius'])this[k]+=(this.goal[k]-this[k])*ease;this.camera.position.set(this.focus.x+Math.sin(this.theta)*Math.cos(this.phi)*this.radius*Math.max(1,1.15/this.camera.aspect),this.focus.y+Math.sin(this.phi)*this.radius*Math.max(1,1.15/this.camera.aspect),this.focus.z+Math.cos(this.theta)*Math.cos(this.phi)*this.radius*Math.max(1,1.15/this.camera.aspect));this.camera.lookAt(this.focus);
  for(const a of this.actors.values()){const delta=a.target.clone().sub(a.group.position),moving=delta.length()>.045;a.group.position.lerp(a.target,1-Math.exp(-dt*13));if(moving){let target=Math.atan2(delta.x,delta.z),diff=Math.atan2(Math.sin(target-a.group.rotation.y),Math.cos(target-a.group.rotation.y));a.group.rotation.y+=diff*ease;}if(!moving){const pose=(['A','B','M','arcade'].includes(a.p.motion?.room)?Math.PI:a.p.motion?.room==='board'?-1:0)+(a.seed%5-2)*.2;const turn=Math.atan2(Math.sin(pose-a.group.rotation.y),Math.cos(pose-a.group.rotation.y));a.group.rotation.y+=turn*ease*.15;}const t=time*.01+a.seed,stride=moving?.62:0;a.limbs.forEach((limb,i)=>limb.rotation.x=Math.sin(t+(i<2?0:Math.PI)+(i%2?Math.PI:0))*stride);a.body.position.y=this.reduced?0:(moving?Math.abs(Math.sin(t))*.09:Math.sin(time*.002+a.seed)*.025);if(!moving&&['arcade','lounge','smoking','terrace'].includes(a.p.motion?.room))a.limbs[0].rotation.x=-.7+Math.sin(t)*.15;this.animateActor?.(a,time,moving);}
  if(this.actorBatchDirty)this.batchActors();for(const a of this.actors.values())a.group.updateMatrixWorld(true);const hidden=new T.Matrix4().makeScale(0,0,0);for(const b of this.actorBatches||[]){b.items.forEach(({part,actor},i)=>b.mesh.setMatrixAt(i,actor.group.visible&&part.userData.show!==false?part.matrixWorld:hidden));b.mesh.instanceMatrix.needsUpdate=true;}if(this.beacon.visible){let age=(time-this.beaconAt)/1000;this.beacon.scale.setScalar(1+Math.sin(age*5)*.15);this.beacon.material.opacity=Math.max(0,1-age/4);if(age>4)this.beacon.visible=false;}if(!document.hidden&&!this.paused)this.renderer.render(this.scene,this.camera);this.frame=requestAnimationFrame(this.loop);
 }
}
window.Office=Office;
})();
