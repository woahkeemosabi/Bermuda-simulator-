// Reusable Bermuda media cache. Never cache navigations, JS/CSS, APIs or player
// data: deploying new code must never revive an outdated game bundle.
const CACHE = 'bermuda-assets-20261105-v1';
const PREFIX = 'bermuda-assets-';
const MAX_FILE = 12 * 1024 * 1024;
const MAX_FILES = 96;
const FILES = /\.(?:glb|gltf|bin|jpe?g|png|webp|ktx2)$/i;

self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil((async () => {
	const names = await caches.keys();
	await Promise.all(names.filter(name => name.startsWith(PREFIX) && name !== CACHE)
		.map(name => caches.delete(name)));
	await self.clients.claim();
})()));

async function save(request, response) {
	if (!response?.ok || response.type !== 'basic') return;
	const declared = Number(response.headers.get('content-length'));
	if (declared && declared > MAX_FILE) return;
	try {
		const cache = await caches.open(CACHE);
		await cache.put(request, response.clone());
		const keys = await cache.keys();
		if (keys.length > MAX_FILES) {
			await Promise.all(keys.slice(0, keys.length - MAX_FILES).map(key => cache.delete(key)));
		}
	} catch (_) { /* Quota exceeded: let the live download proceed. */ }
}

self.addEventListener('fetch', event => {
	const request = event.request;
	if (request.method !== 'GET' || request.headers.has('range')) return;
	const url = new URL(request.url);
	if (url.origin !== self.location.origin || !FILES.test(url.pathname)) return;
	const result = (async () => {
		const cache = await caches.open(CACHE);
		const saved = await cache.match(request);
		if (saved) {
			// Fast reuse on later visits; refresh quietly when online so modified
			// models and textures appear on the next launch.
			const refresh = fetch(request).then(response => save(request, response)).catch(() => {});
			return { response: saved, refresh };
		}
		const response = await fetch(request);
		return { response, refresh: save(request, response.clone()) };
	})();
	// Register lifetime extension synchronously; Safari can reject waitUntil()
	// when it is called only after an asynchronous cache lookup.
	event.respondWith(result.then(value => value.response));
	event.waitUntil(result.then(value => value.refresh));
});
