// Canonical world transforms for the harbour businesses. Every vendor, collider, marker and
// lamp consumes these values. The shop visuals themselves are the original Tidewater stalls.
export const WATERFRONT_DECK = Object.freeze({ x: -65.0, z: -25.5, width: 9.0, depth: 24.0, baseY: 1.0 });

// Joe stays on the working waterfront beside the hero dock, matching Tidewater's fish-buyer role.
export const FISH_MARKET = Object.freeze({ x: -68.2, z: -20.7, baseY: 1.0, yaw: Math.PI / 2, width: 3.7, depth: 2.5, height: 3.2, lamp: [-.9,1.85,1.15] });

// Martha returns to the Tidewater concept: an OPEN-AIR chandlery beside the boathouse rather than a
// fake walk-in storefront or a second stall on Joe's dock. This is ~42 m from Joe, so FIRST DAY has
// a real bicycle leg while both traders still belong to the same compact harbour neighbourhood.
// The stall faces +Z toward the coastal road/customer approach.
export const BAIT_TACKLE = Object.freeze({ x: -45.5, z: -55.5, baseY: 1.48, yaw: 0, width: 3.5, depth: 2.5, height: 3.2, lamp: [-.9,1.85,1.15] });

export function dockLampPosition(s, lx, ly, lz) {
    const c = Math.cos(s.yaw), n = Math.sin(s.yaw);
    return { x: s.x + lx*c + lz*n, y: s.baseY + ly, z: s.z - lx*n + lz*c };
}
