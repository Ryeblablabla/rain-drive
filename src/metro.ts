import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
// Original modern metro carriage. Shared materials and baked batches keep the
// bogies, doors and cabin detail cheap enough to render in the road reflection.
export function metroCar(front=false){
 const root=new T.Group();const steel=new T.MeshStandardMaterial({color:0x929c9f,metalness:.72,roughness:.29}),dark=new T.MeshStandardMaterial({color:0x121b20,roughness:.55,metalness:.4}),stripe=new T.MeshStandardMaterial({color:0x198577,metalness:.35,roughness:.25}),glass=new T.MeshStandardMaterial({color:0x273b42,emissive:0xa9bbab,emissiveIntensity:.40,roughness:.13,metalness:.2});
 const body=new T.Mesh(new RoundedBoxGeometry(3.05,2.7,15.3,3,.22),steel);body.position.y=1.9;root.add(body);
 const box=(w:number,h:number,d:number,x:number,y:number,z:number,m:T.Material)=>{const o=new T.Mesh(new T.BoxGeometry(w,h,d),m);o.position.set(x,y,z);root.add(o);return o;};
 box(2.8,.45,14.4,0,.5,0,dark);box(2.6,.14,14.6,0,3.27,0,steel);
 for(const side of [-1,1]){
  box(.025,.23,15.0,side*1.535,1.1,0,stripe);
  for(const z of [-5.9,-1.95,1.95,5.9]){
   box(.05,2.15,1.25,side*1.54,1.84,z,steel);
   for(const dz of [-.31,.31]){box(.06,.91,.48,side*1.57,2.12,z+dz,glass);box(.07,1.97,.018,side*1.57,1.82,z+dz*.05,dark);}
   box(.06,.06,1.30,side*1.58,2.93,z,dark);
  }
  for(const z of [-3.95,0,3.95]){box(.045,1.03,2.25,side*1.55,2.15,z,glass);for(const dz of [-1.15,1.15])box(.06,1.11,.04,side*1.57,2.15,z+dz,steel);}
  for(const z of [-4.9,4.9])for(const dz of [-.6,.6]){
   const wheel=new T.Mesh(new T.CylinderGeometry(.32,.32,.22,16),dark);wheel.rotation.z=Math.PI/2;wheel.position.set(side*1.1,.32,z+dz);root.add(wheel);
  }
 }
 for(const z of [-4.9,4.9]){box(2.2,.42,2.0,0,.43,z,dark);box(1.4,.3,2.2,0,3.47,z,steel);}
 box(.6,.32,.8,0,.65,7.95,dark);box(.6,.32,.8,0,.65,-7.95,dark);
 if(front){box(2.5,1.1,.05,0,2.35,-7.68,dark);for(const x of [-.85,.85])box(.36,.15,.04,x,1.2,-7.72,new T.MeshStandardMaterial({emissive:0xffefcc,emissiveIntensity:3,color:0xffffff}));}
 root.updateMatrixWorld(true);const batches=new Map<T.Material,T.BufferGeometry[]>();
 root.traverse(o=>{if(!(o instanceof T.Mesh))return;const m=o.material as T.Material,g=o.geometry.clone().applyMatrix4(o.matrixWorld);if(!batches.has(m))batches.set(m,[]);batches.get(m)!.push(g.index?g.toNonIndexed():g);});
 root.clear();for(const [m,gs]of batches){const g=mergeGeometries(gs,false);if(g)root.add(new T.Mesh(g,m));for(const s of gs)s.dispose();}return root;
}
