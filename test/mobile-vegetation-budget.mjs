import assert from 'node:assert/strict';

// Texture constructors are lazy; these assertions test allocations without
// requiring a WebGPU adapter or triggering any GPU shaders.
Object.defineProperty( globalThis, 'navigator', {
	configurable: true,
	value: { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)' },
} );

const { ImpostorAtlas } = await import( '../src/world/vegetation/Impostors.js' );
const { LeafAtlas } = await import( '../src/world/vegetation/LeafTextures.js' );
const atlas = new ImpostorAtlas( [ { variants: [ {}, {} ] }, { variants: [ {} ] } ], {} );
assert.equal( atlas.variantCount, 3, 'keep all impostor species variants' );
assert.equal( atlas.width, 3 * 6 * 64, 'iPhone must use 64px far-crown frames' );
assert.equal( atlas.height, 6 * 64, 'keep the six-view octahedral layout' );
assert.equal( atlas.depth.width, atlas.width, 'keep the baked impostor depth target aligned' );
assert.equal( new LeafAtlas().texture.width, 512, 'downsample only the iPhone leaf cards' );
console.log( 'Mobile vegetation atlas sizes fit the reduced GPU budget' );
