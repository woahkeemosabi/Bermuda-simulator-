import * as THREE from '../engine/index.js';

// Shared world layout. Coordinates in meters, y up, sea level y = 0.
// The open ocean lies to the south (+z); the island to the north (-z).
// Sun rises in the east (+x) and sets in the west (-x).
//
// Bermuda v0.1 still contains Tidewater's temporary authored pier geometry. The next environment
// pass will replace that waterfront rather than teaching players to treat it as canonical Bermuda.
export const WORLD = {
	terrainSize: 2048, // heightmap domain, centered at origin
	terrainRes: 2048,

	// Central sandy beach inside the bay, shoreline near z ≈ -42 at x = 0.
	beach: { xMin: - 150, xMax: 170 },

	pier: {
		x: 55,
		zStart: - 64,
		zEnd: 60,
		deckHeight: 2.3,
		width: 2.8,
		headWidth: 16,
		headDepth: 9,
	},

	// Temporary boat mooring used until the Bermuda shoreline/harbour layout replaces the Tidewater pier.
	boatDock: { position: new THREE.Vector3( 65.5, 0, 55.5 ), heading: 0 },

	village: { center: new THREE.Vector3( 40, 0, - 118 ), radius: 95 },

	// First Harbour Run destination: a larger shallow reef/cove target farther across the bay.
	reef: { center: new THREE.Vector3( - 108, 0, 92 ), radius: 78 },

	spawn: { position: new THREE.Vector3( 18, 0, - 60 ), yaw: Math.PI },
	// Put the player beside the boarding point, facing the boat. This deliberately bypasses the long
	// temporary pier so the first interaction is immediately about the boat, not Tidewater scenery.
	start: { position: new THREE.Vector3( 61.5, 0, 55.5 ), yaw: - Math.PI / 2 },

	// Incoming swell direction (unit, travel direction)
	swellDir: new THREE.Vector2( - 0.12, - 1 ).normalize(),
};
