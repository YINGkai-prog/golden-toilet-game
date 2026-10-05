/* Night-shift art: procedural individual crew, kite labels and shared playground. */
(()=>{'use strict';const T=THREE,Base=window.Office;
window.Office=class extends Base{
 constructor(el,move){super(el,move);this.labelLayer=document.createElement('div');this.labelLayer.className='kite-layer';this.strings=document.createElementNS('http://www.w3.org/2000/svg','svg');this.strings.classList.add('kite-strings');el.append(this.strings,this.labelLayer);this.labelAt=0;}
 world(){super.world();
  // Local pools of warm light leave the surrounding forest dark.
  for(const [x,z] of [[-26,5],[26,5],[-26,30],[26,30],[-30,-22],[-9,-22],[9,-22],[29,-22],[0,27]]){
   const light=new T.PointLight(0xffd293,3.5,38,1.2);light.position.set(x,8,z);if(z===5||x===0)this.scene.add(light);
   this.box('#ffda8c',x,4.4,z,6,.06,.25,undefined,true);
  }
  for(const x of [-10,10])for(const z of [-7,9]){this.cylinder('#4e6463',x,3.1,z,.075,6.2);this.box('#f1e6b1',x,6.2,z,1.2,.16,.35,undefined,true);}
  this.box('#244f42',0,.14,1,19,.06,16);
  for(let x=-8;x<=8;x+=4)this.box('#2b5949',x,.177,1,2,.008,15.5);
  for(const z of [-6.5,8.5])this.box('#a3c6aa',0,.19,z,18,.02,.07);
  for(const x of [-9,0,9])this.box('#a3c6aa',x,.19,1,.07,.02,15);
  const circle=new T.Mesh(new T.RingGeometry(2.35,2.42,48),new T.MeshBasicMaterial({color:'#a3c6aa',side:T.DoubleSide}));circle.rotation.x=-Math.PI/2;circle.position.set(0,.195,1);this.scene.add(circle);
  for(const side of [-1,1]){const x=side*9.3;for(const z of [-1.6,3.6])this.box('#c6d6cf',x,1.2,z,.12,2.4,.12);this.box('#c6d6cf',x,2.4,1,.12,.12,5.3);for(let z=-1.6;z<=3.6;z+=.5)this.box('#849f91',x+side*.8,1.15,z,.025,2.3,.025);for(let y=.25;y<2.4;y+=.4)this.box('#849f91',x+side*.8,y,1,.025,.025,5.3);}
  this.ballMesh=new T.Mesh(new T.IcosahedronGeometry(.48,1),new T.MeshStandardMaterial({color:'#efedd4',roughness:.8}));this.ballMesh.position.set(0,.65,1);this.scene.add(this.ballMesh);const patch=new T.LineSegments(new T.EdgesGeometry(this.ballMesh.geometry),new T.LineBasicMaterial({color:'#223735'}));this.ballMesh.add(patch);
  this.leds=[];this.rackLeds=new T.InstancedMesh(new T.BoxGeometry(.15,.065,.03),new T.MeshBasicMaterial({color:'#ffffff'}),72);let led=0;const matrix=new T.Matrix4();for(const x of[22,35])for(const z of[-29,-21])for(let row=0;row<18;row++){this.rackLeds.setMatrixAt(led,matrix.makeTranslation(x-1.27,.28+row*.18,z+1.3));this.rackLeds.setColorAt(led++,new T.Color('#85efb4'));}this.core.add(this.rackLeds);
 }
 fixture(f){if(f.type==='darts'){
  this.box('#33413e',f.x,1.7,f.z,1.8,3.4,.25);for(const [r,c] of [[.8,'#e1d4b9'],[.6,'#bc5b66'],[.39,'#355e56'],[.15,'#efd590']]){const m=new T.Mesh(new T.CircleGeometry(r,32),new T.MeshStandardMaterial({color:c,side:T.DoubleSide}));m.position.set(f.x,2.2,f.z+.14+(1-r)*.04);this.scene.add(m);}
 }else if(f.type==='pinball'){
  this.box('#3b5b61',f.x,1.2,f.z,2.6,1,3.8);this.box('#98acba',f.x,1.8,f.z,2.3,.1,3.4);for(const dz of [-.8,.5])for(const dx of [-.6,.6])this.cylinder('#d4a774',f.x+dx,2,f.z+dz,.22,.2);this.box('#f4c67e',f.x,2.5,f.z-1.8,2.6,1,.2,undefined,true);for(const dx of [-.9,.9])for(const dz of [-1.4,1.4])this.box('#647f78',f.x+dx,.65,f.z+dz,.16,1.3,.16);
 }else super.fixture(f);}
 avatar(p){const ap=p.appearance||{color:'#94cbbc',body:0,hat:0,face:0,pack:0,pattern:0};const color=ap.color,group=new T.Group(),body=new T.Group();group.add(body);
  if(ap.body===0)this.ball(color,0,1.01,0,.47,.55,.34,body);
  if(ap.body===1)this.box(color,0,1.02,0,.76,.89,.58,body);
  if(ap.body===2){this.cylinder(color,0,.99,0,.46,.92,body);this.ball('#203a40',0,1.4,0,.5,.1,.38,body);}
  if(ap.body===3){this.ball(color,0,.93,0,.58,.46,.4,body);this.box(color,0,1.38,0,.54,.3,.4,body);}
  this.box('#20303b',0,.57,0,.55,.21,.44,body);
  const skin=['#ebc7a8','#b9876b','#78594e','#c1d7d7'][ap.face];this.ball(skin,0,1.76,0,.43,.42,.4,body);
  if(ap.face===3)this.box('#172c38',0,1.79,.36,.6,.23,.08,body);else for(const dx of [-.15,.15])this.ball('#15282e',dx,1.82,.375,.06,.085,.04,body);
  this.box('#def0dd',0,1.64,.4,.16,.035,.025,body);
  for(let i=0;i<=ap.pattern;i++)this.box('#e8e9d7',-.27+i*.077,1.14,.355,.035,.13+(.02*(i%3)),.04,body);
  switch(ap.hat){case 0:this.box(color,0,2.12,.05,.9,.19,.72,body);this.box('#d3e4dd',0,2.2,0,.57,.1,.53,body);break;
   case 1:for(const dx of [-.22,.22])this.ball(color,dx,2.37,0,.13,.42,.14,body);break;
   case 2:this.cylinder('#b6c9c6',0,2.4,0,.035,.58,body);this.ball(color,0,2.7,0,.14,.14,.14,body);break;
   case 3:this.ball(color,0,2.06,-.04,.46,.2,.42,body);this.box(color,0,2.03,.45,.75,.07,.42,body);break;
   case 4:for(const dx of [-.48,.48])this.ball(color,dx,1.82,0,.15,.26,.23,body);this.box(color,0,2.15,0,.98,.12,.18,body);break;
   case 5:this.ball(color,0,2.11,-.02,.45,.26,.42,body);this.ball('#e9e5c6',0,2.4,-.05,.15,.15,.15,body);break;
   case 6:for(const dx of [-.37,.37]){const horn=this.box(color,dx,2.12,0,.15,.6,.16,body);horn.rotation.z=-dx;}break;
   case 7:this.cylinder(color,0,2.14,0,.5,.14,body);this.cylinder(color,0,2.4,0,.3,.48,body);break;}
  if(ap.pack===0)this.box('#516975',0,1.13,-.39,.58,.66,.24,body);
  if(ap.pack===1)for(const dx of [-.25,.25])this.cylinder('#9fb6b7',dx,1.15,-.4,.16,.75,body);
  if(ap.pack===2)for(const dx of [-.62,.62]){const wing=this.box('#b6c9d5',dx,1.32,-.27,.56,.12,.58,body);wing.rotation.z=dx*.4;}
  if(ap.pack===3)this.box(color,.63,.74,-.06,.32,.5,.54,body);
  const limbs=[];for(const side of [-1,1]){const arm=new T.Group(),leg=new T.Group();arm.position.set(side*.48,1.36,0);body.add(arm);this.ball(color,0,-.24,0,.14,.32,.15,arm);this.ball(skin,0,-.52,0,.14,.13,.13,arm);leg.position.set(side*.2,.62,0);group.add(leg);this.box('#263644',0,-.19,0,.22,.43,.25,leg);this.ball(color,0,-.42,.1,.19,.12,.28,leg);limbs.push(arm,leg);}
  const shadow=new T.Mesh((this.crewShadowGeo||=new T.CircleGeometry(.65,12)),(this.crewShadowMat||=new T.MeshBasicMaterial({color:'#020b0e',transparent:true,opacity:.5,depthWrite:false})));shadow.rotation.x=-Math.PI/2;shadow.position.y=.22;group.add(shadow);
  // Keep the base lifecycle's disposable sprite, but all names use the kite layer.
  const sprite=new T.Sprite(new T.SpriteMaterial({map:this.text(''),opacity:0}));group.add(sprite);
  const halo=new T.Mesh((this.crewHaloGeo||=new T.RingGeometry(.66,.78,16)),(this.crewHaloMat||=new T.MeshBasicMaterial({color:'#a8efd5',side:T.DoubleSide})));halo.rotation.x=-Math.PI/2;halo.position.y=.24;group.add(halo);
  const aura=new T.Mesh((this.crewAuraGeo||=new T.RingGeometry(.85,1.14,16)),(this.crewAuraMat||=new T.MeshBasicMaterial({color:'#ffe4a0',side:T.DoubleSide,transparent:true,opacity:.65,depthWrite:false})));aura.rotation.x=-Math.PI/2;aura.position.y=.23;group.add(aura);
  const crown=new T.Mesh((this.crewCrownGeo||=new T.OctahedronGeometry(.17)),(this.crewCrownMat||=new T.MeshBasicMaterial({color:'#ffdf94'})));crown.position.y=3.05;group.add(crown);
  for(const m of[shadow,halo,aura,crown])m.userData.crewDecoration=true;
  const tag=document.createElement('div');tag.className='kite';tag.dataset.player=p.id;tag.style.setProperty('--crew',color);const n=document.createElement('b'),title=document.createElement('small');n.textContent=p.name;title.textContent=p.title;const status=document.createElement('em');status.className='crew-command';tag.append(n,title,status);this.labelLayer?.append(tag);const line=document.createElementNS('http://www.w3.org/2000/svg','path');line.setAttribute('stroke',color);this.strings?.append(line);
  this.scene.add(group);const a={group,body,limbs,sprite,halo,aura,crown,tag,line,p,target:new T.Vector3(p.motion?.x||0,0,p.motion?.z||0),seed:p.joinIdx*2};group.position.copy(a.target);this.actors.set(p.id,a);this.actorBatchDirty=true;return a;
 }
 update(s,me){for(const [id,a]of this.actors)if(!s.players.some(p=>p.id===id)){a.tag.remove();a.line.remove();}super.update(s,me);this.clockOffset=s.serverNow-Date.now();this.nightState=s;for(const a of this.actors.values()){const high=['manager','lead','board','boss'].includes(a.p.rank);a.aura.userData.show=a.crown.userData.show=high;a.tag.classList.toggle('senior',high);a.tag.classList.toggle('self',a.p.id===me);a.tag.querySelector('small').textContent=a.p.title;a.tag.style.setProperty('--crew',a.p.appearance?.color||'#94cbbc');}}
 leisure(s){this.recreation=s;}
 loop(time){super.loop(time);if(!this.labelLayer)return;
  if(this.recreation?.football){const b=this.recreation.football;this.ballMesh.position.lerp(new T.Vector3(b.x,.65,b.z),.45);this.ballMesh.rotation.x+=b.vz*.003;this.ballMesh.rotation.z-=b.vx*.003;}
  if(this.rackLeds&&time-(this.ledAt||0)>170){this.ledAt=time;const color=new T.Color();for(let i=0;i<72;i++)this.rackLeds.setColorAt(i,color.set((Math.floor(time/170)+i*7+(this.nightState?.ai.cycles||0))%9<3?'#d1ffe1':'#307357'));this.rackLeds.instanceColor.needsUpdate=true;}
  for(const a of this.actors.values()){a.aura.material.opacity=.45+Math.sin(time*.003+a.seed)*.25;if(a.p.dancing&&!this.reduced){a.body.rotation.z=Math.sin(time*.009+a.seed)*.23;a.limbs[0].rotation.z=-1.7+Math.sin(time*.01)*.5;a.limbs[2].rotation.z=1.7-Math.sin(time*.01)*.5;}else{a.body.rotation.z=0;a.limbs[0].rotation.z=a.limbs[2].rotation.z=0;}}
  if(document.body.classList.contains('screen-focus')||time-this.labelAt<100)return;this.labelAt=time;const w=this.el.clientWidth,h=this.el.clientHeight,used=[];const list=[...this.actors.values()].map(a=>{const v=a.group.position.clone().add(new T.Vector3(0,2.5,0)).project(this.camera);return{a,x:(v.x+1)*w/2,y:(1-v.y)*h/2,z:v.z};}).sort((a,b)=>a.y-b.y);
  for(const {a,x,y,z}of list){const visible=x>0&&x<w&&y>0&&y<h&&z<1&&!this.paused;a.tag.hidden=!visible;a.line.style.display=visible?'':'none';if(!visible)continue;const cmd=a.p.status,remaining=cmd?.until?Math.max(0,Math.ceil((cmd.until-(Date.now()+(this.clockOffset||0)))/1000)):0;const label=cmd?cmd.label+(remaining?' '+remaining+'s':''):'';const command=a.tag.querySelector('.crew-command');if(command.textContent!==label)command.textContent=label;const tw=68,th=29;let lx=Math.min(w-tw-4,Math.max(4,x+7)),ly=Math.max(6,y-31),found=false;
   for(const [dx,dy]of [[7,-31],[-63,-31],[7,-9],[-63,-9],[7,-51],[-63,-51]]){const cx=Math.max(4,Math.min(w-tw-4,x+dx)),cy=Math.max(4,Math.min(h-th-4,y+dy));if(!used.some(r=>cx<r.x+tw+2&&cx+tw+2>r.x&&cy<r.y+th+2&&cy+th+2>r.y)){lx=cx;ly=cy;found=true;break;}}
   a.tag.style.opacity=found||a.p.id===this.me?'1':'.5';used.push({x:lx,y:ly});a.tag.style.transform=`translate(${lx}px,${ly}px)`;a.line.setAttribute('d',`M${x},${y} L${lx+tw/2},${ly+th}`);
  }
 }
};})();
