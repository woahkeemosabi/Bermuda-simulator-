// Canonical world transforms for the harbour businesses. Every vendor, collider, marker and
// lamp consumes these values. The shop visuals themselves are the original Tidewater stalls.
export const WATERFRONT_DECK = Object.freeze({ x: -65.0, z: -25.5, width: 9.0, depth: 24.0, baseY: 1.0 });

// Keep both harbour businesses on the raised waterfront apron. These are the proven dock positions
// from the earlier waterfront pass: the complete shop, vendor, collider, marker and light all consume
// the same transform, so there is no duplicate/ghost location left behind.
export const FISH_MARKET = Object.freeze({ x: -65.8, z: -21.5, baseY: 1.0, yaw: Math.PI / 2, width: 3.7, depth: 2.5, height: 3.2, lamp: [-.9,1.85,1.15] });
export const BAIT_TACKLE = Object.freeze({ x: -65.8, z: -29.0, baseY: 1.0, yaw: Math.PI / 2, width: 3.5, depth: 2.5, height: 3.2, lamp: [-.9,1.85,1.15] });

export function dockLampPosition(s, lx, ly, lz) {
    const c = Math.cos(s.yaw), n = Math.sin(s.yaw);
    return { x: s.x + lx*c + lz*n, y: s.baseY + ly, z: s.z - lx*n + lz*c };
}
