import { MissionDirector } from './MissionDirector.js';

const LEGACY_ONBOARDING = new Set( [
	'martha-first-delivery',
	'martha-fishing-intro',
	'joe-spiny-business',
] );
const FIRST_BOAT = 'main-first-boat';

// Lightweight progression host for the public Bermuda Simulator opening.
// New players begin at the harbour with fishing immediately available; this class only owns the
// objective HUD and migrates any unfinished bicycle/parcel onboarding save into the dock-first loop.
export class LifeProgression {
	constructor( app ) {
		this.app = app;
		this.game = app.game;
		this.state = app.game?.state;
		this.player = app.player;
		this.input = app.input;
		this.missions = app.missionDirector || new MissionDirector( app );

		this.normalizeDockStart();
		this.mountObjectiveUI();
		app.progression = this;
		this.refreshObjective();
	}

	normalizeDockStart() {
		const state = this.state;
		const missions = state?.missions;
		if ( ! state || ! missions || ( state.boats?.owned?.length || 0 ) > 0 ) return;

		let changed = false;
		for ( const bucket of [ 'available', 'active' ] ) {
			const before = Array.isArray( missions[ bucket ] ) ? missions[ bucket ] : [];
			const after = before.filter( ( id ) => ! LEGACY_ONBOARDING.has( id ) );
			if ( after.length !== before.length ) changed = true;
			missions[ bucket ] = after;
		}

		const hasFirstBoat =
			missions.available?.includes( FIRST_BOAT ) ||
			missions.active?.includes( FIRST_BOAT ) ||
			missions.completed?.includes( FIRST_BOAT );
		if ( ! hasFirstBoat ) {
			missions.available.push( FIRST_BOAT );
			changed = true;
		}

		if ( state.storyFlags?.marthaDeliveryCarrying ) {
			state.storyFlags.marthaDeliveryCarrying = false;
			changed = true;
		}

		if ( changed ) {
			state.save?.();
			state.emit?.();
		}
	}

	mountObjectiveUI() {
		if ( typeof document === 'undefined' || document.getElementById( 'bm-objective' ) ) return;
		const style = document.createElement( 'style' );
		style.textContent = `#bm-objective{position:fixed;left:14px;top:max(92px,calc(env(safe-area-inset-top) + 82px));z-index:68;max-width:min(420px,calc(100vw - 28px));padding:8px 11px;border-radius:11px;background:rgba(5,22,31,.74);border:1px solid rgba(130,235,224,.28);backdrop-filter:blur(9px);-webkit-backdrop-filter:blur(9px);color:#eaffff;font:600 11px/1.35 system-ui,-apple-system,sans-serif;letter-spacing:.02em;pointer-events:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none}.bm-objective-kicker{display:block;font-size:9px;letter-spacing:.14em;color:#83e5db;margin-bottom:2px}`;
		document.head.appendChild( style );
		this.objectiveEl = document.createElement( 'div' );
		this.objectiveEl.id = 'bm-objective';
		document.body.appendChild( this.objectiveEl );
	}

	// Kept for the mobile-polish compatibility check. The removed FIRST DAY onboarding is always done.
	missionDone() { return true; }

	refreshObjective() {
		if ( ! this.objectiveEl ) return;
		const objective = this.missions.objective();
		if ( ! objective ) {
			this.objectiveEl.style.display = 'none';
			return;
		}
		this.objectiveEl.style.display = '';
		const kicker = objective.bucket === 'active' ? 'CURRENT GOAL' : 'NEXT GOAL';
		this.objectiveEl.innerHTML = `<span class="bm-objective-kicker">${ kicker }</span>${ objective.text }`;
	}
}
