import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

const options=process.argv.slice(2);
const url=process.env.GAME_URL||'http://127.0.0.1:18749/';
const output=path.resolve(process.env.QA_OUTPUT||'test-results');
const functionalOnly=options.includes('--functional');
const soakOnly=options.includes('--soak');
const duration=Number(options.find(x=>x.startsWith('--duration='))?.split('=')[1]||600);
await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:!options.includes('--headed'),args:['--use-angle=d3d11','--disable-background-timer-throttling','--disable-renderer-backgrounding']});
const context=await browser.newContext({viewport:{width:1920,height:1080},deviceScaleFactor:1});
const page=await context.newPage();
const errors=[],requests=[],checks=[];
page.on('pageerror',e=>errors.push(String(e)));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
page.on('requestfailed',r=>requests.push({url:r.url(),failure:r.failure()}));
const snapshot=()=>page.evaluate(()=>window.__rainDrive.snapshot());
const record=(name,detail)=>{checks.push({name,detail});console.log('PASS '+name);};
const openSettings=()=>page.locator('#settings-open').click();
const closeSettings=()=>page.locator('#settings-close').click();
try{
 await page.goto(url);await page.waitForFunction(()=>window.__rainDrive);
 assert.equal(await page.locator('#fatal').isVisible(),false);
 if(!soakOnly){await openSettings();await page.locator('#sound-style').selectOption('combustion');await closeSettings();}
 await page.locator(soakOnly?'#tour':'#start').click();
 await page.waitForFunction(()=>window.__rainDrive.snapshot().audio.recordedRain,{},{timeout:20000});
 record('startup and real rain recording',(await snapshot()).audio);
 const ready=await snapshot();assert.equal(ready.audio.engineType,soakOnly?'electric-drive-worklet':'inline-six-combustion-worklet');assert(ready.audio.electricReady);assert(ready.world.importedCars>=20);assert.equal(ready.world.assets.cityTypes,8);assert.equal(ready.world.assets.realStreetLamps,80);assert(ready.world.route.curvedMeshes>10);assert.equal(ready.cockpit.style,'physical-amber-analog');assert.equal(ready.powertrain.speedLimiter,false);record('new cockpit, external models and both motor worklets loaded',true);

 if(!soakOnly){
  await page.keyboard.down('w');await page.waitForTimeout(1600);await page.keyboard.up('w');
  const accelerated=await snapshot();assert(accelerated.speed>15);
  await page.keyboard.down('d');await page.waitForTimeout(350);await page.keyboard.up('d');
  const turned=await snapshot();assert(turned.playerX>accelerated.playerX+.05);
  await page.keyboard.down('s');await page.waitForTimeout(1200);await page.keyboard.up('s');
  assert((await snapshot()).speed<accelerated.speed);record('acceleration, steering and braking',{accelerated:accelerated.speed,steeredX:turned.playerX});
  await page.keyboard.press('c');await page.waitForTimeout(2400);assert((await snapshot()).cruise);record('cruise can take over', (await snapshot()).speed);
  await page.keyboard.press('p');await page.waitForFunction(()=>window.__rainDrive.snapshot().audio.state==='suspended');
  const stopped=await snapshot();await page.waitForTimeout(400);assert.equal((await snapshot()).travel,stopped.travel);
  await page.locator('#resume').click();await page.waitForTimeout(400);assert((await snapshot()).travel>stopped.travel);record('pause freezes travel and audio; resume restores both',true);

  await openSettings();await page.locator('#wiper').selectOption('0');await page.locator('#rain').fill('100');await closeSettings();
  const before=await snapshot();await page.waitForTimeout(4000);const pooled=await snapshot();
  assert(pooled.glass.spawned>before.glass.spawned+500);assert.equal(pooled.glass.cleared,before.glass.cleared);
  await page.screenshot({path:path.join(output,'rain-wiper-off.png')});
  await openSettings();await page.locator('#wiper').selectOption('3');await closeSettings();await page.waitForTimeout(2600);
  const swept=await snapshot();assert(swept.glass.cleared>pooled.glass.cleared+100);assert(swept.glass.sweeps>pooled.glass.sweeps);
  await page.screenshot({path:path.join(output,'rain-wiper-fast.png')});record('rain accumulates with wiper off and is swept by fast wipers',{off:pooled.glass,on:swept.glass});

  await openSettings();await page.locator('#wiper').selectOption('0');await page.locator('#rain').fill('0');await closeSettings();
  const dry=await snapshot();await page.waitForTimeout(1100);assert.equal((await snapshot()).glass.spawned,dry.glass.spawned);record('zero rain stops spawning new droplets',true);
  await openSettings();await page.locator('#quality').selectOption('low');const low=await snapshot();assert.equal(low.performance.pixelRatio,.75);assert.equal(low.world.reflectionSize.width,640);
  await page.locator('#quality').selectOption('high');assert.equal((await snapshot()).world.reflectionSize.width,1280);record('quality controls alter render resolution',true);
  await page.locator('#rain').fill('65');await page.locator('#wiper').selectOption('2');
  await page.locator('#volume').fill('0');await page.waitForTimeout(650);assert((await snapshot()).audio.rms<.002);
  await page.locator('#volume').fill('70');await page.waitForTimeout(650);assert((await snapshot()).audio.rms>.002);record('master volume mutes and restores actual output signal',true);
  await closeSettings();await page.locator('#music-toggle').click();assert((await snapshot()).audio.music);record('original music toggle',true);

  const samples=22050,wav=Buffer.alloc(44+samples*2);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(22050,24);wav.writeUInt32LE(44100,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(samples*2,40);for(let i=0;i<samples;i++)wav.writeInt16LE(Math.round(Math.sin(i/22050*Math.PI*440)*2000),44+i*2);
  await openSettings();await page.locator('#music-file').setInputFiles({name:'acceptance-tone.wav',mimeType:'audio/wav',buffer:wav});await page.waitForFunction(()=>document.querySelector('#music-title').textContent==='acceptance-tone');assert((await snapshot()).audio.music);await closeSettings();record('local audio import and playback',true);
  await page.keyboard.press('r');await page.waitForTimeout(100);const reset=await snapshot();assert.equal(reset.speed,0);assert.equal(reset.travel,0);assert.equal(reset.playerX,5.4);assert(reset.traffic.bumps===0);assert(reset.glass.spawned>=620&&reset.glass.spawned<700);record('restart resets vehicle, traffic, water and distance',true);
  await openSettings();await page.locator('#traffic').selectOption('off');await page.locator('#transmission').selectOption('auto');await closeSettings();
  await page.keyboard.down('w');const acceleration=[];const aStart=Date.now();
  while((Date.now()-aStart)<44000){await page.waitForTimeout(1000);const s=await snapshot();acceleration.push({time:s.driveSeconds,speed:s.speed,gear:s.powertrain.gear,rpm:s.powertrain.rpm,shifting:s.powertrain.shifting});assert(Math.abs(s.cockpit.speedometer-s.speed)<.1);assert(Math.abs(s.cockpit.tachometer-s.powertrain.rpm)<.1);}
  await page.keyboard.up('w');const fast=await snapshot();assert(fast.speed>245);assert.equal(fast.powertrain.gear,6);assert(fast.audio.shiftSounds>=5);assert(Math.abs(fast.audio.engineRpm-fast.powertrain.rpm)<.1);assert.equal(fast.traffic.contacts,0);
  await page.screenshot({path:path.join(output,'high-speed.png')});record('full throttle exceeds 245 km/h, shifts through six gears and drives real dashboard/audio',{speed:fast.speed,powertrain:fast.powertrain,audio:fast.audio,acceleration});
  await page.keyboard.down('s');await page.waitForTimeout(3500);await page.keyboard.up('s');const braked=await snapshot();assert(braked.speed<fast.speed-60);record('high-speed braking reduces speed', {before:fast.speed,after:braked.speed});
  await page.keyboard.press('r');await openSettings();await page.locator('#transmission').selectOption('manual');await closeSettings();
  await page.keyboard.down('w');await page.waitForTimeout(2000);await page.keyboard.up('w');await page.keyboard.press('e');await page.waitForTimeout(800);const second=await snapshot();assert.equal(second.powertrain.gear,2);assert.equal(second.powertrain.automatic,false);await page.keyboard.press('z');await page.waitForTimeout(800);assert.equal((await snapshot()).powertrain.gear,1);record('sequential manual upshift and downshift',true);
  await page.keyboard.press('r');await openSettings();await page.locator('#transmission').selectOption('auto');await page.locator('#traffic').selectOption('normal');await closeSettings();
 }

 if(!functionalOnly){
  await openSettings();await page.locator('#sound-style').selectOption('electric');await closeSettings();
  if(!soakOnly)await page.keyboard.press('c');
  await page.waitForTimeout(3000);await page.evaluate(()=>window.__rainDrive.resetPerformance());
  const start=Date.now(),baseline=await snapshot(),checkpoints=[];
  while((Date.now()-start)/1000<duration){await page.waitForTimeout(Math.min(30000,Math.max(1000,duration*1000-(Date.now()-start))));const s=await snapshot();checkpoints.push({elapsed:(Date.now()-start)/1000,snapshot:s});console.log(JSON.stringify({elapsed:checkpoints.at(-1).elapsed,speed:s.speed,fps:s.performance.averageFps,p95ms:s.performance.p95ms}));assert(s.cruise);assert(!s.paused);assert.equal(s.errors.length,0);}
  const final=await snapshot();assert(final.driveSeconds-baseline.driveSeconds>=duration*.97);assert(final.travel-baseline.travel>3000);assert(final.performance.averageFps>=30);assert(final.performance.p95ms<=33.4);assert.equal(final.performance.hiddenSeconds,0);assert.equal(final.traffic.contacts,baseline.traffic.contacts);assert(!/SwiftShader|llvmpipe/i.test(final.performance.renderer));
  await fs.writeFile(path.join(output,'soak.json'),JSON.stringify({duration,url,baseline,checkpoints,final,errors,requests},null,2));record('continuous hardware-accelerated 1080p cruise',final.performance);
 }
 assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
 await page.screenshot({path:path.join(output,'final.png')});
 await fs.writeFile(path.join(output,'acceptance.json'),JSON.stringify({url,checks,errors,requests,final:await snapshot()},null,2));
 console.log('ALL CHECKS PASSED');
}catch(e){await fs.writeFile(path.join(output,'failure.json'),JSON.stringify({error:String(e),checks,errors,requests,snapshot:await snapshot().catch(()=>null)},null,2));await page.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});throw e;
}finally{await browser.close();}
