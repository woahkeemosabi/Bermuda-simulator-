import * as THREE from '../engine/index.js';

// Shared world layout. Coordinates in meters, y up, sea level y = 0.
// The open ocean lies to the south (+z); the island to the north (-z).
// Sun rises in the east (+x) and sets in the west (-x).
//
// Bermuda v0.1 keeps Tidewater's compact authored world temporarily while the waterfront is rebuilt.
export const WORLD = {
	terrainSize: 2048,
	terrainRes: 2048,

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

	boatDock: { position: new THREE.Vector3( 65.5, 0, 55.5 ), heading: 0 },

	village: { center: new THREE.Vector3( 40, 0, - 118 ), radius: 95 },
	reef: { center: new THREE.Vector3( - 108, 0, 92 ), radius: 78 },

	spawn: { position: new THREE.Vector3( 18, 0, - 60 ), yaw: Math.PI },
	// Start one short step from the actual boarding point instead of inside the boat geometry.
	// The boat's boardPoint is roughly x=65.5,z=53.75 at this temporary mooring.
	start: { position: new THREE.Vector3( 60.75, 0, 53.75 ), yaw: - Math.PI / 2 },

	swellDir: new THREE.Vector2( - 0.12, - 1 ).normalize(),
};
