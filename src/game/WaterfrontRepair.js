// Retired compatibility hook.
// The previous repair created a pseudo-interior for Martha and a duplicate Joe display on top of
// Tidewater's native vendor stalls. Both behaviours are intentionally removed; keeping this exported
// function as a no-op prevents older integration calls from reintroducing those layers.
export function installWaterfrontRepair( app ) {
	if ( ! app ) return null;
	if ( app.__waterfrontRepair ) return app.__waterfrontRepair;
	const state = { disabled: true, reason: 'tidewater-storefront-restore' };
	app.__waterfrontRepair = state;
	if ( typeof window !== 'undefined' ) window.__waterfrontRepair = state;
	return state;
}
