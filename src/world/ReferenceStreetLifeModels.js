// Static/instanced street-life characters are disabled for the playable build.
// They had no collision-aware navigation and could appear inside or pass through buildings.
// Keep this API as a resolved no-op because several optional reference passes call it.
export function installReferenceStreetLifeModels( app ) {
	if ( ! app ) return Promise.resolve( null );
	if ( app.bermudaStreetLifeModelsPromise ) return app.bermudaStreetLifeModelsPromise;
	const state = {
		group: null,
		disabled: true,
		reason: 'awaiting-production-nav-npcs',
		loaded: [],
		errors: [],
		maleAsset: null,
		femaleAsset: null,
		scooterAsset: null,
	};
	app.bermudaStreetLifeModels = state;
	if ( typeof window !== 'undefined' ) window.__bermudaStreetLifeModels = state;
	app.bermudaStreetLifeModelsPromise = Promise.resolve( state );
	return app.bermudaStreetLifeModelsPromise;
}
