import assert from 'node:assert/strict';
import { GameState } from '../src/game/GameState.js';
import { BoatOwnership } from '../src/game/BoatOwnership.js';
import { STARTER_BOAT_PRICE } from '../src/game/FirstBoatMode.js';
// CPU integration only: test-supplied catches and interaction stubs, not UI QA.
const saved=new Map();
const storage={getItem:key=>saved.get(key)??null,setItem:(key,value)=>saved.set(key,value)};
let state=new GameState(storage);
assert.equal(state.money,75);assert.equal(STARTER_BOAT_PRICE,3200);
const ownership=()=>Object.assign(Object.create(BoatOwnership.prototype),{state,app:{},player:{mode:'walk',busy:false},
  input:{hit:()=>true},_realNearBoat:()=>true,game:{toast:()=>{}},sign:{visible:true}});
ownership().update();assert.equal(state.money,75);assert.equal(ownership().ownsBoat(),false);
let sales=0;
while(state.money<STARTER_BOAT_PRICE){
  const fish=state.addFish('grunt',0.8);assert.ok(fish&&fish.value>0);
  const wallet=state.money,sale=state.sell([fish.id]);assert.equal(sale.count,1);assert.equal(state.money,wallet+fish.value);
  if(++sales>1000)throw new Error('Boat price not reached');
}
state.save();state=new GameState(storage);assert.equal(state.load(),true);assert.ok(state.money>=3200);
const earned=state.money,boat=ownership();boat.update();
assert.equal(state.money,earned-3200);assert.equal(boat.ownsBoat(),true);
assert.equal(state.storyFlags.firstBoatPurchased,true);assert.equal(boat.sign.visible,false);
boat.update();assert.equal(state.money,earned-3200);
state=new GameState(storage);assert.equal(state.load(),true);
assert.equal(ownership().ownsBoat(),true);assert.equal(state.money,earned-3200);
console.log(JSON.stringify({scope:'CPU only, no UI gameplay',sales,earned,price:3200,remaining:state.money,purchasePersisted:true}));
