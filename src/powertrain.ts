/** Fictional 3.0 litre turbo six. SI forces; speed exposed as km/h for the UI.
 * No speed clamp: acceleration balances wheel torque, aero and rolling drag.
 */
export class Powertrain {
 speed=0;rpm=850;gear=1;throttle=0;brake=0;boost=0;acceleration=0;
 automatic=true;shiftRemaining=0;shiftCount=0;lastShift: 'up'|'down'='up';
 readonly ratios=[3.42,2.18,1.55,1.18,.94,.76];
 readonly finalDrive=3.70;readonly wheelRadius=.338;readonly mass=1510;
 readonly idle=850;readonly redline=7600;
 wheelForce=0;dragForce=0;limiting=false;private cooldown=0;
 torque(rpm:number){
  const points=[[850,155],[1800,270],[3000,400],[4500,430],[5800,410],[6800,365],[7600,275],[8200,0]];
  for(let i=1;i<points.length;i++)if(rpm<=points[i][0]){const a=points[i-1],b=points[i];return Math.max(0,a[1]+(b[1]-a[1])*(rpm-a[0])/(b[0]-a[0]));}
  return 0;
 }
 wheelRpm(speed=this.speed,gear=this.gear){return speed/3.6/(2*Math.PI*this.wheelRadius)*60*this.ratios[gear-1]*this.finalDrive;}
 shift(direction:number){
  if(this.shiftRemaining>0||this.cooldown>0)return false;
  const next=Math.max(1,Math.min(6,this.gear+direction));
  if(next===this.gear||this.wheelRpm(this.speed,next)>this.redline+100)return false;
  this.lastShift=next>this.gear?'up':'down';this.gear=next;this.shiftRemaining=this.lastShift==='up'?.29:.34;this.cooldown=.65;this.shiftCount++;return true;
 }
 reset(speed=0){this.speed=speed;this.gear=1;while(this.gear<6&&this.wheelRpm()>2900)this.gear++;this.rpm=Math.max(this.idle,this.wheelRpm());this.throttle=0;this.brake=0;this.boost=0;this.acceleration=0;this.shiftRemaining=0;this.shiftCount=0;this.cooldown=0;}
 update(dt:number,gas:number,brake:number){
  this.cooldown=Math.max(0,this.cooldown-dt);this.shiftRemaining=Math.max(0,this.shiftRemaining-dt);
  this.throttle+=(gas-this.throttle)*(1-Math.exp(-dt*8));this.brake=brake;
  if(this.automatic&&this.shiftRemaining===0){
   const shiftUp=this.throttle>.72?7050:this.throttle>.25?4000:2700;
   if(this.wheelRpm()>shiftUp)this.shift(1);
   else if(this.gear>1&&(this.wheelRpm()<1350||(this.throttle>.85&&this.wheelRpm()<2400&&this.wheelRpm(this.speed,this.gear-1)<5700)))this.shift(-1);
  }
  const coupled=Math.max(this.idle,this.wheelRpm());
  const launch=Math.max(coupled,this.idle+this.throttle*1850*Math.max(0,1-this.speed/32));
  const target=this.shiftRemaining>0?Math.max(this.idle,this.lastShift==='down'?coupled+250:coupled):launch;
  this.rpm+=(target-this.rpm)*(1-Math.exp(-dt*(this.shiftRemaining>0?8:18)));
  this.limiting=this.rpm>this.redline;
  const cut=this.shiftRemaining>0||this.limiting?0:1;
  this.boost+=((Math.min(1,Math.max(0,(this.rpm-1600)/2200))*this.throttle*cut)-this.boost)*(1-Math.exp(-dt*3.5));
  const torque=this.torque(this.rpm)*this.throttle*(.76+.24*this.boost)*cut;
  this.wheelForce=Math.min(8200,torque*this.ratios[this.gear-1]*this.finalDrive*.88/this.wheelRadius);
  const v=this.speed/3.6,rolling=v>.05?this.mass*9.81*.0125:0;
  const engineBrake=(1-this.throttle)*Math.min(650,this.rpm*.085)*(this.shiftRemaining>0?0:1);
  this.dragForce=.5*1.225*.66*v*v+rolling+engineBrake;
  this.acceleration=(this.wheelForce-this.dragForce-brake*this.mass*8.8)/this.mass;
  this.speed=Math.max(0,this.speed+this.acceleration*dt*3.6);
  if(this.speed<.12&&gas===0)this.speed=0;
  return this.speed;
 }
 snapshot(){return{rpm:this.rpm,gear:this.gear,throttle:this.throttle,brake:this.brake,boost:this.boost,automatic:this.automatic,shifting:this.shiftRemaining>0,shiftCount:this.shiftCount,lastShift:this.lastShift,acceleration:this.acceleration,wheelForce:this.wheelForce,dragForce:this.dragForce,limiting:this.limiting,speedLimiter:false};}
}
