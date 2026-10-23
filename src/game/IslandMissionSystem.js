// Repeatable-feeling Bermuda life missions built on the existing fishing, diving, vendor and
// relationship systems. No separate minigame: jobs advance from things the player already does.

const IDS = Object.freeze( {
	intro: 'martha-fishing-intro',
	lobster: 'joe-spiny-business',
	reef: 'martha-reef-table',
	waters: 'joe-three-waters',
	night: 'joe-after-dark',
	conservation: 'marine-leave-it-living',
} );

const ISLAND_IDS = new Set( Object.values( IDS ) );
const GIVER = Object.freeze( {
	[ IDS.intro ]: 'Martha',
	[ IDS.lobster ]: 'Joe',
	[ IDS.reef ]: 'Martha',
	[ IDS.waters ]: 'Joe',
	[ IDS.night ]: 'Joe',
	[ IDS.conservation ]: 'Joe',
} );

const SHALLOWS = new Set( [ 'mullet', 'needlefish', 'jack', 'silverside' ] );
const REEF = new Set( [ 'yellowtail', 'laneSnapper', 'wrasse', 'redHind', 'angel', 'grunt', 'tang' ] );
const OFFSHORE = new Set( [ 'redSnapper', 'tuna', 'mahi', 'wahoo', 'yellowfin', 'blackGrouper', 'barracuda' ] );
const SNAPPERS = new Set( [ 'yellowtail', 'laneSnapper', 'redSnapper' ] );
const PROTECTED = new Set( [ 'parrot', 'grouper' ] );

function emptyProgress() {
	return {
		[ IDS.lobster ]: { caught: 0 },
		[ IDS.reef ]: { snapper: false, hogfish: false, redHind: false },
		[ IDS.waters ]: { shallows: false, reef: false, offshore: false },
		[ IDS.night ]: { tarpon: false },
		[ IDS.conservation ]: { released: false },
	};
}

export class IslandMissionSystem {
	constructor( app ) {
		this.app = app;
		this.game = app.game;
		this.state = app.game.state;
		this.player = app.player;
		this.input = app.input;
		this.director = app.missionDirector;
		this.martha = app.game?.chandlery?.vendor || null;
		this.joe = app.game?.stand?.vendor || null;
		this.consumeVendorAction = false;

		const flags = this.state.storyFlags;
		flags.islandMissionProgress = { ...emptyProgress(), ...( flags.islandMissionProgress || {} ) };
		for ( const [ id, defaults ] of Object.entries( emptyProgress() ) ) {
			flags.islandMissionProgress[ id ] = { ...defaults, ...( flags.islandMissionProgress[ id ] || {} ) };
		}
		this.progress = flags.islandMissionProgress;
		this.patchEconomy();
		this.patchVendorAction();

		const originalUpdate = this.player.update.bind( this.player );
		this.player.update = ( dt ) => {
			originalUpdate( dt );
			this.update( dt );
		};
		app.islandMissions = this;
		this.refreshUnlocks();
	}

	patchVendorAction() {
		if ( this.game.__islandMissionVendorPatch ) return;
		this.game.__islandMissionVendorPatch = true;
		const original = this.game.updateVendors.bind( this.game );
		this.game.updateVendors = ( input, player ) => {
			if ( this.consumeVendorAction ) {
				this.consumeVendorAction = false;
				return;
			}
			return original( input, player );
		};
	}

	patchEconomy() {
		if ( this.state.__islandMissionEconomyPatch ) return;
		this.state.__islandMissionEconomyPatch = true;

		const realAddFish = this.state.addFish.bind( this.state );
		this.state.addFish = ( species, ...args ) => {
			const result = realAddFish( species, ...args );
			this.onCatch( species, result, this.state.lastCatch );
			return result;
		};

		const realSell = this.state.sell.bind( this.state );
		this.state.sell = ( ids = null ) => {
			const selected = this.state.inventory.filter( ( item ) => ids === null || ids.includes( item.id ) ).map( ( item ) => ( { ...item } ) );
			const result = realSell( ids );
			if ( result?.count ) this.onSale( selected, result );
			return result;
		};
	}

	active( id ) { return !! this.director?.active?.( id ); }
	available( id ) { return !! this.director?.available?.( id ); }
	completed( id ) { return !! this.director?.completed?.( id ); }
	ownsBoat() { return ( this.state.boats?.owned?.length || 0 ) > 0; }

	refreshUnlocks() {
		// MissionDirector now owns the canonical V1 order:
		// Proper Money → Spiny Business → The First Boat → Three Waters → Reef Table →
		// Loose Weather → After Dark → Leave It Living → Keys to the Cottage.
		// Do not unlock later jobs from reputation alone, otherwise the campaign can skip chapters.
		// Preserve only a migration assist for legacy saves that already completed the required prior beat.
		if ( this.completed( IDS.lobster ) && this.ownsBoat() && ! this.completed( 'main-first-boat' ) && ! this.active( 'main-first-boat' ) ) {
			this.director?.unlock?.( 'main-first-boat' );
		}
	}

	onCatch( species, kept, info ) {
		if ( this.active( IDS.lobster ) && species === 'spinyLobster' && kept ) {
			const p = this.progress[ IDS.lobster ];
			p.caught = Math.min( 3, Number( p.caught || 0 ) + 1 );
			this.game.toast( `Spiny Business · lobster ${ p.caught } / 3`, 1700 );
		}

		if ( this.active( IDS.waters ) && kept ) {
			const p = this.progress[ IDS.waters ];
			if ( SHALLOWS.has( species ) ) p.shallows = true;
			if ( REEF.has( species ) ) p.reef = true;
			if ( OFFSHORE.has( species ) ) p.offshore = true;
			this.game.toast( `Three Waters · ${ this.threeWatersText() }`, 1800 );
		}

		if ( this.active( IDS.night ) && species === 'tarpon' && kept ) {
			const h = Number( this.app.settings?.timeOfDay || 0 );
			if ( h >= 20 || h < 6 ) {
				this.progress[ IDS.night ].tarpon = true;
				this.game.toast( 'After Dark · tarpon landed · return to Joe', 2300 );
			}
		}

		if ( this.active( IDS.conservation ) && info?.protectedSpecies && PROTECTED.has( species ) ) {
			this.progress[ IDS.conservation ].released = true;
			this.state.save();
			this.director.complete( IDS.conservation, { toast: true } );
		}
		this.state.save();
		this.refreshObjective();
	}

	onSale( items, result ) {
		if ( this.active( IDS.intro ) && result.total > 0 ) {
			this.director.complete( IDS.intro, { toast: true } );
			this.refreshUnlocks();
		}

		if ( this.active( IDS.reef ) ) {
			const p = this.progress[ IDS.reef ];
			for ( const item of items ) {
				if ( SNAPPERS.has( item.species ) ) p.snapper = true;
				if ( item.species === 'wrasse' ) p.hogfish = true;
				if ( item.species === 'redHind' ) p.redHind = true;
			}
			if ( p.snapper && p.hogfish && p.redHind ) {
				this.director.complete( IDS.reef, { toast: true } );
				this.refreshUnlocks();
			} else this.game.toast( `Reef Table · ${ this.reefTableText() }`, 1900 );
		}
		this.state.save();
		this.refreshObjective();
	}

	isReady( id ) {
		if ( id === IDS.lobster ) return Number( this.progress[ id ]?.caught || 0 ) >= 3;
		if ( id === IDS.waters ) { const p = this.progress[ id ]; return !! ( p?.shallows && p?.reef && p?.offshore ); }
		if ( id === IDS.night ) return !! this.progress[ id ]?.tarpon;
		return false;
	}

	reefTableText() {
		const p = this.progress[ IDS.reef ];
		return `${ p.snapper ? '✓' : '○' } snapper  ${ p.hogfish ? '✓' : '○' } hogfish  ${ p.redHind ? '✓' : '○' } red hind`;
	}

	threeWatersText() {
		const p = this.progress[ IDS.waters ];
		return `${ p.shallows ? '✓' : '○' } shallows  ${ p.reef ? '✓' : '○' } reef  ${ p.offshore ? '✓' : '○' } offshore`;
	}

	activeIslandMission() {
		return ( this.state.missions?.active || [] ).find( ( id ) => ISLAND_IDS.has( id ) ) || null;
	}

	nextAvailable() {
		const ids = [ IDS.intro, IDS.lobster, IDS.waters, IDS.reef, IDS.night, IDS.conservation ];
		return ids.find( ( id ) => this.available( id ) ) || null;
	}

	giver( id ) { return GIVER[ id ] || 'Joe'; }
	vendorFor( id ) { return this.giver( id ) === 'Martha' ? this.martha : this.joe; }

	accept( id ) {
		if ( ! this.director.accept( id, { toast: false } ) ) return false;
		this.consumeVendorAction = true;
		const lines = {
			[ IDS.intro ]: 'Martha: “Bring back something legal and Joe will show you how the water pays.”',
			[ IDS.lobster ]: 'Joe: “Three good spiny lobsters. Hand-caught. Don’t bring me undersize ones.”',
			[ IDS.reef ]: 'Martha: “I want a proper reef table — snapper, hogfish and red hind.”',
			[ IDS.waters ]: 'Joe: “Show me you know Bermuda water: shallows, reef, then blue water.”',
			[ IDS.night ]: 'Joe: “Tarpon have been moving after dark. Bring one in if you can handle it.”',
			[ IDS.conservation ]: 'Joe: “Knowing what to release matters as much as knowing what to keep.”',
		};
		this.game.toast( lines[ id ] || `${ this.director.definition( id )?.title } started`, 4300 );
		this.refreshObjective();
		return true;
	}

	turnIn( id ) {
		if ( ! this.isReady( id ) ) return false;
		if ( ! this.director.complete( id, { toast: true } ) ) return false;
		this.consumeVendorAction = true;
		this.refreshUnlocks();
		this.refreshObjective();
		return true;
	}

	refreshObjective() {
		const el = this.app.progression?.objectiveEl;
		if ( ! el ) return;
		const id = this.activeIslandMission();
		if ( ! id ) return;
		let text = this.director.definition( id )?.activeObjective || '';
		if ( id === IDS.lobster ) text = `Hand-catch Caribbean spiny lobster · ${ Number( this.progress[ id ]?.caught || 0 ) } / 3${ this.isReady( id ) ? ' · return to Joe' : '' }`;
		else if ( id === IDS.reef ) text = `Reef Table · ${ this.reefTableText() }`;
		else if ( id === IDS.waters ) text = `Three Waters · ${ this.threeWatersText() }${ this.isReady( id ) ? ' · return to Joe' : '' }`;
		else if ( id === IDS.night ) text = this.isReady( id ) ? 'After Dark · tarpon landed · return to Joe' : 'Catch a tarpon between 20:00 and 06:00';
		el.style.display = '';
		el.innerHTML = `<span class="bm-objective-kicker">CURRENT JOB</span>${ text }`;
	}

	update() {
		this.refreshUnlocks();
		this.refreshObjective();
		if ( this.player.mode !== 'walk' || this.player.busy ) return;

		if ( this.app.settings?.weatherMode === 'storm' && ( this.app.dynamicIslandEvents?.available?.() || this.app.dynamicIslandEvents?.active?.() ) ) return;

		const active = this.activeIslandMission();
		if ( active && this.isReady( active ) ) {
			const vendor = this.vendorFor( active );
			if ( vendor?.inRange?.( this.player.position ) ) {
				this.player.prompt = { key: 'E', text: `${ this.giver( active ) } · finish ${ this.director.definition( active ).title }` };
				if ( this.input.hit( 'KeyE' ) ) this.turnIn( active );
			}
			return;
		}
		if ( active ) return;

		const available = this.nextAvailable();
		if ( ! available ) return;
		const vendor = this.vendorFor( available );
		if ( ! vendor?.inRange?.( this.player.position ) ) return;
		if ( available === IDS.intro && this.app.marthaShop && ! this.app.marthaShop.marthaAccessible( this.player.position ) ) return;
		this.player.prompt = { key: 'E', text: `${ this.giver( available ) } · ${ this.director.definition( available ).title }` };
		if ( this.input.hit( 'KeyE' ) ) this.accept( available );
	}
}
