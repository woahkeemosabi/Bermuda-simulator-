// Opt-in GPU isolation, run on the ONE existing game URL via ?gpuTrace=1.
// Every case keeps Tidewater's unmodified four-cascade FFT running.
// Only non-FFT systems (or output pixel count) differ between cases.
export const GPU_TRACE_CASES = Object.freeze( [
	{ id: 'full', label: 'Reproduce full workload' },
	{ id: 'clouds', label: 'Without cloud passes', flags: { noClouds: '1' } },
	{ id: 'shoreline', label: 'Without shoreline simulation', flags: { noSim: '1' } },
	{ id: 'spray', label: 'Without spray', flags: { noSpray: '1' } },
	{ id: 'caustics', label: 'Without caustics', flags: { noCaustics: '1' } },
	{ id: 'reflections', label: 'Without reflection bake', flags: { envtest: 'skip' } },
	{ id: 'haze', label: 'Without aerial haze', flags: { noHaze: '1' } },
	{ id: 'shadows', label: 'With smaller shadows' },
	{ id: 'resolution', label: 'With fewer scene pixels' },
	{ id: 'fftcore', label: 'FFT with auxiliary GPU effects isolated', flags: {
		noClouds: '1', noSim: '1', noSpray: '1', noCaustics: '1', noHaze: '1', envtest: 'skip',
	} },
] );

export function getGpuTraceCase( id ) {
	return GPU_TRACE_CASES.find( item => item.id === id ) || GPU_TRACE_CASES[ 0 ];
}

export function configureGpuTraceUrl( url ) {
	const test = getGpuTraceCase( url.searchParams.get( 'traceCase' ) );
	url.searchParams.set( 'traceCase', test.id );
	// Reproduce the high-resolution crash only when the user explicitly requests
	// tracing. This never changes the regular/playable mobile graphics profile.
	url.searchParams.set( 'G', '24' );
	for ( const [ key, value ] of Object.entries( test.flags || {} ) )
		url.searchParams.set( key, value );
	return url;
}

export function nextGpuTraceUrl( currentUrl ) {
	const url = new URL( currentUrl );
	const index = GPU_TRACE_CASES.findIndex( test => test.id === getGpuTraceCase( url.searchParams.get( 'traceCase' ) ).id );
	const next = GPU_TRACE_CASES[ ( index + 1 ) % GPU_TRACE_CASES.length ];
	// Remove overrides injected by the previous test; the normal mobile preset
	// will establish its own defaults before the next test is applied.
	for ( const key of [ 'noClouds', 'noSim', 'noSpray', 'noCaustics', 'noHaze', 'envtest' ] )
		url.searchParams.delete( key );
	url.searchParams.set( 'gpuTrace', '1' );
	url.searchParams.set( 'traceCase', next.id );
	return url;
}
