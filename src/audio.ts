import type {TrafficCar} from './world';
import type {Powertrain} from './powertrain';
type NoiseVoice={gain:GainNode;filter:BiquadFilterNode;source:AudioBufferSourceNode};
export class DriveAudio{
 context:AudioContext|null=null;master!:GainNode;rainBus!:GainNode;engineBus!:GainNode;musicBus!:GainNode;analyser!:AnalyserNode;
 musicOn=false;voiceOn=true;navCount=0;bumpCount=0;status='not-started';
 private rain!:NoiseVoice;private wind!:NoiseVoice;private tire!:NoiseVoice;private wipe!:NoiseVoice;private engineGain!:GainNode;private engines:OscillatorNode[]=[];private truck!:OscillatorNode;private truckGain!:GainNode;private truckPan!:StereoPannerNode;
 private chordTimer=0;private chordIndex=0;private musicNodes:OscillatorNode[]=[];private fileAudio:HTMLAudioElement|null=null;private fileUrl='';private previousSweep=.12;private recordedRain:GainNode|null=null;recordingLoaded=false;
 private motor:AudioWorkletNode|null=null;private motorFilter!:BiquadFilterNode;private previousShift=0;private motorRpm=850;private motorLoad=0;shiftSounds=0;engineType='oscillator-fallback';
 soundStyle='electric';private electricMotor:AudioWorkletNode|null=null;private electricGain!:GainNode;private electricFilter!:BiquadFilterNode;private electricSpeed=0;electricReady=false;
 async start(){
  if(this.context){await this.context.resume();return;}
  const ac=new AudioContext();this.context=ac;this.master=ac.createGain();this.master.gain.value=.70;
  this.analyser=ac.createAnalyser();this.analyser.fftSize=256;this.master.connect(this.analyser);this.analyser.connect(ac.destination);
  this.rainBus=ac.createGain();this.rainBus.gain.value=.65;this.engineBus=ac.createGain();this.engineBus.gain.value=.65;this.musicBus=ac.createGain();this.musicBus.gain.value=.40;
  this.rainBus.connect(this.master);this.engineBus.connect(this.master);this.musicBus.connect(this.master);
  this.rain=this.noise('lowpass',2600,.21,this.rainBus);this.wind=this.noise('lowpass',500,.03,this.engineBus);this.tire=this.noise('bandpass',850,.02,this.engineBus);this.wipe=this.noise('bandpass',1900,0,this.rainBus);
  this.engineGain=ac.createGain();this.engineGain.gain.value=.05;
  this.motorFilter=ac.createBiquadFilter();this.motorFilter.type='lowpass';this.motorFilter.frequency.value=1100;this.motorFilter.Q.value=.5;
  const hp=ac.createBiquadFilter();hp.type='highpass';hp.frequency.value=32;
  const compressor=ac.createDynamicsCompressor();compressor.threshold.value=-8;compressor.ratio.value=3;
  this.engineGain.connect(hp);hp.connect(this.motorFilter);this.motorFilter.connect(compressor);compressor.connect(this.engineBus);
  try{await ac.audioWorklet.addModule('./assets/engine-processor.js');this.motor=new AudioWorkletNode(ac,'inline-six',{numberOfInputs:0,numberOfOutputs:1,outputChannelCount:[1]});this.motor.connect(this.engineGain);this.engineType='inline-six-combustion-worklet';}
  catch{for(let i=0;i<3;i++){const osc=ac.createOscillator();osc.type=i===0?'sawtooth':'sine';const g=ac.createGain();g.gain.value=.12/(i+1);osc.connect(g);g.connect(this.engineGain);osc.start();this.engines.push(osc);}}
  this.electricGain=ac.createGain();this.electricGain.gain.value=0;this.electricFilter=ac.createBiquadFilter();this.electricFilter.type='lowpass';this.electricFilter.frequency.value=2400;this.electricFilter.Q.value=.4;
  const electricHP=ac.createBiquadFilter();electricHP.type='highpass';electricHP.frequency.value=23;
  this.electricGain.connect(electricHP);electricHP.connect(this.electricFilter);this.electricFilter.connect(this.engineBus);
  try{await ac.audioWorklet.addModule('./assets/electric-processor.js');this.electricMotor=new AudioWorkletNode(ac,'electric-drive',{numberOfInputs:0,numberOfOutputs:1,outputChannelCount:[1]});this.electricMotor.connect(this.electricGain);this.electricReady=true;}catch{this.electricReady=false;}
  this.truck=ac.createOscillator();this.truck.type='sawtooth';this.truck.frequency.value=50;this.truckGain=ac.createGain();this.truckGain.gain.value=0;const truckFilter=ac.createBiquadFilter();truckFilter.type='lowpass';truckFilter.frequency.value=280;this.truckPan=ac.createStereoPanner();this.truck.connect(truckFilter);truckFilter.connect(this.truckGain);this.truckGain.connect(this.truckPan);this.truckPan.connect(this.engineBus);this.truck.start();
  await ac.resume();this.status=ac.state;
  // Gravity Sound, "Rain drops", CC BY 4.0. Local copy; no runtime network dependency.
  fetch('./assets/rain-drops.wav').then(r=>{if(!r.ok)throw new Error('Rain recording unavailable');return r.arrayBuffer();}).then(b=>ac.decodeAudioData(b)).then(buffer=>{
    const source=ac.createBufferSource();source.buffer=buffer;source.loop=true;source.loopStart=1;source.loopEnd=Math.max(2,buffer.duration-1);
    const filter=ac.createBiquadFilter();filter.type='lowpass';filter.frequency.value=2400;this.recordedRain=ac.createGain();this.recordedRain.gain.value=.22;source.connect(filter);filter.connect(this.recordedRain);this.recordedRain.connect(this.rainBus);source.start();this.recordingLoaded=true;
  }).catch(()=>{this.recordingLoaded=false;});
 }
 private noise(type:BiquadFilterType,freq:number,volume:number,bus:GainNode):NoiseVoice{
  const ac=this.context!,buffer=ac.createBuffer(1,ac.sampleRate*4,ac.sampleRate),d=buffer.getChannelData(0);
  let brown=0;for(let i=0;i<d.length;i++){const white=Math.random()*2-1;brown=(brown+.02*white)/1.02;d[i]=type==='lowpass'?brown*3.5:white;}
  const source=ac.createBufferSource();source.buffer=buffer;source.loop=true;const filter=ac.createBiquadFilter();filter.type=type;filter.frequency.value=freq;filter.Q.value=.6;const gain=ac.createGain();gain.gain.value=volume;source.connect(filter);filter.connect(gain);gain.connect(bus);source.start();return{source,filter,gain};
 }
 setVolume(channel:string,value:number){if(!this.context)return;const node=channel==='master'?this.master:channel==='rain'?this.rainBus:channel==='engine'?this.engineBus:this.musicBus;node.gain.setTargetAtTime(value,this.context.currentTime,.08);}
 setSoundStyle(style:string){this.soundStyle=['combustion','electric'].includes(style)?style:'electric';}
 toggleMusic(){this.musicOn=!this.musicOn;if(this.fileAudio){if(this.musicOn)this.fileAudio.play().catch(()=>{this.status='music-play-failed';});else this.fileAudio.pause();}if(!this.musicOn)this.stopChord();return this.musicOn;}
 async loadFile(file:File){
  if(!this.context)await this.start();if(this.fileAudio)this.fileAudio.pause();if(this.fileUrl)URL.revokeObjectURL(this.fileUrl);
  this.stopChord();this.fileUrl=URL.createObjectURL(file);this.fileAudio=new Audio(this.fileUrl);this.fileAudio.loop=true;const source=this.context!.createMediaElementSource(this.fileAudio);source.connect(this.musicBus);await this.fileAudio.play();this.musicOn=true;
 }
 private stopChord(){const t=this.context?.currentTime||0;for(const n of this.musicNodes){try{n.stop(t+.1);}catch{}}this.musicNodes=[];}
 private playChord(){
  if(!this.context||!this.musicOn||this.fileAudio)return;const ac=this.context,t=ac.currentTime;
  const chords=[[130.81,164.81,196,246.94],[110,130.81,164.81,196],[87.31,130.81,174.61,220],[98,123.47,146.83,196]];
  const chord=chords[this.chordIndex++%chords.length];
  chord.forEach((frequency,i)=>{const osc=ac.createOscillator(),g=ac.createGain(),pan=ac.createStereoPanner();osc.type='sine';osc.frequency.value=frequency;osc.detune.value=(i%2?1:-1)*4;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.027,t+2.6);g.gain.setTargetAtTime(.001,t+7.3,1.6);pan.pan.value=(i-1.5)*.35;osc.connect(g);g.connect(pan);pan.connect(this.musicBus);osc.start(t);osc.stop(t+14);this.musicNodes.push(osc);});
  this.musicNodes=this.musicNodes.slice(-16);
 }
 bump(speed:number){if(!this.context)return;this.bumpCount++;const ac=this.context,t=ac.currentTime,osc=ac.createOscillator(),g=ac.createGain();osc.type='sine';osc.frequency.setValueAtTime(85,t);osc.frequency.exponentialRampToValueAtTime(28,t+.15);g.gain.setValueAtTime(.045*Math.min(speed/70,1),t);g.gain.exponentialRampToValueAtTime(.0001,t+.20);osc.connect(g);g.connect(this.engineBus);osc.start();osc.stop(t+.22);}
 navigate(text='前方继续直行，雨天路滑，请保持车距。'){
  if(!this.voiceOn||!('speechSynthesis'in window))return;const voice=new SpeechSynthesisUtterance(text);voice.lang='zh-CN';voice.rate=.86;voice.volume=Math.min(1,(this.master?.gain.value||.7)*.85);const voices=speechSynthesis.getVoices();const zh=voices.find(v=>v.lang.startsWith('zh'));if(zh)voice.voice=zh;speechSynthesis.cancel();speechSynthesis.speak(voice);this.navCount++;
 }
 private gearSound(down:boolean,boost:number){
  if(!this.context)return;this.shiftSounds++;const ac=this.context,t=ac.currentTime;
  const hit=ac.createOscillator(),g=ac.createGain();hit.type='triangle';hit.frequency.setValueAtTime(down?145:110,t);hit.frequency.exponentialRampToValueAtTime(42,t+.10);g.gain.setValueAtTime(.06,t);g.gain.exponentialRampToValueAtTime(.0001,t+.15);hit.connect(g);g.connect(this.engineBus);hit.start(t);hit.stop(t+.17);
  const buffer=ac.createBuffer(1,Math.floor(ac.sampleRate*.23),ac.sampleRate),d=buffer.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*Math.exp(-i/d.length*7);
  const burst=ac.createBufferSource();burst.buffer=buffer;const filter=ac.createBiquadFilter();filter.type='bandpass';filter.frequency.value=down?1800:3400;filter.Q.value=.7;const gain=ac.createGain();gain.gain.value=.055+boost*.055;burst.connect(filter);filter.connect(gain);gain.connect(this.engineBus);burst.start(t+.015);
 }
 update(dt:number,speed:number,rain:number,angle:number,cars:TrafficCar[],playerX:number,power:Powertrain){
  const ac=this.context;if(!ac)return;const t=ac.currentTime;
  this.status=ac.state;this.rain.gain.gain.setTargetAtTime(rain*(this.recordingLoaded?.13:.34),t,.2);this.rain.filter.frequency.setTargetAtTime(1800+rain*2200,t,.2);if(this.recordedRain)this.recordedRain.gain.setTargetAtTime(rain*.42,t,.2);
  this.wind.gain.gain.setTargetAtTime(.012+(1-Math.exp(-speed/130))*.22,t,.2);this.tire.gain.gain.setTargetAtTime(.008+Math.min(speed/180,1.7)*.075,t,.2);this.tire.filter.frequency.setTargetAtTime(450+Math.min(speed,300)*6,t,.2);
  this.motorRpm=power.rpm;this.motorLoad=power.throttle;
  if(this.motor){const params=this.motor.parameters as unknown as Map<string,AudioParam>;params.get('rpm')!.setTargetAtTime(power.rpm,t,.025);params.get('load')!.setTargetAtTime(power.throttle,t,.04);params.get('cut')!.setTargetAtTime(power.shiftRemaining>0||power.limiting?1:0,t,.012);}
  const electric=this.soundStyle!=='combustion'&&this.electricReady;
  this.engines.forEach((o,i)=>o.frequency.setTargetAtTime(power.rpm/20*(i+1),t,.035));this.engineGain.gain.setTargetAtTime(electric?0:.33+power.throttle*.25,t,.12);this.motorFilter.frequency.setTargetAtTime(560+power.throttle*1200+power.rpm*.08,t,.09);
  this.electricSpeed=speed;
  if(this.electricMotor){const params=this.electricMotor.parameters as unknown as Map<string,AudioParam>;params.get('speed')!.setTargetAtTime(speed,t,.03);params.get('load')!.setTargetAtTime(power.throttle,t,.05);params.get('brake')!.setTargetAtTime(power.brake,t,.07);}
  this.electricGain.gain.setTargetAtTime(electric?.62:0,t,.12);this.electricFilter.frequency.setTargetAtTime(2300+power.throttle*1600,t,.1);
  if(power.shiftCount!==this.previousShift){if(power.shiftCount>this.previousShift&&!electric)this.gearSound(power.lastShift==='down',power.boost);this.previousShift=power.shiftCount;}
  const wiping=Math.abs(angle-this.previousSweep)/Math.max(dt,.001);this.previousSweep=angle;this.wipe.gain.gain.setTargetAtTime(Math.min(.03,wiping*.012)*(.4+rain*.6),t,.018);
  let loudest:TrafficCar|undefined,max=0;for(const car of cars){if(!car.active)continue;const distance=Math.hypot(car.x-playerX,car.z-4),v=(car.truck?1.8:1)*Math.exp(-distance*.065);if(v>max){max=v;loudest=car;}}
  this.truckGain.gain.setTargetAtTime(max*.055,t,.08);
  if(loudest){this.truckPan.pan.setTargetAtTime(Math.max(-1,Math.min(1,(loudest.x-playerX)/8)),t,.1);this.truck.frequency.setTargetAtTime((loudest.truck?37:63)*(loudest.z<4?1.13:.87),t,.12);}
  if(this.musicOn&&!this.fileAudio){this.chordTimer-=dt;if(this.chordTimer<=0){this.playChord();this.chordTimer=9;}}
 }
 async pause(paused:boolean){if(!this.context)return;if(paused){await this.context.suspend();if(this.fileAudio)this.fileAudio.pause();speechSynthesis?.cancel();}else{await this.context.resume();if(this.fileAudio&&this.musicOn)this.fileAudio.play().catch(()=>{});}}
 measure(){if(!this.context)return{state:'not-started',rms:0};const d=new Float32Array(this.analyser.fftSize);this.analyser.getFloatTimeDomainData(d);const ep=this.electricMotor?.parameters as unknown as Map<string,AudioParam>|undefined;return{state:this.context.state,rms:Math.sqrt(d.reduce((s,v)=>s+v*v,0)/d.length),music:this.musicOn,recordedRain:this.recordingLoaded,navigation:this.navCount,bumps:this.bumpCount,engineType:this.soundStyle!=='combustion'&&this.electricReady?'electric-drive-worklet':this.engineType,combustionType:this.engineType,engineRpm:this.motorRpm,engineLoad:this.motorLoad,shiftSounds:this.shiftSounds,soundStyle:this.soundStyle,electricReady:this.electricReady,electricSpeed:this.electricSpeed,electricParameters:ep?{speed:ep.get('speed')!.value,load:ep.get('load')!.value,brake:ep.get('brake')!.value}:null,electricGain:this.electricGain.gain.value,combustionGain:this.engineGain.gain.value};}
}
