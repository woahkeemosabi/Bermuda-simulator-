import {
	BoxGeometry, CylinderGeometry, Group, InstancedMesh, Matrix4, SphereGeometry,
} from '../engine/index.js';
import { Material } from '../engine/render/Material.js';
import { WORLD } from './WorldLayout.js';

function mat( name, color, roughness = 0.9, metalness = 0, extra = {} ) {
	return new Material( {
		name: `bermuda-env-${ name }`, color, roughness, metalness,
		underwaterLighting: 'lite', localLightsCheap: true, receiveShadows: true,
		...extra,
	} );
}

function finishInstances( root, mesh, count = null ) {
	if ( count !== null ) mesh.count = count;
	mesh.instanceMatrix.needsUpdate = true;
	mesh.computeBoundingSphere();
	mesh.castShadow = false;
	mesh.receiveShadow = true;
	root.add( mesh );
	return mesh;
}

function installResidentialDepth( app, root, M, GEO ) {
	const terrain = app.terrainData;
	// A second residential layer closes the empty backdrop behind the first waterfront row. These are
	// deliberately modest Bermuda houses rather than towers: pastel masonry + stepped white roofs.
	const houses = [
		[ -112, -83, 7.4, 5.8, 3.9, 0 ], [ -101, -89, 8.0, 6.0, 4.2, 1 ],
		[ -90, -84, 7.0, 5.5, 3.8, 2 ], [ -79, -92, 8.6, 6.4, 4.5, 3 ],
		[ -67, -85, 7.5, 5.8, 4.0, 1 ], [ -55, -93, 8.3, 6.3, 4.35, 0 ],
		[ -43, -84, 7.1, 5.5, 3.9, 3 ], [ -31, -91, 8.2, 6.1, 4.3, 2 ],
		[ -108, -101, 8.2, 6.4, 4.3, 2 ], [ -94, -104, 7.4, 5.7, 3.9, 0 ],
		[ -76, -105, 8.5, 6.4, 4.5, 1 ], [ -59, -104, 7.7, 5.9, 4.1, 3 ],
		[ -40, -102, 8.1, 6.1, 4.25, 0 ], [ -24, -99, 7.2, 5.6, 3.95, 2 ],
	];
	const palette = [ M.pink, M.mint, M.blue, M.sand ];
	const wallMeshes = palette.map( p => new InstancedMesh( GEO.box, p, houses.length ) );
	const roof = new InstancedMesh( GEO.box, M.roof, houses.length * 3 );
	const foundation = new InstancedMesh( GEO.box, M.foundation, houses.length );
	const windows = new InstancedMesh( GEO.box, M.window, houses.length * 4 );
	const shutters = new InstancedMesh( GEO.box, M.shutter, houses.length * 8 );
	const matrix = new Matrix4();
	const wallCounts = [ 0, 0, 0, 0 ];
	let roofCount = 0, foundationCount = 0, windowCount = 0, shutterCount = 0;

	for ( let i = 0; i < houses.length; i ++ ) {
		const [ x, z, w, d, h, pi ] = houses[ i ];
		const ground = Math.max( 1.35, terrain.heightAt( x, z ) );
		matrix.makeScale( w, h, d ).setPosition( x, ground + h * 0.5, z );
		wallMeshes[ pi ].setMatrixAt( wallCounts[ pi ] ++, matrix );
		matrix.makeScale( w * 1.04, 0.28, d * 1.04 ).setPosition( x, ground + h + 0.10, z );
		roof.setMatrixAt( roofCount ++, matrix );
		matrix.makeScale( w * 0.89, 0.24, d * 0.90 ).setPosition( x, ground + h + 0.34, z );
		roof.setMatrixAt( roofCount ++, matrix );
		matrix.makeScale( w * 0.72, 0.22, d * 0.74 ).setPosition( x, ground + h + 0.56, z );
		roof.setMatrixAt( roofCount ++, matrix );
		matrix.makeScale( w * 0.93, 0.28, d * 0.95 ).setPosition( x, ground + 0.12, z );
		foundation.setMatrixAt( foundationCount ++, matrix );

		const front = z + d * 0.505;
		for ( const floorY of h > 4.2 ? [ ground + 1.35, ground + 3.0 ] : [ ground + 1.38 ] ) {
			for ( const side of [ -1, 1 ] ) {
				const wx = x + side * w * 0.26;
				matrix.makeScale( 0.82, 0.96, 0.055 ).setPosition( wx, floorY, front );
				windows.setMatrixAt( windowCount ++, matrix );
				for ( const ss of [ -1, 1 ] ) {
					matrix.makeScale( 0.17, 1.0, 0.06 ).setPosition( wx + ss * 0.52, floorY, front + 0.02 );
					shutters.setMatrixAt( shutterCount ++, matrix );
				}
			}
		}
	}
	for ( let i = 0; i < wallMeshes.length; i ++ ) finishInstances( root, wallMeshes[ i ], wallCounts[ i ] );
	finishInstances( root, roof, roofCount );
	finishInstances( root, foundation, foundationCount );
	finishInstances( root, windows, windowCount );
	finishInstances( root, shutters, shutterCount );
	return houses;
}

function installRoadsidePlanting( app, root, M, GEO ) {
	const terrain = app.terrainData, matrix = new Matrix4();
	const shrubs = [];
	for ( let i = 0; i < 40; i ++ ) {
		const row = i % 2, t = i / 39;
		const x = -116 + t * 100 + Math.sin( i * 2.1 ) * 1.3;
		const z = ( row ? -78.5 : -74.5 ) + Math.sin( i * 0.83 ) * 1.0;
		shrubs.push( [ x, z, 1.0 + ( i % 4 ) * 0.18, i % 5 === 0 ] );
	}
	const hedge = new InstancedMesh( GEO.sphere, M.leaf, shrubs.length );
	const flowers = new InstancedMesh( GEO.sphere, M.flower, shrubs.filter( s => s[ 3 ] ).length );
	let hc = 0, fc = 0;
	for ( const [ x, z, s, flowering ] of shrubs ) {
		const y = Math.max( 1.35, terrain.heightAt( x, z ) ) + 0.78;
		matrix.makeScale( 1.35 * s, 0.72 * s, 0.92 * s ).setPosition( x, y, z );
		hedge.setMatrixAt( hc ++, matrix );
		if ( flowering ) {
			matrix.makeScale( 0.55, 0.46, 0.55 ).setPosition( x + 0.35, y + 0.45, z + 0.12 );
			flowers.setMatrixAt( fc ++, matrix );
		}
	}
	finishInstances( root, hedge, hc );
	finishInstances( root, flowers, fc );

	const palms = [ [ -111, -80 ], [ -98, -78 ], [ -84, -88 ], [ -71, -79 ], [ -57, -87 ], [ -46, -77 ], [ -33, -85 ], [ -20, -78 ], [ -92, -99 ], [ -63, -101 ], [ -35, -98 ] ];
	const trunks = new InstancedMesh( GEO.cyl, M.trunk, palms.length );
	const crowns = new InstancedMesh( GEO.sphere, M.palm, palms.length );
	for ( let i = 0; i < palms.length; i ++ ) {
		const [ x, z ] = palms[ i ], base = Math.max( 1.35, terrain.heightAt( x, z ) );
		const h = 4.4 + ( i % 4 ) * 0.72;
		matrix.makeScale( 0.18, h, 0.18 ).setPosition( x, base + h * 0.5, z );
		trunks.setMatrixAt( i, matrix );
		matrix.makeScale( 2.3 + ( i % 3 ) * 0.3, 0.72, 2.15 + ( i % 2 ) * 0.35 ).setPosition( x, base + h, z );
		crowns.setMatrixAt( i, matrix );
	}
	finishInstances( root, trunks );
	finishInstances( root, crowns );
}

function installSeabedVariation( app, root, M, GEO ) {
	const terrain = app.terrainData, matrix = new Matrix4();
	const D = WORLD.boatDock.position, R = WORLD.reef.center;
	const patches = [];
	for ( let i = 0; i < 34; i ++ ) {
		const t = ( i + 2 ) / 37;
		const x = D.x + ( R.x - D.x ) * t + Math.sin( i * 2.17 ) * ( 7 + ( i % 4 ) * 2 );
		const z = D.z + ( R.z - D.z ) * t + Math.cos( i * 1.37 ) * ( 6 + ( i % 3 ) * 2 );
		const y = app.reef?.floorHeightAt?.( x, z ) ?? terrain.heightAt( x, z );
		if ( Number.isFinite( y ) && y < -0.5 && y > -16 ) patches.push( [ x, y, z, i ] );
	}
	for ( const radius of [ 16, 30, 47 ] ) for ( let i = 0; i < 10; i ++ ) {
		const a = i / 10 * Math.PI * 2 + radius * 0.02;
		const x = R.x + Math.cos( a ) * radius, z = R.z + Math.sin( a ) * radius;
		const y = app.reef?.floorHeightAt?.( x, z ) ?? terrain.heightAt( x, z );
		if ( Number.isFinite( y ) && y < -0.5 && y > -17 ) patches.push( [ x, y, z, patches.length ] );
	}
	const reef = new InstancedMesh( GEO.sphere, M.reef, patches.length );
	const sand = new InstancedMesh( GEO.sphere, M.sand, patches.length );
	const grass = new InstancedMesh( GEO.sphere, M.grass, patches.length );
	let rc = 0, sc = 0, gc = 0;
	for ( const [ x, y, z, i ] of patches ) {
		const sx = 2.4 + ( i % 5 ) * 0.62, sz = 1.7 + ( i % 4 ) * 0.53;
		if ( i % 3 === 0 ) {
			matrix.makeScale( sx * 1.18, 0.075, sz * 1.22 ).setPosition( x, y + 0.06, z );
			sand.setMatrixAt( sc ++, matrix );
		} else {
			matrix.makeScale( sx, 0.24 + ( i % 3 ) * 0.07, sz ).setPosition( x, y + 0.13, z );
			reef.setMatrixAt( rc ++, matrix );
		}
		if ( i % 2 === 0 && y < -1.2 && y > -9 ) {
			matrix.makeScale( sx * 0.72, 0.06, sz * 0.65 ).setPosition( x + 0.45, y + 0.18, z - 0.3 );
			grass.setMatrixAt( gc ++, matrix );
		}
	}
	finishInstances( root, reef, rc );
	finishInstances( root, sand, sc );
	finishInstances( root, grass, gc );
}

function installWeatherPresentation( app, root, M, GEO ) {
	if ( app.__referenceWeatherPresentation ) return app.__referenceWeatherPresentation;
	const original = app.updateWeather?.bind( app );
	if ( original ) {
		// Existing weather modes remain authoritative, but evolve over ~5-6 minutes instead of rapidly
		// flipping every three minutes. The profile interpolation inside App remains smooth.
		app.updateWeather = ( dt ) => original( dt * 0.55 );
	}

	const rainCount = 72;
	const rain = new InstancedMesh( GEO.cyl, M.rain, rainCount );
	rain.name = 'BermudaStormRain';
	rain.visible = false;
	root.add( rain );
	const matrix = new Matrix4();
	const phase = Array.from( { length: rainCount }, ( _, i ) => ( ( i * 0.61803398875 ) % 1 ) );
	let last = typeof performance !== 'undefined' ? performance.now() : Date.now();
	let stormMix = 0;
	let raf = 0;
	const tick = ( now ) => {
		const dt = Math.min( 0.05, Math.max( 0, ( now - last ) / 1000 ) );
		last = now;
		const weather = app.settings?.weatherMode || 'clear';
		const weatherTarget = weather === 'storm' ? 1 : 0;
		stormMix += ( weatherTarget - stormMix ) * ( 1 - Math.exp( -dt * 0.55 ) );

		// Exposure follows daylight continuously, with a readable twilight plateau instead of an abrupt
		// day/night brightness jump. Storms lower the scene without crushing underwater visibility.
		const hour = app.settings?.timeOfDay ?? 12;
		const daylight = Math.max( 0, Math.sin( ( hour - 6 ) / 12 * Math.PI ) );
		const twilight = Math.max( 0, 1 - Math.abs( hour - 6 ) / 1.35, 1 - Math.abs( hour - 18 ) / 1.35 );
		const weatherDrop = weather === 'storm' ? 0.10 : weather === 'overcast' ? 0.055 : 0;
		const targetExposure = 0.43 + daylight * 0.29 + twilight * 0.055 - weatherDrop;
		if ( app.settings ) app.settings.exposure += ( targetExposure - app.settings.exposure ) * Math.min( 1, dt * 0.42 );
		if ( app.clouds?.shadowStrength ) {
			const shadow = weather === 'storm' ? 0.82 : weather === 'overcast' ? 0.66 : 0.46;
			app.clouds.shadowStrength.value += ( shadow - app.clouds.shadowStrength.value ) * Math.min( 1, dt * 0.35 );
		}

		const camera = app.camera;
		rain.visible = stormMix > 0.035 && camera && camera.position.y > -0.15;
		if ( rain.visible ) {
			for ( let i = 0; i < rainCount; i ++ ) {
				phase[ i ] = ( phase[ i ] + dt * ( 0.62 + ( i % 7 ) * 0.035 ) ) % 1;
				const a = i * 2.39996323, radius = 3 + ( i % 12 ) * 0.72;
				const x = camera.position.x + Math.cos( a ) * radius;
				const z = camera.position.z + Math.sin( a ) * radius;
				const y = camera.position.y + 8.5 - phase[ i ] * 15.0;
				matrix.makeScale( 0.012, 0.55 + stormMix * 0.55, 0.012 ).setPosition( x, y, z );
				rain.setMatrixAt( i, matrix );
			}
			rain.instanceMatrix.needsUpdate = true;
			rain.computeBoundingSphere();
		}
		if ( typeof requestAnimationFrame !== 'undefined' ) raf = requestAnimationFrame( tick );
	};
	if ( typeof requestAnimationFrame !== 'undefined' ) raf = requestAnimationFrame( tick );
	if ( typeof window !== 'undefined' ) window.addEventListener( 'pagehide', () => raf && cancelAnimationFrame( raf ), { once: true } );
	return app.__referenceWeatherPresentation = { rain, get stormMix() { return stormMix; } };
}

export function installReferenceEnvironmentAtmospherePass( app ) {
	if ( ! app?.scene || ! app?.terrainData || app.__referenceEnvironmentAtmospherePass ) return app?.__referenceEnvironmentAtmospherePass;
	const root = new Group();
	root.name = 'ReferenceEnvironmentAtmospherePass';
	app.scene.add( root );
	const M = {
		pink: mat( 'house-pink', 0xd8aaa8, 0.86 ), mint: mat( 'house-mint', 0xa8c8bc, 0.86 ),
		blue: mat( 'house-blue', 0x9bbbc9, 0.86 ), sand: mat( 'house-sand', 0xd8c3a6, 0.88 ),
		roof: mat( 'stepped-white-roof', 0xf3f0e6, 0.76 ), foundation: mat( 'limestone-foundation', 0xa69e8f, 0.97 ),
		window: mat( 'window', 0x263b45, 0.25, 0.06, { emissive: 0x0a1114 } ), shutter: mat( 'shutter', 0x315e57, 0.86 ),
		leaf: mat( 'sea-grape', 0x3f6849, 0.98 ), flower: mat( 'bougainvillea', 0xb83a66, 0.96 ),
		trunk: mat( 'palm-trunk', 0x776045, 1.0 ), palm: mat( 'palm-crown', 0x315f42, 0.98 ),
		reef: mat( 'reef-dark', 0x7a7768, 1.0 ), sand: mat( 'coral-sand', 0xc9bfa6, 1.0 ), grass: mat( 'seagrass', 0x31533c, 1.0 ),
		rain: mat( 'rain', 0xa9c5d4, 0.35, 0, { transparent: true, opacity: 0.32, depthWrite: false } ),
	};
	const GEO = {
		box: new BoxGeometry( 1, 1, 1 ), sphere: new SphereGeometry( 1, 10, 7 ), cyl: new CylinderGeometry( 1, 1, 1, 7 ),
	};
	const houses = installResidentialDepth( app, root, M, GEO );
	installRoadsidePlanting( app, root, M, GEO );
	installSeabedVariation( app, root, M, GEO );
	const weather = installWeatherPresentation( app, root, M, GEO );
	const state = app.__referenceEnvironmentAtmospherePass = { root, houses: houses.length, weather };
	if ( typeof window !== 'undefined' ) window.__referenceEnvironmentAtmospherePass = state;
	return state;
}
