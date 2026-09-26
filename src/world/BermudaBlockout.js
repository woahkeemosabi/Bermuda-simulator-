import { BoxGeometry, CylinderGeometry, Group, Mesh, SphereGeometry, Vector3 } from '../engine/index.js';
import { Material } from '../engine/render/Material.js';

// Bermuda World v0.1 blockout.
//
// This is deliberately primitive geometry: it proves scale, spawn composition and the harbour
// layout before we spend Meshy credits on production GLBs. It also keeps the known-good iPhone
// GPU profile intact: no new textures, simulations, post effects or large buffers.

// Keep the player well inside the landing footprint, not on its seaward edge. The Player controller
// treats position.y as the feet height, so this point must resolve to a walkable collider top.
const START = { x: - 64.5, z: - 20.0, yaw: Math.PI };

function makeMaterial( name, color, roughness = 0.86 ) {

	return new Material( {
		name: 'bermuda-' + name,
		color,
		roughness,
		metalness: 0,
		underwaterLighting: 'lite',
		localLightsCheap: true,
		receiveShadows: false,
	} );

}

export function installBermudaBlockout( app ) {

	if ( ! app || ! app.scene || ! app.terrainData || ! app.colliders || app.bermudaBlockout ) return app && app.bermudaBlockout;

	const scene = app.scene;
	const terrain = app.terrainData;
	const colliders = app.colliders;
	const group = new Group();
	group.name = 'BermudaWorldBlockout';

	const M = {
		limestone: makeMaterial( 'limestone', 0xe8e3d6, 0.94 ),
		roof: makeMaterial( 'white-roof', 0xf5f4ed, 0.9 ),
		pink: makeMaterial( 'pastel-pink', 0xe9a7aa, 0.9 ),
		yellow: makeMaterial( 'pastel-yellow', 0xe3cc79, 0.9 ),
		blue: makeMaterial( 'pastel-blue', 0x9fc4d5, 0.9 ),
		mint: makeMaterial( 'pastel-mint', 0xaecdb6, 0.9 ),
		wood: makeMaterial( 'dock-wood', 0x8a7052, 0.96 ),
		asphalt: makeMaterial( 'road', 0x777d80, 0.98 ),
		dark: makeMaterial( 'doors-windows', 0x234452, 0.74 ),
		green: makeMaterial( 'palmetto', 0x4f7655, 0.93 ),
		trunk: makeMaterial( 'palm-trunk', 0x806b4c, 1.0 ),
		red: makeMaterial( 'channel-red', 0xc7473f, 0.82 ),
	};

	const addMesh = ( geo, mat, x, y, z, ry = 0 ) => {

		const mesh = new Mesh( geo, mat );
		mesh.position.set( x, y, z );
		mesh.rotation.y = ry;
		mesh.castShadow = false;
		mesh.receiveShadow = false;
		group.add( mesh );
		return mesh;

	};

	const box = ( mat, x, y, z, w, h, d, ry = 0, collide = false, tag = 'bermuda', walkable = false ) => {

		const mesh = addMesh( new BoxGeometry( w, h, d ), mat, x, y, z, ry );
		if ( collide ) colliders.addBox( new Vector3( x, y, z ), new Vector3( w * 0.5, h * 0.5, d * 0.5 ), ry, { tag, walkable } );
		return mesh;

	};

	const cyl = ( mat, x, y, z, r, h, segs = 8, collide = false, tag = 'bermuda' ) => {

		const mesh = addMesh( new CylinderGeometry( r, r, h, segs ), mat, x, y, z );
		if ( collide ) colliders.addCylinder( x, z, r, y - h * 0.5, y + h * 0.5, { tag } );
		return mesh;

	};

	const sphere = ( mat, x, y, z, r ) => addMesh( new SphereGeometry( r, 10, 7 ), mat, x, y, z );

	// ---------------------------------------------------------------- waterfront
	// Low limestone seawall + a short working landing. The player begins safely on the landing beside
	// the existing physics boat, rather than walking down Tidewater's long pier.
	box( M.limestone, - 66.5, 0.55, - 45.2, 27, 1.8, 3.2, 0, true, 'bermuda-seawall', true );
	box( M.asphalt, - 68.0, 1.43, - 49.2, 34, 0.18, 5.0, 0, true, 'bermuda-road', true );
	box( M.wood, - 65.0, 0.55, - 30.0, 5.2, 0.9, 34.0, 0, true, 'bermuda-landing', true );
	box( M.wood, - 63.7, 0.58, - 14.4, 8.0, 0.96, 5.5, 0, true, 'bermuda-landing-head', true );

	// Cleats / bollards. Geometry only; the landing collider is enough for walking.
	for ( const z of [ - 42, - 33, - 24, - 16 ] ) {

		cyl( M.dark, - 67.0, 1.35, z, 0.11, 0.7, 8 );
		cyl( M.dark, - 63.0, 1.35, z, 0.11, 0.7, 8 );

	}

	// ---------------------------------------------------------------- Bermuda houses
	const steppedRoof = ( x, baseY, z, w, d, ry = 0 ) => {

		for ( let i = 0; i < 5; i ++ ) {

			const inset = i * 0.78;
			box( M.roof, x, baseY + i * 0.21, z, Math.max( 2.8, w + 1.2 - inset ), 0.22, Math.max( 2.5, d + 1.2 - inset * 0.82 ), ry );

		}

	};

	const house = ( { x, z, w, d, h, mat, ry = 0 } ) => {

		const ground = terrain.heightAt( x, z );
		const slabY = ground + 0.22;
		box( M.limestone, x, slabY, z, w + 0.8, 0.44, d + 0.8, ry, true, 'bermuda-house-pad', true );
		box( mat, x, ground + 0.44 + h * 0.5, z, w, h, d, ry, true, 'bermuda-house' );
		steppedRoof( x, ground + h + 0.58, z, w, d, ry );

		// A single dark doorway and two shallow window panels are enough for the blockout to read as a
		// house without adding texture memory. These will be replaced by the Meshy production asset.
		const frontZ = z + Math.cos( ry ) * ( d * 0.5 + 0.025 );
		const frontX = x + Math.sin( ry ) * ( d * 0.5 + 0.025 );
		box( M.dark, frontX, ground + 1.35, frontZ, 1.0, 2.05, 0.08, ry );

		return ground;

	};

	house( { x: - 80.0, z: - 69.0, w: 10.0, d: 7.0, h: 4.6, mat: M.pink, ry: 0.06 } );
	house( { x: - 61.0, z: - 73.5, w: 8.4, d: 6.4, h: 4.0, mat: M.yellow, ry: - 0.05 } );
	house( { x: - 92.0, z: - 82.0, w: 8.0, d: 6.0, h: 4.2, mat: M.blue, ry: 0.1 } );
	house( { x: - 46.0, z: - 87.0, w: 9.0, d: 6.8, h: 4.4, mat: M.mint, ry: - 0.12 } );

	// Low limestone garden walls / road edge — a strong Bermuda cue even at blockout quality.
	box( M.limestone, - 74.0, terrain.heightAt( - 74, - 59 ) + 0.6, - 59.0, 26, 1.15, 0.55, 0.02, true, 'bermuda-wall' );
	box( M.limestone, - 48.5, terrain.heightAt( - 48.5, - 66 ) + 0.55, - 66.0, 19, 1.05, 0.5, - 0.08, true, 'bermuda-wall' );

	// ---------------------------------------------------------------- harbour markers / moorings
	for ( const [ x, z, mat ] of [
		[ - 51, - 2, M.roof ], [ - 75, 1, M.red ], [ - 88, 12, M.roof ], [ - 39, 9, M.red ],
	] ) {

		sphere( mat, x, 0.38, z, 0.42 );
		cyl( M.dark, x, 0.08, z, 0.035, 0.42, 6 );

	}
	cyl( M.limestone, - 91, 1.35, 20, 0.22, 2.7, 8 );
	cyl( M.red, - 91, 2.85, 20, 0.38, 0.45, 8 );

	// ---------------------------------------------------------------- lightweight palmetto silhouettes
	const palm = ( x, z, height = 5.8 ) => {

		const y = terrain.heightAt( x, z );
		cyl( M.trunk, x, y + height * 0.5, z, 0.16, height, 7 );
		for ( let i = 0; i < 5; i ++ ) {

			const a = i * Math.PI * 2 / 5;
			const frond = box( M.green, x + Math.sin( a ) * 1.25, y + height + 0.12, z + Math.cos( a ) * 1.25, 0.38, 0.08, 3.0, a );
			frond.rotation.z = ( i % 2 ? 1 : - 1 ) * 0.06;

		}

	};
	palm( - 87.5, - 61.5, 5.4 );
	palm( - 53.0, - 67.0, 6.0 );

	scene.add( group );

	// The loader hid the scene while App.init warmed up, so move the already-created player onto the
	// new landing now. No control, swimming, fishing or boat code is changed.
	if ( app.player ) {

		const p = app.player;
		const landingY = colliders.groundHeightAt( START.x, START.z, 50 );
		p.mode = 'walk';
		p.position.set( START.x, Number.isFinite( landingY ) ? landingY + 0.02 : 1.02, START.z );
		p.velocity.set( 0, 0, 0 );
		p.yaw = START.yaw;
		p.pitch = - 0.045;
		p.grounded = true;
		p.waterMean = null;
		p.waterH = 0;
		p.camInit = false;

	}

	app.bermudaBlockout = { group, materials: M, start: START };
	return app.bermudaBlockout;

}
