import { CylinderGeometry, Group, Mesh, Vector3 } from '../engine/index.js';
import { Material } from '../engine/render/Material.js';
import { Bicycle } from '../player/Bicycle.js';

const INTRO_START = Object.freeze( { x: -96.0, z: -53.25, yaw: -Math.PI / 2 } );
const BIKE_START = Object.freeze( { x: -92.4, z: -49.2, yaw: -Math.PI / 2 } );
const DOCK_TARGET = Object.freeze( { x: -65.0, z: -30.5 } );
const DOCK_RADIUS = 9.5;

function groundY( app, x, z, fallback = 1.5 ) {
	let y = Number( app.terrainData?.heightAt?.( x, z ) );
	if ( ! Number.isFinite( y ) ) y = fallback;
	const colliderY = Number( app.colliders?.groundHeightAt?.( x, z, 50 ) );
	if ( Number.isFinite( colliderY ) ) y = Math.max( y, colliderY );
	return y + 0.02;
}

function pristineFirstStart( state ) {
	if ( ! state?.vehicles?.bicycle?.owned ) return false;
	if ( state.storyFlags?.starterBikeIntroComplete ) return false;
	const missions = state.missions || {};
	const available = Array.isArray( missions.available ) ? missions.available : [];
	const active = Array.isArray( missions.active ) ? missions.active : [];
	const completed = Array.isArray( missions.completed ) ? missions.completed : [];
	return available.includes( 'martha-first-delivery' ) &&
		active.length === 0 && completed.length === 0 &&
		! state.storyFlags?.metMartha && ! state.storyFlags?.metJoe &&
		! state.vehicles.bicycle.parked &&
		( ! Array.isArray( state.inventory ) || state.inventory.length === 0 );
}

function makeArrow( name, color, emissive ) {
	const root = new Group();
	root.name = name;
	const material = new Material( {
		name: `${ name }-material`, color, emissive, roughness: 0.24, metalness: 0.04,
		underwaterLighting: 'none', localLightsCheap: true, receiveShadows: false,
	} );
	const shaft = new Mesh( new CylinderGeometry( 0.055, 0.055, 0.62, 8 ), material );
	shaft.position.y = 0.30;
	shaft.castShadow = false;
	root.add( shaft );
	const head = new Mesh( new CylinderGeometry( 0.20, 0.0, 0.38, 8 ), material );
	head.position.y = -0.18;
	head.castShadow = false;
	root.add( head );
	return root;
}

function ensureIntroStyle() {
	if ( typeof document === 'undefined' || document.getElementById( 'bm-starter-bike-intro-style' ) ) return;
	const style = document.createElement( 'style' );
	style.id = 'bm-starter-bike-intro-style';
	style.textContent = `
		body.bm-starter-bike-intro #bm-objective,
		body.bm-starter-bike-intro #bm-mini-job{display:none!important}
		#bm-starter-bike-intro{position:fixed;left:14px;right:14px;top:max(154px,calc(env(safe-area-inset-top) + 144px));z-index:78;max-width:430px;box-sizing:border-box;padding:10px 12px;border-radius:13px;background:rgba(5,22,31,.86);border:1px solid rgba(116,241,226,.38);box-shadow:0 12px 32px rgba(0,0,0,.28);backdrop-filter:blur(9px);-webkit-backdrop-filter:blur(9px);color:#efffff;font:600 12px/1.38 system-ui,-apple-system,sans-serif;pointer-events:none}
		#bm-starter-bike-intro .bm-intro-kicker{display:block;margin-bottom:3px;color:#7ce9de;font-size:9px;font-weight:850;letter-spacing:.16em;text-transform:uppercase}
		#bm-starter-bike-intro strong{display:block;margin-bottom:2px;font-size:14px;letter-spacing:.01em}
		#bm-starter-bike-intro .bm-intro-detail{color:rgba(235,255,255,.82);font-weight:560}
		@media(min-width:720px){#bm-starter-bike-intro{right:auto;width:390px}}
	`;
	document.head.appendChild( style );
}

function makeIntroCard() {
	if ( typeof document === 'undefined' ) return null;
	ensureIntroStyle();
	let el = document.getElementById( 'bm-starter-bike-intro' );
	if ( ! el ) {
		el = document.createElement( 'div' );
		el.id = 'bm-starter-bike-intro';
		el.setAttribute( 'aria-live', 'polite' );
		document.body.appendChild( el );
	}
	return el;
}

function setPlayerAtIntroStart( app ) {
	const p = app.player;
	if ( ! p ) return;
	p.mode = 'walk';
	p.position.set( INTRO_START.x, groundY( app, INTRO_START.x, INTRO_START.z ), INTRO_START.z );
	p.velocity?.set?.( 0, 0, 0 );
	p.yaw = INTRO_START.yaw;
	p.pitch = -0.035;
	p.grounded = true;
	p.waterMean = null;
	p.waterH = 0;
	p.camInit = false;
}

function placeBikeForIntro( app, bike ) {
	bike.riding = false;
	bike.speed = 0;
	bike.yaw = BIKE_START.yaw;
	bike.group.position.set( BIKE_START.x, groundY( app, BIKE_START.x, BIKE_START.z ), BIKE_START.z );
	bike.group.rotation.y = bike.yaw;
	bike.snapToGround?.();
}

export function installStarterBikeIntro( app ) {
	if ( ! app || app.__starterBikeIntro ) return app?.__starterBikeIntro;
	const state = app.game?.state;
	if ( ! pristineFirstStart( state ) ) {
		app.__starterBikeIntro = { active: false, skipped: true };
		return app.__starterBikeIntro;
	}

	const bike = app.bicycle || new Bicycle( app );
	placeBikeForIntro( app, bike );
	setPlayerAtIntroStart( app );

	const bikeArrow = makeArrow( 'StarterBikeIntroArrow', 0x6ff3e6, 0x2fcbbb );
	bikeArrow.position.set( 0, 2.12, 0 );
	bike.group.add( bikeArrow );

	const dockArrow = makeArrow( 'StarterDockIntroArrow', 0xf0d26b, 0xb58328 );
	dockArrow.position.set( DOCK_TARGET.x, groundY( app, DOCK_TARGET.x, DOCK_TARGET.z ) + 3.2, DOCK_TARGET.z );
	dockArrow.visible = false;
	app.scene.add( dockArrow );

	const card = makeIntroCard();
	if ( typeof document !== 'undefined' ) document.body.classList.add( 'bm-starter-bike-intro' );

	let mountedOnce = false;
	let complete = false;
	let raf = 0;
	let lastHudUpdate = 0;
	const baseMount = bike.mount.bind( bike );
	bike.mount = () => {
		const mounted = baseMount();
		if ( mounted ) {
			mountedOnce = true;
			bikeArrow.visible = false;
			dockArrow.visible = true;
			if ( state.storyFlags ) state.storyFlags.starterBikeDiscovered = true;
			state.save?.();
			state.emit?.();
		}
		return mounted;
	};

	const finish = () => {
		if ( complete ) return;
		complete = true;
		state.storyFlags = state.storyFlags || {};
		state.storyFlags.starterBikeIntroComplete = true;
		state.storyFlags.starterBikeDiscovered = true;
		state.save?.();
		state.emit?.();
		bikeArrow.parent?.remove?.( bikeArrow );
		dockArrow.parent?.remove?.( dockArrow );
		card?.remove?.();
		if ( typeof document !== 'undefined' ) document.body.classList.remove( 'bm-starter-bike-intro' );
		app.game?.toast?.( 'Harbour reached · find Martha at Bait & Tackle to begin FIRST DAY.', 3800 );
	};

	const updateCard = () => {
		if ( ! card || complete ) return;
		if ( ! mountedOnce ) {
			const d = Math.max( 0, Math.round( bike.distanceToPlayer?.() || 0 ) );
			card.innerHTML = `<span class="bm-intro-kicker">START HERE</span><strong>Find your bicycle · ${ d } m</strong><span class="bm-intro-detail">Follow the glowing arrow and press ACT beside the bike to ride.</span>`;
			return;
		}
		const b = bike.group.position;
		const d = Math.max( 0, Math.round( Math.hypot( b.x - DOCK_TARGET.x, b.z - DOCK_TARGET.z ) ) );
		card.innerHTML = `<span class="bm-intro-kicker">FIRST RIDE</span><strong>Ride to the harbour · ${ d } m</strong><span class="bm-intro-detail">Follow the road to the dock. FIRST DAY begins when you arrive.</span>`;
	};

	const tick = ( now ) => {
		if ( complete ) return;
		const t = now * 0.001;
		bikeArrow.position.y = 2.12 + Math.sin( t * 3.0 ) * 0.12;
		bikeArrow.rotation.y = t * 1.15;
		dockArrow.position.y = groundY( app, DOCK_TARGET.x, DOCK_TARGET.z ) + 3.2 + Math.sin( t * 2.5 ) * 0.14;
		dockArrow.rotation.y = -t * 0.9;
		if ( now - lastHudUpdate > 220 ) { lastHudUpdate = now; updateCard(); }

		if ( mountedOnce ) {
			const b = bike.group.position;
			if ( Math.hypot( b.x - DOCK_TARGET.x, b.z - DOCK_TARGET.z ) <= DOCK_RADIUS ) finish();
		}
		if ( ! complete && typeof requestAnimationFrame !== 'undefined' ) raf = requestAnimationFrame( tick );
	};
	updateCard();
	if ( typeof requestAnimationFrame !== 'undefined' ) raf = requestAnimationFrame( tick );
	if ( typeof window !== 'undefined' ) window.addEventListener( 'pagehide', () => raf && cancelAnimationFrame( raf ), { once: true } );

	const intro = app.__starterBikeIntro = {
		active: true,
		bike,
		bikeArrow,
		dockArrow,
		get mountedOnce() { return mountedOnce; },
		get complete() { return complete; },
		finish,
	};
	if ( typeof window !== 'undefined' ) window.__starterBikeIntro = intro;
	return intro;
}
