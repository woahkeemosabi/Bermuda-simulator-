import './core/BenchSeed.js';
import { App } from './App.js';
import { GPU } from './engine/gpu/GPU.js';
import { UI } from './ui/UI.js';
import { AppUI } from './ui/AppUI.js';
import { applyBermudaBootLook, applyBermudaRuntimeLook } from './world/BermudaIdentity.js';
import { applyBermudaBranding } from './mobile/BermudaMobileUX.js';
import { installStableMobileControls } from './mobile/BermudaMobileStable.js';

// iPhone/iPad WebGPU can spend several minutes compiling every desktop pipeline variant up front.
// Keep desktop quality unchanged, but use a deliberately lighter startup path on touch/mobile devices.
// Add ?desktop to the URL to force the full desktop path on a mobile device for diagnostics.
const initialParams = new URLSearchParams( location.search );
const mobileDevice = /iPhone|iPad|iPod|Android/i.test( navigator.userAgent ) ||
	( navigator.maxTouchPoints > 1 && Math.min( screen.width, screen.height ) < 1024 );
const forceDesktop = initialParams.has( 'desktop' );
const mobileFastStart = mobileDevice && ! forceDesktop;
const mobileSafeLevel = mobileFastStart ? Math.max( 0, Number( initialParams.get( 'gpuSafe' ) || 0 ) ) : 0;

if ( mobileFastStart ) {

	const url = new URL( location.href );
	for ( const [ key, value ] of [ [ 'noClouds', '1' ], [ 'noHaze', '1' ], [ 'noCaustics', '1' ] ] ) {

		if ( ! url.searchParams.has( key ) ) url.searchParams.set( key, value );

	}

	// Normal mobile stays at the known-good 90% profile. Recovery is now tiered rather than dropping
	// immediately to 72%: first device loss uses an 82% profile with the expensive shoreline simulation
	// disabled; only a second device loss falls back to the old 72% emergency profile.
	if ( mobileSafeLevel >= 2 ) {

		url.searchParams.set( 'scale', '0.72' );
		url.searchParams.set( 'noSim', '1' );

	} else if ( mobileSafeLevel === 1 ) {

		url.searchParams.set( 'scale', '0.82' );
		url.searchParams.set( 'noSim', '1' );

	} else if ( ! url.searchParams.has( 'scale' ) || Number( url.searchParams.get( 'scale' ) ) < 0.9 ) {

		url.searchParams.set( 'scale', '0.90' );

	}
	if ( url.href !== location.href ) history.replaceState( null, '', url );

	// Keep all scene pipelines asynchronous on mobile. MeshRenderer explicitly supports this mode:
	// a draw whose pipeline is still compiling is skipped for that frame instead of forcing a
	// synchronous WebGPU compile.
	App.prototype.precompile = async function() {

		await Promise.race( [
			GPU.pipelinesReady(),
			new Promise( ( resolve ) => setTimeout( resolve, 6500 ) ),
		] );
		if ( this.engine && this.engine.meshRenderer ) this.engine.meshRenderer.syncPipelines = false;

	};

}

function mobileRecoveryURL( reason, prefix = 'gpu-recovery' ) {

	if ( ! mobileFastStart ) return null;
	const url = new URL( location.href );
	const attempts = Number( url.searchParams.get( 'gpuRecovery' ) || 0 );
	if ( attempts >= 2 ) return null;
	const next = attempts + 1;
	url.searchParams.set( 'gpuSafe', String( next ) );
	url.searchParams.set( 'gpuRecovery', String( next ) );
	url.searchParams.set( 'scale', next === 1 ? '0.82' : '0.72' );
	url.searchParams.set( 'noSim', '1' );
	url.searchParams.set( 'v', prefix + '-' + next );
	try { sessionStorage.setItem( 'bermudaLastGPUError', String( reason || 'unknown' ) ); } catch ( _ ) {}
	return url;

}

function recoverMobileInitGPUError( error ) {

	if ( ! mobileFastStart ) return false;
	const message = String( error && ( error.message || error ) || '' );
	if ( ! /createBuffer|Unable to create buffer|GPUDevice|device lost|destroyed|out of memory|GPU queue/i.test( message ) ) return false;
	const url = mobileRecoveryURL( message, 'gpu-init-recovery' );
	if ( ! url ) return false;
	location.replace( url.href );
	return true;

}

function installMobileGPUWatchdog() {

	if ( ! mobileFastStart || ! GPU.device || ! GPU.queue ) return;
	let recovering = false;
	let probeBusy = false;

	const showRecoveryFailure = ( reason ) => {

		if ( document.getElementById( 'bm-gpu-recovery' ) ) return;
		const el = document.createElement( 'div' );
		el.id = 'bm-gpu-recovery';
		el.style.cssText = 'position:fixed;left:16px;right:16px;top:max(70px,env(safe-area-inset-top));z-index:9999;padding:13px 15px;border-radius:14px;background:rgba(4,18,27,.94);color:#eaffff;font:600 13px/1.35 system-ui,-apple-system,sans-serif;box-shadow:0 10px 35px rgba(0,0,0,.35);border:1px solid rgba(110,240,226,.35)';
		el.textContent = 'Graphics stopped responding (' + reason + '). Close this tab and reopen the simulator.';
		document.body.appendChild( el );

	};

	const recover = ( reason ) => {

		if ( recovering ) return;
		recovering = true;
		window.__bermudaGPUStall = reason;
		const url = mobileRecoveryURL( reason );
		if ( url ) {

			location.replace( url.href );
			return;

		}
		showRecoveryFailure( reason );

	};

	GPU.device.lost.then( ( info ) => recover( 'device lost: ' + ( info && info.reason ? info.reason : 'unknown' ) ) );

	// A live JS/touch layer with a frozen 3D image means the browser can still run JavaScript while
	// WebGPU presentation has stopped. Probe submitted GPU work periodically; if the queue cannot
	// complete for several seconds, recover instead of leaving the game permanently frozen.
	window.__bermudaGPUWatchdog = setInterval( () => {

		if ( recovering || probeBusy || document.visibilityState !== 'visible' ) return;
		probeBusy = true;
		let settled = false;
		const timer = setTimeout( () => {

			if ( ! settled ) recover( 'GPU queue stalled' );

		}, 5000 );
		GPU.queue.onSubmittedWorkDone().then( () => {

			settled = true;
			probeBusy = false;
			clearTimeout( timer );

		}, () => {

			settled = true;
			probeBusy = false;
			clearTimeout( timer );
			recover( 'GPU queue error' );

		} );

	}, 1800 );

}

function installMobileAudioResume( app ) {

	if ( ! mobileDevice || ! app.audio ) return;
	const wakeAudio = () => {

		if ( document.visibilityState === 'hidden' || ! app.audio ) return;
		void app.audio.resume();

	};

	// iOS suspends Web Audio when Safari is backgrounded. Try immediately when the page becomes active,
	// then again shortly after Safari has restored the page. If iOS still requires a fresh user gesture,
	// the first touch anywhere in the game resumes it without changing the gameplay controls.
	document.addEventListener( 'visibilitychange', () => {

		if ( document.visibilityState !== 'visible' ) return;
		setTimeout( wakeAudio, 60 );
		setTimeout( wakeAudio, 450 );

	} );
	window.addEventListener( 'pageshow', wakeAudio );
	window.addEventListener( 'focus', wakeAudio );
	document.addEventListener( 'pointerdown', wakeAudio, { capture: true, passive: true } );
	document.addEventListener( 'touchstart', wakeAudio, { capture: true, passive: true } );

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
		installMobileAudioResume( app );

		// A little extra RCAS sharpening compensates for mobile render scaling without increasing the
		// internal render resolution enough to recreate the WebGPU device-loss problem.
		if ( app.post && app.post.params && app.post.params.sharpen ) app.post.params.sharpen.value = mobileSafeLevel ? 0.62 : 0.54;

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
	await ui.hideLoader();
	// frame-time benchmark and reference shots (see core/Bench.js): it drives the frames itself
	if ( app.qs.has( 'bench' ) ) {

		window.__bench = new ( await import( './core/Bench.js' ) ).Bench( app );
		if ( app.qs.has( 'auto' ) ) window.__job = window.__bench.auto( app.qs.get( 'auto' ), { runs: Number( app.qs.get( 'runs' ) ) || 1 } );
		// ?bench&shots=view1,view2[&tag=name][&dt=seconds][&seq=n&every=frames]: reference shots of the named views only (core/DebugViews.js; dt > 0: the clock runs, e.g. for the eased lens flare)
		// &wdbg=N: the water shader's debug view (WaterMaterial debugMode) in the shots
		if ( app.qs.has( 'wdbg' ) && app.waterMaterial ) app.waterMaterial.debugMode.value = Number( app.qs.get( 'wdbg' ) );
		if ( app.qs.has( 'shots' ) ) window.__job = window.__bench.shots( app.qs.get( 'shots' ).split( ',' ), { tag: app.qs.get( 'tag' ) || 'shot', dt: Number( app.qs.get( 'dt' ) ) || 0, seq: Number( app.qs.get( 'seq' ) ) || 1, every: Number( app.qs.get( 'every' ) ) || 1 } );

	} else {

		app.start();
		installMobileGPUWatchdog();

	}
	ui.showStartOverlay( () => {

		if ( ! mobileDevice ) app.input.requestLock();
		if ( app.audio ) app.audio.resume();

	} );

} ).catch( ( e ) => {

	console.error( e );
	if ( recoverMobileInitGPUError( e ) ) return;
	ui.setLoadingError( 'Something went wrong: ' + e.message );

} );