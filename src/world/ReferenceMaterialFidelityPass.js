import {
	BoxGeometry, CylinderGeometry, Group, InstancedMesh, Matrix4, Mesh, SphereGeometry, TorusGeometry,
} from '../engine/index.js';
import { Material } from '../engine/render/Material.js';

function mat( name, color, roughness = 0.9, metalness = 0, extra = {} ) {
	return new Material( {
		name: `bermuda-fidelity-${ name }`, color, roughness, metalness,
		underwaterLighting: 'lite', localLightsCheap: true, receiveShadows: true,
		...extra,
	} );
}

function addMesh( parent, geometry, material, p, s, r = null, name = '' ) {
	const mesh = new Mesh( geometry, material );
	mesh.name = name;
	mesh.position.set( ...p );
	mesh.scale.set( ...s );
	if ( r ) mesh.rotation.set( ...r );
	mesh.castShadow = false;
	mesh.receiveShadow = true;
	parent.add( mesh );
	return mesh;
}

function installLobsterBoatDetail( app, materials ) {
	const model = app?.player?.boat?.model;
	if ( ! model?.group || app.__bermudaLobsterBoatFidelity ) return app?.__bermudaLobsterBoatFidelity;

	const root = new Group();
	root.name = 'BermudaLobsterBoatFidelity';
	model.group.add( root );
	const deckY = model.lines?.deckY ?? 0.72;
	const beam = Math.max( 1.1, ( model.dimensions?.beam || 2.6 ) * 0.5 );
	const torus = new TorusGeometry( 1, 0.085, 8, 24 );
	const cyl = new CylinderGeometry( 1, 1, 1, 12 );
	const box = new BoxGeometry( 1, 1, 1 );

	// Rope coils and soft fenders make the restored working boat read as an actual used harbour boat,
	// without changing its proven hull, wheelhouse, traps, hauler, radar or physics.
	for ( const [ x, z, scale ] of [ [ -0.78, -2.05, 0.34 ], [ 0.73, -1.55, 0.29 ] ] ) {
		addMesh( root, torus, materials.rope, [ x, deckY + 0.055, z ], [ scale, scale, 0.55 ], [ Math.PI * 0.5, 0, 0 ], 'lobster-rope-coil' );
		addMesh( root, torus, materials.ropeDark, [ x + 0.05, deckY + 0.060, z - 0.03 ], [ scale * 0.66, scale * 0.66, 0.50 ], [ Math.PI * 0.5, 0, 0 ], 'lobster-rope-coil-inner' );
	}
	for ( const side of [ -1, 1 ] ) for ( const z of [ -1.95, -0.82 ] ) {
		const f = addMesh( root, cyl, materials.fender, [ side * ( beam + 0.08 ), deckY + 0.15, z ], [ 0.13, 0.42, 0.13 ], null, 'lobster-fender' );
		f.rotation.z = side * 0.08;
		addMesh( root, cyl, materials.ropeDark, [ side * ( beam - 0.02 ), deckY + 0.67, z ], [ 0.018, 0.46, 0.018 ], null, 'lobster-fender-line' );
	}

	// A small weathered bait/work box adds close-range depth without covering the original deck gear.
	addMesh( root, box, materials.workBox, [ 0.72, deckY + 0.19, -2.42 ], [ 0.58, 0.36, 0.46 ], null, 'lobster-work-box' );
	addMesh( root, box, materials.metal, [ 0.72, deckY + 0.385, -2.42 ], [ 0.50, 0.025, 0.38 ], null, 'lobster-work-box-lid' );

	const state = app.__bermudaLobsterBoatFidelity = { root };
	return state;
}

export function installReferenceMaterialFidelityPass( app ) {
	if ( ! app?.scene || ! app?.terrainData || app.__bermudaMaterialFidelity ) return app?.__bermudaMaterialFidelity;

	const root = new Group();
	root.name = 'BermudaReferenceMaterialFidelity';
	app.scene.add( root );
	const terrain = app.terrainData;
	const M = {
		limestone: mat( 'limestone-breakup', 0xd8d2c6, 0.97 ),
		limestoneLight: mat( 'limestone-sun-face', 0xeee8dc, 0.94 ),
		wetStone: mat( 'wet-limestone', 0x6f7772, 0.52 ),
		underStone: mat( 'submerged-limestone', 0x8e9489, 0.88 ),
		foundation: mat( 'foundation-shadow', 0x8a8278, 0.96 ),
		eave: mat( 'eave-shadow', 0x9e9a91, 0.92 ),
		white: mat( 'window-sill', 0xf2efe6, 0.82 ),
		rope: mat( 'rope', 0xb49a6a, 0.98 ),
		ropeDark: mat( 'rope-dark', 0x6e5c3d, 0.99 ),
		fender: mat( 'fender', 0xe7e4da, 0.64 ),
		workBox: mat( 'work-box', 0x667a71, 0.78 ),
		metal: mat( 'work-metal', 0x7d8588, 0.36, 0.72 ),
	};
	const sphere = new SphereGeometry( 1, 9, 7 );
	const box = new BoxGeometry( 1, 1, 1 );
	const matrix = new Matrix4();

	// Irregular limestone edges at the two sides of the harbour. Keep the central waterfront/RELIC
	// frontage open, but remove the straight-box shoreline silhouette that still read as a blockout.
	const rocks = [];
	for ( const [ x0, x1, step, z0 ] of [ [ -116, -99, 1.55, -43.25 ], [ -31, -15, 1.45, -43.15 ] ] ) {
		let i = 0;
		for ( let x = x0; x <= x1; x += step ) {
			const wobble = Math.sin( i * 1.71 ) * 0.58 + Math.cos( i * 0.83 ) * 0.24;
			const sx = 0.78 + ( i % 4 ) * 0.14;
			const sy = 0.42 + ( ( i + 2 ) % 3 ) * 0.11;
			const sz = 0.72 + ( ( i + 1 ) % 5 ) * 0.10;
			rocks.push( [ x, z0 + wobble, sx, sy, sz, i ] );
			i ++;
		}
	}
	const rockMesh = new InstancedMesh( sphere, M.limestone, rocks.length );
	const wetMesh = new InstancedMesh( sphere, M.wetStone, rocks.length );
	const underMesh = new InstancedMesh( sphere, M.underStone, rocks.length );
	for ( let i = 0; i < rocks.length; i ++ ) {
		const [ x, z, sx, sy, sz, seed ] = rocks[ i ];
		const terrainY = terrain.heightAt( x, z );
		const y = Math.max( -0.02, Math.min( 0.56, terrainY + 0.30 ) );
		matrix.makeScale( sx, sy, sz ).setPosition( x, y, z );
		rockMesh.setMatrixAt( i, matrix );
		matrix.makeScale( sx * 1.02, Math.max( 0.12, sy * 0.28 ), sz * 1.04 ).setPosition( x, 0.055 + Math.sin( seed ) * 0.018, z );
		wetMesh.setMatrixAt( i, matrix );
		matrix.makeScale( sx * 0.92, sy * 0.42, sz * 0.94 ).setPosition( x, -0.24, z + 0.05 );
		underMesh.setMatrixAt( i, matrix );
	}
	for ( const mesh of [ rockMesh, wetMesh, underMesh ] ) {
		mesh.instanceMatrix.needsUpdate = true;
		mesh.computeBoundingSphere();
		mesh.castShadow = false;
		mesh.receiveShadow = true;
		root.add( mesh );
	}

	// Facade grounding: darker foundation courses, recessed eave shadows and projecting sills stop the
	// pastel houses reading like clean boxes while keeping the existing stepped Bermuda roofs intact.
	const houses = [
		[ -105, -64, 7.6, 6.0, 4.2 ], [ -95, -67, 8.4, 6.2, 4.6 ], [ -80, -69, 10.0, 7.0, 4.6 ],
		[ -71, -66, 7.4, 5.8, 4.1 ], [ -61, -73.5, 8.4, 6.4, 4.0 ], [ -51, -69, 8.0, 6.0, 4.35 ],
		[ -39, -64, 7.1, 5.6, 4.0 ], [ -29, -68, 8.1, 6.3, 4.5 ],
	];
	for ( let i = 0; i < houses.length; i ++ ) {
		const [ x, z, w, d, h ] = houses[ i ];
		const ground = Math.max( 1.48, terrain.heightAt( x, z ) );
		const front = z + d * 0.5 + 0.12;
		addMesh( root, box, M.foundation, [ x, ground + 0.14, front ], [ w * 0.88, 0.24, 0.10 ], null, 'house-foundation-course' );
		addMesh( root, box, M.eave, [ x, ground + h + 0.16, front - 0.10 ], [ w * 0.92, 0.055, 0.15 ], null, 'house-eave-shadow' );
		for ( const side of [ -1, 1 ] ) {
			const wx = x + side * w * 0.27;
			addMesh( root, box, M.white, [ wx, ground + 0.77, front + 0.09 ], [ 1.08, 0.075, 0.18 ], null, 'house-window-sill' );
		}
	}

	const boat = installLobsterBoatDetail( app, M );
	const state = app.__bermudaMaterialFidelity = { root, materials: M, boat };
	if ( typeof window !== 'undefined' ) window.__bermudaMaterialFidelity = state;
	return state;
}
