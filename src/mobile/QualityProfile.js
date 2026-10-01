// Mobile quality profile.
// Spend the phone budget on sharpness, water and authored Bermuda assets rather than unstable
// volumetric/weather simulation. The high profile keeps visual fidelity high while avoiding two
// iOS-specific failure modes: Safari toolbar resize churn and sustained 60 fps WebGPU pressure.
export function mobileQualityParameters(input, safeLevel = 0) {
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
    }
    return p;
}
