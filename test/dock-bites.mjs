import assert from 'node:assert/strict';
import { Game } from '../src/game/Game.js';
import { WORLD } from '../src/world/WorldLayout.js';

// Pure prototype test: no GPU or scene allocation is needed to exercise bite logic.
function dockFixture(floorY) {
 const state={floorY,notices:[]};
 const game={
  app:{terrainData:{heightAt:()=>state.floorY},settings:{timeOfDay:12}},
  rod:{bobber:{x:-66,z:-23},depth:0,dip:0},
  _pier:WORLD.pier,
  habitat:Game.prototype.habitat,
  habitatAtPoint:Game.prototype.habitatAtPoint,
  toast:(message)=>state.notices.push(message),
  get hour(){return this.app.settings.timeOfDay;}
 };
 return {game,state};
}

// Regression: the iPhone water query can remain invalid, with rod.depth=0.
// An actual 4m-deep cast off the playable Bermuda dock must still get a finite bite.
const {game,state}=dockFixture(-4);
const habitat=game.habitat();
assert.ok(habitat.pier>0.75,'Actual Bermuda waterfront must count as pier habitat');
assert.ok(habitat.bay>0,'Open bay habitat must remain available');
Game.prototype.onBobberLanded.call(game,'water');
assert.ok(Number.isFinite(game.bite?.t),'Dock bite timer must be finite even with no GPU water readback');
assert.ok(game.bite.t>0 && game.bite.t<120,'Dock bite should start within a sensible period');
game.bite.t=0.001;
Game.prototype.updateBite.call(game,1/60);
assert.equal(game.bite.phase,'nibble','Fish should begin nibbling when the bite timer finishes');
assert.ok(game.bite.species,'Fish must be selected using valid Bermuda dock habitat');

// Shallow water must communicate a poor cast and periodically retry; never stick at Infinity.
state.floorY=0.2;
Game.prototype.onBobberLanded.call(game,'water');
assert.equal(game.bite.t,8,'Too-shallow water must recheck instead of waiting forever');
assert.match(state.notices.at(-1),/cast farther out/i);
// When conditions recover on the same cast, the next retry produces a bite.
state.floorY=-4;
game.bite.t=0.001;
Game.prototype.updateBite.call(game,1/60);
assert.equal(game.bite.phase,'nibble','A previously barren cast must recover automatically');

// Ensure the unchanged legacy Tidewater pier also remains a valid fishing habitat.
const legacy=game.habitatAtPoint(WORLD.pier.x,WORLD.pier.zEnd-3,4);
assert.ok(legacy.pier>0.75);
console.log('Bermuda dock bite regression: GPU depth absent, real berth, retry and legacy pier PASS');
