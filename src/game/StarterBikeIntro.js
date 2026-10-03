// The starter bicycle onboarding has been retired. New/returning players begin on foot and the
// normal FIRST DAY objective remains visible instead of being replaced by a vehicle tutorial.
export function installStarterBikeIntro( app ) {
	if ( ! app ) return null;
	if ( app.__starterBikeIntro ) return app.__starterBikeIntro;

	const state = app.game?.state;
	const player = app.player;

	if ( player ) {
		player.mode = 'walk';
		player.velocity?.set?.( 0, 0, 0 );
		player.camInit = false;
	}

	// Remove any bicycle that an older bootstrap/build may already have created in this session.
	if ( app.bicycle?.group?.parent ) app.bicycle.group.parent.remove( app.bicycle.group );
	app.bicycle = null;

	if ( state ) {
		state.storyFlags = state.storyFlags || {};
		state.storyFlags.starterBikeIntroComplete = true;
		state.storyFlags.starterBikeDisabled = true;
		if ( state.vehicles?.bicycle ) {
			state.vehicles.bicycle.owned = false;
			state.vehicles.bicycle.parked = null;
		}
		state.save?.();
		state.emit?.();
	}

	if ( typeof document !== 'undefined' ) {
		document.body.classList.remove( 'bm-starter-bike-intro' );
		document.getElementById( 'bm-starter-bike-intro' )?.remove?.();
		document.getElementById( 'bm-bike-hint' )?.remove?.();
	}

	const intro = app.__starterBikeIntro = {
		active: false,
		skipped: true,
		walking: true,
		complete: true,
	};
	if ( typeof window !== 'undefined' ) window.__starterBikeIntro = intro;
	return intro;
}
