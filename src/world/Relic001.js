import { BoxGeometry, CylinderGeometry, Group, Mesh, RoundedBoxGeometry, TorusGeometry, Vector3 } from '../engine/index.js';
import { Material } from '../engine/render/Material.js';

export const RELIC_POS = { x: -76.0, z: -49.15, yaw: Math.PI * 0.5 };

function isMobileProfile() {
	if ( typeof navigator === 'undefined' ) return false;
	return /iPhone|iPad|iPod|Android/i.test( navigator.userAgent ) ||
		( navigator.maxTouchPoints > 1 && Math.min( screen.width, screen.height ) < 1024 );
}

function mat( name, color, roughness, metalness, emissive = 0x000000 ) {
	return new Material( {
		name: `relic-${ name }`, color, roughness, metalness, emissive,
		underwaterLighting: 'lite', localLightsCheap: false, receiveShadows: true,
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

export function installRelic001( app ) {
	if ( ! app || ! app.scene || ! app.terrainData || app.relic001 ) return app && app.relic001;

	const mobile = isMobileProfile();
	const group = new Group();
	group.name = 'RELIC_001';

	const M = {
		body: mat( 'obsidian-body', 0x08090b, 0.16, 0.92 ),
		carbon: mat( 'carbon', 0x111318, 0.34, 0.78 ),
		glass: mat( 'smoked-glass', 0x071019, 0.08, 0.74 ),
		rubber: mat( 'tire', 0x050506, 0.82, 0.06 ),
		wheel: mat( 'wheel', 0x17191c, 0.18, 0.96 ),
		amber: mat( 'amber', 0x4c2508, 0.22, 0.56, 0xff6a12 ),
		red: mat( 'rear-red', 0x340404, 0.22, 0.42, 0xff1a0f ),
		lift: mat( 'aerolift-chamber', 0x12161a, 0.19, 0.96, 0x5d2408 ),
	};

	const GEO = {
		box: new BoxGeometry( 1, 1, 1 ),
		rounded: new RoundedBoxGeometry( 1, 1, 1, 3, 0.12 ),
		cyl: new CylinderGeometry( 1, 1, 1, mobile ? 12 : 20 ),
		torus: new TorusGeometry( 1, 0.22, mobile ? 6 : 10, mobile ? 14 : 24 ),
	};

	// Low, faceted hypercar proportions from the RELIC 001 reference. Keep the silhouette clean:
	// no wings, spider legs, external pods, rocket nozzles or oversized propulsion hardware.
	addMesh( group, GEO.rounded, M.body, [ 0, 0.72, 0.05 ], [ 2.18, 0.38, 4.55 ], null, 'relic-body' );
	addMesh( group, GEO.box, M.carbon, [ 0, 0.52, 1.93 ], [ 2.28, 0.16, 0.62 ], [ -0.08, 0, 0 ], 'relic-front-splitter' );
	addMesh( group, GEO.box, M.carbon, [ 0, 0.55, -2.03 ], [ 2.22, 0.18, 0.54 ], [ 0.08, 0, 0 ], 'relic-rear-diffuser' );
	addMesh( group, GEO.rounded, M.glass, [ 0, 1.12, -0.08 ], [ 1.58, 0.48, 2.18 ], [ -0.05, 0, 0 ], 'relic-canopy' );
	addMesh( group, GEO.box, M.body, [ -1.05, 0.73, 0.10 ], [ 0.22, 0.28, 2.90 ], [ 0, 0, 0.03 ], 'relic-left-haunch' );
	addMesh( group, GEO.box, M.body, [ 1.05, 0.73, 0.10 ], [ 0.22, 0.28, 2.90 ], [ 0, 0, -0.03 ], 'relic-right-haunch' );

	// Four compact underside Aerolift chambers, integrated into the chassis/wheel zones. They remain
	// visually subordinate to the body and read as vector-lift hardware rather than jet thrusters.
	for ( const z of [ -1.23, 1.25 ] ) for ( const x of [ -0.78, 0.78 ] ) {
		const chamber = addMesh( group, GEO.cyl, M.lift, [ x, 0.34, z ], [ 0.32, 0.055, 0.32 ], null, 'relic-aerolift-chamber' );
		chamber.castShadow = ! mobile;
	}

	// Needle-light signature: amber front detail and thin red rear blades.
	addMesh( group, GEO.box, M.amber, [ -0.72, 0.78, 2.26 ], [ 0.62, 0.045, 0.055 ], [ 0, 0.05, -0.04 ], 'relic-front-light-l' );
	addMesh( group, GEO.box, M.amber, [ 0.72, 0.78, 2.26 ], [ 0.62, 0.045, 0.055 ], [ 0, -0.05, 0.04 ], 'relic-front-light-r' );
	addMesh( group, GEO.box, M.red, [ -0.72, 0.79, -2.26 ], [ 0.68, 0.05, 0.05 ], [ 0, -0.06, 0 ], 'relic-rear-light-l' );
	addMesh( group, GEO.box, M.red, [ 0.72, 0.79, -2.26 ], [ 0.68, 0.05, 0.05 ], [ 0, 0.06, 0 ], 'relic-rear-light-r' );

	const wheelZ = [ -1.48, 1.52 ];
	for ( const z of wheelZ ) for ( const x of [ -1.12, 1.12 ] ) {
		const tire = addMesh( group, GEO.torus, M.rubber, [ x, 0.52, z ], [ 0.46, 0.46, 0.46 ], [ Math.PI * 0.5, 0, 0 ], 'relic-tire' );
		const rim = addMesh( group, GEO.cyl, M.wheel, [ x, 0.52, z ], [ 0.30, 0.13, 0.30 ], [ 0, 0, Math.PI * 0.5 ], 'relic-rim' );
		tire.castShadow = rim.castShadow = ! mobile;
	}

	// Put the car directly into the Bermuda road scene. The blockout's road collider is authoritative,
	// so use it rather than the raw terrain height to prevent the car sinking into the raised roadway.
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

	app.relic001 = { group, materials: M, position: RELIC_POS, groundY: y, mobile };
	return app.relic001;
}