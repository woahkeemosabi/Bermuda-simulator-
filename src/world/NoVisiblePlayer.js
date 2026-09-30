// V1 presentation policy: keep the player controller/collision/cameras fully active,
// but do not render a player body. This avoids loading/skinning a local avatar on iPhone
// and permanently suppresses the older procedural/static fallbacks that caused camera clipping.

const PLAYER_NAMES = new Set( [
	'BermudaPlayerAvatar',
	'ReferenceArticulatedPlayer',
	'Exact54SecondPlayerIdle',
	'MeshyProductionPlayer',
	'ReferenceDeckPlayer',
	'ReferenceHelmPlayer',
	'ReferenceHelmCharacter',
] );

function hideKnownPlayerVisuals( app ) {
	const finalAvatar = app.bermudaReferenceFinal?.playerPresentation?.avatar?.root;
	if ( finalAvatar ) finalAvatar.visible = false;

	const articulated = app.__referenceArticulatedCharacters?.playerRig?.root;
	if ( articulated ) {
		articulated.visible = false;
		articulated.scale.setScalar( 0.0001 );
	}

	const exact = app.__exactReferenceCharacters?.playerModel;
	if ( exact ) exact.visible = false;

	const production = app.__productionMeshyCharacters?.playerModel?.group;
	if ( production ) production.visible = false;

	const boatPresentation = app.__bermudaBoatReferencePresentation;
	if ( boatPresentation?.deckAvatar ) boatPresentation.deckAvatar.visible = false;
	if ( boatPresentation?.helmAvatar ) boatPresentation.helmAvatar.visible = false;

	app.__articulatedReferencePlayerVisible = false;

	// Catch any late-created legacy layer without touching NPCs.
	app.scene?.traverse?.( ( object ) => {
		if ( PLAYER_NAMES.has( object.name || '' ) ) object.visible = false;
	} );
}

export function installNoVisiblePlayer( app ) {
	if ( ! app?.player || app.__noVisiblePlayer ) return app?.__noVisiblePlayer;

	app.__disableVisiblePlayer = true;
	const previousUpdate = app.player.update.bind( app.player );
	app.player.update = ( dt ) => {
		previousUpdate( dt );
		hideKnownPlayerVisuals( app );
	};

	let raf = 0;
	const guard = () => {
		hideKnownPlayerVisuals( app );
		raf = requestAnimationFrame( guard );
	};
	if ( typeof requestAnimationFrame === 'function' ) raf = requestAnimationFrame( guard );
	if ( typeof window !== 'undefined' ) window.addEventListener( 'pagehide', () => raf && cancelAnimationFrame( raf ), { once: true } );

	hideKnownPlayerVisuals( app );
	const state = { enabled: true, policy: 'no-visible-player-v1' };
	app.__noVisiblePlayer = state;
	if ( typeof window !== 'undefined' ) window.__noVisiblePlayer = state;
	return state;
}
