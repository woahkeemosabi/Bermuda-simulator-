// iPhone full-effects preset. ?graphics=stable keeps the low-GPU fallback.
export const MOBILE_75 = Object.freeze( {
	// Restore the last iPhone-confirmed playable framebuffer sizes while we
	// isolate WebGPU's higher-resolution device-loss regression.
	renderScale: 0.75,
	sceneScale: 0.75,
	shoreSimRes: 256,
	sprayGpuCapacity: 2048,
	sprayCpuCapacity: 512,
	shadowSize: 512,
} );

export function configureMobile75Url( url ) {
	for ( const key of [ 'freezeFFT', 'noSim', 'noCaustics', 'noSpray', 'noClouds', 'noHaze' ] ) {
		url.searchParams.delete( key );
	}
	url.searchParams.set( 'graphics', '75' );
	url.searchParams.set( 'scale', String( MOBILE_75.sceneScale ) );
	url.searchParams.set( 'G', '12' );
	// Show the cloud panorama without costly full-screen cloud ray marching.
	url.searchParams.set( 'cloudtest', 'panorama' );
	// Keep the progressive cubemap prime, then hold the reflection cache.
	// Keep explicit GPU diagnostics at the regular mobile resolution.
	// Previous normalization silently replaced ?envtest=skip with freeze,
	// preventing reliable A/B isolation of the cubemap-bake stage.
	if ( !url.searchParams.has( 'envtest' ) ) url.searchParams.set( 'envtest', 'freeze' );
	return url;
}
// Opt-in staged image-quality trial. Keep the baseline 75% profile unchanged.
export const MOBILE_SHARP_85 = Object.freeze({ renderScale: 0.85, sceneScale: 0.85 });

export function configureMobileSharp85Url( url ) {
	url.searchParams.set( 'scale', String( MOBILE_SHARP_85.sceneScale ) );
	// Hold the diagnostic A/B condition constant: dynamic IBL cubemap bake off.
	url.searchParams.set( 'envtest', 'skip' );
	return url;
}

// The FFT-only diagnostic disabled auxiliary passes. Measure whether the
// recovered headroom can support real scene detail on iPhone. These profiles
// change only output and internal render size; FFT simulation stays original.
// Normal gameplay and ?gpuTrace=1&traceCase=fftcore (no qualityTest) are unchanged.
export const FFTCORE_VISUAL_PROFILES = Object.freeze({
	balanced: Object.freeze({ renderScale: 0.90, sceneScale: 0.90 }),
	crisp: Object.freeze({ renderScale: 1.00, sceneScale: 1.00 }),
});

export function getFftCoreVisualProfile( id ) {
	return Object.prototype.hasOwnProperty.call( FFTCORE_VISUAL_PROFILES, id )
		? FFTCORE_VISUAL_PROFILES[ id ] : null;
}
