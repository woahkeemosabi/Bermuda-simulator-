import { BufferAttribute, BufferGeometry, Group, Mesh, Vector3 } from '../engine/index.js';
import { Material } from '../engine/render/Material.js';
import { loadStaticAsset, placeStaticAsset } from './bermuda/StaticAsset.js';
import { WATERFRONT_ASSETS, fitPlacement } from './bermuda/AssetLayout.js';

const BASE = ( ( import.meta.env && import.meta.env.BASE_URL ) || '/' ) + 'models/bermuda/';
const sleep = ( ms ) => new Promise( ( resolve ) => setTimeout( resolve, ms ) );

function isMobileHardware() {
	if ( typeof navigator === 'undefined' ) return false;
	return /iPhone|iPad|iPod|Android/i.test( navigator.userAgent ) ||
		( navigator.maxTouchPoints > 1 && typeof screen !== 'undefined' && Math.min( screen.width, screen.height ) < 1024 );
}

function mobileSafeLevel() {
	if ( typeof location === 'undefined' ) return 0;
	return Math.max( 0, Number( new URLSearchParams( location.search ).get( 'gpuSafe' ) || 0 ) );
}

function waitForFirstPlayerGesture() {
	if ( ! isMobileHardware() || typeof window === 'undefined' ) return Promise.resolve();
	if ( window.__bermudaPlayerGestureSeen ) return Promise.resolve();
	return new Promise( ( resolve ) => {
		const finish = () => {
			window.__bermudaPlayerGestureSeen = true;
			window.removeEventListener( 'pointerdown', finish, true );
			window.removeEventListener( 'touchstart', finish, true );
			window.removeEventListener( 'keydown', finish, true );
			resolve();
		};
		window.addEventListener( 'pointerdown', finish, { once: true, capture: true, passive: true } );
		window.addEventListener( 'touchstart', finish, { once: true, capture: true, passive: true } );
		window.addEventListener( 'keydown', finish, { once: true, capture: true } );
	} );
}

async function loadWaterfrontAsset( entry, file, tier ) {
	const url = BASE + ( entry.version || 'mobile-v2' ) + '/' + file;
	const options = {
		id: entry.id,
		maxTriangles: entry.triangles,
		maxTextureSize: entry.texture,
	};
	const attempts = tier === 1 && entry.id === 'dock' && isMobileHardware() ? 3 : 1;
	let lastError;
	for ( let attempt = 0; attempt < attempts; attempt ++ ) {
		try {
			const retryURL = attempt === 0 ? url : url + '?retry=' + Date.now() + '-' + attempt;
			return await loadStaticAsset( retryURL, options );
		} catch ( error ) {
			lastError = error;
			if ( attempt + 1 < attempts ) await sleep( 350 * ( attempt + 1 ) );
		}
	}
	throw lastError;
}

export function installBermudaModels( app ) {
	if ( ! app ) return Promise.resolve( null );
	return app.bermudaModelsPromise ||= loadWaterfront( app );
}

async function loadWaterfront( app ) {
	if ( ! app?.scene || ! app.terrainData || ! app.bermudaBlockout ) return null;
	if ( app.bermudaModels ) return app.bermudaModels;
	const group = new Group();
	group.name = 'BermudaMeshyWaterfront';
	app.scene.add( group );
	const state = app.bermudaModels = { group, ready: false, loaded: [], errors: [], warnings: [], fallbacks: [], metrics: {}, assets: [], nodes: [], completedTiers: [] };
	if ( typeof window !== 'undefined' ) window.__bermudaReferenceModels = state;
	await loadTier( app, 1 );
	state.ready = state.errors.length === 0;
	return state;
}

async function loadTier( app, tier ) {
	const state = app.bermudaModels;
	const group = state.group;
	const entries = WATERFRONT_ASSETS.filter( ( asset ) => asset.tier === tier );
	for ( const entry of entries ) {
		let asset;
		try {
			const file = 'bermuda-' + entry.id + '.glb';
			if ( tier === 1 ) app.onWaterfrontProgress?.( entries.indexOf( entry ), entries.length, entry.id );
			asset = await loadWaterfrontAsset( entry, file, tier );
			const placements = entry.placements
				.filter( ( placement ) => ! placement.desktopOnly || ! app.bermudaBlockout.mobileLite )
				.map( ( placement ) => fitPlacement( asset, placement, app.terrainData ) );
			const node = placeStaticAsset( asset, placements );
			group.add( node );
			state.nodes.push( { node, placements, distance: tier === 3 ? 550 : 230 } );
			const shop = entry.id === 'fish-market' ? app.game?.stand : entry.id === 'bait-tackle' ? app.game?.chandlery : null;
			if ( shop?.fallback ) shop.fallback.visible = false;

			if ( [ 'house-c', 'house-d' ].includes( entry.id ) ) {
				for ( const placement of placements ) {
					app.colliders?.addBox(
						new Vector3( placement.x, placement.y + placement.height / 2, placement.z ),
						new Vector3( placement.width / 2, placement.height / 2, placement.depth / 2 ),
						placement.yaw || 0,
						{ tag: 'bermuda-house' },
					);
				}
			}

			if ( entry.id === 'marina-kit' ) {
				const hulls = [
					{ x: -111, z: 3.5, w: 3.4, d: 12.0, yaw: .02 },
					{ x: -104.8, z: 7.0, w: 3.0, d: 10.5, yaw: -.18 },
					{ x: -117.5, z: 7.5, w: 3.2, d: 11.0, yaw: .16 },
					{ x: -110.0, z: -3.0, w: 2.8, d: 9.5, yaw: .04 },
				];
				for ( const hull of hulls ) {
					app.colliders?.addBox(
						new Vector3( hull.x, .15, hull.z ),
						new Vector3( hull.w * .5, 1.35, hull.d * .5 ),
						hull.yaw,
						{ tag: 'marina-boat' },
					);
				}
				state.marinaHulls = hulls;
			}

			if ( entry.id === 'channel-marker' ) {
				const geometry = new BufferGeometry();
				geometry.setAttribute( 'position', new BufferAttribute( new Float32Array( [ -.6, 0, 0, .6, 0, 0, 0, .9, 0 ] ), 3 ) );
				geometry.computeVertexNormals();
				const sign = new Mesh( geometry, new Material( { name: 'channel-daymark', color: 0xdc3028, roughness: .9, side: 'double', receiveShadows: false } ) );
				sign.position.set( placements[ 0 ].x, 2.45, placements[ 0 ].z );
				group.add( sign );
			}

			state.assets.push( asset );
			state.loaded.push( file );
			state.metrics[ entry.id ] = {
				triangles: asset.triangles,
				instances: placements.length,
				textures: asset.textures.size,
				bounds: [ asset.size.x, asset.size.y, asset.size.z ],
				placements,
			};
			for ( const mesh of app.bermudaBlockout.visuals[ entry.id ] || [] ) mesh.visible = false;
			if ( entry.id === 'dock' ) {
				for ( const mesh of app.bermudaBlockout.visuals.approach || [] ) {
					mesh.scale.z = 30.1;
					mesh.position.z = -31.95;
				}
			}
		} catch ( error ) {
			asset?.dispose();
			const message = String( error.message || error );
			if ( tier === 1 && entry.id === 'dock' && app.bermudaBlockout ) {
				// Safari occasionally reports a transient network "Load failed" for the 1.8 MB dock GLB.
				// The procedural dock/blockout is already a complete playable fallback, so never trap the
				// player at 99% because one presentation asset failed to fetch or decode.
				state.warnings.push( { id: entry.id, message } );
				state.fallbacks.push( entry.id );
				console.warn( 'Bermuda dock GLB unavailable; continuing with blockout fallback:', error );
			} else {
				state.errors.push( { id: entry.id, message } );
				console.error( 'Bermuda waterfront asset failed:', entry.id, error );
			}
		}
		if ( tier > 1 ) await sleep( 60 );
	}
	state.completedTiers.push( tier );
	if ( tier === 1 ) app.onWaterfrontProgress?.( entries.length, entries.length, null );
	return state;
}

// Only the dock is boot-critical. On phones, decorative GLBs do not begin decoding until the first
// in-page player gesture (normally Explore), which avoids a network/decode/GPU spike under the start
// overlay. If the dock presentation GLB fails, the procedural dock remains playable and boot may
// continue. Recovery levels progressively skip decorative tiers so recovery is materially cheaper.
export function startDeferredWaterfront( app ) {
	if ( ! app.bermudaModels?.ready ) return Promise.resolve( null );
	if ( ! app.bermudaDeferredPromise ) {
		app.bermudaDeferredPromise = ( async () => {
			const mobile = isMobileHardware();
			const safeLevel = mobile ? mobileSafeLevel() : 0;
			if ( mobile ) await waitForFirstPlayerGesture();

			if ( safeLevel >= 2 ) {
				app.bermudaModels.recoverySkippedDecorative = true;
				app.bermudaModels.complete = true;
				return app.bermudaModels;
			}

			await sleep( mobile ? 900 : 1500 );
			await loadTier( app, 2 );

			if ( safeLevel === 0 ) {
				await sleep( mobile ? 2200 : 1500 );
				await loadTier( app, 3 );
			} else {
				app.bermudaModels.recoverySkippedTier3 = true;
			}

			app.bermudaModels.complete = app.bermudaModels.errors.length === 0;
			return app.bermudaModels;
		} )().catch( ( error ) => {
			console.error( 'Deferred Bermuda waterfront streaming failed:', error );
			return app.bermudaModels;
		} );
	}
	return Promise.resolve( app.bermudaModels );
}

export function updateWaterfrontVisibility( app ) {
	const position = app.player?.position || app.camera?.position;
	if ( ! position ) return;
	for ( const { node, placements, distance } of app.bermudaModels?.nodes || [] ) {
		node.visible = placements.some( ( placement ) => Math.hypot( placement.x - position.x, placement.z - position.z ) < distance );
	}
}
