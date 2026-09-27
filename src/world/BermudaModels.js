import { BufferAttribute, BufferGeometry, Group, Mesh } from '../engine/index.js';
import { Material } from '../engine/render/Material.js';
import { loadStaticAsset, placeStaticAsset } from './bermuda/StaticAsset.js';
import { WATERFRONT_ASSETS, fitPlacement } from './bermuda/AssetLayout.js';

const BASE = ( ( import.meta.env && import.meta.env.BASE_URL ) || '/' ) + 'models/bermuda/mobile-v2/';

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
	const state = app.bermudaModels = { group, ready: false, loaded: [], errors: [], metrics: {}, assets: [] };
	if ( typeof window !== 'undefined' ) window.__bermudaReferenceModels = state;
	// Sequential loads bound image-decoding and GPU-upload memory on iPhone.
	for ( const entry of WATERFRONT_ASSETS ) {
		let asset;
		try {
			const file = 'bermuda-' + entry.id + '.glb';
            app.onWaterfrontProgress?.( state.loaded.length, WATERFRONT_ASSETS.length, entry.id );
			asset = await loadStaticAsset( BASE + file, { id: entry.id, maxTriangles: entry.triangles, maxTextureSize: entry.texture } );
			const placements = entry.placements.filter( p => ! p.desktopOnly || ! app.bermudaBlockout.mobileLite )
				.map( p => fitPlacement( asset, p, app.terrainData ) );
			group.add( placeStaticAsset( asset, placements ) );
			if ( entry.id === 'channel-marker' ) {
                const geometry = new BufferGeometry();
                geometry.setAttribute( 'position', new BufferAttribute( new Float32Array( [ -0.6, 0, 0, 0.6, 0, 0, 0, 0.9, 0 ] ), 3 ) );
                geometry.computeVertexNormals();
                const sign = new Mesh( geometry, new Material( { name: 'channel-daymark', color: 0xdc3028, roughness: 0.9, side: 'double', receiveShadows: false } ) );
                sign.position.set( placements[0].x, 2.45, placements[0].z );
                group.add( sign );
            }
            state.assets.push( asset );
			state.loaded.push( file );
			state.metrics[ entry.id ] = { triangles: asset.triangles, instances: placements.length, textures: asset.textures.size,
				bounds: [ asset.size.x, asset.size.y, asset.size.z ], placements };
			for ( const mesh of app.bermudaBlockout.visuals[ entry.id ] || [] ) mesh.visible = false;
			if ( entry.id === 'dock' ) {
				// Meet the landing head visually while preserving existing collision surfaces.
				for ( const mesh of app.bermudaBlockout.visuals.approach || [] ) { mesh.scale.z = 30.1; mesh.position.z = -31.95; }
			}
		} catch ( error ) {
			asset?.dispose();
			state.errors.push( { id: entry.id, message: String( error.message || error ) } );
			console.error( 'Bermuda waterfront asset failed:', entry.id, error );
		}
	}
	state.ready = state.loaded.length === WATERFRONT_ASSETS.length;
    app.onWaterfrontProgress?.( state.loaded.length, WATERFRONT_ASSETS.length, null );
	return state;
}
