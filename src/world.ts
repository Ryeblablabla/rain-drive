import * as T from 'three';
import {metroCar} from './metro';
import {ElevatedRoute} from './route';
import {RealDistrict} from './real-assets';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

export type TrafficCar={root:T.Group;x:number;z:number;speed:number;direction:number;truck:boolean;brake:boolean;tail:T.MeshStandardMaterial;seed:number;active:boolean};
const BOX=new T.BoxGeometry(1,1,1);
const mat=(color:number,roughness=.5,metalness=.1)=>new T.MeshStandardMaterial({color,roughness,metalness});
const mod=(x:number,n:number)=>((x%n)+n)%n;
let seed=817;
function rand(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;}
export function box(parent:T.Object3D,w:number,h:number,d:number,x:number,y:number,z:number,m:T.Material){const a=new T.Mesh(BOX,m);a.scale.set(w,h,d);a.position.set(x,y,z);parent.add(a);return a;}
export function labelTexture(lines:string[],bg:string,fg='#e4f4ed',width=1024,height=384){
  const c=document.createElement('canvas');c.width=width;c.height=height;const x=c.getContext('2d')!;
  x.fillStyle=bg;x.fillRect(0,0,width,height);x.strokeStyle=fg;x.lineWidth=8;x.strokeRect(12,12,width-24,height-24);
  x.textAlign='center';x.textBaseline='middle';
  lines.forEach((s,i)=>{x.font=`${i===0?'500':'400'} ${i===0?76:43}px "Microsoft YaHei","Segoe UI",sans-serif`;x.fillStyle=fg;x.fillText(s,width/2,height*(i+1)/(lines.length+1));});
  const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;return t;
}
export class HighwayWorld{
  route=new ElevatedRoute();district!:RealDistrict;
  scene=new T.Scene();camera=new T.PerspectiveCamera(58,16/9,.08,1550);
  road:Reflector;traffic:TrafficCar[]=[];travel=0;bumps=0;nearPasses=0;
  private moving:{root:T.Object3D;base:number;period:number}[]=[];
  private roadMaterial:T.ShaderMaterial;
  private lampPoles:T.InstancedMesh;private lampArms:T.InstancedMesh;private lampHeads:T.InstancedMesh;private reflectors:T.InstancedMesh;
  private rain:T.LineSegments;private railPosts:T.InstancedMesh;private buildingMesh:T.InstancedMesh;
  private buildings:{x:number;y:number;base:number;w:number;h:number;d:number}[]=[];
  private initialTraffic:{z:number;speed:number}[]=[];
  private obj=new T.Object3D();private glows:{sprite:T.Sprite;side:number;base:number}[]=[];
  private headLights:T.SpotLight[]=[];private lastBump=-1;private previousPassed=new Set<TrafficCar>();
  private streetLights:T.PointLight[]=[];private importedCars=0;
  ready:Promise<void>;
  constructor(renderer:T.WebGLRenderer){
    this.scene.background=new T.Color(0x070b10);this.scene.fog=new T.FogExp2(0x111820,.0034);
    const sky=new T.Mesh(new T.SphereGeometry(1400,32,16),new T.ShaderMaterial({side:T.BackSide,depthWrite:false,uniforms:{},vertexShader:`varying vec3 vDirection;void main(){vDirection=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`varying vec3 vDirection;float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);}void main(){vec3 d=normalize(vDirection);vec2 p=d.xz/max(.15,d.y+.25)*3.;float cloud=noise(p)*.55+noise(p*2.)*.26+noise(p*4.)*.13+noise(p*8.)*.06;vec3 col=mix(vec3(.010,.014,.019),vec3(.002,.004,.008),smoothstep(0.,.75,d.y));col+=vec3(.007,.009,.012)*smoothstep(.35,.75,cloud);gl_FragColor=vec4(col,1.);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>}`}));sky.frustumCulled=false;this.scene.add(sky);
    this.scene.add(new T.HemisphereLight(0xa4adb9,0x17151a,.25));
    const moon=new T.DirectionalLight(0x9ca9b5,.24);moon.position.set(-20,50,-70);this.scene.add(moon);
    for(let i=0;i<6;i++){const lamp=new T.PointLight(i%2?0xffd3a0:0xffe3bf,145,33,2);this.streetLights.push(lamp);this.scene.add(lamp);}
    this.camera.position.set(5.4,1.65,4);
    const loader=new T.TextureLoader();
    const asphalt=loader.load('./assets/asphalt-diffuse.jpg');asphalt.wrapS=asphalt.wrapT=T.RepeatWrapping;asphalt.colorSpace=T.SRGBColorSpace;asphalt.anisotropy=8;
    const normal=loader.load('./assets/asphalt-normal.jpg');normal.wrapS=normal.wrapT=T.RepeatWrapping;normal.anisotropy=8;
    const roadShader={name:'WetAsphalt',uniforms:{color:{value:new T.Color(0x889999)},tDiffuse:{value:null},textureMatrix:{value:new T.Matrix4()},uAsphalt:{value:asphalt},uNormal:{value:normal},uTravel:{value:0},uTime:{value:0},uPlayerX:{value:5.4},uWet:{value:.65}},
    vertexShader:`uniform mat4 textureMatrix;varying vec4 vMirror;varying vec3 vWorld;varying vec2 vRoad;void main(){vRoad=vec2((uv.x-.5)*27.,130.-uv.y*1800.);vMirror=textureMatrix*vec4(position,1.);vWorld=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`uniform sampler2D tDiffuse,uAsphalt,uNormal;uniform float uTravel,uTime,uPlayerX,uWet;varying vec4 vMirror;varying vec3 vWorld;varying vec2 vRoad;
    float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    void main(){
      vec2 uv=vec2(vRoad.x*.22,(vRoad.y-uTravel)*.22);vec3 albedo=texture2D(uAsphalt,uv).rgb;
      vec2 n=texture2D(uNormal,uv).rg-.5;
      vec2 ripple=vec2(sin(vWorld.z*7.+uTime*4.),cos(vWorld.x*11.-uTime*3.))*.00013*uWet;
      vec2 proj=vMirror.xy/vMirror.w+n*.0025+ripple;
      vec3 reflected=texture2D(tDiffuse,proj).rgb*.45;
      reflected+=texture2D(tDiffuse,proj+vec2(.0008,.003)).rgb*.25;
      reflected+=texture2D(tDiffuse,proj-vec2(.0008,.003)).rgb*.25;
      reflected+=texture2D(tDiffuse,proj+vec2(0.,.007)).rgb*.05;
      float puddle=texture2D(uAsphalt,uv*.13).r;
      float fresnel=pow(1.-max(dot(vec3(0.,1.,0.),normalize(cameraPosition-vWorld)),0.),3.);
      float wet=mix(.14,.57,smoothstep(.05,.28,puddle))*mix(.5,1.,uWet)*(.5+fresnel*.8);
      float dist=length(vWorld.xz-cameraPosition.xz);float fog=1.-exp(-dist*dist*.00001156);
      float beam=exp(-pow(abs(vRoad.x-uPlayerX)/max(1.7,(-vRoad.y+6.)*.13),4.))*exp(-abs(vRoad.y+16.)*.014)*step(vRoad.y,3.);
      float stripe=0.;for(int i=1;i<4;i++){float lane=float(i)*3.6;stripe+=1.-smoothstep(.055,.095,abs(abs(vRoad.x)-lane));}
      stripe*=step(mod(vRoad.y-uTravel,10.),3.5);
      float edge=1.-smoothstep(.065,.11,abs(abs(vRoad.x)-11.7));
      float center=1.-smoothstep(.045,.08,abs(abs(vRoad.x)-.20));
      float lampZ=mod(vRoad.y-uTravel-30.+21.,42.)-21.;
      float pool=exp(-lampZ*lampZ/110.)*(exp(-pow((vRoad.x-8.)/6.,2.))+exp(-pow((vRoad.x+8.)/6.,2.)));
      vec3 diffuse=albedo*(vec3(.070,.080,.092)+vec3(.40,.31,.20)*pool+vec3(.50,.52,.50)*beam);
      diffuse+=vec3(.50,.53,.49)*(stripe+edge)*(.18+beam*.65+pool*.28);
      diffuse+=vec3(.52,.35,.12)*center;
      float joint=1.-smoothstep(.015,.055,abs(mod(vRoad.y-uTravel+17.,34.)-17.));
      diffuse*=1.-joint*.65;
      vec3 col=diffuse+reflected*wet;
      col+=vec3(.032,.046,.052)*beam;
      col=mix(col,vec3(.022,.031,.042),fog);
      gl_FragColor=vec4(col,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`};
    this.road=new Reflector(new T.PlaneGeometry(27,1800),{textureWidth:1280,textureHeight:720,clipBias:.003,shader:roadShader,multisample:0});
    this.road.rotation.x=-Math.PI/2;this.road.position.set(0,-.012,-770);this.scene.add(this.road);
    this.roadMaterial=this.road.material as T.ShaderMaterial;
    const concrete=mat(0x26343d,.88),steel=mat(0x6d8087,.25,.8);
    for(const x of [-13.5,13.5]){
      box(this.scene,.65,.95,1800,x,.25,-770,concrete);box(this.scene,.25,.08,1800,x,1,-770,steel);
      box(this.scene,.12,.12,1800,x,1.23,-770,steel);
    }
    box(this.scene,.6,.68,1800,0,.25,-770,concrete);box(this.scene,.15,.1,1800,0,.68,-770,steel);
    this.railPosts=new T.InstancedMesh(BOX,steel,460);this.scene.add(this.railPosts);
    for(let i=0;i<460;i++){this.obj.position.set(i%2?-13.5:13.5,.9,-Math.floor(i/2)*7);this.obj.scale.set(.1,.7,.1);this.obj.updateMatrix();this.railPosts.setMatrixAt(i,this.obj.matrix);}
    const lamp=mat(0x42535e,.28,.7),glowMat=new T.MeshBasicMaterial({color:0xffe1aa});
    this.lampPoles=new T.InstancedMesh(BOX,lamp,80);this.lampArms=new T.InstancedMesh(BOX,lamp,80);this.lampHeads=new T.InstancedMesh(BOX,glowMat,80);
    this.scene.add(this.lampPoles,this.lampArms,this.lampHeads);
    this.reflectors=new T.InstancedMesh(BOX,new T.MeshBasicMaterial({color:0xe6b877}),160);this.scene.add(this.reflectors);
    const glowCanvas=document.createElement('canvas');glowCanvas.width=glowCanvas.height=128;const gc=glowCanvas.getContext('2d')!,g=gc.createRadialGradient(64,64,0,64,64,64);g.addColorStop(0,'rgba(255,235,190,.9)');g.addColorStop(.08,'rgba(255,221,170,.5)');g.addColorStop(.3,'rgba(255,211,140,.09)');g.addColorStop(1,'rgba(255,210,150,0)');gc.fillStyle=g;gc.fillRect(0,0,128,128);const glowTex=new T.CanvasTexture(glowCanvas);
    for(let i=0;i<48;i++){const s=new T.Sprite(new T.SpriteMaterial({map:glowTex,transparent:true,opacity:.65,depthWrite:false,blending:T.AdditiveBlending}));s.scale.set(4.5,4.5,1);this.scene.add(s);this.glows.push({sprite:s,side:i%2?1:-1,base:Math.floor(i/2)*42});}
    // Distant architecture: instancing keeps hundreds of windowed buildings inexpensive.
    const buildings=new T.ShaderMaterial({uniforms:{uFog:{value:new T.Color(0x111820)}},vertexShader:`varying vec3 vWorld;varying vec3 vLocal;varying vec3 vNormal;void main(){vLocal=mat3(instanceMatrix)*position;vec4 p=instanceMatrix*vec4(position,1.);vWorld=(modelMatrix*p).xyz;vNormal=normalize(mat3(instanceMatrix)*normal);gl_Position=projectionMatrix*modelViewMatrix*modelMatrix*p;}`,
    fragmentShader:`varying vec3 vWorld;varying vec3 vLocal;varying vec3 vNormal;uniform vec3 uFog;
    float hash(vec2 p){return fract(sin(dot(p,vec2(12.71,31.17)))*43758.5);}
    void main(){
      vec2 uv=abs(vNormal.z)>.5?vLocal.xy:vLocal.zy;
      float id=floor((vWorld.x-vLocal.x)*.37);float style=hash(vec2(id,4.));
      vec2 grid=uv/vec2(style>.6?1.7:2.6,style<.3?2.8:3.4)+vec2(id,0.);vec2 f=fract(grid);
      float occupancy=hash(floor(grid)+vec2(id,0.));float floorOn=step(.88,hash(vec2(id,floor(grid.y))));
      float lit=max(step(.77,occupancy),floorOn*.85);
      float pane=step(.10,f.x)*step(f.x,.88)*step(.13,f.y)*step(f.y,.82);
      float frame=(1.-smoothstep(.015,.035,min(f.x,1.-f.x)))+(1.-smoothstep(.016,.035,min(f.y,1.-f.y)));
      float blind=style<.35?step(.28,fract(f.y*13.))*.18:0.;
      vec3 warm=mix(vec3(.24,.30,.34),vec3(.66,.40,.19),hash(floor(grid)+7.));
      vec3 col=mix(vec3(.007,.009,.012),vec3(.014,.021,.028),pane);
      col+=vec3(.012,.014,.016)*frame;col+=warm*pane*lit*(.5+occupancy*.35)*(1.-blind);
      float band=1.-smoothstep(.025,.08,abs(fract(grid.y*.25)-.03));col+=vec3(.007,.009,.012)*band;
      if(abs(vNormal.y)>.5)col=vec3(.005,.007,.009);
      float fog=1.-exp(-pow(length(vWorld.xz-cameraPosition.xz)*.0034,2.));gl_FragColor=vec4(mix(col,uFog,fog),1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`});
    this.buildingMesh=new T.InstancedMesh(BOX,buildings,190);this.scene.add(this.buildingMesh);
    for(let i=0;i<190;i++){
      const side=i%2?1:-1,w=10+rand()*24,h=15+rand()*80,d=12+rand()*18;
      const x=side*(i<70?190+rand()*100:260+rand()*270),y=h/2-12,base=rand()*1400;
      this.buildings.push({x,y,base,w,h,d});
      this.obj.position.set(x,y,-base);this.obj.scale.set(w,h,d);this.obj.updateMatrix();this.buildingMesh.setMatrixAt(i,this.obj.matrix);
    }
    // A parallel, raised metro line with a recurring illuminated train.
    for(const x of [23,28])box(this.scene,.12,.15,1600,x,4.25,-700,steel);
    box(this.scene,7,.8,1600,25.5,3.5,-700,concrete);
    for(let j=0;j<5;j++){const train=metroCar(j===0);this.scene.add(train);this.moving.push({root:train,base:400+j*16,period:1900});train.userData.train=true;}
    // Repeating overhead gantries and bilingual route signs.
    const signTex=labelTexture(['沿江高架    ↑    城市中心','RIVERSIDE EXPWY     CITY CENTER'], '#14564d');
    const signMat=new T.MeshStandardMaterial({map:signTex,emissiveMap:signTex,emissive:0xffffff,emissiveIntensity:.38,roughness:.55});
    for(let i=0;i<5;i++){
      const gantry=new T.Group();for(const x of [-13,13])box(gantry,.32,8.5,.32,x,4,0,steel);box(gantry,26,.36,.36,0,8,0,steel);
      box(gantry,8.3,2.1,.12,5.7,6.6,0,signMat);box(gantry,3,1.9,.12,-6,6.8,0,new T.MeshStandardMaterial({map:labelTexture(['S26','沿江高架'],'#153d52'),emissive:0x1c383b,emissiveIntensity:.4}));
      this.scene.add(gantry);this.moving.push({root:gantry,base:i*280+135,period:1400});
    }
    const colors=[0x8996a1,0x202832,0xb3bdc1,0x612e33,0x1d3d4e,0xc2b9a7];
    for(let i=0;i<30;i++){
      const direction=i<16?1:-1,lane=(i%3)*3.6+1.8,x=lane*direction,truck=i%7===0;
      const car=this.makeCar(colors[i%colors.length],truck,direction);
      const z=i<16?-38-Math.floor(i/3)*57-(i%3)*19:-25-Math.floor((i-16)/3)*76;
      car.root.position.set(x,0,z);this.scene.add(car.root);
      this.traffic.push({...car,x,z,speed:direction>0?14+rand()*9:17+rand()*8,direction,truck,brake:false,seed:rand()*20,active:true});
      this.initialTraffic.push({z,speed:this.traffic[i].speed});
    }
    // World-space streaks are separate from water sitting on the windscreen.
    const count=3200,pos=new Float32Array(count*6),ids=new Float32Array(count*2),tails=new Float32Array(count*2);
    for(let i=0;i<count;i++){const x=(rand()-.5)*75,y=rand()*32,z=rand()*120,dropSeed=rand();for(let j=0;j<2;j++){pos.set([x,y,z],i*6+j*3);ids[i*2+j]=dropSeed;tails[i*2+j]=j;}}
    const geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(pos,3));geo.setAttribute('aSeed',new T.BufferAttribute(ids,1));geo.setAttribute('aTail',new T.BufferAttribute(tails,1));
    const rainMat=new T.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{uTime:{value:0},uSpeed:{value:0},uRain:{value:.65}},vertexShader:`uniform float uTime,uSpeed;attribute float aSeed,aTail;varying float vAlpha;void main(){vec3 p=position;p.y=mod(p.y-uTime*21.,32.)-aTail*.20;p.z=-mod(p.z-uTime*6.-uSpeed,120.);p.x+=sin(aSeed*6.+uTime*.05)*1.5+aTail*.025;vAlpha=.15*exp(p.z*.022);gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,fragmentShader:`uniform float uRain;varying float vAlpha;void main(){gl_FragColor=vec4(.56,.72,.79,vAlpha*uRain);}`});
    this.rain=new T.LineSegments(geo,rainMat);this.rain.frustumCulled=false;this.scene.add(this.rain);
    for(const side of [-1,1]){
      const light=new T.SpotLight(0xe5eddd,38,120,.29,.6,1.5);light.position.set(5.4+side*.65,.75,1.5);light.target.position.set(5.4+side*1.5,0,-65);this.scene.add(light,light.target);this.headLights.push(light);
    }
    // Modelled bonnet, seen beyond the windscreen.
    const bonnet=new T.Mesh(new RoundedBoxGeometry(1.84,.15,2.2,2,.12),new T.MeshPhysicalMaterial({color:0x132b3c,metalness:.48,roughness:.26,clearcoat:1,envMapIntensity:.08}));bonnet.position.set(5.4,.84,1.2);this.scene.add(bonnet);bonnet.userData.bonnet=true;
    const environmentReady=new Promise<void>(resolve=>{
      new RGBELoader().load('./assets/shanghai-bund.hdr',tex=>{
        tex.mapping=T.EquirectangularReflectionMapping;const pmrem=new T.PMREMGenerator(renderer);this.scene.environment=pmrem.fromEquirectangular(tex).texture;this.scene.environmentIntensity=.16;tex.dispose();pmrem.dispose();resolve();
      },undefined,()=>resolve());
    });
    // Bend actual deck, barriers and railway meshes, including the elevated cross route.
    this.route.road(this.road);
    for(const mesh of [...this.scene.children])if(mesh instanceof T.Mesh&&mesh!==this.road&&mesh.geometry===BOX&&mesh.scale.z>500)this.route.bendBox(mesh);
    const upper=new T.Group();this.scene.add(upper);
    for(const [x,y,w,h]of [[-49,11,10,.9],[-54,11.7,.4,.85],[-44,11.7,.4,.85],[-54,12.2,.16,.10],[-44,12.2,.16,.10]]){
      const mesh=box(this.scene,w,h,1800,x,y,-770,concrete);this.route.bendBox(mesh,true);
    }
    for(let i=0;i<35;i++){const support=box(this.scene,1.8,30,2.8,0,0,0,concrete);support.userData.bridgeSupport=i;}
    this.district=new RealDistrict(this.scene,this.route);
    this.ready=Promise.all([environmentReady,this.loadTrafficModel(),this.loadTruckModel(),this.district.ready]).then(()=>{if(this.district.diagnostics().realStreetLamps){this.lampPoles.visible=false;this.lampArms.visible=false;}});
  }
  private async loadTrafficModel(){
    // Car Concept, Eric Chadwick / DGG, CC BY 4.0. Flatten and merge by material
    // so a detailed external model does not require a draw call for every part.
    try{
      const gltf=await new GLTFLoader().loadAsync('./assets/concept-car.glb');gltf.scene.updateMatrixWorld(true);
      const batches=new Map<T.Material,T.BufferGeometry[]>();
      gltf.scene.traverse(o=>{if(!(o instanceof T.Mesh)||/Interior|Engine|Underside|HoodUnder|HoodInterior|Wipers/.test(o.name))return;
        const m=(Array.isArray(o.material)?o.material[0]:o.material).clone() as T.MeshPhysicalMaterial;
        // Reuse cloned material by source identity and avoid extra transmission passes.
        const source=Array.isArray(o.material)?o.material[0]:o.material;let key=[...batches.keys()].find(k=>k.userData.source===source.uuid);
        if(!key){m.userData.source=source.uuid;if('transmission'in m)m.transmission=0;
          if(/Glass/i.test(m.name)){m.color.set(0x0b1017);m.roughness=.16;m.metalness=.5;}
          if('emissiveIntensity'in m)m.emissiveIntensity=Math.min(m.emissiveIntensity,3);key=m;batches.set(key,[]);
        }else m.dispose();
        const geo=o.geometry.clone().applyMatrix4(o.matrixWorld);for(const name of Object.keys(geo.attributes))if(!['position','normal','uv'].includes(name))geo.deleteAttribute(name);
        if(!geo.attributes.uv)geo.setAttribute('uv',new T.BufferAttribute(new Float32Array(geo.attributes.position.count*2),2));
        const flat=geo.index?geo.toNonIndexed():geo;flat.clearGroups();batches.get(key)!.push(flat);
      });
      const template=new T.Group();for(const [material,geometries] of batches){const merged=mergeGeometries(geometries,false);if(merged)template.add(new T.Mesh(merged,material));for(const g of geometries)g.dispose();}
      // +Z is forward in this asset; traffic drives toward -Z in our coordinate system.
      template.rotation.y=Math.PI;template.scale.setScalar(.88);template.position.y=.01;
      for(const i of this.traffic.map((_,i)=>i).filter(i=>!this.traffic[i].truck)){const car=this.traffic[i];car.root.clear();const model=template.clone(true);model.scale.setScalar(.88*(.93+(i%4)*.055));car.root.add(model);
        const tail=new T.MeshStandardMaterial({color:0xb31208,emissive:0xff1507,emissiveIntensity:3});car.tail=tail;
        for(const side of [-1,1])box(car.root,.36,.045,.02,side*.39,.86,1.44,tail);
        this.importedCars++;
      }
    }catch(error){console.warn('Detailed traffic asset unavailable; using built-in vehicles.',error);}
  }
  private async loadTruckModel(){
    try{const gltf=await new GLTFLoader().loadAsync('./assets/milk-truck.glb');const bounds=new T.Box3().setFromObject(gltf.scene),size=bounds.getSize(new T.Vector3()),center=bounds.getCenter(new T.Vector3());const scale=2.35/size.x;
      const template=new T.Group();gltf.scene.position.set(-center.x,-bounds.min.y,-center.z);template.add(gltf.scene);template.scale.setScalar(scale);template.rotation.y=Math.PI;
      for(const c of this.traffic.filter(c=>c.truck)){c.root.clear();c.root.add(template.clone(true));for(const side of [-1,1])box(c.root,.30,.13,.03,side*.86,.8,3.3,c.tail);}
    }catch(e){console.error('Truck model failed',e);}
  }
  private makeCar(color:number,truck:boolean,direction:number){
    const root=new T.Group(),paint=new T.MeshPhysicalMaterial({color,metalness:.55,roughness:.24,clearcoat:1,clearcoatRoughness:.1}),glass=new T.MeshPhysicalMaterial({color:0x152c39,metalness:.4,roughness:.09,clearcoat:1});
    const tail=new T.MeshStandardMaterial({color:0x9e1012,emissive:0xff1607,emissiveIntensity:3,roughness:.3});
    const head=new T.MeshStandardMaterial({color:0xdae8df,emissive:0xfff2d9,emissiveIntensity:5});
    const rubber=mat(0x090e13,.9),chrome=mat(0x606f77,.2,.85);
    const body=new T.Mesh(new RoundedBoxGeometry(truck?2.35:1.85,truck?.8:.5,truck?6.6:4.3,2,.16),paint);body.position.y=.7;root.add(body);
    if(truck){box(root,2.4,2.8,6.4,0,2.2,.85,mat(0x748087,.7,.3));box(root,2.2,1.7,1.9,0,1.5,-3,paint);box(root,2.05,.85,.03,0,1.97,-3.97,glass);for(let i=0;i<5;i++)box(root,2.44,.025,6.3,0,1.1+i*.5,.85,chrome);}
    else{
      const cabinGeometry=new T.BoxGeometry(1,1,1),p=cabinGeometry.attributes.position;
      for(let i=0;i<p.count;i++){const top=p.getY(i)>0;p.setXYZ(i,Math.sign(p.getX(i))*(top?.65:.81),top?1.56:1.00,Math.sign(p.getZ(i))*(top?.73:1.37)+.06);}cabinGeometry.computeVertexNormals();
      const cabin=new T.Mesh(cabinGeometry,glass);root.add(cabin);
      box(root,1.32,.055,1.49,0,1.58,.06,paint);box(root,.055,.56,.065,-.72,1.27,.3,paint);box(root,.055,.56,.065,.72,1.27,.3,paint);
      box(root,1.75,.1,.1,0,.65,2.12,chrome);box(root,1.75,.1,.1,0,.65,-2.12,chrome);
    }
    const l=truck?4.05:2.14;
    for(const side of [-1,1]){
      box(root,truck?.30:.53,.13,.045,side*(truck?.86:.57),truck?.8:.87,truck?4.08:l,tail);
      box(root,.50,.12,.05,side*(truck?.77:.58),truck?.85:.85,-l,head);
      const wheelgeo=new T.CylinderGeometry(truck?.43:.33,truck?.43:.33,.23,14);wheelgeo.rotateZ(Math.PI/2);
      for(const z of truck?[-2.7,1.7,2.8]:[-1.32,1.34]){const wheel=new T.Mesh(wheelgeo,rubber);wheel.position.set(side*(truck?1.16:.90),.35,z);root.add(wheel);const hub=new T.Mesh(new T.CylinderGeometry(.19,.19,.24,10),chrome);hub.rotation.z=Math.PI/2;hub.position.copy(wheel.position);root.add(hub);}
      if(!truck)box(root,.2,.15,.27,side*1.04,1.13,-.65,paint);
    }
    box(root,.5,.16,.025,0,.57,truck?4.09:l+.03,new T.MeshStandardMaterial({map:labelTexture(['沪 A·'+Math.floor(10000+rand()*89999)],'#31587b','#d5e7e6',512,128)}));
    if(direction<0)root.rotation.y=Math.PI;
    return {root,tail};
  }
  update(dt:number,speed:number,playerX:number,time:number,rainAmount:number){
    const delta=speed/3.6*dt;this.travel+=delta;this.route.setDistance(this.travel);this.route.update();
    this.railPosts.position.z=0;
    for(let i=0;i<460;i++){this.route.place(this.obj,i%2?-13.5:13.5,.9,30-mod(Math.floor(i/2)*7-this.travel,1610));this.obj.scale.set(.1,.7,.1);this.obj.updateMatrix();this.railPosts.setMatrixAt(i,this.obj.matrix);}this.railPosts.instanceMatrix.needsUpdate=true;
    this.scene.children.filter(o=>o.userData.bridgeSupport!==undefined).forEach(o=>{const z=100-mod(o.userData.bridgeSupport*56-this.travel,1960),s=this.travel-z;this.route.place(o,Math.min(-18,-49+Math.sin(s/310+1.2)*42),-4+Math.sin(s/500)*2.5,z);});
    this.district.update(this.travel);
    for(let i=0;i<this.buildings.length;i++){
      const b=this.buildings[i];this.route.place(this.obj,b.x,b.y,120-mod(b.base+120-this.travel,1600));this.obj.scale.set(b.w,b.h,b.d);this.obj.updateMatrix();this.buildingMesh.setMatrixAt(i,this.obj.matrix);
    }
    this.buildingMesh.instanceMatrix.needsUpdate=true;
    this.roadMaterial.uniforms.uTravel.value=this.travel;this.roadMaterial.uniforms.uTime.value=time;this.roadMaterial.uniforms.uPlayerX.value=playerX;this.roadMaterial.uniforms.uWet.value=rainAmount;
    const rm=this.rain.material as T.ShaderMaterial;rm.uniforms.uTime.value=time;rm.uniforms.uSpeed.value=speed/3.6;rm.uniforms.uRain.value=rainAmount;this.rain.position.x=playerX;
    for(let i=0;i<80;i++){
      const side=i%2?1:-1,z=30-mod(Math.floor(i/2)*42-this.travel,1680);
      this.route.place(this.obj,side*13.2,5.2,z);this.obj.scale.set(.15,10.4,.15);this.obj.updateMatrix();this.lampPoles.setMatrixAt(i,this.obj.matrix);
      this.route.place(this.obj,side*11.3,10.35,z);this.obj.scale.set(3.9,.13,.13);this.obj.updateMatrix();this.lampArms.setMatrixAt(i,this.obj.matrix);
      this.route.place(this.obj,side*9.5,10.27,z);this.obj.scale.set(1.0,.09,.46);this.obj.updateMatrix();this.lampHeads.setMatrixAt(i,this.obj.matrix);
    }
    this.lampPoles.instanceMatrix.needsUpdate=this.lampArms.instanceMatrix.needsUpdate=this.lampHeads.instanceMatrix.needsUpdate=true;
    for(const glow of this.glows)this.route.point(glow.side*9.5,10.18,30-mod(glow.base-this.travel,1008),glow.sprite.position);
    for(let i=0;i<this.streetLights.length;i++)this.route.point(i%2?9.5:-9.5,9.9,30-mod(Math.floor(i/2)*42-this.travel,126),this.streetLights[i].position);
    for(let i=0;i<160;i++){this.route.place(this.obj,i%2?-13.12:13.12,.72,20-mod(Math.floor(i/2)*18-this.travel,1440));this.obj.scale.set(.06,.10,.17);this.obj.updateMatrix();this.reflectors.setMatrixAt(i,this.obj.matrix);}this.reflectors.instanceMatrix.needsUpdate=true;
    for(const {root,base,period} of this.moving)this.route.place(root,root.userData.train?25.5:0,root.userData.train?4:0,60-mod(base-this.travel*(root.userData.train?.25:1),period),0,!!root.userData.train);
    for(const car of this.traffic){
      if(!car.active)continue;
      let targetSpeed=car.direction>0?17+Math.sin(time*.13+car.seed)*3:21;
      if(car.truck)targetSpeed-=3;
      if(car.direction>0){
        let gap=1000;
        for(const other of this.traffic)if(other.active&&other!==car&&other.direction>0&&Math.abs(other.x-car.x)<1&&other.z<car.z)gap=Math.min(gap,car.z-other.z-(other.truck?8:4.5));
        if(Math.abs(playerX-car.x)<1.7&&car.z>5)gap=Math.min(gap,car.z-9);
        if(gap<28)targetSpeed=Math.max(1,targetSpeed*(gap-6)/22);
      }
      car.brake=targetSpeed<car.speed-1;car.speed+=(targetSpeed-car.speed)*Math.min(1,dt*.9);
      car.z+=delta-car.speed*car.direction*dt;
      if(car.z>70){car.z=-800-rand()*220;this.previousPassed.delete(car);}
      if(car.z< -1150){car.z=60+rand()*100;this.previousPassed.delete(car);}
      this.route.place(car.root,car.x,Math.sin(time*1.7+car.seed)*.009,car.z,car.direction<0?Math.PI:0,true);car.tail.emissiveIntensity=car.brake?6:2.8;
      if(Math.abs(car.z)<12&&!this.previousPassed.has(car)){this.nearPasses++;this.previousPassed.add(car);}
    }
    for(let i=0;i<2;i++){const side=i?1:-1;this.route.point(playerX+side*.65,.75,1.5,this.headLights[i].position);this.route.point(playerX+side*1.8,0,-65,this.headLights[i].target.position);}
    const bonnet=this.scene.children.find(o=>o.userData.bonnet);if(bonnet)this.route.place(bonnet,playerX,.84,1.2,0,true);this.route.place(this.rain,playerX,0,0);
    const seam=Math.floor((this.travel-4)/34);if(seam!==this.lastBump&&speed>8){this.bumps++;this.lastBump=seam;return true;}return false;
  }
  reset(){this.travel=0;this.bumps=0;this.nearPasses=0;this.lastBump=-1;this.previousPassed.clear();this.traffic.forEach((c,i)=>{c.z=this.initialTraffic[i].z;c.speed=this.initialTraffic[i].speed;c.brake=false;c.root.position.set(c.x,0,c.z);});}
  setTraffic(mode:string){this.traffic.forEach((c,i)=>{c.active=mode!=='off'&&(mode!=='light'||i%3===1);c.root.visible=c.active;});}
  diagnostics(){const a=new T.Matrix4();this.buildingMesh.getMatrixAt(0,a);return{route:this.route.diagnostics(),assets:this.district.diagnostics(),importedCars:this.importedCars,streetLights:this.streetLights.length,firstBuildingZ:a.elements[14],railPostOffset:this.railPosts.position.z,trainZ:this.moving.find(m=>m.root.userData.train)?.root.position.z,reflectionSize:{width:this.road.getRenderTarget().width,height:this.road.getRenderTarget().height}};}
  setQuality(q:string){const size=q==='high'?[1280,720]:q==='medium'?[960,540]:[640,360];this.road.getRenderTarget().setSize(size[0],size[1]);this.rain.geometry.setDrawRange(0,q==='low'?2200:6400);}
}
