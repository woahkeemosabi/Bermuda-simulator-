import {
	BoxGeometry, Group, Mesh, Vector3,
} from '../engine/index.js';
import { Material } from '../engine/render/Material.js';
import { placeStaticAsset } from './bermuda/StaticAsset.js';
import { installReferenceStreetLifeModels } from './ReferenceStreetLifeModels.js';

const _p = new Vector3();

function mat( name, color, emissive = 0x000000, roughness = 0.22, metalness = 0.72 ) {
	return new Material( {
		name: `exact-video-${ name }`, color, emissive, roughness, metalness,
		underwaterLighting: 'lite', receiveShadows: true,
	} );
}

function addBox( parent, material, p, s, r, name ) {
	const m = new Mesh( new BoxGeometry( 1, 1, 1 ), material );
	m.name = name;
	m.position.set( ...p );
	m.scale.set( ...s );
	if ( r ) m.rotation.set( ...r );
	m.castShadow = true;
	m.receiveShadow = true;
	parent.add( m );
	return m;
}

function installRelicVideoMatch( app ) {
	const vehicle = app.relic001?.group;
	if ( ! vehicle || app.__relicExactVideoMatch ) return app.__relicExactVideoMatch;

	// The uploaded RELIC clip is the authoritative road/design reference: very low black hypercar,
	// sharp vented hood, warm/red cockpit and two separate angular tail signatures rather than a
	// generic continuous rear light bar. Hover/AIR/SUB transformation remains owned by RelicVehicle.
	const root = new Group();
	root.name = 'RELIC_EXACT_VIDEO_DETAILS';
	vehicle.add( root );
	const carbon = mat( 'relic-carbon', 0x05070a, 0x000000, 0.18, 0.94 );
	const red = mat( 'relic-red', 0x3d0305, 0xff2118, 0.13, 0.36 );
	const warm = mat( 'relic-cockpit-warm', 0x39140d, 0xff4c19, 0.20, 0.30 );

	// Long hood channels / blade creases visible in the front three-quarter shots.
	for ( const x of [ -0.61, -0.31, 0.31, 0.61 ] ) {
		addBox( root, carbon, [ x, 0.77, 1.34 ], [ 0.055, 0.035, 1.42 ], [ -0.10, x * 0.035, 0 ], 'relic-hood-channel' );
	}
	addBox( root, carbon, [ 0, 0.82, 1.62 ], [ 0.20, 0.045, 1.12 ], [ -0.12, 0, 0 ], 'relic-hood-spine' );

	// Warm cabin edge visible through the dark glass in the uploaded night/cave clip.
	addBox( root, warm, [ 0, 1.06, 0.02 ], [ 1.02, 0.025, 1.14 ], null, 'relic-red-room-glow' );

	// Replace the provisional full-width bar with four angular chevrons matching the reference rear.
	vehicle.traverse?.( ( o ) => {
		if ( o.name === 'relic-rear-light-bar' ) o.visible = false;
	} );
	for ( const side of [ -1, 1 ] ) {
		addBox( root, red, [ side * 0.76, 0.76, -2.31 ], [ 0.34, 0.045, 0.038 ], [ 0, side * -0.04, side * 0.34 ], 'relic-tail-chevron' );
		addBox( root, red, [ side * 0.91, 0.69, -2.30 ], [ 0.26, 0.042, 0.038 ], [ 0, side * 0.03, side * -0.48 ], 'relic-tail-chevron' );
	}

	app.__relicExactVideoMatch = { root };
	return app.__relicExactVideoMatch;
}

function installReferenceCharacterModels( app, state ) {
	const asset = state?.maleAsset;
	if ( ! asset || app.__exactReferenceCharacters ) return app.__exactReferenceCharacters;
	const root = new Group();
	root.name = 'Exact54SecondCharacters';
	app.scene.add( root );

	const playerScale = 1.78 / Math.max( 0.01, asset.size.y );
	const playerModel = placeStaticAsset( asset, [ { x: 0, y: 0, z: 0, yaw: 0, scale: playerScale } ] );
	playerModel.name = 'Exact54SecondPlayer';
	root.add( playerModel );

	// The earlier final pass used an intentionally cheap articulated proxy. Keep it as fallback only;
	// once the validated Meshy model exists, make the proxy effectively disappear without disturbing
	// its camera wrapper or touching gameplay state.
	const proxy = app.bermudaReferenceFinal?.playerPresentation?.avatar?.root;
	if ( proxy ) proxy.scale.setScalar( 0.0001 );

	const movers = [];
	const female = state.femaleAsset;
	const makeMover = ( src, x0, z0, range, speed, phase, height ) => {
		if ( ! src ) return;
		const scale = height / Math.max( 0.01, src.size.y );
		const g = placeStaticAsset( src, [ { x: 0, y: 0, z: 0, yaw: 0, scale } ] );
		root.add( g );
		movers.push( { group: g, x0, z0, range, speed, phase } );
	};
	makeMover( asset, -98, -56.15, 6.5, 0.42, 0.2, 1.78 );
	makeMover( female, -44, -55.85, 5.0, 0.48, 1.7, 1.70 );

	// Hide only the primitive moving extras from ReferenceFinalPass; the separately loaded detailed
	// static NPCs remain in place around the market/road as in the final third of the source video.
	for ( const w of app.bermudaReferenceFinal?.walkers || [] ) w.root.scale.setScalar( 0.0001 );

	let lastMode = null;
	let raf = 0;
	const tick = ( now ) => {
		const player = app.player;
		const presentation = player?.__bermudaReferencePresentation;
		const third = presentation?.thirdPerson !== false;
		const active = player && ( player.mode === 'walk' || player.mode === 'swim' ) && third;
		playerModel.visible = !! active;
		if ( active ) {
			playerModel.position.copy( player.position );
			const speed = Math.hypot( player.velocity.x, player.velocity.y, player.velocity.z );
			const bob = Math.sin( now * 0.012 ) * Math.min( 0.035, speed * 0.006 );
			playerModel.position.y += bob;
			playerModel.rotation.y = player.yaw + Math.PI;
			playerModel.rotation.x = player.mode === 'swim' ? -1.08 : Math.min( 0.08, speed * 0.008 );
		}

		const t = now * 0.001;
		for ( const m of movers ) {
			const a = t * m.speed + m.phase;
			const x = m.x0 + Math.sin( a ) * m.range;
			const terrain = app.terrainData.heightAt( x, m.z0 );
			const coll = app.colliders?.groundHeightAt( x, m.z0, 30 ) ?? - Infinity;
			m.group.position.set( x, Math.max( terrain, Number.isFinite( coll ) ? coll : terrain ), m.z0 );
			m.group.rotation.y = Math.cos( a ) >= 0 ? - Math.PI * 0.5 : Math.PI * 0.5;
			m.group.position.y += Math.abs( Math.sin( a * 5.2 ) ) * 0.018;
		}

		// Match the reference boat presentation when the player first takes the helm: a close elevated
		// chase view, not the very distant debug orbit. The user can still zoom/orbit after this preset.
		if ( player?.mode !== lastMode ) {
			if ( player?.mode === 'boat' && player.camMode === 'third' ) {
				player.orbitDist = 10.5;
				player.orbitPitch = 0.27;
				player.camInit = false;
			}
			lastMode = player?.mode;
		}

		raf = requestAnimationFrame( tick );
	};
	raf = requestAnimationFrame( tick );
	window?.addEventListener?.( 'pagehide', () => raf && cancelAnimationFrame( raf ), { once: true } );

	const exact = app.__exactReferenceCharacters = { root, playerModel, movers };
	return exact;
}

export function installReferenceExactVideoPass( app ) {
	if ( ! app || app.__referenceExactVideoPass ) return app?.__referenceExactVideoPass;
	const exact = app.__referenceExactVideoPass = { characters: null, relic: installRelicVideoMatch( app ) };

	// The 54-second upload is the whole-simulator benchmark. Reuse the already-validated high-detail
	// character GLBs after they finish streaming; do not hold the loader or gameplay hostage for them.
	void installReferenceStreetLifeModels( app ).then( ( state ) => {
		exact.characters = installReferenceCharacterModels( app, state );
	} ).catch( ( error ) => console.warn( 'Exact 54-second character pass kept fallback models.', error ) );

	if ( typeof window !== 'undefined' ) window.__referenceExactVideoPass = exact;
	return exact;
}
