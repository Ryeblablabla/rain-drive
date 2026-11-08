// Original procedural four-stroke inline-six. No game audio or third-party samples.
// Three combustion events per revolution, with intake/exhaust orders and load noise.
class InlineSix extends AudioWorkletProcessor {
 static get parameterDescriptors(){return[{name:'rpm',defaultValue:850,minValue:500,maxValue:12000,automationRate:'k-rate'},{name:'load',defaultValue:0,minValue:0,maxValue:1,automationRate:'k-rate'},{name:'cut',defaultValue:0,minValue:0,maxValue:1,automationRate:'k-rate'}];}
 constructor(){super();this.phase=0;this.crank=0;this.noise=0;this.dc=0;this.seed=817;this.rpm=850;this.res1=0;this.res2=0;}
 process(_inputs,outputs,p){
  const out=outputs[0][0],load=p.load[0],cut=p.cut[0],target=p.rpm[0];
  for(let i=0;i<out.length;i++){
   this.rpm+=(target-this.rpm)*.0007;const hz=this.rpm/20;
   this.phase=(this.phase+hz/sampleRate)%1;this.crank=(this.crank+this.rpm/120/sampleRate)%1;
   this.seed=(Math.imul(this.seed,1664525)+1013904223)|0;const white=this.seed/2147483648;
   this.noise+=.12*(white-this.noise);
   const pulse=Math.exp(-this.phase*(13+load*7))-.07;
   const uneven=1+.08*Math.sin(this.crank*Math.PI*2)+.025*Math.sin(this.crank*Math.PI*10);
   const exhaust=pulse*uneven*(.40+load*.65)*(1-cut*.88);
   const order=Math.sin(this.phase*Math.PI*2)*(.12+load*.16)+Math.sin(this.phase*Math.PI*4+.4)*load*.06;
   const intake=this.noise*(.035+load*.17)*(1-cut*.7);
   const signal=exhaust+order+intake;this.dc+=(signal-this.dc)*.002;
   out[i]=Math.tanh((signal-this.dc)*1.9)*.64;
  }
  return true;
 }
}
registerProcessor('inline-six',InlineSix);
