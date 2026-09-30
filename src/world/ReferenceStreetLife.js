// Placeholder street-life has been removed from the playable build.
// The procedural people clipped through buildings and the market furniture/awning layer conflicted
// with the restored Tidewater harbour stalls. Reintroduce ambient NPCs only with proper navigation,
// collision-aware paths and production character animation.
export function installReferenceStreetLife( app ) {
	if ( ! app ) return null;
	if ( app.bermudaStreetLife ) return app.bermudaStreetLife;
	const state = { group: null, disabled: true, reason: 'awaiting-production-nav-npcs' };
	app.bermudaStreetLife = state;
	if ( typeof window !== 'undefined' ) window.__bermudaStreetLife = state;
	return state;
}
