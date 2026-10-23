function removeBrokenAmbientWalkers( app ) {
	const finalWalkers = app.bermudaReferenceFinal?.walkers;
	if ( Array.isArray( finalWalkers ) ) {
		for ( const walker of finalWalkers ) walker?.root?.parent?.remove?.( walker.root );
		finalWalkers.length = 0;
	}

	const articulatedWalkers = app.__referenceArticulatedCharacters?.walkers;
	if ( Array.isArray( articulatedWalkers ) ) {
		for ( const walker of articulatedWalkers ) walker?.rig?.root?.parent?.remove?.( walker.rig.root );
		articulatedWalkers.length = 0;
	}
}

// The original Chandlery owns its scanned counter, sign, stock, vendor and colliders.
// Do not install the later indoor shell or suppress the native walk-up shop interaction.
export function installWaterfrontRepair( app ) {
	if ( ! app ) return null;
	if ( app.__waterfrontRepair ) return app.__waterfrontRepair;
	removeBrokenAmbientWalkers( app );
	const state = {
		ready: true,
		marthaShop: null,
		marthaPurchaseCard: null,
		mobilePolish: null,
		legacyMarthaList: true,
		ambientWalkers: false,
		storefront: 'tidewater',
	};
	app.__waterfrontRepair = state;
	if ( typeof window !== 'undefined' ) window.__waterfrontRepair = state;
	return state;
}
