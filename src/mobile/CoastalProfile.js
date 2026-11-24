// Budgets recovered from the generated coastal-v29/v33 release recipe.
export const COASTAL_MOBILE=Object.freeze({shadow:512,shore:256,sprayGPU:2048,sprayCPU:512});
export function coastalOutputScale(w,h,scale=1){return Math.min(scale,462/Math.min(w,h),817/Math.max(w,h));}
export class CoastalCadence {
 constructor(now=()=>performance.now()){this.now=now;this.last={};this.delta={};this.usedDelta={};}
 allowWhen(key,interval,dt=0,eligible=true){
  // Accumulate every frame, including frames deliberately assigned to
  // other GPU compute families. Only reset time when work is dispatched.
  this.delta[key]=(this.delta[key]||0)+dt;
  const now=this.now();
  if(!eligible||(this.last[key]!==undefined&&now-this.last[key]<interval))return false;
  this.last[key]=now;this.usedDelta[key]=this.delta[key];this.delta[key]=0;return true;
 }
 allow(key,interval,dt=0){return this.allowWhen(key,interval,dt,true);}
}
