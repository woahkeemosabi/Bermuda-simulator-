import { App } from '../App.js';
import { GameState } from '../game/GameState.js';
import { MAIN_CAMPAIGN_SEQUENCE, MISSIONS } from '../game/MissionDirector.js';

// QA/runtime progression controls that intentionally sit ahead of src/main.js.
// ?newgame=1 performs a one-shot local progression reset before mission/world add-ons install.
// ?relictest=1 keeps RELIC available for deliberate vehicle QA without exposing it in normal play.
// ?qa=mission6 (through mission15, or any canonical main mission id) uses a completely separate
// local save namespace so campaign testing can never overwrite the player's normal Safari save.

const SAVE_KEY = 'tidewater.save.v1';
const GUIDE_KEY = 'tidewater.guide';
const NEW_GAME_KEYS = [ 'newgame', 'resetprogress' ];
const QA_PREFIX = 'bermuda.qa.';

function params() {
	try { return new URLSearchParams( location.search ); }
	catch ( _ ) { return new URLSearchParams(); }
}

function resolveQAMission( raw ) {
	if ( ! raw ) return null;
	const value = String( raw ).trim();
	if ( MAIN_CAMPAIGN_SEQUENCE.includes( value ) ) return value;
	const match = value.toLowerCase().match( /^(?:mission|m)?[-_ ]?(\d{1,2})$/ );
	if ( ! match ) return null;
	const n = Number( match[ 1 ] );
	return n >= 1 && n <= MAIN_CAMPAIGN_SEQUENCE.length ? MAIN_CAMPAIGN_SEQUENCE[ n - 1 ] : null;
}

const START_PARAMS = params();
const QA_MISSION_ID = resolveQAMission( START_PARAMS.get( 'qa' ) );
const QA_SAVE_KEY = QA_MISSION_ID ? `${ QA_PREFIX }${ QA_MISSION_ID }.v1` : null;

// GameState normally reads/writes tidewater.save.v1. In QA mode, replace only the persistence
// methods before App.init creates the GameState instance. Normal gameplay does not enter this branch,
// so its save key and bytes are completely untouched.
if ( QA_SAVE_KEY ) {
	GameState.prototype.save = function qaSave() {
		if ( ! this.storage ) return;
		try { this.storage.setItem( QA_SAVE_KEY, JSON.stringify( this.toJSON() ) ); }
		catch ( _ ) { /* storage full or blocked: keep the QA session playable */ }
	};
	GameState.prototype.load = function qaLoad() {
		if ( ! this.storage ) return false;
		try {
			const raw = this.storage.getItem( QA_SAVE_KEY );
			return raw ? this.fromJSON( JSON.parse( raw ) ) : false;
		} catch ( _ ) { return false; }
	};
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

function cleanQAResetParam() {
	try {
		const url = new URL( location.href );
		url.searchParams.delete( 'qaReset' );
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
		try { localStorage.removeItem( QA_SAVE_KEY || SAVE_KEY ); } catch ( _ ) {}
	}

	// Make the first-play guide genuinely first-play again. Harbour/quick-job state is stored inside
	// GameState.storyFlags, so GameState.reset() clears it together with missions and ownership.
	// The guide preference is presentation-only; progression remains isolated by QA_SAVE_KEY above.
	try { localStorage.removeItem( GUIDE_KEY ); } catch ( _ ) {}
	try { sessionStorage.setItem( 'bermudaFreshStart', String( Date.now() ) ); } catch ( _ ) {}

	cleanOneShotParams();
	return true;
}

function relationshipStatus( points ) {
	return points >= 50 ? 'Trusted' : points >= 20 ? 'Respected' : points >= 5 ? 'Known' : 'New';
}

function installQABadge( missionId ) {
	if ( typeof document === 'undefined' ) return;
	const existing = document.getElementById( 'bermuda-qa-badge' );
	if ( existing ) return;
	const index = MAIN_CAMPAIGN_SEQUENCE.indexOf( missionId );
	const title = MISSIONS[ missionId ]?.title || missionId;
	const el = document.createElement( 'div' );
	el.id = 'bermuda-qa-badge';
	el.textContent = `QA MODE · MISSION ${ index + 1 } · ${ title.toUpperCase() }`;
	el.style.cssText = 'position:fixed;right:10px;top:max(110px,calc(env(safe-area-inset-top) + 100px));z-index:9998;padding:6px 9px;border-radius:9px;background:rgba(64,20,92,.82);border:1px solid rgba(224,174,255,.55);color:#f7eaff;font:700 9px/1.2 system-ui,-apple-system,sans-serif;letter-spacing:.08em;pointer-events:none;box-shadow:0 6px 22px rgba(0,0,0,.28)';
	document.body.appendChild( el );
}

function seedMissionQACheckpoint( app ) {
	if ( ! QA_MISSION_ID ) return false;
	const state = app?.game?.state;
	if ( ! state ) return false;

	const q = params();
	const forceReset = q.has( 'qaReset' );
	const alreadyThisCheckpoint = state.storyFlags?.__qaCheckpoint === QA_MISSION_ID;
	if ( alreadyThisCheckpoint && ! forceReset ) {
		installQABadge( QA_MISSION_ID );
		if ( typeof window !== 'undefined' ) window.__bermudaQA = { isolated: true, missionId: QA_MISSION_ID, saveKey: QA_SAVE_KEY, resumed: true };
		return false;
	}

	const index = MAIN_CAMPAIGN_SEQUENCE.indexOf( QA_MISSION_ID );
	if ( index < 0 ) return false;

	// Reset only the isolated QA slot, never tidewater.save.v1.
	state.reset();
	const completed = MAIN_CAMPAIGN_SEQUENCE.slice( 0, index );
	state.missions.completed = [ ...completed ];
	state.missions.active = [ QA_MISSION_ID ];
	state.missions.available = [];

	// Reconstruct the story/reputation consequences of all earlier main missions so later systems see
	// a believable campaign state rather than only an arbitrary mission id.
	const rep = { Martha: 0, Joe: 0, fishermen: 0, marineCommunity: 0 };
	const flags = {};
	for ( const id of completed ) {
		const reward = MISSIONS[ id ]?.rewards || {};
		Object.assign( flags, reward.storyFlags || {} );
		for ( const [ person, amount ] of Object.entries( reward.reputation || {} ) ) rep[ person ] = ( rep[ person ] || 0 ) + Number( amount || 0 );
	}
	state.reputation = { ...state.reputation, ...rep };
	for ( const person of [ 'Martha', 'Joe' ] ) {
		const points = rep[ person ] || 0;
		state.relationships[ person ] = { status: relationshipStatus( points ), points };
	}
	state.storyFlags = { ...flags, __qaCheckpoint: QA_MISSION_ID };

	// Mission 6 onward assumes the campaign's starter workboat has already been purchased.
	if ( index > MAIN_CAMPAIGN_SEQUENCE.indexOf( 'main-first-boat' ) ) {
		state.boats.owned = [ { id: 'lobster-workboat', name: 'Downeast Lobster Boat', purchasedAt: 1 } ];
		state.boats.activeBoat = 'lobster-workboat';
	}

	// Mission 11 onward occurs after Keys to the Cottage, so provide the persisted home ownership that
	// the property/story systems expect. Mission 10 itself deliberately starts without the cottage.
	if ( index > MAIN_CAMPAIGN_SEQUENCE.indexOf( 'main-keys-to-cottage' ) ) {
		state.properties.owned = [ { id: 'harbour-cottage', name: 'Harbour Cottage', price: 8500, garage: true, purchasedAt: 1 } ];
		state.properties.home = 'harbour-cottage';
		state.properties.garage = 'harbour-cottage';
	}

	// Give QA enough cash to exercise purchases without changing the actual game economy.
	state.money = QA_MISSION_ID === 'main-keys-to-cottage' ? 12000 : 6000;
	state.bankBalance = 2500;

	// Put time/weather-sensitive missions directly into a useful test window. Their gameplay systems
	// remain responsible for actual objective completion.
	let hour = 12.0;
	let weather = 'clear';
	if ( QA_MISSION_ID === 'storm-mooring-check' ) { hour = 15.0; weather = 'storm'; }
	if ( QA_MISSION_ID === 'joe-after-dark' ) hour = 21.2;
	if ( QA_MISSION_ID === 'main-black-car' ) hour = 22.0;
	if ( QA_MISSION_ID === 'main-strange-signal' ) hour = 21.5;
	if ( QA_MISSION_ID === 'main-road-was-never-the-test' ) hour = 20.0;
	state.world.time = hour;
	state.world.weather = weather;
	if ( app.settings ) {
		app.settings.timeOfDay = hour;
		app.settings.weatherMode = weather;
	}

	state.save();
	state.emit();
	installQABadge( QA_MISSION_ID );
	cleanQAResetParam();
	if ( typeof window !== 'undefined' ) window.__bermudaQA = { isolated: true, missionId: QA_MISSION_ID, saveKey: QA_SAVE_KEY, resumed: false };
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
	seedMissionQACheckpoint( this );
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

export { performFreshStart, seedMissionQACheckpoint, syncRelicProgression, relicPhase, resolveQAMission };
