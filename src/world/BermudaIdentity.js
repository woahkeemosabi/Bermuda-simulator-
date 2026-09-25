import { G } from '../core/Globals.js';
import { TerrainData } from './TerrainData.js';
import { installBermudaBlockout } from './BermudaBlockout.js';

// Bermuda Simulator visual/world identity tuning.
//
// Keep the engine physically based and concentrate Bermuda-specific decisions here so they can
// be iterated without scattering magic numbers through the renderer. v0.1 still uses Tidewater's
// authored coastline topology; the temporary relief adapter below turns its volcanic high island
// into low rolling oceanic terrain until the real Bermuda DEM/bathymetry pipeline replaces it.
export const BERMUDA_LOOK = {
	daylight: {
		timeOfDay: 14.35,
		exposure: 0.62,
	},
	water: {
		// Per-metre Beer-Lambert absorption. Red disappears fastest; low green/blue absorption keeps
		// the sand visible through shallow water and creates Bermuda's aqua-to-blue depth gradient.
		absorption: [ 0.32, 0.048, 0.018 ],
		scattering: [ 0.008, 0.019, 0.024 ],
		backscatter: 0.028,
		sss: 1.08,
		refraction: 0.075,
		roughness: 0.026,
		reflectionStrength: 0.96,
		foamIntensity: 0.82,
		choppiness: 0.76,
		foamBias: 0.54,
		foamGain: 2.45,
		foamAdd: 1.9,
	},
	atmosphere: {
		// Bermuda reads as clear oceanic air rather than heavy tropical haze.
		rayleighScale: 0.96,
		mieScale: 0.72,
		mieG: 0.78,
		ozoneScale: 1.0,
		cloudCoverage: 0.37,
		cloudShadowStrength: 0.72,
	},
	wind: {
		speed: 5.2,
		direction: [ 0.28, 0.96 ],
	},
	terrain: {
		coastalKeepHeight: 4,
		midOriginalHeight: 60,
		midReliefScale: 0.23,
		highReliefScale: 0.12,
		maxHeight: 38,
		highlandRockScale: 0.52,
	},
};

let terrainProfileInstalled = false;

function installBermudaTerrainProfile() {

	if ( terrainProfileInstalled ) return;
	terrainProfileInstalled = true;

	const originalGenerate = TerrainData.prototype.generate;
	if ( typeof originalGenerate !== 'function' ) return;

	TerrainData.prototype.generate = function bermudaGenerate( ...args ) {

		const result = originalGenerate.apply( this, args );
		const T = BERMUDA_LOOK.terrain;
		const heights = this.heights;
		const rock = this.rock;
		const midOut = T.coastalKeepHeight + ( T.midOriginalHeight - T.coastalKeepHeight ) * T.midReliefScale;

		// Preserve the surf zone and the first few metres of shoreline exactly: Tidewater's swash,
		// pier and walking contacts are tuned there. Only the upland relief is compressed.
		for ( let i = 0; i < heights.length; i ++ ) {

			const h = heights[ i ];
			if ( h <= T.coastalKeepHeight ) continue;

			let out;
			if ( h <= T.midOriginalHeight ) out = T.coastalKeepHeight + ( h - T.coastalKeepHeight ) * T.midReliefScale;
			else out = midOut + ( h - T.midOriginalHeight ) * T.highReliefScale;
			heights[ i ] = Math.min( T.maxHeight, out );

			// The source island exposes a lot of volcanic rock on its high flanks. Keep enough variation
			// for limestone/outcrop texture, but stop the uplands reading as a volcanic massif.
			if ( rock ) rock[ i ] *= T.highlandRockScale;

		}

		return result;

	};

}

export function applyBermudaBootLook( app ) {

	const look = BERMUDA_LOOK;
	installBermudaTerrainProfile();

	app.settings.timeOfDay = look.daylight.timeOfDay;
	app.settings.exposure = look.daylight.exposure;

	G.waterAbsorption.value.set( ...look.water.absorption );
	G.waterScattering.value.set( ...look.water.scattering );
	G.windSpeed.value = look.wind.speed;
	G.windDir.value.set( ...look.wind.direction ).normalize();

}

export function applyBermudaRuntimeLook( app ) {

	const look = BERMUDA_LOOK;

	// Re-apply global optical values after initialization in case a subsystem touched defaults.
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
		p.backscatter.value = look.water.backscatter;
		p.sss.value = look.water.sss;
		p.refraction.value = look.water.refraction;
		p.roughness.value = look.water.roughness;
		p.reflectionStrength.value = look.water.reflectionStrength;
		p.foamIntensity.value = look.water.foamIntensity;

	}

	if ( app.fft ) {

		app.fft.choppiness.value = look.water.choppiness;
		app.fft.foamBias.value = look.water.foamBias;
		app.fft.foamGain.value = look.water.foamGain;
		app.fft.foamAdd.value = look.water.foamAdd;

	}

	// Add the cheap first-pass Bermuda harbour scene only after core initialization has completed.
	// The blockout is intentionally texture-free and leaves every gameplay/control system untouched.
	installBermudaBlockout( app );

	// Recompute sun/atmosphere-dependent lighting from the new daytime preset.
	if ( app.updateSun ) app.updateSun();

}
