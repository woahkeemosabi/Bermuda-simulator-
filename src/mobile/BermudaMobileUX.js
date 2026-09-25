// Bermuda Simulator mobile UX layer.
// Mobile is handled as a first-class input surface rather than pretending touches are mouse events.

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

function tuneMobileImage( app ) {

	const p = app.post && app.post.params;
	if ( p && p.sharpen ) p.sharpen.value = Math.max( p.sharpen.value, 0.76 );
	if ( p && p.saturation ) p.saturation.value = 1.03;
	if ( p && p.contrast ) p.contrast.value = 1.045;
	if ( app.post && app.post.motionBlur && app.post.motionBlur.shutter ) app.post.motionBlur.shutter.value = 0;

}

function disableLegacyMobileGuide( app ) {

	// Mark the upstream desktop fishing tutorial as already seen before it gets a chance to own the
	// screen. It is not part of the Bermuda mobile product.
	try {

		const seen = JSON.parse( localStorage.getItem( 'tidewater.guide' ) || '{}' ) || {};
		seen.intro = true;
		localStorage.setItem( 'tidewater.guide', JSON.stringify( seen ) );

	} catch ( e ) { /* storage can be unavailable in private webviews */ }

	let attempts = 0;
	const timer = setInterval( () => {

		attempts ++;
		const guide = app.game && app.game.guide;
		if ( ! guide ) {

			if ( attempts > 200 ) clearInterval( timer );
			return;

		}

		try {

			guide._wait = - 1;
			guide.seen = guide.seen || {};
			guide.seen.intro = true;
			guide.close && guide.close();
			guide.update = () => {};
			guide.tip = () => {};
			guide.replay = () => {};
			guide.el && guide.el.remove();
			guide.coach && guide.coach.remove();

		} catch ( e ) {

			console.warn( 'Bermuda mobile guide cleanup:', e );

		}
		clearInterval( timer );

	}, 40 );

}

export function installMobileControls( app ) {

	if ( ! app || ! app.input || document.getElementById( 'bm-touch' ) ) return;
	const input = app.input;
	input.enabled = true;
	const devUI = new URLSearchParams( location.search ).has( 'dev' );
	document.body.classList.add( 'bm-mobile' );
	tuneMobileImage( app );
	disableLegacyMobileGuide( app );

	const style = document.createElement( 'style' );
	style.textContent = `
		#bm-touch{position:fixed;inset:0;z-index:60;pointer-events:none;user-select:none;-webkit-user-select:none;font-family:system-ui,-apple-system,sans-serif}
		#bm-touch .bm-stick{position:absolute;left:24px;bottom:max(24px,env(safe-area-inset-bottom));width:126px;height:126px;border-radius:50%;border:1px solid rgba(137,245,235,.45);background:rgba(5,22,31,.31);box-shadow:inset 0 0 26px rgba(66,238,221,.08),0 8px 28px rgba(0,0,0,.18);backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px);transition:opacity .12s;opacity:.9}
		#bm-touch .bm-nub{position:absolute;left:50%;top:50%;width:52px;height:52px;margin:-26px;border-radius:50%;background:rgba(119,240,228,.86);border:1px solid rgba(255,255,255,.78);box-shadow:0 4px 18px rgba(0,0,0,.25);transform:translate(0,0)}
		#bm-touch .bm-actions{position:absolute;right:max(16px,env(safe-area-inset-right));bottom:max(28px,env(safe-area-inset-bottom));display:grid;grid-template-columns:58px 58px;gap:10px;pointer-events:auto}
		#bm-touch button{width:58px;height:58px;border-radius:50%;border:1px solid rgba(139,243,234,.5);background:rgba(5,22,31,.58);color:#eaffff;font-weight:750;font-size:10px;letter-spacing:.08em;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);touch-action:none;-webkit-tap-highlight-color:transparent}
		#bm-touch button:active,#bm-touch button.is-on{background:rgba(74,225,211,.78);color:#041619}
		.tw-start-keys[hidden]{display:none!important}
		body.bm-mobile .gm-guide,body.bm-mobile .gm-coach{display:none!important}
		${ devUI ? '' : 'body.bm-mobile .tw-rail,body.bm-mobile .tw-panel,body.bm-mobile .tw-help,body.bm-mobile .tw-stats,body.bm-mobile .gm-purse{display:none!important}' }
		@media (max-width:700px){body.bm-mobile .gm-map{width:102px;height:102px;right:15px;bottom:166px;opacity:.84}}
		@media (max-height:680px){#bm-touch .bm-stick{width:108px;height:108px}#bm-touch .bm-actions{grid-template-columns:50px 50px}#bm-touch button{width:50px;height:50px}.bm-mobile .gm-map{display:none!important}}
	`;
	document.head.appendChild( style );

	const root = document.createElement( 'div' );
	root.id = 'bm-touch';
	root.innerHTML = `
		<div class="bm-stick" aria-hidden="true"><div class="bm-nub"></div></div>
		<div class="bm-actions">
			<button type="button" data-key="KeyE">ACT</button>
			<button type="button" data-key="Space">UP</button>
			<button type="button" data-key="KeyC">DIVE</button>
			<button type="button" data-key="KeyV">CAM</button>
		</div>`;
	document.body.appendChild( root );

	const stick = root.querySelector( '.bm-stick' );
	const nub = root.querySelector( '.bm-nub' );
	const buttons = [ ...root.querySelectorAll( 'button[data-key]' ) ];
	const moveCodes = [ 'KeyW', 'KeyA', 'KeyS', 'KeyD' ];
	const down = ( code ) => {

		input.enabled = true;
		if ( ! input.keys.has( code ) ) input.pressed.add( code );
		input.keys.add( code );

	};
	const up = ( code ) => input.keys.delete( code );
	const clearMove = () => moveCodes.forEach( up );

	let moveTouch = null, moveX = 0, moveY = 0;
	let lookTouch = null, lookX = 0, lookY = 0;
	const actionTouches = new Map();
	const touchById = ( list, id ) => {

		if ( id === null ) return null;
		for ( let i = 0; i < list.length; i ++ ) if ( list[ i ].identifier === id ) return list[ i ];
		return null;

	};

	const setStickOrigin = ( x, y ) => {

		const r = 63;
		const left = Math.max( 12, Math.min( innerWidth * 0.5 - 2 * r - 6, x - r ) );
		const top = Math.max( innerHeight * 0.38, Math.min( innerHeight - 2 * r - 18, y - r ) );
		stick.style.left = `${ left }px`;
		stick.style.top = `${ top }px`;
		stick.style.bottom = 'auto';
		stick.style.opacity = '1';

	};
	const updateMove = ( x, y ) => {

		let dx = ( x - moveX ) / 52;
		let dy = ( y - moveY ) / 52;
		const len = Math.hypot( dx, dy );
		if ( len > 1 ) { dx /= len; dy /= len; }
		nub.style.transform = `translate(${ dx * 35 }px,${ dy * 35 }px)`;
		clearMove();
		const dead = 0.16;
		if ( dy < - dead ) down( 'KeyW' );
		if ( dy > dead ) down( 'KeyS' );
		if ( dx < - dead ) down( 'KeyA' );
		if ( dx > dead ) down( 'KeyD' );

	};
	const resetMove = () => {

		moveTouch = null;
		clearMove();
		nub.style.transform = 'translate(0,0)';
		stick.style.opacity = '.9';

	};

	const buttonAt = ( x, y ) => {

		const el = document.elementFromPoint( x, y );
		return el && el.closest ? el.closest( '#bm-touch button[data-key]' ) : null;

	};

	// Capture at document level. This deliberately does not depend on Safari routing touch events to
	// a particular overlay element: any touch in the lower-left play zone becomes movement and any
	// other world touch becomes camera look. That removes the WebView/Safari hit-testing failure we
	// saw with the first two joystick implementations.
	const onTouchStart = ( e ) => {

		let claimed = false;
		for ( let i = 0; i < e.changedTouches.length; i ++ ) {

			const t = e.changedTouches[ i ];
			const btn = buttonAt( t.clientX, t.clientY );
			if ( btn ) {

				const code = btn.dataset.key;
				actionTouches.set( t.identifier, { code, btn } );
				down( code );
				btn.classList.add( 'is-on' );
				claimed = true;
				continue;

			}

			const startCta = document.elementFromPoint( t.clientX, t.clientY )?.closest?.( '.tw-start-cta' );
			if ( startCta ) continue;

			if ( moveTouch === null && t.clientX < innerWidth * 0.52 && t.clientY > innerHeight * 0.30 ) {

				moveTouch = t.identifier;
				moveX = t.clientX; moveY = t.clientY;
				setStickOrigin( moveX, moveY );
				updateMove( t.clientX, t.clientY );
				claimed = true;

			} else if ( lookTouch === null ) {

				lookTouch = t.identifier;
				lookX = t.clientX; lookY = t.clientY;
				claimed = true;

			}

		}
		if ( claimed ) e.preventDefault();

	};

	const onTouchMove = ( e ) => {

		let claimed = false;
		const m = touchById( e.touches, moveTouch );
		if ( m ) {

			updateMove( m.clientX, m.clientY );
			claimed = true;

		}
		const l = touchById( e.touches, lookTouch );
		if ( l ) {

			input.enabled = true;
			input.look.x += ( l.clientX - lookX ) * 1.05;
			input.look.y += ( l.clientY - lookY ) * 1.05;
			lookX = l.clientX; lookY = l.clientY;
			claimed = true;

		}
		if ( claimed || actionTouches.size ) e.preventDefault();

	};

	const onTouchEnd = ( e ) => {

		let claimed = false;
		if ( moveTouch !== null && ! touchById( e.touches, moveTouch ) ) {

			resetMove();
			claimed = true;

		}
		if ( lookTouch !== null && ! touchById( e.touches, lookTouch ) ) {

			lookTouch = null;
			claimed = true;

		}
		for ( const [ id, a ] of [ ...actionTouches ] ) {

			if ( touchById( e.touches, id ) ) continue;
			up( a.code );
			a.btn.classList.remove( 'is-on' );
			actionTouches.delete( id );
			claimed = true;

		}
		if ( claimed ) e.preventDefault();

	};

	document.addEventListener( 'touchstart', onTouchStart, { passive: false, capture: true } );
	document.addEventListener( 'touchmove', onTouchMove, { passive: false, capture: true } );
	document.addEventListener( 'touchend', onTouchEnd, { passive: false, capture: true } );
	document.addEventListener( 'touchcancel', onTouchEnd, { passive: false, capture: true } );

	// Pointer fallback for touch-screen laptops / remote inspection. iPhone uses the document touch
	// path above.
	for ( const b of buttons ) {

		b.addEventListener( 'pointerdown', ( e ) => {

			if ( e.pointerType === 'touch' ) return;
			down( b.dataset.key );
			b.classList.add( 'is-on' );
			e.preventDefault();

		} );
		const release = ( e ) => {

			if ( e.pointerType === 'touch' ) return;
			up( b.dataset.key );
			b.classList.remove( 'is-on' );

		};
		b.addEventListener( 'pointerup', release );
		b.addEventListener( 'pointercancel', release );

	}

	window.addEventListener( 'blur', () => {

		resetMove();
		lookTouch = null;
		for ( const { code, btn } of actionTouches.values() ) {

			up( code );
			btn.classList.remove( 'is-on' );

		}
		actionTouches.clear();

	} );

}