// One-time cleanup worker for the simple browser build.
// It replaces any older Bermuda offline worker, clears only CacheStorage, then unregisters itself.
self.addEventListener('install', event => {
	event.waitUntil(self.skipWaiting());
});
self.addEventListener('activate', event => {
	event.waitUntil((async () => {
		try {
			const keys = await caches.keys();
			await Promise.all(keys.map(key => caches.delete(key)));
		} catch (_) {}
		try { await self.registration.unregister(); } catch (_) {}
	})());
});
