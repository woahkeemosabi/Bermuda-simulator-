import { App } from '../App.js';
import { GPU } from '../engine/gpu/GPU.js';

// Capture the full desktop precompile + ungated frame before main.js installs its mobile startup
// overrides. The mobile entry point used to replace App.precompile with a wait-only function, so
// pipelines for meshes first seen after Explore were still requested during gameplay.
const fullPrecompile = App.prototype.precompile;
const ungatedFrame = App.prototype.frame;
let mobileWarmupPatchQueued = false;

function queueMobilePipelineWarmup() {
    if (mobileWarmupPatchQueued || typeof queueMicrotask !== 'function') return;
    mobileWarmupPatchQueued = true;

    // main.js applies its mobile App.prototype overrides in the current task. Install this wrapper in
    // the following microtask so it becomes the final mobile precompile implementation before init
    // reaches the shader-compilation stage.
    queueMicrotask(() => {
        App.prototype.precompile = async function() {
            const started = performance.now();
            const budgetMs = 25000;
            const mr = this.engine?.meshRenderer;
            const savedFrame = this.frame;
            const savedPipelineWait = GPU.pipelinesReady;
            const savedRefraction = this.refraction?.enabled;
            const restores = [];

            // The original iOS fast-start intentionally prevents the two warm-up frames from running
            // every simulation system before the mobile memory profile is applied. Keep that safety:
            // mute only the secondary systems that the memory profile disables anyway, while allowing
            // the core scene/render path to request all of its render pipelines behind the loader.
            const muteUpdate = (system) => {
                if (!system || typeof system.update !== 'function') return;
                const update = system.update;
                system.update = () => {};
                restores.push(() => { system.update = update; });
            };
            [
                this.wake,
                this.boatSpray,
                this.spray,
                this.breakers,
                this.marineSnow,
                this.airMotes,
                this.whale,
                this.wildlife,
            ].forEach(muteUpdate);

            // Bypass the mobile App.frame gate only inside this controlled warm-up. MeshRenderer is in
            // precompile mode during the original pass, so scene meshes request pipeline variants but
            // are not actually drawn or forced through synchronous first-use compiles.
            this.frame = ungatedFrame.bind(this);

            // The desktop precompile waits once before it traverses the scene. On mobile that can spend
            // the entire 25 s budget waiting for only the pipelines already known at that point. Make
            // those internal waits non-blocking, run the full traversal immediately, then spend whatever
            // remains of the same 25 s budget waiting for the complete requested pipeline set.
            GPU.pipelinesReady = async () => {};

            let warmupFinished = false;
            try {
                const warmup = fullPrecompile.call(this).then(() => { warmupFinished = true; }).catch((error) => {
                    console.warn('mobile pipeline warm-up failed', error);
                    warmupFinished = true;
                });
                await Promise.race([
                    warmup,
                    new Promise((resolve) => setTimeout(resolve, budgetMs)),
                ]);
            } finally {
                GPU.pipelinesReady = savedPipelineWait;
                this.frame = savedFrame;
                for (let i = restores.length - 1; i >= 0; i--) restores[i]();
                if (this.waterMaterial) this.waterMaterial.hullOverride = null;
                if (this.refraction && savedRefraction !== undefined) this.refraction.enabled = savedRefraction;
                if (mr) {
                    mr.precompiling = false;
                    mr.syncPipelines = false;
                }
            }

            const remaining = Math.max(0, budgetMs - (performance.now() - started));
            if (warmupFinished && remaining > 0) {
                await Promise.race([
                    savedPipelineWait.call(GPU),
                    new Promise((resolve) => setTimeout(resolve, remaining)),
                ]);
            }
        };
    });
}

// Mobile quality profile.
// Spend the phone budget on sharpness, water and authored Bermuda assets rather than unstable
// volumetric/weather simulation. The high profile keeps visual fidelity high while avoiding two
// iOS-specific failure modes: Safari toolbar resize churn and sustained 60 fps WebGPU pressure.
export function mobileQualityParameters(input, safeLevel = 0) {
    queueMobilePipelineWarmup();

    const p = new URLSearchParams(input);
    const high = p.get('quality') === 'mobile-high' && safeLevel === 0;

    // Legacy dense island vegetation is too expensive for the phone baseline. Authored Bermuda
    // corridor vegetation is supplied by the lightweight mobile reference pass instead.
    p.set('noVeg','1');

    // Safari changes innerHeight while the URL/tab bars animate. Locking the GPU backing dimensions
    // prevents every HDR/depth/history texture from being reallocated during those toolbar changes.
    // The CSS viewport and camera aspect still track the visible screen normally.
    p.set('stableViewport','1');

    if (high) {
        // Highest-quality mobile target. Keep the 0.95 internal reconstruction scale and dense water
        // grid, but present at a stable 30 fps. This reduces sustained GPU load without lowering
        // texture, geometry, water, lighting or post-process quality.
        p.set('noClouds','1');
        p.set('noHaze','1');
        p.set('noCaustics','1');
        p.set('noSim','1');
        p.set('scale','0.95');
        p.set('G','22');
        p.set('mobileFps','30');
    } else if (safeLevel === 0) {
        // Default mobile target. 0.90 is explicit because App.setRenderScale quantizes to 0.05 steps.
        p.set('noClouds','1');
        p.set('noHaze','1');
        p.set('noCaustics','1');
        p.set('noSim','1');
        p.set('scale','0.90');
        p.set('G','18');
        p.set('mobileFps','30');
    } else {
        p.set('noClouds','1');
        p.set('noHaze','1');
        p.set('noCaustics','1');
        p.set('noSim','1');
        p.set('scale', safeLevel >= 2 ? '0.70' : '0.80');
        p.set('G','16');
        p.set('mobileFps','30');

        // gpuRecovery is a crash-loop guard, not a permanent quality preference. Previously a phone
        // that had recovered twice kept gpuRecovery=2 in the address forever; a later unrelated loss
        // could only show the fatal "close this tab" banner. After a long stable run, clear the stale
        // recovery markers so the next launch may attempt Mobile High again. This does not change the
        // quality of the currently-running frame set; it only cleans the URL for a future reload.
        if (typeof window !== 'undefined' && typeof location !== 'undefined') {
            window.setTimeout(() => {
                if (document.visibilityState !== 'visible') return;
                const url = new URL(location.href);
                url.searchParams.delete('gpuRecovery');
                url.searchParams.delete('gpuSafe');
                url.searchParams.delete('recoveryReason');
                history.replaceState(null, '', url);
            }, 90000);
        }
    }
    return p;
}
