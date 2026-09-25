import './core/BenchSeed.js';
import { App } from './App.js';
import { GPU } from './engine/gpu/GPU.js';
import { UI } from './ui/UI.js';
import { AppUI } from './ui/AppUI.js';
import { applyBermudaBootLook, applyBermudaRuntimeLook } from './world/BermudaIdentity.js';
import { applyBermudaBranding } from './mobile/BermudaMobileUX.js';
import { installStableMobileControls } from './mobile/BermudaMobileStable.js';
import { installMobilePolish } from './mobile/BermudaMobilePolish.js';
import { installBoatReset } from './mobile/BermudaBoatReset.js';

// iPhone/iPad WebGPU can spend several minutes compiling every desktop pipeline variant up front.
// Keep desktop quality unchanged, but use a deliberately lighter startup path on touch/mobile devices.
// Add ?desktop to the URL to force the full desktop path on a mobile device for diagnostics.
const mobileDevice = /iPhone|iPad|iPod|Android/i.test( navigator.userAgent ) ||
	( navigator.maxTouchPoints > 1 && Math.min( screen.width, screen.height ) < 1024 );
const forceDesktop = new URLSearchParams( location.search ).has( 'desktop' );
const mobileFastStart = mobileDevice && ! forceDesktop;

if ( mobileFastStart ) {

	const url = new URL( location.href );
	// Stability first on iPhone: keep the expensive optional shader families off and use the
	// lower render scale while we rebuild the Bermuda world and profile the heavier effects.
	for ( const [ key, value ] of [ [ 'noClouds', '1' ], [ 'noHaze', '1' ], [ 'noCaustics', '1' ] ] ) {

		if ( ! url.searchParams.has( key ) ) url.searchParams.set( key, value );

	}
	if ( ! url.searchParams.has( 'scale' ) ) url.searchParams.set( 'scale', '0.90' );
	if ( url.href !== location.href ) history.replaceState( null, '', url );

	App.prototype.precompile = async function() {

		await Promise.race( [
			GPU.pipelinesReady(),
			new Promise( ( resolve ) => setTimeout( resolve, 6500 ) ),
		] );
		if ( this.engine && this.engine.meshRenderer ) this.engine.meshRenderer.syncPipelines = true;

	};

}

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

	applyBermudaRuntimeLook( app );
	app.ui = new AppUI( app, ui );
	applyBermudaBranding( mobileDevice );
	if ( mobileDevice ) {

		installStableMobileControls( app );
		installMobilePolish( app );
		installBoatReset( app );

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
	await ui.hideLoader();
	if ( app.qs.has( 'bench' ) ) {

		window.__bench = new ( await import( './core/Bench.js' ) ).Bench( app );
		if ( app.qs.has( 'auto' ) ) window.__job = window.__bench.auto( app.qs.get( 'auto' ), { runs: Number( app.qs.get( 'runs' ) ) || 1 } );
		if ( app.qs.has( 'wdbg' ) && app.waterMaterial ) app.waterMaterial.debugMode.value = Number( app.qs.get( 'wdbg' ) );
		if ( app.qs.has( 'shots' ) ) window.__job = window.__bench.shots( app.qs.get( 'shots' ).split( ',' ), { tag: app.qs.get( 'tag' ) || 'shot', dt: Number( app.qs.get( 'dt' ) ) || 0, seq: Number( app.qs.get( 'seq' ) ) || 1, every: Number( app.qs.get( 'every' ) ) || 1 } );

	} else app.start();
	ui.showStartOverlay( () => {

		if ( ! mobileDevice ) app.input.requestLock();
		if ( app.audio ) app.audio.resume();

	} );

} ).catch( ( e ) => {

	console.error( e );
	ui.setLoadingError( 'Something went wrong: ' + e.message );

} );
