// Accumulate deadlines instead of rounding every interval up to a RAF tick.
export class FramePacer {
 constructor(fps=60){this.interval=1000/fps;this.next=null;}
 reset(){this.next=null;}
 take(t){
  if(this.next===null)this.next=t;
  if(t+.5<this.next)return false;
  this.next+=this.interval;
  if(this.next<t-this.interval)this.next=t+this.interval;
  return true;
 }
}
export function summarizeFrames(intervals) {
 if(!intervals.length)return null;
 const sorted=[...intervals].sort((a,b)=>b-a),n=Math.max(1,Math.ceil(sorted.length*.01));
 const mean=intervals.reduce((a,b)=>a+b,0)/intervals.length;
 return {samples:intervals.length,averageFPS:1000/mean,meanFrameMs:mean,onePercentLowFPS:1000/(sorted.slice(0,n).reduce((a,b)=>a+b,0)/n),p99FrameMs:sorted[Math.max(0,n-1)]};
}
