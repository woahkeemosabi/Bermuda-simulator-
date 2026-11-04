import assert from 'node:assert/strict';
import { FishPortrait } from '../src/game/FishPortrait.js';

// Test GPU canvas lifecycle without allocating a device: every catch-card
// removal must unconfigure its swapchain and clear references.
const portrait = Object.create( FishPortrait.prototype );
let releases = 0;
portrait.context = { unconfigure() { releases ++; } };
portrait.canvas = { width: 200 };
portrait.present = { label: 'present' };
portrait.live = { species: 'test' };
portrait.detach();
assert.equal( releases, 1 );
assert.equal( portrait.context, null );
assert.equal( portrait.canvas, null );
assert.equal( portrait.present, null );
assert.equal( portrait.live, null );

// Device loss can cause unconfigure to throw; detaching must remain safe.
portrait.context = { unconfigure() { throw new Error( 'device lost' ); } };
assert.doesNotThrow( () => portrait.detach() );
assert.equal( portrait.context, null );
console.log( 'Fish portrait WebGPU canvas release and device-loss fallback OK' );
