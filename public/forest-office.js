/* Warm forest villa, readable room signs and a clean toilet exhibition. */
(()=>{'use strict';const T=THREE,Base=window.Office;
window.Office=class extends Base{
 world(){super.world();this.roomSigns=[];
  const rooms=[['A',-26,5.9,-10.6,14],['B',26,5.9,-10.6,14],['M',-26,6.65,39.65,13],['board',26,6.65,39.65,13],['lounge',-30,6.7,-29.4,12],['arcade',-9,6.7,-29.4,12],['wc',9,6.7,-29.4,9],['core',29,6.7,-29.4,14]];
  for(const[id,x,y,z,w]of rooms){const r=GAME.ROOMS.find(r=>r.id===id);const m=this.citySign(r.name,r.sub,r.color,x,y,z,w);m.userData.room=id;this.roomSigns.push(m);}
  this.entranceSign=this.citySign('金桶公司','GOLDEN TOILET / NIGHT SHIFT','#e8d2a0',0,7.05,39.7,17);
  for(const x of[-7.7,7.7])this.box('#bba477',x,5,39.5,.1,.6,.12);
 }
 fixture(f){if(f.type!=='boardTable')return super.fixture(f);const {x,z}=f;
  this.box('#a9bcb3',x,.05,z,17,.04,8);this.box('#263b4c',x,1.1,z,15.8,.24,4.1);for(const dx of[-5,5])this.box('#81919b',x+dx,.54,z,1.1,1.1,2.6);
  this.boardProps=new T.Group();this.scene.add(this.boardProps);const geo=new T.BoxGeometry(.9,.08,.6);for(const dx of[-5,-3,-1,1,3,5])for(const side of[-1,1]){this.box('#c2c9b3',x+dx,.7,z+side*2.7,1,.2,1);this.box('#b4bfa7',x+dx,1.2,z+side*3.15,1,1,.15);const prop=new T.Mesh(geo,this.mat('#b5c7c3'));prop.position.set(x+dx,1.26,z+side*.8);this.boardProps.add(prop);}
 }
 makeExhibition(){super.makeExhibition();this.exhibitionLights=[];for(const e of this.exhibits){const x=e.group.position.x,light=new T.SpotLight('#fff0cf',0,16,.42,.6,1.3);light.position.set(x,9,29);light.target.position.set(x,1.5,29);light.castShadow=false;this.scene.add(light,light.target);
   const fixture=new T.Mesh(new T.CylinderGeometry(.3,.2,.55,16),new T.MeshStandardMaterial({color:'#182734',metalness:.7,roughness:.3}));fixture.position.copy(light.position);this.scene.add(fixture);
   const beam=new T.Mesh(new T.ConeGeometry(2.05,7.3,32,1,true),new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending,vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec2 vUv; void main(){float a=pow(vUv.y,2.)*.06;gl_FragColor=vec4(1.,.85,.6,a);}'}));beam.position.set(x,5.05,29);beam.visible=false;this.scene.add(beam);this.exhibitionLights.push({light,beam,team:e.team});}
 }
 updateModels(){super.updateModels();if(!this.exhibitionLights)return;const any=this.exhibits.some(e=>e.count>0);this.boardProps.visible=!any;for(const e of this.exhibitionLights){const on=this.exhibits.find(m=>m.team===e.team).count>0;e.light.intensity=on?36:0;e.beam.visible=on;}this.el.dataset.exhibition=any?'spotlight':'meeting';}

 signTexture(title,sub,color){this.citySigns||=new Map();const key=title+sub+color;if(this.citySigns.has(key))return this.citySigns.get(key);
  const cv=document.createElement('canvas');cv.width=1024;cv.height=256;const c=cv.getContext('2d');c.fillStyle='#060f1d';c.fillRect(0,0,1024,256);
  c.strokeStyle=color;c.lineWidth=4;c.strokeRect(9,9,1006,238);c.globalAlpha=.16;for(let x=24;x<1000;x+=20)c.fillRect(x,16,1,224);c.globalAlpha=1;
  c.fillStyle=color;c.shadowColor=color;c.shadowBlur=14;c.font='700 76px "Arial", "Microsoft JhengHei", sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText(title,512,98,940);c.shadowBlur=0;c.font='22px "Arial", "Microsoft JhengHei",sans-serif';c.fillStyle='#b9d5e7';c.fillText(sub,512,190,920);
  const tx=new T.CanvasTexture(cv);tx.encoding=T.sRGBEncoding;tx.anisotropy=this.renderer.capabilities.getMaxAnisotropy();this.citySigns.set(key,tx);return tx;
 }
 citySign(title,sub,color,x,y,z,w,angle=0){const m=new T.Mesh(new T.PlaneGeometry(w,w/4),new T.MeshBasicMaterial({map:this.signTexture(title,sub,color),side:T.DoubleSide,toneMapped:false}));m.position.set(x,y,z);m.rotation.y=angle;this.scene.add(m);this.citySignCount=(this.citySignCount||0)+1;return m;}

};})();

