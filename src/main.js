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
import { verifyMobileWorld } from './mobile/WorldRenderGate.js';

// Keep every gameplay/visual effect enabled on mobile; adapt rendering resolution and compile scheduling.
// Buildings and decorative world assets stream separately instead of crowding the spawn beach.
// Add ?desktop to the URL to force the full desktop path on a mobile device for diagnostics.
const mobileDevice = /iPhone|iPad|iPod|Android/i.test( navigator.userAgent ) ||
	( navigator.maxTouchPoints > 1 && Math.min( screen.width, screen.height ) < 1024 );
const forceDesktop = new URLSearchParams( location.search ).has( 'desktop' );
const mobileFastStart = mobileDevice && ! forceDesktop;
let mobileRetryLevel = 0;
if ( mobileFastStart ) {
	try {
		mobileRetryLevel = Math.min( 3, Math.max( 0,
			Number( sessionStorage.getItem( 'bermudaGpuRetryLevel' ) ) || 0 ) );
	} catch (_) { /* storage may be blocked */ }
}
window.__bermudaMobileOutputScale = mobileRetryLevel > 0 ? 0.54 : 0.64;

if ( mobileDevice ) {
	const clean = new URL( location.href );
	for ( const key of [ 'gpuRecovery', 'gpuSafe', 'recoveryReason', 'noSim', 'G' ] ) clean.searchParams.delete( key );
	if ( clean.href !== location.href ) history.replaceState( null, '', clean );
}

if ( mobileFastStart ) {

	const url = new URL( location.href );
	// Render-resolution adaptation is allowed; deleting ocean, lighting and spray systems isn't.
	// Mobile retains FFT swell, shoreline simulation, wave lips, spray, caustics, haze and clouds.
	for ( const key of [ 'noClouds', 'noHaze', 'noCaustics', 'noSim' ] ) url.searchParams.delete( key );
	url.searchParams.set( 'G', '16' );
	url.searchParams.set( 'scale', mobileRetryLevel > 0 ? '0.60' : '0.70' );
	if ( url.href !== location.href ) history.replaceState( null, '', url );

	App.prototype.precompile = async function() {

		await Promise.race( [
			GPU.pipelinesReady(),
			new Promise( ( resolve ) => setTimeout( resolve, 6500 ) ),
		] );
		if ( this.engine && this.engine.meshRenderer ) this.engine.meshRenderer.syncPipelines = false;

	};

}

// App.init normally runs two hidden warm-up frames. On iPhone, those frames can allocate most of
// the heavy GPU systems before the user ever sees Tap to Explore. Suppress them until the mobile
// memory profile is installed.
const normalAppFrame = App.prototype.frame;
if ( mobileFastStart ) {

	App.prototype.frame = function( ...args ) {

		if ( ! this.__bermudaMobileReady ) return;
		return normalAppFrame.apply( this, args );

	};

}

function applyMobileMemoryProfile( app ) {
	if ( ! mobileFastStart || ! app ) return;
	// Preserve all effects. On mobile only the swapchain, post scale and shadow resolution
	// are constrained to fit Safari; no simulation update functions or meshes are disabled.
	app.__bermudaMobileReady = true;
	window.__bermudaMobileMemoryProfile = 'full-effects-adaptive-resolution';
}

// ?bench runs in background tabs too (automation): rAF does not fire in a hidden page
if ( /[?&]bench\b/.test( location.search ) ) {

	const raf = window.requestAnimationFrame.bind( window ), caf = window.cancelAnimationFrame.bind( window );
	window.requestAnimationFrame = ( cb ) => document.visibilityState === 'hidden' ? setTimeout( () => cb( performance.now() ), 16 ) : raf( cb );
	window.cancelAnimationFrame = ( id ) => ( clearTimeout( id ), caf( id ) );

}

const ui = new UI();
applyBermudaBranding( mobileDevice );
const app = new App();
applyBermudaBootLook( app );
window.__ui = ui;

app.init( ( p, text, until ) => ui.setLoading( p, text, until ) ).then( async () => {

	if ( mobileFastStart ) applyMobileMemoryProfile( app );
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
		await verifyMobileWorld( app, attempt => ui.setLoading(
			Math.min(.975+attempt*.003,.99), 'Rendering Bermuda world…', .995 ) );
		ui.setLoading( 1, 'World ready' );
		let started = false;
		ui.showStartOverlay( () => {
			if ( started ) return;
			started = true;
			if ( app.audio ) app.audio.resume();
			app.start();
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

