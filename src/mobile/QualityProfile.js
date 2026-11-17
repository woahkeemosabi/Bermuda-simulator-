// Canonical mobile quality profile: preserve the approved coastal effects.
// Recovery-only degradation must be explicitly requested, never forced on every iPhone.
export function mobileQualityParameters(input, safeLevel = 0) {
    const p = new URLSearchParams(input);
    const recovery = p.get('recovery') === '1' || safeLevel >= 2;
    p.set('G', recovery ? '12' : '12');
    p.set('scale', recovery ? '0.72' : '1');
    if (recovery) {
        p.set('noClouds','1');
        p.set('noHaze','1');
        p.set('noCaustics','1');
        p.set('noSim','1');
    } else {
        p.delete('noClouds');
        p.delete('noCaustics');
        p.delete('noSim');
        p.delete('noVeg');
        p.delete('freezeFFT');
        p.delete('noSpray');
        p.set('noHaze','1');
        p.set('cloudtest','panorama');
        p.set('envtest','skip');
    }
    return p;
}
