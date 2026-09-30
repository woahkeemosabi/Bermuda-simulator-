import { Group, Mesh } from '../engine/index.js';
import { prepare, mergePrepared, box, cylinder, mat4 } from '../world/boat/GeoKit.js';
import { createPropMaterial } from './GameMaterials.js';

const IDS = Object.freeze( [
	'side-ghost-line',
	'side-lost-camera',
	'side-blue-water-call',
	'side-island-table',
	'side-harbour-before-dark',
	// Legacy save ID retained; player-facing quest is now Mooring 17.
	'side-strange-signal',
] );
const SIDE_SET = new Set( IDS );
const GIVER = Object.freeze( {
	'side-ghost-line': 'Martha',
	'side-lost-camera': 'Joe',
	'side-blue-water-call': 'Joe',
	'side-island-table': 'Martha',
	'side-harbour-before-dark': 'Joe',
	'side-strange-signal': 'Joe',
} );

function targetGeometry() {
	const P = [];
	const add = ( g, o ) => P.push( prepare( g, o ) );
	add( box( 0.34, 0.16, 0.26 ), { color: 0x24333a, rough: 0.66, metal: 0.16, matrix: mat4( 0, 0.08, 0 ) } );
	add( cylinder( 0.17, 0.17, 0.06, 18 ), { color: 0x71848d, rough: 0.42, metal: 0.38, matrix: mat4( 0.16, 0.12, 0.03, 0, 0, Math.PI * 0.5 ) } );
	add( cylinder( 0.025, 0.025, 0.62, 10 ), { color: 0xe0c57d, rough: 0.54, metal: 0.12, matrix: mat4( - 0.10, 0.31, 0 ) } );
	return mergePrepared( P );
}

function ensureProgress( flags ) {
	const current = flags.sideQuestProgress || {};
	flags.sideQuestProgress = {
		'side-ghost-line': { inspected: false, ...( current[ 'side-ghost-line' ] || {} ) },
		'side-lost-camera': { inspected: false, ...( current[ 'side-lost-camera' ] || {} ) },
		'side-blue-water-call': { mahi: false, wahoo: false, ...( current[ 'side-blue-water-call' ] || {} ) },
		'side-island-table': { yellowtail: false, hogfish: false, redHind: false, lobster: false, ...( current[ 'side-island-table' ] || {} ) },
		'side-harbour-before-dark': { reached: false, ...( current[ 'side-harbour-before-dark' ] || {} ) },
		'side-strange-signal': { inspected: false, ...( current[ 'side-strange-signal' ] || {} ) },
	};
	return flags.sideQuestProgress;
}

export class SideQuestSystem {
	constructor( app ) {
		this.app = app;
		this.game = app.game;
		this.state = app.game.state;
		this.player = app.player;
		this.input = app.input;
		this.director = app.missionDirector;
		this.martha = app.game?.chandlery?.vendor || null;
		this.joe = app.game?.stand?.vendor || null;
		this.progress = ensureProgress( this.state.storyFlags );
		this.consumeVendorAction = false;

		this.marker = new Group();
		this.marker.name = 'BermudaSideQuestTarget';
		const markerMesh = new Mesh( targetGeometry(), createPropMaterial( 'bermudaSideQuestTarget' ) );
		markerMesh.castShadow = true;
		markerMesh.receiveShadow = true;
		this.marker.add( markerMesh );
		this.marker.visible = false;
		app.scene.add( this.marker );

		this.patchCatch();
		this.patchVendorAction();
		const realUpdate = this.player.update.bind( this.player );
		this.player.update = ( dt ) => {
			realUpdate( dt );
			this.update( dt );
		};
		app.sideQuests = this;
		this.refreshUnlocks();
	}

	patchVendorAction() {
		if ( this.game.__sideQuestVendorPatch ) return;
		this.game.__sideQuestVendorPatch = true;
		const original = this.game.updateVendors.bind( this.game );
		this.game.updateVendors = ( input, player ) => {
			if ( this.consumeVendorAction ) {
				this.consumeVendorAction = false;
				return;
			}
			return original( input, player );
		};
	}

	patchCatch() {
		if ( this.state.__sideQuestCatchPatch ) return;
		this.state.__sideQuestCatchPatch = true;
		const original = this.state.addFish.bind( this.state );
		this.state.addFish = ( species, ...args ) => {
			const kept = original( species, ...args );
			this.onCatch( species, kept, this.state.lastCatch );
			return kept;
		};
	}

	active( id ) { return !! this.director?.active?.( id ); }
	available( id ) { return !! this.director?.available?.( id ); }
	completed( id ) { return !! this.director?.completed?.( id ); }
	activeQuest() { return ( this.state.missions?.active || [] ).find( ( id ) => SIDE_SET.has( id ) ) || null; }
	nextAvailable() { return IDS.find( ( id ) => this.available( id ) ) || null; }
	ownsBoat() { return ( this.state.boats?.owned?.length || 0 ) > 0; }

	refreshUnlocks() {
		if ( this.completed( 'side-ghost-line' ) || this.available( 'side-ghost-line' ) || this.active( 'side-ghost-line' ) ) return;
		const proven = this.director?.completed?.( 'joe-three-waters' ) || Number( this.state.reputation?.marineCommunity || 0 ) >= 7;
		if ( proven && this.ownsBoat() ) this.director?.unlock?.( 'side-ghost-line' );
	}

	giverFor( id ) { return GIVER[ id ] === 'Martha' ? this.martha : this.joe; }
	giverName( id ) { return GIVER[ id ] || 'Joe'; }

	pointFor( id ) {
		const lobsters = this.game?.lobsters;
		const items = lobsters?.items || [];
		const index = id === 'side-ghost-line' ? 1 : id === 'side-lost-camera' ? 5 : id === 'side-harbour-before-dark' ? 8 : 11;
		const item = items[ Math.min( index, Math.max( 0, items.length - 1 ) ) ];
		if ( item && lobsters?.floorAt ) return { x: item.x, y: lobsters.floorAt( item.x, item.z ) + 0.24, z: item.z };
		const boat = this.app.boatCtl?.group?.position || this.app.boat?.position;
		if ( boat ) return { x: boat.x + 24, y: boat.y - 2.4, z: boat.z + 16 };
		return { x: - 12, y: - 2, z: - 38 };
	}

	setMarker( id, visible = true ) {
		const p = this.pointFor( id );
		this.marker.position.set( p.x, p.y, p.z );
		this.marker.visible = visible;
	}

	distanceToPoint( id ) {
		const p = this.pointFor( id );
		const q = this.player.position;
		return Math.hypot( q.x - p.x, q.y - p.y, q.z - p.z );
	}

	onCatch( species, kept ) {
		const active = this.activeQuest();
		if ( ! active ) return;
		if ( active === 'side-blue-water-call' && kept ) {
			const p = this.progress[ active ];
			if ( species === 'mahi' ) p.mahi = true;
			if ( species === 'wahoo' ) p.wahoo = true;
			if ( p.mahi || p.wahoo ) this.game.toast( `Blue Water Call · ${ p.mahi ? '✓' : '○' } mahi  ${ p.wahoo ? '✓' : '○' } wahoo`, 2200 );
		}
		if ( active === 'side-island-table' && kept ) {
			const p = this.progress[ active ];
			if ( species === 'yellowtail' ) p.yellowtail = true;
			if ( species === 'wrasse' ) p.hogfish = true;
			if ( species === 'redHind' ) p.redHind = true;
			if ( species === 'spinyLobster' ) p.lobster = true;
			this.game.toast( `Island Table · ${ this.islandTableText() }`, 2300 );
		}
		this.state.save();
	}

	blueWaterReady() {
		const p = this.progress[ 'side-blue-water-call' ];
		return !! ( p.mahi && p.wahoo );
	}

	islandTableReady() {
		const p = this.progress[ 'side-island-table' ];
		return !! ( p.yellowtail && p.hogfish && p.redHind && p.lobster );
	}

	islandTableText() {
		const p = this.progress[ 'side-island-table' ];
		return `${ p.yellowtail ? '✓' : '○' } yellowtail  ${ p.hogfish ? '✓' : '○' } hogfish  ${ p.redHind ? '✓' : '○' } red hind  ${ p.lobster ? '✓' : '○' } lobster`;
	}

	accept( id ) {
		if ( ! this.director?.accept?.( id, { toast: false } ) ) return false;
		this.consumeVendorAction = true;
		const lines = {
			'side-ghost-line': 'Martha: “There’s ghost line wrapped up on the reef. Cut it free before something gets caught in it.”',
			'side-lost-camera': 'Joe: “Diver dropped a camera over the reef. Find it before the swell buries it.”',
			'side-blue-water-call': 'Joe: “Birds are working offshore. Bring me a mahi and a wahoo if the blue water is alive.”',
			'side-island-table': 'Martha: “We’re putting on a proper island table. Yellowtail, hogfish, red hind and a lobster.”',
			'side-harbour-before-dark': 'Joe: “Check the reef marker and get back before dark. I don’t want to go looking for you.”',
			'side-strange-signal': 'Joe: “Mooring 17 keeps showing occupied on sonar after dark. Funny thing is, there’s never a boat on it. Go make one pass.”',
		};
		this.game.toast( lines[ id ], 4800 );
		this.state.save();
		return true;
	}

	complete( id ) {
		if ( ! this.director?.complete?.( id, { toast: true } ) ) return false;
		this.consumeVendorAction = true;
		this.marker.visible = false;
		this.state.save();
		this.refreshUnlocks();
		return true;
	}

	readyToTurnIn( id ) {
		if ( id === 'side-ghost-line' || id === 'side-lost-camera' || id === 'side-strange-signal' ) return !! this.progress[ id ]?.inspected;
		if ( id === 'side-blue-water-call' ) return this.blueWaterReady();
		if ( id === 'side-island-table' ) return this.islandTableReady();
		if ( id === 'side-harbour-before-dark' ) return !! this.progress[ id ]?.reached;
		return false;
	}

	objectiveText( id ) {
		if ( id === 'side-ghost-line' ) return this.progress[ id ].inspected ? 'Ghost Line · return to Martha' : 'Ghost Line · dive the reef and clear the tangled fishing line';
		if ( id === 'side-lost-camera' ) return this.progress[ id ].inspected ? 'Lost Camera · return it to Joe' : 'Lost Camera · dive the marked reef and recover the camera';
		if ( id === 'side-blue-water-call' ) { const p = this.progress[ id ]; return `Blue Water Call · ${ p.mahi ? '✓' : '○' } mahi  ${ p.wahoo ? '✓' : '○' } wahoo${ this.blueWaterReady() ? ' · return to Joe' : '' }`; }
		if ( id === 'side-island-table' ) return `Island Table · ${ this.islandTableText() }${ this.islandTableReady() ? ' · return to Martha' : '' }`;
		if ( id === 'side-harbour-before-dark' ) return this.progress[ id ].reached ? 'Harbour Before Dark · return to Joe before 20:00' : 'Harbour Before Dark · reach the reef marker before 20:00';
		if ( id === 'side-strange-signal' ) return this.progress[ id ].inspected ? 'Mooring 17 · report the sonar return to Joe' : 'Mooring 17 · after dark, inspect the unexplained sonar return by boat';
		return this.director?.definition?.( id )?.activeObjective || '';
	}

	refreshObjective( id ) {
		const el = this.app.progression?.objectiveEl;
		if ( ! el || ! id ) return;
		el.style.display = '';
		el.innerHTML = `<span class="bm-objective-kicker">SIDE QUEST</span>${ this.objectiveText( id ) }`;
	}

	updateDiveInspection( id, promptText ) {
		if ( this.progress[ id ].inspected ) { this.marker.visible = false; return; }
		this.setMarker( id, true );
		if ( this.player.mode !== 'swim' || this.distanceToPoint( id ) > 2.6 ) return;
		this.player.prompt = { key: 'E', text: promptText };
		if ( this.input.hit( 'KeyE' ) ) {
			this.progress[ id ].inspected = true;
			this.marker.visible = false;
			this.state.save();
			this.game.toast( `${ this.director.definition( id ).title } · recovered`, 3300 );
		}
	}

	updateMooring17() {
		const id = 'side-strange-signal';
		if ( this.progress[ id ].inspected ) { this.marker.visible = false; return; }
		const hour = Number( this.app.settings?.timeOfDay || 0 );
		const night = hour >= 20 || hour < 5.5;
		this.setMarker( id, night );
		if ( ! night ) return;
		if ( this.player.mode !== 'boat' || this.distanceToPoint( id ) > 14 ) return;
		this.player.prompt = { key: 'E', text: 'Mooring 17 · inspect sonar return' };
		if ( this.input.hit( 'KeyE' ) ) {
			this.progress[ id ].inspected = true;
			this.marker.visible = false;
			this.state.storyFlags.mooring17SonarReturn = true;
			this.state.save();
			this.game.toast( 'Sonar paints a hull-sized return below Mooring 17. The surface is empty.', 4200 );
		}
	}

	update( dt ) {
		this.refreshUnlocks();
		this.marker.rotation.y += Math.min( 0.025, dt * 0.55 );
		const active = this.activeQuest();
		if ( active ) {
			this.refreshObjective( active );
			if ( active === 'side-ghost-line' ) this.updateDiveInspection( active, 'Cut away tangled ghost line' );
			else if ( active === 'side-lost-camera' ) this.updateDiveInspection( active, 'Recover lost dive camera' );
			else if ( active === 'side-strange-signal' ) this.updateMooring17();
			else if ( active === 'side-harbour-before-dark' && ! this.progress[ active ].reached ) {
				this.setMarker( active, true );
				if ( this.distanceToPoint( active ) < 7.5 ) {
					this.progress[ active ].reached = true;
					this.marker.visible = false;
					this.state.save();
					this.game.toast( 'Reef marker checked · get back to Joe before 20:00', 2600 );
				}
			} else this.marker.visible = false;

			if ( this.player.mode === 'walk' && ! this.player.busy && this.readyToTurnIn( active ) ) {
				const giver = this.giverFor( active );
				if ( giver?.inRange?.( this.player.position ) ) {
					if ( active === 'side-harbour-before-dark' && Number( this.app.settings?.timeOfDay || 0 ) >= 20 ) {
						this.player.prompt = { key: 'E', text: 'Joe · too late — try the reef run again tomorrow' };
						if ( this.input.hit( 'KeyE' ) ) {
							this.progress[ active ].reached = false;
							this.state.save();
							this.game.toast( 'Joe: “Daylight next time. Run it again tomorrow.”', 3000 );
						}
					} else {
						this.player.prompt = { key: 'E', text: `${ this.giverName( active ) } · finish ${ this.director.definition( active ).title }` };
						if ( this.input.hit( 'KeyE' ) ) this.complete( active );
					}
				}
			}
			return;
		}

		this.marker.visible = false;
		if ( this.player.mode !== 'walk' || this.player.busy ) return;
		const nonSideActive = ( this.state.missions?.active || [] ).some( ( id ) => ! SIDE_SET.has( id ) );
		if ( nonSideActive ) return;
		const next = this.nextAvailable();
		if ( ! next ) return;
		const giver = this.giverFor( next );
		if ( ! giver?.inRange?.( this.player.position ) ) return;
		this.player.prompt = { key: 'E', text: `${ this.giverName( next ) } · side quest: ${ this.director.definition( next ).title }` };
		if ( this.input.hit( 'KeyE' ) ) this.accept( next );
	}
}
