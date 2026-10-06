// Mobile assets are fully cached and the mobile world is built before Explore. The clean shared
// link therefore uses the higher Bermuda environment by default. ?quality=mobile-safe remains
// available for diagnostics/older devices.
export function mobileQualityParameters(input, safeLevel = 0) {
    const p = new URLSearchParams(input);
    const explicitSafe = p.get('quality') === 'mobile-safe' || safeLevel > 0;
    const high = !explicitSafe;

    // Keep the two most expensive independent GPU systems conservative, but restore the environment
    // features that define Bermuda visually: vegetation, marine haze and caustics.
    p.set('noClouds','1');
    p.delete('noVeg');

    if (high) {
        p.set('scale','0.85');
        p.set('G','24');
        p.delete('noHaze');
        p.delete('noCaustics');
        p.set('noSim','1');
        p.set('quality','mobile-high');
    } else {
        p.set('noHaze','1');
        p.set('noCaustics','1');
        p.set('noSim','1');
        p.set('noVeg','1');
        p.set('scale', safeLevel >= 2 ? '0.72' : '0.82');
        p.set('G','16');
        p.set('quality','mobile-safe');
    }
    return p;
}
