/* Geometry-built hardware metropolis. Spatial instance batches and distance-tiered modules. */
(()=>{'use strict';const T=THREE,Base=window.Office;
const P={black:'#0a111b',shell:'#263b4d',edge:'#586e80',silver:'#a3bac8',copper:'#a87558',cyan:'#95eaff',violet:'#c5b3ff',amber:'#ffdda5',glass:'#183a50'};
window.Office=class extends Base{
 constructor(el,move){super(el,move);this.installOptics();}
 fixture(f){if(f.type!=='boardTable')return super.fixture(f);const {x,z}=f;
  this.box('#a9bcb3',x,.05,z,17,.04,8);this.box('#263b4c',x,1.1,z,15.8,.24,4.1);for(const dx of[-5,5])this.box('#81919b',x+dx,.54,z,1.1,1.1,2.6);
  this.boardProps=new T.Group();this.scene.add(this.boardProps);const geo=new T.BoxGeometry(.9,.08,.6);for(const dx of[-5,-3,-1,1,3,5])for(const side of[-1,1]){this.box('#c2c9b3',x+dx,.7,z+side*2.7,1,.2,1);this.box('#b4bfa7',x+dx,1.2,z+side*3.15,1,1,.15);const prop=new T.Mesh(geo,this.mat('#b5c7c3'));prop.position.set(x+dx,1.26,z+side*.8);this.boardProps.add(prop);}
 }
 makeExhibition(){super.makeExhibition();this.exhibitionLights=[];for(const e of this.exhibits){const x=e.group.position.x,light=new T.SpotLight('#fff0cf',0,16,.42,.6,1.3);light.position.set(x,9,29);light.target.position.set(x,1.5,29);light.castShadow=false;this.scene.add(light,light.target);
   const fixture=new T.Mesh(new T.CylinderGeometry(.3,.2,.55,16),new T.MeshStandardMaterial({color:'#182734',metalness:.7,roughness:.3}));fixture.position.copy(light.position);this.scene.add(fixture);
   const beam=new T.Mesh(new T.ConeGeometry(2.05,7.3,32,1,true),new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending,vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec2 vUv; void main(){float a=pow(vUv.y,2.)*.06;gl_FragColor=vec4(1.,.85,.6,a);}'}));beam.position.set(x,5.05,29);beam.visible=false;this.scene.add(beam);this.exhibitionLights.push({light,beam,team:e.team});}
 }
 updateModels(){super.updateModels();if(!this.exhibitionLights)return;const any=this.exhibits.some(e=>e.count>0);this.boardProps.visible=!any;for(const e of this.exhibitionLights){const on=this.exhibits.find(m=>m.team===e.team).count>0;e.light.intensity=on?36:0;e.beam.visible=on;}this.el.dataset.exhibition=any?'spotlight':'meeting';}
 initHardware(){
  this.hwBatches=new Map();this.hwMaterials=new Map();this.hwMatrix=new T.Matrix4();this.hwQuaternion=new T.Quaternion();this.hwEuler=new T.Euler();this.hardwareMeshes=[];
  const shape=new T.Shape();shape.moveTo(-.465,-.465);shape.lineTo(.465,-.465);shape.lineTo(.465,.465);shape.lineTo(-.465,.465);shape.closePath();
  const bevel=new T.ExtrudeGeometry(shape,{depth:.93,bevelEnabled:true,bevelSegments:1,steps:1,bevelSize:.035,bevelThickness:.035});bevel.translate(0,0,-.465);
  this.hwGeo={box:new T.BoxGeometry(1,1,1),bevel,cyl:new T.CylinderGeometry(1,1,1,16),ring:new T.TorusGeometry(1,.065,6,32)};
  const blade=new T.Shape();blade.moveTo(.16,-.09);blade.bezierCurveTo(.5,-.42,.91,-.3,1,-.06);blade.bezierCurveTo(.69,.02,.62,.26,.26,.21);blade.closePath();this.hwGeo.blade=new T.ExtrudeGeometry(blade,{depth:.035,bevelEnabled:true,bevelSize:.012,bevelThickness:.015,bevelSegments:1,curveSegments:8});
  const cv=document.createElement('canvas');cv.width=cv.height=256;const c=cv.getContext('2d');c.fillStyle='#888';c.fillRect(0,0,256,256);let seed=72;for(let i=0;i<3000;i++){seed=(seed*1664525+1013904223)>>>0;const v=100+seed%65;c.fillStyle=`rgb(${v},${v},${v})`;c.fillRect(seed%256,(seed>>>8)%256,10+seed%40,1);}const tex=new T.CanvasTexture(cv);tex.wrapS=tex.wrapT=T.RepeatWrapping;
  this.hwMaterials.set('metal',new T.MeshStandardMaterial({color:'#fff',metalness:.78,roughness:.3,bumpMap:tex,bumpScale:.014,envMapIntensity:1.4}));
  this.hwMaterials.set('dark',new T.MeshStandardMaterial({color:'#fff',metalness:.48,roughness:.43,envMapIntensity:1}));
  this.hwMaterials.set('glass',new T.MeshStandardMaterial({color:'#fff',metalness:.7,roughness:.14,envMapIntensity:1.7}));
  const panels=new T.TextureLoader().load('/hardware-panels.png');panels.colorSpace=T.SRGBColorSpace;panels.wrapS=panels.wrapT=T.RepeatWrapping;panels.repeat.set(1,1);panels.anisotropy=8;this.hardwarePanels=panels;
  this.hwMaterials.set('panel',new T.MeshStandardMaterial({color:'#fff',map:panels,bumpMap:panels,bumpScale:.055,metalness:.63,roughness:.4,envMapIntensity:1.25}));
  this.hwMaterials.set('light',new T.MeshBasicMaterial({color:new T.Color(1.5,1.5,1.5),toneMapped:false}));this.hwCount=0;
 }
 part(geo,color,x,y,z,w,h,d,material='metal',rx=0,ry=0,rz=0){
  const key=geo+material+Math.floor(x/150)+','+Math.floor(z/150);let b=this.hwBatches.get(key);if(!b){b={geo:this.hwGeo[geo],mat:this.hwMaterials.get(material),items:[]};this.hwBatches.set(key,b);}
  this.hwQuaternion.setFromEuler(this.hwEuler.set(rx,ry,rz));this.hwMatrix.compose(new T.Vector3(x,y,z),this.hwQuaternion,new T.Vector3(w,h,d));b.items.push({matrix:this.hwMatrix.clone(),color:new T.Color(color)});this.hwCount++;
 }
 hb(c,x,y,z,w,h,d,m='metal'){this.part('box',c,x,y,z,w,h,d,m);}
 bevel(c,x,y,z,w,h,d,m='metal'){this.part('bevel',c,x,y,z,w,h,d,m);}
 hc(c,x,y,z,r,h,m='metal',rx=0,rz=0){this.part('cyl',c,x,y,z,r,h,r,m,rx,0,rz);}
 pipe(a,b,r=.23,color=P.copper){const v=new T.Vector3(...b).sub(new T.Vector3(...a)),mid=new T.Vector3(...a).add(new T.Vector3(...b)).multiplyScalar(.5),q=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),v.clone().normalize()),e=new T.Euler().setFromQuaternion(q);this.part('cyl',color,mid.x,mid.y,mid.z,r,v.length(),r,'metal',e.x,e.y,e.z);}
 rail(x,y,z,w,d){for(const zz of[-d/2,d/2]){this.hb(P.edge,x,y+1,z+zz,w,.09,.09);this.hb(P.edge,x,y+.5,z+zz,w,.055,.055);for(let xx=-w/2;xx<=w/2;xx+=3)this.hb(P.edge,x+xx,y+.5,z+zz,.07,1,.07);}}
 condenser(x,y,z,r=1,h=3){this.hc(P.silver,x,y+h/2,z,r,h);this.hc(P.black,x,y+h,z,r*1.06,.23);this.hc(P.edge,x,y+.25,z,r*1.05,.3);for(let a=0;a<12;a++){const ang=a*Math.PI/6;this.hb(P.edge,x+Math.cos(ang)*r,y+h/2,z+Math.sin(ang)*r,.07,h-.2,.07);}this.hb(P.silver,x,y+h+.13,z,r*1.6,.035,.08);this.hb(P.silver,x,y+h+.13,z,.08,.035,r*1.6);}
 hardwareFan(x,y,z,r,vertical=true){
  this.bevel(P.black,x,y,z,r*2.4,vertical?r*2.4:.7,vertical?.7:r*2.4,'dark');
  if(vertical){this.part('ring',P.edge,x,y,z+.48,r,r,r);for(let j=0;j<9;j++){const a=j*Math.PI*2/9;this.part('blade',P.shell,x,y,z+.51,r*.94,r*.94,1,'metal',0,0,a);}this.hc(P.silver,x,y,z+.62,r*.19,.22,'metal',Math.PI/2);}
  else{this.part('ring',P.edge,x,y+.45,z,r,r,r,'metal',Math.PI/2);for(let j=0;j<9;j++){const a=j*Math.PI*2/9;this.part('blade',P.shell,x,y+.42,z,r*.94,r*.94,1,'metal',-Math.PI/2,0,a);}this.hc(P.silver,x,y+.55,z,r*.19,.22);}
  for(const a of[-1,1])for(const b of[-1,1])this.hb(P.amber,x+a*r*1.08,vertical?y+b*r*1.08:y+.39,vertical?z+.4:z+b*r*1.08,.15,.13,.15,'light');
 }
 tower(x,z,w,d,h,kind,seed,detail=2){
  const a=[P.cyan,P.cyan,P.violet,P.amber][seed%4],b=(c,dx,y,dz,bw,bh,bd,m='metal')=>this.hb(c,x+dx,y,z+dz,bw,bh,bd,m);
  b(P.black,0,.35,0,w+3,.7,d+3,'dark');this.bevel(P.shell,x,2,z,w+1,3,d+1);b(P.amber,0,2.8,d/2+.55,w*.76,.13,.12,'light');
  const levels=detail===0?2:3,step=h/levels;
  for(let level=0;level<levels;level++){
   const sw=w*(1-level*.14),sd=d*(1-level*.12),ox=(kind%2?1:-1)*level*w*.07,base=3+level*step;
   this.bevel(detail?'#b8c9d5':P.black,x+ox,base+step/2,z,sw,step,sd,detail?'panel':'dark');b(detail?'#b8cadb':P.glass,ox,base+step/2,sd/2+.03,sw*.85,step*.85,.08,detail?'panel':'glass');
   for(let y=base+.3;y<base+step-.1;y+=detail===0?3.6:1.25){b(P.edge,ox,y,0,sw+.62,detail===0?.2:.13,sd+.7);if((Math.round(y*2)+seed)%4===0){b(a,ox,y+.25,sd/2+.37,sw*.87,.12,.05,'light');if(detail>0)b(a,ox+sw/2+.36,y+.25,0,.05,.11,sd*.76,'light');}}
   b(detail?'#a4b7c5':P.shell,ox,base+step,0,sw+1.3,.6,sd+1.4,detail?'panel':'metal');
   for(const side of[-1,1]){b(P.silver,ox+side*(sw/2-.35),base+step/2,sd/2+.55,.36,step,.5);if(kind===1)b(a,ox+side*(sw/2-.77),base+step/2,sd/2+.62,.13,step*.85,.09,'light');}
   if(detail>0){this.rail(x+ox,base+step+.3,z+sd/2+.65,sw+.9,1.1);for(let k=0;k<3;k++)this.bevel(P.shell,x+ox-sw*.3+k*sw*.29,base+step+.8,z+sd/2-.3,sw*.19,.9,1.2);}
  }
  if(detail===0){b(a,0,h+3.8,d*.4,w*.55,.22,.15,'light');return;}
  b('#a0b5c3',-w*.28,h*.43+3,d/2+.8,w*.25,h*.76,1.2,'panel');
  for(let k=0;k<3;k++){const px=x-w*.37+k*.45;this.pipe([px,3,z+d/2+1.6],[px,h*.77,z+d/2+1.6],.15);for(let y=4;y<h*.75;y+=4.5)this.hc(P.edge,px,y,z+d/2+1.6,.22,.25);}
  b(P.glass,w*.2,2,d/2+.7,w*.36,2.9,.12,'glass');for(let k=0;k<4;k++)b(P.amber,w*.05+k*w*.1,2,d/2+.8,.1,2.3,.04,'light');
  for(let k=0;k<4;k++){b(P.black,-w*.38+k*w*.24,.9,d/2+1.2,w*.18,1.4,.6,'dark');for(let j=0;j<4;j++)b(P.edge,-w*.38+k*w*.24,.45+j*.27,d/2+1.54,w*.15,.05,.04);}
  const top=h+3.6;
  if(kind===0){this.hardwareFan(x-w*.12,top+1,z,w*.22,false);this.hardwareFan(x+w*.23,top+1,z,w*.16,false);}
  if(kind===1)for(let i=0;i<3;i++)this.condenser(x-w*.22+i*w*.22,top,z,Math.min(1.5,w*.085),3.2);
  if(kind===2)this.hardwareFan(x,top+w*.36,z,w*.34,true);
  if(kind===3){this.bevel(P.glass,x,top+3,z,w*.56,5.8,d*.52,'glass');for(const side of[-1,1])b(P.cyan,side*w*.285,top+3,d*.27,.13,6,.13,'light');b(P.cyan,0,top+6,d*.27,w*.57,.12,.1,'light');}
  for(const dx of[-w*.32,w*.3]){this.hc(P.edge,x+dx,top+1.5,z-d*.23,.07,3);b('#ff737a',dx,top+3,-d*.23,.17,.2,.17,'light');}
  if(detail===2){for(let y=4;y<h*.8;y+=1)b(P.edge,w/2+.65,y,-d*.2,.8,.08,.1);for(const dx of[w/2+.27,w/2+1.02])b(P.silver,dx,h*.4+2,-d*.2,.08,h*.8,.08);}
 }
 bridge(x1,x2,z,y){const w=x2-x1,c=(x1+x2)/2;this.bevel(P.black,c,y,z,w,.75,2.6,'dark');this.rail(c,y+.4,z,w,2.6);this.hb(P.amber,c,y+.47,z+1.31,w-.4,.06,.04,'light');for(let x=x1;x<x2;x+=3)this.hb(P.edge,x,y+.42,z,.12,.04,2.6);}
 coolant(x1,x2,z,y){for(let k=0;k<3;k++){const zz=z+k*.7;this.pipe([x1,y,zz],[x2,y,zz],.23);for(let x=x1;x<=x2;x+=5)this.hc(P.edge,x,y,zz,.31,.22,'metal',0,Math.PI/2);}for(let x=x1+2;x<x2;x+=14){this.hb(P.shell,x,y/2,z+.7,.22,y,.24);this.hb(P.edge,x,y-.42,z+.7,.5,.14,2.1);}}
 street(x,z,w,d){this.hb('#101c29',x,-.035,z,w,.055,d,'dark');const along=w>d;for(let i=-Math.max(w,d)/2+4;i<Math.max(w,d)/2-2;i+=8)this.hb('#70858d',x+(along?i:0),.01,z+(along?0:i),along?2.8:.12,.022,along?.12:2.8);for(const s of[-1,1])this.hb(P.edge,x+(along?0:s*w/2),.02,z+(along?s*d/2:0),along?w:.15,.06,along?.15:d);}
 makeHardwareCity(){
  this.initHardware();this.cityBuildings=0;
  this.hb('#0e1725',0,-.7,0,2400,.5,2400,'dark');for(let i=-8;i<=8;i++){this.street(i*66,0,9,1700);this.street(0,i*66,1700,9);}
  const near=[[-77,-49,19,22,25,1],[-104,-52,23,24,38,0],[-137,-54,22,22,47,2],[76,-49,20,22,26,3],[104,-51,21,24,39,1],[137,-49,25,24,48,0],[-76,-82,22,22,44,2],[-106,-84,23,24,31,1],[-141,-86,25,25,51,0],[76,-82,22,22,40,0],[106,-83,24,24,53,2],[140,-83,22,24,34,1],[-40,-112,24,24,39,0],[-9,-116,25,23,54,2],[25,-114,25,25,31,3],[57,-119,21,24,46,1],[-77,-118,23,23,55,1],[-112,-120,25,24,42,0],[104,-120,23,25,37,3],[-80,-14,21,24,20,0],[-109,-15,23,24,29,3],[-141,-16,26,24,40,1],[81,-14,22,24,23,1],[111,-15,23,24,35,0],[143,-15,24,23,40,2],[-80,23,21,23,16,3],[-109,24,23,24,23,1],[-141,23,25,24,31,0],[82,24,21,24,17,0],[112,25,23,24,29,2],[144,25,24,24,36,1],[-78,60,21,23,11,0],[-110,62,24,24,18,1],[-142,62,25,24,26,3],[111,63,24,23,17,0],[143,63,23,24,28,1]];
  near.forEach(([x,z,w,d,h,k],i)=>{this.tower(x,z,w,d,h,k,i,2);this.cityBuildings++;});
  for(let gx=-12;gx<=12;gx++)for(let gz=-12;gz<=12;gz++){
   const x=gx*33,z=gz*33-16;if(Math.abs(x)<161&&z>-147&&z<91||Math.abs(x)<65&&z>=91&&z<145)continue;
   const seed=Math.abs(gx*137+gz*331+gx*gz*19),distance=Math.hypot(x,z),detail=distance<240?1:0;this.tower(x,z,19+seed%7,18+(seed>>>3)%8,19+seed%43+(distance>210?seed%24:0),seed%4,seed,detail);this.cityBuildings++;
  }
  for(const [cx,cz]of[[79,63],[-44,-78],[39,-80]]){this.bevel(P.black,cx,1,cz,23,1.7,20,'dark');for(let i=0;i<4;i++)for(let j=0;j<3;j++)this.condenser(cx-8+i*5.2,1.9,cz-6+j*5.5,1.7,4+(i+j)%3*1.1);}
  for(const z of[-68,-103,-140]){this.coolant(-146,-65,z,9);this.coolant(65,148,z,10);}this.coolant(-52,49,-101,13);this.bridge(-56,56,-94,8);
  for(const side of[-1,1]){for(const z of[-35,3,42])this.bridge(side<0?-142:68,side<0?-68:144,z,6);for(const x of[side*65,side*97,side*130])for(let z=-128;z<81;z+=12){this.hc(P.edge,x,2.8,z,.07,5.6);this.hb(P.amber,x,5.63,z,.9,.11,.35,'light');this.hb(P.black,x-1,.6,z+2,1.1,1.2,.8,'dark');this.hb(P.cyan,x-1,.85,z+2.42,.65,.05,.04,'light');}}
  for(const x of[-61,62]){for(let k=0;k<3;k++)this.pipe([x+k*.6,.3,-72],[x+k*.6,.3,77],.12,P.edge);for(let z=-58;z<75;z+=9){this.hb(P.black,x,.06,z,2,.08,2,'dark');for(let k=0;k<6;k++)this.hb(P.edge,x-.7+k*.28,.115,z,.06,.02,1.7);}}
  // Exactly three architectural logos: skyline landmark, company entrance, side-district gateway.
  this.logo(-9,46,-102.8,11);this.citySign('FOR THOSE WHO DARE','REPUBLIC OF GAMERS',P.cyan,-9,35,-102.5,22);
  this.logo(0,4.7,40.4,3.5);this.citySign('GOLDEN BOX','TONIGHT WE BUILD TOGETHER',P.amber,0,2.9,40.42,13);
  this.logo(111,24,-2.4,5);this.citySign('COOLING DISTRICT','THERMAL NETWORK / ONLINE',P.cyan,106,55,-70,16);
  this.citySign('第一研發處','DESIGN / ENGINEERING',P.cyan,-26,3,-6.15,16);this.citySign('第二研發處','DESIGN / ENGINEERING',P.violet,26,3,-6.15,16);
  this.citySign('金盒公司 · 一起蓋馬桶','DESIGN ATELIER / NIGHT SHIFT',P.amber,-30,3.8,40.35,16);
  this.citySign('INTELLIGENCE CORE','GB300 / VALIDATION ONLINE',P.cyan,30,3,-29.2,15);
  this.citySign('RECHARGE','COFFEE IN / IDEAS OUT',P.amber,-30,3,-29.2,14);this.citySign('PLAY BEYOND','TAKE A BREAK / FIND AN IDEA',P.violet,-9,3,-29.2,14);
  for(const x of[-41,41]){this.bevel(P.black,x,4.3,4,1,1.1,71,'dark');this.hb(P.amber,x,3.72,4,.12,.09,70,'light');for(let z=-29;z<40;z+=5)this.bevel(P.edge,x,1.9,z,.35,3.8,.4);for(let j=0;j<3;j++)this.hb(P.edge,x,4.2+j*.3,4,1.12,.07,71.2);}
  for(const z of[-31,40]){this.bevel(P.black,0,4.4,z,83,.9,1,'dark');this.hb(P.amber,0,3.9,z+.55,81,.065,.07,'light');}
  for(const x of[-46,46])for(const z of[-26,24]){this.bevel(P.black,x,1,z,6,2,9,'dark');this.hardwareFan(x,2.1,z,2.1,false);this.pipe([x,1,z+4],[x>0?41:-41,1,z+4],.25);}
  for(const b of this.hwBatches.values()){const m=new T.InstancedMesh(b.geo,b.mat,b.items.length),bounds=new T.Box3();b.geo.computeBoundingBox();b.items.forEach((item,i)=>{m.setMatrixAt(i,item.matrix);m.setColorAt(i,item.color);bounds.union(b.geo.boundingBox.clone().applyMatrix4(item.matrix));});m.castShadow=false;m.receiveShadow=true;m.frustumCulled=false;m.userData.hardware=true;m.userData.bounds=bounds.getBoundingSphere(new T.Sphere());this.hardwareMeshes.push(m);this.scene.add(m);}this.hardwareInstanceCount=this.hwCount;this.hwBatches.clear();
 }
 finishCity(){super.finishCity();this.scene.background.set('#111d30');this.scene.fog=new T.FogExp2('#142238',.0025);this.camera.far=1800;this.camera.updateProjectionMatrix();this.renderer.toneMappingExposure=1.22;
  for(const [name,m]of this.hwMaterials)if(m.isMeshStandardMaterial){m.metalness=name==='metal'?.78:name==='glass'?.7:name==='panel'?.63:.48;m.roughness=name==='metal'?.3:name==='glass'?.14:.4;m.envMapIntensity=name==='glass'?1.7:name==='metal'?1.4:1.25;}
  this.scene.traverse(o=>{if(o.isHemisphereLight){o.color.set('#a9c8ec');o.groundColor.set('#182739');o.intensity=.72;}if(o.isDirectionalLight&&!o.castShadow){o.color.set('#aacfff');o.intensity=.75;}});
  // The supplied logo alpha remains exact; architectural signs use restrained ice-white illumination.
  this.rogMaterial.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\n diffuseColor.rgb=vec3(1.0,1.1,1.2);');};this.rogMaterial.needsUpdate=true;
 }
 installCityView(){super.installCityView();const old=document.querySelector('#cameraHardwareCity'),b=old.cloneNode(true);old.replaceWith(b);b.addEventListener('click',()=>{this.follow=false;this.desiredFocus.set(0,10,-17);this.goal={theta:.44,phi:.6,radius:250};});
  const close=document.createElement('button');close.id='cameraCityDetail';close.textContent='城市近景';close.addEventListener('click',()=>{this.follow=false;this.desiredFocus.set(-89,13,-96);this.goal={theta:0,phi:.3,radius:62};});b.after(close);
 }
 installOptics(){
  const r=this.renderer,render=r.render.bind(r),RT=T.WebGLRenderTarget;
  const source=new RT(1,1,{minFilter:T.LinearFilter,magFilter:T.LinearFilter,type:r.extensions.has('EXT_color_buffer_float')?T.HalfFloatType:T.UnsignedByteType});source.samples=4;source.texture.colorSpace=T.LinearSRGBColorSpace;
  const ping=new T.WebGLRenderTarget(1,1,{depthBuffer:false}),pong=new T.WebGLRenderTarget(1,1,{depthBuffer:false});
  const scene=new T.Scene(),cam=new T.OrthographicCamera(-1,1,1,-1,0,1),quad=new T.Mesh(new T.PlaneGeometry(2,2));scene.add(quad);
  const vs='varying vec2 uv0;void main(){uv0=uv;gl_Position=vec4(position.xy,0.,1.);}';
  const extract=new T.ShaderMaterial({depthTest:false,depthWrite:false,uniforms:{inputMap:{value:source.texture}},vertexShader:vs,fragmentShader:'uniform sampler2D inputMap;varying vec2 uv0;void main(){vec3 c=texture2D(inputMap,uv0).rgb;float b=max(c.r,max(c.g,c.b));gl_FragColor=vec4(c*smoothstep(.66,1.,b),1.);}'});
  const blur=new T.ShaderMaterial({depthTest:false,depthWrite:false,uniforms:{inputMap:{value:ping.texture},direction:{value:new T.Vector2()}},vertexShader:vs,fragmentShader:'uniform sampler2D inputMap;uniform vec2 direction;varying vec2 uv0;void main(){vec3 c=texture2D(inputMap,uv0).rgb*.227027;c+=texture2D(inputMap,uv0+direction*1.384615).rgb*.316216;c+=texture2D(inputMap,uv0-direction*1.384615).rgb*.316216;c+=texture2D(inputMap,uv0+direction*3.230769).rgb*.070270;c+=texture2D(inputMap,uv0-direction*3.230769).rgb*.070270;gl_FragColor=vec4(c,1.);}'});
  const composite=new T.ShaderMaterial({depthTest:false,depthWrite:false,uniforms:{inputMap:{value:source.texture},glowMap:{value:ping.texture}},vertexShader:vs,fragmentShader:'uniform sampler2D inputMap;uniform sampler2D glowMap;varying vec2 uv0;void main(){vec3 c=texture2D(inputMap,uv0).rgb;vec3 bloom=texture2D(glowMap,uv0).rgb;float vignette=1.-.14*dot(uv0-.5,uv0-.5);c=(c+bloom*.32)*1.22;c=clamp((c*(2.51*c+.03))/(c*(2.43*c+.59)+.14),0.,1.);gl_FragColor=vec4(pow(c,vec3(1./2.2))*vignette,1.);}'});
  const size=new T.Vector2(),frustum=new T.Frustum(),matrix=new T.Matrix4();let lastW=0,lastH=0;
  r.render=(s,c)=>{if(s!==this.scene)return render(s,c);matrix.multiplyMatrices(c.projectionMatrix,c.matrixWorldInverse);frustum.setFromProjectionMatrix(matrix);for(const m of this.hardwareMeshes)m.visible=frustum.intersectsSphere(m.userData.bounds);
   if(this.quality==='balanced')return render(s,c);
   r.getDrawingBufferSize(size);if(size.x!==lastW||size.y!==lastH){lastW=size.x;lastH=size.y;source.setSize(lastW,lastH);ping.setSize(Math.ceil(lastW/4),Math.ceil(lastH/4));pong.setSize(Math.ceil(lastW/4),Math.ceil(lastH/4));}
   r.setRenderTarget(source);render(s,c);this.sceneRenderStats={calls:r.info.render.calls,triangles:r.info.render.triangles};const shadows=r.shadowMap.enabled;r.shadowMap.enabled=false;
   quad.material=extract;r.setRenderTarget(ping);render(scene,cam);quad.material=blur;blur.uniforms.inputMap.value=ping.texture;blur.uniforms.direction.value.set(1/ping.width,0);r.setRenderTarget(pong);render(scene,cam);blur.uniforms.inputMap.value=pong.texture;blur.uniforms.direction.value.set(0,1/pong.height);r.setRenderTarget(ping);render(scene,cam);quad.material=composite;r.setRenderTarget(null);render(scene,cam);r.shadowMap.enabled=shadows;
  };
 }
};})();
