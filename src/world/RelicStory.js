import { BoxGeometry, Group, Mesh, SphereGeometry, TorusGeometry, Vector3 } from '../engine/index.js';
import { Material } from '../engine/render/Material.js';
import { RELIC_POS } from './Relic001.js';

export const RELIC_STORY = Object.freeze( {
	road: { x: RELIC_POS.x, z: RELIC_POS.z },
	aerolift: { x: -48, z: -24 },
	submersion: { x: -88, z: 16 },
	underwaterTunnel: { x: -96, z: 14 },
	vault: { x: -80, z: -103 },
} );

function mobileProfile() {
	if ( typeof navigator === 'undefined' ) return false;
	return /iPhone|iPad|iPod|Android/i.test( navigator.userAgent ) ||
		( navigator.maxTouchPoints > 1 && Math.min( screen.width, screen.height ) < 1024 );
}

function material( name, color, roughness, metalness, emissive = 0x000000 ) {
	return new Material( {
		name: `relic-story-${ name }`, color, roughness, metalness, emissive,
		underwaterLighting: 'lite', localLightsCheap: false, receiveShadows: true,
	} );
}

function mesh( group, geometry, mat, x, y, z, sx, sy, sz, name ) {
	const m = new Mesh( geometry, mat );
	m.name = name;
	m.position.set( x, y, z );
	m.scale.set( sx, sy, sz );
	m.castShadow = true;
	m.receiveShadow = true;
	group.add( m );
	return m;
}

function rock( group, geometry, mat, x, y, z, sx, sy, sz, name, rx = 0, ry = 0, rz = 0 ) {
	const r = mesh( group, geometry, mat, x, y, z, sx, sy, sz, name );
	r.rotation.set( rx, ry, rz );
	return r;
}

export function installRelicStory( app ) {
	if ( ! app || ! app.scene || ! app.terrainData || app.relicStory ) return app && app.relicStory;

	const mobile = mobileProfile();
	const group = new Group();
	group.name = 'RELIC_BERMUDA_STORY';
	const box = new BoxGeometry( 1, 1, 1 );
	const rockGeo = new SphereGeometry( 1, mobile ? 8 : 12, mobile ? 6 : 9 );
	const ring = new TorusGeometry( 1, 0.18, mobile ? 6 : 10, mobile ? 18 : 30 );
	const M = {
		limestone: material( 'limestone', 0xd9d4c8, 0.96, 0.01 ),
		limestoneShade: material( 'limestone-shadow', 0xbeb8a9, 0.98, 0.01 ),
		obsidian: material( 'obsidian', 0x090b0e, 0.18, 0.88 ),
		amber: material( 'amber-slit', 0x4b2107, 0.22, 0.58, 0xff6b14 ),
	};

	// UNDERGROUND: the technology sits deep inside an irregular Bermuda limestone opening. From the
	// road/headland this must read as a natural cave first, not a rectangular sci-fi doorway.
	const vaultGround = app.terrainData.heightAt( RELIC_STORY.vault.x, RELIC_STORY.vault.z );
	const vault = new Group();
	vault.name = 'RELIC_VAULT_MOUTH';
	vault.position.set( RELIC_STORY.vault.x, vaultGround, RELIC_STORY.vault.z );
	const mouth = mesh( vault, box, M.obsidian, 0, 1.55, 1.02, 2.05, 2.48, 0.12, 'relic-vault-deep-recess' );
	mouth.castShadow = false;
	mesh( vault, box, M.amber, 0, 1.55, 1.16, 0.045, 1.82, 0.045, 'relic-vault-needle' ).castShadow = false;

	const vaultRocks = [
		[ -2.75, 0.88, 0.08, 1.38, 1.18, 1.34, -0.10, 0.22, -0.16 ],
		[ -2.55, 2.16, 0.03, 1.30, 1.44, 1.28, 0.16, -0.12, -0.12 ],
		[ -1.92, 3.18, 0.05, 1.34, 1.05, 1.22, -0.04, 0.18, 0.20 ],
		[ -0.72, 3.72, 0.02, 1.48, 0.82, 1.35, 0.10, -0.14, 0.04 ],
		[  0.70, 3.68, 0.08, 1.42, 0.86, 1.30, -0.06, 0.19, -0.08 ],
		[  1.88, 3.16, 0.02, 1.34, 1.06, 1.22, 0.08, -0.18, -0.18 ],
		[  2.58, 2.12, 0.06, 1.30, 1.43, 1.30, -0.13, 0.11, 0.13 ],
		[  2.78, 0.86, 0.04, 1.38, 1.16, 1.35, 0.09, -0.20, 0.16 ],
		[ -3.85, 1.52, 0.45, 1.85, 1.72, 1.72, 0.05, 0.24, -0.05 ],
		[  3.90, 1.42, 0.42, 1.90, 1.66, 1.78, -0.04, -0.20, 0.06 ],
	];
	vaultRocks.forEach( ( r, i ) => rock( vault, rockGeo, i % 3 === 0 ? M.limestoneShade : M.limestone,
		r[ 0 ], r[ 1 ], r[ 2 ], r[ 3 ], r[ 4 ], r[ 5 ], `relic-vault-limestone-${ i }`, r[ 6 ], r[ 7 ], r[ 8 ] ) );
	group.add( vault );
	if ( app.colliders ) {
		// Leave a broad, clean central aperture while keeping the visible limestone shoulders solid.
		app.colliders.addBox( new Vector3( RELIC_STORY.vault.x - 3.18, vaultGround + 1.65, RELIC_STORY.vault.z + 0.08 ), new Vector3( 1.02, 1.72, 1.08 ), 0, { tag: 'relic-vault-rock' } );
		app.colliders.addBox( new Vector3( RELIC_STORY.vault.x + 3.18, vaultGround + 1.65, RELIC_STORY.vault.z + 0.08 ), new Vector3( 1.02, 1.72, 1.08 ), 0, { tag: 'relic-vault-rock' } );
	}

	// OCEAN: the covert entrance is embedded in a limestone reef opening. The engineered ring remains
	// visible only inside the rock throat so a diver or RELIC in SUB mode discovers it rather than
	// seeing a freestanding circular prop from across the reef.
	const floorY = app.terrainData.heightAt( RELIC_STORY.underwaterTunnel.x, RELIC_STORY.underwaterTunnel.z );
	const tunnelY = Math.min( -1.8, floorY + 2.35 );
	const tunnel = new Group();
	tunnel.name = 'RELIC_UNDERWATER_TUNNEL';
	tunnel.position.set( RELIC_STORY.underwaterTunnel.x, tunnelY, RELIC_STORY.underwaterTunnel.z );
	const outer = mesh( tunnel, ring, M.obsidian, 0, 0, 0.38, 2.22, 2.22, 2.22, 'relic-tunnel-inner-ring' );
	outer.rotation.y = Math.PI * 0.5;
	const needle = mesh( tunnel, box, M.amber, 0, 0, 0.55, 0.05, 2.08, 0.06, 'relic-tunnel-needle' );
	needle.castShadow = false;
	const tunnelRocks = [
		[ -2.55, -1.58, 0.02, 1.45, 1.02, 1.38 ], [ -2.72, -0.18, -0.03, 1.28, 1.42, 1.30 ],
		[ -2.34,  1.32, 0.02, 1.30, 1.22, 1.36 ], [ -1.25,  2.35, 0.00, 1.38, 1.10, 1.30 ],
		[  0.18,  2.68, 0.03, 1.42, 0.92, 1.32 ], [  1.58,  2.23, 0.00, 1.34, 1.12, 1.30 ],
		[  2.48,  1.18, 0.04, 1.30, 1.22, 1.38 ], [  2.72, -0.28, 0.00, 1.30, 1.42, 1.32 ],
		[  2.46, -1.62, 0.04, 1.42, 1.02, 1.38 ],
	];
	tunnelRocks.forEach( ( r, i ) => rock( tunnel, rockGeo, i % 2 ? M.limestoneShade : M.limestone,
		r[ 0 ], r[ 1 ], r[ 2 ], r[ 3 ], r[ 4 ], r[ 5 ], `relic-tunnel-limestone-${ i }`, i * 0.07, i * -0.09, i * 0.05 ) );
	group.add( tunnel );

	app.scene.add( group );
	app.relicStory = {
		group, vault, tunnel, anchors: RELIC_STORY,
		phaseOrder: [ 'ROAD', 'AIR', 'OCEAN', 'UNDERGROUND' ],
		mobile,
	};
	return app.relicStory;
}
