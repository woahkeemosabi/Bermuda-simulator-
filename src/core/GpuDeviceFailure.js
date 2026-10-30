// Host lifecycle guard. Observes the native loss promise; never destroys/replaces the device.
export function observeDeviceLoss( device, onLoss = () => {} ) {
	let failure = null;
	const signal = device.lost.then( ( info ) => {
		failure = new Error( `WebGPU device lost (${ info.reason }): ${ info.message || 'Browser provided no device-loss details' }` );
		failure.name = 'GPUDeviceLostError';
		try { onLoss( failure ); } finally { throw failure; }
	} );
	// Loss can occur between waits, including during normal play. Avoid an unhandled rejection.
	signal.catch( () => {} );
	return {
		throwIfLost() { if ( failure ) throw failure; },
		wait( work ) {
			// Always attach to work, even after loss, to handle its eventual rejection.
			return Promise.race( [ signal, work ] );
		},
	};
}
