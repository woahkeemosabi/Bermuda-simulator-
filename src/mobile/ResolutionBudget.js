// Conservative policy, not an assertion about Safari's physical memory limit.
// Keep output at its approved cap; adjust internal targets only while the queue is idle.
export class ResolutionBudget {
 constructor({memoryBytes=256*1024*1024,minScale=.75}={}){this.memoryBytes=memoryBytes;this.minScale=minScale;this.bad=0;this.good=0;this.changed=-Infinity;}
 sample({now,frameMs,bytes,scale,idle}){
  if(!idle||now-this.changed<10000)return scale;
  const over=frameMs>25||bytes>this.memoryBytes;
  this.bad=over?this.bad+1:0;this.good=!over&&frameMs<21&&bytes<this.memoryBytes*.85?this.good+1:0;
  let next=scale;
  if(this.bad>=3)next=Math.max(Math.min(scale,this.minScale),Math.round((scale-.05)*20)/20);
  else if(this.good>=15)next=Math.min(1,Math.round((scale+.05)*20)/20);
  if(next!==scale){this.changed=now;this.bad=0;this.good=0;}
  return next;
 }
}
