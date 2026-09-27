import { Group, Mesh } from '../engine/index.js';
import { Material } from '../engine/render/Material.js';
import { parseGLB } from './debris/GLB.js';

const BASE = ( ( import.meta.env && import.meta.env.BASE_URL ) || '/' ) + 'models/bermuda/';

function isMobileProfile() {
	if ( typeof navigator === 'undefined' ) return false;
	return /iPhone|iPad|iPod|Android/i.test( navigator.userAgent ) ||
		( navigator.maxTouchPoints > 1 && Math.min( screen.width, screen.height ) < 1024 );
}

async function loadBytes( url ) {
	const res = await fetch( url );
	if ( ! res.ok ) throw new Error( 'BermudaModels: ' + url + ' ' + res.status );
	return res.arrayBuffer();
}

function material( name, color ) {
	return new Material( {
		name: 'bermuda-model-' + name,
		color,
		roughness: 0.82,
		metalness: 0,
		underwaterLighting: 'lite',
		localLightsCheap: true,
		receiveShadows: true,
	} );
}

// Placement is intentionally concentrated around the existing Bermuda landing. The primitive
// blockout remains as invisible collision geometry after the detailed meshes are ready.
const PLACEMENTS = [
	{ file: 'bermuda-dock.glb', name: 'ReferenceDock', x: -65.0, y: 0.98, z: -30.0, yaw: 0, scale: 1.0, color: 0x8d765d },
	{ file: 'bermuda-house-a.glb', name: 'ReferenceHouseA', x: -80.0, y: 1.45, z: -69.0, yaw: 0.06, scale: 1.0, color: 0xe8a6aa },
	{ file: 'bermuda-house-b.glb', name: 'ReferenceHouseB', x: -61.0, y: 1.45, z: -73.5, yaw: -0.05, scale: 1.0, color: 0xe4cc7b },
	{ file: 'bermuda-boathouse.glb', name: 'ReferenceBoathouse', x: -52.5, y: 0.95, z: -43.8, yaw: 0, scale: 1.0, color: 0xf0eee5 },
];

export async function installBermudaModels( app ) {
	if ( ! app || ! app.scene ) return null;
	if ( app.bermudaModels ) return app.bermudaModels;

	const mobile = isMobileProfile() && !( app.qs && app.qs.has( 'desktop' ) );
	const tier = mobile ? 'mobile/' : 'desktop/';
	const group = new Group();
	group.name = 'BermudaReferenceModels-' + ( mobile ? 'mobile' : 'desktop' );
	app.scene.add( group );
	app.bermudaModels = { group, tier, ready: false, loaded: [], errors: [] };

	for ( const p of PLACEMENTS ) {
		try {
			const parsed = parseGLB( await loadBytes( BASE + tier + p.file ) );
			const mat = material( p.name, p.color );
			const asset = new Group();
			asset.name = p.name;
			asset.position.set( p.x, p.y, p.z );
			asset.rotation.y = p.yaw;
			asset.scale.set( p.scale, p.scale, p.scale );
			for ( const part of parsed.meshes ) {
				const mesh = new Mesh( part.geometry, mat );
				mesh.name = p.name + ':' + part.name;
				mesh.castShadow = ! mobile;
				mesh.receiveShadow = true;
				asset.add( mesh );
			}
			group.add( asset );
			app.bermudaModels.loaded.push( p.file );
		} catch ( error ) {
			console.error( 'BermudaModels: failed', p.file, error );
			app.bermudaModels.errors.push( { file: p.file, message: String( error && ( error.message || error ) ) } );
		}
	}

	app.bermudaModels.ready = app.bermudaModels.loaded.length > 0;
	if ( app.bermudaModels.ready && app.bermudaBlockout && app.bermudaBlockout.group ) {
		// Keep all blockout colliders registered, but remove the placeholder boxes from the image so
		// the generated reference meshes can be judged without primitive geometry covering them.
		app.bermudaBlockout.group.visible = false;
	}
	window.__bermudaReferenceModels = app.bermudaModels;
	return app.bermudaModels;
}
