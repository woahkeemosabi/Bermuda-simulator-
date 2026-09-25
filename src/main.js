import './core/BenchSeed.js';
import { App } from './App.js';
import { GPU } from './engine/gpu/GPU.js';
import { UI } from './ui/UI.js';
import { AppUI } from './ui/AppUI.js';
import { applyBermudaBootLook, applyBermudaRuntimeLook } from './world/BermudaIdentity.js';

// iPhone/iPad WebGPU can spend several minutes compiling every desktop pipeline variant up front.
// Keep desktop quality unchanged, but use a deliberately lighter startup path on touch/mobile devices.
// Add ?desktop to the URL to force the full desktop path on a mobile device for diagnostics.
const mobileDevice = /iPhone|iPad|iPod|Android/i.test( navigator.userAgent ) ||
	( navigator.maxTouchPoints > 1 && Math.min( screen.width, screen.height ) < 1024 );
const forceDesktop = new URLSearchParams( location.search ).has( 'desktop' );
const mobileFastStart = mobileDevice && ! forceDesktop;

if ( mobileFastStart ) {

	const url = new URL( location.href );
	// These are intentionally startup defaults, not permanent quality limits. They remove the three
	// heaviest optional shader families on phones while keeping the ocean, terrain, boat, reef and game.
	for ( const [ key, value ] of [ [ 'noClouds', '1' ], [ 'noHaze', '1' ], [ 'noCaustics', '1' ], [ 'scale', '0.72' ] ] ) {

		if ( ! url.searchParams.has( key ) ) url.searchParams.set( key, value );

	}
	if ( url.href !== location.href ) history.replaceState( null, '', url );

	// Do not force Safari to compile every hidden/off-screen material variant before the first frame.
	// Wait briefly for already-requested async pipelines, then let the two normal warm-up frames compile
	// only what is actually visible. This prevents the loader sitting indefinitely at 94% on iPhone.
	App.prototype.precompile = async function() {

		await Promise.race( [
			GPU.pipelinesReady(),
			new Promise( ( resolve ) => setTimeout( resolve, 8000 ) ),
		] );

	};

}

// ?bench runs in background tabs too (automation): rAF does not fire in a hidden page
if ( /[?&]bench\b/.test( location.search ) ) {

	const raf = window.requestAnimationFrame.bind( window ), caf = window.cancelAnimationFrame.bind( window );
	window.requestAnimationFrame = ( cb ) => document.visibilityState === 'hidden' ? setTimeout( () => cb( performance.now() ), 16 ) : raf( cb );
	window.cancelAnimationFrame = ( id ) => ( clearTimeout( id ), caf( id ) );

}

const ui = new UI();
const app = new App();
applyBermudaBootLook( app );
window.__ui = ui;

app.init( ( p, text, until ) => ui.setLoading( p, text, until ) ).then( async () => {

	applyBermudaRuntimeLook( app );
	app.ui = new AppUI( app, ui );
	ui.setLoading( 1, 'Ready' );
	await ui.hideLoader();
	// frame-time benchmark and reference shots (see core/Bench.js): it drives the frames itself
	if ( app.qs.has( 'bench' ) ) {

		window.__bench = new ( await import( './core/Bench.js' ) ).Bench( app );
		if ( app.qs.has( 'auto' ) ) window.__job = window.__bench.auto( app.qs.get( 'auto' ), { runs: Number( app.qs.get( 'runs' ) ) || 1 } );
		// ?bench&shots=view1,view2[&tag=name][&dt=seconds][&seq=n&every=frames]: reference shots of the named views only (core/DebugViews.js; dt > 0: the clock runs, e.g. for the eased lens flare)
		// &wdbg=N: the water shader's debug view (WaterMaterial debugMode) in the shots
		if ( app.qs.has( 'wdbg' ) && app.waterMaterial ) app.waterMaterial.debugMode.value = Number( app.qs.get( 'wdbg' ) );
		if ( app.qs.has( 'shots' ) ) window.__job = window.__bench.shots( app.qs.get( 'shots' ).split( ',' ), { tag: app.qs.get( 'tag' ) || 'shot', dt: Number( app.qs.get( 'dt' ) ) || 0, seq: Number( app.qs.get( 'seq' ) ) || 1, every: Number( app.qs.get( 'every' ) ) || 1 } );

	} else app.start();
	ui.showStartOverlay( () => {

		app.input.requestLock();
		if ( app.audio ) app.audio.resume();

	} );

} ).catch( ( e ) => {

	console.error( e );
	ui.setLoadingError( 'Something went wrong: ' + e.message );

} );
