// Save a small, bounded set of reusable, same-origin files during the mobile
// startup minute. The service worker caches additional downloaded models and
// textures during gameplay; WebGPU device resources cannot be persisted.
export const ASSET_CACHE_NAME = 'bermuda-assets-20261105-v1';
export const MOBILE_STARTUP_MIN_MS = 60_000;
export const STARTUP_ASSETS = [
	'ui/bermuda-loading.jpg',
	'models/characters/joe.glb',
	'models/characters/marta.glb',
];

const pause = ms => new Promise( resolve => setTimeout( resolve, ms ) );

export async function cacheStartupAssets( {
	baseUrl,
	cacheStorage = globalThis.caches,
	fetchAsset = globalThis.fetch?.bind(globalThis),
	assets = STARTUP_ASSETS,
	onProgress = () => {},
	perFileTimeoutMs = 12_000,
} = {} ) {

	const result = { available: false, stored: 0, reused: 0, failed: 0 };
	if ( !cacheStorage || !fetchAsset || !baseUrl ) return result;
	let cache;
	try { cache = await cacheStorage.open( ASSET_CACHE_NAME ); }
	catch (_) { return result; }
	result.available = true;
	for ( let i = 0; i < assets.length; i ++ ) {
		const url = new URL( assets[i], baseUrl ).href;
		onProgress( i + 1, assets.length );
		let controller, timer;
		try {
			if ( await cache.match( url ) ) { result.reused ++; continue; }
			controller = new AbortController();
			timer = setTimeout( () => controller.abort(), perFileTimeoutMs );
			const response = await fetchAsset( url, { signal: controller.signal, cache: 'force-cache' } );
			const size = Number( response?.headers?.get( 'content-length' ) ) || 0;
			if ( !response?.ok || size > 12 * 1024 * 1024 ) { result.failed ++; continue; }
			await cache.put( url, response.clone() );
			result.stored ++;
		} catch (_) {
			// Safari can deny CacheStorage or evict files. Continue online.
			result.failed ++;
		} finally {
			clearTimeout( timer );
		}
	}
	return result;

}

export async function holdUntilMobileReady( {
	startedAt = 0,
	minimumMs = MOBILE_STARTUP_MIN_MS,
	now = () => performance.now(),
	wait = pause,
	checkDevice = () => {},
	onProgress = () => {},
} = {} ) {

	for (;;) {
		checkDevice();
		const left = Math.max( 0, minimumMs - ( now() - startedAt ) );
		if ( left === 0 ) break;
		onProgress( Math.ceil( left / 1000 ) );
		await wait( Math.min( 1000, left ) );
	}
	checkDevice();

}
