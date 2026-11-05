// Opt-in GPU isolation, run on the ONE existing game URL via ?gpuTrace=1.
// Every case keeps Tidewater's unmodified four-cascade FFT running.
// Only non-FFT systems (or output pixel count) differ between cases.
export const GPU_TRACE_CASES = Object.freeze( [
	{ id: 'full', label: 'Reproduce full workload' },
	{ id: 'clouds', label: 'Without cloud passes', flags: { noClouds: '1' } },
	{ id: 'shoreline', label: 'Without shoreline simulation', flags: { noSim: '1' } },
	{ id: 'spray', label: 'Without spray', flags: { noSpray: '1' } },
	{ id: 'wake', label: 'Without GPU Kelvin wake', flags: { noWake: '1' } },
	{ id: 'breakers', label: 'Without surf crests', flags: { noBreakers: '1' } },
	{ id: 'shadowoff', label: 'Without shadow cascades', flags: { noShadows: '1' } },
	{ id: 'caustics', label: 'Without caustics', flags: { noCaustics: '1' } },
	{ id: 'reflections', label: 'Without reflection bake', flags: { envtest: 'skip' } },
	{ id: 'haze', label: 'Without aerial haze', flags: { noHaze: '1' } },
	{ id: 'shadows', label: 'With smaller shadows' },
	{ id: 'resolution', label: 'With fewer scene pixels', flags: { scale: '0.60' } },
	{ id: 'fftcore', label: 'FFT with auxiliary GPU effects isolated', flags: {
		noClouds: '1', noSim: '1', noSpray: '1', noCaustics: '1', noHaze: '1',
		noWake: '1', noBreakers: '1', noShadows: '1', envtest: 'skip',
	} },
] );

export function getGpuTraceCase( id ) {
	return GPU_TRACE_CASES.find( item => item.id === id ) || GPU_TRACE_CASES[ 0 ];
}

export function configureGpuTraceUrl( url ) {
	const test = getGpuTraceCase( url.searchParams.get( 'traceCase' ) );
	url.searchParams.set( 'traceCase', test.id );
	// Normal tracing must not silently raise the ocean mesh / pixel budget.
	// Request ?traceHighRes=1 explicitly to reproduce the old stress test.
	url.searchParams.set( 'G', url.searchParams.get('traceHighRes')==='1' ? '24' : '12' );
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
	for ( const key of [ 'noClouds', 'noSim', 'noSpray', 'noCaustics', 'noHaze', 'noWake', 'noBreakers', 'noShadows', 'envtest', 'scale' ] )
		url.searchParams.delete( key );
	url.searchParams.set( 'gpuTrace', '1' );
	url.searchParams.set( 'traceCase', next.id );
	return url;
}
