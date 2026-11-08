import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const out=path.resolve(process.env.QA_OUTPUT||'test-results'),url=process.env.GAME_URL||'http://127.0.0.1:18749/';
await fs.mkdir(out,{recursive:true});const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=d3d11']});
try{
 const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1}),errors=[],checks=[];
 page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 const snap=()=>page.evaluate(()=>window.__rainDrive.snapshot());
 await page.goto(url);await page.waitForFunction(()=>window.__rainDrive);await page.locator('#start').click();await page.waitForFunction(()=>window.__rainDrive.snapshot().audio.electricReady);
 await page.locator('#settings-open').click();assert.equal(await page.locator('#sound-style').inputValue(),'electric');await page.locator('#traffic').selectOption('off');await page.locator('#rain-volume').fill('0');await page.locator('#settings-close').click();
 await page.keyboard.down('w');const trace=[];for(let i=0;i<30;i++){await page.waitForTimeout(250);trace.push(await snap());}await page.keyboard.up('w');const a=await snap();
 assert(a.speed>100);assert(a.audio.electricReady);assert.equal(a.audio.engineType,'electric-drive-worklet');assert(a.audio.electricGain>.60);assert(a.audio.combustionGain<.002);assert.equal(a.audio.shiftSounds,0);assert(a.audio.rms>.006);assert(Math.abs(a.audio.electricParameters.speed-a.speed)<8);assert(a.powertrain.shiftCount>=2);checks.push('electric motor follows road speed/load through two gearbox shifts, with no combustion or mechanical shift sound');
 await page.keyboard.down('s');await page.waitForTimeout(700);const brake=await snap();await page.keyboard.up('s');assert(brake.audio.electricParameters.brake>.99);assert(brake.speed<a.speed);checks.push('braking reduces drive pitch input');
 await page.locator('#settings-open').click();await page.locator('#sound-style').selectOption('combustion');await page.locator('#settings-close').click();await page.waitForTimeout(1100);const ice=await snap();assert(ice.audio.combustionGain>.3);assert(ice.audio.electricGain<.002);assert.equal(ice.audio.engineType,'inline-six-combustion-worklet');checks.push('sound styles crossfade to the correct active audio paths');
 await page.locator('#settings-open').click();await page.locator('#sound-style').selectOption('electric');await page.locator('#settings-close').click();await page.waitForTimeout(1100);
 await page.keyboard.press('p');await page.waitForFunction(()=>window.__rainDrive.snapshot().audio.state==='suspended');await page.locator('#resume').click();await page.waitForFunction(()=>window.__rainDrive.snapshot().audio.state==='running');checks.push('pause/resume also controls the electric audio processor');
 await page.reload();await page.waitForFunction(()=>window.__rainDrive);assert.equal(await page.locator('#sound-style').inputValue(),'electric');checks.push('electric style persists after reload');assert.deepEqual(errors,[]);
 await fs.writeFile(path.join(out,'electric.json'),JSON.stringify({url,checks,errors,accelerating:a,braking:brake,combustion:ice,trace},null,2));console.log(JSON.stringify({passed:true,checks,speed:a.speed,shifts:a.powertrain.shiftCount,audio:a.audio},null,2));
}finally{await browser.close();}
