// CPU-only selection of the frozen iPhone ocean. Both variants allocate one
// 256x256 FFT cascade; no animation option enables extra GPU compute passes.
export function mobileFrozenOceanOptions( params ) {
	return {
		cascades: 1,
		// 240 m captures medium surface waves; the old 733 m tile remains available
		// for isolated device-loss comparisons.
		sizes: [ params.get( 'oceanTile' ) === 'legacy' ? 733 : 240 ],
		// Translate the already-computed FFT field at sample time (metres/second).
		frozenAdvection: params.get( 'oceanMotion' ) === 'off' ? 0 : 0.75,
	};
}
