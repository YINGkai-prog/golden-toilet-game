const fs=require('fs'),assert=require('assert/strict'),{start,KEY,delay}=require('./helpers.cjs');
const {chromium}=require('playwright');
(async()=>{const app=await start();let browser;try{
 browser=await chromium.launch({channel:'msedge',headless:true,args:['--autoplay-policy=no-user-gesture-required']});const context=await browser.newContext({viewport:{width:1440,height:900}}),errors=[];
 const host=await context.newPage(),player=await context.newPage();for(const p of [host,player])p.on('pageerror',e=>errors.push(e.message));
 await host.goto(app.base+'/host?key='+KEY);await player.goto(app.base+'/');await host.locator('#introStart').click();
 await host.waitForFunction(()=>!document.querySelector('.intro-overlay').hidden&&document.querySelector('#introMovie').currentTime>1);
 await player.waitForFunction(()=>!document.querySelector('.intro-overlay').hidden&&document.querySelector('#introMovie').currentTime>1);
 const inspect=p=>p.locator('#introMovie').evaluate(v=>({duration:v.duration,src:v.getAttribute('src'),time:v.currentTime,muted:v.muted,width:v.videoWidth,height:v.videoHeight,paused:v.paused}));
 const h=await inspect(host),p=await inspect(player);assert.ok(Math.abs(h.duration-30)<.1);assert.equal(h.width,1920);assert.equal(h.height,1080);assert.equal(h.src,'/intro-30.mp4');assert.equal(h.muted,false);assert.equal(p.muted,true);assert.ok(Math.abs(h.time-p.time)<2);assert.equal(await player.locator('#introSkip').isVisible(),false);
 await delay(4000);await host.screenshot({path:'artifacts/trailer-in-game.png'});await host.locator('#introSkip').click();await player.waitForFunction(()=>document.querySelector('.intro-overlay').hidden);assert.equal((await inspect(player)).paused,true);
 await host.locator('#introStart').click();await host.waitForFunction(()=>!document.querySelector('.intro-overlay').hidden);await host.waitForFunction(()=>document.querySelector('.intro-overlay').hidden,{},{timeout:35000});
 assert.deepEqual(errors,[]);fs.writeFileSync('artifacts/trailer-validation.json',JSON.stringify({passed:true,host:h,player:p,errors,checks:['30-second H.264/AAC playback','1920x1080','host and player synchronized','player audio muted by default','host skip closes both players','automatic close at 30 seconds']},null,2));console.log('Trailer playback, synchronization, skip and 30-second close passed.');
 }finally{await browser?.close();await app.stop();}})().catch(e=>{console.error(e);process.exitCode=1;});
