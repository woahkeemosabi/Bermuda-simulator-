import { Color, Group, Mesh, Vector3 } from '../engine/index.js';
import { prepare, mergePrepared, box, cylinder, torus, mat4 } from '../world/boat/GeoKit.js';
import { createPropMaterial } from './GameMaterials.js';

const Y = new Vector3( 0, 1, 0 );
const TMP = new Vector3();

function installMobileHudCss() {
	if ( typeof document === 'undefined' || document.getElementById( 'bm-core-polish-style' ) ) return;
	const style = document.createElement( 'style' );
	style.id = 'bm-core-polish-style';
	style.textContent = `
		body.bm-mobile .gm-money{display:flex!important;align-items:center;gap:5px;font-size:12px;font-weight:800;letter-spacing:.02em;padding:2px 7px;border-radius:9px;border:1px solid rgba(129,235,224,.22);background:rgba(8,32,42,.44);white-space:nowrap}
		body.bm-mobile .gm-money::before{content:'💵';font-size:13px;line-height:1}
		@media(max-width:700px){
			#bm-objective{left:14px!important;right:14px!important;max-width:none!important}
			#bm-mini-job{left:14px!important;right:14px!important;top:max(164px,calc(env(safe-area-inset-top) + 154px))!important;max-width:none!important}
			#bm-bike-hint{position:fixed;left:14px;bottom:max(18px,env(safe-area-inset-bottom));z-index:69;padding:7px 10px;border-radius:11px;background:rgba(5,22,31,.78);border:1px solid rgba(132,238,226,.30);color:#efffff;font:750 11px/1.25 system-ui,-apple-system,sans-serif;letter-spacing:.02em;pointer-events:none;backdrop-filter:blur(7px);-webkit-backdrop-filter:blur(7px)}
		}
	`;
	document.head.appendChild( style );
}

function buildMarthaCompletionGeometry() {
	const P = [];
	const add = ( g, o ) => P.push( prepare( g, o ) );
	const wood = { color: 0x7b6248, rough: 0.88 };
	const white = { color: 0xeee9dc, rough: 0.92 };
	const blue = { color: 0x457f8c, rough: 0.72 };
	const dark = { color: 0x29363a, rough: 0.62, metal: 0.18 };
	const red = { color: 0xb94d3f, rough: 0.74 };

	// Proper open-air Tidewater shop shell: roof, fascia, rear shelving and stocked bins.
	add( box( 3.58, 0.12, 2.62 ), { ...white, matrix: mat4( 0, 2.32, - 0.02 ) } );
	add( box( 3.72, 0.28, 0.16 ), { ...blue, matrix: mat4( 0, 2.18, 1.25 ) } );
	for ( const x of [ - 1.66, 1.66 ] ) add( box( 0.12, 2.22, 0.12 ), { ...wood, matrix: mat4( x, 1.12, 1.08 ) } );
	for ( const y of [ 0.52, 1.02, 1.52 ] ) {
		add( box( 2.72, 0.07, 0.40 ), { ...wood, matrix: mat4( - 0.10, y, - 0.98 ) } );
		add( box( 2.72, 0.34, 0.055 ), { ...white, matrix: mat4( - 0.10, y + 0.19, - 1.15 ) } );
	}
	for ( const [ x, c ] of [ [ - 1.12, 0xd9c46f ], [ - 0.68, 0xd8e1df ], [ - 0.24, 0xb94d3f ], [ 0.20, 0x4e7c8a ] ] ) {
		add( box( 0.30, 0.24, 0.28 ), { color: c, rough: 0.75, matrix: mat4( x, 1.70, - 0.94 ) } );
	}
	add( box( 1.24, 0.82, 0.48 ), { ...wood, matrix: mat4( 0.88, 0.43, - 0.30 ) } );
	add( box( 1.34, 0.07, 0.56 ), { ...white, matrix: mat4( 0.88, 0.88, - 0.30 ) } );
	add( box( 0.32, 0.18, 0.24 ), { ...dark, matrix: mat4( 1.18, 1.01, - 0.30 ) } );
	add( box( 0.56, 0.54, 0.62 ), { ...white, matrix: mat4( - 1.20, 0.29, 0.30 ) } );
	add( box( 0.50, 0.07, 0.56 ), { ...blue, matrix: mat4( - 1.20, 0.60, 0.30 ) } );
	for ( const x of [ - 0.86, - 0.48, - 0.10 ] ) add( box( 0.26, 0.34, 0.30 ), { ...red, matrix: mat4( x, 0.19, 0.74 ) } );
	return mergePrepared( P );
}

function completeMarthaShop( app ) {
	const chandlery = app.game?.chandlery;
	if ( ! chandlery?.group || app.__marthaCoreCompletion ) return !! app.__marthaCoreCompletion;
	const mesh = new Mesh( buildMarthaCompletionGeometry(), createPropMaterial( 'marthaCoreCompletion' ) );
	mesh.name = 'MarthaTidewaterShopCompletion';
	mesh.castShadow = true;
	mesh.receiveShadow = true;
	chandlery.group.add( mesh );
	app.__marthaCoreCompletion = mesh;
	return true;
}

function buildStreetLampGeometry( lamps ) {
	const P = [];
	const add = ( g, o ) => P.push( prepare( g, o ) );
	for ( const lamp of lamps ) {
		const { x, ground, z } = lamp;
		add( cylinder( 0.055, 0.075, 3.25, 8 ), { color: 0x253238, rough: 0.48, metal: 0.72, matrix: mat4( x, ground + 1.625, z ) } );
		add( box( 0.42, 0.09, 0.18 ), { color: 0x2b373b, rough: 0.42, metal: 0.62, matrix: mat4( x, ground + 3.24, z ) } );
		add( box( 0.28, 0.08, 0.14 ), { color: 0xf2d7a0, rough: 0.24, matrix: mat4( x, ground + 3.18, z + 0.03 ) } );
	}
	return mergePrepared( P );
}

function installCheapStreetLights( app ) {
	if ( ! app.localLights || app.__coreStreetLights ) return !! app.__coreStreetLights;
	const points = [
		[ - 66.0, - 30.5 ],
		[ - 64.0, - 45.8 ],
		[ - 57.0, - 49.7 ],
		[ - 50.3, - 52.8 ],
		[ - 45.8, - 55.0 ],
	];
	const lamps = points.map( ( [ x, z ] ) => {
		const h = Number( app.terrainData?.heightAt?.( x, z ) );
		const ground = Number.isFinite( h ) ? Math.max( 1.0, h ) : 1.0;
		app.localLights.add( {
			position: new Vector3( x, ground + 3.12, z ),
			color: new Color( 1.0, 0.76, 0.48 ),
			intensity: 13.5,
			range: 16,
			kind: 'streetLamp',
			flicker: 0.015,
		} );
		return { x, z, ground };
	} );
	const mesh = new Mesh( buildStreetLampGeometry( lamps ), createPropMaterial( 'coreStreetLamps' ) );
	mesh.name = 'CoreStableStreetLamps';
	mesh.castShadow = false;
	mesh.receiveShadow = true;
	app.scene.add( mesh );
	app.__coreStreetLights = { mesh, count: lamps.length };
	return true;
}

function buildPhysicalJobBoardGeometry() {
	const P = [];
	const add = ( g, o ) => P.push( prepare( g, o ) );
	const wood = { color: 0x5b412c, rough: 0.90 };
	const cork = { color: 0xb78d58, rough: 0.98 };
	const paper = [ 0xf1ead7, 0xdbe9e7, 0xf0df8d, 0xe7c4b5 ];
	for ( const x of [ - 0.76, 0.76 ] ) add( cylinder( 0.07, 0.08, 1.72, 8 ), { ...wood, matrix: mat4( x, 0.86, 0 ) } );
	add( box( 1.82, 1.12, 0.12 ), { ...wood, matrix: mat4( 0, 1.46, 0 ) } );
	add( box( 1.58, 0.88, 0.045 ), { ...cork, matrix: mat4( 0, 1.46, 0.082 ) } );
	add( box( 1.70, 0.24, 0.07 ), { color: 0x274b58, rough: 0.62, matrix: mat4( 0, 2.16, 0.055 ) } );
	let i = 0;
	for ( const y of [ 1.24, 1.62 ] ) for ( const x of [ - 0.48, 0, 0.48 ] ) {
		add( box( 0.38, 0.27, 0.02 ), { color: paper[ i++ % paper.length ], rough: 0.94, matrix: mat4( x, y, 0.118, 0, 0, ( i % 2 ? 0.025 : - 0.02 ) ) } );
	}
	return mergePrepared( P );
}

function patchJobBoard( app ) {
	const jobs = app.harbourJobBoard;
	if ( ! jobs?.board || jobs.__corePolished ) return !! jobs?.__corePolished;
	jobs.__corePolished = true;

	// The board must be a separate world object, not something that appears to belong to Joe.
	const place = () => {
		const joe = jobs.joe?.position;
		if ( joe ) jobs.board.position.set( joe.x + 5.6, joe.y, joe.z + 3.4 );
		else jobs.board.position.set( - 62.4, 1.0, - 17.2 );
		jobs.board.rotation.y = Math.PI * 0.12;
	};
	jobs.placeBoard = place;
	place();

	for ( const child of jobs.board.children ) child.visible = false;
	const physical = new Mesh( buildPhysicalJobBoardGeometry(), createPropMaterial( 'harbourJobsPhysicalBoard' ) );
	physical.name = 'HarbourJobsPhysicalBulletinBoard';
	physical.castShadow = true;
	physical.receiveShadow = true;
	jobs.board.add( physical );
	jobs.__physicalBoard = physical;

	// During FIRST DAY, keep quick-job state in the background instead of stacking a second mission
	// card over the onboarding objective. It returns automatically after FIRST DAY is complete.
	if ( typeof jobs.updateHUD === 'function' ) {
		const baseHud = jobs.updateHUD.bind( jobs );
		jobs.updateHUD = () => {
			baseHud();
			if ( app.progression && ! app.progression.missionDone?.() && jobs.hud ) jobs.hud.style.display = 'none';
		};
	}
	return true;
}

function patchFirstDayParcel( app ) {
	const progression = app.progression;
	const chandlery = app.game?.chandlery;
	if ( ! progression?.parcel || ! chandlery?.group || progression.__parcelCorePolished ) return !! progression?.__parcelCorePolished;
	progression.__parcelCorePolished = true;
	progression.parcel.scale.setScalar( 1.45 );

	progression.updateParcelHome = () => {
		TMP.set( - 0.62, 0.98, 0.10 )
			.applyAxisAngle( Y, chandlery.group.rotation.y )
			.add( chandlery.group.position );
		progression.parcel.position.copy( TMP );
		progression.parcel.rotation.y = chandlery.group.rotation.y;
	};
	progression.updateParcelHome();

	const baseAccept = progression.acceptDelivery.bind( progression );
	progression.acceptDelivery = () => {
		const accepted = baseAccept();
		if ( accepted ) {
			progression.parcel.visible = true;
			progression.game.toast( 'Picked up Martha’s box 📦 · deliver it to Joe at the fish stand.', 3600 );
		}
		return accepted;
	};
	return true;
}

function makeBikeMarker( bike ) {
	if ( bike.__coreMarker ) return bike.__coreMarker;
	const group = new Group();
	group.name = 'StarterBikeMarker';
	const P = [];
	P.push( prepare( torus( 0.31, 0.045, 7, 18 ), { color: 0xf0d24f, rough: 0.42, matrix: mat4( 0, 1.55, 0, Math.PI / 2, 0, 0 ) } ) );
	P.push( prepare( cylinder( 0.045, 0.10, 0.48, 8 ), { color: 0xf0d24f, rough: 0.50, matrix: mat4( 0, 1.16, 0 ) } ) );
	const mesh = new Mesh( mergePrepared( P ), createPropMaterial( 'starterBikeMarker' ) );
	mesh.castShadow = false;
	group.add( mesh );
	bike.group.add( group );
	bike.__coreMarker = group;
	return group;
}

function patchStarterBike( app ) {
	const bike = app.bicycle;
	if ( ! bike || bike.__coreDiscoveryPatched ) return !! bike?.__coreDiscoveryPatched;
	bike.__coreDiscoveryPatched = true;
	const flags = bike.state?.storyFlags || ( bike.state ? ( bike.state.storyFlags = {} ) : {} );
	const discovered = !! flags.starterBikeDiscovered;

	if ( ! discovered ) {
		const start = app.bermudaBlockout?.start;
		if ( start ) {
			bike.group.position.set( start.x + 1.65, bike.group.position.y, start.z - 0.95 );
			bike.yaw = start.yaw;
			bike.group.rotation.y = bike.yaw;
			bike.snapToGround?.();
		}
	}

	const marker = makeBikeMarker( bike );
	marker.visible = ! discovered;
	let hint = null;
	if ( typeof document !== 'undefined' && ! discovered ) {
		hint = document.getElementById( 'bm-bike-hint' ) || document.createElement( 'div' );
		hint.id = 'bm-bike-hint';
		document.body.appendChild( hint );
	}

	const markDiscovered = () => {
		if ( flags.starterBikeDiscovered ) return;
		flags.starterBikeDiscovered = true;
		bike.state?.save?.();
		bike.state?.emit?.();
		marker.visible = false;
		hint?.remove?.();
		hint = null;
	};
	const baseMount = bike.mount.bind( bike );
	bike.mount = () => {
		const mounted = baseMount();
		if ( mounted ) markDiscovered();
		return mounted;
	};

	if ( hint ) {
		const timer = setInterval( () => {
			if ( flags.starterBikeDiscovered || bike.riding || app.player?.mode === 'bike' ) {
				markDiscovered();
				clearInterval( timer );
				return;
			}
			const d = Math.max( 0, Math.round( bike.distanceToPlayer?.() || 0 ) );
			hint.textContent = `🚲 STARTER BIKE · ${ d } m`;
		}, 350 );
		if ( typeof window !== 'undefined' ) window.addEventListener( 'pagehide', () => clearInterval( timer ), { once: true } );
	}
	return true;
}

export function installMobileCorePolish( app ) {
	if ( ! app || app.__mobileCorePolish ) return app?.__mobileCorePolish;
	installMobileHudCss();
	completeMarthaShop( app );
	installCheapStreetLights( app );

	const state = app.__mobileCorePolish = {
		jobBoard: false,
		parcel: false,
		bike: false,
		shop: !! app.__marthaCoreCompletion,
		streetLights: !! app.__coreStreetLights,
	};

	const tryLateSystems = () => {
		state.jobBoard = patchJobBoard( app ) || state.jobBoard;
		state.parcel = patchFirstDayParcel( app ) || state.parcel;
		state.bike = patchStarterBike( app ) || state.bike;
		state.shop = completeMarthaShop( app ) || state.shop;
		state.streetLights = installCheapStreetLights( app ) || state.streetLights;
		return state.jobBoard && state.parcel && state.bike && state.shop && state.streetLights;
	};
	tryLateSystems();
	if ( ! tryLateSystems() && typeof setInterval !== 'undefined' ) {
		let attempts = 0;
		const timer = setInterval( () => {
			attempts ++;
			if ( tryLateSystems() || attempts > 40 ) clearInterval( timer );
		}, 250 );
		if ( typeof window !== 'undefined' ) window.addEventListener( 'pagehide', () => clearInterval( timer ), { once: true } );
	}

	if ( typeof window !== 'undefined' ) window.__mobileCorePolish = state;
	return state;
}
