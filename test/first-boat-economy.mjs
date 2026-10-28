// CPU integration test: fish -> Joe's sale -> $3,200 starter boat -> persistent ownership.
// This does NOT replace browser playthrough or iPhone Safari verification.
import assert from 'node:assert/strict';
import { GameState } from '../src/game/GameState.js';
import { BoatOwnership } from '../src/game/BoatOwnership.js';
import { MissionDirector } from '../src/game/MissionDirector.js';
const memory=new Map();
const storage={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)};
const state=new GameState(storage);
const input={pressed:false,hit(k){return k==='KeyE'&&this.pressed;}};
const player={mode:'walk',busy:false,prompt:null,nearBoat(){return true;},update(){}};
const toasts=[];
const game={state,toast:m=>toasts.push(m)};
const app={player,game,input,scene:{add(){}},progression:{boatOnly:true}};
app.missionDirector=new MissionDirector(app);
const ownership=new BoatOwnership(app);
assert.equal(state.money,75);
assert.equal(ownership.ownsBoat(),false);
input.pressed=true;
ownership.update();
assert.equal(ownership.ownsBoat(),false,'boat not acquired below threshold');
input.pressed=false;
let soldFish=0;
while(state.money<3200&&soldFish<2000){
 const caught=state.addFish('grunt',0.84);
 assert.ok(caught,'legal fish should fit cleared cooler');
 const sale=state.sell([caught.id]);
 assert.equal(sale.count,1);
 assert.ok(sale.total>0);
 soldFish++;
}
assert.ok(state.money>=3200,'fish sales should accumulate to boat price');
const before=state.money;
input.pressed=true;
ownership.update();
assert.equal(ownership.ownsBoat(),true,'owned only after actual paid purchase');
assert.equal(state.money,before-3200,'boat payment exactly $3,200');
assert.ok(state.storyFlags.firstBoatPurchased,'story flag set');
assert.ok(state.boats.owned.some(b=>b.id==='lobster-workboat'&&b.purchasedAt>0));
const after=state.money;
ownership.update();
assert.equal(state.money,after,'cannot buy twice');
const reloaded=new GameState(storage);
assert.ok(reloaded.load(),'storage roundtrip succeeds');
assert.equal(reloaded.money,after);
assert.ok(reloaded.boats.owned.some(b=>b.id==='lobster-workboat'&&b.purchasedAt>0));
assert.equal(reloaded.storyFlags.firstBoatPurchased,true);
console.log('Boat economy CPU integration passed:',soldFish,'fish sold, payment/persistence verified');
