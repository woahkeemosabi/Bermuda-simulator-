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

	// Continue the waterfront road in both directions. The original road only covered the immediate
	// spawn block, which made the playable world read like a set. These pieces overlap that road by
	// a metre so there are no visual/collision seams. Nothing is placed across the seaward edge: the
	// barrier removed from the RELIC area stays gone.
	const roadY = 1.43;
	for ( const road of [
		{ x: - 98.0, z: - 49.2, w: 28, d: 5.0 },
		{ x: - 38.0, z: - 49.2, w: 28, d: 5.0 },
	] ) {
		box( M.asphalt, road.x, roadY, road.z, road.w, 0.18, road.d );
		colliders.addBox(
			new Vector3( road.x, roadY, road.z ),
			new Vector3( road.w * 0.5, 0.09, road.d * 0.5 ),
			0,
			{ tag: 'bermuda-road-extension', walkable: true }
		);
	}

	// Landward footway gives the road a believable Bermuda residential edge without fencing the car
	// in. It is low enough to remain driveable at driveway gaps and never forms a seaward barrier.
	box( M.path, - 68, 1.39, - 53.25, 88, 0.12, 2.15 );
	colliders.addBox(
		new Vector3( - 68, 1.39, - 53.25 ),
		new Vector3( 44, 0.06, 1.075 ),
		0,
		{ tag: 'bermuda-footway', walkable: true }
	);

	// Keep the waterfront empty. Houses, garden walls, gateposts and shrubs are not spawned here.

	app.scene.add( group );
	app.bermudaReferenceUpgrade = { group, materials: M };
	return app.bermudaReferenceUpgrade;
}
