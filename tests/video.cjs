'use strict';
const fs=require('node:fs');
// Chromium screencast frames include the actual page UI and the rendered game.
exports.recorder=function(){const frames=[];let recording=true;
 return{frames,attach:async page=>{const session=await page.context().newCDPSession(page);let last=0;
  session.on('Page.screencastFrame',e=>{session.send('Page.screencastFrameAck',{sessionId:e.sessionId}).catch(()=>{});const now=Date.now();if(recording&&frames.length<700&&now-last>450){last=now;frames.push(e.data);}});
  await session.send('Page.startScreencast',{format:'jpeg',quality:65,maxWidth:1152,maxHeight:748,everyNthFrame:3});
 },finish:async(browser,dest)=>{recording=false;if(frames.length<20)throw new Error('Too few real screencast frames');const page=await browser.newPage();await page.goto('about:blank');
  const data=await page.evaluate(async frames=>{const canvas=document.createElement('canvas');canvas.width=1152;canvas.height=748;document.body.append(canvas);const ctx=canvas.getContext('2d'),stream=canvas.captureStream(0),chunks=[],rec=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp8',videoBitsPerSecond:1000000});
   const done=new Promise(resolve=>{rec.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};rec.onstop=async()=>{const blob=new Blob(chunks,{type:'video/webm'}),reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.readAsDataURL(blob);};});rec.start();
   for(const frame of frames){const img=new Image();img.src='data:image/jpeg;base64,'+frame;await img.decode();ctx.fillStyle='#07171e';ctx.fillRect(0,0,canvas.width,canvas.height);const scale=Math.min(canvas.width/img.width,canvas.height/img.height);ctx.drawImage(img,(canvas.width-img.width*scale)/2,(canvas.height-img.height*scale)/2,img.width*scale,img.height*scale);stream.getVideoTracks()[0].requestFrame();await new Promise(r=>setTimeout(r,150));}
   rec.stop();return done;
  },frames);fs.writeFileSync(dest,Buffer.from(data.split(',')[1],'base64'));await page.setContent('<video controls muted style="width:100%" src="'+data+'"></video>');await page.locator('video').evaluate(v=>new Promise(resolve=>{v.onloadeddata=()=>{v.currentTime=2;v.onseeked=resolve;};if(v.readyState>=2){v.currentTime=2;v.onseeked=resolve;}}));await page.screenshot({path:'artifacts/video-playback-verification.png'});await page.close();return{frames:frames.length,bytes:fs.statSync(dest).size,speed:'accelerated, 150ms per captured frame',audio:false};}
 };
};
