import { BoxGeometry, Group, Mesh, TorusGeometry, Vector3 } from '../engine/index.js';
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

export function installRelicStory( app ) {
	if ( ! app || ! app.scene || ! app.terrainData || app.relicStory ) return app && app.relicStory;

	const mobile = mobileProfile();
	const group = new Group();
	group.name = 'RELIC_BERMUDA_STORY';
	const box = new BoxGeometry( 1, 1, 1 );
	const ring = new TorusGeometry( 1, 0.18, mobile ? 6 : 10, mobile ? 18 : 30 );
	const M = {
		limestone: material( 'limestone', 0xd9d4c8, 0.92, 0.04 ),
		obsidian: material( 'obsidian', 0x090b0e, 0.18, 0.88 ),
		amber: material( 'amber-slit', 0x4b2107, 0.22, 0.58, 0xff6b14 ),
	};

	// UNDERGROUND: a concealed dry-vault face cut into the Bermuda limestone headland. This is a
	// world anchor for the eventual elevator/dry-chamber sequence, not a generic sci-fi building.
	const vaultGround = app.terrainData.heightAt( RELIC_STORY.vault.x, RELIC_STORY.vault.z );
	const vault = new Group();
	vault.name = 'RELIC_VAULT_MOUTH';
	vault.position.set( RELIC_STORY.vault.x, vaultGround, RELIC_STORY.vault.z );
	mesh( vault, box, M.obsidian, 0, 1.75, 0, 4.6, 3.5, 0.30, 'relic-vault-door' );
	mesh( vault, box, M.limestone, -2.72, 1.82, 0.12, 0.86, 3.95, 1.15, 'relic-vault-rock-left' );
	mesh( vault, box, M.limestone, 2.72, 1.82, 0.12, 0.86, 3.95, 1.15, 'relic-vault-rock-right' );
	mesh( vault, box, M.limestone, 0, 3.58, 0.12, 6.3, 0.72, 1.15, 'relic-vault-rock-top' );
	mesh( vault, box, M.amber, 0, 1.74, 0.18, 0.055, 2.55, 0.10, 'relic-vault-needle' );
	group.add( vault );
	if ( app.colliders ) {
		app.colliders.addBox( new Vector3( RELIC_STORY.vault.x - 2.72, vaultGround + 1.82, RELIC_STORY.vault.z ), new Vector3( 0.43, 1.98, 0.58 ), 0, { tag: 'relic-vault-frame' } );
		app.colliders.addBox( new Vector3( RELIC_STORY.vault.x + 2.72, vaultGround + 1.82, RELIC_STORY.vault.z ), new Vector3( 0.43, 1.98, 0.58 ), 0, { tag: 'relic-vault-frame' } );
	}

	// OCEAN: concealed circular tunnel marker below the waterline. It is intentionally sparse so it
	// works with the existing diving gameplay and does not turn the reef into unrelated prop clutter.
	const floorY = app.terrainData.heightAt( RELIC_STORY.underwaterTunnel.x, RELIC_STORY.underwaterTunnel.z );
	const tunnelY = Math.min( -1.8, floorY + 2.35 );
	const tunnel = new Group();
	tunnel.name = 'RELIC_UNDERWATER_TUNNEL';
	tunnel.position.set( RELIC_STORY.underwaterTunnel.x, tunnelY, RELIC_STORY.underwaterTunnel.z );
	const outer = mesh( tunnel, ring, M.obsidian, 0, 0, 0, 2.45, 2.45, 2.45, 'relic-tunnel-ring' );
	outer.rotation.y = Math.PI * 0.5;
	const needle = mesh( tunnel, box, M.amber, 0, 0, 0.18, 0.05, 2.3, 0.08, 'relic-tunnel-needle' );
	needle.castShadow = false;
	group.add( tunnel );

	app.scene.add( group );
	app.relicStory = {
		group, vault, tunnel, anchors: RELIC_STORY,
		phaseOrder: [ 'ROAD', 'AIR', 'OCEAN', 'UNDERGROUND' ],
		mobile,
	};
	return app.relicStory;
}