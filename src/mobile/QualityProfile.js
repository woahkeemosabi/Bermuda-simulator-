import { Vendor } from '../game/Vendor.js';
import { Whale } from '../world/marine/Whale.js';

let mobileMemoryGuardsInstalled = false;

function installMobileMemoryGuards() {
    if (mobileMemoryGuardsInstalled) return;
    mobileMemoryGuardsInstalled = true;

    // Keep the lightweight procedural vendor figures on phones. The Rocketbox replacements each add
    // texture/skinning allocations that are not required for shop interaction.
    Vendor.prototype.loadCharacter = async function() {
        this.character = null;
        return null;
    };

    // The whale is disabled by the mobile gameplay profile. Do not load its 4K texture set first and
    // then hide it; leave that memory available for the core world and first gameplay frame instead.
    Whale.prototype.load = async function() {
        this.ready = false;
        return this;
    };
}

// Mobile quality profile.
// The mobile entry point in main.js already replaces App.precompile with a wait-only implementation.
// Do not bypass that gate or render hidden warm-up frames on iOS: doing so materialises large render
// resources before Explore and was observed to crash Safari even at gpuSafe=2.
export function mobileQualityParameters(input, safeLevel = 0) {
    installMobileMemoryGuards();

    const p = new URLSearchParams(input);
    const high = p.get('quality') === 'mobile-high' && safeLevel === 0;

    // Legacy dense island vegetation is too expensive for the phone baseline. Authored Bermuda
    // corridor vegetation is supplied by the lightweight mobile reference pass instead.
    p.set('noVeg','1');

    // Safari changes innerHeight while the URL/tab bars animate. Locking the GPU backing dimensions
    // prevents every HDR/depth/history texture from being reallocated during those toolbar changes.
    p.set('stableViewport','1');

    if (high) {
        p.set('noClouds','1');
        p.set('noHaze','1');
        p.set('noCaustics','1');
        p.set('noSim','1');
        p.set('scale','0.95');
        p.set('G','22');
        p.set('mobileFps','30');
    } else if (safeLevel === 0) {
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

        // Recovery markers are a crash-loop guard, not a permanent quality preference. After a long
        // stable run, clear them so a later launch can try the normal mobile profile again.
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
