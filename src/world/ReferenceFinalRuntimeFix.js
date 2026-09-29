// Last runtime integration fixes for the 54-second reference pass.
// The visual final pass is installed before the touch controls are created, so this module keeps the
// contextual on-foot CAM control's DOM state aligned with the third-person camera wrapper once the
// mobile controls appear. It also makes the water material visibly follow weather and time-of-day.

export function installReferenceFinalRuntimeFix( app ) {
	if ( ! app || app.__bermudaReferenceFinalRuntimeFix ) return app?.__bermudaReferenceFinalRuntimeFix;

	let camButton = null;
	let camObserver = null;
	let last = typeof performance !== 'undefined' ? performance.now() : Date.now();
	let raf = 0;

	const footCameraRelevant = () => {
		const mode = app.player?.mode;
		return mode === 'walk' || mode === 'swim';
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
					// BermudaMobileStable's own 100 ms context refresh predates the on-foot third-person
					// camera. If it re-adds bm-hidden while walking/swimming, remove it immediately so
					// its hit-test (button:not(.bm-hidden)) stays consistent with what the player sees.
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
	};
	if ( typeof window !== 'undefined' ) window.__bermudaReferenceFinalRuntimeFix = state;
	return state;
}
