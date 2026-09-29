// Keyboard / mouse input. Desktop camera look is drag-to-look by default so ordinary mouse
// movement cannot throw the gameplay camera around. Pointer lock remains available only through
// the explicit ?mouseLock=1 diagnostic/legacy opt-in.
export class Input {

	constructor( dom ) {

		this.dom = dom;
		this.keys = new Set();
		this.pressed = new Set();
		this.look = { x: 0, y: 0 };
		this.wheel = 0;
		this.mouseDown = false;
		this.rightDown = false;
		this.locked = false;
		this.enabled = true;
		this.pointerLockOptIn = typeof location !== 'undefined' && new URLSearchParams( location.search ).get( 'mouseLock' ) === '1';

		window.addEventListener( 'keydown', ( e ) => {

			if ( e.target && ( e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA' ) ) return;
			if ( ! this.keys.has( e.code ) ) this.pressed.add( e.code );
			this.keys.add( e.code );
			if ( [ 'Space', 'ArrowUp', 'ArrowDown', 'Tab' ].includes( e.code ) ) e.preventDefault();

		} );
		window.addEventListener( 'keyup', ( e ) => this.keys.delete( e.code ) );
		window.addEventListener( 'blur', () => this.keys.clear() );

		dom.addEventListener( 'mousedown', ( e ) => {

			if ( e.button === 0 ) this.mouseDown = true;
			if ( e.button === 2 ) this.rightDown = true;

		} );
		window.addEventListener( 'mouseup', ( e ) => {

			if ( e.button === 0 ) this.mouseDown = false;
			if ( e.button === 2 ) this.rightDown = false;

		} );
		dom.addEventListener( 'contextmenu', ( e ) => e.preventDefault() );
		window.addEventListener( 'mousemove', ( e ) => {

			if ( this.locked || this.mouseDown || this.rightDown ) {

				// Browser/trackpad delta spikes are the main cause of sudden camera jumps. Clamp one
				// event's contribution while preserving precise small movements.
				const dx = Math.max( - 24, Math.min( 24, e.movementX || 0 ) );
				const dy = Math.max( - 24, Math.min( 24, e.movementY || 0 ) );
				this.look.x += dx;
				this.look.y += dy;

			}

		} );
		dom.addEventListener( 'wheel', ( e ) => {

			this.wheel += Math.sign( e.deltaY );
			e.preventDefault();

		}, { passive: false } );

		document.addEventListener( 'pointerlockchange', () => {

			this.locked = document.pointerLockElement === dom;
			// Discard any accumulated delta from the lock/unlock transition itself.
			this.look.x = 0;
			this.look.y = 0;

		} );

	}

	requestLock() {

		// Do not capture the desktop mouse automatically. The normal scheme is deliberate drag-to-look.
		// Keep an explicit opt-in for diagnostics or players who prefer classic FPS pointer lock.
		if ( this.pointerLockOptIn && ! this.locked ) this.dom.requestPointerLock?.()?.catch?.( () => {} );

	}

	down( code ) {

		return this.enabled && this.keys.has( code );

	}

	// true exactly once per physical key press. Consume immediately so a frame that throws before
	// endFrame() cannot replay the same action on every following RAF (important on mobile WebGPU).
	hit( code ) {

		if ( ! this.enabled || ! this.pressed.has( code ) ) return false;
		this.pressed.delete( code );
		return true;

	}

	consumeLook() {

		const l = { x: this.look.x, y: this.look.y };
		this.look.x = 0;
		this.look.y = 0;
		return l;

	}

	consumeWheel() {

		const w = this.wheel;
		this.wheel = 0;
		return w;

	}

	endFrame() {

		this.pressed.clear();

	}

}
