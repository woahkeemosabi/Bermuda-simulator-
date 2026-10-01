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

		// The opening Bermuda swim area beside the starter dock is commonly only ~1.6–1.9 m deep.
		// The existing dock population starts at 2 m, so placement can fail and leave the first dive
		// empty. Add three modest shallow-water schools using the existing batched procedural fish.
		this.addGroup( 'mullet', 8, {
			x: D.x + 1.5, z: D.z + 5.5, r: 11, band: [ 1.35, 4.5 ],
		} );
		this.addGroup( 'grunt', 10, {
			x: D.x - 2.0, z: D.z + 7.5, r: 10, band: [ 1.45, 6.0 ],
		} );
		this.addGroup( 'silverside', 28, {
			x: D.x + 3.5, z: D.z + 9.0, r: 13, band: [ 1.35, 6.0 ],
		} );
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
		fish: 'harbour-schools-v1',
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
