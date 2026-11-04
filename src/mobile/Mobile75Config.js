// iPhone full-effects preset. ?graphics=stable keeps the low-GPU fallback.
export const MOBILE_75 = Object.freeze( {
	// Present at CSS-pixel resolution, rather than blurring a 75%-size canvas.
	// The scene remains at 80% resolution to protect iPhone GPU headroom.
	// This is twice the scene pixel count of the previous 0.75 * 0.75 preset.
	renderScale: 1,
	sceneScale: 0.8,
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
	url.searchParams.set( 'envtest', 'freeze' );
	return url;
}
