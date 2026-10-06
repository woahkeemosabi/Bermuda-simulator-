import { Group, Mesh } from '../engine/index.js';
import { prepare, mergePrepared, box, cylinder, mat4 } from '../world/boat/GeoKit.js';
import { createPropMaterial } from './GameMaterials.js';
import { HARBOUR_JOB_BOARD } from '../world/bermuda/HarbourLayout.js';

const GROUPS = Object.freeze( {
	bait: new Set( [ 'silverside', 'mullet', 'needlefish' ] ),
	snapper: new Set( [ 'yellowtail', 'laneSnapper', 'redSnapper' ] ),
	tuna: new Set( [ 'tuna', 'yellowfin' ] ),
	lobster: new Set( [ 'spinyLobster' ] ),
} );

export const MINI_JOBS = Object.freeze( [
	{ id: 'mini-bait-bucket', title: 'Bait Bucket', text: 'Bring in 3 bait fish for the morning boats', kind: 'catchGroup', group: 'bait', count: 3, reward: 65, rep: { fishermen: 1 } },
	{ id: 'mini-snapper-order', title: 'Snapper Order', text: 'Land 2 snapper for a dockside order', kind: 'catchGroup', group: 'snapper', count: 2, reward: 95, rep: { Joe: 1 } },
	{ id: 'mini-hogfish-special', title: 'Hogfish Special', text: 'Bring in one legal hogfish', kind: 'catchSpecies', species: 'wrasse', count: 1, reward: 110, rep: { fishermen: 1 } },
	{ id: 'mini-red-hind-order', title: 'Red Hind Order', text: 'Land 2 legal red hind', kind: 'catchSpecies', species: 'redHind', count: 2, reward: 120, rep: { Joe: 1 } },
	{ id: 'mini-lobster-pair', title: 'Lobster Pair', text: 'Hand-catch 2 legal spiny lobsters', kind: 'catchSpecies', species: 'spinyLobster', count: 2, reward: 165, rep: { marineCommunity: 1 }, requiresBoat: true },
	{ id: 'mini-yellowtail-dusk', title: 'Yellowtail at Dusk', text: 'Land 2 yellowtail around dawn or dusk', kind: 'catchTime', species: 'yellowtail', count: 2, time: 'dawnDusk', reward: 130, rep: { fishermen: 1 } },
	{ id: 'mini-tarpon-night', title: 'Night Tarpon', text: 'Land a tarpon after dark', kind: 'catchTime', species: 'tarpon', count: 1, time: 'night', reward: 210, rep: { Joe: 2 }, requiresBoat: true },
	{ id: 'mini-mahi-call', title: 'Mahi Call', text: 'Birds are working offshore — land a mahi-mahi', kind: 'catchSpecies', species: 'mahi', count: 1, reward: 175, rep: { fishermen: 2 }, requiresBoat: true },
	{ id: 'mini-wahoo-run', title: 'Wahoo Run', text: 'Bring in one legal wahoo', kind: 'catchSpecies', species: 'wahoo', count: 1, reward: 225, rep: { fishermen: 2 }, requiresBoat: true },
	{ id: 'mini-tuna-ice', title: 'Tuna on Ice', text: 'Land one blackfin or yellowfin tuna', kind: 'catchGroup', group: 'tuna', count: 1, reward: 205, rep: { Joe: 2 }, requiresBoat: true },
	{ id: 'mini-jack-run', title: 'Jack Run', text: 'Land one crevalle jack', kind: 'catchSpecies', species: 'jack', count: 1, reward: 100, rep: { fishermen: 1 } },
	{ id: 'mini-rainy-bite', title: 'Rainy Bite', text: 'Land 2 fish while cloud or storm weather is in', kind: 'catchWeather', count: 2, reward: 145, rep: { fishermen: 1 } },
	{ id: 'mini-reef-release', title: 'Reef Release', text: 'Encounter and release one protected reef fish', kind: 'releaseProtected', count: 1, reward: 120, rep: { marineCommunity: 2 } },
	{ id: 'mini-market-cash', title: 'Market Cash', text: 'Sell at least $125 of legal catch in one or more sales', kind: 'sellValue', value: 125, reward: 75, rep: { Joe: 1 } },
	{ id: 'mini-market-crate', title: 'Market Crate', text: 'Sell 4 legal fish or lobster', kind: 'sellCount', count: 4, reward: 80, rep: { Joe: 1 } },
	{ id: 'mini-lobster-market', title: 'Lobster Market', text: 'Sell 2 spiny lobsters to Joe', kind: 'sellGroup', group: 'lobster', count: 2, reward: 140, rep: { Joe: 2 }, requiresBoat: true },
	{ id: 'mini-martha-run', title: 'Dock Run', text: 'Check in with Martha, then get back to Joe', kind: 'route', route: [ 'martha', 'joe' ], reward: 55, rep: { Martha: 1, Joe: 1 } },
	{ id: 'mini-harbour-patrol', title: 'Harbour Patrol', text: 'Run Martha → reef marker → Joe', kind: 'route', route: [ 'martha', 'reef0', 'joe' ], reward: 150, rep: { marineCommunity: 1 }, requiresBoat: true },
	{ id: 'mini-reef-check', title: 'Reef Check', text: 'Take your boat out to the marked reef patch', kind: 'visit', target: 'reef2', reward: 105, rep: { marineCommunity: 1 }, requiresBoat: true },
	{ id: 'mini-night-buoy', title: 'Night Buoy', text: 'Inspect the marked reef buoy after dark', kind: 'visitTime', target: 'reef4', time: 'night', reward: 150, rep: { Joe: 1 }, requiresBoat: true },
	{ id: 'mini-sunrise-run', title: 'First Light', text: 'Reach the marked reef patch around dawn', kind: 'visitTime', target: 'reef3', time: 'dawn', reward: 145, rep: { fishermen: 1 }, requiresBoat: true },
	{ id: 'mini-storm-ready', title: 'Storm Ready', text: 'Secure your boat with the anchor during a storm', kind: 'anchorStorm', reward: 170, rep: { marineCommunity: 2 }, requiresBoat: true },
	{ id: 'mini-chandlery-stock', title: 'Chandlery Stock', text: 'Buy one useful gear or boat upgrade', kind: 'buyUpgrade', count: 1, reward: 45, rep: { Martha: 1 } },
	{ id: 'mini-fuel-up', title: 'Fuel Up', text: 'Put fuel in the active boat', kind: 'refuel', count: 1, reward: 40, rep: { Joe: 1 }, requiresBoat: true },
] );

function boardGeometry() {
	const P = [];
	const add = ( g, o ) => P.push( prepare( g, o ) );
	// Vertical noticeboard panel. The old dimensions made these two slabs horizontal.
	add( box( 1.55, 1.05, 0.09 ), { color: 0x5e4632, rough: 0.86, matrix: mat4( 0, 1.45, 0 ) } );
	add( box( 1.40, 0.90, 0.04 ), { color: 0xd7c49b, rough: 0.92, matrix: mat4( 0, 1.43, - 0.07 ) } );
	add( cylinder( 0.055, 0.055, 1.85, 8 ), { color: 0x4a3829, rough: 0.88, matrix: mat4( - 0.62, 0.92, 0 ) } );
	add( cylinder( 0.055, 0.055, 1.85, 8 ), { color: 0x4a3829, rough: 0.88, matrix: mat4( 0.62, 0.92, 0 ) } );
	return mergePrepared( P );
}

function waypointGeometry() {
	const P = [];
	const add = ( g, o ) => P.push( prepare( g, o ) );
	add( cylinder( 0.12, 0.20, 1.15, 12 ), { color: 0xf0c24d, rough: 0.52, matrix: mat4( 0, 0.58, 0 ) } );
	add( cylinder( 0.24, 0.24, 0.08, 16 ), { color: 0xe55a47, rough: 0.48, matrix: mat4( 0, 1.13, 0 ) } );
	return mergePrepared( P );
}

function inTimeWindow( hour, mode ) {
	hour = ( Number( hour ) + 24 ) % 24;
	if ( mode === 'night' ) return hour >= 20 || hour < 6;
	if ( mode === 'dawn' ) return hour >= 5 && hour < 8;
	if ( mode === 'dawnDusk' ) return ( hour >= 5 && hour < 8 ) || ( hour >= 17 && hour < 20.5 );
	return true;
}

function createState( flags ) {
	const s = flags.harbourJobs || {};
	flags.harbourJobs = {
		active: s.active || null,
		progress: s.progress || {},
		completedCount: Number( s.completedCount || 0 ),
		history: Array.isArray( s.history ) ? s.history.slice( - 20 ) : [],
	};
	return flags.harbourJobs;
}

export class HarbourJobBoard {
	constructor( app ) {
		this.app = app;
		this.game = app.game;
		this.state = app.game.state;
		this.player = app.player;
		this.input = app.input;
		this.joe = app.game?.stand?.vendor || null;
		this.martha = app.game?.chandlery?.vendor || null;
		this.data = createState( this.state.storyFlags );

		this.board = new Group();
		this.board.name = 'HarbourJobsBoard';
		const boardMesh = new Mesh( boardGeometry(), createPropMaterial( 'harbourJobsBoard' ) );
		boardMesh.castShadow = true; boardMesh.receiveShadow = true;
		this.board.add( boardMesh );
		app.scene.add( this.board );

		this.waypoint = new Group();
		this.waypoint.name = 'MiniMissionWaypoint';
		const wpMesh = new Mesh( waypointGeometry(), createPropMaterial( 'miniMissionWaypoint' ) );
		wpMesh.castShadow = true; wpMesh.receiveShadow = true;
		this.waypoint.add( wpMesh );
		this.waypoint.visible = false;
		app.scene.add( this.waypoint );

		this.placeBoard();
		this.mountUI();
		this.patchEconomy();
		const realUpdate = this.player.update.bind( this.player );
		this.player.update = ( dt ) => {
			realUpdate( dt );
			this.update( dt );
		};
		app.harbourJobBoard = this;
	}

	placeBoard() {
		this.board.position.set( HARBOUR_JOB_BOARD.x, HARBOUR_JOB_BOARD.baseY, HARBOUR_JOB_BOARD.z );
		this.board.rotation.set( 0, HARBOUR_JOB_BOARD.yaw, 0 );
	}

	mountUI() {
		if ( typeof document === 'undefined' ) return;
		const style = document.createElement( 'style' );
		style.textContent = `#bm-job-board{position:fixed;inset:0;z-index:110;display:none;align-items:center;justify-content:center;background:rgba(0,9,14,.58);backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px);font-family:system-ui,-apple-system,sans-serif}#bm-job-card{width:min(520px,calc(100vw - 28px));max-height:78vh;overflow:auto;background:rgba(8,25,34,.96);border:1px solid rgba(126,226,218,.30);border-radius:18px;padding:18px;color:#efffff;box-shadow:0 18px 60px rgba(0,0,0,.38)}#bm-job-card h2{margin:0 0 4px;font-size:19px}#bm-job-card p{margin:0 0 14px;color:#a9c9cd;font-size:12px}.bm-job-offer{display:block;width:100%;text-align:left;margin:9px 0;padding:12px 13px;border-radius:13px;border:1px solid rgba(127,219,213,.22);background:rgba(17,49,59,.9);color:#efffff}.bm-job-offer strong{display:block;font-size:14px}.bm-job-offer span{display:block;margin-top:4px;font-size:11px;color:#b9d5d7}.bm-job-offer em{display:block;margin-top:6px;font-size:11px;color:#77e2d6;font-style:normal}.bm-job-close{float:right;border:0;background:transparent;color:#d8ffff;font-size:20px}#bm-mini-job{position:fixed;right:14px;top:max(92px,calc(env(safe-area-inset-top) + 82px));z-index:67;max-width:min(330px,calc(100vw - 28px));padding:8px 11px;border-radius:11px;background:rgba(22,30,16,.74);border:1px solid rgba(217,221,116,.28);color:#fbffe9;font:600 11px/1.35 system-ui,-apple-system,sans-serif;pointer-events:none}.bm-mini-kicker{display:block;font-size:9px;letter-spacing:.14em;color:#e7e57d;margin-bottom:2px}`;
		document.head.appendChild( style );
		this.overlay = document.createElement( 'div' );
		this.overlay.id = 'bm-job-board';
		this.overlay.innerHTML = '<div id="bm-job-card"></div>';
		document.body.appendChild( this.overlay );
		this.hud = document.createElement( 'div' );
		this.hud.id = 'bm-mini-job';
		this.hud.style.display = 'none';
		document.body.appendChild( this.hud );
		this.overlay.addEventListener( 'click', ( e ) => { if ( e.target === this.overlay ) this.closeBoard(); } );
	}

	eligibleJobs() {
		const ownsBoat = ( this.state.boats?.owned?.length || 0 ) > 0;
		return MINI_JOBS.filter( ( job ) => ! job.requiresBoat || ownsBoat );
	}

	offers() {
		const eligible = this.eligibleJobs();
		const recent = new Set( this.data.history.slice( - 5 ) );
		const pool = eligible.filter( ( j ) => ! recent.has( j.id ) );
		const source = pool.length >= 3 ? pool : eligible;
		if ( ! source.length ) return [];
		const hour = Math.floor( Number( this.app.settings?.timeOfDay || 0 ) / 4 );
		const start = ( this.data.completedCount * 3 + hour ) % source.length;
		const out = [];
		for ( let i = 0; i < source.length && out.length < 3; i ++ ) {
			const job = source[ ( start + i * 5 ) % source.length ];
			if ( ! out.some( ( x ) => x.id === job.id ) ) out.push( job );
		}
		return out;
	}

	openBoard() {
		if ( ! this.overlay ) return;
		const card = this.overlay.querySelector( '#bm-job-card' );
		card.innerHTML = '';
		const close = document.createElement( 'button' );
		close.className = 'bm-job-close'; close.textContent = '×'; close.addEventListener( 'click', () => this.closeBoard() );
		card.appendChild( close );
		const h = document.createElement( 'h2' ); h.textContent = 'Harbour Jobs'; card.appendChild( h );
		const p = document.createElement( 'p' ); p.textContent = this.data.active ? 'Finish your current quick job before taking another.' : 'Short local work. Jobs rotate as you complete them.'; card.appendChild( p );
		if ( this.data.active ) {
			const job = this.job( this.data.active.id );
			const b = document.createElement( 'button' ); b.className = 'bm-job-offer'; b.disabled = true;
			b.innerHTML = `<strong>${ job?.title || 'Current Job' }</strong><span>${ this.jobText() }</span><em>ACTIVE</em>`; card.appendChild( b );
		} else for ( const job of this.offers() ) {
			const b = document.createElement( 'button' ); b.className = 'bm-job-offer';
			b.innerHTML = `<strong>${ job.title }</strong><span>${ job.text }</span><em>$${ job.reward } reward</em>`;
			b.addEventListener( 'click', () => { this.accept( job.id ); this.closeBoard(); } );
			card.appendChild( b );
		}
		this.overlay.style.display = 'flex';
		this.player.busy = true;
	}

	closeBoard() {
		if ( this.overlay ) this.overlay.style.display = 'none';
		this.player.busy = false;
	}

	job( id ) { return MINI_JOBS.find( ( j ) => j.id === id ) || null; }
	progress() { return this.data.active?.progress || {}; }

	accept( id ) {
		if ( this.data.active ) return false;
		const job = this.job( id );
		if ( ! job || ! this.eligibleJobs().some( ( j ) => j.id === id ) ) return false;
		this.data.active = { id, startedAt: Date.now(), progress: { count: 0, value: 0, index: 0 } };
		this.state.save();
		this.game.toast( `${ job.title } · quick job started`, 2300 );
		return true;
	}

	complete() {
		const active = this.data.active;
		if ( ! active ) return false;
		const job = this.job( active.id );
		if ( ! job ) return false;
		this.state.addMoney( Number( job.reward || 0 ) );
		for ( const [ person, amount ] of Object.entries( job.rep || {} ) ) this.state.addReputation( person, Number( amount ) || 0 );
		this.data.completedCount ++;
		this.data.history.push( job.id );
		this.data.history = this.data.history.slice( - 20 );
		this.data.active = null;
		this.waypoint.visible = false;
		this.state.save(); this.state.emit();
		this.game.toast( `${ job.title } complete · +$${ job.reward }`, 3000 );
		return true;
	}

	patchEconomy() {
		if ( this.state.__harbourJobsPatched ) return;
		this.state.__harbourJobsPatched = true;
		const addFish = this.state.addFish.bind( this.state );
		this.state.addFish = ( species, ...args ) => {
			const kept = addFish( species, ...args );
			this.onCatch( species, kept, this.state.lastCatch );
			return kept;
		};
		const sell = this.state.sell.bind( this.state );
		this.state.sell = ( ids = null ) => {
			const selected = this.state.inventory.filter( ( item ) => ids === null || ids.includes( item.id ) ).map( ( item ) => ( { ...item } ) );
			const result = sell( ids );
			this.onSale( selected, result );
			return result;
		};
		const buy = this.state.buy.bind( this.state );
		this.state.buy = ( key ) => {
			const result = buy( key );
			if ( result ) this.onUpgrade();
			return result;
		};
		const refuel = this.state.refuel.bind( this.state );
		this.state.refuel = () => {
			const litres = refuel();
			if ( litres > 0 ) this.onRefuel();
			return litres;
		};
	}

	onCatch( species, kept, info ) {
		const active = this.data.active, job = active && this.job( active.id );
		if ( ! job ) return;
		let hit = false;
		if ( job.kind === 'catchSpecies' && kept && species === job.species ) hit = true;
		else if ( job.kind === 'catchGroup' && kept && GROUPS[ job.group ]?.has( species ) ) hit = true;
		else if ( job.kind === 'catchTime' && kept && species === job.species && inTimeWindow( this.app.settings?.timeOfDay, job.time ) ) hit = true;
		else if ( job.kind === 'catchWeather' && kept && [ 'overcast', 'storm' ].includes( this.app.settings?.weatherMode ) ) hit = true;
		else if ( job.kind === 'releaseProtected' && info?.protectedSpecies ) hit = true;
		if ( ! hit ) return;
		active.progress.count = Math.min( job.count || 1, Number( active.progress.count || 0 ) + 1 );
		this.state.save();
		if ( active.progress.count >= ( job.count || 1 ) ) this.complete();
		else this.game.toast( `${ job.title } · ${ active.progress.count } / ${ job.count }`, 1600 );
	}

	onSale( items, result ) {
		const active = this.data.active, job = active && this.job( active.id );
		if ( ! job || ! result?.count ) return;
		if ( job.kind === 'sellValue' ) active.progress.value = Number( active.progress.value || 0 ) + Number( result.total || 0 );
		else if ( job.kind === 'sellCount' ) active.progress.count = Number( active.progress.count || 0 ) + Number( result.count || 0 );
		else if ( job.kind === 'sellGroup' ) active.progress.count = Number( active.progress.count || 0 ) + items.filter( ( i ) => GROUPS[ job.group ]?.has( i.species ) ).length;
		else return;
		this.state.save();
		if ( job.kind === 'sellValue' ? active.progress.value >= job.value : active.progress.count >= job.count ) this.complete();
	}

	onUpgrade() {
		const active = this.data.active, job = active && this.job( active.id );
		if ( job?.kind === 'buyUpgrade' ) this.complete();
	}

	onRefuel() {
		const active = this.data.active, job = active && this.job( active.id );
		if ( job?.kind === 'refuel' ) this.complete();
	}

	pointFor( key ) {
		if ( key === 'martha' && this.martha?.position ) return { x: this.martha.position.x, y: this.martha.position.y, z: this.martha.position.z };
		if ( key === 'joe' && this.joe?.position ) return { x: this.joe.position.x, y: this.joe.position.y, z: this.joe.position.z };
		if ( key === 'board' ) return { x: this.board.position.x, y: this.board.position.y, z: this.board.position.z };
		if ( key?.startsWith( 'reef' ) ) {
			const index = Math.max( 0, Number( key.slice( 4 ) ) || 0 );
			const lobsters = this.game?.lobsters;
			const items = lobsters?.items || [];
			const item = items[ Math.min( index * 2 + 1, Math.max( 0, items.length - 1 ) ) ];
			if ( item ) return { x: item.x, y: lobsters.floorAt?.( item.x, item.z ) ?? - 1, z: item.z };
		}
		return { x: this.board.position.x, y: this.board.position.y, z: this.board.position.z };
	}

	planarDistance( point ) {
		const p = this.player.position;
		return Math.hypot( p.x - point.x, p.z - point.z );
	}

	updateVisitJob( job ) {
		const active = this.data.active;
		let key = job.target;
		if ( job.kind === 'route' ) key = job.route[ Math.min( active.progress.index || 0, job.route.length - 1 ) ];
		const point = this.pointFor( key );
		this.waypoint.position.set( point.x, point.y + 0.2, point.z );
		this.waypoint.visible = true;
		if ( job.kind === 'visitTime' && ! inTimeWindow( this.app.settings?.timeOfDay, job.time ) ) return;
		if ( this.planarDistance( point ) > ( key?.startsWith( 'reef' ) ? 8 : 2.8 ) ) return;
		if ( job.kind === 'route' ) {
			active.progress.index = Number( active.progress.index || 0 ) + 1;
			this.state.save();
			if ( active.progress.index >= job.route.length ) this.complete();
			else this.game.toast( `${ job.title } · next stop`, 1500 );
		} else this.complete();
	}

	jobText() {
		const active = this.data.active, job = active && this.job( active.id );
		if ( ! job ) return '';
		const p = active.progress || {};
		if ( [ 'catchSpecies', 'catchGroup', 'catchTime', 'catchWeather', 'releaseProtected', 'sellCount', 'sellGroup' ].includes( job.kind ) ) return `${ job.text } · ${ Number( p.count || 0 ) } / ${ job.count || 1 }`;
		if ( job.kind === 'sellValue' ) return `${ job.text } · $${ Math.round( Number( p.value || 0 ) ) } / $${ job.value }`;
		if ( job.kind === 'route' ) return `${ job.text } · stop ${ Math.min( Number( p.index || 0 ) + 1, job.route.length ) } / ${ job.route.length }`;
		return job.text;
	}

	updateHUD() {
		if ( ! this.hud ) return;
		const active = this.data.active, job = active && this.job( active.id );
		if ( ! job ) { this.hud.style.display = 'none'; return; }
		this.hud.style.display = '';
		this.hud.innerHTML = `<span class="bm-mini-kicker">QUICK JOB · ${ job.title.toUpperCase() }</span>${ this.jobText() }`;
	}

	update() {
		this.updateHUD();
		this.waypoint.visible = false;
		const active = this.data.active, job = active && this.job( active.id );
		if ( job ) {
			if ( job.kind === 'visit' || job.kind === 'visitTime' || job.kind === 'route' ) this.updateVisitJob( job );
			else if ( job.kind === 'anchorStorm' && this.app.settings?.weatherMode === 'storm' && ( this.app.boatCtl?.anchored || this.app.boatCtl?.moored ) ) this.complete();
			return;
		}

		if ( this.player.mode !== 'walk' || this.player.busy ) return;
		if ( this.planarDistance( this.pointFor( 'board' ) ) > 2.2 ) return;
		this.player.prompt = { key: 'E', text: 'Harbour Jobs Board · browse quick jobs' };
		if ( this.input.hit( 'KeyE' ) ) this.openBoard();
	}
}
