import { BoxGeometry, CylinderGeometry, Group, InstancedMesh, Matrix4, Mesh, SphereGeometry, Vector3 } from '../engine/index.js';
import { Material } from '../engine/render/Material.js';

// Second reference-match pass based on Bermuda_Simulator_Gameplay_54s.mp4.
// The goal is not to replace Tidewater's ocean/terrain systems: it layers inexpensive authored
// composition on top of them so the playable waterfront reads closer to the reference on iPhone.

function material( name, color, roughness = 0.9, metalness = 0 ) {
	return new Material( {
		name: `bermuda-detail-${ name }`,
		color,
		roughness,
		metalness,
		underwaterLighting: 'lite',
		localLightsCheap: true,
		receiveShadows: true,
	} );
}

export function installReferenceDetailUpgrade( app ) {
	if ( ! app?.scene || ! app?.terrainData || ! app?.colliders || app.bermudaReferenceDetail ) return app?.bermudaReferenceDetail;

	const terrain = app.terrainData;
	const colliders = app.colliders;
	const group = new Group();
	group.name = 'BermudaReferenceDetailUpgrade';

	const M = {
		wood: material( 'dock-wood', 0x8f7456, 0.94 ),
		woodDark: material( 'dock-edge', 0x554637, 0.96 ),
		limestone: material( 'limestone', 0xe5dfd2, 0.98 ),
		underRock: material( 'underwater-limestone', 0xb6aa92, 1.0 ),
		coral: material( 'coral-rubble', 0xb98673, 0.98 ),
		seagrass: material( 'seagrass', 0x31533c, 1.0 ),
		white: material( 'trim', 0xf5f3e9, 0.90 ),
		shutter: material( 'shutter-green', 0x355b51, 0.86 ),
		window: material( 'window-glass', 0x243d48, 0.28, 0.05 ),
		flower: material( 'bougainvillea', 0xb83865, 0.96 ),
		leaf: material( 'broadleaf', 0x3f6f49, 0.96 ),
		leaf2: material( 'broadleaf-light', 0x65865a, 0.96 ),
		trunk: material( 'trunk', 0x796247, 1.0 ),
		red: material( 'buoy-red', 0xc94843, 0.86 ),
		whiteBuoy: material( 'buoy-white', 0xf3f0e5, 0.82 ),
		dark: material( 'marine-dark', 0x243940, 0.88 ),
	};

	const GEO = {
		box: new BoxGeometry( 1, 1, 1 ),
		cyl: new CylinderGeometry( 1, 1, 1, 10 ),
		sphere: new SphereGeometry( 1, 10, 7 ),
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

	// --- marina composition ----------------------------------------------------
	// Two secondary jetties keep the playable dock from feeling like a lone prop. They sit well away
	// from RELIC and leave the centre harbour route open for the driveable boat.
	const addJetty = ( x, z, length = 24 ) => {
		const deckY = 0.94;
		box( M.wood, x, deckY, z, 2.25, 0.18, length, 0, true );
		box( M.woodDark, x - 1.13, deckY - 0.02, z, 0.10, 0.24, length );
		box( M.woodDark, x + 1.13, deckY - 0.02, z, 0.10, 0.24, length );
		const headZ = z + length * 0.5 - 1.0;
		box( M.wood, x, deckY, headZ, 5.2, 0.18, 2.3, 0, true );
		colliders.addBox( new Vector3( x, deckY, z ), new Vector3( 1.125, 0.09, length * 0.5 ), 0, { tag: 'bermuda-detail-jetty', walkable: true } );
		colliders.addBox( new Vector3( x, deckY, headZ ), new Vector3( 2.6, 0.09, 1.15 ), 0, { tag: 'bermuda-detail-jetty', walkable: true } );

		for ( let dz = - length * 0.5 + 1.2; dz <= length * 0.5 - 0.8; dz += 4.0 ) {
			for ( const side of [ -1, 1 ] ) {
				cyl( M.woodDark, x + side * 1.32, -0.15, z + dz, 0.16, 2.8 );
				cyl( M.white, x + side * 1.32, 1.30, z + dz, 0.18, 0.13 );
			}
		}

		// Cleats/bollards at the outer head and a simple ladder down to the water.
		for ( const dx of [ -1.75, 1.75 ] ) cyl( M.dark, x + dx, 1.16, headZ, 0.10, 0.36 );
		for ( const dx of [ -0.42, 0.42 ] ) box( M.dark, x + dx, 0.05, headZ + 1.18, 0.08, 1.55, 0.08 );
		for ( let y = -0.45; y <= 0.58; y += 0.34 ) box( M.dark, x, y, headZ + 1.18, 0.92, 0.07, 0.08 );
	};

	addJetty( -96, -24, 25 );
	addJetty( -36, -24, 21 );

	// Stone shoreline fragments frame the bay at the far sides only. The central RELIC/road frontage
	// remains completely open as requested; no replacement barrier is added around the car.
	for ( const [ x, w, h ] of [ [ -111, 8.0, 1.2 ], [ -103, 5.0, 0.95 ], [ -29, 5.5, 1.0 ], [ -22, 7.5, 1.25 ] ] ) {
		box( M.limestone, x, 0.50, -43.0, w, h, 1.25 );
	}

	// Mooring field: sparse enough to navigate, dense enough to sell a working harbour.
	const buoyMesh = new InstancedMesh( GEO.sphere, M.whiteBuoy, 12 );
	const buoyRed = new InstancedMesh( GEO.sphere, M.red, 6 );
	const stemMesh = new InstancedMesh( GEO.cyl, M.dark, 18 );
	const matrix = new Matrix4();
	const buoys = [
		[ -108, -2 ], [ -87, 5 ], [ -73, 14 ], [ -54, 6 ], [ -42, 18 ], [ -25, 2 ],
		[ -102, 25 ], [ -84, 31 ], [ -64, 28 ], [ -48, 37 ], [ -31, 29 ], [ -18, 19 ],
	];
	for ( let i = 0; i < buoys.length; i ++ ) {
		const [ x, z ] = buoys[ i ];
		matrix.makeScale( 0.34, 0.34, 0.34 ).setPosition( x, 0.16, z );
		buoyMesh.setMatrixAt( i, matrix );
		matrix.makeScale( 0.035, 0.42, 0.035 ).setPosition( x, -0.16, z );
		stemMesh.setMatrixAt( i, matrix );
	}
	for ( let i = 0; i < 6; i ++ ) {
		const [ x, z ] = buoys[ i * 2 ];
		matrix.makeScale( 0.22, 0.22, 0.22 ).setPosition( x, 0.39, z );
		buoyRed.setMatrixAt( i, matrix );
	}
	for ( const mesh of [ buoyMesh, buoyRed, stemMesh ] ) {
		mesh.instanceMatrix.needsUpdate = true;
		mesh.computeBoundingSphere();
		mesh.castShadow = false;
		mesh.receiveShadow = true;
		group.add( mesh );
	}

	// --- shallow seabed readability ------------------------------------------
	// The base terrain shader already provides rippled coral sand and seagrass. These submerged
	// low-cost forms add larger-scale limestone/coral cues that remain legible through the water from
	// the dock camera, like the dark reef patches visible in the 54-second reference.
	const rubble = [
		[ -86, -1, 2.8, 1.7 ], [ -76, 5, 3.6, 2.0 ], [ -66, 3, 2.2, 1.4 ],
		[ -55, 10, 3.2, 1.9 ], [ -45, 3, 2.5, 1.5 ], [ -34, 12, 3.8, 2.2 ],
		[ -96, 17, 3.0, 1.8 ], [ -81, 22, 4.2, 2.4 ], [ -62, 20, 3.0, 1.6 ],
		[ -47, 26, 4.0, 2.1 ], [ -29, 23, 3.2, 1.8 ],
	];
	let rubbleCount = 0;
	const rubbleMesh = new InstancedMesh( GEO.sphere, M.underRock, rubble.length );
	const coralMesh = new InstancedMesh( GEO.sphere, M.coral, rubble.length );
	for ( let i = 0; i < rubble.length; i ++ ) {
		const [ x, z, sx, sz ] = rubble[ i ];
		const floor = terrain.heightAt( x, z );
		if ( floor > -0.30 ) continue;
		const y = Math.min( -0.38, floor + 0.20 );
		matrix.makeScale( sx, 0.30 + ( i % 3 ) * 0.08, sz ).setPosition( x, y, z );
		rubbleMesh.setMatrixAt( rubbleCount, matrix );
		matrix.makeScale( sx * 0.34, 0.24, sz * 0.30 ).setPosition( x + sx * 0.18, y + 0.18, z - sz * 0.10 );
		coralMesh.setMatrixAt( rubbleCount, matrix );
		rubbleCount ++;
	}
	rubbleMesh.count = rubbleCount;
	coralMesh.count = rubbleCount;
	for ( const mesh of [ rubbleMesh, coralMesh ] ) {
		mesh.instanceMatrix.needsUpdate = true;
		mesh.computeBoundingSphere();
		mesh.castShadow = false;
		mesh.receiveShadow = true;
		group.add( mesh );
	}

	const grassPatches = [ [ -90, 10 ], [ -70, 14 ], [ -58, 17 ], [ -41, 16 ], [ -100, 30 ], [ -74, 33 ], [ -52, 35 ], [ -32, 34 ] ];
	const grassMesh = new InstancedMesh( GEO.sphere, M.seagrass, grassPatches.length );
	let grassCount = 0;
	for ( let i = 0; i < grassPatches.length; i ++ ) {
		const [ x, z ] = grassPatches[ i ];
		const floor = terrain.heightAt( x, z );
		if ( floor > -0.45 ) continue;
		matrix.makeScale( 3.0 + ( i % 3 ), 0.08, 1.8 + ( i % 2 ) * 0.8 ).setPosition( x, floor + 0.10, z );
		grassMesh.setMatrixAt( grassCount ++, matrix );
	}
	grassMesh.count = grassCount;
	grassMesh.instanceMatrix.needsUpdate = true;
	grassMesh.computeBoundingSphere();
	grassMesh.castShadow = false;
	grassMesh.receiveShadow = true;
	group.add( grassMesh );

	// --- facade / vegetation quality -----------------------------------------
	// The first pass established massing; this adds white trim, shutters, upper windows and stoops so
	// nearby homes stop reading as untextured boxes when the player walks up from the waterfront.
	const houses = [
		{ x: -105, z: -64, w: 7.6, d: 6.0, h: 4.2 },
		{ x: -95, z: -67, w: 8.4, d: 6.2, h: 4.6 },
		{ x: -71, z: -66, w: 7.4, d: 5.8, h: 4.1 },
		{ x: -51, z: -69, w: 8.0, d: 6.0, h: 4.35 },
		{ x: -39, z: -64, w: 7.1, d: 5.6, h: 4.0 },
		{ x: -29, z: -68, w: 8.1, d: 6.3, h: 4.5 },
		{ x: -80, z: -69, w: 10.0, d: 7.0, h: 4.6 },
		{ x: -61, z: -73.5, w: 8.4, d: 6.4, h: 4.0 },
	];
	for ( let i = 0; i < houses.length; i ++ ) {
		const H = houses[ i ];
		const y = Math.max( 1.48, terrain.heightAt( H.x, H.z ) );
		const front = H.z + H.d * 0.5 + 0.09;
		const wy = y + 1.42;
		for ( const side of [ -1, 1 ] ) {
			const wx = H.x + side * H.w * 0.27;
			box( M.white, wx, wy, front, 1.22, 1.35, 0.045 );
			box( M.window, wx, wy, front + 0.035, 0.90, 1.05, 0.04 );
			box( M.shutter, wx - 0.62, wy, front + 0.05, 0.18, 1.10, 0.035 );
			box( M.shutter, wx + 0.62, wy, front + 0.05, 0.18, 1.10, 0.035 );
		}
		box( M.white, H.x, y + 2.18, front, 1.18, 0.18, 0.08 );
		box( M.limestone, H.x, y + 0.16, front + 0.55, 1.65, 0.26, 1.10 );
		if ( H.h > 4.25 ) {
			box( M.white, H.x, y + 3.08, front, 1.18, 1.08, 0.045 );
			box( M.window, H.x, y + 3.08, front + 0.035, 0.88, 0.82, 0.04 );
		}
		if ( i % 3 === 1 ) {
			// Small Bermuda-style chimney / roof vent, deliberately simple at this scale.
			box( M.white, H.x + H.w * 0.27, y + H.h + 1.12, H.z - H.d * 0.15, 0.46, 1.20, 0.46 );
		}
	}

	// Organic planting masses and bougainvillea clusters. Use instancing to keep the iPhone draw-call
	// cost low while replacing the prototype's flat rectangular hedges with rounded vegetation.
	const shrubs = [
		[ -108, -59 ], [ -101, -60 ], [ -97, -61 ], [ -91, -60 ], [ -84, -61 ],
		[ -76, -59 ], [ -68, -60 ], [ -58, -61 ], [ -54, -59 ], [ -47, -60 ],
		[ -41, -59 ], [ -34, -60 ], [ -27, -59 ], [ -21, -61 ],
	];
	const shrubMesh = new InstancedMesh( GEO.sphere, M.leaf, shrubs.length );
	const flowerMesh = new InstancedMesh( GEO.sphere, M.flower, 8 );
	for ( let i = 0; i < shrubs.length; i ++ ) {
		const [ x, z ] = shrubs[ i ];
		const y = Math.max( 1.5, terrain.heightAt( x, z ) ) + 0.9;
		matrix.makeScale( 1.65 + ( i % 3 ) * 0.28, 0.92 + ( i % 2 ) * 0.18, 1.25 + ( i % 4 ) * 0.14 ).setPosition( x, y, z );
		shrubMesh.setMatrixAt( i, matrix );
	}
	for ( let i = 0; i < 8; i ++ ) {
		const [ x, z ] = shrubs[ i * 2 - ( i > 6 ? 6 : 0 ) ];
		const y = Math.max( 1.5, terrain.heightAt( x, z ) ) + 1.35;
		matrix.makeScale( 0.55, 0.55, 0.55 ).setPosition( x + ( i % 2 ? 0.9 : -0.75 ), y, z + 0.25 );
		flowerMesh.setMatrixAt( i, matrix );
	}
	for ( const mesh of [ shrubMesh, flowerMesh ] ) {
		mesh.instanceMatrix.needsUpdate = true;
		mesh.computeBoundingSphere();
		mesh.castShadow = false;
		mesh.receiveShadow = true;
		group.add( mesh );
	}

	// Palmetto/fan-palm silhouettes now come from the authored GLB placements in AssetLayout.
	// Avoid the previous crossed-box canopy trees, which read as placeholders at phone-camera distance.

	app.scene.add( group );
	app.bermudaReferenceDetail = { group, materials: M };
	return app.bermudaReferenceDetail;
}
