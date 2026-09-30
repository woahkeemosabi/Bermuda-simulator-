// Mobile quality profile.
// Spend the phone budget on sharpness, water and authored Bermuda assets rather than unstable
// volumetric/weather simulation. Expensive effects stay off even in High; Step 3 will add automatic
// tier selection/downgrade after the optimized High path has been proven on-device.
export function mobileQualityParameters(input, safeLevel = 0) {
    const p = new URLSearchParams(input);
    const high = p.get('quality') === 'mobile-high' && safeLevel === 0;

    // Legacy dense island vegetation is too expensive for the phone baseline. Authored Bermuda
    // corridor vegetation is supplied by the lightweight mobile reference pass instead.
    p.set('noVeg','1');

    if (high) {
        // Highest-quality mobile target: use the saved GPU budget for native-looking reconstruction
        // and a denser water grid, not volumetric clouds, realtime caustics or swash simulation.
        p.set('noClouds','1');
        p.set('noHaze','1');
        p.set('noCaustics','1');
        p.set('noSim','1');
        p.set('scale','0.95');
        p.set('G','22');
    } else if (safeLevel === 0) {
        // Default mobile target. 0.90 is explicit because App.setRenderScale quantizes to 0.05 steps.
        p.set('noClouds','1');
        p.set('noHaze','1');
        p.set('noCaustics','1');
        p.set('noSim','1');
        p.set('scale','0.90');
        p.set('G','18');
    } else {
        p.set('noClouds','1');
        p.set('noHaze','1');
        p.set('noCaustics','1');
        p.set('noSim','1');
        p.set('scale', safeLevel >= 2 ? '0.70' : '0.80');
        p.set('G','16');
    }
    return p;
}
