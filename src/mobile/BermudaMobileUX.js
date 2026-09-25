// Bermuda Simulator mobile UX layer.
// Keeps the upstream keyboard/mouse input model intact while translating touch gestures into
// the same public Input state (keys / pressed / look). This makes the prototype playable on
// iPhone without forking Player or BoatController.

export function applyBermudaBranding( mobile = false ) {

	const root = document.documentElement;
	const walker = document.createTreeWalker( root, NodeFilter.SHOW_TEXT );
	const nodes = [];
	while ( walker.nextNode() ) nodes.push( walker.currentNode );
	for ( const n of nodes ) {

		if ( ! n.nodeValue ) continue;
		n.nodeValue = n.nodeValue.replaceAll( 'TIDEWATER', 'BERMUDA' ).replaceAll( 'Tidewater', 'Bermuda' );

	}

	if ( mobile ) {

		const cta = document.querySelector( '.tw-start-cta span:last-child' );
		if ( cta ) cta.textContent = 'Tap to explore';
		const keys = document.querySelector( '.tw-start-keys' );
		if ( keys ) keys.hidden = true;

	}

}

export function installMobileControls( app ) {

	if ( ! app || ! app.input || document.getElementById( 'bm-touch' ) ) return;
	const input = app.input;
	const style = document.createElement( 'style' );
	style.textContent = `
		#bm-touch{position:fixed;inset:0;z-index:18;pointer-events:none;user-select:none;-webkit-user-select:none;touch-action:none;font-family:system-ui,-apple-system,sans-serif}
		#bm-touch .bm-look{position:absolute;right:0;bottom:0;width:58vw;height:52vh;pointer-events:auto;touch-action:none;background:transparent}
		#bm-touch .bm-stick{position:absolute;left:max(18px,env(safe-area-inset-left));bottom:max(22px,env(safe-area-inset-bottom));width:132px;height:132px;border-radius:50%;border:1px solid rgba(137,245,235,.46);background:rgba(5,22,31,.38);box-shadow:inset 0 0 28px rgba(66,238,221,.08);pointer-events:auto;touch-action:none;backdrop-filter:blur(5px)}
		#bm-touch .bm-nub{position:absolute;left:50%;top:50%;width:54px;height:54px;margin:-27px;border-radius:50%;background:rgba(119,240,228,.74);border:1px solid rgba(255,255,255,.72);box-shadow:0 4px 20px rgba(0,0,0,.25);transform:translate(0,0)}
		#bm-touch .bm-actions{position:absolute;right:max(15px,env(safe-area-inset-right));bottom:max(28px,env(safe-area-inset-bottom));display:grid;grid-template-columns:58px 58px;gap:9px;pointer-events:auto}
		#bm-touch button{width:58px;height:58px;border-radius:50%;border:1px solid rgba(139,243,234,.5);background:rgba(5,22,31,.62);color:#eaffff;font-weight:700;font-size:11px;letter-spacing:.06em;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);touch-action:none}
		#bm-touch button:active,#bm-touch button.is-on{background:rgba(74,225,211,.68);color:#041619}
		@media (min-width:900px) and (pointer:fine){#bm-touch{display:none}}
		@media (max-height:560px){#bm-touch .bm-stick{width:108px;height:108px}.bm-nub{transform:scale(.9)}#bm-touch .bm-actions{grid-template-columns:50px 50px}#bm-touch button{width:50px;height:50px}}
		.tw-start-keys[hidden]{display:none!important}
	`;
	document.head.appendChild( style );

	const root = document.createElement( 'div' );
	root.id = 'bm-touch';
	root.innerHTML = `
		<div class="bm-look" aria-label="Drag to look"></div>
		<div class="bm-stick" aria-label="Movement joystick"><div class="bm-nub"></div></div>
		<div class="bm-actions">
			<button type="button" data-key="KeyE">ACT</button>
			<button type="button" data-key="Space">UP</button>
			<button type="button" data-key="KeyC">DIVE</button>
			<button type="button" data-key="KeyV">CAM</button>
		</div>`;
	document.body.appendChild( root );

	const down = ( code ) => {

		if ( ! input.keys.has( code ) ) input.pressed.add( code );
		input.keys.add( code );

	};
	const up = ( code ) => input.keys.delete( code );

	// Left analogue stick -> WASD. The game remains authoritative for speed and physics.
	const stick = root.querySelector( '.bm-stick' );
	const nub = root.querySelector( '.bm-nub' );
	let stickId = null;
	const moveCodes = [ 'KeyW', 'KeyA', 'KeyS', 'KeyD' ];
	const clearMove = () => moveCodes.forEach( up );
	const updateStick = ( e ) => {

		const r = stick.getBoundingClientRect();
		let x = ( e.clientX - ( r.left + r.width / 2 ) ) / ( r.width * 0.5 );
		let y = ( e.clientY - ( r.top + r.height / 2 ) ) / ( r.height * 0.5 );
		const len = Math.hypot( x, y );
		if ( len > 1 ) { x /= len; y /= len; }
		nub.style.transform = `translate(${ x * 37 }px,${ y * 37 }px)`;
		clearMove();
		const dead = 0.24;
		if ( y < - dead ) down( 'KeyW' );
		if ( y > dead ) down( 'KeyS' );
		if ( x < - dead ) down( 'KeyA' );
		if ( x > dead ) down( 'KeyD' );

	};
	stick.addEventListener( 'pointerdown', ( e ) => {

		stickId = e.pointerId;
		stick.setPointerCapture( e.pointerId );
		updateStick( e );
		e.preventDefault();

	} );
	stick.addEventListener( 'pointermove', ( e ) => {

		if ( e.pointerId === stickId ) updateStick( e );

	} );
	const endStick = ( e ) => {

		if ( e.pointerId !== stickId ) return;
		stickId = null;
		clearMove();
		nub.style.transform = 'translate(0,0)';

	};
	stick.addEventListener( 'pointerup', endStick );
	stick.addEventListener( 'pointercancel', endStick );

	// Drag anywhere in the lower-right play area to look around. UI panels sit above this layer.
	const look = root.querySelector( '.bm-look' );
	let lookId = null, lx = 0, ly = 0;
	look.addEventListener( 'pointerdown', ( e ) => {

		lookId = e.pointerId;
		lx = e.clientX; ly = e.clientY;
		look.setPointerCapture( e.pointerId );
		e.preventDefault();

	} );
	look.addEventListener( 'pointermove', ( e ) => {

		if ( e.pointerId !== lookId ) return;
		input.look.x += ( e.clientX - lx ) * 1.15;
		input.look.y += ( e.clientY - ly ) * 1.15;
		lx = e.clientX; ly = e.clientY;
		e.preventDefault();

	} );
	const endLook = ( e ) => { if ( e.pointerId === lookId ) lookId = null; };
	look.addEventListener( 'pointerup', endLook );
	look.addEventListener( 'pointercancel', endLook );

	for ( const b of root.querySelectorAll( 'button[data-key]' ) ) {

		const code = b.dataset.key;
		b.addEventListener( 'pointerdown', ( e ) => {

			b.setPointerCapture( e.pointerId );
			down( code );
			b.classList.add( 'is-on' );
			e.preventDefault();

		} );
		const release = () => { up( code ); b.classList.remove( 'is-on' ); };
		b.addEventListener( 'pointerup', release );
		b.addEventListener( 'pointercancel', release );

	}

	window.addEventListener( 'blur', () => {

		clearMove();
		for ( const code of [ 'KeyE', 'Space', 'KeyC', 'KeyV' ] ) up( code );

	} );

}
