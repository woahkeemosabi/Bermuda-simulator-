// Recovery regression for the fishing and fish-landing behaviour in the current
// canonical game. Does not assert unshipped roster/anatomy changes.
import assert from 'node:assert/strict';
import { FISH, FISH_IDS, fishLengthCm } from '../src/game/FishTable.js';
import { SPECIES, PATTERN, SKIN } from '../src/world/fish/FishSpecies.js';
import { GameState } from '../src/game/GameState.js';
import { fishLandingMotion } from '../src/game/FishLandingMotion.js';

assert.equal(FISH_IDS.length, Object.keys(FISH).length);
assert.equal(new Set(FISH_IDS).size, FISH_IDS.length);
for (const id of FISH_IDS) {
  const fish = FISH[id];
  assert.equal(typeof fish.sci, 'string', 'Missing species name: ' + id);
  assert.ok(fish.sci.length > 3, 'Empty scientific name: ' + id);
  if (id !== 'spinyLobster') {
    assert.ok(SPECIES[fish.model], 'Missing current 3D fish geometry: ' + id);
    assert.ok(SKIN[fish.model], 'Missing current skin: ' + id);
    assert.ok(Number.isInteger(PATTERN[fish.model]), 'Missing shader pattern: ' + id);
  }
  assert.ok(fishLengthCm(id, fish.kg[0]) > 0);
}

const memory = new Map();
const storage = {
  getItem: key => memory.get(key) ?? null,
  setItem: (key, value) => memory.set(key, String(value)),
  removeItem: key => memory.delete(key)
};
const state = new GameState(storage);
const baselineCash = state.money;

const undersized = state.addFish('wahoo', 1.0);
assert.equal(undersized, null, 'Below-minimum-weight wahoo must not enter cooler');
assert.equal(state.lastCatch.legalSize, false);
const smallGrouper = state.addFish('blackGrouper', 8.0, 12, 60);
assert.equal(smallGrouper, null, 'Below-minimum-length grouper must not enter cooler');
assert.equal(state.lastCatch.legalSize, false);

for (const species of ['parrot', 'grouper']) {
  assert.equal(state.addFish(species, 2), null, 'Protected fish must be released: ' + species);
  assert.equal(state.lastCatch.protectedSpecies, true);
}
const catchEntry = state.addFish('yellowtail', 1.1, 12);
assert.ok(catchEntry && catchEntry.value > 0, 'Legal catch must enter cooler');
assert.equal(state.inventory.length, 1);
const sale = state.sell();
assert.equal(sale.count, 1);
assert.equal(state.money, baselineCash + catchEntry.value);
assert.equal(state.inventory.length, 0);

for (const mass of [0.2, 2, 15]) {
  let early = 0, late = 0;
  for (let i = 0; i < 100; i++) {
    for (const [t, window] of [[0.4 + i * 0.015, 'early'], [5.4 + i * 0.015, 'late']]) {
      const motion = fishLandingMotion(t, mass);
      assert.ok(Object.values(motion).every(Number.isFinite), 'Fish motion must stay finite');
      if (window === 'early') early = Math.max(early, Math.abs(motion.curl));
      else late = Math.max(late, Math.abs(motion.curl));
    }
  }
  assert.ok(early > 0.3 && late > 0.25, 'Fish must visibly struggle through the landing animation');
}
console.log('Fishing recovery: 3D roster bindings, legal release, sale/wallet and sustained landing motion PASS');
