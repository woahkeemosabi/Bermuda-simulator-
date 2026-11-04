// Experimental iPhone preset. ?graphics=stable selects the unchanged fallback.
export const MOBILE_75 = Object.freeze( {
	renderScale: 0.75,
	// Canvas output is already 75% of CSS dimensions. Do not multiply the
	// internal scene by another 0.75 (0.75² = 56.25%, visibly pixelated).
	sceneScale: 1,
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
