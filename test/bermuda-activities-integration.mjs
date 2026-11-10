import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FISH_IDS } from '../src/game/FishTable.js';
import { SOUND_MARKS } from '../src/game/RaceSoundRules.js';

// Runs against the assembled *Bermuda Simulator* derived iPhone build.
// Verify race is an activity in the existing world rather than its own app.
const race=readFileSync(new URL('../src/game/RaceTheSoundMinigame.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/game/RaceTheSoundMinigame.css',import.meta.url),'utf8');
const game=readFileSync(new URL('../src/game/Game.js',import.meta.url),'utf8');
const app=readFileSync(new URL('../src/App.js',import.meta.url),'utf8');
const state=readFileSync(new URL('../src/game/GameState.js',import.meta.url),'utf8');
const model=readFileSync(new URL('../src/game/RaceSoundOriginalModel.js',import.meta.url),'utf8');
assert.ok(race.includes('BERMUDA SIMULATOR'), 'Bermuda Simulator must remain the visible game title');
assert.ok(race.includes('HYDROFOIL RACE'), 'The pier activity must have its own label');
assert.ok(race.includes('Skipper · Race Organiser'), 'The user enters the activity by an NPC at the pier');
assert.ok(race.includes('this.game.state.money.toLocaleString()'), 'The activity HUD must show the real game wallet');
assert.ok(race.includes("this.game.state.addMoney(reward)"), 'Race winnings must credit the same game state');
assert.ok(race.includes('this.returnPose='), 'Returning from the race must preserve the walk position');
assert.ok(race.includes("document.body.classList.remove('rts-racing')"), 'Exiting must restore normal Bermuda Simulator HUD');
assert.ok(race.includes('placeOriginalRaceSoundBoat'), 'Recover existing detailed catamarans rather than use placeholder boxes');
assert.ok(race.includes("const steer=(this.touch.left"), 'A/D mapping must be user-view correct');
assert.ok(!race.includes('RACE THE SOUND · BDA'), 'Race event cannot replace the main game brand');
assert.ok(css.includes('body.rts-racing.bm-mobile .gm-purse'), 'Do not show overlapping fishing/walking wallet while racing');
assert.ok(css.includes('#rts-top .rts-brand'), 'Visible identity header must match Bermuda Simulator');
assert.ok(game.includes('this.raceSound.offer()'), 'The player must talk to the in-world NPC');
assert.ok(game.includes('this.vendors.push( this.raceSound.marshal )'), 'Marshal must use existing NPC interaction loop');
assert.ok(app.includes('this.game?.raceSound?.active') && app.includes('this.fft.update( dt )'), 'Share the existing FFT engine, never open another WebGPU device');
assert.ok(state.includes('bermuda.qa.race-the-sound.save.v1'), 'Preserve the previous race-QA wallet/save during branding migration');
assert.ok(model.includes('loadOriginalRaceSoundAsset'), 'Preserve original boat geometry');
assert.equal(SOUND_MARKS.length,6);
assert.ok(FISH_IDS.includes('yellowtail'), 'Fishing must remain in this same build');
console.log('Bermuda Simulator integration: NPC, branding, wallet, steering, native FFT, fish and return-to-pier PASS');
