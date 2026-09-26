import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseGLB } from '../src/engine/loaders/GLTF.js';
import { staticGeometry, placeStaticAsset } from '../src/world/bermuda/StaticAsset.js';

// Exercise the actual GLB parser and waterfront adapter with an existing repository model.
// This test is CPU-safe: it never requests a WebGPU adapter or decodes a texture.
const read = ( file ) => {

	const bytes = fs.readFileSync( file );
	return parseGLB( bytes.buffer.slice( bytes.byteOffset, bytes.byteOffset + bytes.byteLength ) );

};
const file = new URL( '../public/models/debris/lambis_shell.glb', import.meta.url );
const source = read( file );
const geometry = staticGeometry( source );
assert.ok( geometry.triangles > 0 );
assert.ok( geometry.parts.length > 0 );
assert.ok( ! geometry.bounds.isEmpty() );
for ( const part of geometry.parts ) {

	assert.equal( part.geometry.attributes.normal.count, part.geometry.attributes.position.count );
	assert.ok( part.geometry.index.array instanceof Uint16Array || part.geometry.index.array instanceof Uint32Array );

}
const asset = { ...geometry, id: 'fixture' };
const repeated = placeStaticAsset( asset, [ { x: 0, y: 1, z: 0 }, { x: 10, y: 1, z: 0 } ] );
assert.equal( repeated.children.length, geometry.parts.length );
assert.equal( repeated.children[ 0 ].count, 2 );
assert.strictEqual( repeated.children[ 0 ].geometry, geometry.parts[ 0 ].geometry );
assert.ok( repeated.children[ 0 ].boundingSphere.radius > 4 );
assert.throws( () => staticGeometry( { ...source, skins: [ {} ] } ), /static/ );
assert.throws( () => staticGeometry( { ...source, roots: [] } ), /Empty/ );
const invalid = structuredClone( source );
invalid.meshes[ invalid.nodes.find( n => n.mesh !== undefined ).mesh ][ 0 ].mode = 1;
assert.throws( () => staticGeometry( invalid ), /triangle primitives/ );
console.log( 'PASS: native GLB parsing, transforms, geometry sharing, instance bounds, and unsupported-input rejection.' );

const plan = JSON.parse( fs.readFileSync( new URL( '../tools/bermuda/asset-plan.json', import.meta.url ), 'utf8' ) );
assert.equal( plan.assets.length, 7 );
assert.equal( new Set( plan.assets.map( a => a.file ) ).size, 7 );
for ( const entry of plan.assets ) {

	assert.ok( entry.prompt.length <= 600, entry.id + ': prompt too long' );
	assert.ok( entry.targetTriangles >= 100 && entry.targetTriangles <= 6000 );
	assert.ok( entry.maxTextureSize <= 1024 );
	const path = new URL( '../public/models/bermuda/' + entry.file, import.meta.url );
	if ( ! fs.existsSync( path ) ) {

		if ( process.argv.includes( '--require-production' ) ) throw new Error( 'Missing production asset: ' + entry.file );
		continue;

	}
	const model = read( path );
	const result = staticGeometry( model );
	assert.ok( result.triangles <= entry.targetTriangles * 1.15, entry.id + ': exceeds mesh budget' );
	assert.ok( model.images.every( im => im.bytes && ! im.uri ), entry.id + ': external texture dependency' );
	assert.ok( ! model.json.extensionsRequired?.length, entry.id + ': unsupported compression extension' );
	console.log( 'PASS: ' + entry.file + ' (' + result.triangles + ' triangles)' );

}
console.log( 'PASS: seven separate asset definitions and mobile budgets.' );
