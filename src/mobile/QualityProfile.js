// Mobile defaults are intentionally conservative: iOS Safari/WebGPU can destroy the device when
// Tidewater's FFT ocean, CSM shadows, refraction, environment prefilter and post chain all materialise
// on the first playable frame. Desktop remains unchanged; mobile-high is still an explicit opt-in.
export function mobileQualityParameters(input, safeLevel = 0) {
    const p = new URLSearchParams(input);
    const high = p.get('quality') === 'mobile-high' && safeLevel === 0;
    p.set('noClouds','1');
    p.set('noVeg','1'); // legacy island vegetation only; Bermuda gameplay/blockout remains
    if (high) {
        p.set('scale','0.80');
        p.set('outputScale','0.90');
        p.set('G','20');
        p.set('oceanCascades','3');
        p.set('envSize','96');
        p.delete('noEnvRefresh');
        p.delete('noShadows');
        p.delete('noRefraction');
        p.delete('noHaze');
        p.delete('noCaustics');
        if(p.get('shoreSim') === '1') p.delete('noSim'); else p.set('noSim','1');
    } else {
        const safe = Math.max(2, safeLevel);
        p.set('gpuSafe', String(safe));
        p.set('noHaze','1');
        p.set('noCaustics','1');
        p.set('noSim','1');
        p.set('noShadows','1');
        p.set('noRefraction','1');
        p.set('noEnvRefresh','1');
        p.set('scale','0.68');
        p.set('outputScale','0.82');
        p.set('G','18');
        p.set('oceanCascades','2');
        p.set('envSize','64');
    }
    return p;
}
