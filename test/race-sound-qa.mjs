import assert from 'node:assert/strict';
import {
 SOUND_START,SOUND_MARKS,SOUND_MARK_RADIUS,MAX_FOIL_SPEED,METERS_TO_KNOTS,
 raceState,sailStep,aiHelm,advanceMark,distanceToMark,headingTo,angleDelta,
} from '../src/game/RaceSoundRules.js';

assert.equal(SOUND_MARKS.length,6,'A complete six-gate qualifier course is needed');
assert.ok(SOUND_MARKS[0].z > SOUND_START.z,'Race starts outbound into the ocean');
assert.ok(METERS_TO_KNOTS>1.9&&METERS_TO_KNOTS<2,'Speed is displayed in nautical knots');
assert.equal(angleDelta(-Math.PI+0.02,Math.PI-0.01)>0,true,'Angles wrap at ±180°');

let p=raceState();
for(let i=0;i<1000;i++)sailStep(p,{throttle:1},.016);
assert.ok(p.speed>12,'BDA catamaran must accelerate to foiling speed');
assert.ok(p.foil>.7,'Foils should lift when planing');
assert.ok(p.speed<=MAX_FOIL_SPEED,'Speed must remain bounded');
const turned=raceState();
for(let i=0;i<500;i++)sailStep(turned,{throttle:1,steer:1},.016);
assert.ok(Math.abs(turned.heading)>.45,'Steering must turn the vessel');
assert.ok(turned.steering>.9,'Helm smoothing reaches commanded turn');

for(const startX of [SOUND_START.x-9,SOUND_START.x+9]){
 let ai=raceState(startX,SOUND_START.z-7,0);
 for(let frame=0;frame<20000&&ai.finishTime===null;frame++){
   const mark=SOUND_MARKS[ai.gate];
   sailStep(ai,aiHelm(ai,mark,16.6),.016);
   advanceMark(ai);
 }
 assert.equal(ai.gate,SOUND_MARKS.length,'AI should navigate every buoy gate');
 assert.ok(ai.finishTime>0&&ai.finishTime<320,'AI should complete the qualifier in reasonable time');
}
assert.equal(advanceMark(raceState()),false,'Must not skip a distant race gate');
const atFirst=raceState(SOUND_MARKS[0].x,SOUND_MARKS[0].z,0);
assert.ok(distanceToMark(atFirst,SOUND_MARKS[0])<=SOUND_MARK_RADIUS);
assert.equal(advanceMark(atFirst),true);
assert.equal(atFirst.gate,1);
assert.equal(atFirst.finishTime,null);
console.log('Race the Sound native qualifier: course, speed, foil lift, steering, AI and gates PASS');
