// iPhone preset. ?graphics=stable selects the unchanged fallback.
// Keep the final canvas above 1 CSS pixel per pixel: the mobile post pass has
// bilinear output only, not the temporal upscaler used by the desktop renderer.
export const MOBILE_75 = Object.freeze( {
	renderScale: 0.75,
	outputScale: 1.35,
	oceanGridSize: 24,
	shoreSimRes: 256,
	sprayGpuCapacity: 2048,
	sprayCpuCapacity: 512,
	shadowSize: 768,
} );

export function configureMobile75Url( url ) {
	for ( const key of [ 'freezeFFT', 'noSim', 'noCaustics', 'noSpray', 'noClouds', 'noHaze' ] ) {
		url.searchParams.delete( key );
	}
	url.searchParams.set( 'graphics', '75' );
	url.searchParams.set( 'scale', String( MOBILE_75.renderScale ) );
	// Tidewater's FFT is unchanged; 24 is 75% of the original 32-point ocean grid.
	url.searchParams.set( 'G', String( MOBILE_75.oceanGridSize ) );
	// Show the cloud panorama without costly full-screen cloud ray marching.
	url.searchParams.set( 'cloudtest', 'panorama' );
	// Keep the progressive cubemap prime, then hold the reflection cache.
	url.searchParams.set( 'envtest', 'freeze' );
	return url;
}
