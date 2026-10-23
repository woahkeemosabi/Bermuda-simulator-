import { Matrix4, Quaternion, Vector3 } from '../engine/index.js';
import { loadStaticAsset, placeStaticAsset } from './bermuda/StaticAsset.js';

const BASE = ((import.meta.env && import.meta.env.BASE_URL) || '/') + 'models/bermuda/';
const HERO = BASE + 'hero/';
const Y_AXIS = new Vector3( 0, 1, 0 );

function isMobileHardware() {
	if ( typeof navigator === 'undefined' ) return false;
	return /iPhone|iPad|iPod|Android/i.test( navigator.userAgent ) ||
		( navigator.maxTouchPoints > 1 && typeof screen !== 'undefined' && Math.min( screen.width, screen.height ) < 1024 );
}

function useMobileAssetTier() {
	if ( typeof location === 'undefined' ) return isMobileHardware();
	const params = new URLSearchParams( location.search );
	if ( params.has( 'assetDesktop' ) ) return false;
	return isMobileHardware();
}

function waitUntilVisible() {
	if ( typeof document === 'undefined' || document.visibilityState === 'visible' ) return Promise.resolve();
	return new Promise( ( resolve ) => {
		const onVisible = () => {
			if ( document.visibilityState !== 'visible' ) return;
			document.removeEventListener( 'visibilitychange', onVisible );
			resolve();
		};
		document.addEventListener( 'visibilitychange', onVisible );
	} );
}

const breathe = ( ms ) => new Promise( ( resolve ) => setTimeout( resolve, ms ) );

function tuneStaticMaterials( asset, kind ) {
	for ( const material of asset.materials.values() ) {
		if ( kind === 'relic' ) {
			material.roughness = Math.min( material.roughness, 0.22 );
			material.metalness = Math.max( material.metalness, 0.78 );
			material.localLightsCheap = false;
			material.receiveShadows = true;
			material.underwaterLighting = 'lite';
		} else {
			material.roughness = Math.max( 0.46, Math.min( material.roughness, 0.64 ) );
			material.metalness = Math.min( material.metalness, 0.08 );
			material.localLightsCheap = true;
			material.underwaterLighting = 'full';
		}
	}
}

function hideLegacyRelicRenderLayers( app, productionNode ) {
	// Production means production: once the Meshy car exists there must not be a procedural body,
	// duplicate shell or reference sculpt rendered through it. Keep the gameplay root/collider and
	// vehicle controller intact; hide only its old visual children.
	if ( app.__referenceRelicHeroShell?.root ) app.__referenceRelicHeroShell.root.visible = false;
	if ( app.__referenceExactVideoPass?.relic?.root ) app.__referenceExactVideoPass.relic.root.visible = false;
	if ( app.__referenceRelicVisualClosure?.root ) app.__referenceRelicVisualClosure.root.visible = false;
	for ( const child of app.relic001?.group?.children || [] ) {
		if ( child !== productionNode ) child.visible = false;
	}
}

async function installRelic( app, mobile ) {
	await waitUntilVisible();
	if ( ! app.relic001?.group ) throw new Error( 'RELIC gameplay object is not ready.' );
	const tier = mobile ? 'mobile' : 'desktop';
	const asset = await loadStaticAsset( HERO + tier + '/relic-001.glb', {
		id: 'production-relic-001',
		maxTriangles: mobile ? 220000 : 420000,
		maxTextureSize: mobile ? 2048 : 4096,
	} );
	tuneStaticMaterials( asset, 'relic' );
	const horizontalLongest = Math.max( asset.size.x, asset.size.z );
	const scale = 4.90 / Math.max( 0.01, horizontalLongest );
	const yaw = asset.size.x > asset.size.z ? Math.PI * 0.5 : 0;
	const node = placeStaticAsset( asset, [ { x: 0, y: 0.18, z: 0, yaw, scale } ] );
	node.name = 'MeshyProductionRELIC001';
	app.relic001.group.add( node );
	hideLegacyRelicRenderLayers( app, node );
	return app.__productionMeshyRelic = { asset, node, scale, tier };
}

async function installLobsters( app, mobile ) {
	await waitUntilVisible();
	const lobsters = app.game?.lobsters;
	if ( ! lobsters?.items?.length ) throw new Error( 'Lobster gameplay system is not ready.' );
	const tier = mobile ? 'mobile' : 'desktop';
	const asset = await loadStaticAsset( HERO + tier + '/bermuda-spiny-lobster.glb', {
		id: 'production-spiny-lobster',
		maxTriangles: mobile ? 150000 : 280000,
		maxTextureSize: mobile ? 2048 : 4096,
	} );
	tuneStaticMaterials( asset, 'lobster' );
	const horizontalLongest = Math.max( asset.size.x, asset.size.z );
	const baseScale = 0.92 / Math.max( 0.01, horizontalLongest );
	const modelYaw = asset.size.x > asset.size.z ? Math.PI * 0.5 : 0;
	const placements = lobsters.items.map( ( l ) => ( {
		x: l.x,
		y: lobsters.floorAt( l.x, l.z ) + 0.015,
		z: l.z,
		yaw: l.yaw + modelYaw,
		scale: baseScale * ( 0.92 + l.size * 0.15 ),
	} ) );
	const node = placeStaticAsset( asset, placements );
	node.name = 'MeshyProductionSpinyLobsters';
	app.scene.add( node );
	const instanceMeshes = node.children.filter( ( child ) => child.isInstancedMesh );
	if ( ! instanceMeshes.length ) throw new Error( 'Production lobster asset did not produce instanced meshes.' );

	const matrix = new Matrix4();
	const position = new Vector3();
	const rotation = new Quaternion();
	const scale = new Vector3();
	const originalUpdate = lobsters.update.bind( lobsters );
	const sync = () => {
		for ( let i = 0; i < lobsters.items.length; i ++ ) {
			const l = lobsters.items[ i ];
			const gameplayVisible = !! l.active && l.mesh.visible !== false;
			const s = gameplayVisible ? baseScale * ( 0.92 + l.size * 0.15 ) : 0.00001;
			position.set( l.x, lobsters.floorAt( l.x, l.z ) + 0.015, l.z );
			rotation.setFromAxisAngle( Y_AXIS, l.yaw + modelYaw );
			scale.setScalar( s );
			matrix.compose( position, rotation, scale );
			for ( const mesh of instanceMeshes ) mesh.setMatrixAt( i, matrix );
			l.mesh.visible = false;
		}
		for ( const mesh of instanceMeshes ) mesh.instanceMatrix.needsUpdate = true;
	};
	lobsters.update = ( dt, player, camera ) => {
		for ( const l of lobsters.items ) if ( l.active ) l.mesh.visible = true;
		originalUpdate( dt, player, camera );
		sync();
	};
	sync();
	return app.__productionMeshyLobsters = { asset, node, instanceMeshes, baseScale, tier };
}

export function installProductionWorldAssetsNoPlayer( app ) {
	if ( ! app?.scene ) return Promise.resolve( null );
	if ( app.__productionWorldAssetsNoPlayerPromise ) return app.__productionWorldAssetsNoPlayerPromise;
	app.__productionWorldAssetsNoPlayerPromise = ( async () => {
		const hardwareMobile = isMobileHardware();
		const mobileAssets = useMobileAssetTier();
		const state = app.__productionWorldAssetsNoPlayer = {
			mobile: mobileAssets,
			hardwareMobile,
			playerBody: false,
			lobsters: null,
			relic: null,
			loaded: [],
			errors: [],
		};
		if ( typeof window !== 'undefined' ) window.__productionWorldAssetsNoPlayer = state;

		// RELIC is a visible hero object beside the opening road and must win the streaming queue.
		// Previously it waited behind lobster decoding plus a 2.2 s delay, leaving the procedural
		// fallback on screen long enough to look like the finished car on iPhone.
		for ( const [ id, install ] of [
			[ 'relic', () => installRelic( app, mobileAssets ) ],
			[ 'lobsters', () => installLobsters( app, mobileAssets ) ],
		] ) {
			if ( hardwareMobile ) {
				await waitUntilVisible();
				await breathe( id === 'relic' ? 200 : 750 );
			}
			try {
				state[ id ] = await install();
				state.loaded.push( id );
			} catch ( error ) {
				state.errors.push( { id, message: String( error?.message || error ) } );
				console.warn( `Production ${ id } integration failed; validated fallback remains active.`, error );
			}
		}
		state.ready = state.loaded.length === 2;
		return state;
	} )();
	return app.__productionWorldAssetsNoPlayerPromise;
}
