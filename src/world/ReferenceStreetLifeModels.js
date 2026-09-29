import { Group } from '../engine/index.js';
import { loadStaticAsset, placeStaticAsset } from './bermuda/StaticAsset.js';

const BASE = ((import.meta.env && import.meta.env.BASE_URL) || '/') + 'models/bermuda/street-life/';

function isMobileProfile() {
	if ( typeof navigator === 'undefined' ) return false;
	const mobileHardware = /iPhone|iPad|iPod|Android/i.test( navigator.userAgent ) ||
		( navigator.maxTouchPoints > 1 && typeof screen !== 'undefined' && Math.min( screen.width, screen.height ) < 1024 );
	if ( typeof location === 'undefined' ) return mobileHardware;
	const qs = new URLSearchParams( location.search );
	if ( qs.has( 'assetDesktop' ) ) return false;
	// ?desktop is a world/rendering-quality override, not permission to duplicate desktop-size
	// background NPC textures on iPhone. Keep background street-life efficient on phone hardware.
	return mobileHardware;
}

function groundAt( app, x, z ) {
	const terrain = app.terrainData.heightAt( x, z );
	const collider = app.colliders ? app.colliders.groundHeightAt( x, z, 30 ) : - Infinity;
	return Math.max( terrain, Number.isFinite( collider ) ? collider : terrain );
}

function hideProcedural( app, kind ) {
	const name = kind === 'scooter' ? 'bermuda-scooter' : 'bermuda-pedestrian';
	app.bermudaStreetLife?.group?.traverse?.( ( o ) => {
		if ( o.name === name ) o.visible = false;
	} );
}

function personPlacements( app, points, scale ) {
	return points.map( ( p ) => ( {
		x: p.x,
		y: groundAt( app, p.x, p.z ) + 0.01,
		z: p.z,
		yaw: p.yaw,
		scale: scale * ( p.scale || 1 ),
	} ) );
}

function breathe() {
	return new Promise( ( resolve ) => setTimeout( resolve, 350 ) );
}

export function installReferenceStreetLifeModels( app ) {
	if ( ! app?.scene || ! app?.terrainData ) return Promise.resolve( null );
	if ( app.bermudaStreetLifeModelsPromise ) return app.bermudaStreetLifeModelsPromise;
	app.bermudaStreetLifeModelsPromise = loadStreetLife( app );
	return app.bermudaStreetLifeModelsPromise;
}

async function loadStreetLife( app ) {
	const mobile = isMobileProfile();
	const tier = mobile ? 'mobile' : 'desktop';
	const texture = mobile ? 1024 : 2048;
	const root = new Group();
	root.name = 'BermudaMeshyStreetLife';
	app.scene.add( root );

	const state = app.bermudaStreetLifeModels = {
		group: root, mobile, loaded: [], errors: [],
		scooterAsset: null, maleAsset: null, femaleAsset: null,
	};
	if ( typeof window !== 'undefined' ) window.__bermudaStreetLifeModels = state;

	try {
		const scooter = await loadStaticAsset( BASE + tier + '/bermuda-scooter.glb', {
			id: 'street-scooter', maxTriangles: mobile ? 36000 : 115000, maxTextureSize: texture,
		} );
		state.scooterAsset = scooter;
		const longest = Math.max( scooter.size.x, scooter.size.z );
		const scale = 1.90 / Math.max( 0.01, longest );
		const placements = [
			{ x: -101.0, z: -51.35, yaw: Math.PI * 0.50 },
			{ x: -47.5, z: -51.25, yaw: Math.PI * 0.48 },
			{ x: -31.5, z: -51.10, yaw: Math.PI * 0.52 },
		].map( ( p ) => ( { ...p, y: groundAt( app, p.x, p.z ) + 0.02, scale } ) );
		root.add( placeStaticAsset( scooter, placements ) );
		state.loaded.push( 'bermuda-scooter.glb' );
		hideProcedural( app, 'scooter' );
	} catch ( error ) {
		state.errors.push( { id: 'scooter', message: String( error.message || error ) } );
		console.warn( 'Bermuda street-life scooter model failed; keeping procedural fallback.', error );
	}

	if ( mobile ) await breathe();

	// Load the two background character bases one at a time on phone hardware. They remain instanced
	// after load; the stagger only removes the simultaneous decode/texture-upload spike.
	try {
		const male = await loadStaticAsset( BASE + tier + '/bermuda-npc-male.glb', {
			id: 'street-npc-male', maxTriangles: mobile ? 26000 : 68000, maxTextureSize: texture,
		} );
		if ( mobile ) await breathe();
		const female = await loadStaticAsset( BASE + tier + '/bermuda-npc-female.glb', {
			id: 'street-npc-female', maxTriangles: mobile ? 26000 : 68000, maxTextureSize: texture,
		} );
		state.maleAsset = male;
		state.femaleAsset = female;
		const maleScale = 1.78 / Math.max( 0.01, male.size.y );
		const femaleScale = 1.70 / Math.max( 0.01, female.size.y );
		const malePoints = [
			{ x: -106.0, z: -56.3, yaw: Math.PI * 0.13, scale: 1.00 },
			{ x: -57.0, z: -56.1, yaw: Math.PI * 0.16, scale: 0.98 },
			{ x: -24.0, z: -56.0, yaw: Math.PI * 0.08, scale: 1.03 },
			{ x: -62.3, z: -21.3, yaw: - Math.PI * 0.50, scale: 1.00 },
		];
		const femalePoints = [
			{ x: -93.5, z: -55.8, yaw: - Math.PI * 0.10, scale: 0.98 },
			{ x: -42.0, z: -55.6, yaw: - Math.PI * 0.12, scale: 1.02 },
		];
		root.add( placeStaticAsset( male, personPlacements( app, malePoints, maleScale ) ) );
		root.add( placeStaticAsset( female, personPlacements( app, femalePoints, femaleScale ) ) );
		state.loaded.push( 'bermuda-npc-male.glb', 'bermuda-npc-female.glb' );
		hideProcedural( app, 'pedestrian' );
	} catch ( error ) {
		state.errors.push( { id: 'pedestrians', message: String( error.message || error ) } );
		console.warn( 'Bermuda street-life NPC models failed; keeping procedural fallbacks.', error );
	}

	state.ready = state.loaded.length === 3;
	return state;
}
