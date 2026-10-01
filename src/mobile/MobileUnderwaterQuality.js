import * as THREE from '../engine/index.js';
import { FishSchools } from '../world/Fish.js';
import { LocalLights } from '../materials/LocalLights.js';
import { WORLD } from '../world/WorldLayout.js';

let installed = false;

function isMobileHardware() {
	if ( typeof navigator === 'undefined' ) return false;
	return /iPhone|iPad|iPod|Android/i.test( navigator.userAgent ) ||
		( navigator.maxTouchPoints > 1 && typeof screen !== 'undefined' && Math.min( screen.width, screen.height ) < 1024 );
}

export function installMobileUnderwaterQualityBoot() {
	if ( installed || ! isMobileHardware() ) return;
	installed = true;

	const originalLayout = FishSchools.prototype.layout;
	FishSchools.prototype.layout = function bermudaMobileFishLayout( bay ) {
		originalLayout.call( this, bay );
		const D = WORLD.boatDock.position;
		const R = WORLD.reef.center;

		// The opening Bermuda swim area beside the starter dock is commonly only ~1.6–1.9 m deep.
		// The legacy Tidewater schools were authored around the old east-side bay, so after Bermuda's
		// dock/reef moved west only the near-shore mullets were reliably visible. Keep the shallow life,
		// then repopulate the actual Bermuda dock -> reef -> outer-reef route with the existing batched
		// procedural fish. This adds no textures, GLBs or extra render passes.
		this.addGroup( 'mullet', 8, {
			x: D.x + 1.5, z: D.z + 5.5, r: 11, band: [ 1.35, 4.5 ],
		} );
		this.addGroup( 'grunt', 10, {
			x: D.x - 2.0, z: D.z + 7.5, r: 10, band: [ 1.45, 6.0 ],
		} );
		this.addGroup( 'silverside', 28, {
			x: D.x + 3.5, z: D.z + 9.0, r: 13, band: [ 1.35, 6.0 ],
		} );

		const alongRoute = ( t ) => ( {
			x: D.x + ( R.x - D.x ) * t,
			z: D.z + ( R.z - D.z ) * t,
		} );
		const addRouteSchool = ( name, count, t, band, radius = 18 ) => {
			const target = alongRoute( t );
			let chosen = null;
			// Deterministically search around each route marker for water in the species' depth band.
			// That avoids parking a school on a sandbar while keeping the population stable per save.
			for ( const rr of [ 0, 6, 12, 18, 24, 30 ] ) {
				const steps = rr === 0 ? 1 : 12;
				for ( let i = 0; i < steps; i ++ ) {
					const a = steps === 1 ? 0 : i / steps * Math.PI * 2;
					const x = target.x + Math.cos( a ) * rr;
					const z = target.z + Math.sin( a ) * rr;
					const depth = this.depthAt( x, z );
					if ( depth < band[ 0 ] || depth > band[ 1 ] ) continue;
					if ( depth < this.breakDepth( x, z ) + 0.35 ) continue;
					chosen = { x, z };
					break;
				}
				if ( chosen ) break;
			}
			if ( chosen ) this.addGroup( name, count, { x: chosen.x, z: chosen.z, r: radius, band } );
		};

		// Mid-harbour / reef approach: large silhouettes should be visible while diving in 5–14 m.
		addRouteSchool( 'tarpon', 7, 0.42, [ 5, 14 ], 22 );
		addRouteSchool( 'jack', 9, 0.56, [ 5, 18 ], 22 );
		addRouteSchool( 'yellowtail', 14, 0.68, [ 3.5, 14 ], 18 );

		// Reef edge and just beyond it: keep larger fish present after the player leaves the harbour.
		addRouteSchool( 'tarpon', 6, 0.82, [ 5, 16 ], 24 );
		addRouteSchool( 'jack', 8, 0.96, [ 6, 20 ], 24 );
		addRouteSchool( 'barracuda', 2, 1.08, [ 5, 18 ], 18 );
		addRouteSchool( 'tarpon', 5, 1.14, [ 5, 16 ], 24 );
	};

	const originalLightsUpdate = LocalLights.prototype.update;
	LocalLights.prototype.update = function bermudaMobileDiveLightUpdate( camera, dt ) {
		const fl = this.flashlight;
		const underwater = !! camera && camera.position.y < -0.12;
		if ( ! underwater || ! fl ) return originalLightsUpdate.call( this, camera, dt );

		// Desktop's 55-unit / 30 m torch is far too hot at phone exposure in 1–3 m water. Use a cooler,
		// softer dive beam underwater only; above-water flashlight behaviour remains unchanged.
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
		fish: 'bermuda-route-schools-v2',
		torch: 'soft-dive-light-v1',
	};
}

export function applyMobileUnderwaterQualityRuntime( app ) {
	if ( ! isMobileHardware() || ! app ) return;

	// The underwater post pass separately ray-marches torch in-scatter. Reducing this removes the
	// opaque white cone while keeping direct illumination on fish and the seabed.
	if ( app.underwater?.torchBeam ) app.underwater.torchBeam.value = 0.85;
	if ( app.underwater?.shafts && ! app.caustics ) app.underwater.shafts.value = 0;

	const state = {
		installed: true,
		torchBeam: app.underwater?.torchBeam?.value ?? null,
		fishCount: app.reef?.fish?.fishCount ?? null,
	};
	app.mobileUnderwaterQuality = state;
	if ( typeof window !== 'undefined' ) window.__bermudaMobileUnderwater = state;
	return state;
}
