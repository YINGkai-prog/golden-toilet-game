/* ROG hardware city: shared geometry, a sign atlas and a readable playable centre. */
(()=>{'use strict';const T=THREE,Base=window.Office;
const C={shell:'#344961',edge:'#6a839b',dark:'#0b1525',steel:'#9cafc0',cyan:'#69e5ff',purple:'#b292ff',pink:'#f66698',gold:'#ffd28b'};
window.Office=class extends Base{
 constructor(el,move){super(el,move);this.installCityView();this.finishCity();}
 world(){super.world();this.makeHardwareCity();}
 cityBox(color,x,y,z,w,h,d,glow=false){const m=this.box(color,x,y,z,w,h,d,undefined,glow);m.castShadow=false;return m;}
 cityCylinder(color,x,y,z,r,h){const m=this.cylinder(color,x,y,z,r,h);m.castShadow=false;return m;}
 glowPool(color,x,z,w,d){this.cityGlowMats||=new Map();if(!this.cityGlowMats.has(color)){const cv=document.createElement('canvas');cv.width=cv.height=128;const c=cv.getContext('2d'),g=c.createRadialGradient(64,64,0,64,64,64);g.addColorStop(0,color);g.addColorStop(.25,color+'80');g.addColorStop(1,color+'00');c.fillStyle=g;c.fillRect(0,0,128,128);this.cityGlowMats.set(color,new T.MeshBasicMaterial({map:new T.CanvasTexture(cv),transparent:true,opacity:.19,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false}));}const m=new T.Mesh(new T.PlaneGeometry(w,d),this.cityGlowMats.get(color));m.rotation.x=-Math.PI/2;m.position.set(x,.13,z);this.scene.add(m);}
 signTexture(title,sub,color){this.citySigns||=new Map();const key=title+sub+color;if(this.citySigns.has(key))return this.citySigns.get(key);
  const cv=document.createElement('canvas');cv.width=1024;cv.height=256;const c=cv.getContext('2d');c.fillStyle='#060f1d';c.fillRect(0,0,1024,256);
  c.strokeStyle=color;c.lineWidth=4;c.strokeRect(9,9,1006,238);c.globalAlpha=.16;for(let x=24;x<1000;x+=20)c.fillRect(x,16,1,224);c.globalAlpha=1;
  c.fillStyle=color;c.shadowColor=color;c.shadowBlur=14;c.font='700 76px "Arial", "Microsoft JhengHei", sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText(title,512,98,940);c.shadowBlur=0;c.font='22px "Arial", "Microsoft JhengHei",sans-serif';c.fillStyle='#b9d5e7';c.fillText(sub,512,190,920);
  const tx=new T.CanvasTexture(cv);tx.encoding=T.sRGBEncoding;tx.anisotropy=this.renderer.capabilities.getMaxAnisotropy();this.citySigns.set(key,tx);return tx;
 }
 citySign(title,sub,color,x,y,z,w,angle=0){const m=new T.Mesh(new T.PlaneGeometry(w,w/4),new T.MeshBasicMaterial({map:this.signTexture(title,sub,color),side:T.DoubleSide,toneMapped:false}));m.position.set(x,y,z);m.rotation.y=angle;this.scene.add(m);this.citySignCount=(this.citySignCount||0)+1;return m;}
 logo(x,y,z,w,angle=0){if(!this.rogTexture){this.rogTexture=new T.TextureLoader().load('/rog-mark.png');this.rogTexture.encoding=T.sRGBEncoding;this.rogTexture.anisotropy=this.renderer.capabilities.getMaxAnisotropy();this.rogMaterial=new T.MeshBasicMaterial({map:this.rogTexture,transparent:true,side:T.DoubleSide,depthWrite:false,toneMapped:false});}
  const m=new T.Mesh(new T.PlaneGeometry(w,w*1467/2500),this.rogMaterial);m.position.set(x,y,z);m.rotation.y=angle;this.scene.add(m);this.rogLogoCount=(this.rogLogoCount||0)+1;return m;}
 tower(x,z,w,d,h,accent,kind,index){const b=(c,dx,y,dz,bw,bh,bd,g=false)=>this.cityBox(c,x+dx,y,z+dz,bw,bh,bd,g);
  b(C.dark,0,.4,0,w+3,.8,d+3);b(C.edge,0,1.1,0,w+1.4,.7,d+1.4);b(accent,0,1.52,d/2+.72,w+1.2,.12,.14,true);
  this.glowPool(accent,x,z+d*.54,w*2.1,d*1.4);
  b(C.shell,0,h/2+1.5,0,w,h,d);b('#101e32',0,h/2+1.7,d/2+.05,w-.7,h-.8,.12);
  // Close-spaced fins give the buildings the language of heatsinks and memory modules.
  for(let y=2;y<h+1;y+=1.55){b(C.edge,0,y,0,w+.8,.22,d+.7);for(let k=0;k<4;k++){const on=(k+Math.floor(y)+index)%4!==0;b(on?accent:'#294555',-w*.36+k*w*.24,y+.56,d/2+.42,w*.17,.22,.08,on);}
   if(Math.floor(y)%3===0)b(accent,w/2+.43,y+.5,0,.07,.15,d-.8,true);}
  for(const side of[-1,1]){b(C.steel,side*(w/2-.35),h/2+1.5,d/2+.5,.32,h+.25,.7);b(accent,side*(w/2-.72),h/2+1.5,d/2+.89,.14,h-1,.06,true);}
  b(C.dark,0,h+1.8,0,w+1.2,.5,d+1);b(C.edge,0,h+2.15,0,w,.25,d);b(accent,0,h+2.34,d/2-.25,w-.5,.1,.15,true);
  // Roof hardware, service ladders, antennae and address lights.
  for(let k=0;k<3;k++){b(C.shell,-w*.29+k*w*.28,h+3,-d*.18,w*.2,1.5,d*.42);for(let a=0;a<4;a++)b(C.steel,-w*.36+k*w*.28+a*w*.045,h+3.82,-d*.18,.12,.1,d*.4);}
  for(let y=2;y<h;y+=1.3)b(C.steel,w/2+.65,y,-d*.27,.8,.09,.12);
  for(const side of[-1,1]){this.cityCylinder(C.edge,x+side*w*.42,h+3.1,z-d*.4,.11,2.3);b(index%2?C.pink:C.cyan,side*w*.42,h+4.3,-d*.4,.26,.28,.26,true);}
  if(kind===1){for(let k=0;k<4;k++){const px=x-w*.3+k*w*.2;this.cityCylinder('#a2afbd',px,h+4,z+.6,w*.085,3.4);this.cityCylinder(C.dark,px,h+5.76,z+.6,w*.09,.15);this.cityCylinder(accent,px,h+3.1,z+.6,w*.092,.18);}}
  if(kind===2)this.fan(x,h+7,z,w*.47,accent);
  if(kind===3){b('#214259',0,h+5.8,0,w*.65,7,d*.65);for(const sx of[-1,1])for(const sz of[-1,1])b(C.cyan,sx*w*.33,h+5.8,sz*d*.33,.15,7.5,.15,true);this.citySign('ROG','INTELLIGENCE CORE',C.cyan,x,h+5.8,z+d*.34+.05,w*.6);}
  if(index%2===0)this.logo(x,h*.58+1,z+d/2+.93,Math.min(w*.62,9));
  const labels=[['REPUBLIC OF GAMERS','FOR THOSE WHO DARE'],['ROG LAB','BUILD BEYOND LIMITS'],['COOLING DISTRICT','THERMAL SYSTEM / ONLINE'],['創作，不設限','敢想，敢造，一起蓋馬桶'],['OVERTIME CLUB','TONIGHT WE BUILD TOGETHER'],['GOLDEN BOX','HUMAN × HUMAN × AI']];
  if(index%3!==1){const text=labels[index%labels.length];this.citySign(text[0],text[1],accent,x,h+1.8,z+d/2+.98,w+1);}
 }
 fan(x,y,z,r,color){this.cityBox(C.dark,x,y,z,r*2.35,r*2.35,1);for(const side of[-1,1]){this.cityBox(C.edge,x+side*r*1.2,y,z,.35,r*2.6,1.2);this.cityBox(color,x+side*r*1.2,y+r,z+.7,.3,.4,.05,true);}
  const ring=new T.Mesh(new T.TorusGeometry(r,.17,6,48),this.mat(C.steel));ring.position.set(x,y,z+.7);this.scene.add(ring);const blades=new T.Group();blades.position.set(x,y,z+.75);this.scene.add(blades);
  // Fan blades deliberately remain static geometry so large city views stay cheap.
  for(let i=0;i<9;i++){const a=i*Math.PI*2/9,m=this.box('#567d99',Math.cos(a)*r*.54,Math.sin(a)*r*.54,0,r*.94,r*.3,.1,blades);m.rotation.z=a+.6;m.castShadow=false;}
  const cap=this.cityCylinder(C.edge,x,y,z+.9,r*.22,.3);cap.rotation.x=Math.PI/2;
 }
 capacitorBank(x,z){this.cityBox(C.dark,x,.6,z,22,1.2,23);for(let ix=0;ix<4;ix++)for(let iz=0;iz<4;iz++){const px=x-8+ix*5.3,pz=z-8+iz*5.3,h=5+(ix+iz)%3*1.4;this.cityCylinder('#7b8f9e',px,h/2+1,pz,1.65,h);this.cityCylinder(C.dark,px,h+1,pz,1.73,.5);this.cityCylinder(C.cyan,px,h+.93,pz,1.75,.12);for(let y=1.5;y<h;y+=1.2)this.cityCylinder(C.edge,px,y,pz,1.71,.22);this.cityBox(C.steel,px,h+1.5,pz,.24,.5,.2);}
  this.citySign('POWER ARRAY','16 CELLS / ALWAYS ON',C.cyan,x,2.5,z+12,20);}
 makeHardwareCity(){
  this.cityBuildings=0;
  // A motherboard-like district surrounds the existing playable campus, all outside its navigation bounds.
  this.cityBox('#071120',0,-.64,-27,292,.55,265);this.cityBox('#243a50',0,-.4,-27,290,.12,263);
  for(const x of[-144,144])this.cityBox(C.cyan,x,-.19,-27,.13,.12,262,true);
  for(const z of[-158,104])this.cityBox(C.purple,0,-.19,z,288,.12,.14,true);
  for(const x of[-103,103]){this.cityBox('#0c1828',x,-.08,-25,13,.1,250);for(let z=-142;z<92;z+=9)this.cityBox('#aec7d4',x,.015,z,.16,.04,3.1);for(const dx of[-6,6])this.cityBox('#517086',x+dx,.05,-25,.25,.08,247);}
  for(const z of[-86,-132,90]){this.cityBox('#0b1625',0,-.07,z,286,.1,10);for(let x=-137;x<140;x+=9)this.cityBox('#a4bed0',x,.02,z,3,.035,.14);}
  const buildings=[[-121,-111,15,18,42,0],[-76,-111,18,18,34,2],[-48,-111,16,18,22,1],[-20,-112,19,19,36,3],[12,-112,18,18,30,1],[44,-111,20,18,44,2],[78,-110,14,18,27,0],[123,-112,17,20,35,0],[-124,-57,17,20,29,0],[-77,-55,14,16,21,1],[79,-54,16,17,26,0],[124,-57,18,20,40,1],[-125,-20,18,20,37,2],[-77,-17,14,17,15,0],[79,-18,14,18,18,1],[125,-19,18,21,28,0],[-123,20,17,20,24,0],[-78,21,14,18,12,0],[80,21,14,18,11,1],[124,20,18,20,32,2],[-125,58,17,18,18,1],[-79,57,13,16,9,0],[124,59,18,18,17,0],[-126,-148,17,12,18,0],[-90,-149,18,12,13,0],[-52,-149,19,12,17,1],[-14,-149,18,12,23,0],[23,-149,19,12,16,0],[63,-148,21,12,20,1],[122,-148,19,12,14,0]];
  buildings.forEach(([x,z,w,d,h,k],i)=>{this.tower(x,z,w,d,h,[C.cyan,C.purple,C.cyan,C.gold,C.pink][i%5],k,i);this.cityBuildings++;});this.capacitorBank(79,57);
  for(const x of[-139,-65,66,139])for(let z=-66;z<64;z+=18){this.cityBox(C.dark,x,1.7,z,3,3.4,5);this.cityBox(C.edge,x,3.5,z,3.3,.18,5.3);for(let y=.5;y<3.3;y+=.55)this.cityBox(C.steel,x,y,z+2.55,2.6,.13,.08);this.cityBox(C.cyan,x,3,z+2.61,1.7,.12,.1,true);}
  for(const x of[-60,60])for(let z=-124;z<-92;z+=5){this.cityCylinder(C.steel,x,2.1,z,1.4,4.2);this.cityCylinder(C.dark,x,4.3,z,1.45,.25);this.cityCylinder(C.purple,x,3.9,z,1.49,.12);}
  // Raised coolant conduits bridge the rear service blocks without covering the office or projection cloths.
  for(const z of[-98,-122]){this.cityBox(C.edge,0,9,z,164,.9,1.2);this.cityBox(C.purple,0,9.52,z,163,.11,.3,true);for(const x of[-77,-46,-15,16,47,78])this.cityBox(C.shell,x,4.4,z,.65,8.8,.65);}
  for(const side of[-1,1])for(let i=0;i<6;i++){const x=side*(68+i*.6);this.cityBox(i%2?C.edge:'#526752',x,.09,-4,.12,.08,110);this.cityBox(i%2?C.edge:'#526752',side*86,.09,76+i*.65,35,.08,.1);}
  for(const x of[-110,110])for(let z=-130;z<90;z+=22){this.cityCylinder(C.edge,x,2.8,z,.095,5.6);this.cityBox(C.gold,x,5.7,z,.7,.15,.7,true);}
  for(const [x,z]of[[-70,-73],[70,-73],[-70,80],[70,80]]){this.cityBox(C.dark,x,2.9,z,5,5.8,1);this.logo(x,3.7,z+.53,3.8);this.citySign('ROG','FOR THOSE WHO DARE',C.cyan,x,1.55,z+.55,4.5);}
  // Ground-floor signage keeps the brand visible while people are actually playing.
  this.cityBox(C.dark,0,3.3,40,17,1.5,.4);this.citySign('GOLDEN BOX × ROG','敢想，敢造，一起蓋馬桶',C.cyan,0,3.3,40.23,16.5);
  this.cityBox(C.dark,0,1.14,26.12,5.5,1.38,.09);this.logo(0,1.14,26.19,2.1);
  for(const [x,z,title,sub,color]of[[-26,-6.15,'ROG LAB / 01','DARE TO CREATE',C.cyan],[26,-6.15,'ROG LAB / 02','BUILD BEYOND LIMITS',C.purple],[-9,-29.3,'PLAY BEYOND','摸魚 20 秒，靈感多一點',C.pink],[29,-29.3,'ROG AI CORE','GB300 / VALIDATION ONLINE',C.cyan],[-30,-29.3,'RECHARGE','COFFEE IN / IDEAS OUT',C.gold]])this.citySign(title,sub,color,x,3,z,Math.min(title==='ROG AI CORE'?17:16,17));
  this.citySign('FOR THOSE WHO DARE','REPUBLIC OF GAMERS',C.cyan,0,10,-67,45);this.logo(-28,10,-67,7);this.logo(28,10,-67,7);
  for(const side of[-1,1]){this.cityBox(C.cyan,side*40.4,4.6,4.5,.08,.08,69,true);this.cityBox(C.purple,side*10.55,3.9,22,.07,.07,44,true);}
 }
 finishCity(){this.scene.background.set('#080f1d');this.scene.fog=new T.Fog('#080f1d',260,700);this.renderer.toneMappingExposure=1.12;
  for(const color of[C.shell,C.edge,C.dark,C.steel]){const m=this.mat(color);m.metalness=.4;m.roughness=.4;m.envMapIntensity=.9;}
  for(const color of[C.cyan,C.purple,C.pink,C.gold]){const m=this.mat(color,true);m.emissiveIntensity=2.4;m.toneMapped=false;}
  // Red identity from the supplied transparent logo; no approximation or tracing.
  this.renderer.shadowMap.needsUpdate=true;
 }
 installCityView(){const button=document.createElement('button');button.id='cameraHardwareCity';button.textContent='ROG 城市';button.title='查看硬體微縮城市全景';button.addEventListener('click',()=>{this.follow=false;this.desiredFocus.set(0,8,-27);this.goal={theta:.43,phi:.77,radius:337};});document.querySelector('.camera-controls')?.prepend(button);
  const heading=document.querySelector('.scene-heading');if(heading){heading.querySelector('.eyebrow').textContent='21:47 / REPUBLIC OF OVERTIME';heading.querySelector('h1').textContent='敢想，敢造。今晚一起蓋馬桶。';heading.querySelector('p').textContent='金盒公司 × ROG ｜ FOR THOSE WHO DARE';}
  const mark=document.querySelector('.brand-mark');if(mark){mark.textContent='';const img=document.createElement('img');img.src='/rog-mark.png';img.alt='ROG';mark.append(img);}
 }
};})();
