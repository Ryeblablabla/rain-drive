import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const out=path.resolve(process.env.QA_OUTPUT||'test-results'),url=process.env.GAME_URL;
if(!url)throw new Error('Set GAME_URL to the actual portable launcher address');
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=d3d11']});
try{
 const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1}),errors=[];
 page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto(url);await page.waitForFunction(()=>window.__rainDrive);await page.locator('#tour').click();
 await page.waitForFunction(()=>window.__rainDrive.snapshot().audio.recordedRain);await page.waitForTimeout(2300);
 const snapshot=await page.evaluate(()=>window.__rainDrive.snapshot());assert(snapshot.world.importedCars>=20);assert.equal(snapshot.audio.engineType,'electric-drive-worklet');assert(snapshot.travel>25);assert.deepEqual(errors,[]);
 await page.keyboard.press('h');await page.waitForTimeout(150);await page.screenshot({path:path.join(out,'cockpit.png')});
 await fs.writeFile(path.join(out,'native-host-smoke.json'),JSON.stringify({url,errors,snapshot},null,2));
 console.log(JSON.stringify({nativeHostSmoke:'passed',url,travel:snapshot.travel,gear:snapshot.powertrain.gear,engine:snapshot.audio.engineType},null,2));
}finally{await browser.close();}
