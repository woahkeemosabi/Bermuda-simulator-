// High remains opt-in until the target iPhone has passed the driving/device-loss test.
export function mobileQualityParameters(input, safeLevel = 0) {
    const p = new URLSearchParams(input);
    const high = p.get('quality') === 'mobile-high' && safeLevel === 0;
    p.set('noClouds','1');
    p.set('noVeg','1'); // legacy island vegetation only; Meshy Bermuda gardens load separately
    if (high) {
        p.set('scale','0.85'); p.set('G','24');
        p.delete('noHaze'); p.delete('noCaustics');
        if(p.get('shoreSim') === '1') p.delete('noSim'); else p.set('noSim','1');
    } else {
        p.set('noHaze','1'); p.set('noCaustics','1'); p.set('noSim','1');
        p.set('scale',safeLevel >= 2 ? '0.72' : '0.82'); p.set('G','16');
    }
    return p;
}
