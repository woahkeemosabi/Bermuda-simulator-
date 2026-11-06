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
import { gpuStage, gpuQueueAck, gpuReport, gpuDetailedReport, gpuTraceEvent } from './mobile/GpuAudit.js';
import { MOBILE_75, MOBILE_SHARP_85, configureMobile75Url, configureMobileSharp85Url, getFftCoreVisualProfile } from './mobile/Mobile75Config.js';
import { preloadMobileStartup } from './mobile/MobileStartupPreload.js';
import { cacheStartupAssets, holdUntilMobileReady, isStartupCacheReady, markStartupCacheReady } from './mobile/StartupAssetCache.js';
import { getGpuTraceCase, configureGpuTraceUrl, nextGpuTraceUrl } from './mobile/GpuTraceCases.js';

// Keep every gameplay/visual effect enabled on mobile; adapt rendering resolution and compile scheduling.
// Buildings and decorative world assets stream separately instead of crowding the spawn beach.
// Add ?desktop to the URL to force the full desktop path on a mobile device for diagnostics.
const mobileDevice = /iPhone|iPad|iPod|Android/i.test( navigator.userAgent ) ||
	( navigator.maxTouchPoints > 1 && Math.min( screen.width, screen.height ) < 1024 );
const forceDesktop = new URLSearchParams( location.search ).has( 'desktop' );
const mobileFastStart = mobileDevice && ! forceDesktop;
const gpuTraceActive = mobileFastStart && new URLSearchParams(location.search).get('gpuTrace')==='1';
// Use the normal mobile budget when diagnosing a crash. High-resolution
// repro is opt-in; otherwise tracing itself changes the variable under test.
const gpuTraceHighRes = gpuTraceActive && new URLSearchParams(location.search).get('traceHighRes')==='1';
const gpuTraceCase = getGpuTraceCase(new URLSearchParams(location.search).get('traceCase'));
// Low-memory recovery path, opt-in so desktop and full graphics are unchanged.
const mobileRecovery = mobileFastStart && new URLSearchParams(location.search).get('recovery') === '1';
// The mobile build defaults to active effects at 75%; ?graphics=stable restores
// the known-running low-GPU mode without redirecting players to another site.
const mobileGraphics75 = mobileFastStart && !mobileRecovery &&
	(gpuTraceActive || new URLSearchParams(location.search).get('graphics') !== 'stable');
const mobileLowGPU = mobileFastStart && !mobileGraphics75;
// Opt-in quality trial: more real scene pixels, same FFT and GPU effects,
// with reflection baking isolated as in the five-minute-stable iPhone run.
const mobileSharp85Test = mobileGraphics75 && !gpuTraceActive &&
	new URLSearchParams(location.search).get('qualityTest') === 'sharp85';
// Opt-in quality trials only for the already-stable FFT-core isolation case.
// Other diagnostic cases and the default test retain their original budgets.
const mobileFftVisualTest = mobileGraphics75 && gpuTraceActive && gpuTraceCase.id === 'fftcore'
	? getFftCoreVisualProfile(new URLSearchParams(location.search).get('qualityTest')) : null;
window.__bermudaMobileGraphics75 = mobileGraphics75;
// Preserve the existing safe query and underwater-light readback scheduling.
window.__bermudaFreezeUnderwaterLight = mobileFastStart;
window.__bermudaThrottleWaterQueries = mobileFastStart;
window.__bermudaDisableSwashProbe = mobileFastStart;
window.__bermudaSparseVegetation = mobileFastStart;
window.__bermudaBuildMarker = 'webgpu-isolation-v5-20261023';
const missionIsolation = new URLSearchParams(location.search).get('missions') === 'off';
window.__bermudaMissionsDisabledForTest = missionIsolation;
let mobileRetryLevel = 0;
if ( mobileFastStart ) {
	try {
		mobileRetryLevel = Math.min( 3, Math.max( 0,
			Number( sessionStorage.getItem( 'bermudaGpuRetryLevel' ) ) || 0 ) );
	} catch (_) { /* storage may be blocked */ }
}
window.__bermudaMobileOutputScale = gpuTraceActive && mobileGraphics75
	? (gpuTraceHighRes ? 1.35 : (mobileFftVisualTest?.renderScale ?? MOBILE_75.renderScale)) : mobileSharp85Test ? MOBILE_SHARP_85.renderScale : mobileGraphics75 ? MOBILE_75.renderScale :
	( mobileLowGPU ? 0.85 : (mobileRecovery ? 0.56 : (mobileRetryLevel > 0 ? 0.54 : 0.64)) );

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
	if ( mobileGraphics75 ) configureMobile75Url( url );
	if ( mobileSharp85Test ) configureMobileSharp85Url( url );
	if ( gpuTraceActive && mobileGraphics75 ) configureGpuTraceUrl( url );
	if ( mobileFftVisualTest ) url.searchParams.set('scale',String(mobileFftVisualTest.sceneScale));
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
	window.__bermudaMobileMemoryProfile = mobileGraphics75 ? 'effects75-original-four-cascade-fft' :
		(mobileRecovery ? 'recovery-ocean2-progressive-lighting' : 'frozen-ocean-mobile-stable');
	window.__bermudaMobileBudget = {
		oceanCascades: app.fft?.cascades,
		wakeGrid: '256x256', shoreFoamGrid: app.shoreSim?.res,
		sprayParticleCapacity: app.spray?.N,
		cloudSteps: mobileGraphics75 ? 'panorama-only' : 0,
		caustics: Boolean( app.caustics )
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
if(gpuTraceActive)installGpuTraceControls();

app.init( ( p, text, until ) => {
  gpuStage('Loading: '+String(text||''));
  ui.setLoading( p, text, until );
} ).then( async () => {

	if ( mobileFastStart ) applyMobileMemoryProfile( app );
	if (mobileFastStart && (!mobileGraphics75 || new URLSearchParams(location.search).has('debugBuild'))) {
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
	// Keep the loader visible until mobile scene verification and startup priming
	// have actually finished; the desktop/benchmark paths finish below.

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
		if (mobileRecovery || app.qs.has('renderTest')) {
			// Controlled render-pass diagnostics bypass HDR GPU readback verification.
			// The standard production path still verifies real scene pixels.
			validateSpawn(app);
			window.__bermudaWorldGate = {status:app.qs.has('renderTest')?'render-test-no-readback':'recovery-no-readback',tries:0};
		} else {
			await verifyMobileWorld( app, attempt => ui.setLoading(
				Math.min(.975+attempt*.003,.99), 'Rendering Bermuda world…', .995 ) );
		}
		if ( !mobileRecovery && !app.qs.has( 'renderTest' ) ) {
			gpuStage( 'Mobile world preload' );
			await preloadMobileStartup( {
				frame: dt => app.frame( dt ),
				queueDone: () => GPU.queue.onSubmittedWorkDone(),
				pipelinesReady: () => GPU.pipelinesReady(),
				checkDevice: () => {
					if ( GPU.fatalError || window.__bermudaGpuLost )
						throw GPU.fatalError || new Error( window.__bermudaGpuLost );
				},
				onProgress: ( step, total, status ) => ui.setLoading(
					0.983 + 0.012 * ( step - 1 ) / total, status, .995 ),
				onQueueAck: () => gpuQueueAck( GPU.frame ),
			} );
		}
		if ( !app.qs.has( 'renderTest' ) && !gpuTraceActive && !app.qs.has( 'bench' ) ) {
			gpuStage( 'Caching reusable mobile assets' );
			const baseUrl = new URL( import.meta.env.BASE_URL || './', location.href );
			ui.setLoading( .994, 'Saving reusable game files…', .995 );
			window.__bermudaAssetCacheState = await cacheStartupAssets( {
				baseUrl,
				onProgress: ( done, total ) => ui.setLoading(
					.994, `Saving game files · ${done}/${total}…`, .995 ),
			} );
			if ( !isStartupCacheReady( window.__bermudaAssetCacheState, window.localStorage ) ) {
				await holdUntilMobileReady( {
					startedAt: 0, // first complete load takes at least a minute
					checkDevice: () => {
						if ( GPU.fatalError || window.__bermudaGpuLost )
							throw GPU.fatalError || new Error( window.__bermudaGpuLost );
					},
					onProgress: seconds => ui.setLoading(
						.994, `World prepared · Explore available in ${seconds}s`, .995 ),
				} );
				markStartupCacheReady( window.__bermudaAssetCacheState, window.localStorage );
			}
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
			if(gpuTraceActive)setTimeout(()=>{
				if(!window.__bermudaTraceFailed && !window.__bermudaGpuLost){
					gpuTraceEvent('checkpoint','30 seconds of gameplay without device loss');
					saveGpuTraceOutcome('30s checkpoint','No GPU loss observed in first 30 seconds');
				}
			},30000);
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
	if(gpuTraceActive){
		if(!window.__bermudaTraceFailed){
			window.__bermudaTraceFailed=true;
			gpuTraceEvent('failure screen',message);
			saveGpuTraceOutcome('lost',message);
			try{sessionStorage.setItem('bermudaGpuLastTrace',gpuDetailedReport(app,mobileRetryLevel));}catch(_){}
		}
	}
	const L=document.getElementById('loader');
	if(L){L.style.display='';L.classList.remove('tw-hidden');}
	ui.setLoadingError(message);
	const diag=document.getElementById('bm-gpu-trace');
	if(diag){diag.textContent=gpuReport(app,mobileRetryLevel)+
		(gpuTraceActive?'\nGPU TRACE '+gpuTraceCase.id+' — tap Copy diagnostics to get complete event history.':'');diag.hidden=false;}
	const copy=document.getElementById('bm-gpu-copy');
	if(copy){
		copy.hidden=false;
		copy.onclick=async()=>{
			try{await navigator.clipboard.writeText(message+'\n'+(gpuTraceActive?gpuDetailedReport(app,mobileRetryLevel):gpuReport(app,mobileRetryLevel)));
				copy.textContent='Diagnostics copied';}
			catch(e){copy.textContent='Screenshot diagnostics';}
		};
	}
	const retry=document.getElementById('bm-loader-retry');
	if(retry){
		retry.hidden=false;
		if (gpuTraceActive) retry.textContent='Next GPU diagnostic';
		else if (mobileGraphics75) retry.textContent='Use stable graphics';
		retry.onclick=()=>{
			if(gpuTraceActive){location.assign(nextGpuTraceUrl(location.href).href);return;}
			// If the experimental effects overload iPhone WebGPU, the button
			// returns to the known-running profile within this same preview.
			if (mobileGraphics75) {
				const fallback=new URL(location.href);
				fallback.searchParams.set('graphics','stable');
				location.assign(fallback.href);
				return;
			}
			// Normal retries retain the established production behavior.
			try { sessionStorage.setItem('bermudaGpuRetryLevel',String(Math.min(3,mobileRetryLevel+1))); }
			catch(_){}
			location.reload();
		};
	}
}
function saveGpuTraceOutcome(status,detail){
	if(!gpuTraceActive)return;
	try{
		const key='bermudaGpuTraceOutcomes';
		const previous=JSON.parse(sessionStorage.getItem(key)||'[]');
		const list=Array.isArray(previous)?previous.slice(-18):[];
		list.push({case:gpuTraceCase.id,status,detail:String(detail).slice(0,160),time:new Date().toISOString()});
		sessionStorage.setItem(key,JSON.stringify(list));
	}catch(_){}
}
function installGpuTraceControls(){
	// A small, opt-in DOM-only control: no GPU render passes, readbacks or server telemetry.
	const toggle=document.createElement('button');
	toggle.textContent='GPU TRACE · '+gpuTraceCase.id;
	Object.assign(toggle.style,{position:'fixed',bottom:'max(145px, env(safe-area-inset-bottom))',left:'8px',zIndex:'2147483647',background:'#071c2a',color:'#e0fcff',border:'1px solid #4ec4bd',borderRadius:'10px',padding:'8px 10px',font:'600 11px system-ui'});
	const panel=document.createElement('div');
	Object.assign(panel.style,{position:'fixed',left:'8px',right:'8px',bottom:'max(192px, env(safe-area-inset-bottom))',zIndex:'2147483647',background:'#071823',color:'#f0fafb',border:'1px solid #4ec4bd',borderRadius:'10px',padding:'12px',font:'12px system-ui',maxHeight:'40vh',overflowY:'auto',display:'none'});
	const title=document.createElement('div');title.textContent='GPU isolation: '+gpuTraceCase.label+' · original FFT stays active';panel.appendChild(title);
	const status=document.createElement('pre');status.style.whiteSpace='pre-wrap';panel.appendChild(status);
	const actions=document.createElement('div');Object.assign(actions.style,{display:'flex',gap:'8px',marginTop:'8px'});panel.appendChild(actions);
	const makeButton=(text,fn)=>{const b=document.createElement('button');b.textContent=text;b.style.cssText='border:1px solid #4ec4bd;border-radius:8px;padding:8px;color:white;background:#16404a';b.onclick=fn;actions.appendChild(b);};
	makeButton('Copy full trace',async()=>{
		let past='';try{past=sessionStorage.getItem('bermudaGpuLastTrace')||'';}catch(_){}
		const body=gpuDetailedReport(app,mobileRetryLevel)+(past?'\n\nPREVIOUS FAILED CASE\n'+past:'');
		try{await navigator.clipboard.writeText(body);status.textContent='Full trace copied.\n'+body.slice(0,1100);}catch(_){status.textContent=body;}
	});
	makeButton('Next test',()=>location.assign(nextGpuTraceUrl(location.href).href));
	toggle.onclick=()=>{
		panel.style.display=panel.style.display==='none'?'block':'none';
		if(panel.style.display==='block'){
			let previous='';try{previous=JSON.parse(sessionStorage.getItem('bermudaGpuTraceOutcomes')||'[]').map(x=>x.case+': '+x.status).join('\n');}catch(_){}
			status.textContent=(previous||'No previous test outcomes')+'\n\n'+gpuReport(app,mobileRetryLevel);
		}
	};
	document.body.append(toggle,panel);
}
window.__bermudaOnGPUFailure=message=>{
	app.engine?.stop();
	showWorldFailure('Graphics device failed: '+message);
};

