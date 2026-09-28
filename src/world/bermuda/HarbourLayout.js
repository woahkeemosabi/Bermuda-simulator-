// One dock-space transform for visuals, vendors, collision, markers and lamps.
export const FISH_MARKET = Object.freeze({ x: -66, z: -22, baseY: 1.0, yaw: Math.PI / 2, width: 3.7, depth: 2.5, height: 3.2 });
export const BAIT_TACKLE = Object.freeze({ x: -66, z: -29, baseY: 1.0, yaw: Math.PI / 2, width: 3.5, depth: 2.5, height: 3.2 });
export function dockLampPosition(s, lx, ly, lz) {
    const c = Math.cos(s.yaw), n = Math.sin(s.yaw);
    return { x: s.x + lx*c + lz*n, y: s.baseY + ly, z: s.z - lx*n + lz*c };
}
