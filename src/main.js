import './core/BenchSeed.js';
import { App } from './App.js';
import { GPU } from './engine/gpu/GPU.js';
import { UI } from './ui/UI.js';
import { AppUI } from './ui/AppUI.js';
import { applyBermudaBootLook, applyBermudaRuntimeLook } from './world/BermudaIdentity.js';
import { applyBermudaBranding } from './mobile/BermudaMobileUX.js';
import { installStableMobileControls } from './mobile/BermudaMobileStable.js';

// iPhone/iPad WebGPU can spend several minutes compiling desktop pipeline variants up front.
// Keep desktop unchanged; on touch/mobile compile asynchronously and never block the loader on
// synchronous hidden warm-up frames.
const mobileDevice = /iPhone|iPad|iPod|Android/i.test( navigator.userAgent ) ||
	( navigator.maxTouchPoints > 1 && Math.min( screen.width, screen.height ) < 1024 );
const forceDesktop = new URLSearchParams( location.search ).has( 'desktop' );
const mobileFastStart = mobileDevice && ! forceDesktop;

if ( mobileFastStart ) {

	const url = new URL( location.href );
	for ( const [ key, value ] of [ [ 'noClouds', '1' ], [ 'noHaze', '1' ], [ 'noCaustics', '1' ] ] ) {

		if ( ! url.searchParams.has( key ) ) url.searchParams.set( key, value );

	}
	if ( ! url.searchParams.has( 'scale' ) || Number( url.searchParams.get( 'scale' ) ) < 0.9 ) url.searchParams.set( 'scale', '0.90' );
	if ( url.href !== location.href ) history.replaceState( null, '', url );

	App.prototype.precompile = async function() {

		const mr = this.engine && this.engine.meshRenderer;
		if ( mr ) {

			mr.precompiling = false;
			mr.syncPipelines = false;

		}

		// Give already-requested async pipelines a short chance to finish, but never make startup
		// depend on Safari completing every pipeline immediately.
		await Promise.race( [
			GPU.pipelinesReady(),
			new Promise( ( resolve ) => setTimeout( resolve, 1800 ) ),
		] );

		// App.init() normally renders two hidden warm-up frames and waits for the GPU after each.
		// On iPhone those frames can synchronously compile the visible world and pin the loader at 99%.
		// Skip only those two hidden calls. The real frame method is restored before app.start().
		const realFrame = this.frame.bind( this );
		let hiddenWarmups = 2;
		this.frame = ( ...args ) => {

			if ( hiddenWarmups > 0 ) {

				hiddenWarmups --;
				if ( hiddenWarmups === 0 ) this.frame = realFrame;
				return;

			}
			return realFrame( ...args );

		};

	};

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

	applyBermudaRuntimeLook( app );
	app.ui = new AppUI( app, ui );
	applyBermudaBranding( mobileDevice );
	if ( mobileDevice ) {

		installStableMobileControls( app );

		// Keep gameplay logic active, but hide the desktop prompt/widget layer on phones.
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
	// frame-time benchmark and reference shots (see core/Bench.js): it drives the frames itself
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
