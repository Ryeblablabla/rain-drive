import fs from 'node:fs/promises';
import vm from 'node:vm';
import path from 'node:path';
import assert from 'node:assert/strict';
const output=path.resolve(process.env.QA_OUTPUT||'test-results'),sampleRate=48000,duration=15;
await fs.mkdir(output,{recursive:true});let Processor;
vm.runInNewContext(await fs.readFile(new URL('../public/assets/electric-processor.js',import.meta.url),'utf8'),{AudioWorkletProcessor:class{},sampleRate,registerProcessor:(name,C)=>{Processor=C;},Math});
for(const [style,filename] of [[0,'电驱运动-科幻修订试听.wav']]){
 const engine=new Processor(),samples=new Float32Array(sampleRate*duration);let hp=0,last=0,lp=0;const hi=Math.exp(-2*Math.PI*23/sampleRate),lo=1-Math.exp(-2*Math.PI*3900/sampleRate);
 for(let offset=0;offset<samples.length;offset+=128){
  const t=offset/sampleRate;let speed,load,brake;
  if(t<1){speed=0;load=0;brake=0;}else if(t<9){speed=(t-1)*17.5;load=Math.min(1,(t-1)*2)*.9;brake=0;}else if(t<11){speed=140-(t-9)*5;load=0;brake=0;}else{speed=Math.max(0,130-(t-11)*28);load=0;brake=.7;}
  const block=new Float32Array(Math.min(128,samples.length-offset));engine.process([],[[block]],{speed:[speed],load:[load],brake:[brake],traction:[style]});
  for(let i=0;i<block.length;i++){hp=hi*(hp+block[i]-last);last=block[i];lp+=lo*(hp-lp);const fade=Math.min(1,(samples.length-offset-i)/(sampleRate*.6));samples[offset+i]=lp*.62*fade;assert(Number.isFinite(samples[offset+i]));}
 }
 const peak=samples.reduce((m,v)=>Math.max(m,Math.abs(v)),0);assert(peak>.02&&peak<.9);
 const wav=Buffer.alloc(44+samples.length*2);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(sampleRate,24);wav.writeUInt32LE(sampleRate*2,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(samples.length*2,40);
 // Preview is isolated and normalized for listening; in-game mixing also contains wind/rain.
 for(let i=0;i<samples.length;i++)wav.writeInt16LE(Math.round(samples[i]/peak*.68*32767),44+i*2);
 await fs.writeFile(path.join(output,filename),wav);console.log(JSON.stringify({file:filename,duration,peak,style:style?'traction':'electric'}));
}
