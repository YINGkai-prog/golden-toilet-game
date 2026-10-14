/* Opt-in, local device measurements during actual play. No personal data upload. */
(()=>{'use strict';
window.DeviceCheck=class{
 static active=null;
 constructor({office,net}){
  if(!office)return;this.office=office;this.net=net;this.button=document.createElement('button');this.button.id='deviceCheck';this.button.textContent='效能檢查';this.button.title='邊玩邊測 60 秒，完成後可下載報告';document.querySelector('.camera-controls')?.append(this.button);
  this.button.onclick=()=>this.running?this.stop(true):this.start();
  net.on('pong',m=>{if(this.running&&m.n===this.pingAt)this.pings.push(Date.now()-m.n);});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&this.running)this.stop(true);});
 }
 start(){
  this.running=true;this.bytes=0;this.frames=[];this.pings=[];this.started=performance.now();this.last=0;DeviceCheck.active=this;
  const r=this.office.renderer;this.original=r.render;const self=this;
  r.render=function(scene,camera){if(scene===self.office.scene){const now=performance.now();if(self.last)self.frames.push(now-self.last);self.last=now;}return self.original.call(this,scene,camera);};
  this.tick=()=>{const left=Math.max(0,60-Math.floor((performance.now()-this.started)/1000));this.button.textContent=`檢查中 ${left}s · 可繼續玩`;if(!left)return this.stop();if(left%5===0){this.pingAt=Date.now();this.net.send({t:'ping',n:this.pingAt});}this.timer=setTimeout(this.tick,1000);};this.tick();
 }
 stop(cancel=false){
  if(!this.running)return;this.running=false;DeviceCheck.active=null;clearTimeout(this.timer);this.office.renderer.render=this.original;this.button.textContent='效能檢查';
  if(cancel){U.toast('效能檢查已取消；測量時請讓遊戲保持在前景。');return;}
  const seconds=(performance.now()-this.started)/1000,sorted=this.frames.slice().sort((a,b)=>a-b),pings=this.pings.slice().sort((a,b)=>a-b),quantile=(a,p)=>a.length?a[Math.min(a.length-1,Math.floor(a.length*p))]:null;
  const gl=this.office.renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');
  this.report={release:'office-ready-2026.10.14',at:new Date().toISOString(),seconds:+seconds.toFixed(2),fps:+((this.frames.length+1)/seconds).toFixed(1),p95FrameMs:quantile(sorted,.95),longFrames:this.frames.filter(n=>n>100).length,network:{receivedBytes:this.bytes,KBps:+(this.bytes/seconds/1000).toFixed(2),rttMedianMs:quantile(pings,.5),rttP95Ms:quantile(pings,.95),samples:pings.length,transport:this.net.mode},device:{viewport:[innerWidth,innerHeight],pixelRatio:devicePixelRatio,logicalProcessors:navigator.hardwareConcurrency,gpu:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):'unavailable'},scene:{players:this.office.actors.size,selectedQuality:this.office.quality,effectiveQuality:this.office.quality==='auto'?this.office.autoQuality:this.office.quality,renderRatio:this.office.renderer.getPixelRatio(),drawCalls:this.office.renderer.info.render.calls,triangles:this.office.renderer.info.render.triangles}};
  this.show();
 }
 show(){
  this.dialog?.remove();const d=this.dialog=document.createElement('dialog');d.className='device-report';
  const fps=this.report.fps,rtt=this.report.network.rttMedianMs,verdict=fps>=45?'畫面流暢':fps>=30?'可遊玩，仍請留意操作感受':'畫面偏慢，請將報告交給主持人';
  d.innerHTML='<h2>這台電腦的遊玩檢查</h2><p class="device-verdict"></p><dl><dt>平均畫面更新</dt><dd data-fps></dd><dt>網路來回時間</dt><dd data-rtt></dd><dt>接收資料量</dt><dd data-traffic></dd></dl><p>報告只存到你的電腦，不會自動上傳，也不含姓名或登入資料。請將報告提供給主持人，並告訴他移動、建模和小遊戲是否順手。</p><div><button data-save>下載檢查報告</button><button data-close>繼續遊玩</button></div>';
  d.querySelector('.device-verdict').textContent=verdict;d.querySelector('[data-fps]').textContent=fps+' FPS';d.querySelector('[data-rtt]').textContent=rtt==null?'未取得':rtt+' ms';d.querySelector('[data-traffic]').textContent=this.report.network.KBps+' KB/s';
  d.querySelector('[data-close]').onclick=()=>d.close();d.querySelector('[data-save]').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(this.report,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='金桶公司-效能檢查-'+Date.now()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};document.body.append(d);d.showModal();
 }
};})();
