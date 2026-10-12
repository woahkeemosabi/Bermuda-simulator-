// Bound the transfer as well as the response headers. A stalled download must not leave
// the loading screen waiting forever; callers can retain their existing scenery fallback.
export async function fetchAssetBuffer( url, timeoutMs = 30000 ) {

	const controller = new AbortController();
	const timer = setTimeout( () => controller.abort(), timeoutMs );
	try {

		const response = await fetch( url, { signal: controller.signal } );
		if ( ! response.ok ) throw new Error( 'GLB: ' + url + ' ' + response.status );
		return await response.arrayBuffer();

	} catch ( error ) {

		if ( controller.signal.aborted ) throw new Error( 'Asset download timed out: ' + url );
		throw error;

	} finally {

		clearTimeout( timer );

	}

}
