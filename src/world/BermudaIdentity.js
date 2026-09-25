import { G } from '../core/Globals.js';

// Bermuda Simulator visual identity tuning.
//
// Keep the engine physically based and concentrate Bermuda-specific look decisions here so
// they can be iterated without scattering magic numbers through the renderer. These values are
// deliberately a restrained first pass: clear Atlantic air, bright shallow-water transmission,
// less open-ocean whitecap clutter, and a calmer harbour presentation.
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
		// Bermuda often reads as exceptionally clear oceanic air rather than humid tropical haze.
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
};

export function applyBermudaBootLook( app ) {

	const look = BERMUDA_LOOK;
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

	// Recompute sun/atmosphere-dependent lighting from the new daytime preset.
	if ( app.updateSun ) app.updateSun();

}
