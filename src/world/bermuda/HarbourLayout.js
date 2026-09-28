// One dock-space transform for visuals, vendors, collision, markers and lamps.
// The shop apron is deliberately wider than the original landing: the buildings sit on the
// shoreward edge and leave a continuous ~3 m pedestrian lane between their fronts and the water.
export const WATERFRONT_DECK = Object.freeze({ x: -65.0, z: -25.5, width: 9.0, depth: 24.0, baseY: 1.0 });
export const FISH_MARKET = Object.freeze({ x: -65.8, z: -21.5, baseY: 1.0, yaw: Math.PI / 2, width: 3.7, depth: 2.5, height: 3.2, lamp: [-.9,1.85,1.15] });
export const BAIT_TACKLE = Object.freeze({ x: -65.8, z: -29.0, baseY: 1.0, yaw: Math.PI / 2, width: 3.5, depth: 2.5, height: 3.2, lamp: [-.9,1.85,1.15] });
export function dockLampPosition(s, lx, ly, lz) {
    const c = Math.cos(s.yaw), n = Math.sin(s.yaw);
    return { x: s.x + lx*c + lz*n, y: s.baseY + ly, z: s.z - lx*n + lz*c };
}
