import { BoxGeometry, CylinderGeometry, Group, Mesh, Vector3 } from '../engine/index.js';
import { Material } from '../engine/render/Material.js';

// Reference-match environment pass for the playable Bermuda waterfront.
// This deliberately adds authored density around the existing vertical slice instead of replacing
// the proven Tidewater systems. Geometry is simple and inexpensive so the same composition survives
// on iPhone; the higher-detail GLB waterfront can continue loading over/behind it.

function material( name, color, roughness = 0.9, metalness = 0 ) {
	return new Material( {
		name: `bermuda-ref-${ name }`,
		color,
		roughness,
		metalness,
		underwaterLighting: 'lite',
		localLightsCheap: true,
		receiveShadows: true,
	} );
}

export function installReferenceWorldUpgrade( app ) {
	if ( ! app?.scene || ! app?.terrainData || ! app?.colliders || app.bermudaReferenceUpgrade ) return app?.bermudaReferenceUpgrade;

	const terrain = app.terrainData;
	const colliders = app.colliders;
	const group = new Group();
	group.name = 'BermudaReferenceWorldUpgrade';

	const M = {
		asphalt: material( 'asphalt', 0x5f6668, 0.97 ),
		path: material( 'path', 0xd9d4c8, 0.96 ),
		limestone: material( 'limestone', 0xe7e0d2, 0.98 ),
		roof: material( 'white-roof', 0xf4f2e9, 0.88 ),
		pink: material( 'house-pink', 0xd98f96, 0.91 ),
		coral: material( 'house-coral', 0xd39a77, 0.92 ),
		yellow: material( 'house-yellow', 0xd8c36f, 0.92 ),
		mint: material( 'house-mint', 0x9fc3ac, 0.92 ),
		blue: material( 'house-blue', 0x8eb4c4, 0.92 ),
		cream: material( 'house-cream', 0xd8d0b7, 0.94 ),
		dark: material( 'window', 0x23333a, 0.35 ),
		wood: material( 'door', 0x76563d, 0.82 ),
		green: material( 'foliage', 0x3d684a, 0.94 ),
		green2: material( 'foliage-light', 0x5a7f57, 0.94 ),
		trunk: material( 'trunk', 0x776449, 1.0 ),
	};

	const GEO = {
		box: new BoxGeometry( 1, 1, 1 ),
		cyl: new CylinderGeometry( 1, 1, 1, 8 ),
	};

	const box = ( mat, x, y, z, sx, sy, sz, ry = 0, cast = false ) => {
		const mesh = new Mesh( GEO.box, mat );
		mesh.position.set( x, y, z );
		mesh.scale.set( sx, sy, sz );
		mesh.rotation.y = ry;
		mesh.castShadow = cast;
		mesh.receiveShadow = true;
		group.add( mesh );
		return mesh;
	};
	const cyl = ( mat, x, y, z, r, h, cast = false ) => {
		const mesh = new Mesh( GEO.cyl, mat );
		mesh.position.set( x, y, z );
		mesh.scale.set( r, h, r );
		mesh.castShadow = cast;
		mesh.receiveShadow = true;
		group.add( mesh );
		return mesh;
	};

	// Keep the launch beach clear: remove the two raised roadway extensions
	// and their walkable collision boxes, together with the elevated footway.
	// The broad grey slabs were obscuring both shoreline and water on iPhone.
	// Preserve the public runtime group and the real dock/landing geometry.

	// Keep the waterfront empty. Houses, garden walls, gateposts and shrubs are not spawned here.

	app.scene.add( group );
	app.bermudaReferenceUpgrade = { group, materials: M };
	return app.bermudaReferenceUpgrade;
}
