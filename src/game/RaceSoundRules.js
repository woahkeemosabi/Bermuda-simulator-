// Native harbour-qualifier race mechanics: shared Bermuda Simulator FFT scene,
// no second WebGPU context, no timers, and no dependency on the Vercel build.
// Coordinates are local SIMULATOR world metres (not surveyed Great Sound GPS).
export const SOUND_START = Object.freeze({ x: -51, z: 6, heading: 0 });
export const SOUND_MARKS = Object.freeze([
  Object.freeze({x:-48,z:85,name:'Harbour Exit'}),
  Object.freeze({x:28,z:165,name:'East Reach'}),
  Object.freeze({x:-22,z:235,name:'Open Sound'}),
  Object.freeze({x:-120,z:198,name:'West Mark'}),
  Object.freeze({x:-108,z:93,name:'Home Reach'}),
  Object.freeze({x:-49,z:25,name:'Finish Gate'}),
]);
export const SOUND_MARK_RADIUS=14;
export const MAX_FOIL_SPEED=20.2; // m/s (~39 knots), race foil-cat sprint ceiling
export const METERS_TO_KNOTS=1.943844;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function distanceToMark(boat,mark){return Math.hypot(boat.x-mark.x,boat.z-mark.z);}
export function headingTo(boat,target){return Math.atan2(target.x-boat.x,target.z-boat.z);}
export function angleDelta(target,current){return Math.atan2(Math.sin(target-current),Math.cos(target-current));}
export function raceState(x=SOUND_START.x,z=SOUND_START.z,heading=SOUND_START.heading){
  return {x,z,heading,speed:0,steering:0,foil:0,gate:0,time:0,finishTime:null};
}
export function sailStep(boat,{throttle=0,steer=0,brake=false}={},dt=1/60){
  const h=clamp(dt,0,0.05),t=clamp(throttle,-1,1),turn=clamp(steer,-1,1);
  boat.steering += (turn-boat.steering)*(1-Math.exp(-h*5.5));
  const liftBoost=0.5+0.5*boat.foil;
  const acceleration=(t>0 ? 4.6*t : t<0 ? 2.4*t : -0.8);
  boat.speed=clamp(boat.speed+(acceleration-0.0045*boat.speed*boat.speed-(brake?6.0:0))*h,0,MAX_FOIL_SPEED);
  const liftTarget=clamp((boat.speed-6.2)/5.0,0,1);
  boat.foil += (liftTarget-boat.foil)*(1-Math.exp(-h*2.4));
  // A fast, foiling catamararan carves wider arcs: less yaw rate at high speed.
  const steerRate=(0.52+boat.speed*0.018)*liftBoost;
  boat.heading+=boat.steering*steerRate*h;
  boat.x+=Math.sin(boat.heading)*boat.speed*h;
  boat.z+=Math.cos(boat.heading)*boat.speed*h;
  boat.time+=h;
  return boat;
}
export function aiHelm(boat,mark,targetSpeed=16){
  const delta=angleDelta(headingTo(boat,mark),boat.heading);
  return {throttle:boat.speed<targetSpeed?1:0,steer:clamp(delta*2.5,-1,1),brake:Math.abs(delta)>1.65&&boat.speed>11};
}
export function advanceMark(boat){
  if(boat.finishTime!==null)return false;
  const target=SOUND_MARKS[boat.gate];
  if(!target||distanceToMark(boat,target)>SOUND_MARK_RADIUS)return false;
  boat.gate++;
  if(boat.gate===SOUND_MARKS.length)boat.finishTime=boat.time;
  return true;
}
export function distanceProgress(boat){
  if(boat.finishTime!==null)return SOUND_MARKS.length+1-boat.finishTime/100000;
  const mark=SOUND_MARKS[Math.min(boat.gate,SOUND_MARKS.length-1)];
  return boat.gate+Math.max(0,1-distanceToMark(boat,mark)/150)*0.85;
}
