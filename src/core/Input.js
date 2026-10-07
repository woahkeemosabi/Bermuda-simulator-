// Keyboard / mouse input with pointer lock support.
export class Input {

	constructor( dom ) {

		this.dom = dom;
		this.keys = new Set();
		this.pressed = new Set();
		this.look = { x: 0, y: 0 };
		this.lookSmooth = { x: 0, y: 0 };
		this.wheel = 0;
		this.mouseDown = false;
		this.rightDown = false;
		this.locked = false;
		this.enabled = true;

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

				// Pointer-lock can report very large deltas after a slow frame, focus change or
				// cursor recapture. Never let one browser event whip the camera around.
				const dx = Math.max( -42, Math.min( 42, Number( e.movementX ) || 0 ) );
				const dy = Math.max( -34, Math.min( 34, Number( e.movementY ) || 0 ) );
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

		} );

	}

	requestLock() {

		if ( ! this.locked ) this.dom.requestPointerLock?.()?.catch?.( () => {} );

	}

	down( code ) {

		return this.enabled && this.keys.has( code );

	}

	// true once per physical key press
	hit( code ) {

		return this.enabled && this.pressed.has( code );

	}

	consumeLook() {

		// At low frame rates many mouse events can accumulate before one render frame. Clamp the
		// frame total, then damp it so 12 FPS still feels controlled instead of applying a giant snap.
		const rawX = Math.max( -64, Math.min( 64, this.look.x ) );
		const rawY = Math.max( -48, Math.min( 48, this.look.y ) );
		this.look.x = 0;
		this.look.y = 0;

		const response = 0.58;
		this.lookSmooth.x += ( rawX - this.lookSmooth.x ) * response;
		this.lookSmooth.y += ( rawY - this.lookSmooth.y ) * response;

		if ( Math.abs( rawX ) < 0.01 && Math.abs( this.lookSmooth.x ) < 0.08 ) this.lookSmooth.x = 0;
		if ( Math.abs( rawY ) < 0.01 && Math.abs( this.lookSmooth.y ) < 0.08 ) this.lookSmooth.y = 0;

		return { x: this.lookSmooth.x, y: this.lookSmooth.y };

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
