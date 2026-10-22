import { BoatController } from '../player/BoatController.js';

// Mobile vehicle-handling patch.
//
// The touch movement pad currently exposes A/D as digital keys. That is fine for walking,
// but it made the helm jump straight to full rudder as soon as the thumb moved a few pixels.
// Track the actual horizontal thumb displacement independently so the boat can use a true
// analogue steering value without changing the desktop input path.
let steerPointer = null;
let steerOriginX = 0;
let steerAxis = 0;

const MOVE_ZONE = 0.48;
const MOVE_RADIUS = 88;
const DEAD_ZONE = 0.12;

function clamp( v, lo, hi ) {
	return Math.max( lo, Math.min( hi, v ) );
}

function shapeSteer( raw ) {
	const a = Math.abs( raw );
	if ( a <= DEAD_ZONE ) return 0;
	const n = clamp( ( a - DEAD_ZONE ) / ( 1 - DEAD_ZONE ), 0, 1 );
	// Softer around centre than the walking stick. This makes small helm corrections possible
	// instead of alternating between full-port and full-starboard.
	return Math.sign( raw ) * Math.pow( n, 1.55 );
}

function mobilePadReady() {
	return !! document.getElementById( 'bm-touch-stable' );
}

function excludedTouchTarget( x, y ) {
	const el = document.elementFromPoint( x, y );
	return !! el?.closest?.( '#bm-touch-stable button,.tw-start,.tw-start-cta' );
}

function resetSteerPointer( pointerId = null ) {
	if ( pointerId !== null && steerPointer !== pointerId ) return;
	steerPointer = null;
	steerAxis = 0;
}

document.addEventListener( 'pointerdown', ( e ) => {
	if ( steerPointer !== null || ! mobilePadReady() ) return;
	if ( e.pointerType === 'mouse' && e.button !== 0 ) return;
	if ( e.clientX > window.innerWidth * MOVE_ZONE || excludedTouchTarget( e.clientX, e.clientY ) ) return;
	steerPointer = e.pointerId;
	steerOriginX = e.clientX;
	steerAxis = 0;
}, { capture: true, passive: true } );

document.addEventListener( 'pointermove', ( e ) => {
	if ( e.pointerId !== steerPointer ) return;
	const raw = clamp( ( e.clientX - steerOriginX ) / MOVE_RADIUS, - 1, 1 );
	steerAxis = shapeSteer( raw );
}, { capture: true, passive: true } );

document.addEventListener( 'pointerup', ( e ) => resetSteerPointer( e.pointerId ), { capture: true, passive: true } );
document.addEventListener( 'pointercancel', ( e ) => resetSteerPointer( e.pointerId ), { capture: true, passive: true } );
window.addEventListener( 'blur', () => resetSteerPointer() );
document.addEventListener( 'visibilitychange', () => {
	if ( document.visibilityState !== 'visible' ) resetSteerPointer();
} );

const originalSetInput = BoatController.prototype.setInput;

// Keep desktop/key steering untouched. On mobile, replace the digital A/D helm with the analogue
// thumb value. Steering authority tapers with speed and the rudder recentres faster than it turns
// in, which removes the left-right hunting reported on iPhone while preserving deliberate turns.
BoatController.prototype.setInput = function( throttle, steer, dt ) {
	if ( ! mobilePadReady() ) {
		originalSetInput.call( this, throttle, steer, dt );
		return;
	}

	this.throttleTarget = throttle;
	this.throttle += ( throttle - this.throttle ) * ( 1 - Math.exp( - dt * 2.2 ) );

	let target = steer;
	if ( steerPointer !== null ) target = - steerAxis;

	const speed = Math.abs( this.forwardSpeed || 0 );
	const speedT = clamp( speed / 8, 0, 1 );
	const authority = 0.72 + ( 0.46 - 0.72 ) * speedT;
	target = clamp( target * authority, - 0.72, 0.72 );

	const recentering = Math.abs( target ) < Math.abs( this.steer ) ? 5.8 : 3.0;
	this.steer += ( target - this.steer ) * ( 1 - Math.exp( - dt * recentering ) );
	if ( Math.abs( target ) < 0.01 && Math.abs( this.steer ) < 0.015 ) this.steer = 0;
};

const originalBoatUpdate = BoatController.prototype.update;
BoatController.prototype.update = function( dt ) {
	originalBoatUpdate.call( this, dt );
	if ( ! mobilePadReady() || ! this.driven || this.moored || this.anchored ) return;

	// Mild neutral-rudder yaw damping. It only becomes strong as the wheel comes back to centre,
	// so the boat still carves a turn but does not keep oscillating after a correction is released.
	const neutral = 1 - clamp( Math.abs( this.steer ) / 0.35, 0, 1 );
	if ( neutral > 0 && Number.isFinite( this.angular?.y ) ) {
		this.angular.y *= Math.exp( - Math.min( dt, 0.1 ) * 0.9 * neutral );
	}
};