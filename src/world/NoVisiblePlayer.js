// V1 presentation policy: keep the player controller/collision/cameras fully active,
// but do not render a player body. Walking/swimming use Tidewater's native first-person camera;
// vehicle-specific chase/helm cameras remain available.

const PLAYER_NAMES = new Set( [
	'BermudaPlayerAvatar',
	'ReferenceArticulatedPlayer',
	'Exact54SecondPlayerIdle',
	'MeshyProductionPlayer',
	'ReferenceDeckPlayer',
	'ReferenceHelmPlayer',
	'ReferenceHelmCharacter',
] );

function forceTidewaterFootPresentation( app ) {
	const presentation = app.player?.__bermudaReferencePresentation;
	if ( presentation ) {
		presentation.thirdPerson = false;
		presentation.cameraReady = false;
	}
}

function disableUnapprovedAmbientWalkers( app ) {
	// ReferenceFinalPass created three simple procedural humans that moved on fixed X rails. They had
	// no navmesh or building avoidance, so they visibly walked through architecture. Remove them from
	// the shared array itself: the FinalPass animation loop then has nothing left to move.
	const walkers = app.bermudaReferenceFinal?.walkers;
	if ( Array.isArray( walkers ) && walkers.length ) {
		for ( const walker of walkers ) if ( walker?.root ) walker.root.visible = false;
		walkers.length = 0;
	}
	// Defensive cleanup for any stale layer created by an older module during the same load.
	if ( app.bermudaStreetLife?.group ) app.bermudaStreetLife.group.visible = false;
	if ( app.bermudaStreetLifeModels?.group ) app.bermudaStreetLifeModels.group.visible = false;
}

function hideKnownPlayerVisuals( app ) {
	forceTidewaterFootPresentation( app );
	disableUnapprovedAmbientWalkers( app );

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

	app.scene?.traverse?.( ( object ) => {
		if ( PLAYER_NAMES.has( object.name || '' ) ) object.visible = false;
	} );
}

export function installNoVisiblePlayer( app ) {
	if ( ! app?.player || app.__noVisiblePlayer ) return app?.__noVisiblePlayer;

	app.__disableVisiblePlayer = true;
	forceTidewaterFootPresentation( app );
	disableUnapprovedAmbientWalkers( app );

	const previousUpdate = app.player.update.bind( app.player );
	app.player.update = ( dt ) => {
		forceTidewaterFootPresentation( app );
		previousUpdate( dt );
		forceTidewaterFootPresentation( app );
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
	const state = {
		enabled: true,
		policy: 'no-visible-player-v1',
		footCamera: 'tidewater-first-person',
		vehicleCameras: true,
		ambientPlaceholderWalkers: false,
	};
	app.__noVisiblePlayer = state;
	if ( typeof window !== 'undefined' ) window.__noVisiblePlayer = state;
	return state;
}
