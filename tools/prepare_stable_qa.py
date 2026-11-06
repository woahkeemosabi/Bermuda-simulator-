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
