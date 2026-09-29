import { BoxGeometry, CylinderGeometry, Group, Mesh, SphereGeometry } from '../engine/index.js';
import { Material } from '../engine/render/Material.js';

// Reference pass 3: street life and human-scale waterfront detail.
// Bermuda_Simulator_Gameplay_54s.mp4 becomes noticeably richer in its final third: scooters,
// pedestrians, market furniture and small roadside cues make the environment feel inhabited.
// Keep these props lightweight and authored so the mobile WebGPU path remains predictable.

function mat( name, color, roughness = 0.9, metalness = 0 ) {
	return new Material( {
		name: `bermuda-life-${ name }`, color, roughness, metalness,
		underwaterLighting: 'lite', localLightsCheap: true, receiveShadows: true,
	} );
}

export function installReferenceStreetLife( app ) {
	if ( ! app?.scene || ! app?.terrainData || app.bermudaStreetLife ) return app?.bermudaStreetLife;

	const terrain = app.terrainData;
	const root = new Group();
	root.name = 'BermudaReferenceStreetLife';
	const GEO = {
		box: new BoxGeometry( 1, 1, 1 ),
		cyl: new CylinderGeometry( 1, 1, 1, 10 ),
		sphere: new SphereGeometry( 1, 10, 7 ),
	};
	const M = {
		black: mat( 'rubber', 0x111416, 0.88 ),
		metal: mat( 'metal', 0x6f7678, 0.34, 0.78 ),
		seat: mat( 'seat', 0x252729, 0.76 ),
		scooterBlue: mat( 'scooter-blue', 0x447b94, 0.48, 0.16 ),
		scooterRed: mat( 'scooter-red', 0xa54749, 0.48, 0.16 ),
		scooterCream: mat( 'scooter-cream', 0xd9d0b9, 0.56, 0.08 ),
		white: mat( 'white', 0xf4f1e7, 0.91 ),
		yellow: mat( 'road-yellow', 0xd8b245, 0.84 ),
		wood: mat( 'market-wood', 0x987655, 0.94 ),
		crate: mat( 'crate', 0x6f583e, 0.98 ),
		awning: mat( 'awning', 0xd98d8e, 0.78 ),
		awningWhite: mat( 'awning-white', 0xf2eee4, 0.86 ),
		chalk: mat( 'chalk-board', 0x263331, 0.90 ),
		skinA: mat( 'skin-a', 0x8f6049, 0.82 ),
		skinB: mat( 'skin-b', 0x593b31, 0.84 ),
		skinC: mat( 'skin-c', 0xc38a6c, 0.82 ),
		shirtTeal: mat( 'shirt-teal', 0x397475, 0.92 ),
		shirtCoral: mat( 'shirt-coral', 0xc56f68, 0.92 ),
		shirtBlue: mat( 'shirt-blue', 0x476b87, 0.92 ),
		shirtCream: mat( 'shirt-cream', 0xe5d9c4, 0.94 ),
		shirtGreen: mat( 'shirt-green', 0x536f53, 0.94 ),
		pantsDark: mat( 'pants-dark', 0x293238, 0.95 ),
		pantsSand: mat( 'pants-sand', 0xa99d85, 0.95 ),
	};

	const mesh = ( parent, geo, material, position, scale, rotation = null, cast = true ) => {
		const m = new Mesh( geo, material );
		m.position.set( position[ 0 ], position[ 1 ], position[ 2 ] );
		m.scale.set( scale[ 0 ], scale[ 1 ], scale[ 2 ] );
		if ( rotation ) m.rotation.set( rotation[ 0 ], rotation[ 1 ], rotation[ 2 ] );
		m.castShadow = cast;
		m.receiveShadow = true;
		parent.add( m );
		return m;
	};

	const ground = ( x, z ) => Math.max( terrain.heightAt( x, z ), app.colliders?.groundHeightAt( x, z, 20 ) ?? -Infinity );

	// ---------------------------------------------------------------- scooters
	const scooter = ( x, z, yaw, bodyMat ) => {
		const g = new Group();
		g.name = 'bermuda-scooter';
		const y = ground( x, z );
		g.position.set( x, y + 0.02, z );
		g.rotation.y = yaw;
		root.add( g );

		for ( const zz of [ -0.58, 0.58 ] ) {
			mesh( g, GEO.cyl, M.black, [ 0, 0.28, zz ], [ 0.24, 0.075, 0.24 ], [ 0, 0, Math.PI * 0.5 ] );
			mesh( g, GEO.cyl, M.metal, [ 0, 0.28, zz ], [ 0.12, 0.085, 0.12 ], [ 0, 0, Math.PI * 0.5 ] );
		}
		mesh( g, GEO.box, bodyMat, [ 0, 0.54, -0.02 ], [ 0.48, 0.34, 0.95 ], [ -0.06, 0, 0 ] );
		mesh( g, GEO.box, bodyMat, [ 0, 0.69, 0.48 ], [ 0.40, 0.52, 0.28 ], [ -0.18, 0, 0 ] );
		mesh( g, GEO.box, M.seat, [ 0, 0.80, -0.20 ], [ 0.44, 0.12, 0.60 ] );
		mesh( g, GEO.box, M.metal, [ 0, 1.02, 0.52 ], [ 0.07, 0.58, 0.07 ], [ -0.14, 0, 0 ] );
		mesh( g, GEO.box, M.metal, [ 0, 1.27, 0.58 ], [ 0.66, 0.06, 0.06 ] );
		mesh( g, GEO.sphere, M.white, [ 0, 0.96, 0.71 ], [ 0.13, 0.13, 0.09 ] );
		mesh( g, GEO.box, M.black, [ -0.33, 1.25, 0.58 ], [ 0.12, 0.08, 0.08 ] );
		mesh( g, GEO.box, M.black, [ 0.33, 1.25, 0.58 ], [ 0.12, 0.08, 0.08 ] );
		return g;
	};

	// Leave the RELIC parking area clear; scooters sit along the road edges and near the market.
	scooter( -101.0, -51.35, Math.PI * 0.50, M.scooterBlue );
	scooter( -47.5, -51.25, Math.PI * 0.48, M.scooterRed );
	scooter( -31.5, -51.10, Math.PI * 0.52, M.scooterCream );

	// ---------------------------------------------------------------- people
	const person = ( x, z, yaw, shirt, pants, skin, pose = 0 ) => {
		const g = new Group();
		g.name = 'bermuda-pedestrian';
		const y = ground( x, z );
		g.position.set( x, y, z );
		g.rotation.y = yaw;
		root.add( g );

		const stride = pose ? 0.16 : 0;
		mesh( g, GEO.box, pants, [ -0.11, 0.43, stride ], [ 0.15, 0.75, 0.17 ], [ pose ? -0.14 : 0, 0, 0 ] );
		mesh( g, GEO.box, pants, [ 0.11, 0.43, -stride ], [ 0.15, 0.75, 0.17 ], [ pose ? 0.14 : 0, 0, 0 ] );
		mesh( g, GEO.box, shirt, [ 0, 1.14, 0 ], [ 0.48, 0.66, 0.27 ] );
		mesh( g, GEO.box, skin, [ -0.33, 1.12, -stride * 0.7 ], [ 0.12, 0.62, 0.12 ], [ pose ? 0.25 : 0.06, 0, 0.10 ] );
		mesh( g, GEO.box, skin, [ 0.33, 1.12, stride * 0.7 ], [ 0.12, 0.62, 0.12 ], [ pose ? -0.25 : -0.06, 0, -0.10 ] );
		mesh( g, GEO.sphere, skin, [ 0, 1.68, 0 ], [ 0.20, 0.23, 0.20 ] );
		mesh( g, GEO.box, M.black, [ 0, 1.84, -0.015 ], [ 0.21, 0.07, 0.21 ], [ 0.02, 0, 0 ] );
		return g;
	};

	// Pedestrians are spaced so the road remains playable. Two walking poses create motion/readability
	// without the cost and loading risk of introducing a new skeletal animation system in this pass.
	person( -106.0, -56.3, Math.PI * 0.13, M.shirtTeal, M.pantsDark, M.skinB, 1 );
	person( -93.5, -55.8, -Math.PI * 0.10, M.shirtCoral, M.pantsSand, M.skinC, 0 );
	person( -57.0, -56.1, Math.PI * 0.16, M.shirtCream, M.pantsDark, M.skinA, 1 );
	person( -42.0, -55.6, -Math.PI * 0.12, M.shirtBlue, M.pantsSand, M.skinB, 0 );
	person( -24.0, -56.0, Math.PI * 0.08, M.shirtGreen, M.pantsDark, M.skinC, 1 );

	// One waterfront customer/vendor figure gives the fish-market area an immediate human focal point.
	person( -62.3, -21.3, -Math.PI * 0.50, M.shirtCoral, M.pantsDark, M.skinA, 0 );

	// ---------------------------------------------------------------- market / street furniture
	// Fish-market awning and service counter. These are decorative overlays around the existing market
	// building, not a replacement for its interaction/collision systems.
	const marketY = Math.max( 1.0, ground( -65.8, -21.5 ) );
	mesh( root, GEO.box, M.awningWhite, [ -62.95, marketY + 2.35, -21.5 ], [ 0.10, 0.10, 3.10 ], [ 0, 0, 0 ] );
	for ( let i = 0; i < 6; i ++ ) {
		mesh( root, GEO.box, i % 2 ? M.awningWhite : M.awning, [ -62.82, marketY + 2.20, -23.95 + i * 0.98 ], [ 1.45, 0.08, 0.51 ], [ 0, 0, -0.10 ] );
	}
	mesh( root, GEO.box, M.wood, [ -62.72, marketY + 0.91, -21.5 ], [ 0.48, 0.14, 2.65 ] );
	for ( const zz of [ -22.6, -21.5, -20.4 ] ) {
		mesh( root, GEO.cyl, M.metal, [ -61.65, marketY + 0.45, zz ], [ 0.06, 0.74, 0.06 ] );
		mesh( root, GEO.cyl, M.seat, [ -61.65, marketY + 0.85, zz ], [ 0.30, 0.08, 0.30 ] );
	}
	mesh( root, GEO.box, M.chalk, [ -61.90, marketY + 1.22, -24.05 ], [ 0.08, 1.25, 0.78 ], [ 0, 0, -0.05 ] );
	for ( const zz of [ -23.45, -19.75 ] ) {
		mesh( root, GEO.box, M.crate, [ -62.25, marketY + 0.32, zz ], [ 0.65, 0.55, 0.62 ] );
		mesh( root, GEO.box, M.crate, [ -62.25, marketY + 0.84, zz ], [ 0.58, 0.44, 0.56 ] );
	}

	// Road paint: sparse, worn centre markers. No curb/barrier is added around RELIC.
	for ( const x of [ -109, -99, -89, -59, -49, -39, -29, -19 ] ) {
		const y = ground( x, -49.20 ) + 0.015;
		mesh( root, GEO.box, M.yellow, [ x, y, -49.20 ], [ 3.0, 0.015, 0.08 ], null, false );
	}

	app.scene.add( root );
	app.bermudaStreetLife = { group: root };
	return app.bermudaStreetLife;
}
