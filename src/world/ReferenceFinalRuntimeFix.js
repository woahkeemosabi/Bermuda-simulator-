import { Vector3 } from '../engine/index.js';
import { installReferenceVerticalSlicePass } from './ReferenceVerticalSlicePass.js';

// Last runtime integration fixes for the 54-second reference pass.
// The visual final pass is installed before the touch controls are created, so this module keeps the
// contextual CAM control's DOM state aligned with the third-person camera wrapper once the mobile
// controls appear. It also makes the water material visibly follow weather and time-of-day.

function patchRelicRuntime( app ) {
	const relic = app?.relic;
	if ( ! relic || relic.__referenceRuntimePatched ) return relic;
	relic.__referenceRuntimePatched = true;

	// MODE is now strictly the road/hover return path. Flight and submersion are deliberate actions
	// on RISE/FLY and DESC/SUB, so tapping MODE over the ocean can no longer unexpectedly dive the car.
	relic.cycleMode = () => {
		const mode = relic.driveMode;
		if ( mode === 'ROAD' ) return relic.setDriveMode( 'HOVER' );
		if ( mode === 'AIR' || mode === 'SUB' ) return relic.setDriveMode( 'HOVER' );
		if ( mode === 'HOVER' ) {
			const water = relic.waterSurfaceAt();
			const ground = relic.groundAt( relic.position.x, relic.position.z );
			if ( ground >= water - 0.35 ) return relic.setDriveMode( 'ROAD' );
			relic.toast?.( 'Use FLY to climb or SUB to dive', 1400 );
			return true;
		}
		return false;
	};

	const hiddenForCockpit = [];
	const collectCockpitParts = () => {
		hiddenForCockpit.length = 0;
		relic.group?.traverse?.( ( object ) => {
			if ( object.userData?.hideInRelicFirstPerson ) hiddenForCockpit.push( object );
		} );
	};
	const setCockpitVisibility = ( firstPerson ) => {
		collectCockpitParts();
		for ( const object of hiddenForCockpit ) object.visible = ! firstPerson;
	};

	const cockpitEye = new Vector3();
	const baseCamera = relic.updateCamera.bind( relic );
	relic.updateCamera = ( player, dt ) => {
		const firstPerson = relic.cameraMode === 'first';
		setCockpitVisibility( firstPerson );
		baseCamera( player, dt );
		if ( firstPerson ) {
			// Put the lens at the actual left-hand driver position instead of above the centre of the
			// procedural shell. The canopy/glow are hidden only for this camera, eliminating near-plane
			// flashing while the dashboard/interior remains visible around the player.
			relic.group.updateWorldMatrix?.( true, false );
			cockpitEye.set( -0.36, 1.055, 0.20 );
			relic.group.localToWorld?.( cockpitEye );
			player.camera.position.copy( cockpitEye );
		}
	};

	const baseExit = relic.exit.bind( relic );
	relic.exit = ( player ) => {
		const result = baseExit( player );
		if ( result ) setCockpitVisibility( false );
		return result;
	};

	relic.__setReferenceCockpitVisibility = setCockpitVisibility;
	return relic;
}

export function installReferenceFinalRuntimeFix( app ) {
	if ( ! app || app.__bermudaReferenceFinalRuntimeFix ) return app?.__bermudaReferenceFinalRuntimeFix;
	installReferenceVerticalSlicePass( app );

	let camButton = null;
	let camObserver = null;
	let last = typeof performance !== 'undefined' ? performance.now() : Date.now();
	let raf = 0;

	const footCameraRelevant = () => {
		const mode = app.player?.mode;
		return mode === 'walk' || mode === 'swim' || mode === 'deck';
	};

	const bindCamButton = () => {
		if ( typeof document === 'undefined' ) return;
		const found = document.querySelector( '#bm-touch-stable button[data-role="cam"]' );
		if ( ! found ) return;
		if ( found !== camButton ) {
			camObserver?.disconnect?.();
			camButton = found;
			if ( typeof MutationObserver !== 'undefined' ) {
				camObserver = new MutationObserver( () => {
					// BermudaMobileStable's context refresh predates the third-person walk/swim/deck
					// presentation. Keep its hit-test state identical to the button the player sees.
					if ( footCameraRelevant() && camButton?.classList.contains( 'bm-hidden' ) ) {
						camButton.classList.remove( 'bm-hidden' );
					}
				} );
				camObserver.observe( camButton, { attributes: true, attributeFilter: [ 'class' ] } );
			}
		}
		if ( footCameraRelevant() ) camButton.classList.remove( 'bm-hidden' );
	};

	const updateWaterState = ( dt ) => {
		const params = app.waterMaterial?.params;
		if ( ! params ) return;
		const weather = app.settings?.weatherMode || 'clear';
		const weatherK = weather === 'storm' ? 1 : weather === 'overcast' ? 0.55 : 0;
		const hour = app.settings?.timeOfDay ?? 12;
		// 0 at night, 1 around noon. Twilight transitions continuously instead of snapping.
		const daylight = Math.max( 0, Math.sin( ( hour - 6 ) / 12 * Math.PI ) );
		const roughTarget = 0.017 + weatherK * 0.045 + ( 1 - daylight ) * 0.008;
		const reflectionTarget = 0.97 - weatherK * 0.16 - ( 1 - daylight ) * 0.10;
		const backscatterTarget = 0.019 + weatherK * 0.010 + ( 1 - daylight ) * 0.004;
		const k = Math.min( 1, dt * 0.8 );
		if ( params.roughness ) params.roughness.value += ( roughTarget - params.roughness.value ) * k;
		if ( params.reflectionStrength ) params.reflectionStrength.value += ( reflectionTarget - params.reflectionStrength.value ) * k;
		if ( params.backscatter ) params.backscatter.value += ( backscatterTarget - params.backscatter.value ) * Math.min( 1, dt * 0.7 );
	};

	const tick = ( now ) => {
		const dt = Math.min( 0.05, Math.max( 0, ( now - last ) / 1000 ) );
		last = now;
		bindCamButton();
		const relic = patchRelicRuntime( app );
		if ( relic && app.player?.mode !== 'relic' ) relic.__setReferenceCockpitVisibility?.( false );
		updateWaterState( dt );
		if ( typeof requestAnimationFrame !== 'undefined' ) raf = requestAnimationFrame( tick );
	};

	if ( typeof requestAnimationFrame !== 'undefined' ) raf = requestAnimationFrame( tick );
	if ( typeof window !== 'undefined' ) window.addEventListener( 'pagehide', () => {
		if ( raf ) cancelAnimationFrame( raf );
		camObserver?.disconnect?.();
	}, { once: true } );

	const state = app.__bermudaReferenceFinalRuntimeFix = {
		get camButton() { return camButton; },
		get footCameraRelevant() { return footCameraRelevant(); },
		get relicPatched() { return !! app.relic?.__referenceRuntimePatched; },
	};
	if ( typeof window !== 'undefined' ) window.__bermudaReferenceFinalRuntimeFix = state;
	return state;
}
