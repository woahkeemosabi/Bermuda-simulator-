// Canonical world transforms for the harbour businesses. Every vendor, collider, marker and
// lamp consumes these values. The shop visuals themselves are the original Tidewater stalls.
export const WATERFRONT_DECK = Object.freeze({ x: -65.0, z: -25.5, width: 9.0, depth: 24.0, baseY: 1.0 });

// Both businesses sit against the outer dock edge, leaving the middle of the dock as the walking
// corridor. The stalls must face IN toward that corridor, not out toward the water; the previous
// +90° yaw showed their backs to the player after the edge-placement change. Rotate the complete
// canonical transform 180° so visuals, vendors, colliders, markers and lights stay aligned.
export const FISH_MARKET = Object.freeze({ x: -61.9, z: -21.5, baseY: 1.0, yaw: -Math.PI / 2, width: 3.7, depth: 2.5, height: 3.2, lamp: [-.9,1.85,1.15] });
export const BAIT_TACKLE = Object.freeze({ x: -61.9, z: -29.0, baseY: 1.0, yaw: -Math.PI / 2, width: 3.5, depth: 2.5, height: 3.2, lamp: [-.9,1.85,1.15] });

export function dockLampPosition(s, lx, ly, lz) {
    const c = Math.cos(s.yaw), n = Math.sin(s.yaw);
    return { x: s.x + lx*c + lz*n, y: s.baseY + ly, z: s.z - lx*n + lz*c };
}
