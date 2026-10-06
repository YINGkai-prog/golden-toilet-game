/* The shared office is also the stage: live work pages hang inside the world. */
(()=>{'use strict';const T=THREE,Base=window.Office;
const canvas=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
const font=(ctx,size,color,text,x,y,weight=400)=>{ctx.fillStyle=color;ctx.font=`${weight} ${size}px "Microsoft JhengHei",sans-serif`;ctx.fillText(String(text),x,y);};
const rect=(c,x,y,w,h,color)=>{c.fillStyle=color;c.fillRect(x,y,w,h);};
const shade=(hex,f)=>{const c=new T.Color(hex);c.multiplyScalar(f);return '#'+c.getHexString();};
window.Office=class extends Base{
 constructor(el,move){super(el,move);this.pages=[];this.drones=[];this.flowTime={value:0};this.projectionBuilds={A:{},B:{},C:{}};this.projectionState=null;this.posterImages=new Map();this.pageDirty=true;this.liftAt=performance.now();
  this.makeProjections();this.makePool();this.makeOmni();this.makeScoreboards();this.batchCampus();this.home();this.focus.copy(this.desiredFocus);this.goal.radius=178;this.radius=178;this.theta=.1;this.phi=.66;
 }
 dynamicBox(parent,c,x,y,z,w,h,d,glow=false){const m=new T.Mesh(this.boxGeo,glow?(this.basicMats||(this.basicMats=new Map())).get(c)||(()=>{const mat=new T.MeshBasicMaterial({color:c});this.basicMats.set(c,mat);return mat;})():this.mat(c));m.scale.set(w,h,d);m.position.set(x,y,z);m.userData.campusStatic=parent===this.scene;parent.add(m);return m;}
 batchCampus(){this.scene.updateMatrixWorld(true);const groups=new Map();for(const m of [...this.scene.children]){if(!m.userData.campusStatic||this.pages.some(p=>p.beam===m))continue;const key=m.material.uuid;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(m);}for(const items of groups.values()){const mesh=new T.InstancedMesh(this.boxGeo,items[0].material,items.length);items.forEach((m,i)=>{mesh.setMatrixAt(i,m.matrixWorld);this.scene.remove(m);});this.scene.add(mesh);}}
 makeProjections(){for(const [i,team]of ['A','B','C'].entries()){
  const page=canvas(1536,960),texture=new T.CanvasTexture(page);texture.encoding=T.sRGBEncoding;texture.anisotropy=this.renderer.capabilities.getMaxAnisotropy();texture.minFilter=T.LinearFilter;texture.generateMipmaps=false;
  const cloth=new T.Mesh(new T.PlaneGeometry(31,19.375,24,12),new T.MeshBasicMaterial({map:texture,side:T.DoubleSide}));cloth.position.set((i-1)*34,25,-59);this.scene.add(cloth);cloth.userData.room='screen:'+team;this.hits.push(cloth);
  const beam=this.dynamicBox(this.scene,['#8bd4c0','#89b6ed','#c3a4ee'][i],cloth.position.x,34.85,-59,31.6,.13,.2,true);
  this.dynamicBox(this.scene,'#29474f',cloth.position.x,15.28,-59,31.6,.15,.2);
  this.pages.push({team,canvas:page,texture,cloth,beam});
  for(const side of [-1,1]){const drone=new T.Group();drone.position.set(cloth.position.x+side*14.6,39,-59);this.scene.add(drone);this.dynamicBox(drone,'#cedbd7',0,0,0,1.1,.35,.8);this.dynamicBox(drone,'#8fe4d4',0,-.25,.44,.42,.14,.04,true);
   const rotors=[];for(const dx of [-1.05,1.05])for(const dz of [-.75,.75]){this.dynamicBox(drone,'#566f76',dx*.5,0,dz*.5,1.3,.1,.1).rotation.y=-Math.atan2(dz,dx);const r=new T.Mesh(new T.RingGeometry(.44,.58,24),new T.MeshBasicMaterial({color:'#87bfc0',transparent:true,opacity:.5,side:T.DoubleSide}));r.rotation.x=-Math.PI/2;r.position.set(dx,.2,dz);drone.add(r);rotors.push(this.dynamicBox(drone,'#c3eeeb',dx,.22,dz,1.2,.025,.05));}
   const cable=new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(drone.position.x,38.7,-59),new T.Vector3(drone.position.x,34.85,-59)]),new T.LineBasicMaterial({color:'#8fb9b4',transparent:true,opacity:.75}));this.scene.add(cable);this.drones.push({drone,cable,rotors,y:39,seed:i*2+side});
  }
 }
 }
 projection(builds,s){if(builds)this.projectionBuilds=builds;if(s){this.projectionState=s;for(const p of s.poster?.posters||[]){const key=p.author+':'+p.v;if(p.hasImg&&!this.posterImages.has(key)){const img=new Image();img.onload=()=>{this.pageDirty=true;};img.src='/poster/'+encodeURIComponent(p.author)+'.jpg?v='+p.v+'&g='+s.gameId;this.posterImages.set(key,img);}}}this.pageDirty=true;}
 drawPage(p){const s=this.projectionState,c=p.canvas.getContext('2d'),team=p.team,accent=GAME.TEAMS[team].color,blocks=this.projectionBuilds[team]||{},count=Object.keys(blocks).length;
  rect(c,0,0,1536,960,'#0a1b25');rect(c,0,0,1536,86,'#122c36');rect(c,0,85,1536,3,accent);
  font(c,27,'#dce9e4','◇ GOLDEN TOILET',38,54,600);font(c,20,'#8ca9ac','COMPANY WEEKLY / NIGHT SHIFT',365,53);font(c,20,accent,'● LIVE · '+(s?.players.length||0)+' CREW',1200,53);
  font(c,92,accent,team==='C'?'03':'0'+(team==='A'?1:2),43,211,600);font(c,42,'#e3eee6',GAME.TEAMS[team].name,185,170,600);font(c,21,'#91b5b9',team==='C'?'AUTONOMOUS / GB300 LAB':'HUMAN COLLABORATION / DESIGN IN PUBLIC',188,211);
  const phase=GAME.PHASES.find(v=>v.id===s?.phase);font(c,22,'#c5d8d5','當前階段  /  '+(phase?.long||'等待同仁報到'),43,270);
  rect(c,40,297,1040,570,'#102934');rect(c,1110,297,385,570,'#142b34');
  const brief=GAME.BRIEFS[s?.brief?.choice];font(c,23,accent,'PROJECT / '+(brief?.name||'明天上市，今晚才開案'),65,335,600);
  // Draw every real block, in depth order. This same full page is used at all camera distances.
  const cells=Object.entries(blocks).map(([k,v])=>({p:k.split(',').map(Number),c:v.c})).sort((a,b)=>(a.p[0]+a.p[2])-(b.p[0]+b.p[2])||a.p[1]-b.p[1]);
  const size=21,baseX=555,baseY=770,iso=(x,y,z)=>[baseX+(x-z)*size,baseY+(x+z-14)*size*.45-y*size*1.12];
  c.strokeStyle='#28474d';c.lineWidth=1;for(let k=0;k<=14;k++){for(const pts of [[iso(k,0,0),iso(k,0,14)],[iso(0,0,k),iso(14,0,k)]]){c.beginPath();c.moveTo(...pts[0]);c.lineTo(...pts[1]);c.stroke();}}
  const poly=(points,color)=>{c.beginPath();points.forEach((q,i)=>i?c.lineTo(...q):c.moveTo(...q));c.closePath();c.fillStyle=color;c.fill();c.strokeStyle='#16323e66';c.stroke();};
  for(const b of cells){const [x,y,z]=b.p,hex=GAME.COLORS[b.c]?.hex||'#b9cccb';poly([iso(x,y,z+1),iso(x+1,y,z+1),iso(x+1,y+1,z+1),iso(x,y+1,z+1)],shade(hex,.66));poly([iso(x+1,y,z),iso(x+1,y,z+1),iso(x+1,y+1,z+1),iso(x+1,y+1,z)],shade(hex,.83));poly([iso(x,y+1,z),iso(x+1,y+1,z),iso(x+1,y+1,z+1),iso(x,y+1,z+1)],hex);}
  if(!count){font(c,40,'#789b9f','等第一塊積木。',390,563);font(c,22,'#6b9198','空白也算一種設計，但老闆可能不同意。',288,609);}
  font(c,18,'#89a5a8','SHARED WORKBENCH / 14 × 16 × 14',66,841);font(c,18,'#d8e9de','每一塊都來自本場即時作品',720,841);
  font(c,18,accent,'BUILD TELEMETRY',1135,335);font(c,69,'#e3eee6',String(count).padStart(3,'0'),1134,418,600);font(c,20,'#95b6b9','BLOCKS / 已同步',1300,407);
  const crew=(s?.players||[]).filter(v=>v.team===team),working=crew.filter(v=>v.motion?.room===team);font(c,21,'#deebe1',team==='C'?'AI 進度 '+(s?.ai.progress||0)+'%':'施工 '+working.length+' / '+crew.length+' 人',1135,470);
  rect(c,1135,488,335,5,'#2a444c');rect(c,1135,488,335*(team==='C'?(s?.ai.progress||0)/100:Math.min(1,count/500)),5,accent);
  font(c,18,accent,'LIVE CREW / 即時動態',1135,540);const names=team==='C'?['GB300 策略引擎',s?.ai.mode||'等待開案','不摸魚、不喝咖啡、不下班']:crew.slice(0,6).map(v=>(v.aiControlled?'AI代班 · ':'')+v.name+' / '+(v.motion?.room===team?'施工中':'探索中'));
  names.forEach((v,i)=>font(c,19,'#b9cecc',v,1135,581+i*33));
  const posters=s?.poster?.posters?.filter(v=>v.hasImg)||[];if(posters.length){const item=posters[(['A','B','C'].indexOf(team))%posters.length],img=this.posterImages.get(item.author+':'+item.v);if(img?.complete&&img.naturalWidth){rect(c,1120,517,365,275,'#142b34');font(c,18,accent,'上市海報 / '+posters.length+' 件作品',1135,546);const scale=Math.min(170/img.naturalWidth,225/img.naturalHeight);c.drawImage(img,1135,560,img.naturalWidth*scale,img.naturalHeight*scale);font(c,17,'#d4e6dd',item.name.slice(0,11),1320,605);font(c,16,'#9fbbb9','市調 '+(s.poster.surveyCount||0)+' 份',1320,646);font(c,16,'#9fbbb9','NT$ '+Math.round(s.poster.avgPrice||0),1320,679);}}
  font(c,17,accent,'主管說  /  '+(p.comment||'「就改一點點。」').slice(0,22),1135,813);
  const score=s?.recreation?.football.score||[0,0],volley=s?.campus?.volley.score||[0,0];font(c,20,'#9fbcba',`⚽ 一處 ${score[0]} : ${score[1]} 二處     🏐 ${volley[0]} : ${volley[1]}     ／  娛樂獎獨立計分`,43,920);font(c,18,accent,'ENTIRE PAGE / '+team+' · SYNC',1222,920);if(s?.phase==='review'){rect(c,40,891,1130,45,'#0a1b25');font(c,23,'#dceadd','提案票選  一處 '+s.review.tally.A+' 分 ／ 二處 '+s.review.tally.B+' 分 ／ AI '+s.review.tally.C+' 分',43,920);}if(s?.phase==='launch'){rect(c,40,891,1130,45,'#0a1b25');font(c,23,'#e0d299','🚽 '+(s.launch?.finance?.bankrupt?'公司倒閉':s.launch?.finance?.profit<0?'虧損上市':'獲利上市')+' ／ 損益 NT$ '+(s.launch?.finance?.profit||0).toLocaleString()+' ／ 售出 '+(s.launch?.finance?.units||0)+' 座',43,920);}
  p.texture.needsUpdate=true;p.count=count;
 }
 makePool(){
  this.dynamicBox(this.scene,'#b1cacb',52,.13,28,21,.12,25);this.dynamicBox(this.scene,'#153d55',52,.22,28,18,.1,21);
  const water=new T.Mesh(new T.PlaneGeometry(18,21,30,32),new T.MeshStandardMaterial({color:'#32879b',transparent:true,opacity:.78,roughness:.22,metalness:.45,emissive:'#123848',emissiveIntensity:.65,side:T.DoubleSide}));water.rotation.x=-Math.PI/2;water.position.set(52,.42,28);this.scene.add(water);this.water=water;
  for(const x of [42.7,61.3]){this.dynamicBox(this.scene,'#adccce',x,.35,28,.6,.3,22);this.dynamicBox(this.scene,'#8dc9d8',x,.52,28,.15,.04,22,true);}for(const z of[17.2,38.8])this.dynamicBox(this.scene,'#adccce',52,.35,z,18,.3,.6);
  for(const z of [17.2,38.8]){this.dynamicBox(this.scene,'#cfe6e1',52,1.5,z,.13,3,.13);for(let y=.8;y<=2.4;y+=.4)this.dynamicBox(this.scene,'#b0dcdd',52,y,28,.025,.025,21.6);}
  for(let z=17.2;z<39;z+=.75)this.dynamicBox(this.scene,'#bed7d1',52,1.6,z,.035,1.7,.035);
  this.dynamicBox(this.scene,'#e0efdf',52,2.48,28,.08,.08,21.6,true);
  this.volleyMesh=new T.Mesh(new T.SphereGeometry(.55,16,12),new T.MeshStandardMaterial({color:'#edc981',emissive:'#735e22',emissiveIntensity:.35,roughness:.4}));this.scene.add(this.volleyMesh);
  const seams=new T.LineSegments(new T.WireframeGeometry(new T.OctahedronGeometry(.554)),new T.LineBasicMaterial({color:'#4c8caa'}));this.volleyMesh.add(seams);
  for(const z of [20,35]){this.dynamicBox(this.scene,'#e4d4af',63,.65,z,1.3,.17,3.2);this.dynamicBox(this.scene,'#a2c2c2',63,1.1,z-1.3,1.3,.9,.15);}
 }
 makeOmni(){const o=new T.Group(),body=new T.Group();o.add(body);this.scene.add(o);this.omniMesh=o;this.omniBody=body;
  const sphere=(color,x,y,z,r,sx=1,sy=1,sz=1)=>{const m=new T.Mesh(new T.SphereGeometry(r,16,12),this.mat(color));m.position.set(x,y,z);m.scale.set(sx,sy,sz);body.add(m);return m;};
  sphere('#172b33',0,1.18,0,.47,1,1.22,.8);sphere('#d6ad55',0,1.15,.29,.29,1,.85,.45);sphere('#1d2a31',0,2.02,0,.66,1,.95,.86);
  for(const side of[-1,1]){sphere('#dcb75c',side*.31,2.09,.47,.29,1,1,.37);sphere('#0b1b25',side*.31,2.09,.56,.22,1,1,.2);this.dynamicBox(body,'#ffe3a0',side*.31,2.08,.615,.13,.075,.035,true);
   this.dynamicBox(body,'#566168',side*.48,2.64,-.02,.16,.62,.15).rotation.z=-side*.4;sphere('#daba71',side*.61,2.91,-.02,.15,1,1.5,.8);
   sphere('#ab8b46',side*.53,1.44,0,.18);sphere('#27383e',side*.64,1.13,.08,.2,.7,1.4,.8);sphere('#d6ad55',side*.69,.89,.13,.15);sphere('#4c5d60',side*.26,.54,0,.19,.8,1.5,1);sphere('#cfa956',side*.27,.27,.14,.2,1,.65,1.4);
  }
  sphere('#d5b266',0,1.8,.53,.17,1,1,.38);this.dynamicBox(body,'#20333a',0,1.7,.56,.37,.08,.04);
  const label=new T.Sprite(new T.SpriteMaterial({map:this.text('OMNI / 歡迎加班','#efdb98',30),depthWrite:false}));label.position.y=3.7;label.scale.set(4.2,.79,1);o.add(label);this.omniLabel=label;for(const child of body.children)child.position.y-=1.55;body.position.y=1.55;
 }
 boardTexture(w=768,h=160){const cv=canvas(w,h),tx=new T.CanvasTexture(cv);tx.encoding=T.sRGBEncoding;return{canvas:cv,texture:tx};}
 makeScoreboards(){this.soccerBoard=this.boardTexture();const m=new T.Mesh(new T.PlaneGeometry(16,3.33),new T.MeshBasicMaterial({map:this.soccerBoard.texture,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2}));m.rotation.x=-Math.PI/2;m.position.set(0,.27,5.8);this.scene.add(m);
  this.poolBoard=this.boardTexture();const pool=new T.Mesh(new T.PlaneGeometry(15,3.125),new T.MeshBasicMaterial({map:this.poolBoard.texture,side:T.DoubleSide}));pool.position.set(52,4.6,15.5);this.scene.add(pool);for(const x of[45,59])this.dynamicBox(this.scene,'#809a9d',x,2,15.5,.15,4,.15);
  this.goalCards=[];for(const side of[-1,1]){const item=this.boardTexture(768,192),spr=new T.Sprite(new T.SpriteMaterial({map:item.texture,depthWrite:false}));spr.position.set(side*9.7,4.4,1);spr.scale.set(8,2,1);spr.visible=false;this.scene.add(spr);this.goalCards.push({...item,sprite:spr});}
 }
 updateBoards(){const s=this.recreation?.football,v=this.campusState?.volley;if(!s||!v)return;const key=JSON.stringify([s.score,s.goalAt,s.scorer,v.score]);if(key===this.scoreKey)return;this.scoreKey=key;
  for(const [board,ball,title]of [[this.soccerBoard,s,'OVERTIME FOOTBALL'],[this.poolBoard,v,'MOONLIGHT VOLLEY']]){const c=board.canvas.getContext('2d');c.clearRect(0,0,768,160);rect(c,0,0,768,160,'#0a2630d9');font(c,20,'#8cbbb9',title,28,36);font(c,32,'#9cd8bd','第一研發部',28,101,600);font(c,64,'#f1edd7',ball.score.join(' : '),290,113,600);font(c,32,'#a6c8f0','第二研發部',600,101,600);board.texture.needsUpdate=true;}
  for(const [i,item]of this.goalCards.entries()){const p=s.scorer;item.sprite.visible=!!p&&s.goalSide===(i===1?0:1);if(!item.sprite.visible)continue;const c=item.canvas.getContext('2d');rect(c,0,0,768,192,'#1a302be6');font(c,25,'#f0d084','★ 黃金右腳 / 進球高手',35,49,600);font(c,42,'#f3efdb',p.name,35,110,600);font(c,25,'#a9cbbd',p.title+' · '+(p.team==='A'?'一處':'二處'),35,155);item.texture.needsUpdate=true;}
 }
 update(s,me){super.update(s,me);this.projection(null,s);if(s.campus)this.campusFrame(s.campus);for(const a of this.actors.values()){
   a.tag.dataset.rank=a.p.rank||'staff';a.tag.title=a.p.name+' · '+a.p.title+(a.p.aiControlled?' · AI 代班':'');a.tag.querySelector('b').textContent=(a.p.aiControlled?'◈ ':'')+a.p.name;a.tag.classList.toggle('assisted',!!a.p.aiControlled);
   if(a.p.id===me&&!a.energy){a.energy=true;const mats=new Map();a.group.traverse(m=>{if(!m.isMesh||![this.boxGeo,this.ballGeo,this.cylGeo].includes(m.geometry))return;const key=m.material.uuid;if(!mats.has(key)){const mat=m.material.clone();mat.emissiveIntensity=.03;mat.onBeforeCompile=shader=>{shader.uniforms.crewTime=this.flowTime;shader.fragmentShader='uniform float crewTime;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\nfloat pulse=pow(0.5+0.5*sin(vViewPosition.y*7.0+crewTime*3.4),9.0);totalEmissiveRadiance+=vec3(0.3,1.0,0.8)*pulse*1.7;');};mats.set(key,mat);}m.material=mats.get(key);});this.actorBatchDirty=true;}
  }}
 campusFrame(s){this.campusState={...this.campusState,...s};this.updateBoards();}
 select(id,point){if(id?.startsWith('screen:'))return this.focusScreen(id.slice(7));return super.select(id,point);}
 focusOmni(){const o=this.campusState?.omni;if(!o)return;this.follow=false;delete this.el.dataset.focusScreen;document.body.classList.remove('screen-focus');this.desiredFocus.set(o.x,1.3,o.z);this.goal={theta:.35,phi:.6,radius:24};}
 focusScreen(team){this.follow=false;const i=['A','B','C'].indexOf(team);this.desiredFocus.set(i<0?0:(i-1)*34,25,-59);this.goal={theta:0,phi:.015,radius:i<0?155:35};this.el.dataset.focusScreen=team||'all';document.body.classList.add('screen-focus');}
 home(){this.follow=false;this.goal={theta:.1,phi:.66,radius:178};this.desiredFocus.set(0,7,-5);delete this.el.dataset.focusScreen;document.body.classList.remove('screen-focus');}
 campus(){delete this.el.dataset.focusScreen;document.body.classList.remove('screen-focus');super.campus();}
 focusMe(){delete this.el.dataset.focusScreen;document.body.classList.remove('screen-focus');super.focusMe();}
 inspect(id){delete this.el.dataset.focusScreen;document.body.classList.remove('screen-focus');super.inspect(id);}
 loop(time){if(this.flowTime)this.flowTime.value=this.reduced?0:time/1000;
  if(this.pages){if(this.pageDirty&&time-(this.lastPage||0)>1000){this.lastPage=time;this.pages.forEach(p=>this.drawPage(p));this.pageDirty=false;}
   const lift=this.reduced?1:Math.min(1,(time-this.liftAt)/2600);for(const p of this.pages){p.cloth.scale.y=Math.max(.025,lift);p.cloth.position.y=15.3125+9.6875*lift;p.beam.position.y=15.4+19.45*lift;}
   for(const d of this.drones){const dy=this.reduced?0:Math.sin(time*.0013+d.seed)*.09;d.drone.position.y=19.55+19.45*lift+dy;d.rotors.forEach(r=>r.rotation.y=this.reduced?0:time*.06);const pos=d.cable.geometry.attributes.position;pos.setY(0,d.drone.position.y-.3);pos.setY(1,15.4+19.45*lift);pos.needsUpdate=true;}
   const o=this.campusState?.omni;if(o){this.omniMesh.position.lerp(new T.Vector3(o.x,0,o.z),.28);this.omniMesh.rotation.y=o.heading||0;const age=(Date.now()-(o.flipAt||0))/1000,flip=!this.reduced&&age>=0&&age<.9;this.omniBody.rotation.x=flip?age/.9*Math.PI*2:0;this.omniBody.position.y=flip?1.92+Math.sin(age/.9*Math.PI)*1.1:1.72+Math.sin(time*.004)*.03;this.omniLabel.material.color.set(o.mode==='chase'?'#ff8c66':'#ffffff');}
   const v=this.campusState?.volley;if(v){this.volleyMesh.position.lerp(new T.Vector3(v.x,Math.max(.5,v.y),v.z),.45);this.volleyMesh.rotation.z+=.018;}
   const b=this.recreation?.football;if(b){const recent=Math.max(0,1-(Date.now()-(b.kickedAt||0))/4500),wave=this.reduced?.25:(Math.sin(time*(.0018+recent*.009))+1)/2;this.ballMesh.material.emissive.set('#d8e991');this.ballMesh.material.emissiveIntensity=.08+wave*(.18+recent*1.6);}
   if(this.water&&!this.reduced&&time-(this.waterAt||0)>66){this.waterAt=time;const a=this.water.geometry.attributes.position;for(let i=0;i<a.count;i++)a.setZ(i,Math.sin(a.getX(i)*.7+time*.0018)*Math.cos(a.getY(i)*.55+time*.001)*.032);a.needsUpdate=true;}
   this.updateBoards();
  }
  super.loop(time);
 }
};})();
