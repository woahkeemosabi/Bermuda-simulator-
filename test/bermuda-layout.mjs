import assert from 'node:assert/strict';
import {Scene,Vector3} from '../src/engine/index.js';
import {Vendor} from '../src/game/Vendor.js';
import {FishStand,STAND} from '../src/game/FishStand.js';
import {Chandlery,CHANDLERY} from '../src/game/Chandlery.js';
import {Colliders} from '../src/world/Colliders.js';
import {installBermudaBlockout} from '../src/world/BermudaBlockout.js';
import {mobileQualityParameters} from '../src/mobile/QualityProfile.js';
import {WATERFRONT_DECK,FISH_MARKET,BAIT_TACKLE,HARBOUR_JOB_BOARD,dockLampPosition} from '../src/world/bermuda/HarbourLayout.js';
// Character download is unrelated to dock-space collision and interaction tests.
Vendor.prototype.loadCharacter = async () => {};
const scene=new Scene(), colliders=new Colliders();
const terrain={heightAt:()=>-4};
const joe=new FishStand({scene,terrain,colliders});
const martha=new Chandlery({scene,terrain,colliders});
installBermudaBlockout({scene,colliders,terrainData:terrain});
assert.equal(FISH_MARKET.yaw,-Math.PI/2);
assert.equal(BAIT_TACKLE.yaw,-Math.PI/2);
const deckX0=WATERFRONT_DECK.x-WATERFRONT_DECK.width/2, deckX1=WATERFRONT_DECK.x+WATERFRONT_DECK.width/2;
const deckZ0=WATERFRONT_DECK.z-WATERFRONT_DECK.depth/2, deckZ1=WATERFRONT_DECK.z+WATERFRONT_DECK.depth/2;
assert(HARBOUR_JOB_BOARD.x>deckX0 && HARBOUR_JOB_BOARD.x<deckX1 && HARBOUR_JOB_BOARD.z>deckZ0 && HARBOUR_JOB_BOARD.z<deckZ1);
assert.equal(HARBOUR_JOB_BOARD.baseY,WATERFRONT_DECK.baseY);
for(const [shop,s] of [[joe,STAND],[martha,CHANDLERY]]) {
 assert.equal(shop.group.position.y,1);
 assert.equal(shop.vendor.position.y,shop===joe ? 1.06 : 1.0);
 assert(shop.vendor.inRange(new Vector3(-63.4,1.02,s.z)));
 assert.equal(colliders.groundHeightAt(s.x,s.z,1.1),1);
 assert(s.x-s.depth/2>=deckX0 && s.x+s.depth/2<=deckX1);
 assert.equal(dockLampPosition(s,0,1.85,0).y,2.85);
}
for(let z=-40;z<=-17;z+=.25) {
 const p=new Vector3(WATERFRONT_DECK.x,1.02,z);
 assert(!colliders.resolveCapsule(p,.3,1.75),`central walking corridor obstructed at ${z}`);
}
for(const fish of joe.iceFish()) assert(fish.frame.elements[13]>2);
const high=mobileQualityParameters('quality=mobile-high&noCaustics=1&noHaze=1');
assert.equal(high.get('scale'),'0.80');assert.equal(high.get('G'),'20');
assert(!high.has('noHaze')&&!high.has('noCaustics'));
assert(high.has('noSim')&&high.has('noClouds'));
const recovery=mobileQualityParameters(high,2);
assert.equal(recovery.get('scale'),'0.68');assert.equal(recovery.get('G'),'18'); assert(recovery.has('noCaustics'));
console.log('Dock elevation, vendor interaction, walking clearance and quality recovery pass.');

// The rear sign posts of the original Tidewater stall must remain supported by the apron.
for (const lx of [-1.08,1.08]) {
 const post=dockLampPosition(BAIT_TACKLE,lx,0,-1.72);
 assert(post.x>=deckX0 && post.x<=deckX1 && post.z>=deckZ0 && post.z<=deckZ1);
}
const {HarbourJobBoard,MINI_JOBS}=await import('../src/game/HarbourJobBoard.js');
const board=Object.create(HarbourJobBoard.prototype);
board.app={settings:{timeOfDay:0}};
for (const owned of [[],[{id:'lobster-workboat'}]]) {
 board.state={boats:{owned}};
 const eligible=board.eligibleJobs();
 for(let completed=0;completed<=eligible.length;completed++) for(let hour=0;hour<24;hour+=4) {
  board.app.settings.timeOfDay=hour;
  board.data={history:eligible.slice(0,completed).map(j=>j.id),completedCount:completed,active:null};
  const offers=board.offers();
  assert.equal(offers.length,3,'each rotation offers three real jobs');
  assert.equal(new Set(offers.map(j=>j.id)).size,3);
  assert(offers.every(j=>eligible.includes(j)),'all notices are eligible mini jobs');
  let visible;
  board.notices={update:(jobs)=>{visible=jobs}};
  board.updateNotices();
  assert.deepEqual(visible,offers,'physical notices match popup offers');
 }
}
board.data.active={id:MINI_JOBS[0].id};
let visible,active;
board.notices={update:(jobs,id)=>{visible=jobs;active=id}};
board.updateNotices();
assert.equal(visible.length,3);
assert.equal(visible[0].id,active);
console.log('Three eligible world notices stay in sync with job rotation and active job.');
