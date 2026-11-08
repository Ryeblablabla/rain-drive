import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const out=path.resolve(process.env.QA_OUTPUT||'test-results/demo'),url=process.env.GAME_URL||'http://127.0.0.1:18749/';
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=d3d11','--disable-background-timer-throttling','--disable-renderer-backgrounding']});
const segments=[];
try{
 for(const style of ['electric','combustion']){
  const context=await browser.newContext({viewport:{width:1920,height:1080},deviceScaleFactor:1,acceptDownloads:true});
  // Capture the actual master output. Each segment uses exactly one motor style.
  await context.addInitScript(()=>{const connect=AudioNode.prototype.connect;AudioNode.prototype.connect=function(destination,...args){if(destination instanceof AudioDestinationNode){const tap=this.context.createMediaStreamDestination();connect.call(this,tap);window.__demoAudio=tap;}return connect.call(this,destination,...args);};});
  const page=await context.newPage(),errors=[],trace=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(url);await page.waitForFunction(()=>window.__rainDrive);
  await page.locator('#settings-open').click();await page.locator('#sound-style').selectOption(style);await page.locator('#voice').uncheck();
  await page.locator('#volume').fill('80');await page.locator('#engine-volume').fill('95');await page.locator('#rain-volume').fill('45');await page.locator('#cruise-speed').fill('85');await page.locator('#rain').fill('80');
  if(style==='combustion')await page.locator('#traffic').selectOption('off');
  await page.locator('#settings-close').click();await page.locator('#start').click();
  await page.waitForFunction(()=>window.__rainDrive.snapshot().audio.recordedRain&&window.__demoAudio);await page.waitForTimeout(1500);await page.keyboard.press('h');
  assert(await page.locator('body').evaluate(el=>el.classList.contains('hud-off')));
  await page.evaluate(()=>{const stream=document.querySelector('#game').captureStream(60);for(const track of window.__demoAudio.stream.getAudioTracks())stream.addTrack(track);const mime=['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus'].find(x=>MediaRecorder.isTypeSupported(x));const chunks=[],recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:16000000,audioBitsPerSecond:192000});window.__demoRecording={recorder,chunks,mime,stream};recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};recorder.start(1000);});
  const take=async name=>{const s=await page.evaluate(()=>window.__rainDrive.snapshot());trace.push({name,snapshot:s});console.log(JSON.stringify({style,stage:name,speed:s.speed,fps:s.performance.averageFps,engine:s.audio.engineType,shifts:s.audio.shiftSounds}));};
  const drive=async(key,ms)=>{await page.keyboard.down(key);await page.waitForTimeout(ms);await page.keyboard.up(key);};
  if(style==='electric'){
   await drive('w',8000);await take('electric-launch');await page.keyboard.press('c');await page.waitForTimeout(10000);await take('city-cruise');await page.screenshot({path:path.join(out,'city-cruise.png')});
   await page.keyboard.press('q');await page.keyboard.press('q');await page.waitForTimeout(9000);await take('rain-on-glass');await page.screenshot({path:path.join(out,'rain-on-glass.png')});
   await page.keyboard.press('q');await page.keyboard.press('q');await page.keyboard.press('q');await page.waitForTimeout(6000);await take('wiper-clearing');
   await page.keyboard.press('h');await page.locator('#settings-open').click();await page.locator('#traffic').selectOption('off');await page.locator('#settings-close').click();await page.keyboard.press('h');
   await drive('w',18000);await take('electric-acceleration');await page.keyboard.press('q');await page.waitForTimeout(6000);await take('airflow');await page.screenshot({path:path.join(out,'high-speed-airflow.png')});await drive('s',3000);await take('electric-braking');
  }else{
   await drive('w',8000);await take('combustion-launch');await drive('w',14000);await take('combustion-midrange');await drive('w',22000);await take('combustion-high-speed');await page.screenshot({path:path.join(out,'combustion-high-speed.png')});
   await page.waitForTimeout(6000);await take('combustion-lift-off');await drive('s',4000);await take('combustion-braking');
  }
  const downloadPromise=page.waitForEvent('download');
  const info=await page.evaluate(async style=>{const{recorder,chunks,mime,stream}=window.__demoRecording;await new Promise(resolve=>{recorder.onstop=resolve;recorder.stop();});const blob=new Blob(chunks,{type:mime}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`rain-drive-${style}.webm`;a.click();return{mime,bytes:blob.size,videoTracks:stream.getVideoTracks().map(t=>t.getSettings()),audioTracks:stream.getAudioTracks().map(t=>t.getSettings())};},style);
  await(await downloadPromise).saveAs(path.join(out,`rain-drive-${style}.webm`));
  assert.deepEqual(errors,[]);assert(info.bytes>1000000);assert.equal(info.audioTracks.length,1);
  for(const{snapshot:s}of trace){assert.equal(s.audio.soundStyle,style);assert.equal(s.audio.engineType,style==='electric'?'electric-drive-worklet':'inline-six-combustion-worklet');assert(!s.audio.music);assert.equal(s.audio.navigation,0);if(style==='electric'){assert(s.audio.combustionGain<.002);assert.equal(s.audio.shiftSounds,0);}else assert(s.audio.electricGain<.002);}
  if(style==='combustion'){assert(trace.find(t=>t.name==='combustion-high-speed').snapshot.speed>245);assert(trace.at(-1).snapshot.audio.shiftSounds>=5);}
  segments.push({style,info,errors,trace});await fs.writeFile(path.join(out,'recording.json'),JSON.stringify({url,segments,textOverlays:false,soundTracksMixed:false},null,2));await context.close();
 }
 console.log('BOTH SEPARATE SOUND DEMOS RECORDED');
}finally{await browser.close();}
