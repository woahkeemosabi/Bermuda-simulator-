import { BoxGeometry, CylinderGeometry, Group, Mesh, SphereGeometry, Vector3 } from '../engine/index.js';
import { Material } from '../engine/render/Material.js';

// Bermuda World v0.1 blockout.
// Primitive, texture-free geometry only. On mobile the blockout is deliberately sparse and reuses
// three shared geometries so the scene does not recreate dozens of GPU vertex/index buffers.

const START = { x: - 64.5, z: - 22.0, yaw: Math.PI };

function makeMaterial( name, color, roughness = 0.9 ) {

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

function isMobileProfile() {

	if ( typeof navigator === 'undefined' ) return false;
	return /iPhone|iPad|iPod|Android/i.test( navigator.userAgent ) ||
		( navigator.maxTouchPoints > 1 && Math.min( screen.width, screen.height ) < 1024 );

}

export function installBermudaBlockout( app ) {

	if ( ! app || ! app.scene || ! app.terrainData || ! app.colliders || app.bermudaBlockout ) return app && app.bermudaBlockout;

	const scene = app.scene;
	const terrain = app.terrainData;
	const colliders = app.colliders;
	const mobileLite = isMobileProfile();
	const group = new Group();
	group.name = 'BermudaWorldBlockout';

	const M = {
		limestone: makeMaterial( 'limestone', 0xe8e3d6, 0.96 ),
		roof: makeMaterial( 'white-roof', 0xf5f4ed, 0.92 ),
		pink: makeMaterial( 'pastel-pink', 0xe9a7aa, 0.92 ),
		yellow: makeMaterial( 'pastel-yellow', 0xe3cc79, 0.92 ),
		blue: makeMaterial( 'pastel-blue', 0x9fc4d5, 0.92 ),
		mint: makeMaterial( 'pastel-mint', 0xaecdb6, 0.92 ),
		wood: makeMaterial( 'dock-wood', 0x8a7052, 0.97 ),
		asphalt: makeMaterial( 'road', 0x777d80, 0.98 ),
		dark: makeMaterial( 'harbour-dark', 0x234452, 0.8 ),
		green: makeMaterial( 'palmetto', 0x4f7655, 0.94 ),
		trunk: makeMaterial( 'palm-trunk', 0x806b4c, 1.0 ),
		red: makeMaterial( 'channel-red', 0xc7473f, 0.84 ),
	};

	// Reuse these geometries everywhere. The previous blockout created a fresh BoxGeometry or
	// CylinderGeometry for nearly every prop, which was unnecessary pressure on Safari WebGPU.
	const GEO = {
		box: new BoxGeometry( 1, 1, 1 ),
		cyl: new CylinderGeometry( 1, 1, 1, 8 ),
		sphere: new SphereGeometry( 1, 8, 6 ),
	};

	const addScaled = ( geo, mat, x, y, z, sx, sy, sz, ry = 0 ) => {

		const mesh = new Mesh( geo, mat );
		mesh.position.set( x, y, z );
		mesh.scale.set( sx, sy, sz );
		mesh.rotation.y = ry;
		mesh.castShadow = false;
		mesh.receiveShadow = false;
		group.add( mesh );
		return mesh;

	};

	const box = ( mat, x, y, z, w, h, d, ry = 0, collide = false, tag = 'bermuda', walkable = false ) => {

		const mesh = addScaled( GEO.box, mat, x, y, z, w, h, d, ry );
		if ( collide ) colliders.addBox( new Vector3( x, y, z ), new Vector3( w * 0.5, h * 0.5, d * 0.5 ), ry, { tag, walkable } );
		return mesh;

	};

	const cyl = ( mat, x, y, z, r, h, collide = false, tag = 'bermuda' ) => {

		const mesh = addScaled( GEO.cyl, mat, x, y, z, r, h, r );
		if ( collide ) colliders.addCylinder( x, z, r, y - h * 0.5, y + h * 0.5, { tag } );
		return mesh;

	};

	const sphere = ( mat, x, y, z, r ) => addScaled( GEO.sphere, mat, x, y, z, r, r, r );

	// ---------------------------------------------------------------- waterfront
	box( M.limestone, - 66.5, 0.55, - 45.2, 27, 1.8, 3.2, 0, true, 'bermuda-seawall', true );
	box( M.asphalt, - 68.0, 1.43, - 49.2, 34, 0.18, 5.0, 0, true, 'bermuda-road', true );
	box( M.wood, - 65.0, 0.55, - 30.0, 5.2, 0.9, 34.0, 0, true, 'bermuda-landing', true );

	// Keep the landing head compact. The old 8 m-wide head physically intersected the 8.2 m boat.
	box( M.wood, - 64.0, 0.58, - 14.5, 5.4, 0.96, 4.8, 0, true, 'bermuda-landing-head', true );

	for ( const [ x, z ] of [ [ - 67.0, - 34 ], [ - 63.0, - 34 ], [ - 67.0, - 19 ], [ - 63.0, - 19 ] ] ) {

		cyl( M.dark, x, 1.34, z, 0.11, 0.7 );

	}

	// ---------------------------------------------------------------- Bermuda houses
	const steppedRoof = ( x, baseY, z, w, d, ry = 0 ) => {

		const steps = mobileLite ? 3 : 4;
		for ( let i = 0; i < steps; i ++ ) {

			const inset = i * 0.9;
			box( M.roof, x, baseY + i * 0.24, z,
				Math.max( 2.8, w + 1.1 - inset ), 0.24,
				Math.max( 2.5, d + 1.1 - inset * 0.82 ), ry );

		}

	};

	const house = ( { x, z, w, d, h, mat, ry = 0 } ) => {

		const ground = terrain.heightAt( x, z );
		box( mat, x, ground + h * 0.5, z, w, h, d, ry, true, 'bermuda-house' );
		steppedRoof( x, ground + h + 0.14, z, w, d, ry );

	};

	house( { x: - 80.0, z: - 69.0, w: 10.0, d: 7.0, h: 4.6, mat: M.pink, ry: 0.06 } );
	house( { x: - 61.0, z: - 73.5, w: 8.4, d: 6.4, h: 4.0, mat: M.yellow, ry: - 0.05 } );
	if ( ! mobileLite ) {

		house( { x: - 92.0, z: - 82.0, w: 8.0, d: 6.0, h: 4.2, mat: M.blue, ry: 0.1 } );
		house( { x: - 46.0, z: - 87.0, w: 9.0, d: 6.8, h: 4.4, mat: M.mint, ry: - 0.12 } );

	}

	box( M.limestone, - 74.0, terrain.heightAt( - 74, - 59 ) + 0.6, - 59.0, 26, 1.15, 0.55, 0.02, true, 'bermuda-wall' );
	if ( ! mobileLite ) box( M.limestone, - 48.5, terrain.heightAt( - 48.5, - 66 ) + 0.55, - 66.0, 19, 1.05, 0.5, - 0.08, true, 'bermuda-wall' );

	// ---------------------------------------------------------------- harbour markers / moorings
	const moorings = mobileLite ? [ [ - 51, - 2, M.roof ], [ - 75, 1, M.red ] ] : [
		[ - 51, - 2, M.roof ], [ - 75, 1, M.red ], [ - 88, 12, M.roof ], [ - 39, 9, M.red ],
	];
	for ( const [ x, z, mat ] of moorings ) {

		sphere( mat, x, 0.38, z, 0.42 );
		cyl( M.dark, x, 0.08, z, 0.035, 0.42 );

	}

	if ( ! mobileLite ) {

		cyl( M.limestone, - 91, 1.35, 20, 0.22, 2.7 );
		cyl( M.red, - 91, 2.85, 20, 0.38, 0.45 );

		const palm = ( x, z, height = 5.8 ) => {

			const y = terrain.heightAt( x, z );
			cyl( M.trunk, x, y + height * 0.5, z, 0.16, height );
			for ( let i = 0; i < 4; i ++ ) {

				const a = i * Math.PI * 0.5;
				addScaled( GEO.box, M.green,
					x + Math.sin( a ) * 1.15, y + height + 0.12, z + Math.cos( a ) * 1.15,
					0.35, 0.08, 2.6, a );

			}

		};
		palm( - 87.5, - 61.5, 5.4 );
		palm( - 53.0, - 67.0, 6.0 );

	}

	scene.add( group );

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

	app.bermudaBlockout = { group, materials: M, start: START, mobileLite };
	return app.bermudaBlockout;

}
