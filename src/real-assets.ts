import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {DRACOLoader} from 'three/addons/loaders/DRACOLoader.js';
import {ElevatedRoute} from './route';
const mod=(x:number,n:number)=>(x%n+n)%n;
export class RealDistrict {
 ready:Promise<void>;private blocks:{root:T.Group;x:number;base:number}[]=[];
 private lamps:T.InstancedMesh[]=[];private object=new T.Object3D();
 private blockTypes=0;private lampHeight=0;private triangles=0;private bounds:number[][]=[];
 constructor(private scene:T.Scene,private route:ElevatedRoute){this.ready=this.load();}
 private async load(){
  const draco=new DRACOLoader().setDecoderPath('./assets/draco/').setWorkerLimit(2);const loader=new GLTFLoader().setDRACOLoader(draco);
  try{
   const manifest=await(await fetch('./assets/tokyo/manifest.json')).json() as {file:string}[];
   for(let i=0;i<manifest.length;i++){
    const gltf=await loader.loadAsync('./assets/tokyo/'+manifest[i].file);const json=gltf.parser.json;
    const rtc=json.extensions?.CESIUM_RTC?.center as number[]|undefined;if(!rtc)throw Error('Missing city orientation');
    const lon=Math.atan2(rtc[1],rtc[0]),lat=Math.atan2(rtc[2],Math.hypot(rtc[0],rtc[1]));const sl=Math.sin(lon),cl=Math.cos(lon),sp=Math.sin(lat),cp=Math.cos(lat);
    const orientation=new T.Matrix4().set(-sl,0,-cl,0,cp*cl,sp,-cp*sl,0,sp*cl,-cp,-sp*sl,0,0,0,0,1);
    gltf.scene.updateMatrixWorld(true);const model=new T.Group();
    gltf.scene.traverse(o=>{if(!(o instanceof T.Mesh))return;const geo=o.geometry.clone().applyMatrix4(o.matrixWorld).applyMatrix4(orientation);
     const material=(Array.isArray(o.material)?o.material[0]:o.material).clone() as T.MeshStandardMaterial;
     material.roughness=.82;material.metalness=.03;material.envMapIntensity=.15;
     if(material.map){material.emissiveMap=material.map;material.emissive.set(0xa5b3c2);material.emissiveIntensity=.055;}
     model.add(new T.Mesh(geo,material));this.triangles+=(geo.index?.count||geo.attributes.position.count)/3;
    });
    const bounds=new T.Box3().setFromObject(model),size=bounds.getSize(new T.Vector3()),center=bounds.getCenter(new T.Vector3());this.bounds.push(size.toArray());
    for(const o of model.children){o.position.x-=center.x;o.position.z-=center.z;o.position.y-=bounds.min.y+14;}
    // Actual Tokyo geometry and aerial facade textures, rearranged into a fictional corridor.
    for(let j=0;j<3;j++){const root=model.clone(true),side=(i+j)%2?1:-1;this.scene.add(root);this.blocks.push({root,x:side*(116+(i%3)*19),base:i*185+j*510});}
    this.blockTypes++;
   }
  }catch(e){console.error('Real city assets failed',e);}
  try{
   const gltf=await loader.loadAsync('./assets/security-light/security_light_1k.gltf');gltf.scene.updateMatrixWorld(true);
   const bounds=new T.Box3().setFromObject(gltf.scene),size=bounds.getSize(new T.Vector3()),center=bounds.getCenter(new T.Vector3());this.lampHeight=size.y;const scale=1.1/Math.max(size.x,size.y,size.z);
   gltf.scene.traverse(o=>{if(!(o instanceof T.Mesh))return;const geo=o.geometry.clone().applyMatrix4(o.matrixWorld);geo.translate(-center.x,-center.y,-center.z);geo.scale(scale,scale,scale);geo.rotateY(Math.PI/2);geo.translate(-3.7,10.2,0);
    const material=(Array.isArray(o.material)?o.material[0]:o.material).clone() as T.MeshStandardMaterial;material.envMapIntensity=.3;const inst=new T.InstancedMesh(geo,material,80);inst.frustumCulled=false;this.scene.add(inst);this.lamps.push(inst);
   });
   const poleMat=new T.MeshStandardMaterial({color:0x78848d,roughness:.32,metalness:.75});
   const pole=new T.CylinderGeometry(.07,.15,10,16);pole.translate(0,5,0);
   const arm=new T.TubeGeometry(new T.CatmullRomCurve3([new T.Vector3(0,9.3,0),new T.Vector3(-.35,10.1,0),new T.Vector3(-1.4,10.4,0),new T.Vector3(-3.6,10.3,0)]),16,.06,8,false);
   for(const geo of [pole,arm]){const inst=new T.InstancedMesh(geo,poleMat,80);inst.frustumCulled=false;this.scene.add(inst);this.lamps.push(inst);}
  }catch(e){console.error('Street lamp assets failed',e);}draco.dispose();
 }
 update(travel:number){
  for(const b of this.blocks)this.route.place(b.root,b.x,0,150-mod(b.base-travel,1620));
  for(let i=0;i<80;i++){
   const side=i%2?1:-1,z=30-mod(Math.floor(i/2)*42-travel,1680);this.route.place(this.object,side*13.2,0,z,side<0?Math.PI:0);this.object.scale.set(1,1,1);this.object.updateMatrix();
   for(const inst of this.lamps)inst.setMatrixAt(i,this.object.matrix);
  }for(const inst of this.lamps)inst.instanceMatrix.needsUpdate=true;
 }
 diagnostics(){return{city:'PLATEAU Tokyo Chiyoda 2025 LOD2 textured',cityTypes:this.blockTypes,cityBlocks:this.blocks.length,sourceTriangles:this.triangles,cityBounds:this.bounds,realStreetLamps:this.lamps.length?80:0,sourceLampHeight:this.lampHeight};}
}
