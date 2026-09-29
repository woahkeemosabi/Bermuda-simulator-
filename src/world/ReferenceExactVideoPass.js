import {
	BoxGeometry, Group, Mesh,
} from '../engine/index.js';
import { Material } from '../engine/render/Material.js';
import { placeStaticAsset } from './bermuda/StaticAsset.js';
import { installReferenceStreetLifeModels } from './ReferenceStreetLifeModels.js';
import { installReferenceRelicHeroShell } from './ReferenceRelicHeroShell.js';
import { installReferenceArticulatedCharacters } from './ReferenceArticulatedCharacters.js';
import { installReferenceMaterialFidelityPass } from './ReferenceMaterialFidelityPass.js';
import { installReferenceMarineDensityPass } from './ReferenceMarineDensityPass.js';
import { installReferenceEnvironmentAtmospherePass } from './ReferenceEnvironmentAtmospherePass.js';
import { installReferenceClosurePass } from './ReferenceClosurePass.js';
import { installReferenceVisualClosurePass } from './ReferenceVisualClosurePass.js';
import { installBermudaDockHudFix } from '../mobile/BermudaDockHudFix.js';

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

	// The dedicated RELIC references are authoritative for the car. The hero shell owns silhouette,
	// proportions, DRLs and rear signature; this layer adds only close-range identity details.
	const root = new Group();
	root.name = 'RELIC_EXACT_VIDEO_DETAILS';
	vehicle.add( root );
	const carbon = mat( 'relic-carbon', 0x030406, 0x000000, 0.16, 0.96 );
	const warm = mat( 'relic-cockpit-warm', 0x30100a, 0xff4518, 0.20, 0.30 );

	for ( const x of [ -0.58, -0.29, 0.29, 0.58 ] ) {
		addBox( root, carbon, [ x, 0.605, 1.38 ], [ 0.038, 0.022, 0.94 ], [ -0.07, x * 0.025, 0 ], 'relic-hood-channel' );
	}
	addBox( root, carbon, [ 0, 0.625, 1.62 ], [ 0.15, 0.025, 0.88 ], [ -0.08, 0, 0 ], 'relic-hood-spine' );

	const cabinGlow = addBox( root, warm, [ 0, 0.985, 0.05 ], [ 0.86, 0.018, 1.02 ], null, 'relic-red-room-glow' );
	cabinGlow.userData.hideInRelicFirstPerson = true;

	app.__relicExactVideoMatch = { root, cabinGlow };
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
	playerModel.name = 'Exact54SecondPlayerIdle';
	playerModel.visible = false;
	root.add( playerModel );

	let lastMode = null;
	let raf = 0;
	const tick = () => {
		const player = app.player;
		const presentation = player?.__bermudaReferencePresentation;
		const third = presentation?.thirdPerson !== false;
		const footMode = player && ( player.mode === 'walk' || player.mode === 'swim' );
		const speed = footMode ? Math.hypot( player.velocity.x, player.velocity.y, player.velocity.z ) : 0;
		const camDistance = footMode ? app.camera.position.distanceTo( player.position ) : 0;
		const animated = !! app.__articulatedReferencePlayerVisible || player?.mode === 'swim' || speed > 0.18;

		// Never render the external body into a first-person/near-clipped camera. The screenshot defect
		// was the camera physically entering this static Meshy body while diving.
		const showIdle = !! footMode && player.mode === 'walk' && third && ! animated && camDistance > 1.55;
		playerModel.visible = showIdle;
		if ( showIdle ) {
			playerModel.position.copy( player.position );
			playerModel.rotation.y = player.yaw + Math.PI;
			playerModel.rotation.x = 0;
		}

		// Match the 54-second gameplay reference with a close, readable chase view at the helm.
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

	const exact = app.__exactReferenceCharacters = { root, playerModel, movers: [] };
	return exact;
}

export function installReferenceExactVideoPass( app ) {
	if ( ! app || app.__referenceExactVideoPass ) return app?.__referenceExactVideoPass;
	const heroShell = installReferenceRelicHeroShell( app );
	const articulated = installReferenceArticulatedCharacters( app );
	const fidelity = installReferenceMaterialFidelityPass( app );
	const marine = installReferenceMarineDensityPass( app );
	const environment = installReferenceEnvironmentAtmospherePass( app );
	const dockHud = installBermudaDockHudFix( app );
	const closure = installReferenceClosurePass( app );
	const visualClosure = installReferenceVisualClosurePass( app );
	const exact = app.__referenceExactVideoPass = {
		characters: null,
		articulated,
		fidelity,
		marine,
		environment,
		dockHud,
		closure,
		visualClosure,
		relicShell: heroShell,
		relic: installRelicVideoMatch( app ),
	};

	// Detailed static GLB is now used only for a still third-person player pose. Movement and swimming
	// stay on the articulated rig, so limbs actually stride/kick/stroke instead of sliding a rigid model.
	void installReferenceStreetLifeModels( app ).then( ( state ) => {
		exact.characters = installReferenceCharacterModels( app, state );
	} ).catch( ( error ) => console.warn( 'Exact 54-second character pass kept articulated fallback.', error ) );

	if ( typeof window !== 'undefined' ) window.__referenceExactVideoPass = exact;
	return exact;
}
