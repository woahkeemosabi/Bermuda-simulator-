#!/usr/bin/env python3
"""Patch only the existing GitHub Pages /qa/fftcore/ build.

This is run after checking out the pinned, previously working Tidewater
snapshot, before building it with Vite. It never modifies the live main
game, the October/September archives, or the player's saved progress.
"""
from pathlib import Path
from shutil import copyfile

root = Path("_qa/fftcore")
assert (root / "src/main.js").is_file(), "Missing pinned QA checkout"

# Keep the original QA source pin and save namespace. Apply only the
# adapter-safe mip shaders from this tested repository commit, so a successful
# change can be evaluated at the SAME /qa/fftcore/ URL rather than deploying
# an untested alternate game or modifying production saves.
for relative in ("src/ocean/ComputeMips.js", "src/ocean/OceanFFT.js", "src/ocean/FoamTexture.js"):
    current = Path(relative)
    target = root / relative
    assert current.is_file() and target.is_file(), f"Missing QA mip source: {relative}"
    copyfile(current, target)
print("QA shader compatibility: copied 4-storage-texture mip kernels; FFT size/cascades preserved")


def replace_once(path: str, old: str, new: str):
    file = root / path
    text = file.read_text()
    count = text.count(old)
    assert count == 1, f"{path}: expected exactly one match, found {count}: {old[:65]!r}"
    file.write_text(text.replace(old, new, 1))


# Isolate the QA game's persistent data and downloaded file cache.
replace_once("src/game/GameState.js",
    "const SAVE_KEY = 'tidewater.save.v1';",
    "const SAVE_KEY = 'bermuda.qa.fftcore.save.v1';")
replace_once("src/mobile/StartupAssetCache.js",
    "'bermuda-assets-20261105-v1'",
    "'bermuda-qa-fftcore-assets-v1'")
replace_once("src/mobile/StartupAssetCache.js",
    "'bermuda-startup-ready-20261105-v1'",
    "'bermuda-qa-fftcore-startup-ready-v1'")
replace_once("public/sw.js",
    "const CACHE = 'bermuda-assets-20261105-v1';",
    "const CACHE = 'bermuda-qa-fftcore-assets-v1';")
replace_once("public/sw.js",
    "const PREFIX = 'bermuda-assets-';",
    "const PREFIX = 'bermuda-qa-fftcore-assets-';")


# Minimal console checkpoints in the *pinned* QA revision, without changing
# gameplay, shader output, GPU allocations or cache namespaces. The worktree's
# OceanFFT and FoamTexture sources have matching passive diagnostics.
for old, label in (
    ("this.fft = new OceanFFT( renderer, qs.has('freezeFFT') ? {cascades:1} : (this.recoveryMode ? {cascades:2} : {}) );", "FFT constructor"),
    ("this.foamTexture = createFoamTexture( renderer );", "foam texture construction"),
    ("this.oceanLOD = new CDLOD( { gridSize: Number( qs.get( 'G' ) || 32 ), leafSize: 8, levels: 12, minY: - 25, maxY: 25 } );", "ocean LOD geometry"),
    ("this.surface = new WaterSurface( { fft: this.fft, cdlod: this.oceanLOD, foamTexture: this.foamTexture } );", "water surface module"),
):
    prefix = "if (qs.get('gpuTrace') === '1') console.info('[Bermuda init] " + label + " start');\n"
    suffix = "\nif (qs.get('gpuTrace') === '1') console.info('[Bermuda init] " + label + " complete');"
    replace_once("src/App.js", old, prefix + old + suffix)

# Trace the subsequent systems after WaterSurface without changing their
# construction, allocations, scheduling, visual quality or saved-game state.
for old, label in (
    ("this.seaDetail = new SeaDetail();", "sea detail"),
    ("this.shore = new ShoreWaves( this.terrainGPU );", "shore-wave module"),
    ("installGroundBounce( { terrain: this.terrainGPU, clouds: this.clouds } );", "ground bounce"),
    ("this.sceneRenderer = new SceneRenderer( engine.meshRenderer, scene, camera );", "scene renderer"),
    ("this.query = new WaterQuery( renderer, this.surface );", "water query setup"),
    ("await progress( 0.34, 'Preparing the shaders…' );", "shader preparation progress"),
    ("await this.precompile();", "pipeline precompilation"),
):
    prefix = "if (qs.get('gpuTrace') === '1') console.info('[Bermuda init] " + label + " start');\n"
    suffix = "\nif (qs.get('gpuTrace') === '1') console.info('[Bermuda init] " + label + " complete');"
    replace_once("src/App.js", old, prefix + old + suffix)

for old, label in (
    ("this.underwaterLighting = installUnderwaterLighting( {", "underwater light install start"),
    ("this.refraction = new RefractionPass(", "refraction pass setup start"),
    ("this.waterMaterial = new WaterMaterial( {", "water material setup start"),
    ("this.waterMaterial.clouds = this.clouds;", "water material setup complete"),
    ("this.post = mobileLite && !qs.has('fullPost')", "post-processing setup start"),
    ("G.exposure.value = this.settings.exposure;", "post-processing setup complete"),
):
    prefix = "if (qs.get('gpuTrace') === '1') console.info('[Bermuda init] " + label + "');\n"
    replace_once("src/App.js", old, prefix + old)

# Determine whether Chromium's precompile stall occurs in PostFX build,
# asynchronous shader pipeline drain, synchronous forced-hull render, or
# queue completion. These are passive console markers in pinned QA only.
replace_once("src/App.js",
    "async precompile() {\n\n\t\tconst mr = this.engine.meshRenderer;",
    "async precompile() {\n\n\t\tconsole.info('[Bermuda precompile] enter');\n\t\tconst mr = this.engine.meshRenderer;")
replace_once("src/App.js",
    "this.post._build();",
    "console.info('[Bermuda precompile] post FX build start');\n\t\t\tthis.post._build();\n\t\t\tconsole.info('[Bermuda precompile] post FX build complete');")
replace_once("src/App.js",
    "await GPU.pipelinesReady();\n\t\tmr.precompiling = true;",
    "console.info('[Bermuda precompile] initial pipelines start pending=' + GPU._pending?.size);\n\t\tawait GPU.pipelinesReady();\n\t\tconsole.info('[Bermuda precompile] initial pipelines complete');\n\t\tmr.precompiling = true;")
replace_once("src/App.js",
    "if ( sr.hullMasks.length ) mr.render( sr.hullMaskScene, {",
    "console.info('[Bermuda precompile] hull mask render start');\n\t\tif ( sr.hullMasks.length ) mr.render( sr.hullMaskScene, {")
replace_once("src/App.js",
    "\t\ttry {\n\n\t\t\t// both water variants: with the hull-mask discard",
    "\t\tconsole.info('[Bermuda precompile] hull mask render complete');\n\t\ttry {\n\n\t\t\t// both water variants: with the hull-mask discard")
replace_once("src/App.js",
    "this.waterMaterial.hullOverride = hull;\n\t\t\t\tthis.frame( 1 / 60 );",
    "this.waterMaterial.hullOverride = hull;\n\t\t\t\tconsole.info('[Bermuda precompile] warm frame ' + hull + ' start');\n\t\t\t\tthis.frame( 1 / 60 );\n\t\t\t\tconsole.info('[Bermuda precompile] warm frame ' + hull + ' complete');")
replace_once("src/App.js",
    "\t\tthis.refraction.enabled = refr;\n\t\tawait GPU.pipelinesReady();\n\t\tawait GPU.queue.onSubmittedWorkDone();",
    "\t\tthis.refraction.enabled = refr;\n\t\tconsole.info('[Bermuda precompile] final pipelines start pending=' + GPU._pending?.size);\n\t\tawait GPU.pipelinesReady();\n\t\tconsole.info('[Bermuda precompile] final pipelines complete; queue fence start');\n\t\tawait GPU.queue.onSubmittedWorkDone();\n\t\tconsole.info('[Bermuda precompile] queue fence complete');")
print("QA precompile: installed passive checkpoints without changing shader compilation")

# Controlled A/B probe on the pinned QA copy ONLY. ?compileSlots=2 caps the
# number of in-flight asynchronous pipeline compiles. With no query flag the
# original WebGPU pipeline scheduling is preserved. This tests whether the
# Chromium software-adapter precompile hang is related to compile pressure,
# without changing ocean resolution, effects, game saves, or production main.
replace_once("src/engine/gpu/GPU.js",
    "\t_pending: new Set(),",
    """\t_pending: new Set(),
    _compileActive: 0,
    _compileWaiting: [],
    _acquireCompileSlot(limit) {
        if (this._compileActive < limit) {
            this._compileActive++;
            return Promise.resolve();
        }
        return new Promise(resolve => this._compileWaiting.push(resolve));
    },
    _releaseCompileSlot() {
        const next = this._compileWaiting.shift();
        if (next) next();
        else this._compileActive--;
    },""")
replace_once("src/engine/gpu/GPU.js",
    "const p = Promise.resolve().then( () => {",
    """const compileSlots = Math.min(4, Math.max(0,
            Number(new URLSearchParams(location.search).get('compileSlots')) || 0));
        if (compileSlots && !this._compileCapLogged) {
            this._compileCapLogged = true;
            console.info('[Bermuda compile] async pipeline concurrency cap=' + compileSlots);
        }
        const gate = compileSlots ? this._acquireCompileSlot(compileSlots) : Promise.resolve();
        const p = gate.then( () => {""")
replace_once("src/engine/gpu/GPU.js",
    "} ).finally( () => this._pending.delete( p ) );",
    """} ).finally( () => {
            if (compileSlots) this._releaseCompileSlot();
            this._pending.delete(p);
        } );""")
print("QA compile experiment: optional 2-slot asynchronous pipeline gate installed")


# All graphical settings match the playable Crisp FFT-core case.
replace_once("src/main.js",
    "const gpuTraceActive = mobileFastStart && new URLSearchParams(location.search).get('gpuTrace')==='1';",
    "const gpuTraceActive = mobileFastStart; // iPhone QA always uses FFT-core.")
replace_once("src/main.js",
    "const gpuTraceCase = getGpuTraceCase(new URLSearchParams(location.search).get('traceCase'));",
    "const gpuTraceCase = getGpuTraceCase('fftcore');")
replace_once("src/main.js",
    "getFftCoreVisualProfile(new URLSearchParams(location.search).get('qualityTest'))",
    "getFftCoreVisualProfile('crisp')")
replace_once("src/main.js",
    "if ( gpuTraceActive && mobileGraphics75 ) configureGpuTraceUrl( url );",
    """if (gpuTraceActive && mobileGraphics75) {
        url.searchParams.delete('traceHighRes');
        url.searchParams.set('gpuTrace', '1');
        url.searchParams.set('traceCase', 'fftcore');
        url.searchParams.set('qualityTest', 'crisp');
        url.searchParams.set('envtest', 'skip');
        configureGpuTraceUrl(url); // FFT on, auxiliary passes off, G=12
    }""")


# Read-only diagnostic reports should describe the actual locked profile.
replace_once("src/mobile/GpuAudit.js",
    "traceCase:typeof location!=='undefined'?new URLSearchParams(location.search).get('traceCase')||'full':'none',",
    "traceCase:'fftcore',")


# A small worker prepares decoded sound while the scene renders.
copyfile("tools/QAStartupAudio.js", root / "src/mobile/QAStartupAudio.js")
replace_once("src/main.js",
    "import { getGpuTraceCase, configureGpuTraceUrl } from './mobile/GpuTraceCases.js';",
    "import { getGpuTraceCase, configureGpuTraceUrl } from './mobile/GpuTraceCases.js';\n"
    "import { preloadQAStartupAudio } from './mobile/QAStartupAudio.js';")

# If offline decoding isn't supported, use the already downloaded audio
# bytes in the first unlocked AudioContext rather than fetching again.
replace_once("src/audio/SoundScape.js",
    "const p = fetch( this.baseUrl + BANK[ name ].file )",
    """const prepared = this._preloadedAudioBytes?.get(name);
            const p = (prepared
                ? Promise.resolve({ok:true, arrayBuffer:()=>Promise.resolve(prepared.slice(0))})
                : fetch(this.baseUrl + BANK[name].file))""")

# Start the audio preloader immediately after App initialization, before
# the mobile world verification and GPU warm-up. They run concurrently.
replace_once("src/main.js",
    "ui.setLoading( .97, 'Validating the 3D world…', .995 );",
    """const qaWarmStart = performance.now();
        const qaAudioReady = app.audio
            ? preloadQAStartupAudio(app.audio)
            : Promise.resolve({decoded:0,downloaded:0,total:0});
        ui.setLoading(.97, 'Preparing Bermuda world and sound…', .995);""")

# Warm real GPU frames sequentially at low load for a full minute.
replace_once("src/main.js",
    "frameCount: mobileFullEffects ? MOBILE_FULL_PRELOAD_FRAMES : undefined,",
    "frameCount: MOBILE_FULL_PRELOAD_FRAMES,")
replace_once("src/main.js",
    "frameWaitMs: mobileFullEffects ? MOBILE_FULL_PRELOAD_WAIT_MS : undefined,",
    "frameWaitMs: MOBILE_FULL_PRELOAD_WAIT_MS,")
replace_once("src/main.js",
    "ui.setLoading( 0.983 + 0.012 * ( step - 1 ) / total, status, .995 );",
    "ui.setLoading(0.983 + 0.012 * (step - 1) / total, status.replace('full-quality Bermuda', 'stable Bermuda'), .995);")

# Do not show Explore just because a loader animation has reached 100%.
# Await the real frame warm-up AND downloaded/decoded audio, then enforce
# 60 seconds measured FROM scene preparation, not page navigation.
replace_once("src/main.js",
    "\t\tui.setLoading( 1, 'World ready' );",
    """        if (gpuTraceActive && gpuTraceCase.id === 'fftcore') {
            gpuStage('Finishing 60-second FFT and audio preload');
            ui.setLoading(.996, 'Finishing Bermuda sound…', .999);
            await Promise.race([
                qaAudioReady,
                new Promise(resolve => setTimeout(resolve, 20000)),
            ]);
            await holdUntilMobileReady({
                startedAt: qaWarmStart,
                minimumMs: 60000,
                checkDevice: () => {
                    if (GPU.fatalError || window.__bermudaGpuLost)
                        throw GPU.fatalError || new Error(window.__bermudaGpuLost);
                },
                onProgress: seconds => ui.setLoading(
                    .998, 'Preparing Bermuda · ' + seconds + 's remaining', .999),
            });
        }
        ui.setLoading(1, 'World and audio ready');""")

# Unlock sound INSIDE the Explore pointer event. Safari requires a gesture.
replace_once("src/main.js",
    "// Keep sound off on mobile until the renderer is proven stable.\n\t\t\t// ?audio=on is an explicit diagnostic opt-in; sound is not required to play.",
    "// Audio is prepared during the scene warm-up, then unlocked by this tap.")
replace_once("src/main.js",
    "gpuStage('Starting simulation (mobile audio disabled)');",
    """gpuStage('Starting simulation (audio prepared)');
            if (app.audio) void app.audio.resume().catch(error =>
                console.warn('Bermuda audio start:', error));""")
replace_once("src/main.js",
    "if ( app.audio && new URLSearchParams(location.search).get('audio') === 'on' ) {\n"
    "\t\t\t\ttry { app.audio.resume(); } catch (error) { console.warn('Audio resume failed', error); }\n"
    "\t\t\t}",
    "// Sound starts on the Explore tap, not thirty seconds into gameplay.")

# Safari pauses Web Audio when backgrounded. Only resume after returning
# to the foreground, without touching the GPU context or saved game.
replace_once("src/main.js",
    "let started = false;\n\t\tui.showStartOverlay( () => {",
    """let started = false;
        const restoreQAAudio = () => {
            if (!started || document.hidden || !app.audio ||
                app.audio.muted || app.audio.enabled) return;
            void app.audio.resume().catch(error =>
                console.warn('Bermuda audio restore:', error));
        };
        window.addEventListener('focus', restoreQAAudio);
        window.addEventListener('pageshow', restoreQAAudio);
        document.addEventListener('visibilitychange', restoreQAAudio);
        document.addEventListener('pointerdown', restoreQAAudio, {capture:true, passive:true});
        document.addEventListener('touchend', restoreQAAudio, {capture:true, passive:true});
        ui.showStartOverlay( () => {""")

# The mobile page *overrides* App.prototype.precompile in main.js. Markers
# inside App.precompile therefore do not observe the actual mobile execution.
# Trace the Promise.race winner and pending pipelines in that override directly.
# This is observational only: it keeps the original time limit, the FFT,
# resolution and the existing startup/saved-game behaviour unchanged.
replace_once("src/main.js",
    "App.prototype.precompile = async function() {\n\n"
    "\t\t// Full fidelity compiles more shader variants. Give pending compute pipelines\n"
    "\t\t// time to settle before gradually warming the mesh shaders on later frames.\n"
    "\t\tawait Promise.race( [\n"
    "\t\t\tGPU.pipelinesReady(),\n"
    "\t\t\tnew Promise( ( resolve ) => setTimeout( resolve, mobileFullEffects ? 20000 : 6500 ) ),\n"
    "\t\t] );\n"
    "\t\tif ( this.engine && this.engine.meshRenderer ) this.engine.meshRenderer.syncPipelines = false;\n\n"
    "\t};",
    """App.prototype.precompile = async function() {
        const started = performance.now();
        const initialPending = GPU._pending?.size ?? -1;
        console.info('[Bermuda mobile-precompile] enter pending=' + initialPending);
        const pipelines = GPU.pipelinesReady().then(() => {
            console.info('[Bermuda mobile-precompile] pending complete after=' +
                Math.round(performance.now() - started) + 'ms');
            return 'ready';
        });
        let timerId;
        const timeout = new Promise(resolve => {
            timerId = setTimeout(() => {
                console.info('[Bermuda mobile-precompile] timeout pending=' +
                    (GPU._pending?.size ?? -1) + ' after=' +
                    Math.round(performance.now() - started) + 'ms');
                resolve('timeout');
            }, new URLSearchParams(location.search).get('pipelineBatch') === '2' ? 45000 : (mobileFullEffects ? 20000 : 6500));
        });
        const winner = await Promise.race([pipelines, timeout]);
        clearTimeout(timerId);
        console.info('[Bermuda mobile-precompile] exit winner=' + winner +
            ' pending=' + (GPU._pending?.size ?? -1) +
            ' elapsed=' + Math.round(performance.now() - started) + 'ms');
        if (winner === 'timeout' &&
            new URLSearchParams(location.search).get('pipelineBatch') === '2') {
            throw new Error('QA shader readiness timeout with ' +
                (GPU._pending?.size ?? -1) + ' pipelines pending');
        }
        if (this.engine && this.engine.meshRenderer)
            this.engine.meshRenderer.syncPipelines = false;
    };""")
print("QA diagnostic: active mobile precompile override now reports pending shader count and race winner")

# The previous SwiftShader run stopped after post-processing setup, before
# even entering the actual mobile precompile override. Split that remaining
# initialization interval into passive checkpoints, no rendering changes.
for old, label in (
    ("this.setRenderScale( this.settings.renderScale );", "render scale apply"),
    ("this.audio = qs.has( 'noAudio' ) ? null : new SoundScape();", "soundscape creation"),
    ("this.game = new Game( this );", "fishing and vendor gameplay creation"),
    ("this.profiler = new Profiler( renderer );", "profiler creation"),
    ("\t\tthis.updateSun();\n\t\tinstallDebugViews( this );", "sun and debug view setup"),
    ("await progress( 0.36, 'Compiling shaders…', 0.95 );", "precompile progress animation"),
):
    prefix = "if (qs.get('gpuTrace') === '1') console.info('[Bermuda init] " + label + " start');\n"
    suffix = "\nif (qs.get('gpuTrace') === '1') console.info('[Bermuda init] " + label + " complete');"
    replace_once("src/App.js", old, prefix + old + suffix)
print("QA diagnostic: traced all remaining initialization work before mobile shader precompile")

# Diagnostic A/B: on SwiftShader the page has reached all post-creation
# checkpoints, but can stall forever awaiting an rAF before shader precompile.
# Allow a bounded timer fallback only when ?rafTest=bounded. This is NOT a
# render-quality reduction or a deployment default. Keep normal iPhone flow.
replace_once("src/App.js",
    "if ( typeof requestAnimationFrame === 'function' ) await new Promise( ( r ) => requestAnimationFrame( () => setTimeout( r, 0 ) ) );",
    """if (typeof requestAnimationFrame === 'function') {
                const bounded = qs.get('rafTest') === 'bounded';
                await new Promise(resolve => {
                    let finished = false;
                    let fallback;
                    const done = () => {
                        if (finished) return;
                        finished = true;
                        if (fallback !== undefined) clearTimeout(fallback);
                        resolve();
                    };
                    requestAnimationFrame(() => setTimeout(done, 0));
                    if (bounded) fallback = setTimeout(() => {
                        if (qs.get('gpuTrace') === '1')
                            console.info('[Bermuda init] rAF wait exceeded 350ms; using bounded progress fallback');
                        done();
                    }, 350);
                });
            }""")
print("QA diagnostic: opt-in bounded rAF transition (rafTest=bounded), no GPU fidelity change")

# Controlled software-WebGPU experiment: ?pipelineBatch=2 bounds simultaneous
# createRenderPipelineAsync/createComputePipelineAsync promises to TWO.
# The shaders, GPU resource types, FFT quality and recorded render passes are
# unchanged. The default deployed QA game does NOT enable this A/B setting.
# Console checkpoints identify any one shader that starves the GPU process.
replace_once("src/engine/gpu/GPU.js",
    """\t\tconst p = Promise.resolve().then( () => {

\t\t\tif ( h.pipeline ) return;
\t\t\tconst create = kind === 'render' ? this.device.createRenderPipelineAsync : this.device.createComputePipelineAsync;
\t\t\treturn create.call( this.device, desc ).then( ( pipeline ) => {

\t\t\t\tif ( ! h.pipeline ) h.pipeline = pipeline;
\t\t\t\th.desc = null;

\t\t\t}, ( e ) => {

\t\t\t\th.failed = true;
\t\t\t\tgpuError( 'pipeline '+kind, desc.label+': '+String(e?.message||e) );
\t\t\t\tconsole.error( `WebGPU: pipeline "${ desc.label }" failed: ${ e.message.split( '\\n' ).slice( 0, 6 ).join( '\\n' ) }` );

\t\t\t} );

\t\t} ).finally( () => this._pending.delete( p ) );""",
    """\t\tconst p = Promise.resolve().then( async () => {

\t\t\tif ( h.pipeline ) return;
\t\t\tconst batch = typeof location !== 'undefined' &&
\t\t\t\tnew URLSearchParams(location.search).get('pipelineBatch') === '2';
\t\t\tlet gate = null;
\t\t\tif (batch) {
\t\t\t\tgate = this._mobileCompileGate ||= { active: 0, waiters: [] };
\t\t\t\tif (gate.active < 2) gate.active++;
\t\t\t\telse await new Promise(resolve => gate.waiters.push(resolve));
\t\t\t\tconsole.info('[Bermuda compile] start ' + kind + ' ' +
\t\t\t\t\tdesc.label + ' active=' + gate.active +
\t\t\t\t\t' queued=' + gate.waiters.length);
\t\t\t}
\t\t\ttry {
\t\t\t\tconst create = kind === 'render' ?
\t\t\t\t\tthis.device.createRenderPipelineAsync : this.device.createComputePipelineAsync;
\t\t\t\treturn await create.call(this.device, desc).then(pipeline => {
\t\t\t\t\tif (!h.pipeline) h.pipeline = pipeline;
\t\t\t\t\th.desc = null;
\t\t\t\t}, e => {
\t\t\t\t\th.failed = true;
\t\t\t\t\tgpuError('pipeline '+kind, desc.label+': '+String(e?.message||e));
\t\t\t\t\tconsole.error('WebGPU: pipeline "'+desc.label+'" failed: '+String(e?.message||e));
\t\t\t\t});
\t\t\t} finally {
\t\t\t\tif (gate) {
\t\t\t\t\tconsole.info('[Bermuda compile] settled ' + kind + ' ' + desc.label);
\t\t\t\t\tconst next = gate.waiters.shift();
\t\t\t\t\tif (next) next();
\t\t\t\t\telse gate.active = Math.max(0, gate.active - 1);
\t\t\t\t}
\t\t\t}

\t\t} ).finally( () => this._pending.delete( p ) );""")
print("QA experiment: concurrency-limited WebGPU pipeline compilation (pipelineBatch=2)")

# Bound the FIRST GPU queue fence on the experimental pipelineBatch=2 path.
# Do not continue to Explore after an unacknowledged GPU submission. Preserve
# the untouched timing/behaviour for the original iPhone QA link.
replace_once("src/App.js",
    "this.frame( 1 / 60 );\n\t\t\tawait GPU.queue.onSubmittedWorkDone();\n\t\t\tgpuQueueAck(GPU.frame);",
    """this.frame( 1 / 60 );
            if (qs.get('pipelineBatch') === '2') {
                console.info('[Bermuda warmup] awaiting queue completion frame=' + GPU.frame);
                let timerId;
                try {
                    await Promise.race([
                        GPU.queue.onSubmittedWorkDone(),
                        new Promise((_, reject) => {
                            timerId = setTimeout(() => reject(
                                new Error('QA GPU queue did not complete within 20s; frame=' + GPU.frame)), 20000);
                        })
                    ]);
                    console.info('[Bermuda warmup] queue acknowledged frame=' + GPU.frame);
                } finally { clearTimeout(timerId); }
            } else {
                await GPU.queue.onSubmittedWorkDone();
            }
            gpuQueueAck(GPU.frame);""")
print("QA experiment: wait for all shader pipelines before warmup; reject unacknowledged first submit")

# Bermuda QA vegetation: retain mixed trees, shrubs and coastal greenery,
# but stop filling the hills and walking corridors with repeated coconut palms.
# The same palm meshes and lighting are kept; only placement and far draw
# distance change. No shader, ocean, physics or save changes.
replace_once("src/world/Vegetation.js",
    "const fractions = { palms: 0.16, trees: 0.12, bananas: 0.12, shrubs: 0.12,",
    "const fractions = { palms: 0.09, trees: 0.12, bananas: 0.12, shrubs: 0.12,")
replace_once("src/world/Vegetation.js",
    "youngPalms: 0.10, ferns: 0.10, monsteras: 0.10, elephantEars: 0.10,",
    "youngPalms: 0.06, ferns: 0.10, monsteras: 0.10, elephantEars: 0.10,")
replace_once("src/world/Vegetation.js",
    "\t\t\trecs.villagePalms = Math.min( recs.villagePalms || 0, recs.palms.length );",
    """            // Deterministic, spatially separated palms: retain coastal
            // character without endless repeating palm rows on hillsides.
            // The original scatter's biome and ground-height checks still apply.
            const spaced = [];
            for (const r of recs.palms) {
                const coastal = site.inBay(r.x, r.z) && site.height(r.x, r.z) < 8.5;
                // A few landmark palms may occur farther inland, not a forest.
                if (!coastal && Math.floor(r.seed * 100003) % 4 !== 0) continue;
                const radius = coastal ? 17 : 29;
                const tooClose = spaced.some(p => {
                    const minSpace = (radius + p.radius) * 0.5;
                    return (p.x-r.x)**2 + (p.z-r.z)**2 < minSpace**2;
                });
                if (tooClose) continue;
                spaced.push({...r, radius});
            }
            recs.palms = spaced.map(({radius, ...p}) => p);
            recs.villagePalms = Math.min(recs.villagePalms || 0, recs.palms.length);
            if (typeof window !== 'undefined') {
                window.__bermudaPalmLayout = {
                    profile:'open-coastal-palms', palms:recs.palms.length,
                    trees:recs.trees.length, youngPalms:recs.youngPalms.length
                };
            }""")
replace_once("src/world/Vegetation.js",
    "far: { parts: [ { geometry: palmFar.geometry, material: leafMat, name: 'veg-palm-far' } ], fade: CANOPY_FAR },",
    "far: { parts: [ { geometry: palmFar.geometry, material: leafMat, name: 'veg-palm-far' } ], fade: mobileSparse ? [380, 520] : CANOPY_FAR },")
replace_once("src/world/Vegetation.js",
    "nearRange: mobileSparse ? 45 : PALM_NEAR, margin: 10, refreshDistance: 6, farExcludeNear: true, sortNear: true,",
    "nearRange: mobileSparse ? 40 : PALM_NEAR, margin: 10, refreshDistance: 6, farExcludeNear: true, sortNear: true,")
assert "open-coastal-palms" in (root / "src/world/Vegetation.js").read_text()
assert "palms: 0.09" in (root / "src/world/Vegetation.js").read_text()
print("QA vegetation: fewer palms, coastal grouping, minimum spacing and closer far LOD")

# Controlled iPhone-only test: when the player is stationary on genuinely
# dry inland terrain, far from the boat, avoid repeated WebGPU height-query
# dispatches/readbacks. Resume immediately upon walking, swimming, boating
# or approaching shore. Keep one refresh every two seconds while idle.
# This is opt-in with ?waterTest=idle, leaving the normal query unchanged.
replace_once("src/main.js",
    "window.__bermudaThrottleWaterQueries = mobileFastStart;",
    """window.__bermudaThrottleWaterQueries = mobileFastStart;
window.__bermudaIdleWaterQueryTest = mobileFastStart &&
    new URLSearchParams(location.search).get('waterTest') === 'idle';""")
replace_once("src/ocean/WaterQuery.js",
    "\t\t// built on first use: the wake / shore attached to the surface after construction are included",
    """        // Safari diagnostic: suppress needless inland GPU readbacks while
        // the walker is stationary. Never do this at sea, while approaching
        // the shoreline, on a boat, swimming, or before the first valid height.
        const app = typeof window !== 'undefined' ? window.__app : null;
        const p = app?.player;
        const b = app?.boatCtl;
        const dryIdle = typeof window !== 'undefined' &&
            window.__bermudaIdleWaterQueryTest &&
            this.cpuValid && p && b && app.terrainData &&
            p.mode === 'walk' && p.grounded && p.wade < 0.02 &&
            Math.hypot(p.velocity.x, p.velocity.z) < 0.08 &&
            !b.driven &&
            Math.hypot(p.position.x - b.position.x, p.position.z - b.position.z) > 25 &&
            app.terrainData.heightAt(p.position.x, p.position.z) > 2.8 &&
            app.terrainData.coastDistance(p.position.x, p.position.z).d < -8;
        if (dryIdle) {
            const nowMs = performance.now();
            if (!this._dryIdleLastQueryMs) this._dryIdleLastQueryMs = nowMs;
            if (nowMs - this._dryIdleLastQueryMs < 2000) {
                this.dryIdleSkippedUpdates = (this.dryIdleSkippedUpdates || 0) + 1;
                return;
            }
            this._dryIdleLastQueryMs = nowMs;
        } else {
            this._dryIdleLastQueryMs = 0;
        }

\t\t// built on first use: the wake / shore attached to the surface after construction are included""")
replace_once("src/mobile/GpuAudit.js",
    "'Water query diagnostic '+(typeof location!=='undefined'?",
    """'Dry inland idle-query skips '+(app?.query?.dryIdleSkippedUpdates??0),
  'Water query diagnostic '+(typeof location!=='undefined'?""")
assert "dryIdleSkippedUpdates" in (root / "src/ocean/WaterQuery.js").read_text()
assert "window.__bermudaIdleWaterQueryTest" in (root / "src/main.js").read_text()
print("QA optional waterTest=idle: avoid repeated inland stationary water-query GPU dispatch")
# Optional paced GPU isolation without changing render targets, FFT resolution,
# visuals, save keys or gameplay mechanics. Baseline remains 42 ms; ?gpuPace=steady
# caps the render loop at ~17 fps, lowering sustained WebGPU submission pressure.
# This must be user-selectable: the prior 12-minute run used baseline pacing.
replace_once("src/main.js",
    "window.__bermudaMobileGraphics75 = mobileGraphics75;",
    """window.__bermudaMobileGraphics75 = mobileGraphics75;
window.__bermudaMobilePaceMs = (
    mobileFastStart && new URLSearchParams(location.search).get('gpuPace') === 'steady'
) ? 60 : 42;""")
replace_once("src/engine/Engine.js",
    "t - this._mobileLastFrame < 42",
    "t - this._mobileLastFrame < (window.__bermudaMobilePaceMs || 42)")
replace_once("src/mobile/GpuAudit.js",
    "'Loss reason '+(a.reason||'not reported'),",
    """'GPU pacing '+(typeof window!=='undefined'?(window.__bermudaMobilePaceMs||42):42)+'ms nominal',
  'Loss reason '+(a.reason||'not reported'),""")

main = (root / "src/main.js").read_text()
assert "const gpuTraceCase = getGpuTraceCase('fftcore')" in main
assert "getFftCoreVisualProfile('crisp')" in main
assert "frameCount: MOBILE_FULL_PRELOAD_FRAMES" in main
assert "minimumMs: 60000" in main
assert "preloadQAStartupAudio(app.audio)" in main
assert "Bermuda audio start" in main
print("iPhone QA: original FFT + Crisp; 30 warm frames, 60s minimum, audio pre-decoded")
