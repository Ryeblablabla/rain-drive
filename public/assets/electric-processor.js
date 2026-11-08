// Original electric sport sound design. No vehicle recordings.
class ElectricDrive extends AudioWorkletProcessor {
 static get parameterDescriptors(){return[
  {name:'speed',defaultValue:0,minValue:0,maxValue:1000,automationRate:'k-rate'},
  {name:'load',defaultValue:0,minValue:0,maxValue:1,automationRate:'k-rate'},
  {name:'brake',defaultValue:0,minValue:0,maxValue:1,automationRate:'k-rate'}];}
 constructor(){super();this.rotor=0;this.dual=0;this.bass=0;this.carrier=0;this.speed=0;this.load=0;this.carrierHz=540;this.seed=827;this.air=0;}
 process(_inputs,outputs,p){
  const out=outputs[0][0],target=p.speed[0],targetLoad=p.load[0],regen=p.brake[0],tau=Math.PI*2;
  for(let i=0;i<out.length;i++){
   this.speed+=(target-this.speed)*.0008;this.load+=(targetLoad-this.load)*.001;
   const v=this.speed,load=this.load;
   const mid=Math.exp(-Math.pow((v-82)/44,4));
   const rise=.5+.5*Math.tanh((v-53)/18);
   const hz=33+v*1.8+load*7+105*rise;
   this.rotor=(this.rotor+hz/sampleRate)%1;this.dual=(this.dual+(hz*1.006+1.4)/sampleRate)%1;this.bass=(this.bass+(28+v*.19)/sampleRate)%1;
   const inverter=480+v*2.7+520*rise;
   this.carrierHz+=(inverter-this.carrierHz)*.0002;this.carrier=(this.carrier+this.carrierHz/sampleRate)%1;
   this.seed=(Math.imul(this.seed,1664525)+1013904223)|0;this.air+=(this.seed/2147483648-this.air)*.06;
   const spin=this.rotor*tau,dual=this.dual*tau;
   const motor=Math.sin(spin)*.29+Math.sin(dual)*.18+Math.sin(spin*2+.35)*(.11+mid*.08)+Math.sin(spin*4)*(.035+mid*.055);
   const body=Math.sin(this.bass*tau)*(.18+load*.12);
   const pwm=Math.sin(this.carrier*tau+Math.sin(spin*2)*(.45+load*.9+mid*.7))*(.075+mid*.11);
   const space=mid*load*(Math.sin(dual*3+Math.sin(this.carrier*tau)*.45)*.09+Math.sin(spin*5+.22)*.035);
   const braking=Math.sin(spin*2+.6)*regen*.09;
   const envelope=Math.min(1,load*.80+v/(v+32)*.22+regen*.12);
   out[i]=Math.tanh((motor+body+pwm+space+braking+this.air*load*.025)*1.3)*envelope*.72;
  }
  return true;
 }
}
registerProcessor('electric-drive',ElectricDrive);
