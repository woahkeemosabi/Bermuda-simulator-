import assert from 'node:assert/strict';
import { FISH, FISH_IDS, BERMUDA_CATCH_IDS, fishLengthCm, fishForkLengthCm } from '../src/game/FishTable.js';
import { SPECIES, PATTERN, SKIN } from '../src/world/fish/FishSpecies.js';
import { GameState } from '../src/game/GameState.js';
import { fishLandingMotion } from '../src/game/FishLandingMotion.js';

// Recorded Bermuda roster is explicit: the bite sampler cannot introduce an unvetted fish.
assert.deepEqual(new Set(FISH_IDS), new Set(BERMUDA_CATCH_IDS));
assert.equal(FISH.silverside.sci, 'Hypoatherina harringtonensis');
assert.equal(FISH.mullet.sci, 'Mugil curema');
assert.equal(FISH.needlefish.sci, 'Ablennes hians');
assert.equal(FISH.angel.name, 'French angelfish');
assert.equal(FISH.jack.sci, 'Caranx ruber');
assert.equal(FISH.redSnapper.sci, 'Lutjanus vivanus');
assert.equal(FISH.parrot.protected, true);
assert.equal(FISH.grouper.protected, true);
for (const id of FISH_IDS) {
  const f = FISH[id];
  assert.equal(typeof f.sci, 'string', 'Scientific name '+id);
  if (id==='spinyLobster') continue; // Captured by hand, not a fish mesh.
  assert.ok(SPECIES[f.model], 'No matching 3D anatomy for '+id);
  assert.ok(SKIN[f.model], 'No species-specific skin for '+id);
  assert.ok(Number.isInteger(PATTERN[f.model]), 'No pigment pattern for '+id);
}
for(const id of ['wrasse','wahoo','yellowfin','blackGrouper','redHind','laneSnapper']) {
  assert.ok(!['wrasse','barracuda','tuna','grouper','yellowtail'].includes(FISH[id].model),id+' still sharing an incorrect fish silhouette');
}
assert.equal(FISH.yellowtail.minCm,30);
assert.equal(FISH.wrasse.minCm,45);
assert.equal(FISH.blackGrouper.minCm,95);
const store={};
const s = new GameState({getItem:k=>store[k]??null,setItem:(k,v)=>{store[k]=v;}});
const tooSmall=s.addFish('yellowtail',0.4,12);
assert.equal(tooSmall,null);
assert.equal(s.lastCatch.legalSize,false);
const legal=s.addFish('yellowtail',1.31,12);
assert.ok(legal,'Larger legal yellowtail must still reach cooler');
assert.ok(s.lastCatch.forkCm>=30);
assert.ok(s.lastCatch.cm > s.lastCatch.forkCm);
assert.ok(fishForkLengthCm('yellowtail',1.31)<fishLengthCm('yellowtail',1.31));
assert.equal(s.addFish('parrot',1.8),null,'Protected parrotfish must release');
assert.equal(s.lastCatch.protectedSpecies,true);
for (const kg of [0.2,2,15]) {
  let lateKick=0;
  let earlyKick=0;
  for(let i=0;i<100;i++) {
    const a=fishLandingMotion(0.4+i*0.015,kg);
    const b=fishLandingMotion(5.4+i*0.015,kg);
    assert.ok(Object.values(a).every(Number.isFinite));
    earlyKick=Math.max(earlyKick,Math.abs(a.curl));
    lateKick=Math.max(lateKick,Math.abs(b.curl));
  }
  assert.ok(earlyKick>0.30,'Fish must flop immediately');
  assert.ok(lateKick>0.25,'Fish must continue visibly flapping later during 8-second landing');
}
console.log('Bermuda fish v4: vetted ID roster, 6 distinct visuals, conservation and sustained motion PASS');
