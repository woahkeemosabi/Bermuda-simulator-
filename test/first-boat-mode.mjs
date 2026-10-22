import assert from 'node:assert/strict';
import { firstBoatModeEnabled, normalizeFirstBoatObjectives, STARTER_BOAT_PRICE, FIRST_BOAT_BACKUP } from '../src/game/FirstBoatMode.js';
import { readFileSync } from 'node:fs';
const memory=new Map();
const state={
 money:2454,boats:{owned:[]},inventory:[{id:1}],storyFlags:{},
 missions:{available:['side-ghost-line','main-first-boat'],active:['main-blue-hole'],completed:['martha-first-delivery']},
 storage:{getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)},
 toJSON(){return {money:this.money,inventory:this.inventory,missions:this.missions,boats:this.boats};},
 save(){this.saved=(this.saved||0)+1;},emit(){}
};
assert.equal(STARTER_BOAT_PRICE,3200);
assert.ok(firstBoatModeEnabled(new URLSearchParams('missions=boat'),'Mac OS'));
assert.equal(firstBoatModeEnabled(new URLSearchParams('missions=full'),'iPhone'),false);
assert.ok(normalizeFirstBoatObjectives(state));
assert.deepEqual(state.missions.available,['main-first-boat']);
assert.deepEqual(state.missions.active,[]);
assert.deepEqual(state.missions.completed,['martha-first-delivery']);
assert.equal(state.money,2454);
assert.deepEqual(state.inventory,[{id:1}]);
const backup=JSON.parse(memory.get(FIRST_BOAT_BACKUP));
assert.equal(backup.missions.active[0],'main-blue-hole');
assert.equal(normalizeFirstBoatObjectives(state),false);
state.boats.owned=[{id:'lobster-workboat'}]; // placeholder is not a purchase
assert.equal(normalizeFirstBoatObjectives(state),false);
state.boats.owned=[{id:'lobster-workboat',purchasedAt:1761152400000}];
assert.ok(normalizeFirstBoatObjectives(state));
assert.deepEqual(state.missions.available,[]);
assert.ok(state.missions.completed.includes('main-first-boat'));
assert.ok(state.missions.completed.includes('martha-first-delivery'));
assert.equal(JSON.parse(memory.get(FIRST_BOAT_BACKUP)).missions.active[0],'main-blue-hole');
const files=p=>readFileSync(new URL(p,import.meta.url),'utf8');
assert.match(files('../src/world/BermudaIdentity.js'),/boatOnly && !app.boatOwnership/);
assert.match(files('../src/game/LifeProgression.js'),/normalizeFirstBoatObjectives/);
assert.match(files('../src/game/BoatOwnership.js'),/normalizeFirstBoatObjectives/);
console.log('First boat only: no lost money, completed missions or saved history; purchase retained.');
