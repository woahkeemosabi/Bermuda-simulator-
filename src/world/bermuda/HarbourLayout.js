// Canonical world transforms for the harbour businesses. Every vendor, collider, marker and
// lamp consumes these values. The shop visuals themselves are the original Tidewater stalls.
export const WATERFRONT_DECK = Object.freeze({ x: -65.0, z: -25.5, width: 9.0, depth: 24.0, baseY: 1.0 });

// Keep both harbour businesses on the raised waterfront apron, but against the outer dock edge.
// This leaves the centre of the dock as a clear pedestrian corridor while the complete shop,
// vendor, collider, marker and light continue to consume one canonical transform.
export const FISH_MARKET = Object.freeze({ x: -61.9, z: -21.5, baseY: 1.0, yaw: -Math.PI / 2, width: 3.7, depth: 2.5, height: 3.2, lamp: [-.9,1.85,1.15] });
// Same waterfront bay; inset 0.45 m so the original Tidewater sign posts stay on the apron.
// The light follows the original wooden lantern behind the counter.
export const BAIT_TACKLE = Object.freeze({ x: -62.35, z: -29.0, baseY: 1.0, yaw: -Math.PI / 2, width: 3.5, depth: 2.5, height: 3.2, lamp: [-.75,1.66,-1.45] });

// Dry, walk-up position on the raised harbour apron. Keep this independent of Joe so later vendor
// offsets/orientation changes can never push the jobs board off the deck and into the water.
export const HARBOUR_JOB_BOARD = Object.freeze({ x: -67.15, z: -18.2, baseY: 1.0, yaw: 0 });

export function dockLampPosition(s, lx, ly, lz) {
    const c = Math.cos(s.yaw), n = Math.sin(s.yaw);
    return { x: s.x + lx*c + lz*n, y: s.baseY + ly, z: s.z - lx*n + lz*c };
}
