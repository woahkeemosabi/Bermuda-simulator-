import { App } from '../App.js';

// QA/runtime progression controls that intentionally sit ahead of src/main.js.
// ?newgame=1 performs a one-shot local progression reset before mission/world add-ons install.
// ?relictest=1 keeps RELIC available for deliberate vehicle QA without exposing it in normal play.

const SAVE_KEY = 'tidewater.save.v1';
const GUIDE_KEY = 'tidewater.guide';
const NEW_GAME_KEYS = [ 'newgame', 'resetprogress' ];

function params() {
	try { return new URLSearchParams( location.search ); }
	catch ( _ ) { return new URLSearchParams(); }
}

function hasMission( state, id ) {
	const m = state?.missions;
	return !! ( m?.available?.includes( id ) || m?.active?.includes( id ) || m?.completed?.includes( id ) );
}

function isActiveOrDone( state, id ) {
	const m = state?.missions;
	return !! ( m?.active?.includes( id ) || m?.completed?.includes( id ) );
}

function cleanOneShotParams() {
	try {
		const url = new URL( location.href );
		for ( const key of NEW_GAME_KEYS ) url.searchParams.delete( key );
		history.replaceState( null, '', url.pathname + ( url.search ? url.search : '' ) + url.hash );
	} catch ( _ ) {}
}

function performFreshStart( app ) {
	const q = params();
	if ( ! NEW_GAME_KEYS.some( ( key ) => q.has( key ) ) ) return false;

	const state = app?.game?.state;
	if ( state?.reset ) {
		state.reset();
	} else {
		try { localStorage.removeItem( SAVE_KEY ); } catch ( _ ) {}
	}

	// Make the first-play guide genuinely first-play again. Harbour/quick-job state is stored inside
	// GameState.storyFlags, so GameState.reset() clears it together with missions and ownership.
	try { localStorage.removeItem( GUIDE_KEY ); } catch ( _ ) {}
	try { sessionStorage.setItem( 'bermudaFreshStart', String( Date.now() ) ); } catch ( _ ) {}

	cleanOneShotParams();
	return true;
}

function relicPhase( state ) {
	const q = params();
	const test = q.has( 'relictest' );
	if ( test ) return { test: true, visible: true, driveable: true, storyVisible: true };

	// Mission 11 introduces the Black Car as a mystery. It may be seen/inspected, but not driven.
	const blackCarVisible = hasMission( state, 'main-black-car' ) ||
		!! state?.storyFlags?.relicBlackCarSeen ||
		hasMission( state, 'main-blue-hole' ) ||
		hasMission( state, 'main-strange-signal' ) ||
		hasMission( state, 'main-limestone-door' ) ||
		hasMission( state, 'main-road-was-never-the-test' );

	// Mission 14 is the point at which the hidden facility/tunnel belongs in the playable world.
	const storyVisible = hasMission( state, 'main-limestone-door' ) ||
		hasMission( state, 'main-road-was-never-the-test' ) ||
		!! state?.storyFlags?.hiddenFacilityDiscovered;

	// Mission 15 explicitly asks the player to enter RELIC and complete the first ROAD drive.
	const driveable = isActiveOrDone( state, 'main-road-was-never-the-test' ) ||
		!! state?.storyFlags?.relicOwned ||
		!! state?.vehicles?.relic?.owned;

	return { test: false, visible: blackCarVisible || driveable, driveable, storyVisible };
}

function setColliderSolid( app, tag, solid ) {
	for ( const box of app?.colliders?.boxes || [] ) if ( box?.tag === tag ) box.solid = solid;
}

function syncRelicProgression( app ) {
	const state = app?.game?.state;
	if ( ! state ) return;
	const phase = relicPhase( state );

	if ( app.relic001?.group ) app.relic001.group.visible = phase.visible;
	setColliderSolid( app, 'relic-001', phase.visible );

	// Hidden RELIC story geometry must not leave invisible cave-wall colliders behind.
	if ( app.relicStory?.group ) app.relicStory.group.visible = phase.storyVisible;
	setColliderSolid( app, 'relic-vault-rock', phase.storyVisible );

	if ( app.player ) app.player.relic = phase.driveable ? ( app.relic || null ) : null;

	// Canonicalize the final campaign reward into the vehicle ownership record once, so parking and
	// later sessions use the same ownership API as every other road vehicle.
	if ( ! phase.test && state.storyFlags?.relicOwned && state.vehicles?.relic && ! state.vehicles.relic.owned ) {
		state.vehicles.relic.owned = true;
		state.vehicles.relic.discovered = true;
		state.save?.();
		state.emit?.();
	}

	if ( typeof window !== 'undefined' ) {
		window.__bermudaRelicGate = {
			mode: phase.test ? 'test-override' : phase.driveable ? 'owned-or-final-mission' : phase.visible ? 'story-visible-locked' : 'hidden',
			visible: phase.visible,
			driveable: phase.driveable,
			storyVisible: phase.storyVisible,
		};
	}
}

const baseInit = App.prototype.init;
App.prototype.init = async function progressionQAInit( ...args ) {
	const result = await baseInit.apply( this, args );
	performFreshStart( this );
	if ( typeof window !== 'undefined' ) window.__bermudaApp = this;
	return result;
};

// main.js captures App.prototype.frame after this module runs. Keeping the gate here means it remains
// active even when main.js wraps the frame function for waterfront visibility/mobile startup.
const baseFrame = App.prototype.frame;
App.prototype.frame = function progressionQAFrame( ...args ) {
	syncRelicProgression( this );
	return baseFrame.apply( this, args );
};

export { performFreshStart, syncRelicProgression, relicPhase };
