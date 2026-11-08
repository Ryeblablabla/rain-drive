import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {box} from './world';
import type {Powertrain} from './powertrain';
type Gauge={needle:T.Group;max:number;value:number};
/** Driver-eye RHD grand-tourer interior; physical illuminated dials behind the wheel. */
export class Cockpit {
 scene=new T.Scene();camera=new T.PerspectiveCamera(58,16/9,.025,10);root=new T.Group();steering=new T.Group();
 private mirror:T.Mesh;private instruments:Gauge[]=[];private auxiliary:Gauge[]=[];private ambient:T.PointLight;
 private readout=document.createElement('canvas');private display:T.CanvasTexture;private lastDisplay='';
 private leather:T.MeshStandardMaterial;private dark:T.MeshStandardMaterial;private metal:T.MeshStandardMaterial;
 constructor(){
  this.scene.add(this.root);this.scene.add(new T.HemisphereLight(0x8a9cac,0x030405,.24));
  const sky=new T.DirectionalLight(0x9baab5,.30);sky.position.set(-1,3,-2);this.scene.add(sky);
  this.ambient=new T.PointLight(0xff6929,.12,2,2);this.ambient.position.set(.12,-.25,-.62);this.scene.add(this.ambient);
  const c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d')!,im=x.createImageData(256,256);
  for(let i=0;i<im.data.length;i+=4){const v=110+Math.random()*30;im.data[i]=im.data[i+1]=im.data[i+2]=v;im.data[i+3]=255;}x.putImageData(im,0,0);
  const grain=new T.CanvasTexture(c);grain.wrapS=grain.wrapT=T.RepeatWrapping;grain.repeat.set(7,7);
  this.leather=new T.MeshStandardMaterial({color:0x171718,roughness:.91,bumpMap:grain,bumpScale:.0008});
  this.dark=new T.MeshStandardMaterial({color:0x08090b,roughness:.61});this.metal=new T.MeshStandardMaterial({color:0x626467,metalness:.91,roughness:.35});
  const leather=this.leather,black=this.dark,metal=this.metal;
  this.round(3.0,.40,.90,-.48,-.66,-1.26,.09,leather);this.round(2.80,.11,.69,-.48,-.34,-1.55,.055,leather);
  this.round(.92,.055,.22,.10,-.193,-1.13,.024,black);this.round(.90,.34,.09,.10,-.366,-.985,.055,black);
  box(this.root,1.10,.002,.002,-.97,-.405,-.725,metal);
  for(let i=0;i<86;i++)box(this.root,.003,.0014,.001,-1.52+i*.013,-.398,-.704,metal);
  this.instruments.push(this.gauge(-.075,-.325,-.925,.115,9,'×1000 r/min',1,7));
  this.instruments.push(this.gauge(.205,-.325,-.925,.115,360,'km/h',40,320));
  this.instruments.push(this.gauge(.395,-.275,-.925,.043,120,'°C',40,110));
  this.instruments.push(this.gauge(.395,-.395,-.925,.043,1,'FUEL',.5,2));
  for(let i=0;i<3;i++){
   const gx=-.83+i*.18;this.round(.15,.13,.13,gx,-.28,-1.22,.035,black);
   this.auxiliary.push(this.gauge(gx,-.26,-1.138,.058,i===0?1.6:i===1?150:8,i===0?'BOOST bar':i===1?'OIL °C':'OIL bar',i===0?.4:i===1?50:2,i===0?1.3:i===1?130:7));
  }
  this.readout.width=this.readout.height=128;this.display=new T.CanvasTexture(this.readout);this.display.colorSpace=T.SRGBColorSpace;
  const panel=new T.Mesh(new T.PlaneGeometry(.044,.048),new T.MeshBasicMaterial({map:this.display,toneMapped:false}));panel.position.set(.065,-.325,-.909);this.root.add(panel);
  this.steering.position.set(.08,-.535,-.65);this.steering.rotation.x=-.22;this.root.add(this.steering);
  const rim=new T.Mesh(new T.TorusGeometry(.244,.021,16,96),leather);this.steering.add(rim);
  const seam=new T.Mesh(new T.TorusGeometry(.243,.0011,4,96),new T.MeshStandardMaterial({color:0x8c7866,roughness:.9}));seam.position.z=.02;this.steering.add(seam);
  const spokeMat=new T.MeshStandardMaterial({color:0x202124,metalness:.65,roughness:.38});
  for(const a of [.16,Math.PI-.16,-Math.PI/2]){
   const spoke=box(this.steering,.19,.048,.021,Math.cos(a)*.125,Math.sin(a)*.125,-.006,spokeMat);spoke.rotation.z=a;
   for(let j=0;j<2;j++){const screw=new T.Mesh(new T.CircleGeometry(.0045,12),metal);screw.position.set(Math.cos(a)*(.11+j*.035),Math.sin(a)*(.11+j*.035),.006);this.steering.add(screw);}
  }
  const hub=new T.Mesh(new RoundedBoxGeometry(.15,.13,.058,3,.025),black);hub.position.z=.009;this.steering.add(hub);
  const badge=new T.Mesh(new T.RingGeometry(.023,.026,32),metal);badge.position.z=.040;this.steering.add(badge);
  const stalk=box(this.root,.15,.019,.024,-.205,-.43,-.75,black);stalk.rotation.z=.1;box(this.root,.07,.032,.033,-.28,-.42,-.74,black);
  for(const cx of [-.82,-.49]){this.round(.27,.092,.025,cx,-.405,-.733,.016,black);for(let i=0;i<5;i++)box(this.root,.24,.004,.012,cx,-.436+i*.014,-.710,metal);}
  const nav=document.createElement('canvas');nav.width=512;nav.height=256;const nx=nav.getContext('2d')!;nx.fillStyle='#050909';nx.fillRect(0,0,512,256);
  nx.strokeStyle='#172120';nx.lineWidth=3;for(let i=-200;i<700;i+=45){nx.beginPath();nx.moveTo(i,0);nx.lineTo(i-80,256);nx.stroke();nx.beginPath();nx.moveTo(0,i);nx.lineTo(512,i+90);nx.stroke();}
  nx.strokeStyle='#8b7953';nx.lineWidth=10;nx.beginPath();nx.moveTo(300,280);nx.bezierCurveTo(310,160,205,160,230,-10);nx.stroke();nx.strokeStyle='#d5c29b';nx.lineWidth=3;nx.stroke();
  nx.fillStyle='#d8d5b6';nx.beginPath();nx.moveTo(285,175);nx.lineTo(272,202);nx.lineTo(301,196);nx.closePath();nx.fill();nx.font='17px Microsoft YaHei';nx.fillText('沿江高架  ↑  城市中心',24,30);nx.font='13px monospace';nx.fillStyle='#8e9c95';nx.fillText('21:48     RIVERSIDE EXPWY',24,235);
  const nt=new T.CanvasTexture(nav);nt.colorSpace=T.SRGBColorSpace;this.round(.48,.25,.04,-.65,-.605,-.755,.02,black);
  const ns=new T.Mesh(new T.PlaneGeometry(.402,.201),new T.MeshBasicMaterial({map:nt,toneMapped:false,color:0xa6a6a6}));ns.position.set(-.65,-.585,-.729);this.root.add(ns);
  for(const cx of [-.89,-.42])this.knob(cx,-.72,-.702,.019);
  this.round(.038,.035,.018,-.65,-.435,-.697,.006,black);const hazard=new T.Mesh(new T.RingGeometry(.007,.009,3),new T.MeshBasicMaterial({color:0x9f351a,toneMapped:false}));hazard.position.set(-.65,-.432,-.683);this.root.add(hazard);
  this.round(.38,.22,.20,-.49,-.91,-.61,.025,black);this.knob(-.49,-.85,-.47,.027);
  for(const [px,a] of [[-.98,-.31],[.73,.30]]){const p=this.round(.075,1.72,.17,px,.29,-.91,.026,leather);p.rotation.z=a;}
  this.round(2.7,.16,.30,-.28,.86,-.79,.05,leather);this.round(.18,.42,.80,.85,-.57,-.45,.05,leather);box(this.root,.019,.018,.42,.744,-.452,-.42,metal);
  this.round(.315,.108,.04,-.36,.425,-1.02,.017,black);
  this.mirror=new T.Mesh(new T.PlaneGeometry(.285,.083),new T.MeshBasicMaterial({color:0x6e7c83,toneMapped:false}));this.mirror.position.set(-.36,.425,-.994);this.root.add(this.mirror);box(this.root,.021,.15,.027,-.36,.53,-1.04,black);
 }
 private round(w:number,h:number,d:number,x:number,y:number,z:number,r:number,m:T.Material){const mesh=new T.Mesh(new RoundedBoxGeometry(w,h,d,3,r),m);mesh.position.set(x,y,z);this.root.add(mesh);return mesh;}
 private knob(x:number,y:number,z:number,r:number){const a=new T.Mesh(new T.CylinderGeometry(r,r,.022,24),this.dark);a.rotation.x=Math.PI/2;a.position.set(x,y,z);this.root.add(a);const ring=new T.Mesh(new T.TorusGeometry(r*.8,.0015,4,24),this.metal);ring.position.set(x,y,z+.014);this.root.add(ring);}
 private gauge(x:number,y:number,z:number,r:number,max:number,label:string,step:number,red:number):Gauge{
  const root=new T.Group();root.position.set(x,y,z);this.root.add(root);const bezel=new T.Mesh(new T.TorusGeometry(r,.003,8,64),this.metal);root.add(bezel);
  const canvas=document.createElement('canvas');canvas.width=canvas.height=512;const c=canvas.getContext('2d')!;c.fillStyle='#050505';c.beginPath();c.arc(256,256,253,0,Math.PI*2);c.fill();c.textAlign='center';c.textBaseline='middle';
  const count=Math.round(max/step)*5;
  for(let i=0;i<=count;i++){
   const value=max*i/count,a=(225-270*i/count)*Math.PI/180,major=i%5===0;c.strokeStyle=value>=red?'#ed3e20':'#e89a5d';c.lineWidth=major?4:2;c.beginPath();c.moveTo(256+Math.cos(a)*(major?197:213),256-Math.sin(a)*(major?197:213));c.lineTo(256+Math.cos(a)*237,256-Math.sin(a)*237);c.stroke();
   if(major){c.fillStyle=value>=red?'#f1673c':'#f9b27d';c.font=`${r<.07?35:29}px Arial`;c.fillText(Number(value.toFixed(1)).toString(),256+Math.cos(a)*165,256-Math.sin(a)*165);}
  }
  c.font=`${r<.07?24:21}px Arial`;c.fillStyle='#d38b54';c.fillText(label,256,338);
  const tex=new T.CanvasTexture(canvas);tex.colorSpace=T.SRGBColorSpace;const face=new T.Mesh(new T.PlaneGeometry(r*2,r*2),new T.MeshBasicMaterial({map:tex,transparent:true,toneMapped:false}));face.position.z=.001;root.add(face);
  const needle=new T.Group();needle.position.z=.008;root.add(needle);const s=new T.Shape();s.moveTo(-r*.025,-r*.14);s.lineTo(r*.025,-r*.14);s.lineTo(r*.014,r*.82);s.lineTo(0,r*.91);s.lineTo(-r*.014,r*.82);s.closePath();needle.add(new T.Mesh(new T.ShapeGeometry(s),new T.MeshBasicMaterial({color:0xff7537,toneMapped:false})));
  const pin=new T.Mesh(new T.CircleGeometry(r*.075,24),this.dark);pin.position.z=.009;root.add(pin);return{needle,max,value:0};
 }
 setMirror(tex:T.Texture){const m=this.mirror.material as T.MeshBasicMaterial;m.map=tex;m.color.set(0x84918c);m.needsUpdate=true;}
 update(speed:number,steer:number,time:number,bump:number,power:Powertrain,travel:number){
  this.steering.rotation.z=-steer*.78;this.root.position.y=Math.sin(time*19)*.00035*speed/90+bump*.004;this.root.position.z=power.acceleration*.0018+(power.shiftRemaining>0?Math.sin(power.shiftRemaining*17)*.0018:0);
  const values=[power.rpm/1000,speed,87+power.boost*5,.72];
  [...this.instruments,...this.auxiliary].forEach((g,i)=>{g.value=i<4?values[i]:i===4?power.boost*1.35:i===5?95+power.boost*13:2.1+power.rpm/2200;g.needle.rotation.z=(135-270*Math.max(0,Math.min(g.value/g.max,1.04)))*Math.PI/180;});
  this.ambient.intensity=.11+Math.pow(.5+.5*Math.cos(travel/42*Math.PI*2),12)*.06;
  const text=`${power.gear}|${Math.round(speed)}|${Math.floor(travel/100)}`;
  if(text!==this.lastDisplay){this.lastDisplay=text;const c=this.readout.getContext('2d')!;c.fillStyle='#030402';c.fillRect(0,0,128,128);c.fillStyle='#a17140';c.textAlign='center';c.font='24px monospace';c.fillText(power.automatic?'AUTO':'MAN',64,29);c.fillStyle='#eb9d58';c.font='78px monospace';c.fillText(String(power.gear),64,108);this.display.needsUpdate=true;}
 }
 diagnostics(){return{style:'physical-amber-analog',tachometer:this.instruments[0].value*1000,speedometer:this.instruments[1].value,auxiliary:this.auxiliary.map(g=>g.value)};}
}
