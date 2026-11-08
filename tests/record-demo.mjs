import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const out=path.resolve(process.env.QA_OUTPUT||'test-results/demo'),url=process.env.GAME_URL||'http://127.0.0.1:18749/';
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=d3d11','--disable-background-timer-throttling','--disable-renderer-backgrounding']});
try{
 const context=await browser.newContext({viewport:{width:1920,height:1080},deviceScaleFactor:1,acceptDownloads:true});
 // Test-only tap of the actual output connection; no replacement or offline sound.
 await context.addInitScript(()=>{
  const connect=AudioNode.prototype.connect;
  AudioNode.prototype.connect=function(destination,...args){
   if(destination instanceof AudioDestinationNode){
    const tap=this.context.createMediaStreamDestination();connect.call(this,tap);window.__demoAudio=tap;
   }
   return connect.call(this,destination,...args);
  };
 });
 const page=await context.newPage(),errors=[],trace=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.goto(url);await page.waitForFunction(()=>window.__rainDrive);
 await page.locator('#settings-open').click();await page.locator('#sound-style').selectOption('electric');await page.locator('#voice').uncheck();
 await page.locator('#volume').fill('80');await page.locator('#engine-volume').fill('95');await page.locator('#rain-volume').fill('45');await page.locator('#cruise-speed').fill('85');await page.locator('#rain').fill('80');await page.locator('#settings-close').click();
 await page.locator('#start').click();await page.waitForFunction(()=>window.__rainDrive.snapshot().audio.recordedRain&&window.__demoAudio);await page.waitForTimeout(1500);await page.keyboard.press('h');
 await page.evaluate(()=>{
  const stream=document.querySelector('#game').captureStream(60);for(const track of window.__demoAudio.stream.getAudioTracks())stream.addTrack(track);
  const mime=['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus'].find(x=>MediaRecorder.isTypeSupported(x));
  const chunks=[];const recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:16000000,audioBitsPerSecond:192000});
  window.__demoRecording={recorder,chunks,mime,stream};recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};recorder.start(1000);
 });
 const take=async name=>{const s=await page.evaluate(()=>window.__rainDrive.snapshot());trace.push({name,snapshot:s});console.log(JSON.stringify({stage:name,speed:s.speed,fps:s.performance.averageFps,water:s.glass}));};
 await page.keyboard.down('w');await page.waitForTimeout(6000);await page.keyboard.up('w');await page.keyboard.press('c');await page.waitForTimeout(19000);await take('city-cruise');await page.screenshot({path:path.join(out,'city-cruise.png')});
 await page.keyboard.press('q');await page.keyboard.press('q'); // standard -> fast -> off
 await page.waitForTimeout(9000);await take('rain-on-glass');await page.screenshot({path:path.join(out,'rain-on-glass.png')});
 await page.keyboard.press('q');await page.keyboard.press('q');await page.keyboard.press('q'); // off -> intermittent -> standard -> fast
 await page.waitForTimeout(6000);await take('wiper-clearing');
 await page.keyboard.press('h');await page.locator('#settings-open').click();await page.locator('#traffic').selectOption('off');await page.locator('#settings-close').click();await page.keyboard.press('h');
 await page.keyboard.down('w');await page.waitForTimeout(43000);await page.keyboard.up('w');await take('electric-acceleration');await page.screenshot({path:path.join(out,'electric-high-speed.png')});
 await page.keyboard.press('q'); // fast -> off, airflow visible at high speed
 await page.waitForTimeout(8000);await take('airflow');await page.screenshot({path:path.join(out,'high-speed-airflow.png')});
 await page.keyboard.down('s');await page.waitForTimeout(4000);await page.keyboard.up('s');await page.waitForTimeout(2000);await take('braking');
 const downloadPromise=page.waitForEvent('download');
 const info=await page.evaluate(async()=>{
  const {recorder,chunks,mime,stream}=window.__demoRecording;await new Promise(resolve=>{recorder.onstop=resolve;recorder.stop();});
  const blob=new Blob(chunks,{type:mime}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='rain-drive-demo.webm';a.click();
  return{mime,bytes:blob.size,videoTracks:stream.getVideoTracks().map(t=>t.getSettings()),audioTracks:stream.getAudioTracks().map(t=>t.getSettings())};
 });
 const download=await downloadPromise;await download.saveAs(path.join(out,'rain-drive-demo.webm'));
 assert.equal(errors.length,0);assert(info.bytes>1000000);assert.equal(info.audioTracks.length,1);assert(trace.find(t=>t.name==='electric-acceleration').snapshot.speed>245);
 await fs.writeFile(path.join(out,'recording.json'),JSON.stringify({url,info,errors,trace},null,2));console.log('DEMO RECORDED');
}finally{await browser.close();}
