import { startDeferredWaterfront, preloadCompleteMobileWaterfront, updateWaterfrontVisibility } from './world/BermudaModels.js';
import { mobileQualityParameters } from './mobile/QualityProfile.js';
import './core/BenchSeed.js';
import { App } from './App.js';
import { GPU } from './engine/gpu/GPU.js';
import { ShadowUniforms } from './engine/render/wgsl/lighting.js';
import { UI } from './ui/UI.js';
import { AppUI } from './ui/AppUI.js';
import { applyBermudaBootLook, applyBermudaRuntimeLook } from './world/BermudaIdentity.js';
import { applyBermudaBranding } from './mobile/BermudaMobileUX.js';
import { installStableMobileControls } from './mobile/BermudaMobileStable.js';
import { RelicVehicle } from './player/RelicVehicle.js';
import { installMobileScreenshotHUD } from './mobile/MobileScreenshotHUD.js';

// iPhone/iPad WebGPU can spend several minutes compiling every desktop pipeline variant up front.
// Keep desktop quality unchanged, but use a deliberately lighter startup path on touch/mobile devices.
// Add ?desktop to the URL to force the full desktop path on a mobile device for diagnostics.
// Automatic GPU-recovery URLs were too persistent on iOS: Safari could reopen
// ?gpuSafe=2&gpuRecovery=2&scale=0.72 and trap the game in a degraded reload/crash loop.
// Strip only parameters that came from that legacy recovery mechanism before selecting quality.
{
	const clean = new URL( location.href );
	const hadLegacyRecovery = clean.searchParams.has( 'gpuRecovery' ) || clean.searchParams.has( 'recoveryReason' );
	if ( hadLegacyRecovery ) {

		for ( const key of [ 'gpuSafe', 'gpuRecovery', 'recoveryReason', 'scale' ] ) clean.searchParams.delete( key );
		history.replaceState( null, '', clean.href );
		try { sessionStorage.removeItem( 'bermudaLastGPUError' ); } catch ( _ ) {}

	}
}
const initialParams = new URLSearchParams( location.search );
const mobileDevice = /iPhone|iPad|iPod|Android/i.test( navigator.userAgent ) ||
	( navigator.maxTouchPoints > 1 && Math.min( screen.width, screen.height ) < 1024 );
const forceDesktop = initialParams.has( 'desktop' );
const mobileFastStart = mobileDevice && ! forceDesktop;
const mobileSafeLevel = mobileFastStart ? Math.max( 0, Number( initialParams.get( 'gpuSafe' ) || 0 ) ) : 0;

if ( mobileFastStart ) {

	const url = new URL( location.href );
	url.search = mobileQualityParameters(url.searchParams, mobileSafeLevel).toString();
	if ( url.href !== location.href ) history.replaceState( null, '', url );

	// Keep all scene pipelines asynchronous on mobile. MeshRenderer explicitly supports this mode:
	// a draw whose pipeline is still compiling is skipped for that frame instead of forcing a
	// synchronous WebGPU compile.
	App.prototype.precompile = async function() {

		await Promise.race( [
			GPU.pipelinesReady(),
			new Promise( ( resolve ) => setTimeout( resolve, 25000 ) ),
		] );
		if ( this.engine && this.engine.meshRenderer ) this.engine.meshRenderer.syncPipelines = false;

	};

}

// App.init performs two hidden warm-up frames before the start overlay is shown. On iOS those frames
// were enough to materialise every lazy GPU buffer (wake, spray, wildlife, shadows, etc.) at once.
// Keep the scene-building work, but defer all actual frames until the user taps Explore and after
// the mobile memory profile has disabled nonessential GPU systems.
const originalAppFrame = App.prototype.frame;
const normalAppFrame = function(...args) {
    updateWaterfrontVisibility(this);
    return originalAppFrame.apply(this,args);
};
App.prototype.frame = normalAppFrame;
if ( mobileFastStart ) {

	App.prototype.frame = function( ...args ) {

		if ( ! this.__bermudaMobileReady ) return;
		return normalAppFrame.apply( this, args );

	};

}

function applyMobileMemoryProfile( app ) {

	if ( ! mobileFastStart || ! app ) return;

	// The 3-cascade 2048² depth array alone is about 48 MB. Resize the lazy texture before its first
	// GPU allocation; 1024² keeps useful shadows while cutting that allocation to one quarter.
	if ( app.shadows && app.shadows.texture && ! app.shadows.texture.gpu ) {

		app.shadows.size = 1024;
		app.shadows.texture.width = 1024;
		app.shadows.texture.height = 1024;
		if ( ShadowUniforms && ShadowUniforms.fields && ShadowUniforms.fields.mapSize ) ShadowUniforms.fields.mapSize.value = 1024;

	}

	// These are secondary visual systems, not gameplay dependencies. Their storage buffers are lazy,
	// so disabling them before the first real frame avoids tens of megabytes of iOS WebGPU allocation
	// while preserving walking, swimming/diving, fishing, boat physics, ocean FFT and interaction.
	if ( app.wake ) {

		if ( app.surface ) app.surface.wake = null;
		app.wake.update = () => {};

	}
	// Keep the low-cost MobileWake active; only the GPU particle spray is disabled on the safe path.
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
		if ( app.wildlife.birdBatch && app.wildlife.birdBatch.mesh ) app.wildlife.birdBatch.mesh.visible = false;
		if ( app.wildlife.critterBatch && app.wildlife.critterBatch.mesh ) app.wildlife.critterBatch.mesh.visible = false;
		if ( app.wildlife.blobs && app.wildlife.blobs.mesh ) app.wildlife.blobs.mesh.visible = false;

	}

	app.__bermudaMobileReady = true;
	window.__bermudaMobileMemoryProfile = 'core-gameplay-v1';

}

function mobileRecoveryURL() {

	// Kept only as a compatibility shim for diagnostics. Mobile failures must never rewrite the URL
	// or reload the page automatically; Safari's page process can otherwise repeat-crash indefinitely.
	return null;

}

function recoverMobileInitGPUError( error ) {

	if ( ! mobileFastStart ) return false;
	const message = String( error && ( error.message || error ) || '' );
	if ( ! /createBuffer|Unable to create buffer|GPUDevice|device lost|destroyed|out of memory|GPU queue/i.test( message ) ) return false;
	try { sessionStorage.setItem( 'bermudaLastGPUError', message || 'mobile GPU init error' ); } catch ( _ ) {}
	return false;

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
		try { sessionStorage.setItem( 'bermudaLastGPUError', String( reason || 'unknown' ) ); } catch ( _ ) {}
		// Do not reload or mutate the URL. Keep the failure visible in-place so one GPU fault cannot
		// become a Safari "problem repeatedly occurred" loop.
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

function startMobileDeferredScenery( app ) {

	if ( ! mobileFastStart || ! app ) return;

	// Never allocate decorative GLBs behind the Explore overlay. The first real WebGPU frames must
	// prove stable before Safari is asked for more geometry/textures. On recovery level 2 we keep the
	// procedural/reference fallbacks for the whole session rather than risking another device loss.
	if ( mobileSafeLevel >= 2 ) {

		window.__bermudaDeferredScenery = 'held-safe-mode';
		return;

	}

	const timer = setTimeout( () => {

		if ( document.visibilityState !== 'visible' || window.__bermudaGPUStall ) return;
		const fps = Number( app.fps || 0 );
		if ( fps > 0 && fps < 24 ) {

			window.__bermudaDeferredScenery = 'held-low-fps';
			return;

		}

		window.__bermudaDeferredScenery = 'tier2-streaming';
		startDeferredWaterfront( app, { initialDelay: 0, tierDelay: 8000, entryDelay: 350, maxTier: 2 } );

	}, 12000 );

	window.addEventListener( 'pagehide', () => clearTimeout( timer ), { once: true } );

}

function installDesktopQualityGovernor( app ) {

	if ( mobileDevice || ! app || app.qs?.has?.( 'bench' ) || app.qs?.has?.( 'scale' ) ) return;

	const requested = initialParams.get( 'quality' );
	const lockedUltra = requested === 'ultra' || initialParams.has( 'ultra' );
	if ( requested === 'performance' ) {
		app.setRenderScale( 0.70 );
		window.__bermudaGraphicsProfile = 'performance';
		return;
	}

	// A normal shared desktop URL starts at full native internal resolution with the complete
	// desktop world stack. Capable machines therefore see the maximum-quality presentation
	// immediately; only sustained poor frame rate can trigger a local render-scale fallback.
	app.setRenderScale( 1 );
	window.__bermudaGraphicsProfile = lockedUltra ? 'ultra-locked' : 'ultra';
	if ( lockedUltra ) return;

	let low = 0, critical = 0, healthy = 0;
	const timer = setInterval( () => {
		if ( document.visibilityState !== 'visible' || ! Number.isFinite( app.fps ) ) return;
		const fps = app.fps;

		critical = fps < 18 ? critical + 1 : 0;
		low = fps < 28 ? low + 1 : 0;
		healthy = fps > 52 ? healthy + 1 : 0;

		if ( critical >= 3 && app.settings.renderScale > 0.65 ) {
			app.setRenderScale( 0.65 );
			window.__bermudaGraphicsProfile = 'adaptive-low';
			critical = low = healthy = 0;
		} else if ( low >= 5 && app.settings.renderScale > 0.80 ) {
			app.setRenderScale( 0.80 );
			window.__bermudaGraphicsProfile = 'adaptive-balanced';
			critical = low = healthy = 0;
		} else if ( healthy >= 10 && app.settings.renderScale < 1 ) {
			app.setRenderScale( Math.min( 1, app.settings.renderScale + 0.15 ) );
			window.__bermudaGraphicsProfile = app.settings.renderScale >= 0.99 ? 'ultra' : 'adaptive-balanced';
			critical = low = healthy = 0;
		}
	}, 1000 );

	window.addEventListener( 'pagehide', () => clearInterval( timer ), { once: true } );

}

function installMobileAudioResume( app ) {

	if ( ! app.audio ) return;
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
	document.addEventListener( 'pointerup', wakeAudio, { capture: true, passive: true } );
	document.addEventListener( 'touchstart', wakeAudio, { capture: true, passive: true } );
	document.addEventListener( 'touchend', wakeAudio, { capture: true, passive: true } );
	document.addEventListener( 'click', wakeAudio, { capture: true, passive: true } );

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
	// Waterfront is one of the slowest first-launch phases on mobile, so give it a real section of
	// the progress bar instead of jumping to 99% before the network/model work has happened.
	const waterfrontStart = mobileDevice ? 0.78 : 0.90;
	const waterfrontEnd = mobileDevice ? 0.94 : 0.975;
	ui.setLoading( waterfrontStart, 'Loading harbour assets…', waterfrontEnd );
	app.onWaterfrontProgress = info => {
		if ( ! info || typeof info !== 'object' ) return;
		const tierBase = info.tier === 1 ? 0.78 : info.tier === 2 ? 0.84 : 0.92;
		const tierSpan = info.tier === 1 ? 0.06 : info.tier === 2 ? 0.08 : 0.06;
		const ratio = info.total > 0 ? Math.max( 0, Math.min( 1, info.index / info.total ) ) : 0;
		const p = Math.min( 0.985, tierBase + tierSpan * ratio );
		const label = info.tier === 1 ? 'Loading harbour' : info.tier === 2 ? 'Building waterfront' : 'Finishing island backdrop';
		ui.setLoading( p, `${ label } · ${ info.id || '' }`, Math.min( 0.99, tierBase + tierSpan ) );
		if ( info.total > 0 ) ui.setLoadingDetail( info.index, info.total );
	};
	app.onWaterfrontRetry = ( id, attempt, total ) => {
		ui.setLoading( undefined, `Connection retry ${ attempt }/${ total - 1 } · ${ id }` );
	};
    const waterfront = await applyBermudaRuntimeLook( app );
    if ( app.relic001 && ! app.relic ) {
        app.relic = new RelicVehicle( { app, vehicle: app.relic001 } );
        app.player.relic = app.relic;
    }
    if ( ! waterfront?.ready ) {
        const details = waterfront?.errors.map( e => e.id + ': ' + e.message ).join( '; ' );
        throw new Error( 'Waterfront failed to initialize: ' + ( details || 'scene unavailable' ) );
    }
    if ( waterfront?.degraded ) {
        ui.setLoading( 0.945, 'Using stable harbour fallback', 0.97 );
    }
    if ( mobileDevice ) {
        // Boot-critical waterfront is now either loaded or safely represented by the procedural fallback.
        ui.setLoading( 0.96, 'Finalizing mobile controls…', 0.99 );
    }
	app.ui = new AppUI( app, ui );
	applyBermudaBranding( mobileDevice );
	if ( mobileDevice ) {

		installStableMobileControls( app );
		installMobileScreenshotHUD( app );
		installMobileAudioResume( app );

		// A little extra RCAS sharpening compensates for mobile render scaling without increasing the
		// internal render resolution enough to recreate the WebGPU device-loss problem.
		if ( app.post && app.post.params && app.post.params.sharpen ) app.post.params.sharpen.value = 0.54;

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
	if ( mobileDevice ) {

		// Build every mobile waterfront tier while the frame loop is still stopped. The 161 MB package
		// is already local at this point, so this stage is decode/place/upload only—no runtime streaming.
		ui.setLoading( 0.84, 'Building complete mobile environment…', 0.988 );
		await preloadCompleteMobileWaterfront( app, { entryDelay: 120 } );
		window.__bermudaDeferredScenery = 'all-mobile-tiers-preloaded-before-explore';
		window.__bermudaRuntimeStreamingDisabled = true;

	}

	ui.setLoading( 0.99, 'Final checks…', 0.999 );
	ui.setLoading( 1, 'Ready' );
	await ui.hideLoader();
	window.dispatchEvent( new Event( 'bermuda-game-ready' ) );
	// frame-time benchmark and reference shots (see core/Bench.js): it drives the frames itself
	if ( app.qs.has( 'bench' ) ) {

		window.__bench = new ( await import( './core/Bench.js' ) ).Bench( app );
		if ( app.qs.has( 'auto' ) ) window.__job = window.__bench.auto( app.qs.get( 'auto' ), { runs: Number( app.qs.get( 'runs' ) ) || 1 } );
		// ?bench&shots=view1,view2[&tag=name][&dt=seconds][&seq=n&every=frames]: reference shots of the named views only (core/DebugViews.js; dt > 0: the clock runs, e.g. for the eased lens flare)
		// &wdbg=N: the water shader's debug view (WaterMaterial debugMode) in the shots
		if ( app.qs.has( 'wdbg' ) && app.waterMaterial ) app.waterMaterial.debugMode.value = Number( app.qs.get( 'wdbg' ) );
		if ( app.qs.has( 'shots' ) ) window.__job = window.__bench.shots( app.qs.get( 'shots' ).split( ',' ), { tag: app.qs.get( 'tag' ) || 'shot', dt: Number( app.qs.get( 'dt' ) ) || 0, seq: Number( app.qs.get( 'seq' ) ) || 1, every: Number( app.qs.get( 'every' ) ) || 1 } );

	} else if ( mobileDevice ) {

		// Do not run the full WebGPU frame loop behind the mobile start overlay. Start exactly once
		// from the user gesture after the mobile memory profile is installed.
		let started = false;
		ui.showStartOverlay( () => {

			if ( started ) return;
			started = true;
			if ( app.audio ) app.audio.resume();
			installMobileGPUWatchdog();
			app.start();

		} );
		return;

	} else {

		app.start();
		installDesktopQualityGovernor( app );
            startDeferredWaterfront(app);

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
