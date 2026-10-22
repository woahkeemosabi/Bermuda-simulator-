import { Vector3 } from '../../engine/index.js';
import { box, roundedBox, cylinder, rod, torus, mat4 } from './GeoKit.js';
import { PALETTE } from './HullBuilder.js';

const V = ( x, y, z ) => new Vector3( x, y, z );
const WHITE = { color: PALETTE.gelcoat, rough: 0.31, metal: 0 };
const WHITE_SOFT = { color: 0xf5f4ef, rough: 0.52, metal: 0 };
const DARK = { color: 0x151a1e, rough: 0.45, metal: 0 };
const GLASS = { color: 0x183745, rough: 0.12, metal: 0.08, alpha: 0.50 };
const STAINLESS = { color: PALETTE.stainless, rough: 0.20, metal: 1 };
const BLACK = { color: 0x111519, rough: 0.34, metal: 0.08 };

// The 54-second reference uses a clean open centre-console boat rather than the original enclosed
// Downeast wheelhouse. Keep these anchors close to the existing helm coordinates so the proven
// player/physics interactions remain compatible while the visible superstructure changes.
export const CENTER = {
	helmX: -0.38,
	helmZ: 0.48,
	consoleZ: 0.78,
	consoleW: 1.28,
	consoleH: 1.28,
	consoleD: 0.68,
	seatZ: -0.12,
	topUnderY: 2.43,
	topY: 2.52,
	topZ: 0.05,
	topW: 2.20,
	topD: 2.35,
};

export function buildCenterConsole( kit, L, parts ) {
	const deck = L.deckY;
	const C = CENTER;

	// ---- centre console -------------------------------------------------------
	const pedestal = roundedBox( C.consoleW, C.consoleH, C.consoleD, 0.08, 2 );
	pedestal.translate( 0, deck + C.consoleH * 0.5, C.consoleZ );
	kit.add( 'gelcoat', pedestal, WHITE );

	// Dark angled instrument face and a raised electronics screen. These are deliberately broad,
	// readable shapes: from the reference chase camera the console should read instantly as a modern
	// centre-console helm instead of a cabin wall.
	const panel = box( C.consoleW * 0.88, 0.44, 0.055 );
	panel.applyMatrix4( mat4( 0, deck + 1.02, C.consoleZ + C.consoleD * 0.5 + 0.032, -0.18, 0, 0 ) );
	kit.add( 'fittings', panel, DARK );
	const screen = roundedBox( 0.50, 0.26, 0.035, 0.025, 1 );
	screen.applyMatrix4( mat4( 0.21, deck + 1.06, C.consoleZ + C.consoleD * 0.5 + 0.065, -0.18, 0, 0 ) );
	kit.add( 'glow', screen, { color: 0x203d46, rough: 0.18, pattern: 6 } );

	// Compact windshield above the console rather than an enclosed wheelhouse.
	const windshield = box( 1.18, 0.52, 0.035 );
	windshield.applyMatrix4( mat4( 0, deck + 1.52, C.consoleZ + 0.17, -0.15, 0, 0 ) );
	kit.add( 'glass', windshield, GLASS );
	for ( const sx of [ -0.61, 0.61 ] ) {
		kit.add( 'fittings', rod( V( sx, deck + 1.25, C.consoleZ + 0.15 ), V( sx, deck + 1.82, C.consoleZ + 0.08 ), 0.016, 8 ), STAINLESS );
	}

	// Wheel shaft anchor. BoatModel keeps the animated wheel mesh, but it now sits on the modern
	// console face. +Z is into the panel, matching the legacy animation convention.
	parts.wheelCenter = V( C.helmX, deck + 1.05, C.consoleZ + C.consoleD * 0.5 + 0.18 );
	parts.wheelAxis = V( 0, -0.18, -0.984 ).normalize();
	kit.add( 'fittings', rod(
		V( C.helmX, deck + 1.02, C.consoleZ + C.consoleD * 0.5 + 0.035 ),
		parts.wheelCenter.clone().addScaledVector( parts.wheelAxis, 0.03 ),
		0.025, 10
	), STAINLESS );

	// Twin-lever outboard throttle at the helmsman's starboard hand.
	parts.throttlePivot = V( -0.58, deck + 0.98, C.consoleZ + 0.20 );
	const throttleBase = roundedBox( 0.18, 0.10, 0.24, 0.025, 1 );
	throttleBase.translate( parts.throttlePivot.x, parts.throttlePivot.y - 0.06, parts.throttlePivot.z );
	kit.add( 'fittings', throttleBase, BLACK );

	// ---- leaning post / seat --------------------------------------------------
	const seatBase = roundedBox( 1.10, 0.18, 0.52, 0.08, 2 );
	seatBase.translate( 0, deck + 0.93, C.seatZ );
	kit.add( 'fittings', seatBase, WHITE_SOFT );
	const back = roundedBox( 1.08, 0.48, 0.16, 0.06, 2 );
	back.translate( 0, deck + 1.20, C.seatZ - 0.23 );
	kit.add( 'fittings', back, WHITE_SOFT );
	for ( const x of [ -0.42, 0.42 ] ) {
		kit.add( 'fittings', rod( V( x, deck, C.seatZ ), V( x, deck + 0.88, C.seatZ ), 0.026, 10 ), STAINLESS );
	}

	// ---- T-top ----------------------------------------------------------------
	const legX = 0.64;
	for ( const x of [ -legX, legX ] ) for ( const z of [ -0.34, 0.80 ] ) {
		kit.add( 'fittings', rod( V( x, deck + 0.03, z ), V( x * 1.05, C.topUnderY, z + 0.05 ), 0.025, 10 ), STAINLESS );
	}
	for ( const z of [ -0.31, 0.85 ] ) kit.add( 'fittings', rod( V( -0.68, C.topUnderY, z ), V( 0.68, C.topUnderY, z ), 0.022, 10 ), STAINLESS );
	const top = roundedBox( C.topW, 0.10, C.topD, 0.08, 2 );
	top.translate( 0, C.topY, C.topZ );
	kit.add( 'gelcoat', top, WHITE );

	// Short antenna/radar pedestal keeps the silhouette modern and low, unlike the old tall mast.
	const radarBase = roundedBox( 0.30, 0.12, 0.30, 0.04, 1 );
	radarBase.translate( 0, C.topY + 0.11, C.topZ + 0.35 );
	kit.add( 'fittings', radarBase, WHITE );
	parts.radarPivot = V( 0, C.topY + 0.20, C.topZ + 0.35 );
	kit.add( 'fittings', rod( V( 0.72, C.topY + 0.04, -0.55 ), V( 0.76, C.topY + 1.05, -0.60 ), 0.010, 7 ), WHITE );

	// ---- clean cockpit / bow seating -----------------------------------------
	const bowSeat = roundedBox( 1.38, 0.25, 0.62, 0.10, 2 );
	bowSeat.translate( 0, deck + 0.34, 2.15 );
	kit.add( 'fittings', bowSeat, WHITE_SOFT );
	const aftBench = roundedBox( 1.48, 0.22, 0.46, 0.09, 2 );
	aftBench.translate( 0, deck + 0.36, -2.45 );
	kit.add( 'fittings', aftBench, WHITE_SOFT );

	// ---- single black outboard ------------------------------------------------
	// This is visual presentation only; the existing submerged thrust point remains the physics
	// authority, so handling/anchor/wake behaviour stays proven.
	const motor = roundedBox( 0.62, 0.90, 0.58, 0.12, 2 );
	motor.translate( 0, deck + 0.23, L.zAft - 0.42 );
	kit.add( 'fittings', motor, BLACK );
	const motorTop = roundedBox( 0.69, 0.28, 0.64, 0.14, 2 );
	motorTop.translate( 0, deck + 0.78, L.zAft - 0.42 );
	kit.add( 'fittings', motorTop, { color: 0x0d1115, rough: 0.22, metal: 0.10 } );
	const leg = roundedBox( 0.22, 0.98, 0.20, 0.05, 1 );
	leg.translate( 0, deck - 0.48, L.zAft - 0.47 );
	kit.add( 'fittings', leg, BLACK );

	// Small stainless details and a stern flag anchor. No lobster traps/hauler clutter: the reference
	// boat is recreational/centre-console and its deck needs to remain visually open.
	for ( const x of [ -0.78, 0.78 ] ) {
		const cleat = torus( 0.10, 0.018, 6, 18 );
		cleat.applyMatrix4( mat4( x, deck + 0.14, -2.82, Math.PI * 0.5, 0, 0 ) );
		kit.add( 'fittings', cleat, STAINLESS );
	}
	parts.flagPivot = V( 0.82, deck + 0.56, -2.78 );
}
