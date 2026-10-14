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

// iPhone/iPad WebGPU can spend several minutes compiling every desktop pipeline variant up front.
// Keep desktop quality unchanged, but use a deliberately lighter startup path on touch/mobile devices.
// Add ?desktop to the URL to force the full desktop path on a mobile device for diagnostics.
const mobileDevice = /iPhone|iPad|iPod|Android/i.test( navigator.userAgent ) ||
	( navigator.maxTouchPoints > 1 && Math.min( screen.width, screen.height ) < 1024 );
const forceDesktop = new URLSearchParams( location.search ).has( 'desktop' );
const mobileFastStart = mobileDevice && ! forceDesktop;

if ( mobileDevice ) {
	const clean = new URL( location.href );
	for ( const key of [ 'gpuRecovery', 'gpuSafe', 'recoveryReason', 'noSim', 'G' ] ) clean.searchParams.delete( key );
	if ( clean.href !== location.href ) history.replaceState( null, '', clean );
}

if ( mobileFastStart ) {

	const url = new URL( location.href );
	// Stable iPhone baseline: preserve the core game, but avoid the expensive shoreline simulation
	// and high-resolution startup allocations that have been killing Safari before Explore.
	for ( const [ key, value ] of [
		[ 'noClouds', '1' ],
		[ 'noHaze', '1' ],
		[ 'noCaustics', '1' ],
		[ 'noSim', '1' ],
		[ 'G', '16' ],
	] ) {

		url.searchParams.set( key, value );

	}
	url.searchParams.set( 'scale', '0.82' );
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

	// Cut the 3-cascade shadow texture from 2048² to 1024² before its first real frame allocation.
	if ( app.shadows && app.shadows.texture && ! app.shadows.texture.gpu ) {

		app.shadows.size = 1024;
		app.shadows.texture.width = 1024;
		app.shadows.texture.height = 1024;
		if ( ShadowUniforms?.fields?.mapSize ) ShadowUniforms.fields.mapSize.value = 1024;

	}

	// Preserve walking, fishing, Joe/Martha, minimap, boat physics and the ocean. Disable only
	// secondary visual systems that create extra GPU buffers/particle work on iPhone.
	if ( app.wake ) {
		if ( app.surface ) app.surface.wake = null;
		app.wake.update = () => {};
	}
	if ( app.boatSpray ) app.boatSpray.update = () => {};
	if ( app.spray ) {
		app.spray.update = () => {};
		if ( app.spray.mesh ) app.spray.mesh.visible = false;
	}
	if ( app.breakers ) {
		app.breakers.update = () => {};
		if ( app.breakers.mesh ) app.breakers.mesh.visible = false;
	}
	if ( app.marineSnow ) {
		app.marineSnow.update = () => {};
		if ( app.marineSnow.mesh ) app.marineSnow.mesh.visible = false;
	}
	if ( app.airMotes ) {
		app.airMotes.update = () => {};
		if ( app.airMotes.mesh ) app.airMotes.mesh.visible = false;
	}
	if ( app.whale ) {
		app.whale.update = () => {};
		if ( app.whale.group ) app.whale.group.visible = false;
	}
	if ( app.wildlife ) {
		app.wildlife.update = () => {};
		if ( app.wildlife.birdBatch?.mesh ) app.wildlife.birdBatch.mesh.visible = false;
		if ( app.wildlife.critterBatch?.mesh ) app.wildlife.critterBatch.mesh.visible = false;
		if ( app.wildlife.blobs?.mesh ) app.wildlife.blobs.mesh.visible = false;
	}

	app.__bermudaMobileReady = true;
	window.__bermudaMobileMemoryProfile = 'core-gameplay-stable';

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

		let started = false;
		// Mount the overlay while the loader is still covering the page. This guarantees Safari paints
		// "Tap to Explore" before any real game frame is allowed to run.
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
	ui.setLoadingError( 'Something went wrong: ' + e.message );

} );
// deploy-marker: deferred-mobile-first-frame
