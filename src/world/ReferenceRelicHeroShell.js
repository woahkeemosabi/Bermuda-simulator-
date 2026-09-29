import {
	BufferAttribute, BufferGeometry, BoxGeometry, CylinderGeometry, Group, Mesh, TorusGeometry, Vector3,
} from '../engine/index.js';
import { Material } from '../engine/render/Material.js';

function material( name, color, roughness = 0.18, metalness = 0.88, emissive = 0x000000, extra = {} ) {
	return new Material( {
		name: `relic-reference-${ name }`, color, roughness, metalness, emissive,
		underwaterLighting: 'lite', localLightsCheap: false, receiveShadows: true,
		...extra,
	} );
}

function add( parent, geometry, mat, p, s = [ 1, 1, 1 ], r = null, name = '' ) {
	const m = new Mesh( geometry, mat );
	m.name = name;
	m.position.set( ...p );
	m.scale.set( ...s );
	if ( r ) m.rotation.set( ...r );
	m.castShadow = true;
	m.receiveShadow = true;
	parent.add( m );
	return m;
}

// A closed six-sided cross-section loft. This gives RELIC one continuous, sharply faceted body
// instead of the stacked rectangular volumes that were visible in the user's iPhone screenshots.
function facetedLoft( sections ) {
	const vertices = [];
	const rings = [];
	for ( const s of sections ) {
		const [ z, w, low, shoulder, top ] = s;
		const ring = [
			[ -w, low, z ], [ -w * 0.94, shoulder, z ], [ -w * 0.46, top, z ],
			[  w * 0.46, top, z ], [  w * 0.94, shoulder, z ], [  w, low, z ],
		];
		rings.push( ring.map( ( p ) => {
			vertices.push( ...p );
			return vertices.length / 3 - 1;
		} ) );
	}
	const index = [];
	for ( let i = 0; i < rings.length - 1; i ++ ) {
		const a = rings[ i ], b = rings[ i + 1 ];
		for ( let j = 0; j < 6; j ++ ) {
			const k = ( j + 1 ) % 6;
			index.push( a[ j ], b[ j ], b[ k ], a[ j ], b[ k ], a[ k ] );
		}
	}
	const cap = ( ring, reverse ) => {
		for ( let j = 1; j < ring.length - 1; j ++ ) {
			if ( reverse ) index.push( ring[ 0 ], ring[ j + 1 ], ring[ j ] );
			else index.push( ring[ 0 ], ring[ j ], ring[ j + 1 ] );
		}
	};
	cap( rings[ 0 ], true ); cap( rings[ rings.length - 1 ], false );
	const g = new BufferGeometry();
	g.setAttribute( 'position', new BufferAttribute( new Float32Array( vertices ), 3 ) );
	g.setIndex( index );
	g.computeVertexNormals();
	g.computeBoundingSphere();
	return g;
}

function canopyGeometry() {
	return facetedLoft( [
		[ 0.92, 0.48, 0.67, 0.91, 0.98 ],
		[ 0.42, 0.61, 0.69, 1.08, 1.16 ],
		[ -0.52, 0.67, 0.69, 1.08, 1.16 ],
		[ -1.02, 0.53, 0.68, 0.89, 0.96 ],
	] );
}

const LEGACY_SHELL = new Set( [
	'relic-nose', 'relic-monocoque', 'relic-rear-deck', 'relic-floor', 'relic-front-splitter',
	'relic-rear-diffuser', 'relic-left-skirt', 'relic-right-skirt', 'relic-front-fender',
	'relic-rear-fender', 'relic-canopy', 'relic-side-intake', 'relic-rear-vent',
	'relic-front-needle', 'relic-front-amber', 'relic-rear-light-bar', 'relic-rear-light-l', 'relic-rear-light-r',
] );

export function installReferenceRelicHeroShell( app ) {
	const vehicle = app?.relic001?.group;
	if ( ! vehicle || app.__referenceRelicHeroShell ) return app?.__referenceRelicHeroShell;

	vehicle.traverse?.( ( o ) => {
		if ( LEGACY_SHELL.has( o.name ) ) o.visible = false;
	} );

	// Pull the running gear inward so it sits inside the shoulders rather than reading as four pods.
	vehicle.traverse?.( ( o ) => {
		if ( o.name === 'relic-tire' || o.name === 'relic-rim' || o.name === 'relic-brake-disc' ) {
			o.position.x = Math.sign( o.position.x || 1 ) * 1.01;
			if ( o.name === 'relic-tire' ) o.scale.setScalar( 0.41 );
			else if ( o.name === 'relic-rim' ) o.scale.set( 0.275, 0.105, 0.275 );
			else o.scale.set( 0.195, 0.108, 0.195 );
			o.position.y = 0.46;
		}
	} );

	const root = new Group();
	root.name = 'RELIC_REFERENCE_HERO_SHELL';
	vehicle.add( root );

	const M = {
		body: material( 'obsidian-facets', 0x030508, 0.095, 0.96 ),
		body2: material( 'obsidian-secondary', 0x0a0e13, 0.16, 0.90 ),
		carbon: material( 'carbon-void', 0x020305, 0.31, 0.78 ),
		glass: material( 'stormglass', 0x07141c, 0.055, 0.55, 0x020609, { transparent: true, opacity: 0.34, depthWrite: false } ),
		white: material( 'needle-white', 0xb9d9dd, 0.10, 0.22, 0xdffcff ),
		amber: material( 'identity-amber', 0x512005, 0.12, 0.36, 0xff6b14 ),
		red: material( 'tail-red', 0x380204, 0.12, 0.30, 0xff1f18 ),
	};
	const box = new BoxGeometry( 1, 1, 1 );
	const cyl = new CylinderGeometry( 1, 1, 1, 6 );
	const hex = new TorusGeometry( 1, 0.14, 4, 6 );

	// Reference proportions: 4.9 m long, ~2.15 m wide, roof only ~1.18 m high.
	const bodyGeo = facetedLoft( [
		[ 2.48, 0.79, 0.22, 0.34, 0.40 ],
		[ 1.86, 0.99, 0.22, 0.50, 0.53 ],
		[ 0.88, 1.07, 0.22, 0.61, 0.66 ],
		[ -0.55, 1.09, 0.22, 0.66, 0.70 ],
		[ -1.55, 1.07, 0.23, 0.70, 0.72 ],
		[ -2.34, 0.93, 0.24, 0.50, 0.48 ],
	] );
	add( root, bodyGeo, M.body, [ 0, 0, 0 ], [ 1, 1, 1 ], null, 'relic-hero-body' );

	// Deep black voids stop the nose reading as a flat slab and reproduce the reference's split jaw.
	for ( const side of [ -1, 1 ] ) {
		add( root, box, M.carbon, [ side * 0.57, 0.34, 2.405 ], [ 0.70, 0.18, 0.10 ], [ 0, side * -0.035, side * -0.18 ], 'relic-front-intake' );
		add( root, box, M.carbon, [ side * 1.015, 0.46, 0.05 ], [ 0.065, 0.30, 1.62 ], [ 0, 0, side * 0.035 ], 'relic-side-blade' );
	}
	add( root, box, M.carbon, [ 0, 0.235, 0.02 ], [ 2.08, 0.075, 4.70 ], null, 'relic-flat-floor' );
	add( root, box, M.carbon, [ 0, 0.245, 2.48 ], [ 2.12, 0.055, 0.30 ], [ -0.04, 0, 0 ], 'relic-razor-splitter' );

	const canopy = add( root, canopyGeometry(), M.glass, [ 0, 0, 0 ], [ 1, 1, 1 ], null, 'relic-hero-canopy' );
	canopy.castShadow = false;
	canopy.userData.hideInRelicFirstPerson = true;

	// Roof/rear venting from the references: three recessed black channels rather than a smooth roof.
	for ( const x of [ -0.38, 0, 0.38 ] ) {
		add( root, box, M.carbon, [ x, 0.755, -1.34 ], [ 0.22, 0.045, 0.78 ], [ 0.04, 0, 0 ], 'relic-rear-deck-vent' );
	}
	for ( const x of [ -0.60, -0.29, 0.29, 0.60 ] ) {
		add( root, box, M.carbon, [ x, 0.575, 1.38 ], [ 0.045, 0.030, 1.08 ], [ -0.08, x * 0.04, 0 ], 'relic-hood-blade' );
	}

	// Segmented Needle Scout front signature. The earlier full-width bars are intentionally gone.
	for ( const side of [ -1, 1 ] ) {
		const sx = side * 0.64;
		add( root, box, M.white, [ sx, 0.535, 2.455 ], [ 0.38, 0.026, 0.032 ], [ 0, side * -0.03, side * 0.10 ], 'relic-front-drl' );
		add( root, box, M.white, [ side * 0.78, 0.495, 2.458 ], [ 0.24, 0.022, 0.030 ], [ 0, side * -0.02, side * -0.22 ], 'relic-front-drl' );
		add( root, box, M.white, [ side * 0.88, 0.455, 2.455 ], [ 0.16, 0.020, 0.028 ], [ 0, side * -0.02, side * -0.38 ], 'relic-front-drl' );
	}
	const identity = add( root, hex, M.amber, [ 0, 0.405, 2.505 ], [ 0.12, 0.12, 0.12 ], null, 'relic-front-hex' );
	identity.castShadow = false;

	// Reference rear: two angular signatures around a dark centre, not a generic light bar.
	for ( const side of [ -1, 1 ] ) {
		add( root, box, M.red, [ side * 0.68, 0.555, -2.36 ], [ 0.43, 0.030, 0.030 ], [ 0, side * 0.025, side * 0.23 ], 'relic-hero-tail' );
		add( root, box, M.red, [ side * 0.90, 0.505, -2.345 ], [ 0.24, 0.028, 0.030 ], [ 0, side * -0.02, side * -0.42 ], 'relic-hero-tail' );
	}
	add( root, box, M.carbon, [ 0, 0.37, -2.39 ], [ 1.42, 0.28, 0.075 ], null, 'relic-rear-void' );

	// Preserve the real Aerolift/tyre objects used by RelicVehicle; only the body shell is replaced.
	const collider = app.colliders?.boxes?.find?.( ( b ) => b.tag === 'relic-001' );
	if ( collider ) collider.half.set( 1.14, 0.66, 2.48 );

	const state = app.__referenceRelicHeroShell = { root, canopy, bodyGeo };
	if ( typeof window !== 'undefined' ) window.__referenceRelicHeroShell = state;
	return state;
}
