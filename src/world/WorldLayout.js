import * as THREE from '../engine/index.js';

// Shared world layout. Coordinates in meters, y up, sea level y = 0.
// The open ocean lies to the south (+z); the island to the north (-z).
// Sun rises in the east (+x) and sets in the west (-x).
//
// Bermuda v0.1 keeps Tidewater's compact authored world, but stretches the waterfront into a
// more convincing small harbour: a longer pier, a broader pier head, and a reef destination far
// enough away that taking the boat out feels like an actual trip instead of crossing a pond.
export const WORLD = {
	terrainSize: 2048, // heightmap domain, centered at origin
	terrainRes: 2048,

	// Central sandy beach inside the bay, shoreline near z ≈ -42 at x = 0.
	beach: { xMin: - 150, xMax: 170 },

	pier: {
		x: 55,
		zStart: - 64, // on dry sand
		zEnd: 60, // longer harbour pier into ~5–6 m water
		deckHeight: 2.3, // deck surface above sea level
		width: 2.8,
		headWidth: 16, // T-shaped platform at the end
		headDepth: 9,
	},

	// Where the boat is moored: east side of the enlarged pier head, bow pointing south.
	boatDock: { position: new THREE.Vector3( 65.5, 0, 55.5 ), heading: 0 },

	village: { center: new THREE.Vector3( 40, 0, - 118 ), radius: 95 },

	// First Harbour Run destination: a larger shallow reef/cove target farther across the bay.
	reef: { center: new THREE.Vector3( - 108, 0, 92 ), radius: 78 },

	spawn: { position: new THREE.Vector3( 18, 0, - 60 ), yaw: Math.PI }, // kept clear of rocks, plants and debris
	// Start already on the pier approach, facing the boat. The old -77 m start made the first
	// interaction take too long on mobile before the player discovered the boat could be driven.
	start: { position: new THREE.Vector3( 55, 0, - 30 ), yaw: Math.PI },

	// Incoming swell direction (unit, travel direction)
	swellDir: new THREE.Vector2( - 0.12, - 1 ).normalize(),
};
