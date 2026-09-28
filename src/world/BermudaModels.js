import { BufferAttribute, BufferGeometry, Group, Mesh, Vector3 } from '../engine/index.js';
import { Material } from '../engine/render/Material.js';
import { loadStaticAsset, placeStaticAsset } from './bermuda/StaticAsset.js';
import { WATERFRONT_ASSETS, fitPlacement } from './bermuda/AssetLayout.js';

const BASE = ( ( import.meta.env && import.meta.env.BASE_URL ) || '/' ) + 'models/bermuda/';

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
	const state = app.bermudaModels = { group, ready: false, loaded: [], errors: [], metrics: {}, assets: [], nodes: [], completedTiers: [] };
	if ( typeof window !== 'undefined' ) window.__bermudaReferenceModels = state;
	await loadTier(app, 1);
    state.ready = state.errors.length === 0;
    return state;
}

async function loadTier(app, tier) {
    const state = app.bermudaModels, group = state.group;
    const entries = WATERFRONT_ASSETS.filter(a => a.tier === tier);
    for ( const entry of entries ) {
		let asset;
		try {
			const file = 'bermuda-' + entry.id + '.glb';
            app.onWaterfrontProgress?.( entries.indexOf(entry), entries.length, entry.id );
			asset = await loadStaticAsset( BASE + (entry.version || 'mobile-v2') + '/' + file, { id: entry.id, maxTriangles: entry.triangles, maxTextureSize: entry.texture } );
			const placements = entry.placements.filter( p => ! p.desktopOnly || ! app.bermudaBlockout.mobileLite )
				.map( p => fitPlacement( asset, p, app.terrainData ) );
			const node = placeStaticAsset( asset, placements );
            group.add(node);
            state.nodes.push({node, placements, distance: tier === 3 ? 550 : 230});
            const shop = entry.id === 'fish-market' ? app.game?.stand : entry.id === 'bait-tackle' ? app.game?.chandlery : null;
            if (shop) shop.group.visible = false;
            if (['house-c','house-d'].includes(entry.id)) for(const p of placements) {
                app.colliders?.addBox(new Vector3(p.x,p.y+p.height/2,p.z),new Vector3(p.width/2,p.height/2,p.depth/2),p.yaw||0,{tag:'bermuda-house'});
            }
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
	state.completedTiers.push(tier);
    if(tier === 1) app.onWaterfrontProgress?.(entries.length, entries.length, null);
    return state;
}

// Idempotent, sequential and observable. Optional failures never prevent gameplay.
export function startDeferredWaterfront(app) {
    if (!app.bermudaModels?.ready) return Promise.resolve(null);
    return app.bermudaDeferredPromise ||= (async () => {
        await new Promise(resolve => setTimeout(resolve, 1500));
        await loadTier(app, 2);
        await new Promise(resolve => setTimeout(resolve, 1500));
        await loadTier(app, 3);
        app.bermudaModels.complete = app.bermudaModels.errors.length === 0;
        return app.bermudaModels;
    })();
}
export function updateWaterfrontVisibility(app) {
    const p = app.player?.position || app.camera?.position;
    if (!p) return;
    for (const {node,placements,distance} of app.bermudaModels?.nodes || [])
        node.visible = placements.some(q => Math.hypot(q.x-p.x,q.z-p.z) < distance);
}
