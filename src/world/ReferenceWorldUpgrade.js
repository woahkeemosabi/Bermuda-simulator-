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

	const addRoof = ( x, baseY, z, w, d, yaw ) => {
		for ( let i = 0; i < 4; i ++ ) {
			const inset = i * 0.72;
			box( M.roof, x, baseY + i * 0.20, z, Math.max( 2.5, w + 0.85 - inset ), 0.22, Math.max( 2.3, d + 0.85 - inset * 0.76 ), yaw, true );
		}
	};

	const addHouse = ( { x, z, w, d, h, mat, yaw = 0 } ) => {
		const gy = terrain.heightAt( x, z );
		const y = Math.max( 1.48, gy );
		box( mat, x, y + h * 0.5, z, w, h, d, yaw, true );
		addRoof( x, y + h + 0.10, z, w, d, yaw );

		// Front door and windows face the waterfront road (+Z). Slightly offset them to avoid z-fight.
		const front = z + d * 0.5 + 0.035;
		box( M.wood, x, y + 1.05, front, 0.82, 2.02, 0.08, yaw );
		box( M.dark, x - w * 0.27, y + 1.45, front + 0.01, 0.94, 1.05, 0.07, yaw );
		box( M.dark, x + w * 0.27, y + 1.45, front + 0.01, 0.94, 1.05, 0.07, yaw );
		colliders.addBox(
			new Vector3( x, y + h * 0.5, z ),
			new Vector3( w * 0.5, h * 0.5, d * 0.5 ),
			yaw,
			{ tag: 'bermuda-reference-house' }
		);
	};

	// Dense staggered cottage line behind the road. Existing hero houses remain; these fill the large
	// empty gaps so every road-facing camera has layered architecture rather than isolated props.
	[
		{ x: -105, z: -64, w: 7.6, d: 6.0, h: 4.2, mat: M.cream, yaw: 0.05 },
		{ x: -95, z: -67, w: 8.4, d: 6.2, h: 4.6, mat: M.blue, yaw: - 0.04 },
		{ x: -71, z: -66, w: 7.4, d: 5.8, h: 4.1, mat: M.coral, yaw: 0.03 },
		{ x: -51, z: -69, w: 8.0, d: 6.0, h: 4.35, mat: M.mint, yaw: - 0.04 },
		{ x: -39, z: -64, w: 7.1, d: 5.6, h: 4.0, mat: M.yellow, yaw: 0.05 },
		{ x: -29, z: -68, w: 8.1, d: 6.3, h: 4.5, mat: M.pink, yaw: - 0.05 },
	].forEach( addHouse );

	// Palms are supplied by the authored palmetto GLB tier; do not layer crude crossed-box trees over them.

	// Compact hedge/shrub masses between the footway and houses. Keep the RELIC's parking/drive lane
	// completely clear; all vegetation begins several metres landward of the road centreline.
	for ( const [ x, z, w ] of [
		[ -102, -57.3, 4.5 ], [ -87, -57.0, 4.2 ], [ -77, -58.2, 4.0 ],
		[ -65, -57.5, 4.6 ], [ -54, -57.1, 3.8 ], [ -42, -57.5, 4.2 ], [ -31, -57.2, 3.8 ],
	] ) box( M.green, x, 2.05, z, w, 1.05, 1.0, 0, false );

	// A few limestone gateposts/driveway edges provide scale cues without recreating the deleted
	// waterfront barrier. These are all on the landward side of the footway.
	for ( const x of [ -99, -91, -74, -66, -49, -41, -33 ] ) {
		box( M.limestone, x, 1.95, -55.25, 0.42, 1.05, 0.42 );
	}

	app.scene.add( group );
	app.bermudaReferenceUpgrade = { group, materials: M };
	return app.bermudaReferenceUpgrade;
}
