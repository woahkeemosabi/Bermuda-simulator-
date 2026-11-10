import assert from 'node:assert/strict';
import { loadGLB } from '../src/engine/loaders/GLTF.js';
import { staticGeometry } from '../src/world/bermuda/StaticAsset.js';
import { ORIGINAL_RTS_GLB_URL } from '../src/game/RaceSoundOriginalAsset.js';
import { raceState, sailStep, headingTo, aiHelm, advanceMark, SOUND_MARKS } from '../src/game/RaceSoundRules.js';

const gltf=await loadGLB(ORIGINAL_RTS_GLB_URL);
assert.equal(gltf.meshes.length,19,'Original 19-section articulated catamaran');
assert.equal(gltf.materials.length,6,'Original six PBR materials');
assert.equal(gltf.images.length,3,'Original three embedded textures');
assert.equal(gltf.skins.length,0);
assert.equal(gltf.animations.length,1,'Original 4s rig demo is retained in source GLB');
assert.equal(gltf.animations[0].name,'Rig_Motion_Demo_4s');
gltf.animations.length=0; // Only the derived static boat mesh discards the demo clip
const names=new Set(gltf.nodes.map(n=>n.name));
for(const n of ['Hull_Port','Hull_Starboard','WingYawPivot',
  'RigidWing_Main','WingFlapPivot','RigidWing_TrailingFlap','Hydrofoil_Port',
  'Hydrofoil_Starboard','Rudder_Port_TFoil','Rudder_Starboard_TFoil']){
  assert.ok(names.has(n),'Missing original component '+n);
}
const staticAsset=staticGeometry(gltf);
assert.equal(staticAsset.triangles,15720,'Source geometry must be the original model');
assert.equal(staticAsset.parts.length,19,'Original sections must remain inspectable');
// Camera chase looks from -Z toward +Z. In this orientation, positive yaw
// projects LEFT on the display, so user RIGHT must supply negative helm input.
const right=raceState();
for(let i=0;i<150;i++)sailStep(right,{steer:-1,throttle:1},.016);
assert.ok(right.x< -1,'RIGHT must turn toward screen right (-X)');
const left=raceState();
for(let i=0;i<150;i++)sailStep(left,{steer:1,throttle:1},.016);
assert.ok(left.x>1,'LEFT must turn toward screen left (+X)');
let ai=raceState(-60,-1,0);
for(let i=0;i<20000&&ai.gate<SOUND_MARKS.length;i++){
  sailStep(ai,aiHelm(ai,SOUND_MARKS[ai.gate],16),.016);
  advanceMark(ai);
}
assert.equal(ai.gate,SOUND_MARKS.length,'AI remains correct in world-space');
for(const p of staticAsset.parts)p.geometry.dispose();
console.log('Race the Sound: original 19-part GLB, 15,720 triangles, three textures, steering and AI PASS');
