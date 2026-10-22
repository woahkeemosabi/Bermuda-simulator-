import assert from 'node:assert/strict';
import {Scene,Vector3} from '../src/engine/index.js';
import {Vendor} from '../src/game/Vendor.js';
import {FishStand,STAND} from '../src/game/FishStand.js';
import {Chandlery,CHANDLERY} from '../src/game/Chandlery.js';
import {Colliders} from '../src/world/Colliders.js';
import {installBermudaBlockout} from '../src/world/BermudaBlockout.js';
import {mobileQualityParameters} from '../src/mobile/QualityProfile.js';
import {dockLampPosition} from '../src/world/bermuda/HarbourLayout.js';
// Character download is unrelated to dock-space collision and interaction tests.
Vendor.prototype.loadCharacter = async () => {};
const scene=new Scene(), colliders=new Colliders();
const terrain={heightAt:()=>-4};
const joe=new FishStand({scene,terrain,colliders});
const martha=new Chandlery({scene,terrain,colliders});
installBermudaBlockout({scene,colliders,terrainData:terrain});
for(const [shop,s] of [[joe,STAND],[martha,CHANDLERY]]) {
 assert.equal(shop.group.position.y,1);
 assert.equal(shop.vendor.position.y,1.06);
 assert(shop.vendor.inRange(new Vector3(-63.4,1.02,s.z)));
 assert.equal(colliders.groundHeightAt(s.x,s.z,1.1),1);
 assert(s.x-s.depth/2>=-67.6 && s.x+s.depth/2<=-62.4);
 assert.equal(dockLampPosition(s,0,1.85,0).y,2.85);
}
for(let z=-40;z<=-17;z+=.25) {
 const p=new Vector3(-63.4,1.02,z);
 assert(!colliders.resolveCapsule(p,.3,1.75),`east walking corridor obstructed at ${z}`);
}
for(const fish of joe.iceFish()) assert(fish.frame.elements[13]>2);
const high=mobileQualityParameters('quality=mobile-high&noCaustics=1&noHaze=1');
assert.equal(high.get('scale'),'0.85');assert.equal(high.get('G'),'24');
assert(!high.has('noHaze')&&!high.has('noCaustics'));
assert(high.has('noSim')&&high.has('noClouds'));
const recovery=mobileQualityParameters(high,2);
assert.equal(recovery.get('scale'),'0.72'); assert(recovery.has('noCaustics'));
console.log('Dock elevation, vendor interaction, walking clearance and quality recovery pass.');
