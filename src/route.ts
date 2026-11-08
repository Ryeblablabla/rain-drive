import * as T from 'three';

// Integrated by distance: driving speed is independent of curvature. Positions
// are relative to the current distance to avoid floating point drift on long drives.
export class ElevatedRoute {
 private points:T.Vector3[]=[new T.Vector3()];private start=-4096;private step=2;
 private sections:{mesh:T.Mesh;source:Float32Array;plane:boolean;branch:boolean}[]=[];
 private origin=new T.Vector3();distance=0;
 heading(s:number){return .34*Math.sin(s/420+.35)+.20*Math.sin(s/170+.6);}
 grade(s:number){return .018*Math.sin(s/680)+.012*Math.cos(s/240);}
 private sample(s:number,out=new T.Vector3()){
  const f=Math.max(0,(s-this.start)/this.step),i=Math.floor(f);
  while(this.points.length<=i+1){const k=this.points.length,t=this.start+(k-.5)*this.step,h=this.heading(t),g=this.grade(t),flat=Math.sqrt(1-g*g);this.points.push(this.points[k-1].clone().add(new T.Vector3(Math.sin(h)*flat,g,-Math.cos(h)*flat).multiplyScalar(this.step)));}
  return out.copy(this.points[i]).lerp(this.points[i+1],f-i);
 }
 setDistance(s:number){this.distance=s;this.sample(s,this.origin);}
 point(x:number,y:number,z:number,out=new T.Vector3()){
  const s=this.distance-z,h=this.heading(s);this.sample(s,out).sub(this.origin);out.x+=Math.cos(h)*x;out.z+=Math.sin(h)*x;out.y+=y;return out;
 }
 place(o:T.Object3D,x:number,y:number,z:number,reverse=0,slope=false){this.point(x,y,z,o.position);o.rotation.set(slope?Math.atan(this.grade(this.distance-z)):0,-this.heading(this.distance-z)+reverse,0,'YXZ');}
 bendBox(mesh:T.Mesh,branch=false){
  mesh.updateMatrix();const s=mesh.scale,p=mesh.position;
  const geo=new T.BoxGeometry(s.x,s.y,s.z,1,1,Math.ceil(s.z/10));geo.translate(p.x,p.y,p.z);
  mesh.geometry=geo;mesh.position.set(0,0,0);mesh.rotation.set(0,0,0);mesh.scale.set(1,1,1);mesh.frustumCulled=false;
  this.sections.push({mesh,source:new Float32Array(geo.attributes.position.array),plane:false,branch});
 }
 road(mesh:T.Mesh){
  const g=new T.PlaneGeometry(27,1800,4,300),p=g.attributes.position,uv=g.attributes.uv;
  const source=new Float32Array(p.count*3);for(let i=0;i<p.count;i++)source.set([p.getX(i),-.012,130-uv.getY(i)*1800],i*3);
  mesh.geometry=g;mesh.position.set(0,0,0);mesh.frustumCulled=false;this.sections.push({mesh,source,plane:true,branch:false});
 }
 update(){
  const v=new T.Vector3();
  for(const {mesh,source,plane,branch}of this.sections){const a=mesh.geometry.attributes.position;
   for(let i=0;i<a.count;i++){
    let x=source[i*3],y=source[i*3+1],z=source[i*3+2];
    if(branch){x+=Math.sin((this.distance-z)/310+1.2)*42;y+=Math.sin((this.distance-z)/500)*2.5;}
    this.point(x,y,z,v);if(plane)a.setXYZ(i,v.x,-v.z,v.y);else a.setXYZ(i,v.x,v.y,v.z);
   }a.needsUpdate=true;if(!plane)mesh.geometry.computeVertexNormals();
  }
 }
 diagnostics(){return{type:'distance-integrated-curved-elevated',heading:this.heading(this.distance),grade:this.grade(this.distance),near:this.point(0,0,-120).toArray(),far:this.point(0,0,-450).toArray(),curvedMeshes:this.sections.length};}
}
