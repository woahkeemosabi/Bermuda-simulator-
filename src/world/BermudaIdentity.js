import { G } from '../core/Globals.js';
import { TerrainData } from './TerrainData.js';
import { installBermudaBlockout } from './BermudaBlockout.js';
import { installBermudaModels } from './BermudaModels.js';
import { Whale } from './marine/Whale.js';

export const BERMUDA_LOOK = {
	daylight: { timeOfDay: 14.35, exposure: 0.62 },
	water: {
		absorption: [ 0.32, 0.048, 0.018 ], scattering: [ 0.008, 0.019, 0.024 ],
		backscatter: 0.028, sss: 1.08, refraction: 0.075, roughness: 0.026,
		reflectionStrength: 0.96, foamIntensity: 0.82, choppiness: 0.76,
		foamBias: 0.54, foamGain: 2.45, foamAdd: 1.9,
	},
	atmosphere: { rayleighScale: 0.96, mieScale: 0.72, mieG: 0.78, ozoneScale: 1.0, cloudCoverage: 0.37, cloudShadowStrength: 0.72 },
	wind: { speed: 5.2, direction: [ 0.28, 0.96 ] },
	terrain: { coastalKeepHeight: 4, midOriginalHeight: 60, midReliefScale: 0.23, highReliefScale: 0.12, maxHeight: 38, highlandRockScale: 0.52 },
};

let terrainProfileInstalled = false;
let mobileWhaleBypassInstalled = false;

function installBermudaTerrainProfile() {
	if ( terrainProfileInstalled ) return;
	terrainProfileInstalled = true;
	const originalGenerate = TerrainData.prototype.generate;
	if ( typeof originalGenerate !== 'function' ) return;
	TerrainData.prototype.generate = function bermudaGenerate( ...args ) {
		const result = originalGenerate.apply( this, args );
		const T = BERMUDA_LOOK.terrain, heights = this.heights, rock = this.rock;
		const midOut = T.coastalKeepHeight + ( T.midOriginalHeight - T.coastalKeepHeight ) * T.midReliefScale;
		for ( let i = 0; i < heights.length; i ++ ) {
			const h = heights[ i ];
			if ( h <= T.coastalKeepHeight ) continue;
			let out;
			if ( h <= T.midOriginalHeight ) out = T.coastalKeepHeight + ( h - T.coastalKeepHeight ) * T.midReliefScale;
			else out = midOut + ( h - T.midOriginalHeight ) * T.highReliefScale;
			heights[ i ] = Math.min( T.maxHeight, out );
			if ( rock ) rock[ i ] *= T.highlandRockScale;
		}
		return result;
	};
}

function installMobileWhaleBypass() {
	if ( mobileWhaleBypassInstalled || typeof navigator === 'undefined' || typeof location === 'undefined' ) return;
	const params = new URLSearchParams( location.search );
	const mobile = ( /iPhone|iPad|iPod|Android/i.test( navigator.userAgent ) || ( navigator.maxTouchPoints > 1 && Math.min( screen.width, screen.height ) < 1024 ) ) && ! params.has( 'desktop' );
	if ( ! mobile ) return;
	mobileWhaleBypassInstalled = true;
	Whale.prototype.load = async function bermudaMobileWhaleLoad() {
		this.ready = false;
		if ( this.group ) this.group.visible = false;
	};
}

export function applyBermudaBootLook( app ) {
	const look = BERMUDA_LOOK;
	installBermudaTerrainProfile();
	installMobileWhaleBypass();
	app.settings.timeOfDay = look.daylight.timeOfDay;
	app.settings.exposure = look.daylight.exposure;
	G.waterAbsorption.value.set( ...look.water.absorption );
	G.waterScattering.value.set( ...look.water.scattering );
	G.windSpeed.value = look.wind.speed;
	G.windDir.value.set( ...look.wind.direction ).normalize();
}

export function applyBermudaRuntimeLook( app ) {
	const look = BERMUDA_LOOK;
	G.waterAbsorption.value.set( ...look.water.absorption );
	G.waterScattering.value.set( ...look.water.scattering );
	G.windSpeed.value = look.wind.speed;
	G.windDir.value.set( ...look.wind.direction ).normalize();

	if ( app.atmosphere ) {
		app.atmosphere.rayleighScale.value = look.atmosphere.rayleighScale;
		app.atmosphere.mieScale.value = look.atmosphere.mieScale;
		app.atmosphere.mieG.value = look.atmosphere.mieG;
		app.atmosphere.ozoneScale.value = look.atmosphere.ozoneScale;
		app.atmosphere.invalidate();
	}
	if ( app.clouds ) {
		app.clouds.coverage.value = look.atmosphere.cloudCoverage;
		if ( app.clouds.shadowStrength ) app.clouds.shadowStrength.value = look.atmosphere.cloudShadowStrength;
		if ( app.clouds.invalidate ) app.clouds.invalidate();
	}
	if ( app.waterMaterial && app.waterMaterial.params ) {
		const p = app.waterMaterial.params;
		p.backscatter.value = look.water.backscatter; p.sss.value = look.water.sss;
		p.refraction.value = look.water.refraction; p.roughness.value = look.water.roughness;
		p.reflectionStrength.value = look.water.reflectionStrength; p.foamIntensity.value = look.water.foamIntensity;
	}
	if ( app.fft ) {
		app.fft.choppiness.value = look.water.choppiness; app.fft.foamBias.value = look.water.foamBias;
		app.fft.foamGain.value = look.water.foamGain; app.fft.foamAdd.value = look.water.foamAdd;
	}

	// Preserve the known-good collision/start layout, then replace its primitive visual shell with
	// the optimized Meshy reference assets as soon as they finish loading.
	installBermudaBlockout( app );
	void installBermudaModels( app );

	if ( app.updateSun ) app.updateSun();
}
