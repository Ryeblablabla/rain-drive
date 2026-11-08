import * as T from 'three';
import {HighwayWorld} from './world';
import {GlassRain} from './rain-water';
import {Cockpit} from './cockpit';
import {DriveAudio} from './audio';
import {Powertrain} from './powertrain';
import './style.css';

const $=<E extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as E;
const clamp=T.MathUtils.clamp;
const settings={rain:.65,wiper:2,quality:'high',volume:.70,rainVolume:.65,engineVolume:.80,musicVolume:.40,voice:true,transmission:'auto',cruiseSpeed:68,traffic:'normal',soundStyle:'electric'};
try{Object.assign(settings,JSON.parse(localStorage.getItem('after-rain-settings')||'{}'));}catch{}
if(!['electric','combustion'].includes(settings.soundStyle))settings.soundStyle='electric';
settings.rain=clamp(Number(settings.rain)||0,0,1);settings.wiper=clamp(Number(settings.wiper)||0,0,3);
let started=false,paused=false,cruise=false,speed=0,playerX=5.4,steer=0,time=0,bump=0,lookX=0,lookY=0,dragging=false,previousX=0,previousY=0,toastTimer=0;
let driveSeconds=0,activeWallSeconds=0,totalFrames=0,fps=0,performanceTime=0,performanceFrames=0,lastHud=0,navAt=0,lastTime=performance.now(),wasNear=false,collisionCount=0,wasHidden=false;
let hiddenSeconds=0;
const keys=new Set<string>(),frameSamples:number[]=[],errors:string[]=[],events:{time:number;type:string;detail:string}[]=[];
let renderer:T.WebGLRenderer,world:HighwayWorld,glass:GlassRain,cockpit:Cockpit,renderTarget:T.WebGLRenderTarget,mirrorTarget:T.WebGLRenderTarget;
const audio=new DriveAudio(),power=new Powertrain();const mirrorCamera=new T.PerspectiveCamera(52,3.2,.1,700);
power.automatic=settings.transmission!=='manual';
const log=(type:string,detail:string)=>{events.push({time:Math.round(driveSeconds*10)/10,type,detail});if(events.length>500)events.shift();};
function toast(message:string){$('toast').textContent=message;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=window.setTimeout(()=>$('toast').classList.remove('visible'),2800);}
function fatal(message:string){errors.push(message);$('fatal-text').textContent=message;$('fatal').classList.remove('hidden');}
window.addEventListener('error',e=>{errors.push(e.message);if(!started)fatal(e.message);});
window.addEventListener('unhandledrejection',e=>{errors.push(String(e.reason));});

function persist(){try{localStorage.setItem('after-rain-settings',JSON.stringify(settings));}catch{}}
function setRain(value:number){settings.rain=clamp(value,0,1);if(glass)glass.amount=settings.rain;$<HTMLInputElement>('rain').value=String(Math.round(settings.rain*100));$('rain-value').textContent=Math.round(settings.rain*100)+'%';$('weather-label').textContent=settings.rain<.01?'雨歇':settings.rain<.35?'小雨':settings.rain<.75?'中雨':'大雨';persist();log('rain',String(value));}
function setWiper(mode:number){settings.wiper=mode;if(glass)glass.mode=mode;$<HTMLSelectElement>('wiper').value=String(mode);persist();log('wiper',String(mode));}
function resize(){
 const width=window.innerWidth,height=window.innerHeight,scale=settings.quality==='high'?Math.min(devicePixelRatio,1.25):settings.quality==='medium'?1:.75;
 renderer.setPixelRatio(scale);renderer.setSize(width,height,false);world.camera.aspect=cockpit.camera.aspect=width/height;world.camera.updateProjectionMatrix();cockpit.camera.updateProjectionMatrix();renderTarget.setSize(Math.floor(width*scale),Math.floor(height*scale));glass.resize(Math.floor(width*scale),Math.floor(height*scale));
}
function setQuality(value:string){settings.quality=['low','medium','high'].includes(value)?value:'high';$<HTMLSelectElement>('quality').value=settings.quality;world.setQuality(settings.quality);resize();persist();log('quality',settings.quality);}
async function start(relax=false){
 if(started)return;try{await audio.start();}catch(e){toast('音频暂未启用，驾驶仍可继续');errors.push('Audio: '+String(e));}
 started=true;cruise=relax;speed=relax?settings.cruiseSpeed:0;power.reset(speed);document.body.classList.add('playing');$('welcome').classList.add('hidden');$('scene-caption').classList.add('hidden');$('hud').classList.remove('hidden');$('help').classList.remove('hidden');
 audio.setVolume('master',settings.volume);audio.setVolume('rain',settings.rainVolume);audio.setVolume('engine',settings.engineVolume);audio.setVolume('music',settings.musicVolume);audio.setSoundStyle(settings.soundStyle);audio.voiceOn=settings.voice;
 toast(relax?'巡航已开启 · 轻踩刹车即可接管':'按住 W 加速，A / D 转向 · 按 C 开启巡航');log('start',relax?'cruise':'manual');audio.navigate('欢迎进入雨夜高架。雨天路滑，请保持车距。');navAt=1200;
}
function toggleCruise(){if(!started)return;cruise=!cruise;toast(cruise?'巡航开启 · 自动保持车道与安全车距':'巡航关闭 · 已交还驾驶控制');log('cruise',String(cruise));updateHud();}
async function pause(value=!paused){if(!started)return;paused=value;keys.clear();$('pause-screen').classList.toggle('hidden',!paused);await audio.pause(paused);log('pause',String(paused));lastTime=performance.now();}
function reset(){speed=0;power.reset();playerX=5.4;steer=0;cruise=false;world.reset();glass.reset();time=0;bump=0;navAt=1200;driveSeconds=0;activeWallSeconds=0;hiddenSeconds=0;collisionCount=0;wasNear=false;frameSamples.length=0;log('restart','player, traffic, water and journey reset');pause(false);updateHud();toast('已重新出发');}
function updateHud(){
 $('speed').textContent=String(Math.round(speed)).padStart(2,'0');$('distance').textContent=(world.travel/1000).toFixed(2)+' km';$('cruise-label').textContent=cruise?'巡航 '+settings.cruiseSpeed:'手动驾驶';$('speed-track').style.width=Math.min(power.rpm/power.redline*100,100)+'%';$('cruise-button').textContent=cruise?'关闭自适应巡航':'开启巡航 · '+settings.cruiseSpeed+' km/h';$('gear').textContent=(power.automatic?'D':'M')+power.gear;$('rpm').textContent=Math.round(power.rpm)+' r/min';
 $('nav-distance').textContent='前方 '+(Math.max(100,navAt-world.travel)/1000).toFixed(1)+' km';$('perf').textContent=`${Math.round(fps)} FPS · ${Math.round(innerWidth)} × ${Math.round(innerHeight)} · ${settings.quality==='high'?'高画质':settings.quality==='medium'?'中画质':'低画质'}`;
}
function updateMusic(){document.body.classList.toggle('music-on',audio.musicOn);$('music-subtitle').textContent=audio.musicOn?'原创氛围音乐 / 正在播放':'原创氛围音乐 / 已关闭';$('music-toggle').setAttribute('aria-label',audio.musicOn?'关闭音乐':'开启音乐');}
function setupUI(){
 $('start').onclick=()=>start(false);$('tour').onclick=()=>start(true);
 $('settings-open').onclick=()=>{$('settings').classList.remove('hidden');};$('settings-close').onclick=()=>{$('settings').classList.add('hidden');};
 $('resume').onclick=()=>pause(false);$('pause-button').onclick=()=>pause();$('restart').onclick=$('reset-button').onclick=reset;$('cruise-button').onclick=toggleCruise;
 $('help-close').onclick=()=>$('help').classList.add('hidden');
 $('fullscreen').onclick=()=>{if(document.fullscreenElement)document.exitFullscreen();else document.documentElement.requestFullscreen().catch(()=>toast('可使用浏览器全屏功能'));};
 $<HTMLInputElement>('rain').oninput=e=>setRain(Number((e.target as HTMLInputElement).value)/100);
 $<HTMLSelectElement>('wiper').onchange=e=>setWiper(Number((e.target as HTMLSelectElement).value));
 $<HTMLSelectElement>('quality').onchange=e=>setQuality((e.target as HTMLSelectElement).value);
 $<HTMLSelectElement>('transmission').value=settings.transmission;$<HTMLSelectElement>('transmission').onchange=e=>{settings.transmission=(e.target as HTMLSelectElement).value;power.automatic=settings.transmission==='auto';persist();};
 $<HTMLSelectElement>('traffic').value=settings.traffic;world.setTraffic(settings.traffic);$<HTMLSelectElement>('traffic').onchange=e=>{settings.traffic=(e.target as HTMLSelectElement).value;world.setTraffic(settings.traffic);persist();};
 $<HTMLSelectElement>('sound-style').value=settings.soundStyle;audio.setSoundStyle(settings.soundStyle);$<HTMLSelectElement>('sound-style').onchange=e=>{settings.soundStyle=(e.target as HTMLSelectElement).value;audio.setSoundStyle(settings.soundStyle);persist();toast('声浪 · '+{combustion:'涡轮六缸',electric:'电驱运动'}[settings.soundStyle as 'electric']);};
 $<HTMLInputElement>('cruise-speed').value=String(settings.cruiseSpeed);$<HTMLInputElement>('cruise-speed').onchange=e=>{settings.cruiseSpeed=Math.max(20,Number((e.target as HTMLInputElement).value)||68);persist();updateHud();};
 const channels=[['volume','volume','master'],['rain-volume','rainVolume','rain'],['engine-volume','engineVolume','engine'],['music-volume','musicVolume','music']] as const;
 for(const [id,key,channel] of channels){const el=$<HTMLInputElement>(id);el.value=String(settings[key]*100);el.oninput=()=>{settings[key]=Number(el.value)/100;audio.setVolume(channel,settings[key]);if(id==='volume')$('volume-value').textContent=el.value+'%';persist();};}
 $('volume-value').textContent=Math.round(settings.volume*100)+'%';
 $<HTMLInputElement>('voice').checked=settings.voice;$<HTMLInputElement>('voice').onchange=e=>{settings.voice=(e.target as HTMLInputElement).checked;audio.voiceOn=settings.voice;if(!settings.voice)speechSynthesis.cancel();persist();};
 $('music-toggle').onclick=()=>{if(!started){toast('开始驾驶后可播放音乐');return;}audio.toggleMusic();updateMusic();};
 $<HTMLInputElement>('music-file').onchange=async e=>{const file=(e.target as HTMLInputElement).files?.[0];if(!file)return;try{await audio.loadFile(file);$('music-title').textContent=file.name.replace(/\.[^.]+$/,'');updateMusic();$('music-subtitle').textContent='本地音乐 / 正在播放';toast('已载入本地音乐');}catch{toast('该音频无法播放，请尝试 MP3 或 WAV');}};
 window.addEventListener('keydown',e=>{
   if((e.target as HTMLElement).matches('input,select'))return;
   const k=e.key.toLowerCase();if(['arrowup','arrowdown','arrowleft','arrowright',' '].includes(k))e.preventDefault();keys.add(k);if(e.repeat)return;
   if(k==='escape'){if(!$('settings').classList.contains('hidden'))$('settings').classList.add('hidden');else pause();}
   if(k==='p')pause();if(k==='q'){setWiper((settings.wiper+1)%4);toast('雨刷 · '+['关闭','间歇','标准','快速'][settings.wiper]);}
   if(k==='c')toggleCruise();if(k==='r'&&started)reset();if(k==='m'&&started){audio.toggleMusic();updateMusic();}if(k==='f')$('fullscreen').click();if(k==='h')document.body.classList.toggle('hud-off');
   if(k==='t'){power.automatic=!power.automatic;settings.transmission=power.automatic?'auto':'manual';$<HTMLSelectElement>('transmission').value=settings.transmission;persist();toast(power.automatic?'六挡自动变速箱':'手动序列换挡 · E 升挡 / Z 降挡');}
   if((k==='e'||k==='z')&&started&&!paused){power.automatic=false;settings.transmission='manual';$<HTMLSelectElement>('transmission').value='manual';power.shift(k==='e'?1:-1);persist();}
 });
 window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));window.addEventListener('blur',()=>{keys.clear();dragging=false;});
 $('game').onpointerdown=e=>{dragging=true;previousX=e.clientX;previousY=e.clientY;$('game').setPointerCapture(e.pointerId);};
 $('game').onpointermove=e=>{if(!dragging||!started)return;lookX=clamp(lookX+(e.clientX-previousX)*.0015,-.21,.21);lookY=clamp(lookY+(e.clientY-previousY)*.001,-.10,.10);previousX=e.clientX;previousY=e.clientY;};
 $('game').onpointerup=()=>{dragging=false;};
 window.addEventListener('resize',resize);
 document.addEventListener('visibilitychange',()=>{wasHidden=document.hidden;});
}
function animate(now:number){
 requestAnimationFrame(animate);const rawDt=Math.max(0,(now-lastTime)/1000);lastTime=now;const dt=Math.min(rawDt,.05);
 if(paused)return;
 renderer.info.reset();
 time+=dt;totalFrames++;performanceFrames++;performanceTime+=rawDt;
 if(started){driveSeconds+=dt;activeWallSeconds+=rawDt;if(document.hidden)hiddenSeconds+=rawDt;if(rawDt>0)frameSamples.push(rawDt*1000);if(frameSamples.length>120000)frameSamples.shift();}
 if(performanceTime>=1){fps=performanceFrames/performanceTime;performanceTime=0;performanceFrames=0;}
 if(started){
  const gas=keys.has('w')||keys.has('arrowup'),brake=keys.has('s')||keys.has('arrowdown')||keys.has(' ');
  const direction=(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0);
  if(gas||brake||direction)cruise=false;
  power.speed=speed;
  if(cruise){
    let target=settings.cruiseSpeed;for(const c of world.traffic)if(c.active&&c.direction>0&&Math.abs(c.x-playerX)<1.8&&c.z<4&&c.z> -Math.max(65,speed*.75))target=Math.min(target,Math.max(0,c.speed*3.6+(Math.abs(c.z)-Math.max(27,speed*.55))*1.0));
    speed=power.update(dt,clamp((target-speed)*.10+.10,0,1),clamp((speed-target)*.065,0,1));playerX+=(5.4-playerX)*Math.min(1,dt*1.4);
  }else speed=power.update(dt,gas?1:0,brake?1:0);
  steer+=(direction-steer)*Math.min(1,dt*6);playerX+=steer*Math.min(speed/20,3.2)*dt/(1+Math.max(0,speed-100)/140);
  if(playerX<1.25||playerX>11.25){speed=Math.max(0,speed-dt*28);bump=.8;playerX=clamp(playerX,1.25,11.25);}
  let near=false;
  for(const c of world.traffic)if(c.active&&c.direction>0&&Math.abs(c.x-playerX)<(c.truck?1.9:1.65)&&Math.abs(c.z-4)<(c.truck?5.5:3.5)){near=true;if(!wasNear){collisionCount++;speed=Math.min(speed,c.speed*3.6);bump=1;audio.bump(speed);toast('保持车距 · 放慢一点');log('contact','soft collision');}}
  wasNear=near;
  if(world.travel>navAt){audio.navigate('沿江高架，前方连续弯道。雨天请保持车距。');navAt+=1200;log('navigation','curved elevated segment');}
 }
 const roadBump=world.update(dt,started?speed:0,playerX,time,settings.rain);
 if(roadBump&&started){bump=.6;audio.bump(speed);}
 bump*=Math.exp(-dt*12);
 if(!dragging){lookX*=Math.exp(-dt*2.5);lookY*=Math.exp(-dt*2.5);}
 world.route.place(world.camera,playerX,1.65+Math.sin(time*28)*bump*.018,4,0,true);
 world.camera.rotation.set(Math.atan(world.route.grade(world.travel-4))-.018+lookY+Math.sin(time*18)*bump*.002,-world.route.heading(world.travel-4)-lookX,-steer*.009+Math.sin(time*22)*bump*.0015,'YXZ');
 const fov=58+Math.min(5,speed*.017);world.camera.fov=cockpit.camera.fov=fov;world.camera.updateProjectionMatrix();cockpit.camera.updateProjectionMatrix();
 glass.update(dt,started?speed:0);cockpit.update(speed,steer,time,bump,power,world.travel);cockpit.camera.rotation.set(lookY,-lookX,-steer*.009,'YXZ');
 if(started)audio.update(dt,speed,settings.rain,glass.angles[0],world.traffic,playerX,power);
 if(totalFrames%6===0){
   world.route.point(playerX,1.65,5,mirrorCamera.position);mirrorCamera.lookAt(world.route.point(playerX,1.4,150));renderer.setRenderTarget(mirrorTarget);renderer.clear();renderer.render(world.scene,mirrorCamera);
 }
 renderer.setRenderTarget(renderTarget);renderer.clear();renderer.render(world.scene,world.camera);
 renderer.setRenderTarget(null);renderer.clear();glass.material.uniforms.tScene.value=renderTarget.texture;renderer.render(glass.scene,glass.camera);renderer.clearDepth();renderer.render(cockpit.scene,cockpit.camera);
 if(now-lastHud>250){updateHud();lastHud=now;}
}

async function init(){
 try{
 renderer=new T.WebGLRenderer({canvas:$<HTMLCanvasElement>('game'),antialias:true,powerPreference:'high-performance'});
 renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=.92;renderer.outputColorSpace=T.SRGBColorSpace;renderer.autoClear=false;renderer.info.autoReset=false;
 renderTarget=new T.WebGLRenderTarget(1920,1080,{type:T.HalfFloatType,depthBuffer:true,samples:2});mirrorTarget=new T.WebGLRenderTarget(512,160,{type:T.HalfFloatType});
 world=new HighwayWorld(renderer);glass=new GlassRain();cockpit=new Cockpit();cockpit.setMirror(mirrorTarget.texture);
 setRain(settings.rain);setWiper(settings.wiper);setQuality(settings.quality);setupUI();
 await world.ready;
 cockpit.scene.environment=world.scene.environment;cockpit.scene.environmentIntensity=.10;
 $('loading').textContent='场景已就绪 · 建议佩戴耳机';log('ready','all systems initialized');requestAnimationFrame(animate);
 const gl=renderer.getContext();const debug=gl.getExtension('WEBGL_debug_renderer_info');
 const api={
   snapshot:()=>{
    const sorted=[...frameSamples].sort((a,b)=>a-b),sum=frameSamples.reduce((s,v)=>s+v,0),n=sorted.length;
    return{started,paused,cruise,speed,playerX,driveSeconds,activeWallSeconds,travel:world.travel,quality:settings.quality,rain:settings.rain,wiper:settings.wiper,powertrain:power.snapshot(),cockpit:cockpit.diagnostics(),world:world.diagnostics(),glass:{drops:glass.drops.length,spawned:glass.spawned,cleared:glass.cleared,merged:glass.merged,split:glass.split,trails:glass.trails,drained:glass.drained,airborne:glass.airborne,sweeps:glass.sweeps,angles:glass.angles},traffic:{count:world.traffic.length,passes:world.nearPasses,bumps:world.bumps,contacts:collisionCount,cars:world.traffic.map(c=>({x:c.x,z:c.z,truck:c.truck,direction:c.direction,speed:c.speed}))},performance:{fps,averageFps:n/(sum/1000),p50ms:sorted[Math.floor(n*.5)]||0,p95ms:sorted[Math.floor(n*.95)]||0,p99ms:sorted[Math.floor(n*.99)]||0,frames:n,over33ms:sorted.filter(x=>x>33.34).length,width:innerWidth,height:innerHeight,pixelRatio:renderer.getPixelRatio(),renderer:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,hidden:wasHidden,hiddenSeconds},audio:audio.measure(),errors:[...errors],events:[...events]};
   },
   resetPerformance:()=>{frameSamples.length=0;renderer.info.reset();},
 };
 (window as unknown as {__rainDrive:typeof api}).__rainDrive=api;
 }catch(e){fatal(String(e));}
}
init();
// Keep the portable localhost host alive only while its game window is in use.
setInterval(()=>{fetch('/__heartbeat',{cache:'no-store'}).catch(()=>{});},12000);
