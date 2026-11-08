import assert from 'node:assert/strict';
import { applyBermudaBootLook, BERMUDA_LOOK } from '../src/world/BermudaIdentity.js';
import { TerrainData } from '../src/world/TerrainData.js';

// The real iPhone launch goes through this boot hook before building the heightfield.
applyBermudaBootLook( { settings: {} } );
const terrain = new TerrainData();

let highest = -Infinity;
for ( const height of terrain.heights ) highest = Math.max( highest, height );

assert( highest <= BERMUDA_LOOK.terrain.maxHeight + 0.01,
	`The former volcanic mountain exceeds the temporary low-relief ceiling (${ highest } m)` );
assert( terrain.heightAt( - 80, - 145 ) < 8,
	'The artificial waterfront mound has returned' );
assert( Math.abs( terrain.heightAt( - 64, - 47 ) - 0.2282 ) < 0.05,
	'The starting shoreline elevation changed unexpectedly' );

console.log( `Bermuda low-relief terrain passes (highest ${ highest.toFixed( 1 ) } m, waterfront mound removed).` );
