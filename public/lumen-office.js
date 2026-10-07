/* Art direction: a warm design atelier in a cool moonlit forest. */
(()=>{'use strict';const T=THREE,Base=window.Office;
window.Office=class extends Base{
 constructor(el,move){super(el,move);this.quality='auto';try{const q=localStorage.getItem('golden-render-quality-v2');if(['auto','high','ultra','balanced'].includes(q))this.quality=q;}catch{}
  this.makeQualityControl();this.lightAtelier();this.finishSurfaces();this.applyQuality();
 }
 world(){super.world();this.addArchitecturalDetails();}
 textureFor(kind){this.surfaceMaps||=new Map();if(this.surfaceMaps.has(kind))return this.surfaceMaps.get(kind);const cv=document.createElement('canvas');cv.width=cv.height=512;const c=cv.getContext('2d');let seed=927;const rnd=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);c.fillStyle=kind==='wood'?'#97836b':'#bcbcaf';c.fillRect(0,0,512,512);
  if(kind==='wood'){for(let y=0;y<512;y+=64){c.fillStyle=y%128?'#9d8b73':'#92816a';c.fillRect(0,y,512,64);for(let i=0;i<150;i++){const yy=y+rnd()*64;c.strokeStyle=`rgba(48,38,29,${.025+rnd()*.05})`;c.beginPath();c.moveTo(0,yy);c.bezierCurveTo(150,yy-6+rnd()*12,350,yy-5+rnd()*10,512,yy);c.stroke();}c.fillStyle='#6b6255';c.fillRect(0,y,512,1);c.fillRect((y%128?170:410),y,1,64);}}
  else{for(let i=0;i<6500;i++){const n=80+Math.floor(rnd()*150);c.fillStyle=`rgba(${n},${n},${n-5},.12)`;const size=.4+rnd()*2;c.fillRect(rnd()*512,rnd()*512,size,size);}c.strokeStyle='#989d95';c.lineWidth=1;c.strokeRect(.5,.5,511,511);}
  const tx=new T.CanvasTexture(cv);tx.wrapS=tx.wrapT=T.RepeatWrapping;tx.encoding=T.sRGBEncoding;tx.anisotropy=this.renderer.capabilities.getMaxAnisotropy();this.surfaceMaps.set(kind,tx);return tx;
 }
 mesh(geo,color,x,y,z,sx,sy,sz,parent,glow){const m=super.mesh(geo,color,x,y,z,sx,sy,sz,parent,glow);if(geo===this.boxGeo&&y>=0&&y<.14&&sx>6&&sz>5&&sx<100){const room=GAME.ROOMS.find(r=>Math.abs(r.x-x)<1&&Math.abs(r.z-z)<1);const wood=room&&['board','M','lounge','smoking'].includes(room.id);const tex=this.textureFor(wood?'wood':'stone').clone();tex.repeat.set(sx/(wood?8:6),sz/(wood?8:6));tex.needsUpdate=true;m.material=new T.MeshStandardMaterial({color:wood?'#e4cfad':'#e2e0d5',map:tex,roughness:wood?.62:.58,metalness:.04,envMapIntensity:.22});m.material.userData.surface=true;}
  if(['#eff4e9','#f5f7ed','#ecf2e7','#e5eee0'].includes(color)){m.material=this.mat('#40575c');}
  return m;
 }
 addArchitecturalDetails(){
  // Walnut wall slats, brass detailing and warm linear fixtures tie the villa together.
  for(const x of[-39,39]){this.box('#b59c6f',x,.2,4.5,.08,.05,68);this.box('#ffe0a6',x,3.85,4.5,.07,.07,68,undefined,true);}
  for(const x of[-36,-20,20,36]){this.box('#233c42',x,4.12,4,6.2,.15,.55);this.box('#ffdb9a',x,4.02,4,5.6,.04,.28,undefined,true);}
  for(let x=15;x<40;x+=.6)this.box(x%1<.5?'#9a8060':'#7b6751',x,1.16,38.2,.2,2.12,.12);
  for(let x=-39;x<-22;x+=.65)this.box('#89765e',x,1.35,-29.7,.23,2.55,.16);
  this.box('#284149',0,1.02,25,8.1,1.95,2.1);this.box('#bfa270',0,2.02,25,8.3,.12,2.3);this.box('#ffe1ac',0,.28,26.08,7.7,.055,.025,undefined,true);
  for(const x of[-6,6]){this.box('#344e50',x,.18,47,2.3,.2,2.3);this.cylinder('#e5cda1',x,1,47,.1,1.6);this.box('#ffdc99',x,1.86,47,.5,.1,.5,undefined,true);}
  // Soft baked spill keeps the floor warm without dozens of per-frame light passes.
  const cv=document.createElement('canvas');cv.width=cv.height=256;const c=cv.getContext('2d'),g=c.createRadialGradient(128,128,0,128,128,128);g.addColorStop(0,'rgba(255,207,134,.42)');g.addColorStop(.45,'rgba(255,211,146,.18)');g.addColorStop(1,'rgba(255,221,170,0)');c.fillStyle=g;c.fillRect(0,0,256,256);const tex=new T.CanvasTexture(cv);tex.encoding=T.sRGBEncoding;
  for(const [x,z,w,d]of[[-26,4,29,29],[26,4,29,29],[-26,29,28,20],[27,29,27,20],[-30,-22,22,16],[-9,-22,18,16],[0,29,18,20]]){const p=new T.Mesh(new T.PlaneGeometry(w,d),new T.MeshBasicMaterial({map:tex,transparent:true,opacity:.7,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false}));p.rotation.x=-Math.PI/2;p.position.set(x,.158,z);this.scene.add(p);}
  const shade=document.createElement('canvas');shade.width=shade.height=128;const sc=shade.getContext('2d'),sg=sc.createRadialGradient(64,64,10,64,64,64);sg.addColorStop(0,'rgba(8,16,19,.35)');sg.addColorStop(.55,'rgba(8,16,19,.18)');sg.addColorStop(1,'rgba(8,16,19,0)');sc.fillStyle=sg;sc.fillRect(0,0,128,128);const st=new T.CanvasTexture(shade),sm=new T.MeshBasicMaterial({map:st,transparent:true,depthWrite:false,opacity:.8});const shadows=new T.InstancedMesh(new T.PlaneGeometry(1,1),sm,GAME.DESKS.length),matrix=new T.Matrix4(),q=new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),-Math.PI/2);GAME.DESKS.forEach((d,i)=>shadows.setMatrixAt(i,matrix.compose(new T.Vector3(d.x,.16,d.z+.2),q,new T.Vector3(4,2.6,1))));this.scene.add(shadows);
 }
 renderScale(w,h){const q=this.quality||'auto',target=q==='auto'||q==='balanced'?1:q==='ultra'?2:Math.min(2,Math.max(1.5,devicePixelRatio));const limit=q==='ultra'?16000000:9000000;return Math.max(1,Math.min(target,Math.sqrt(limit/(w*h))));}
 makeQualityControl(){const label=document.createElement('label');label.className='quality-control';label.append(document.createTextNode('畫質 '));const select=document.createElement('select');select.id='renderQuality';select.setAttribute('aria-label','畫質設定');for(const [value,text]of [['auto','自動順暢'],['high','精緻'],['ultra','極致'],['balanced','標準']]){const o=document.createElement('option');o.value=value;o.textContent=text;select.append(o);}select.value=this.quality;label.append(select);document.querySelector('.camera-controls')?.append(label);select.addEventListener('change',()=>{this.quality=select.value;try{localStorage.setItem('golden-render-quality-v2',this.quality);}catch{}this.applyQuality();});}
 applyQuality(){const w=this.el.clientWidth,h=this.el.clientHeight;if(!w||!h)return;const ratio=this.renderScale(w,h);this.renderer.setPixelRatio(ratio);this.renderer.setSize(w,h,false);this.el.dataset.quality=this.quality;this.el.dataset.renderRatio=ratio.toFixed(2);this.renderer.shadowMap.needsUpdate=true;}
 lightAtelier(){this.scene.background.set('#09151e');this.scene.fog=new T.Fog('#101e2a',180,620);this.renderer.toneMappingExposure=1.22;
  const lights=[];this.scene.traverse(o=>{if(o.isLight)lights.push(o);});for(const l of lights){if(l.isHemisphereLight){l.color.set('#9fbde1');l.groundColor.set('#394b3e');l.intensity=.62;}else if(l.isDirectionalLight){l.intensity=l.castShadow?.8:.42;if(l.castShadow){l.color.set('#b8d1ed');l.position.set(-32,68,25);l.shadow.mapSize.set(2048,2048);Object.assign(l.shadow.camera,{left:-53,right:53,top:53,bottom:-53,near:1,far:160});l.shadow.camera.updateProjectionMatrix();l.shadow.bias=-.00015;l.shadow.normalBias=.065;l.shadow.radius=2;}}else if(l.isPointLight){l.color.set('#ffe0ae');l.intensity=8;l.distance=42;l.decay=1.3;}}
  // Prefiltered studio reflections define glass/metal without extra realtime lights.
  const cv=document.createElement('canvas');cv.width=512;cv.height=256;const c=cv.getContext('2d');c.fillStyle='#233348';c.fillRect(0,0,512,256);const g=c.createLinearGradient(0,0,0,256);g.addColorStop(0,'#71899f');g.addColorStop(.5,'#273c49');g.addColorStop(1,'#272d29');c.fillStyle=g;c.fillRect(0,0,512,256);for(const [x,w,col]of [[24,54,'#edd6ad'],[175,22,'#b8dbeb'],[300,86,'#e9dbc3']]){c.fillStyle=col;c.fillRect(x,60,w,70);}const tx=new T.CanvasTexture(cv);tx.encoding=T.sRGBEncoding;tx.mapping=T.EquirectangularReflectionMapping;const pm=new T.PMREMGenerator(this.renderer);this.atelierEnvironment=pm.fromEquirectangular(tx);this.scene.environment=this.atelierEnvironment.texture;tx.dispose();pm.dispose();
 }
 finishSurfaces(){const maxA=this.renderer.capabilities.getMaxAnisotropy();for(const p of this.pages){p.texture.generateMipmaps=false;p.texture.minFilter=T.LinearFilter;p.texture.anisotropy=maxA;p.texture.needsUpdate=true;p.cloth.material.toneMapped=false;}
  this.posterTexture.generateMipmaps=false;this.posterTexture.minFilter=T.LinearFilter;this.posterTexture.anisotropy=maxA;this.posterTexture.needsUpdate=true;this.posterCloth.material.toneMapped=false;
  this.scene.traverse(o=>{if(!o.isMesh||!o.material)return;const m=o.material;if(m.isMeshStandardMaterial&&!m.userData.surface){m.envMapIntensity=.3;const light=m.color?.getHSL({})?.l||0;if(light>.65){m.roughness=.48;m.metalness=.14;}else{m.roughness=.7;m.metalness=.07;}m.needsUpdate=true;}if(m.map){m.map.anisotropy=maxA;}});
  this.coreCover.material.opacity=.19;this.coreCover.material.envMapIntensity=1.1;this.coreCover.material.roughness=.12;
 }
};})();
