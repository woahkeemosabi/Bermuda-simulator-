import {
	BoxGeometry, CylinderGeometry, Group, InstancedMesh, Matrix4, Mesh, SphereGeometry, TorusGeometry,
} from '../engine/index.js';
import { Material } from '../engine/render/Material.js';

function mat( name, color, roughness = 0.85, metalness = 0, emissive = 0x000000, extra = {} ) {
	return new Material( {
		name: `reference-visual-${ name }`, color, roughness, metalness, emissive,
		underwaterLighting: 'lite', localLightsCheap: true, receiveShadows: true,
		...extra,
	} );
}

function add( parent, geo, material, p, s, r = null, name = '' ) {
	const m = new Mesh( geo, material );
	m.name = name;
	m.position.set( ...p );
	m.scale.set( ...s );
	if ( r ) m.rotation.set( ...r );
	m.castShadow = true;
	m.receiveShadow = true;
	parent.add( m );
	return m;
}

function installRelicVisualClosure( app ) {
	const vehicle = app?.relic001?.group;
	if ( ! vehicle || app.__referenceRelicVisualClosure ) return app?.__referenceRelicVisualClosure;

	const root = new Group();
	root.name = 'RELIC_VISUAL_CLOSURE';
	vehicle.add( root );

	const box = new BoxGeometry( 1, 1, 1 );
	const ring = new TorusGeometry( 1, 0.13, 6, 18 );
	const disk = new CylinderGeometry( 1, 1, 1, 18 );
	const M = {
		obsidian: mat( 'relic-obsidian', 0x020305, 0.075, 0.97 ),
		carbon: mat( 'relic-carbon', 0x07090c, 0.26, 0.84 ),
		glassTrim: mat( 'relic-glass-trim', 0x0a141a, 0.12, 0.72 ),
		blue: mat( 'relic-vector-blue', 0x071722, 0.12, 0.35, 0x58d9ff ),
		red: mat( 'relic-mode-red', 0x340204, 0.12, 0.30, 0xff201a ),
	};

	// Sculpted wheel shoulders and rear haunches break the remaining slab-like silhouette while keeping
	// the underlying running gear and collider untouched.
	for ( const side of [ -1, 1 ] ) {
		add( root, box, M.obsidian, [ side * 0.90, 0.53, 1.56 ], [ 0.34, 0.22, 1.18 ], [ -0.06, side * -0.12, side * -0.16 ], 'relic-front-haunch' );
		add( root, box, M.obsidian, [ side * 0.94, 0.56, -1.40 ], [ 0.37, 0.25, 1.02 ], [ 0.035, side * 0.10, side * 0.12 ], 'relic-rear-haunch' );
		add( root, box, M.carbon, [ side * 0.94, 0.43, 0.16 ], [ 0.15, 0.18, 1.62 ], [ 0, 0, side * 0.10 ], 'relic-side-sculpt' );
		add( root, box, M.glassTrim, [ side * 0.58, 0.91, -0.03 ], [ 0.055, 0.07, 0.95 ], [ 0, side * 0.055, side * -0.12 ], 'relic-canopy-rail' );
	}

	// Strong V-shaped hood creases from the dedicated RELIC references.
	for ( const side of [ -1, 1 ] ) {
		add( root, box, M.carbon, [ side * 0.31, 0.605, 1.55 ], [ 0.045, 0.025, 1.10 ], [ -0.075, side * -0.18, 0 ], 'relic-hood-v-crease' );
		add( root, box, M.carbon, [ side * 0.62, 0.51, 2.04 ], [ 0.045, 0.04, 0.62 ], [ -0.10, side * -0.23, 0 ], 'relic-nose-crease' );
	}

	// Rear diffuser fins give the low rear three-dimensional depth visible in the road/flying references.
	for ( const x of [ -0.78, -0.39, 0, 0.39, 0.78 ] ) {
		add( root, box, M.carbon, [ x, 0.24, -2.31 ], [ 0.055, 0.20, 0.50 ], [ 0.06, 0, 0 ], 'relic-diffuser-fin' );
	}

	// Transform-mode vector pods. ROAD keeps the clean hypercar silhouette; HOVER/AIR/SUB reveal
	// luminous rings at the four lift points, matching the references without changing vehicle physics.
	const pods = [];
	for ( const x of [ -0.78, 0.78 ] ) for ( const z of [ -1.34, 1.28 ] ) {
		const g = new Group();
		g.position.set( x, 0.15, z );
		root.add( g );
		const outer = add( g, ring, M.carbon, [ 0, 0, 0 ], [ 0.27, 0.27, 0.27 ], [ Math.PI * 0.5, 0, 0 ], 'relic-vector-pod-ring' );
		const glow = add( g, disk, M.blue, [ 0, -0.015, 0 ], [ 0.19, 0.035, 0.19 ], [ 0, 0, Math.PI * 0.5 ], 'relic-vector-pod-glow' );
		outer.castShadow = glow.castShadow = false;
		pods.push( g );
	}

	// AIR/SUB references show a stronger continuous rear signature than ROAD. Keep the road chevrons
	// from the hero shell and reveal this bridge only in transformed modes.
	const transformedTail = add( root, box, M.red, [ 0, 0.56, -2.405 ], [ 1.55, 0.025, 0.022 ], null, 'relic-transformed-tail-bridge' );
	transformedTail.castShadow = false;

	let raf = 0;
	const tick = ( now ) => {
		const relic = app.player?.relic || vehicle.userData?.vehicle || app.relic;
		const mode = relic?.driveMode || vehicle.userData?.relicMode || 'ROAD';
		const transformed = mode !== 'ROAD';
		const pulse = 1 + Math.sin( now * 0.010 ) * 0.08;
		for ( const p of pods ) {
			p.visible = transformed;
			if ( transformed ) p.scale.setScalar( pulse * ( mode === 'AIR' ? 1.08 : mode === 'SUB' ? 1.02 : 0.96 ) );
		}
		transformedTail.visible = mode === 'AIR' || mode === 'SUB';
		raf = requestAnimationFrame( tick );
	};
	raf = requestAnimationFrame( tick );
	if ( typeof window !== 'undefined' ) window.addEventListener( 'pagehide', () => raf && cancelAnimationFrame( raf ), { once: true } );

	const state = app.__referenceRelicVisualClosure = { root, pods, transformedTail };
	return state;
}

function installBermudaStreetVisualClosure( app ) {
	if ( ! app?.scene || ! app?.terrainData || app.__referenceStreetVisualClosure ) return app?.__referenceStreetVisualClosure;
	const root = new Group();
	root.name = 'BermudaStreetVisualClosure';
	app.scene.add( root );
	const terrain = app.terrainData;
	const box = new BoxGeometry( 1, 1, 1 );
	const cyl = new CylinderGeometry( 1, 1, 1, 10 );
	const sphere = new SphereGeometry( 1, 9, 7 );
	const matrix = new Matrix4();
	const M = {
		stone: mat( 'bermuda-wall-stone', 0xb9b3a8, 0.96 ),
		cap: mat( 'bermuda-wall-cap', 0xeeeae1, 0.90 ),
		chimney: mat( 'bermuda-chimney', 0xe8e4dc, 0.93 ),
		chimneyTop: mat( 'bermuda-chimney-top', 0xd0cbc0, 0.91 ),
		curb: mat( 'bermuda-curb', 0xe7e2d8, 0.94 ),
		trunk: mat( 'garden-trunk', 0x5f503e, 0.98 ),
		leaf: mat( 'garden-leaf', 0x315d3c, 0.91 ),
		seaGrape: mat( 'sea-grape', 0x456d48, 0.90 ),
		lamp: mat( 'road-lamp', 0x2f3538, 0.42, 0.66 ),
		lampGlow: mat( 'road-lamp-glow', 0xffe0a2, 0.22, 0.06, 0xffbe57 ),
	};

	const ground = ( x, z ) => Math.max( 1.25, terrain.heightAt( x, z ) );

	// Low Bermuda boundary walls and bright caps create the enclosed roadside composition visible in
	// the reference while staying decorative (no new collision or gameplay obstruction).
	const wallSegments = [];
	for ( let x = -113; x <= -18; x += 6.4 ) {
		if ( ( x > -70 && x < -60 ) || ( x > -39 && x < -31 ) ) continue;
		wallSegments.push( [ x, -60.2 ] );
	}
	const walls = new InstancedMesh( box, M.stone, wallSegments.length );
	const caps = new InstancedMesh( box, M.cap, wallSegments.length );
	for ( let i = 0; i < wallSegments.length; i ++ ) {
		const [ x, z ] = wallSegments[ i ], y = ground( x, z );
		matrix.makeScale( 5.6, 0.72, 0.30 ).setPosition( x, y + 0.36, z );
		walls.setMatrixAt( i, matrix );
		matrix.makeScale( 5.9, 0.08, 0.38 ).setPosition( x, y + 0.76, z );
		caps.setMatrixAt( i, matrix );
	}
	for ( const m of [ walls, caps ] ) {
		m.instanceMatrix.needsUpdate = true;
		m.computeBoundingSphere();
		m.castShadow = false;
		m.receiveShadow = true;
		root.add( m );
	}

	// Crisp road-edge curbs keep the road readable through dense vegetation/housing.
	for ( const z of [ -45.55, -52.80 ] ) add( root, box, M.curb, [ -66, ground( -66, z ) + 0.035, z ], [ 100, 0.055, 0.16 ], null, 'bermuda-road-curb' ).castShadow = false;

	// Chimneys are one of the strongest Bermuda roof cues. Add them to the existing reference rows.
	const houseXs = [ -112, -101, -90, -79, -67, -55, -43, -31, -108, -94, -76, -59, -40, -24 ];
	const houseZs = [ -83, -89, -84, -92, -85, -93, -84, -91, -101, -104, -105, -104, -102, -99 ];
	for ( let i = 0; i < houseXs.length; i ++ ) {
		const x = houseXs[ i ], z = houseZs[ i ], y = ground( x, z );
		const h = 4.0 + ( i % 4 ) * 0.18;
		add( root, box, M.chimney, [ x + ( i % 2 ? -2.1 : 2.0 ), y + h + 1.0, z - 0.5 ], [ 0.46, 1.45, 0.46 ], null, 'bermuda-chimney' );
		add( root, box, M.chimneyTop, [ x + ( i % 2 ? -2.1 : 2.0 ), y + h + 1.77, z - 0.5 ], [ 0.62, 0.10, 0.62 ], null, 'bermuda-chimney-cap' );
	}

	// Garden/sea-grape masses close the hard gap between buildings and road without blocking paths.
	const plantPoints = [];
	for ( let i = 0; i < 28; i ++ ) {
		const x = -111 + i * 3.35 + Math.sin( i * 1.7 ) * 0.7;
		const z = -63.5 - ( i % 3 ) * 2.7 + Math.cos( i * 0.9 ) * 0.6;
		plantPoints.push( [ x, z, 0.80 + ( i % 4 ) * 0.12 ] );
	}
	const shrubs = new InstancedMesh( sphere, M.seaGrape, plantPoints.length );
	for ( let i = 0; i < plantPoints.length; i ++ ) {
		const [ x, z, s ] = plantPoints[ i ], y = ground( x, z );
		matrix.makeScale( 1.25 * s, 0.70 * s, 0.95 * s ).setPosition( x, y + 0.58 * s, z );
		shrubs.setMatrixAt( i, matrix );
	}
	shrubs.instanceMatrix.needsUpdate = true;
	shrubs.computeBoundingSphere();
	shrubs.castShadow = false;
	shrubs.receiveShadow = true;
	root.add( shrubs );

	// Sparse utility lamps add scale and keep dusk/night streets readable without turning the road into
	// a city boulevard. Emissive bulbs are visual-only and therefore cheap on iPhone.
	for ( const x of [ -108, -86, -64, -42, -20 ] ) {
		const z = -57.4, y = ground( x, z );
		add( root, cyl, M.lamp, [ x, y + 2.25, z ], [ 0.055, 4.5, 0.055 ], null, 'bermuda-road-lamp' );
		add( root, box, M.lamp, [ x + 0.33, y + 4.43, z ], [ 0.72, 0.06, 0.06 ], null, 'bermuda-road-lamp-arm' );
		const bulb = add( root, sphere, M.lampGlow, [ x + 0.66, y + 4.35, z ], [ 0.10, 0.08, 0.10 ], null, 'bermuda-road-lamp-bulb' );
		bulb.castShadow = false;
	}

	const state = app.__referenceStreetVisualClosure = { root };
	return state;
}

export function installReferenceVisualClosurePass( app ) {
	if ( ! app || app.__referenceVisualClosurePass ) return app?.__referenceVisualClosurePass;
	const state = app.__referenceVisualClosurePass = {
		relic: installRelicVisualClosure( app ),
		street: installBermudaStreetVisualClosure( app ),
	};
	if ( typeof window !== 'undefined' ) window.__referenceVisualClosurePass = state;
	return state;
}
