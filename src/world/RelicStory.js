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
	const archRing = new TorusGeometry( 1, 0.28, mobile ? 6 : 10, mobile ? 16 : 24 );
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
	const mouth = mesh( vault, box, M.obsidian, 0, 1.45, 0.34, 2.25, 2.8, 0.18, 'relic-vault-recess' );
	mouth.castShadow = false;
	const arch = mesh( vault, archRing, M.limestone, 0, 1.58, 0.12, 2.3, 1.45, 0.72, 'relic-vault-limestone-arch' );
	arch.rotation.x = Math.PI * 0.5;
	mesh( vault, box, M.limestone, -2.55, 1.35, 0.05, 0.72, 2.75, 1.12, 'relic-vault-rock-left' ).rotation.z = -0.08;
	mesh( vault, box, M.limestone, 2.55, 1.35, 0.05, 0.72, 2.75, 1.12, 'relic-vault-rock-right' ).rotation.z = 0.08;
	mesh( vault, box, M.limestone, 0, 3.25, 0.04, 5.9, 0.72, 1.1, 'relic-vault-rock-top' ).rotation.z = 0.03;
	mesh( vault, box, M.amber, 0, 1.45, 0.58, 0.045, 1.95, 0.05, 'relic-vault-needle' );
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