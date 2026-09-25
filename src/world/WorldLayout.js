import * as THREE from '../engine/index.js';

// Shared world layout. Coordinates in meters, y up, sea level y = 0.
// The open ocean lies to the south (+z); the island to the north (-z).
// Sun rises in the east (+x) and sets in the west (-x).
//
// Bermuda v0.1 still keeps Tidewater's authored terrain and legacy village available while the
// replacement world is built. The initial player/boat placement now uses the separate Bermuda
// harbour blockout on the west side of the bay, so the first experience no longer depends on the
// long Tidewater pier.
export const WORLD = {
	terrainSize: 2048, // heightmap domain, centered at origin
	terrainRes: 2048,

	// Central sandy beach inside the bay, shoreline near z ≈ -42 at x = 0.
	beach: { xMin: - 150, xMax: 170 },

	// Legacy authored pier. Kept intact for existing gameplay / interaction references during the
	// blockout phase; it will be removed only after its dependencies have been migrated.
	pier: {
		x: 55,
		zStart: - 64,
		zEnd: 60,
		deckHeight: 2.3,
		width: 2.8,
		headWidth: 16,
		headDepth: 9,
	},

	// Bermuda blockout: the boat sits immediately beside the short west-bay landing, bow south toward
	// open water. The existing BoatController reads this at construction, so its mooring/physics remain
	// unchanged apart from location.
	boatDock: { position: new THREE.Vector3( - 61.5, 0, - 13.0 ), heading: 0 },

	village: { center: new THREE.Vector3( 40, 0, - 118 ), radius: 95 },

	// First Harbour Run destination: a larger shallow reef/cove target farther across the bay.
	reef: { center: new THREE.Vector3( - 108, 0, 92 ), radius: 78 },

	// Safe dry-land fallback used during App.init. BermudaBlockout moves the player onto the landing
	// before the loader is dismissed, after its collider exists.
	spawn: { position: new THREE.Vector3( - 64, 0, - 47 ), yaw: Math.PI },
	start: { position: new THREE.Vector3( - 64, 0, - 47 ), yaw: Math.PI },

	// Incoming swell direction (unit, travel direction)
	swellDir: new THREE.Vector2( - 0.12, - 1 ).normalize(),
};
