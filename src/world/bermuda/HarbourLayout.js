// Canonical world transforms for the harbour businesses. Every visual, vendor, collider, marker and
// lamp consumes these values so moving a business never leaves gameplay pieces behind.
export const WATERFRONT_DECK = Object.freeze({ x: -65.0, z: -25.5, width: 9.0, depth: 24.0, baseY: 1.0 });

// Joe remains on the working waterfront beside the hero dock.
export const FISH_MARKET = Object.freeze({ x: -68.2, z: -20.7, baseY: 1.0, yaw: Math.PI / 2, width: 3.7, depth: 2.5, height: 3.2, lamp: [-.9,1.85,1.15] });

// Martha belongs on the road, not beside Joe. This site is on the landward residential frontage,
// about 45 m from the fish market: far enough for FIRST DAY to teach the starter bicycle while still
// keeping both businesses in the same compact harbour neighbourhood. The facade faces +Z toward the
// road/footway and the explicit base elevation avoids terrain-height drift on mobile.
export const BAIT_TACKLE = Object.freeze({ x: -91.5, z: -59.2, baseY: 1.48, yaw: 0, width: 3.5, depth: 2.5, height: 3.2, lamp: [-.9,1.85,1.15] });

export function dockLampPosition(s, lx, ly, lz) {
    const c = Math.cos(s.yaw), n = Math.sin(s.yaw);
    return { x: s.x + lx*c + lz*n, y: s.baseY + ly, z: s.z - lx*n + lz*c };
}
