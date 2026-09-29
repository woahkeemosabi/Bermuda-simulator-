import { G } from '../core/Globals.js';
import { TerrainData } from './TerrainData.js';
import { installBermudaBlockout } from './BermudaBlockout.js';
import { installBermudaModels } from './BermudaModels.js';
import { installReferenceWorldUpgrade } from './ReferenceWorldUpgrade.js';
import { installReferenceDetailUpgrade } from './ReferenceDetailUpgrade.js';
import { installReferenceStreetLife } from './ReferenceStreetLife.js';
import { installRelic001 } from './Relic001.js';
import { installRelicStory } from './RelicStory.js';
import { installBermudaGameplayQA } from '../game/BermudaGameplayQA.js';
import { Whale } from './marine/Whale.js';

export const BERMUDA_LOOK = {
	// High-clarity Bermuda afternoon: bright enough to separate pastel walls, white roofs and foliage
	// without flattening the scene. The 54-second gameplay reference is the visual benchmark.
	daylight: { timeOfDay: 14.55, exposure: 0.72 },
	water: {
		// Harbour water should be calm, transparent and strongly depth-coded: pale aqua over sand,
		// saturated turquoise over the first few metres, then clean Atlantic blue in the channel.
		absorption: [ 0.235, 0.033, 0.012 ], scattering: [ 0.006, 0.022, 0.028 ],
		backscatter: 0.019, sss: 1.16, refraction: 0.088, roughness: 0.017,
		reflectionStrength: 0.97, foamIntensity: 0.62, choppiness: 0.56,
		foamBias: 0.61, foamGain: 1.96, foamAdd: 1.42,
	},
	// Bermuda should read as high-clarity Atlantic air rather than a hazy tropical/jungle scene.
	atmosphere: { rayleighScale: 1.03, mieScale: 0.52, mieG: 0.78, ozoneScale: 1.0, cloudCoverage: 0.22, cloudShadowStrength: 0.46 },
	wind: { speed: 3.7, direction: [ 0.28, 0.96 ] },
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
        // Local limestone headland under the distant landmark. Modify the shared heightmap
        // before min/max construction so rendering, walking and collision queries agree.
        // The envelope ends inland (z <= -101), leaving the dock, beach and seabed unchanged.
        const smooth = t => t*t*(3-2*t);
        for(let iz=0;iz<this.res;iz++) {
            const z=this.origin+iz*this.texel;
            if(z < -189 || z > -101) continue;
            for(let ix=0;ix<this.res;ix++) {
                const x=this.origin+ix*this.texel, r=Math.hypot(x+80,z+145);
                if(r>=44) continue;
                const t=Math.max(0,Math.min(1,(r-20)/24));
                const index=iz*this.res+ix;
                heights[index]=Math.max(heights[index],4+13*(1-smooth(t)));
            }
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

	// Preserve the proven simulation systems and layer authored reference-match composition around
	// them. The detail pass adds the marina, shallow seabed cues and near-camera Bermuda facade/plant
	// detail without rewriting the engine or the Harbour Run gameplay loop. Street life adds scooters,
	// pedestrians and market furniture from the final third of the 54-second visual benchmark.
	installBermudaBlockout( app );
	installReferenceWorldUpgrade( app );
	installReferenceDetailUpgrade( app );
	installReferenceStreetLife( app );
	installRelic001( app );
	installRelicStory( app );
	installBermudaGameplayQA( app );
	const waterfrontReady = installBermudaModels( app );

	if ( app.updateSun ) app.updateSun();
    return waterfrontReady;
}
