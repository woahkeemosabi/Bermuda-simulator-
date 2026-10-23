import './core/BenchSeed.js';
import { App } from './App.js';
import { GPU } from './engine/gpu/GPU.js';
import { ShadowUniforms } from './engine/render/wgsl/lighting.js';
import { UI } from './ui/UI.js';
import { AppUI } from './ui/AppUI.js';
import { applyBermudaBootLook, applyBermudaRuntimeLook } from './world/BermudaIdentity.js';
import { applyBermudaBranding } from './mobile/BermudaMobileUX.js';
import { installStableMobileControls } from './mobile/BermudaMobileStable.js';
import { installMobileScreenshotHUD } from './mobile/MobileScreenshotHUD.js';
import { verifyMobileWorld, validateSpawn } from './mobile/WorldRenderGate.js';
import { gpuStage, gpuReport } from './mobile/GpuAudit.js';

// Keep every gameplay/visual effect enabled on mobile; adapt rendering resolution and compile scheduling.
// Buildings and decorative world assets stream separately instead of crowding the spawn beach.
// Add ?desktop to the URL to force the full desktop path on a mobile device for diagnostics.
const mobileDevice = /iPhone|iPad|iPod|Android/i.test( navigator.userAgent ) ||
	( navigator.maxTouchPoints > 1 && Math.min( screen.width, screen.height ) < 1024 );
const forceDesktop = new URLSearchParams( location.search ).has( 'desktop' );
const mobileFastStart = mobileDevice && ! forceDesktop;
// Low-memory recovery path, opt-in so desktop and full graphics are unchanged.
const mobileRecovery = mobileFastStart && new URLSearchParams(location.search).get('recovery') === '1';
// Low-GPU iPhone default: retain gameplay, freeze FFT ocean and remove expensive sky passes.
const mobileLowGPU = mobileFastStart; // Full compute ocean is not safe on this mobile driver.
window.__bermudaFreezeUnderwaterLight = mobileLowGPU;
window.__bermudaThrottleWaterQueries = mobileLowGPU;
window.__bermudaDisableSwashProbe = mobileLowGPU;
window.__bermudaSparseVegetation = mobileFastStart;
window.__bermudaBuildMarker = 'atmo-staged-v4-20261023';
const missionIsolation = new URLSearchParams(location.search).get('missions') === 'off';
window.__bermudaMissionsDisabledForTest = missionIsolation;
let mobileRetryLevel = 0;
if ( mobileFastStart ) {
	try {
		mobileRetryLevel = Math.min( 3, Math.max( 0,
			Number( sessionStorage.getItem( 'bermudaGpuRetryLevel' ) ) || 0 ) );
	} catch (_) { /* storage may be blocked */ }
}
window.__bermudaMobileOutputScale = mobileLowGPU ? 0.85 : (mobileRecovery ? 0.56 : (mobileRetryLevel > 0 ? 0.54 : 0.64));

if ( mobileDevice ) {
	const clean = new URL( location.href );
	for ( const key of [ 'gpuRecovery', 'gpuSafe', 'recoveryReason', 'noSim', 'G' ] ) clean.searchParams.delete( key );
	if ( clean.href !== location.href ) history.replaceState( null, '', clean );
}

if ( mobileFastStart ) {

	const url = new URL( location.href );
	// Render-resolution adaptation is allowed; deleting ocean, lighting and spray systems isn't.
	// Mobile retains FFT swell, shoreline simulation, wave lips, spray, caustics, haze and clouds.
	if (mobileRecovery) {
		// Separate audio construction and costly GPU effects from iPhone gameplay.
		for (const key of ['noClouds','noHaze','noCaustics','noSim','noVeg','noAudio'])
			url.searchParams.set(key,'1');
		url.searchParams.set('G','12');
		url.searchParams.set('scale','0.70');
	} else {
		for ( const key of [ 'noClouds', 'noHaze', 'noCaustics', 'noSim' ] ) url.searchParams.delete( key );
		url.searchParams.set( 'G', '16' );
		url.searchParams.set( 'scale', mobileRetryLevel > 0 ? '0.60' : '0.70' );
	}
	if ( mobileLowGPU ) {
		for ( const key of [ 'noClouds', 'noHaze', 'noCaustics', 'noSim' ] ) url.searchParams.set( key, '1' );
		// Preserve explicitly requested diagnostics instead of overwriting them.
		if (!['skip','full','instant','freeze'].includes(url.searchParams.get('envtest')))
			url.searchParams.set( 'envtest', 'freeze' );
		url.searchParams.set( 'freezeFFT', '1' );
		url.searchParams.set( 'scale', '0.85' );
		url.searchParams.set( 'noSpray', '1' );
		// Mobile vegetation isolation: disable procedural palm forest by default.
		// ?veg=1 restores it for controlled A/B stability testing.
		if (url.searchParams.get('veg') === '0' || url.searchParams.get('gpuTest') === 'minimal') url.searchParams.set('noVeg','1');
		else url.searchParams.delete('noVeg');
		if (url.searchParams.get('gpuTest') === 'minimal') {
			url.searchParams.set('scale','0.55');
			url.searchParams.set('noAudio','1');
			url.searchParams.set('G','8');
		}
		if (url.searchParams.get('gpuTest') !== 'minimal') url.searchParams.set( 'G', '12' );
	}
	if ( url.href !== location.href ) history.replaceState( null, '', url );

	App.prototype.precompile = async function() {

		await Promise.race( [
			GPU.pipelinesReady(),
			new Promise( ( resolve ) => setTimeout( resolve, 6500 ) ),
		] );
		if ( this.engine && this.engine.meshRenderer ) this.engine.meshRenderer.syncPipelines = false;

	};

}

// The previous early-return on App.frame silently skipped every warm-up frame.
// Shader variants were therefore all requested together on the first gameplay frame.
// App.init now primes frames behind the loader after its mobile systems are allocated.

function applyMobileMemoryProfile( app ) {
	if ( ! mobileFastStart || ! app ) return;
	window.__bermudaMobileMemoryProfile = mobileRecovery ? 'recovery-ocean2-progressive-lighting' : 'all-effects-mobile-compute-budget-v1';
	window.__bermudaMobileBudget = {
		oceanCascades: app.fft?.cascades,
		wakeGrid: '256x256', shoreFoamGrid: app.shoreSim?.res,
		sprayParticleCapacity: app.spray?.N,
		cloudSteps: 128, caustics: true
	};
}

// ?bench runs in background tabs too (automation): rAF does not fire in a hidden page
if ( /[?&]bench\b/.test( location.search ) ) {

	const raf = window.requestAnimationFrame.bind( window ), caf = window.cancelAnimationFrame.bind( window );
	window.requestAnimationFrame = ( cb ) => document.visibilityState === 'hidden' ? setTimeout( () => cb( performance.now() ), 16 ) : raf( cb );
	window.cancelAnimationFrame = ( id ) => ( clearTimeout( id ), caf( id ) );

}

gpuStage('UI initialization');
const ui = new UI();
applyBermudaBranding( mobileDevice );
const app = new App();
applyBermudaBootLook( app );
window.__ui = ui;

app.init( ( p, text, until ) => {
  gpuStage('Loading: '+String(text||''));
  ui.setLoading( p, text, until );
} ).then( async () => {

	if ( mobileFastStart ) applyMobileMemoryProfile( app );
	if (mobileFastStart) {
		const profile = app.vegetation ? (window.__bermudaSparseVegetation ? 'SPARSE' : 'FULL') : 'OFF';
		window.__bermudaVegetationProfile = profile;
		console.info('[Bermuda build]',window.__bermudaBuildMarker,'vegetation',profile,'palms',app.vegetation?.records?.palms?.length ?? 0);
		const marker = document.createElement('div');
		marker.id='bm-build-verification';
		marker.textContent='BUILD '+window.__bermudaBuildMarker+' | MISSIONS '+(missionIsolation?'ISOLATED':'BASELINE')+' | GPU '+(new URLSearchParams(location.search).get('gpuTest')||'normal')+' | TREES '+profile+' | PALMS '+(app.vegetation?.records?.palms?.length ?? 0)+' | ATMO '+(app.atmosphere?.mobileMode||'unknown');
		Object.assign(marker.style,{position:'fixed',top:'max(6px, env(safe-area-inset-top))',left:'6px',zIndex:'2147483647',background:'rgba(0,0,0,.8)',color:'#fff',font:'11px monospace',padding:'5px 7px',pointerEvents:'none'});
		document.body.appendChild(marker);
	}
	if ( mobileFastStart && app.localLights ) app.localLights.strength = Math.max( Number( app.localLights.strength ) || 1, 1.35 );
	applyBermudaRuntimeLook( app );
	app.ui = new AppUI( app, ui );
	if ( app.engine ) {
		app.engine.mobileGpuFramePacing = mobileFastStart;
		app.engine.onFrameFailure = ( error ) => {
			if ( mobileDevice ) showWorldFailure( '3D graphics stopped: ' + String( error?.message || error ) );
		};
	}
	applyBermudaBranding( mobileDevice );
	if ( mobileDevice ) {

		installStableMobileControls( app );
		installMobileScreenshotHUD( app );

		// Keep the gameplay logic active, but hide the desktop prompt/widget layer on phones.
		// Mobile interaction buttons send the same underlying E/R/C/V/Space/mouse inputs directly.
		ui.setPrompt( null );
		if ( ui.promptEl ) {

			ui.promptEl.style.display = 'none';
			ui.promptEl.style.pointerEvents = 'none';
			ui.promptEl.style.touchAction = 'none';

		}
		if ( ui.hud ) {

			ui.hud.style.pointerEvents = 'none';
			ui.hud.style.touchAction = 'none';

		}

	}
	ui.setLoading( 1, 'Ready' );

	// frame-time benchmark and reference shots (see core/Bench.js): it drives the frames itself
	if ( app.qs.has( 'bench' ) ) {

		await ui.hideLoader();
		window.__bench = new ( await import( './core/Bench.js' ) ).Bench( app );
		if ( app.qs.has( 'auto' ) ) window.__job = window.__bench.auto( app.qs.get( 'auto' ), { runs: Number( app.qs.get( 'runs' ) ) || 1 } );
		if ( app.qs.has( 'wdbg' ) && app.waterMaterial ) app.waterMaterial.debugMode.value = Number( app.qs.get( 'wdbg' ) );
		if ( app.qs.has( 'shots' ) ) window.__job = window.__bench.shots( app.qs.get( 'shots' ).split( ',' ), { tag: app.qs.get( 'tag' ) || 'shot', dt: Number( app.qs.get( 'dt' ) ) || 0, seq: Number( app.qs.get( 'seq' ) ) || 1, every: Number( app.qs.get( 'every' ) ) || 1 } );

	} else if ( mobileDevice ) {

		ui.setLoading( .97, 'Validating the 3D world…', .995 );
		gpuStage('World verification');
		if (mobileRecovery) {
			// Skip expensive startup HDR texture copy/readback on fragile drivers.
			validateSpawn(app);
			window.__bermudaWorldGate = {status:'recovery-no-readback',tries:0};
		} else {
			await verifyMobileWorld( app, attempt => ui.setLoading(
				Math.min(.975+attempt*.003,.99), 'Rendering Bermuda world…', .995 ) );
		}
		ui.setLoading( 1, 'World ready' );
		let started = false;
		ui.showStartOverlay( () => {
			if ( started ) return;
			started = true;
			// Keep sound off on mobile until the renderer is proven stable.
			// ?audio=on is an explicit diagnostic opt-in; sound is not required to play.
			gpuStage('Starting simulation (mobile audio disabled)');
			try { app.start(); } catch (error) { showWorldFailure('Simulation start failed: ' + String(error?.message || error)); return; }
			if ( app.audio && new URLSearchParams(location.search).get('audio') === 'on' ) {
				try { app.audio.resume(); } catch (error) { console.warn('Audio resume failed', error); }
			}
		} );
		await ui.hideLoader();
		return;

	} else {

		await ui.hideLoader();
		app.start();

	}
	ui.showStartOverlay( () => {

		if ( ! mobileDevice ) app.input.requestLock();
		if ( app.audio ) app.audio.resume();

	} );

} ).catch( ( e ) => {

	console.error( e );
	showWorldFailure( 'Something went wrong: ' + e.message );

} );
// deploy-marker: deferred-mobile-first-frame

function showWorldFailure(message){
	const L=document.getElementById('loader');
	if(L){L.style.display='';L.classList.remove('tw-hidden');}
	ui.setLoadingError(message);
	const diag=document.getElementById('bm-gpu-trace');
	if(diag){diag.textContent=gpuReport(app,mobileRetryLevel);diag.hidden=false;}
	const copy=document.getElementById('bm-gpu-copy');
	if(copy){
		copy.hidden=false;
		copy.onclick=async()=>{
			try{await navigator.clipboard.writeText(message+'\n'+gpuReport(app,mobileRetryLevel));
				copy.textContent='Diagnostics copied';}
			catch(e){copy.textContent='Screenshot diagnostics';}
		};
	}
	const retry=document.getElementById('bm-loader-retry');
	if(retry){
		retry.hidden=false;
		retry.onclick=()=>{
			// Retrying allocates a fresh GPUDevice with fewer pixels per frame, not fewer FX.
			try { sessionStorage.setItem('bermudaGpuRetryLevel',String(Math.min(3,mobileRetryLevel+1))); }
			catch(_){}
			location.reload();
		};
	}
}
window.__bermudaOnGPUFailure=message=>{
	app.engine?.stop();
	showWorldFailure('Graphics device failed: '+message);
};

