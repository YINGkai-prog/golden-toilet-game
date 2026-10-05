'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require('playwright');
const {start,join50,KEY}=require('./helpers.cjs');
(async()=>{
 const app=await start();let browser;
 try{
  const controller=await app.connect({host:true,key:KEY,office:true});
  await join50(app,controller);
  controller.send({t:'h.phase',phase:'build'});
  await controller.wait(m=>m.t==='state'&&m.s.phase==='build');
  browser=process.env.TEST_BROWSER_CDP
    ? await chromium.connectOverCDP(process.env.TEST_BROWSER_CDP)
    : await chromium.launch({headless:true,channel:process.env.TEST_BROWSER_CHANNEL||undefined,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page=await browser.newPage({viewport:{width:1440,height:960},deviceScaleFactor:1});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(app.base+'/host?key='+KEY,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.__office&&window.__office.agents.size===50);
  await page.waitForTimeout(2500);
  const bounds=await page.locator('#officeWrap').boundingBox();assert.ok(bounds.height>430);
  assert.equal(await page.locator('.of-nav button').count(),5);
  await page.locator('[data-o=room-M]').click();
  assert.equal(await page.locator('[data-o=room-M]').getAttribute('aria-pressed'),'true');
  await page.locator('[data-o=home]').click();
  await page.waitForTimeout(700);
  fs.mkdirSync('artifacts',{recursive:true});
  async function capture(name,p){
    await p.screenshot({path:'artifacts/'+name+'.png',fullPage:false});
  }
  await capture('host',page);
  await page.goto(app.base+'/host?key='+KEY+'&view=office',{waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.__office&&window.__office.agents.size===50);
  await page.waitForTimeout(1400);
  await capture('office',page);
  controller.send({t:'h.phase',phase:'lobby'});await controller.wait(m=>m.t==='state'&&m.s.phase==='lobby');
  const desktop=await browser.newPage({viewport:{width:1365,height:960}});
  desktop.on('pageerror',e=>errors.push(e.message));
  await desktop.goto(app.base,{waitUntil:'networkidle'});
  await desktop.waitForSelector('#playerOfficeWrap:not(.hidden) .of-root canvas');
  await desktop.waitForTimeout(800);
  assert.equal(await desktop.locator('#officeToggle').getAttribute('aria-expanded'),'true');
  await capture('player',desktop);
  const phone=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
  phone.on('pageerror',e=>errors.push(e.message));
  await phone.goto(app.base,{waitUntil:'networkidle'});
  await phone.waitForSelector('#nm');
  assert.equal(await phone.locator('#officeToggle').getAttribute('aria-expanded'),'false');
  const overflow=await phone.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);
  assert.equal(overflow,false,'mobile layout should not overflow horizontally');
  await capture('mobile',phone);
  await phone.locator('#officeToggle').click();
  await phone.waitForSelector('#playerOffice .of-root canvas');
  assert.equal(await phone.locator('#officeToggle').getAttribute('aria-expanded'),'true');
  await phone.locator('#officeToggle').click();
  assert.equal(await phone.locator('#officeToggle').getAttribute('aria-expanded'),'false');
  console.log('Browser errors: '+JSON.stringify(errors));
  assert.deepEqual(errors,[]);
  console.log('PASS: 50 avatars, room navigation, desktop office and mobile layout.');
 }finally{if(browser)await browser.close();await app.stop();}
})().catch(e=>{console.error(e);process.exitCode=1;});
