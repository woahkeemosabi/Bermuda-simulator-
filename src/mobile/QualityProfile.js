// Mobile quality profile. Normal iPhone play should still look like Bermuda, not an emergency
// compatibility mode. Keep the expensive simulation/post systems restrained, but preserve visible
// weather/atmosphere and a sharper base image. GPU recovery can still fall back to the proven safe
// 0.82 / 0.72 profiles with clouds disabled.
export function mobileQualityParameters(input, safeLevel = 0) {
    const p = new URLSearchParams(input);
    const high = p.get('quality') === 'mobile-high' && safeLevel === 0;

    // Legacy dense island vegetation remains off on the default phone profile; authored Bermuda
    // palmettos, gardens, bougainvillea and the low-cost reference detail pass still load separately.
    p.set('noVeg','1');

    if (high) {
        p.delete('noClouds');
        p.delete('noHaze');
        p.delete('noCaustics');
        p.set('scale','0.98');
        p.set('G','24');
        if(p.get('shoreSim') === '1') p.delete('noSim'); else p.set('noSim','1');
    } else if (safeLevel === 0) {
        // Standard target-iPhone mode: visible clouds/weather + atmospheric haze, better resolution,
        // but no heavyweight shoreline simulation or caustics by default.
        p.delete('noClouds');
        p.delete('noHaze');
        p.set('noCaustics','1');
        p.set('noSim','1');
        p.set('scale','0.92');
        p.set('G','20');
    } else {
        // Recovery mode prioritises keeping Safari/WebGPU alive after a device/queue failure.
        p.set('noClouds','1');
        p.set('noHaze','1');
        p.set('noCaustics','1');
        p.set('noSim','1');
        p.set('scale', safeLevel >= 2 ? '0.72' : '0.82');
        p.set('G','16');
    }
    return p;
}
