import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import ts from 'typescript';
const code=ts.transpileModule(await fs.readFile(new URL('../src/powertrain.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText;
const {Powertrain}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const run=(dt)=>{const p=new Powertrain(),shifts=[];let lastGear=1,t100=0;
 for(let time=0;time<180;time+=dt){p.update(dt,1,0);if(p.gear!==lastGear){shifts.push({time,speed:p.speed,gear:p.gear});lastGear=p.gear;}if(!t100&&p.speed>=100)t100=time;assert(Number.isFinite(p.speed));assert(p.speed>=0);}
 return {p,shifts,t100};};
const a=run(1/60),b=run(1/120),stepDifference=Math.abs(a.p.speed-b.p.speed);assert(a.p.speed>250);assert.equal(a.p.gear,6);assert.equal(a.shifts.length,5);assert(stepDifference<1);assert(a.p.acceleration<.03);
const previous=a.p.speed;for(let i=0;i<600;i++)a.p.update(1/120,0,0);assert(a.p.speed<previous-15);
const m=new Powertrain();m.automatic=false;for(let i=0;i<1200;i++)m.update(1/120,1,0);assert.equal(m.gear,1);assert(m.limiting||m.speed<85);
m.reset(245);m.automatic=false;m.gear=6;assert.equal(m.shift(-1),true);for(let i=0;i<120;i++)m.update(1/120,0,0);assert.equal(m.shift(-1),false); // would over-rev fourth.
const overspeed=new Powertrain();overspeed.reset(500);overspeed.update(1/120,0,0);assert(overspeed.speed>490); // resistance acts continuously, no hidden speed clamp.
console.log(JSON.stringify({passed:true,naturalTopSpeed:b.p.speed,zeroTo100:b.t100,shifts:b.shifts,frameStepDifference:stepDifference},null,2));
