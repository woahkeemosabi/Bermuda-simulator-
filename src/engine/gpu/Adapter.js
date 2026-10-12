// A power preference is a hint. Some drivers refuse high-performance while their default
// adapter works. Try the default before reporting that no graphics device is available.
export async function requestGraphicsAdapter( gpu, timeoutMs = 12000 ) {

	if ( ! gpu ) throw new Error( 'WebGPU is not available in this browser.' );
	let lastError;
	for ( const options of [ { powerPreference: 'high-performance' }, {} ] ) {

		let timer;
		try {

			const adapter = await Promise.race( [
				Promise.resolve().then( () => gpu.requestAdapter( options ) ),
				new Promise( ( _, reject ) => { timer = setTimeout( () => reject( new Error( 'Graphics adapter request timed out.' ) ), timeoutMs ); } ),
			] );
			if ( adapter ) return adapter;

		} catch ( error ) {

			lastError = error;

		} finally {

			clearTimeout( timer );

		}

	}
	throw new Error( lastError ? 'No WebGPU adapter found: ' + lastError.message : 'No WebGPU adapter found.' );

}
