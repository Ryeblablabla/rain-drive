import * as T from 'three';
// Mass, neighbour collisions and residual trails follow the approach documented
// by SardineFish/raindrop-fx (MIT). Airflow and wiper coupling are original.
type Drop={x:number;y:number;r:number;vx:number;vy:number;age:number;pin:number;next:number;trail:number;family:number};
const W=1280,H=720;
export class GlassRain {
 canvas=document.createElement('canvas');wiped=document.createElement('canvas');
 texture:T.CanvasTexture;wipeTexture:T.CanvasTexture;material:T.ShaderMaterial;
 scene=new T.Scene();camera=new T.OrthographicCamera(-1,1,1,-1,0,1);
 drops:Drop[]=[];angles=[.12,.12];previous=[.12,.12];mode=2;amount=.65;aspect=16/9;time=0;
 cleared=0;merged=0;spawned=0;sweeps=0;split=0;trails=0;drained=0;airborne=0;
 private ctx:CanvasRenderingContext2D;private wipe:CanvasRenderingContext2D;
 private stamp=document.createElement('canvas');private film=document.createElement('canvas');private filmCtx:CanvasRenderingContext2D;
 private carry=0;private accumulator=0;private serial=0;
 constructor(){
  for(const c of [this.canvas,this.wiped,this.film]){c.width=W;c.height=H;}
  this.ctx=this.canvas.getContext('2d',{alpha:false})!;this.wipe=this.wiped.getContext('2d',{alpha:false})!;this.filmCtx=this.film.getContext('2d',{alpha:false})!;
  this.wipe.fillStyle=this.filmCtx.fillStyle='#000';this.wipe.fillRect(0,0,W,H);this.filmCtx.fillRect(0,0,W,H);
  this.stamp.width=this.stamp.height=96;const c=this.stamp.getContext('2d')!,data=c.createImageData(96,96);
  for(let y=0;y<96;y++)for(let x=0;x<96;x++){
   const nx=(x-47.5)/47.5,ny=(y-47.5)/47.5,r2=nx*nx+ny*ny;if(r2>=1)continue;
   const i=(y*96+x)*4,h=Math.pow(1-r2,.65);data.data[i]=data.data[i+1]=data.data[i+2]=255*h;data.data[i+3]=Math.min(1,(1-r2)*20)*255;
  }c.putImageData(data,0,0);
  this.texture=new T.CanvasTexture(this.canvas);this.wipeTexture=new T.CanvasTexture(this.wiped);
  for(const t of [this.texture,this.wipeTexture]){t.minFilter=T.LinearFilter;t.generateMipmaps=false;}
  this.material=new T.ShaderMaterial({depthTest:false,depthWrite:false,uniforms:{tScene:{value:null},tRain:{value:this.texture},tWipe:{value:this.wipeTexture},uTime:{value:0},uAmount:{value:.65},uAspect:{value:this.aspect},uAngles:{value:new T.Vector2(.12,.12)},uResolution:{value:new T.Vector2(1920,1080)}},
   vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`,
   fragmentShader:`uniform sampler2D tScene,tRain,tWipe;uniform float uTime,uAmount,uAspect;uniform vec2 uAngles,uResolution;varying vec2 vUv;
   float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
   float segment(vec2 p,vec2 a,vec2 b){vec2 v=b-a;return length(p-a-v*clamp(dot(p-a,v)/dot(v,v),0.,1.));}
   vec3 scene(vec2 uv){return texture2D(tScene,clamp(uv,vec2(.001),vec2(.999))).rgb;}
   void main(){
    vec2 uv=vUv,px=1./uResolution,texel=vec2(1./1280.,1./720.);float glass=smoothstep(.17,.25,uv.y);
    float h=texture2D(tRain,uv).r,clear=texture2D(tWipe,uv).r;
    vec2 gradient=vec2(texture2D(tRain,uv+vec2(texel.x,0)).r-texture2D(tRain,uv-vec2(texel.x,0)).r,texture2D(tRain,uv+vec2(0,texel.y)).r-texture2D(tRain,uv-vec2(0,texel.y)).r);
    vec2 cell=uv*vec2(235.*uAspect,235.),f=fract(cell)-.5;float seed=hash(floor(cell));
    float micro=(1.-smoothstep(.08,.19,length(f)))*step(.80,seed)*uAmount*(1.-clear*.98);
    float mask=smoothstep(.035,.17,h)*glass;vec2 n=gradient*2.7;
    vec2 shift=(-n*vec2(.018/uAspect,.018)*(.45+h)+f*micro*.005)*glass;
    vec3 base=scene(uv),refract=scene(uv+shift),halo=vec3(0.);
    for(int i=0;i<8;i++){float a=float(i)*.785398;vec2 d=vec2(cos(a),sin(a));halo+=max(scene(uv+shift+d*px*vec2(12.,7.))-.65,0.);}
    vec3 col=mix(base,refract,mask);col+=halo*(mask*.055+micro*.018);
    vec3 edgeLight=scene(uv+shift+n*.012);float rim=clamp(length(n)*.35,0.,.45)*mask;
    col+=max(edgeLight-.16,0.)*rim;col*=1.-mask*.045;
    float damp=uAmount*(1.-clear*.97)*glass;
    vec3 blur=(scene(uv+vec2(.0025,0))+scene(uv-vec2(.0025,0))+scene(uv+vec2(0,.0025))+scene(uv-vec2(0,.0025)))*.25;
    col=mix(col,blur,damp*.035+micro*.12);
    vec2 p=vec2(uv.x*uAspect,uv.y);
    for(int i=0;i<2;i++){
     float theta=i==0?uAngles.x:uAngles.y;vec2 root=vec2((i==0?.20:.65)*uAspect,.16),dir=vec2(cos(theta),sin(theta));float len=i==0?.78:.70;
     float blade=segment(p,root+dir*.34,root+dir*len),arm=segment(p,root,root+dir*.57);
     float m=max(1.-smoothstep(.003,.005,blade),1.-smoothstep(.0018,.0032,arm));col=mix(col,vec3(.009,.014,.017),m*.98);
    }
    col+=(hash(uv*uResolution+fract(uTime)*100.)-.5)*.004;col*=1.-.10*pow(length((uv-.5)*1.2),2.);
    gl_FragColor=vec4(col,1.);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>
   }`});
  this.scene.add(new T.Mesh(new T.PlaneGeometry(2,2),this.material));for(let i=0;i<620;i++)this.spawn(true);this.draw();
 }
 private drop(x:number,y:number,r:number,family=0):Drop{return{x,y,r,vx:0,vy:0,age:0,pin:3+Math.random()*6,next:.1+Math.random()*.6,trail:0,family:family||++this.serial};}
 private spawn(initial=false){this.drops.push(this.drop(Math.random(),Math.random()*(initial?1:.96),1.0+Math.pow(Math.random(),3.4)*7.8));this.spawned++;}
 update(dt:number,speed:number){
  this.time+=dt;this.previous=[...this.angles];let phase=0;
  if(this.mode===1){const q=this.time%4.4;phase=q<1.5?q/1.5:0;}else if(this.mode>1)phase=(this.time*(this.mode===3?.85:.48))%1;
  const sweep=.5-.5*Math.cos(phase*Math.PI*2);this.angles=[.12+sweep*2.65,.12+sweep*2.52];if(this.previous[0]>.18&&this.angles[0]<=.18)this.sweeps++;
  this.wipe.fillStyle=`rgba(0,0,0,${Math.min(1,dt*(.11+this.amount*.15))})`;this.wipe.fillRect(0,0,W,H);
  this.filmCtx.fillStyle=`rgba(0,0,0,${Math.min(1,dt*.8)})`;this.filmCtx.fillRect(0,0,W,H);
  for(let j=0;j<2;j++){
   if(!this.mode||Math.abs(this.angles[j]-this.previous[j])<.0001)continue;
   const lo=Math.min(this.previous[j],this.angles[j]),hi=Math.max(this.previous[j],this.angles[j]),rx=j===0?.20:.65,len=j===0?.78:.70;
   for(const ctx of [this.wipe,this.filmCtx]){
    ctx.strokeStyle=ctx===this.wipe?'#fff':'#000';ctx.lineWidth=15;ctx.lineCap='round';
    const steps=Math.max(1,Math.ceil((hi-lo)/.018));for(let k=0;k<=steps;k++){const a=lo+(hi-lo)*k/steps;ctx.beginPath();ctx.moveTo((rx+Math.cos(a)*.19/this.aspect)*W,(.84-Math.sin(a)*.19)*H);ctx.lineTo((rx+Math.cos(a)*len/this.aspect)*W,(.84-Math.sin(a)*len)*H);ctx.stroke();}
   }
   this.drops=this.drops.filter(d=>{const dx=(d.x-rx)*this.aspect,dy=.84-d.y,r=Math.hypot(dx,dy),a=Math.atan2(dy,dx);const hit=r>.17&&r<len+.015&&a>=lo-.025&&a<=hi+.025;if(hit)this.cleared++;return !hit;});
  }
  this.carry+=dt*this.amount*(270+Math.min(speed,220)*.45);while(this.carry>=1&&this.drops.length<1900){this.spawn();this.carry--;}this.carry=Math.min(this.carry,1);
  const additions:Drop[]=[],air=speed*speed*.0028;
  for(const d of this.drops){
   d.age+=dt;d.r=Math.sqrt(Math.max(0,d.r*d.r-dt*(.28+Math.max(0,2-d.r)*.65)));d.next-=dt;if(d.next<0){d.next=.16+Math.random()*.7;d.pin=3+Math.random()*6;}
   const mass=d.r*d.r,adhesion=d.pin*d.pin,free=Math.max(0,1-adhesion/Math.max(mass,1));
   const ax=(d.x-.5)*air*.9,ay=120-air*(.85+Math.abs(d.x-.5)*.4),windSlip=Math.max(0,air/160-.35),mobility=Math.min(1,free+windSlip*d.r/8);
   d.vx+=(ax*mobility-d.vx*2.4)*dt;d.vy+=(ay*mobility-d.vy*2.2)*dt;
   const ox=d.x,oy=d.y;d.x+=d.vx*dt/W;d.y+=d.vy*dt/H;
   const distance=Math.hypot((d.x-ox)*W,(d.y-oy)*H);d.trail+=distance;
   if(distance>.12&&d.r>2.3){
    this.filmCtx.strokeStyle=`rgba(145,145,145,${Math.min(.75,.22+d.r*.035)})`;this.filmCtx.lineWidth=Math.max(.7,d.r*.42);this.filmCtx.lineCap='round';this.filmCtx.beginPath();this.filmCtx.moveTo(ox*W,oy*H);this.filmCtx.lineTo(d.x*W,d.y*H);this.filmCtx.stroke();this.trails++;
    if(d.trail>8+d.r&&d.r>3){const r=d.r*(.19+Math.random()*.10),child=this.drop(ox,oy,r,d.family);child.age=-.3;additions.push(child);d.r=Math.sqrt(Math.max(1,d.r*d.r-r*r));d.trail=0;}
   }
   if(speed>125&&d.r>7&&Math.random()<dt*(speed-110)*.018){
    const r=d.r*.45;for(let k=0;k<2;k++){const child=this.drop(d.x+(Math.random()-.5)*.008,d.y,r,d.family);child.vx=d.vx+(k?1:-1)*air*.13;child.vy=d.vy*1.4;child.age=-.25;additions.push(child);}d.r*=Math.sqrt(1-2*.45*.45);this.split++;
   }
   if(d.y<-.03||d.y>1.04||d.x<-.03||d.x>1.03){d.r=0;this.drained++;if(speed>110)this.airborne++;}
  }
  const grid=new Map<number,Drop[]>(),cell=28;
  for(const d of this.drops){if(d.r<=0)continue;const gx=Math.floor(d.x*W/cell),gy=Math.floor(d.y*H/cell);
   for(let yy=-1;yy<=1&&d.r>0;yy++)for(let xx=-1;xx<=1&&d.r>0;xx++)for(const o of grid.get((gy+yy)*100+gx+xx)||[]){
    if(o.r<=0||(o.family===d.family&&(o.age<.5||d.age<.5)))continue;
    const dx=(d.x-o.x)*W,dy=(d.y-o.y)*H;if(dx*dx+dy*dy>Math.pow((d.r+o.r)*.80,2))continue;
    const a=o.r*o.r,b=d.r*d.r,m=a+b;o.x=(o.x*a+d.x*b)/m;o.y=(o.y*a+d.y*b)/m;o.vx=(o.vx*a+d.vx*b)/m;o.vy=(o.vy*a+d.vy*b)/m;o.r=Math.sqrt(m);o.pin*=.75;d.r=0;this.merged++;
   }
   if(d.r>0){const key=gy*100+gx;let list=grid.get(key);if(!list)grid.set(key,list=[]);list.push(d);}
  }
  // Reserve capacity for fresh rain impacts instead of letting residual microdrops
  // consume the entire pool and silently stop rain on a long uninterrupted drive.
  this.drops=this.drops.filter(d=>d.r>.45);this.drops.push(...additions.slice(0,Math.max(0,1700-this.drops.length)));
  this.accumulator+=dt;if(this.accumulator>=1/40){this.draw();this.accumulator=0;}
  this.material.uniforms.uTime.value=this.time;this.material.uniforms.uAmount.value=this.amount;this.material.uniforms.uAspect.value=this.aspect;this.material.uniforms.uAngles.value.set(...this.angles);
 }
 private draw(){
  this.ctx.fillStyle='#000';this.ctx.fillRect(0,0,W,H);this.ctx.globalAlpha=.30;this.ctx.drawImage(this.film,0,0);this.ctx.globalAlpha=1;this.ctx.globalCompositeOperation='lighten';
  for(const d of this.drops){const velocity=Math.hypot(d.vx,d.vy),stretch=1+Math.min(velocity*.018,2.8),r=d.r;this.ctx.save();this.ctx.translate(d.x*W,d.y*H);this.ctx.rotate(Math.atan2(d.vy,d.vx)-Math.PI/2);this.ctx.drawImage(this.stamp,-r,-r*stretch,r*2,r*2*stretch);this.ctx.restore();}
  this.ctx.globalCompositeOperation='source-over';this.texture.needsUpdate=this.wipeTexture.needsUpdate=true;
 }
 resize(w:number,h:number){this.aspect=w/h;this.material.uniforms.uResolution.value.set(w,h);}
 reset(){this.time=0;this.cleared=this.merged=this.spawned=this.sweeps=this.split=this.trails=this.drained=this.airborne=0;this.drops=[];this.carry=0;this.angles=[.12,.12];this.previous=[.12,.12];this.wipe.fillStyle=this.filmCtx.fillStyle='#000';this.wipe.fillRect(0,0,W,H);this.filmCtx.fillRect(0,0,W,H);for(let i=0;i<620;i++)this.spawn(true);this.draw();}
}
