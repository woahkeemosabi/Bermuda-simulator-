import * as THREE from '../engine/index.js';
import { FishSchools } from '../world/Fish.js';
import { LocalLights } from '../materials/LocalLights.js';
import { WORLD } from '../world/WorldLayout.js';
import { FISH_MARKET } from '../world/bermuda/HarbourLayout.js';

let installed = false;
let pinchGuardInstalled = false;

function isMobileHardware() {
	if ( typeof navigator === 'undefined' ) return false;
	return /iPhone|iPad|iPod|Android/i.test( navigator.userAgent ) ||
		( navigator.maxTouchPoints > 1 && typeof screen !== 'undefined' && Math.min( screen.width, screen.height ) < 1024 );
}

function installPinchGuard() {
	if ( pinchGuardInstalled || typeof document === 'undefined' || typeof window === 'undefined' ) return;
	pinchGuardInstalled = true;

	let viewport = document.querySelector( 'meta[name="viewport"]' );
	if ( ! viewport ) {
		viewport = document.createElement( 'meta' );
		viewport.name = 'viewport';
		document.head.appendChild( viewport );
	}
	viewport.content = 'width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover';

	const stopGesture = ( e ) => e.preventDefault();
	for ( const type of [ 'gesturestart', 'gesturechange', 'gestureend' ] ) {
		document.addEventListener( type, stopGesture, { capture: true, passive: false } );
	}
	document.addEventListener( 'touchmove', ( e ) => {
		if ( e.touches?.length > 1 ) e.preventDefault();
	}, { capture: true, passive: false } );
}

function localToWorld( s, lx, lz, out = new THREE.Vector3() ) {
	const c = Math.cos( s.yaw ), n = Math.sin( s.yaw );
	out.set( s.x + lx * c + lz * n, s.baseY, s.z - lx * n + lz * c );
	return out;
}

export function installMobileUnderwaterQualityBoot() {
	if ( installed || ! isMobileHardware() ) return;
	installed = true;
	installPinchGuard();

	const originalLayout = FishSchools.prototype.layout;
	FishSchools.prototype.layout = function bermudaMobileFishLayout( bay ) {
		originalLayout.call( this, bay );
		const D = WORLD.boatDock.position;
		const R = WORLD.reef.center;

		// The opening Bermuda swim area beside the starter dock is commonly only ~1.6–1.9 m deep.
		// Keep obvious life close to shore, then create an overlapping habitat belt all the way from
		// the harbour to the reef. Fish remain in Tidewater's single batched renderer; only groups near
		// the camera are simulated, so this restores marine density without adding GLBs or render passes.
		this.addGroup( 'mullet', 10, {
			x: D.x + 1.5, z: D.z + 5.5, r: 11, band: [ 1.25, 4.5 ],
		} );
		this.addGroup( 'grunt', 12, {
			x: D.x - 2.0, z: D.z + 7.5, r: 10, band: [ 1.35, 6.0 ],
		} );
		this.addGroup( 'silverside', 34, {
			x: D.x + 3.5, z: D.z + 9.0, r: 13, band: [ 1.25, 6.0 ],
		} );

		const alongRoute = ( t ) => ( {
			x: D.x + ( R.x - D.x ) * t,
			z: D.z + ( R.z - D.z ) * t,
		} );

		const findWet = ( target, minDepth = 2.3, maxDepth = 18 ) => {
			for ( const rr of [ 0, 5, 10, 15, 20, 26, 32 ] ) {
				const steps = rr === 0 ? 1 : 16;
				for ( let i = 0; i < steps; i ++ ) {
					const a = steps === 1 ? 0 : i / steps * Math.PI * 2;
					const x = target.x + Math.cos( a ) * rr;
					const z = target.z + Math.sin( a ) * rr;
					const depth = this.depthAt( x, z );
					if ( depth < minDepth || depth > maxDepth ) continue;
					if ( depth < this.breakDepth( x, z ) + 0.25 ) continue;
					return { x, z, depth };
				}
			}
			return null;
		};

		const addHabitatNode = ( t ) => {
			const wet = findWet( alongRoute( t ) );
			if ( ! wet ) return;
			const shallowBand = [ Math.max( 2.0, Math.min( wet.depth - 0.5, 4.0 ) ), Math.max( 6, wet.depth + 3 ) ];
			this.addGroup( 'yellowtail', 10, { x: wet.x, z: wet.z, r: 15, band: [ 2.3, 14 ] } );
			this.addGroup( 'parrot', 6, { x: wet.x + 4, z: wet.z - 3, r: 13, band: [ 2.0, 12 ] } );
			this.addGroup( 'grunt', 8, { x: wet.x - 4, z: wet.z + 3, r: 12, band: shallowBand } );
			if ( wet.depth >= 4 ) this.addGroup( 'tarpon', 5, { x: wet.x + 2, z: wet.z + 1, r: 18, band: [ 3.8, 16 ] } );
			if ( wet.depth >= 5 ) {
				this.addGroup( 'jack', 6, { x: wet.x - 2, z: wet.z - 2, r: 18, band: [ 4.5, 20 ] } );
				this.addGroup( 'grouper', 2, { x: wet.x + 6, z: wet.z + 4, r: 8, band: [ 4.5, 16 ] } );
			}
		};

		// The nodes are deliberately closer together than the 45 m fish draw distance. A diver moving
		// normally from the starter dock through the reef should therefore always have visible life in
		// front/side view rather than swimming through long empty gaps.
		for ( const t of [ 0.14, 0.27, 0.40, 0.53, 0.66, 0.79, 0.92, 1.04, 1.14 ] ) addHabitatNode( t );

		// Larger silhouettes around the outer reef make the spearfishing area read as open water.
		for ( const t of [ 0.74, 0.90, 1.06 ] ) {
			const wet = findWet( alongRoute( t ), 5, 20 );
			if ( ! wet ) continue;
			this.addGroup( 'tarpon', 7, { x: wet.x, z: wet.z, r: 22, band: [ 5, 16 ] } );
			this.addGroup( 'jack', 8, { x: wet.x + 5, z: wet.z - 4, r: 22, band: [ 5, 20 ] } );
			this.addGroup( 'barracuda', 2, { x: wet.x - 6, z: wet.z + 4, r: 16, band: [ 5, 18 ] } );
		}
	};

	const originalLightsUpdate = LocalLights.prototype.update;
	LocalLights.prototype.update = function bermudaMobileDiveLightUpdate( camera, dt ) {
		const fl = this.flashlight;
		const underwater = !! camera && camera.position.y < -0.12;
		if ( ! underwater || ! fl ) return originalLightsUpdate.call( this, camera, dt );

		const saved = {
			intensity: fl.intensity,
			range: fl.range,
			color: fl.color.clone(),
			cosInner: fl.cosInner,
			cosOuter: fl.cosOuter,
		};
		fl.intensity = 14;
		fl.range = 19;
		fl.color.setRGB( 0.76, 0.90, 1.0 );
		fl.cosInner = Math.cos( THREE.MathUtils.degToRad( 10 ) );
		fl.cosOuter = Math.cos( THREE.MathUtils.degToRad( 28 ) );
		try {
			return originalLightsUpdate.call( this, camera, dt );
		} finally {
			fl.intensity = saved.intensity;
			fl.range = saved.range;
			fl.color.copy( saved.color );
			fl.cosInner = saved.cosInner;
			fl.cosOuter = saved.cosOuter;
		}
	};

	if ( typeof window !== 'undefined' ) window.__bermudaMobileUnderwaterBoot = {
		fish: 'bermuda-continuous-life-belt-v3',
		torch: 'soft-dive-light-v1',
		pinchGuard: true,
	};
}

function clearJoeSightline( app ) {
	const vendor = app.game?.stand?.vendor;
	if ( ! vendor ) return false;
	// Joe must remain behind the Tidewater counter, but the old centre placement intersects a nearby
	// decorative shade from the mobile waterfront composition. Put him near the open end of the
	// counter and keep this as the final mobile placement after the older dock polish settles.
	const p = localToWorld( FISH_MARKET, 0.96, 0.30 );
	p.y += 0.06;
	vendor.position.copy( p );
	vendor.group.position.copy( p );
	vendor.radius = 3.0;
	vendor.__mobileFaceClear = true;
	vendor.__bermudaDockRelocated = true;
	return true;
}

function repairStreetLights( app ) {
	const state = app.__mobileReferenceStreetLights;
	if ( ! state?.lamps?.length || ! app.terrainData ) return false;
	const dry = [
		[ -96, -52.2 ], [ -84, -52.5 ], [ -72, -52.4 ], [ -60, -52.6 ],
		[ -48, -52.4 ], [ -36, -52.5 ], [ -24, -52.3 ],
	];
	const sources = ( app.localLights?.sources || [] ).filter( ( s ) => s.kind === 'bermudaStreetLamp' );
	const [ poles, heads, bulbs ] = state.meshes || [];
	const matrix = new THREE.Matrix4();
	const set = ( mesh, i, x, y, z, sx, sy, sz ) => {
		if ( ! mesh ) return;
		matrix.makeScale( sx, sy, sz );
		matrix.setPosition( x, y, z );
		mesh.setMatrixAt( i, matrix );
	};

	for ( let i = 0; i < state.lamps.length; i ++ ) {
		const [ x, z ] = dry[ i % dry.length ];
		const h = Number( app.terrainData.heightAt( x, z ) );
		const ground = Number.isFinite( h ) ? Math.max( 1.48, h ) : 1.48;
		const lamp = state.lamps[ i ];
		lamp.x = x; lamp.z = z; lamp.ground = ground;
		if ( sources[ i ]?.position ) sources[ i ].position.set( x, ground + 3.15, z );
		set( poles, i, x, ground + 1.62, z, 0.07, 3.24, 0.07 );
		set( heads, i, x, ground + 3.24, z, 0.46, 0.11, 0.22 );
		set( bulbs, i, x, ground + 3.16, z + 0.05, 0.30, 0.07, 0.16 );
	}
	for ( const mesh of [ poles, heads, bulbs ] ) {
		if ( mesh?.instanceMatrix ) mesh.instanceMatrix.needsUpdate = true;
		mesh?.computeBoundingSphere?.();
	}

	const pools = app.__mobilePersistentLampGlow?.pools;
	if ( pools ) {
		for ( let i = 0; i < state.lamps.length; i ++ ) {
			const l = state.lamps[ i ];
			matrix.makeScale( 3.5, 1, 3.5 );
			matrix.setPosition( l.x, l.ground + 0.035, l.z );
			pools.setMatrixAt( i, matrix );
		}
		pools.instanceMatrix.needsUpdate = true;
		pools.computeBoundingSphere?.();
	}
	state.relocatedToDryRoad = true;
	return true;
}

function repairJobBoard( app ) {
	const board = app.harbourJobBoard?.board;
	if ( ! board ) return false;
	// The generated board panel is 1.55 x .09 x 1.05, so it is born horizontal. Rotate it upright,
	// then face the sign toward the dock walking corridor / player approach instead of showing its edge.
	board.rotation.x = Math.PI / 2;
	const targetX = -65.0, targetZ = -25.5;
	board.rotation.y = Math.atan2( targetX - board.position.x, targetZ - board.position.z );
	board.__bermudaBoardFacingFixed = true;
	return true;
}

function installObjectiveMinimizer() {
	if ( typeof document === 'undefined' || document.getElementById( 'bm-objective-minimize-style' ) ) return;
	const style = document.createElement( 'style' );
	style.id = 'bm-objective-minimize-style';
	style.textContent = `
		#bm-objective{transition:opacity .32s ease,transform .32s ease,max-width .32s ease,padding .32s ease!important}
		#bm-objective.bm-next-minimized{opacity:.52!important;max-width:min(255px,calc(100vw - 28px))!important;padding:5px 8px!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;transform:scale(.94);transform-origin:left top}
		#bm-objective.bm-next-minimized .bm-objective-kicker{display:none!important}
	`;
	document.head.appendChild( style );

	let lastText = '';
	let minimizeTimer = 0;
	const sync = () => {
		const el = document.getElementById( 'bm-objective' );
		if ( ! el ) return false;
		const text = String( el.textContent || '' ).trim();
		const next = /NEXT OPPORTUNITY/i.test( text );
		if ( text !== lastText ) {
			lastText = text;
			el.classList.remove( 'bm-next-minimized' );
			if ( minimizeTimer ) clearTimeout( minimizeTimer );
			if ( next ) minimizeTimer = setTimeout( () => el.classList.add( 'bm-next-minimized' ), 6500 );
		} else if ( ! next ) el.classList.remove( 'bm-next-minimized' );
		return true;
	};
	const timer = setInterval( sync, 250 );
	sync();
	if ( typeof window !== 'undefined' ) window.addEventListener( 'pagehide', () => {
		clearInterval( timer );
		if ( minimizeTimer ) clearTimeout( minimizeTimer );
	}, { once: true } );
}

function retirePrototypeHouseCorridor( app ) {
	const corridor = app.mobileReferenceCorridor;
	if ( ! corridor?.root ) return false;
	// These six box-built cottages were a temporary reference-density layer. They now visibly overlap
	// the authored Bermuda houses and are the tightly packed pastel row seen in phone QA. The proper
	// ReferenceWorldUpgrade + streamed house GLBs remain active underneath, so retire only this layer.
	corridor.root.visible = false;
	corridor.disabledByQA = true;
	return true;
}

function installRuntimeRepairs( app ) {
	installObjectiveMinimizer();
	retirePrototypeHouseCorridor( app );
	repairStreetLights( app );
	repairJobBoard( app );
	clearJoeSightline( app );

	// A few older modules perform delayed placement during startup. Reassert the final canonical mobile
	// fixes briefly so initialization order cannot put Joe/the board back into the bad positions.
	if ( typeof window !== 'undefined' ) {
		let ticks = 0;
		const timer = window.setInterval( () => {
			clearJoeSightline( app );
			repairJobBoard( app );
			repairStreetLights( app );
			retirePrototypeHouseCorridor( app );
			if ( ++ticks >= 32 ) window.clearInterval( timer );
		}, 250 );
		window.addEventListener( 'pagehide', () => window.clearInterval( timer ), { once: true } );
	}
}

export function applyMobileUnderwaterQualityRuntime( app ) {
	if ( ! isMobileHardware() || ! app ) return;

	if ( app.underwater?.torchBeam ) app.underwater.torchBeam.value = 0.85;
	if ( app.underwater?.shafts && ! app.caustics ) app.underwater.shafts.value = 0;
	installRuntimeRepairs( app );

	const state = {
		installed: true,
		torchBeam: app.underwater?.torchBeam?.value ?? null,
		fishCount: app.reef?.fish?.fishCount ?? null,
		fishLayout: 'continuous-life-belt-v3',
		pinchGuard: true,
		prototypeCorridorHidden: !! app.mobileReferenceCorridor?.disabledByQA,
	};
	app.mobileUnderwaterQuality = state;
	if ( typeof window !== 'undefined' ) window.__bermudaMobileUnderwater = state;
	return state;
}
