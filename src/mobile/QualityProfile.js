// Mobile quality profile.
// Default iPhone play must be stable first: the previous 0.92 + clouds/haze combination could
// exhaust Safari/WebGPU immediately after tapping Explore and trigger the recovery/reload loop.
// Richness on phones now comes from lightweight authored geometry rather than expensive atmosphere.
export function mobileQualityParameters(input, safeLevel = 0) {
    const p = new URLSearchParams(input);
    const high = p.get('quality') === 'mobile-high' && safeLevel === 0;

    // Legacy dense island vegetation is too expensive for the phone baseline. Authored Bermuda
    // corridor vegetation is supplied by the lightweight mobile reference pass instead.
    p.set('noVeg','1');

    if (high) {
        // Explicit opt-in diagnostic profile only.
        p.delete('noClouds');
        p.delete('noHaze');
        p.set('noCaustics','1');
        p.set('noSim','1');
        p.set('scale','0.94');
        p.set('G','22');
    } else if (safeLevel === 0) {
        // Proven stable everyday profile. Keep weather GAMEPLAY/HUD active, but do not allocate the
        // heavy cloud/haze pipelines on normal iPhone launch.
        p.set('noClouds','1');
        p.set('noHaze','1');
        p.set('noCaustics','1');
        p.set('noSim','1');
        p.set('scale','0.88');
        p.set('G','18');
    } else {
        p.set('noClouds','1');
        p.set('noHaze','1');
        p.set('noCaustics','1');
        p.set('noSim','1');
        p.set('scale', safeLevel >= 2 ? '0.72' : '0.82');
        p.set('G','16');
    }
    return p;
}
