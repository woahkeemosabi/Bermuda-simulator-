// Mobile quality profile. The previous core-stable fallback was intentionally conservative, but the
// default 0.82 render scale was visibly soft on the target iPhone. Keep the expensive post/GPU systems
// disabled by default, while restoring a sharper base render and a slightly denser ocean grid. If the
// WebGPU recovery path is entered, it can still step down to the proven 0.82 / 0.72 safe levels.
export function mobileQualityParameters(input, safeLevel = 0) {
    const p = new URLSearchParams(input);
    const high = p.get('quality') === 'mobile-high' && safeLevel === 0;
    p.set('noClouds','1');
    p.set('noVeg','1'); // legacy island vegetation only; Bermuda authored gardens/props remain separate

    if (high) {
        p.set('scale','0.95');
        p.set('G','24');
        p.delete('noHaze');
        p.delete('noCaustics');
        if(p.get('shoreSim') === '1') p.delete('noSim'); else p.set('noSim','1');
    } else if (safeLevel === 0) {
        // Normal iPhone play: sharper than the old emergency-looking 0.82 profile, but still keeps
        // the heavyweight post/simulation features off so startup memory stays predictable.
        p.set('scale','0.90');
        p.set('G','20');
        p.set('noHaze','1');
        p.set('noCaustics','1');
        p.set('noSim','1');
    } else {
        p.set('noHaze','1');
        p.set('noCaustics','1');
        p.set('noSim','1');
        p.set('scale', safeLevel >= 2 ? '0.72' : '0.82');
        p.set('G','16');
    }
    return p;
}
