import assert from 'node:assert/strict';
import { mobileFrozenOceanOptions } from '../src/ocean/MobileOceanPreset.js';

const current = mobileFrozenOceanOptions( new URLSearchParams() );
assert.equal( current.cascades, 1 );
assert.deepEqual( current.sizes, [ 240 ] );
assert.equal( current.frozenAdvection, 0.75 );

const staticWaves = mobileFrozenOceanOptions( new URLSearchParams( 'oceanMotion=off' ) );
assert.equal( staticWaves.cascades, 1 );
assert.equal( staticWaves.frozenAdvection, 0 );
assert.deepEqual( staticWaves.sizes, current.sizes );

const original = mobileFrozenOceanOptions( new URLSearchParams( 'oceanTile=legacy&oceanMotion=off' ) );
assert.deepEqual( original, { cascades:1, sizes:[ 733 ], frozenAdvection:0 } );

console.log( 'Mobile frozen-ocean presets preserve the single-cascade GPU budget.' );
