import { BoxGeometry, CylinderGeometry, Group, Mesh, TorusGeometry, Vector3 } from '../engine/index.js';
import { Material } from '../engine/render/Material.js';

function material( name, color, roughness = 0.7, metalness = 0, extra = {} ) {
	return new Material( {
		name: `bermuda-center-console-${ name }`, color, roughness, metalness,
		underwaterLighting: 'lite', localLightsCheap: true, receiveShadows: true,
		...extra,
	} );
}

function addMesh( parent, geometry, mat, p, s, r = null, name = '' ) {
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

function collider( tag, center, half, walkable = false, solid = true ) {
	return { tag, center: new Vector3( ...center ), half: new Vector3( ...half ), walkable, solid };
}

// Keep the existing hydrodynamic hull/controller, but replace the visible Downeast working-boat
// superstructure with the white centre-console / T-top / single-outboard presentation seen in the
// uploaded 54-second gameplay reference.
export function installReferenceCenterConsoleOverlay( app ) {
	if ( ! app?.boat?.group || app.__bermudaReferenceCenterConsole ) return app?.__bermudaReferenceCenterConsole;
	const model = app.boat;
	const L = model.lines;
	const deckY = L.deckY;

	// The hull itself remains the physics-matched procedural shell. Everything that makes the old
	// boat read as a lobster boat (cabin, traps, hauler, radar mast, teak interior, old wheel) is hidden.
	for ( const [ name, object ] of Object.entries( model.meshes || {} ) ) {
		if ( name === 'hull' ) continue;
		if ( object ) object.visible = false;
	}
	if ( model.wheelPivot ) model.wheelPivot.visible = false;

	const root = new Group();
	root.name = 'BermudaReferenceCenterConsole';
	model.group.add( root );

	const geo = {
		box: new BoxGeometry( 1, 1, 1 ),
		cyl: new CylinderGeometry( 1, 1, 1, 12 ),
		torus: new TorusGeometry( 1, 0.12, 8, 24 ),
	};
	const M = {
		white: material( 'white-gelcoat', 0xf5f4ef, 0.31 ),
		whiteSoft: material( 'white-vinyl', 0xefeee8, 0.58 ),
		dark: material( 'dark-console', 0x171d22, 0.42 ),
		black: material( 'outboard-black', 0x0d1216, 0.28, 0.08 ),
		steel: material( 'stainless', 0xc6ced2, 0.20, 0.88 ),
		glass: material( 'windshield', 0x173a49, 0.14, 0.08, { transparent: true, opacity: 0.54, depthWrite: false } ),
		glow: material( 'electronics', 0x2c6972, 0.18, 0.02, { emissive: 0x163e45 } ),
	};

	// Open white deck. Three stepped slabs follow the existing hull's taper without altering buoyancy.
	addMesh( root, geo.box, M.white, [ 0, deckY + 0.025, -1.72 ], [ 2.38, 0.06, 3.20 ], null, 'open-aft-deck' );
	addMesh( root, geo.box, M.white, [ 0, deckY + 0.03, 0.62 ], [ 2.28, 0.07, 1.78 ], null, 'open-mid-deck' );
	addMesh( root, geo.box, M.white, [ 0, deckY + 0.13, 2.22 ], [ 1.92, 0.16, 1.55 ], [ -0.035, 0, 0 ], 'bow-casting-deck' );

	// Modern compact centre console.
	addMesh( root, geo.box, M.white, [ 0, deckY + 0.64, 0.72 ], [ 1.22, 1.25, 0.66 ], null, 'center-console-body' );
	addMesh( root, geo.box, M.dark, [ 0, deckY + 1.08, 1.055 ], [ 1.10, 0.43, 0.055 ], [ -0.16, 0, 0 ], 'center-console-panel' );
	addMesh( root, geo.box, M.glow, [ 0.20, deckY + 1.12, 1.095 ], [ 0.46, 0.23, 0.025 ], [ -0.16, 0, 0 ], 'chartplotter' );
	addMesh( root, geo.box, M.glass, [ 0, deckY + 1.54, 0.90 ], [ 1.18, 0.50, 0.035 ], [ -0.13, 0, 0 ], 'console-windshield' );

	// Wheel: sporty black/stainless ring on the starboard half of the console.
	const wheel = addMesh( root, geo.torus, M.dark, [ -0.39, deckY + 1.05, 1.13 ], [ 0.20, 0.20, 0.20 ], [ Math.PI * 0.5 - 0.16, 0, 0 ], 'modern-wheel' );
	wheel.castShadow = false;
	addMesh( root, geo.cyl, M.steel, [ -0.39, deckY + 1.05, 1.10 ], [ 0.040, 0.055, 0.040 ], [ Math.PI * 0.5, 0, 0 ], 'wheel-hub' );

	// Leaning post and upholstery visible behind the console in chase view.
	addMesh( root, geo.box, M.whiteSoft, [ 0, deckY + 0.93, -0.10 ], [ 1.15, 0.20, 0.52 ], null, 'leaning-post-seat' );
	addMesh( root, geo.box, M.whiteSoft, [ 0, deckY + 1.22, -0.31 ], [ 1.12, 0.50, 0.16 ], [ -0.08, 0, 0 ], 'leaning-post-back' );
	for ( const x of [ -0.43, 0.43 ] ) addMesh( root, geo.cyl, M.steel, [ x, deckY + 0.45, -0.10 ], [ 0.025, 0.88, 0.025 ], null, 'leaning-post-leg' );

	// Stainless T-top frame and white hardtop. This is the strongest silhouette cue in the reference.
	for ( const x of [ -0.67, 0.67 ] ) for ( const z of [ -0.36, 0.84 ] ) {
		addMesh( root, geo.cyl, M.steel, [ x, deckY + 0.88, z ], [ 0.024, 1.76, 0.024 ], null, 't-top-leg' );
	}
	addMesh( root, geo.box, M.white, [ 0, 2.52, 0.08 ], [ 2.18, 0.11, 2.36 ], null, 't-top' );
	addMesh( root, geo.box, M.dark, [ 0, 2.455, 0.08 ], [ 1.76, 0.035, 1.95 ], null, 't-top-shadow-panel' );

	// Clean seating/casting layout rather than lobster-working gear.
	addMesh( root, geo.box, M.whiteSoft, [ 0, deckY + 0.38, -2.46 ], [ 1.50, 0.24, 0.48 ], null, 'aft-bench' );
	addMesh( root, geo.box, M.whiteSoft, [ 0, deckY + 0.42, 2.28 ], [ 1.38, 0.28, 0.64 ], null, 'bow-seat' );

	// Single black outboard at the transom. The old underwater prop/rudder visuals are hidden but their
	// controller thrust point remains authoritative, preserving handling and wake behaviour.
	const motorZ = L.zAft - 0.40;
	addMesh( root, geo.box, M.black, [ 0, deckY + 0.50, motorZ ], [ 0.64, 0.92, 0.58 ], [ -0.06, 0, 0 ], 'single-outboard-cowl' );
	addMesh( root, geo.box, M.black, [ 0, deckY - 0.31, motorZ - 0.03 ], [ 0.22, 1.12, 0.20 ], [ 0.06, 0, 0 ], 'single-outboard-leg' );

	// Replace collision volumes for the removed cabin/work gear. Hull/deck/bulwark/foredeck stay intact.
	const removeTags = new Set( [ 'houseWall', 'console', 'helmSeat', 'bench', 'roof', 'trap', 'hauler', 'baitBarrel' ] );
	model.colliders = ( model.colliders || [] ).filter( c => ! removeTags.has( c.tag ) );
	model.colliders.push(
		collider( 'centerConsole', [ 0, deckY + 0.63, 0.72 ], [ 0.61, 0.63, 0.33 ] ),
		collider( 'leaningPost', [ 0, deckY + 0.53, -0.10 ], [ 0.58, 0.53, 0.28 ], true ),
		collider( 'aftBench', [ 0, deckY + 0.22, -2.46 ], [ 0.75, 0.22, 0.25 ], true ),
		collider( 'bowSeat', [ 0, deckY + 0.24, 2.28 ], [ 0.69, 0.24, 0.33 ], true ),
	);

	// Keep interaction anchors aligned with the new visible helm.
	model.helmEye.set( -0.38, 1.86, 0.34 );
	model.group.name = 'BermudaCenterConsoleBoat';
	if ( model.dimensions ) model.dimensions.houseRoofHeight = 2.58;

	const state = app.__bermudaReferenceCenterConsole = { root, materials: M, hiddenLegacy: true };
	if ( typeof window !== 'undefined' ) window.__bermudaReferenceCenterConsole = state;
	return state;
}
