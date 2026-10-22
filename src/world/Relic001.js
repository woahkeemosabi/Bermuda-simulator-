import { BufferAttribute, BufferGeometry, BoxGeometry, CylinderGeometry, Group, Mesh, RoundedBoxGeometry, TorusGeometry, Vector3 } from '../engine/index.js';
import { Material } from '../engine/render/Material.js';

// RELIC sits on the clear waterfront road and remains aligned with the driveable road corridor.
export const RELIC_POS = { x: -69.5, z: -49.6, yaw: Math.PI * 0.5 };

function isMobileProfile() {
	if ( typeof navigator === 'undefined' ) return false;
	const params = typeof location !== 'undefined' ? new URLSearchParams( location.search ) : null;
	if ( params?.has( 'desktop' ) ) return false; // the user's ULTRA path should keep the full hero mesh
	return /iPhone|iPad|iPod|Android/i.test( navigator.userAgent ) ||
		( navigator.maxTouchPoints > 1 && Math.min( screen.width, screen.height ) < 1024 );
}

function mat( name, color, roughness, metalness, emissive = 0x000000, extra = {} ) {
	return new Material( {
		name: `relic-${ name }`, color, roughness, metalness, emissive,
		underwaterLighting: 'lite', localLightsCheap: false, receiveShadows: true,
		...extra,
	} );
}

function addMesh( group, geometry, material, position, scale, rotation = null, name = '' ) {
	const mesh = new Mesh( geometry, material );
	mesh.name = name;
	mesh.position.set( position[ 0 ], position[ 1 ], position[ 2 ] );
	mesh.scale.set( scale[ 0 ], scale[ 1 ], scale[ 2 ] );
	if ( rotation ) mesh.rotation.set( rotation[ 0 ], rotation[ 1 ], rotation[ 2 ] );
	mesh.castShadow = true;
	mesh.receiveShadow = true;
	group.add( mesh );
	return mesh;
}

// Low-poly authored wedge used for the nose, centre tub and rear deck. Unlike stacked boxes it gives
// RELIC an actual taper and a continuous faceted silhouette while remaining extremely cheap on iOS.
function taperedPrism( frontW, rearW, frontH, rearH, length ) {
	const zF = length * 0.5, zR = - length * 0.5;
	const f = frontW * 0.5, r = rearW * 0.5;
	const p = new Float32Array( [
		-f, 0, zF,   f, 0, zF,   r, 0, zR,   -r, 0, zR,
		-f, frontH, zF,   f, frontH, zF,   r, rearH, zR,   -r, rearH, zR,
	] );
	const g = new BufferGeometry();
	g.setAttribute( 'position', new BufferAttribute( p, 3 ) );
	g.setIndex( [
		0, 3, 2, 0, 2, 1,
		4, 5, 6, 4, 6, 7,
		0, 1, 5, 0, 5, 4,
		1, 2, 6, 1, 6, 5,
		2, 3, 7, 2, 7, 6,
		3, 0, 4, 3, 4, 7,
	] );
	g.computeVertexNormals();
	g.computeBoundingSphere();
	return g;
}

export function installRelic001( app ) {
	if ( ! app || ! app.scene || ! app.terrainData || app.relic001 ) return app && app.relic001;

	const mobile = isMobileProfile();
	const group = new Group();
	group.name = 'RELIC_001';

	const M = {
		body: mat( 'obsidian-body', 0x07090d, 0.11, 0.93 ),
		body2: mat( 'obsidian-secondary', 0x10141a, 0.17, 0.88 ),
		carbon: mat( 'carbon', 0x090c11, 0.30, 0.84 ),
		glass: mat( 'smoked-glass', 0x071721, 0.06, 0.62, 0x000305, { transparent: true, opacity: 0.46, depthWrite: false } ),
		interior: mat( 'interior', 0x111216, 0.62, 0.18 ),
		seat: mat( 'seat', 0x241816, 0.72, 0.08 ),
		rubber: mat( 'tire', 0x030304, 0.88, 0.03 ),
		wheel: mat( 'wheel', 0x181b20, 0.16, 0.98 ),
		brake: mat( 'brake', 0x20120b, 0.34, 0.82, 0x7a1e05 ),
		needle: mat( 'needle-light', 0xbfeeff, 0.10, 0.36, 0xd9fbff ),
		amber: mat( 'amber-signature', 0x5f2807, 0.18, 0.52, 0xff7418 ),
		red: mat( 'rear-red', 0x420407, 0.18, 0.46, 0xff2418 ),
		lift: mat( 'aerolift-chamber', 0x12161a, 0.19, 0.96, 0x52200a ),
	};

	const GEO = {
		box: new BoxGeometry( 1, 1, 1 ),
		rounded: new RoundedBoxGeometry( 1, 1, 1, mobile ? 2 : 4, 0.12 ),
		cyl: new CylinderGeometry( 1, 1, 1, mobile ? 12 : 28 ),
		torus: new TorusGeometry( 1, 0.22, mobile ? 8 : 12, mobile ? 16 : 32 ),
		nose: taperedPrism( 1.58, 2.08, 0.20, 0.58, 1.82 ),
		tub: taperedPrism( 2.08, 2.18, 0.58, 0.70, 2.86 ),
		rear: taperedPrism( 2.18, 1.92, 0.70, 0.48, 1.12 ),
	};

	// Three continuous faceted volumes establish the low, predatory silhouette instead of one rounded
	// shoebox. Front is +Z. The wheel centres sit only ~0.5 m above the road, keeping the body planted.
	addMesh( group, GEO.nose, M.body, [ 0, 0.32, 1.58 ], [ 1, 1, 1 ], null, 'relic-nose' );
	addMesh( group, GEO.tub, M.body, [ 0, 0.31, -0.02 ], [ 1, 1, 1 ], null, 'relic-monocoque' );
	addMesh( group, GEO.rear, M.body2, [ 0, 0.31, -1.88 ], [ 1, 1, 1 ], null, 'relic-rear-deck' );

	// Carbon ground plane, front splitter and rear diffuser make the car read as one coherent chassis.
	addMesh( group, GEO.box, M.carbon, [ 0, 0.29, 0.00 ], [ 2.18, 0.10, 4.55 ], null, 'relic-floor' );
	addMesh( group, GEO.box, M.carbon, [ 0, 0.32, 2.32 ], [ 2.28, 0.09, 0.54 ], [ -0.05, 0, 0 ], 'relic-front-splitter' );
	addMesh( group, GEO.box, M.carbon, [ 0, 0.34, -2.25 ], [ 2.24, 0.10, 0.58 ], [ 0.07, 0, 0 ], 'relic-rear-diffuser' );
	addMesh( group, GEO.box, M.carbon, [ -1.08, 0.40, -0.10 ], [ 0.10, 0.14, 3.18 ], [ 0, 0, 0.015 ], 'relic-left-skirt' );
	addMesh( group, GEO.box, M.carbon, [ 1.08, 0.40, -0.10 ], [ 0.10, 0.14, 3.18 ], [ 0, 0, -0.015 ], 'relic-right-skirt' );

	// Separate shoulder/fender volumes expose the wheels instead of burying them inside a slab body.
	for ( const x of [ -0.98, 0.98 ] ) {
		addMesh( group, GEO.rounded, M.body2, [ x, 0.72, 1.47 ], [ 0.46, 0.28, 1.02 ], [ -0.08, 0, x < 0 ? 0.06 : -0.06 ], 'relic-front-fender' );
		addMesh( group, GEO.rounded, M.body2, [ x, 0.76, -1.42 ], [ 0.50, 0.32, 1.08 ], [ 0.05, 0, x < 0 ? 0.05 : -0.05 ], 'relic-rear-fender' );
	}

	// Cockpit: transparent smoked canopy over a real two-seat interior. First-person view now has
	// recognisable seats, dashboard, centre spine and yoke rather than looking through a solid prop.
	addMesh( group, GEO.rounded, M.interior, [ 0, 0.78, -0.12 ], [ 1.44, 0.20, 1.86 ], null, 'relic-cockpit-tub' );
	addMesh( group, GEO.rounded, M.seat, [ -0.38, 0.90, -0.38 ], [ 0.42, 0.50, 0.72 ], [ -0.13, 0, 0 ], 'relic-seat-left' );
	addMesh( group, GEO.rounded, M.seat, [ 0.38, 0.90, -0.38 ], [ 0.42, 0.50, 0.72 ], [ -0.13, 0, 0 ], 'relic-seat-right' );
	addMesh( group, GEO.box, M.carbon, [ 0, 0.92, -0.24 ], [ 0.16, 0.32, 1.18 ], null, 'relic-centre-spine' );
	addMesh( group, GEO.box, M.interior, [ 0, 1.08, 0.48 ], [ 1.30, 0.18, 0.30 ], [ -0.16, 0, 0 ], 'relic-dashboard' );
	addMesh( group, GEO.torus, M.wheel, [ -0.36, 1.02, 0.43 ], [ 0.20, 0.20, 0.20 ], [ Math.PI * 0.5, 0, 0 ], 'relic-yoke' );
	addMesh( group, GEO.box, M.amber, [ 0, 1.10, 0.31 ], [ 0.52, 0.035, 0.045 ], null, 'relic-dash-light' );
	const canopy = addMesh( group, GEO.rounded, M.glass, [ 0, 1.17, -0.06 ], [ 1.52, 0.54, 2.05 ], [ -0.045, 0, 0 ], 'relic-canopy' );
	canopy.castShadow = ! mobile;

	// Deep side intakes and rear cooling slots add contrast to the side profile without external pods.
	for ( const x of [ -1.075, 1.075 ] ) {
		addMesh( group, GEO.box, M.carbon, [ x, 0.64, 0.18 ], [ 0.08, 0.38, 0.92 ], [ 0, 0, x < 0 ? -0.10 : 0.10 ], 'relic-side-intake' );
		addMesh( group, GEO.box, M.carbon, [ x * 0.84, 0.78, -1.87 ], [ 0.38, 0.08, 0.42 ], [ 0.05, 0, 0 ], 'relic-rear-vent' );
	}

	// Four integrated Aerolift chambers remain visually subordinate beneath the chassis.
	for ( const z of [ -1.28, 1.24 ] ) for ( const x of [ -0.72, 0.72 ] ) {
		const chamber = addMesh( group, GEO.cyl, M.lift, [ x, 0.25, z ], [ 0.28, 0.050, 0.28 ], null, 'relic-aerolift-chamber' );
		chamber.castShadow = false;
	}

	// Needle Scout light language: cool white blades with an amber inner signature, plus a continuous
	// razor-thin rear red bar. These remain emissive at dusk/night and are legible from gameplay range.
	for ( const x of [ -0.67, 0.67 ] ) {
		addMesh( group, GEO.box, M.needle, [ x, 0.72, 2.37 ], [ 0.60, 0.035, 0.035 ], [ 0, x < 0 ? 0.08 : -0.08, 0 ], 'relic-front-needle' );
		addMesh( group, GEO.box, M.amber, [ x * 0.72, 0.68, 2.39 ], [ 0.28, 0.026, 0.030 ], [ 0, x < 0 ? 0.05 : -0.05, 0 ], 'relic-front-amber' );
	}
	addMesh( group, GEO.box, M.red, [ 0, 0.74, -2.30 ], [ 1.82, 0.042, 0.042 ], null, 'relic-rear-light-bar' );
	addMesh( group, GEO.box, M.red, [ -0.82, 0.68, -2.29 ], [ 0.16, 0.11, 0.036 ], null, 'relic-rear-light-l' );
	addMesh( group, GEO.box, M.red, [ 0.82, 0.68, -2.29 ], [ 0.16, 0.11, 0.036 ], null, 'relic-rear-light-r' );

	// Correct wheel orientation: TorusGeometry's normal starts on Z, so rotate about Y to put the axle
	// on X. The previous X rotation made the tyres read like horizontal rings from several angles.
	const wheelZ = [ -1.48, 1.53 ];
	for ( const z of wheelZ ) for ( const x of [ -1.12, 1.12 ] ) {
		const tire = addMesh( group, GEO.torus, M.rubber, [ x, 0.52, z ], [ 0.47, 0.47, 0.47 ], [ 0, Math.PI * 0.5, 0 ], 'relic-tire' );
		const rim = addMesh( group, GEO.cyl, M.wheel, [ x, 0.52, z ], [ 0.31, 0.12, 0.31 ], [ 0, 0, Math.PI * 0.5 ], 'relic-rim' );
		addMesh( group, GEO.cyl, M.brake, [ x * 0.985, 0.52, z ], [ 0.22, 0.125, 0.22 ], [ 0, 0, Math.PI * 0.5 ], 'relic-brake-disc' );
		tire.castShadow = rim.castShadow = ! mobile;
	}

	const terrainY = app.terrainData.heightAt( RELIC_POS.x, RELIC_POS.z );
	const roadY = app.colliders ? app.colliders.groundHeightAt( RELIC_POS.x, RELIC_POS.z, 50 ) : -Infinity;
	const y = Math.max( terrainY, Number.isFinite( roadY ) ? roadY : terrainY );
	group.position.set( RELIC_POS.x, y + 0.02, RELIC_POS.z );
	group.rotation.y = RELIC_POS.yaw;
	app.scene.add( group );

	if ( app.colliders ) {
		app.colliders.addBox(
			new Vector3( RELIC_POS.x, y + 0.76, RELIC_POS.z ),
			new Vector3( 1.30, 0.76, 2.45 ),
			RELIC_POS.yaw,
			{ tag: 'relic-001' }
		);
	}

	app.relic001 = { group, materials: M, position: RELIC_POS, groundY: y, mobile, generation: 'hero-procedural-v2' };
	return app.relic001;
}
