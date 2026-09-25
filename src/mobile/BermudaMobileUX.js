// Bermuda Simulator mobile UX layer.
// The upstream project was designed around keyboard + mouse. This module keeps its Input API intact,
// but gives iPhone/iPad a native touch path and removes desktop/debug UI that should not ship on mobile.

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

	// The first emergency mobile pass used a very low render scale. Keep the expensive optional
	// effects off for now, but make the image noticeably cleaner and less smeared while we rebuild
	// the actual Bermuda art assets.
	const p = app.post && app.post.params;
	if ( p && p.sharpen ) p.sharpen.value = Math.max( p.sharpen.value, 0.62 );
	if ( p && p.saturation ) p.saturation.value = 1.04;
	if ( p && p.contrast ) p.contrast.value = 1.03;
	if ( app.post && app.post.motionBlur && app.post.motionBlur.shutter ) app.post.motionBlur.shutter.value = 0.08;

}

function disableLegacyMobileGuide( app ) {

	// The Tidewater first-run fishing guide owns the full screen while open, so it intercepts touch
	// before the joystick can receive it. On mobile Bermuda we do not want that desktop guide at all.
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
			guide._save && guide._save();
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

	}, 50 );

}

export function installMobileControls( app ) {

	if ( ! app || ! app.input || document.getElementById( 'bm-touch' ) ) return;
	const input = app.input;
	const devUI = new URLSearchParams( location.search ).has( 'dev' );
	document.body.classList.add( 'bm-mobile' );
	tuneMobileImage( app );
	disableLegacyMobileGuide( app );

	const style = document.createElement( 'style' );
	style.textContent = `
		#bm-touch{position:fixed;inset:0;z-index:40;pointer-events:none;user-select:none;-webkit-user-select:none;touch-action:none;font-family:system-ui,-apple-system,sans-serif}
		#bm-touch .bm-look{position:absolute;right:0;top:22%;bottom:0;width:62vw;pointer-events:auto;touch-action:none;background:transparent}
		#bm-touch .bm-stick{position:absolute;left:max(18px,env(safe-area-inset-left));bottom:max(24px,env(safe-area-inset-bottom));width:128px;height:128px;border-radius:50%;border:1px solid rgba(137,245,235,.42);background:rgba(5,22,31,.30);box-shadow:inset 0 0 26px rgba(66,238,221,.08),0 8px 30px rgba(0,0,0,.15);pointer-events:auto;touch-action:none;backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px)}
		#bm-touch .bm-nub{position:absolute;left:50%;top:50%;width:52px;height:52px;margin:-26px;border-radius:50%;background:rgba(119,240,228,.82);border:1px solid rgba(255,255,255,.75);box-shadow:0 4px 18px rgba(0,0,0,.24);transform:translate(0,0);transition:transform 55ms linear}
		#bm-touch .bm-actions{position:absolute;right:max(16px,env(safe-area-inset-right));bottom:max(26px,env(safe-area-inset-bottom));display:grid;grid-template-columns:58px 58px;gap:10px;pointer-events:auto}
		#bm-touch button{width:58px;height:58px;border-radius:50%;border:1px solid rgba(139,243,234,.48);background:rgba(5,22,31,.54);color:#eaffff;font-weight:750;font-size:10px;letter-spacing:.08em;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);touch-action:none;-webkit-tap-highlight-color:transparent}
		#bm-touch button:active,#bm-touch button.is-on{background:rgba(74,225,211,.76);color:#041619}
		.tw-start-keys[hidden]{display:none!important}
		body.bm-mobile .gm-guide,body.bm-mobile .gm-coach{display:none!important}
		${ devUI ? '' : 'body.bm-mobile .tw-rail,body.bm-mobile .tw-panel,body.bm-mobile .tw-help,body.bm-mobile .tw-stats,body.bm-mobile .gm-purse{display:none!important}' }
		@media (max-width:700px){body.bm-mobile .gm-map{width:106px;height:106px;right:14px;bottom:164px;opacity:.82}}
		@media (max-height:680px){#bm-touch .bm-stick{width:108px;height:108px}#bm-touch .bm-actions{grid-template-columns:50px 50px}#bm-touch button{width:50px;height:50px}.bm-mobile .gm-map{display:none!important}}
		@media (min-width:900px) and (pointer:fine){#bm-touch{display:none}}
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
	const moveCodes = [ 'KeyW', 'KeyA', 'KeyS', 'KeyD' ];
	const clearMove = () => moveCodes.forEach( up );

	// ----- left analogue stick -------------------------------------------------------------
	const stick = root.querySelector( '.bm-stick' );
	const nub = root.querySelector( '.bm-nub' );
	const updateStickPoint = ( clientX, clientY ) => {

		const r = stick.getBoundingClientRect();
		let x = ( clientX - ( r.left + r.width / 2 ) ) / ( r.width * 0.5 );
		let y = ( clientY - ( r.top + r.height / 2 ) ) / ( r.height * 0.5 );
		const len = Math.hypot( x, y );
		if ( len > 1 ) { x /= len; y /= len; }
		nub.style.transform = `translate(${ x * 35 }px,${ y * 35 }px)`;
		clearMove();
		const dead = 0.18;
		if ( y < - dead ) down( 'KeyW' );
		if ( y > dead ) down( 'KeyS' );
		if ( x < - dead ) down( 'KeyA' );
		if ( x > dead ) down( 'KeyD' );

	};
	const resetStick = () => {

		clearMove();
		nub.style.transform = 'translate(0,0)';

	};

	// iOS touch events are the authoritative mobile path. Pointer events remain as a fallback for
	// touch-capable desktop browsers and remote debugging.
	let stickTouch = null;
	const touchById = ( list, id ) => [ ...list ].find( ( t ) => t.identifier === id );
	stick.addEventListener( 'touchstart', ( e ) => {

		if ( stickTouch !== null ) return;
		const t = e.changedTouches[ 0 ];
		stickTouch = t.identifier;
		updateStickPoint( t.clientX, t.clientY );
		e.preventDefault();

	}, { passive: false } );
	stick.addEventListener( 'touchmove', ( e ) => {

		const t = touchById( e.touches, stickTouch );
		if ( ! t ) return;
		updateStickPoint( t.clientX, t.clientY );
		e.preventDefault();

	}, { passive: false } );
	const endStickTouch = ( e ) => {

		if ( stickTouch === null ) return;
		if ( touchById( e.touches, stickTouch ) ) return;
		stickTouch = null;
		resetStick();
		e.preventDefault();

	};
	stick.addEventListener( 'touchend', endStickTouch, { passive: false } );
	stick.addEventListener( 'touchcancel', endStickTouch, { passive: false } );

	let stickPointer = null;
	stick.addEventListener( 'pointerdown', ( e ) => {

		if ( e.pointerType === 'touch' ) return;
		stickPointer = e.pointerId;
		stick.setPointerCapture?.( e.pointerId );
		updateStickPoint( e.clientX, e.clientY );
		e.preventDefault();

	} );
	stick.addEventListener( 'pointermove', ( e ) => {

		if ( e.pointerId === stickPointer ) updateStickPoint( e.clientX, e.clientY );

	} );
	const endStickPointer = ( e ) => {

		if ( e.pointerId !== stickPointer ) return;
		stickPointer = null;
		resetStick();

	};
	stick.addEventListener( 'pointerup', endStickPointer );
	stick.addEventListener( 'pointercancel', endStickPointer );

	// ----- right-side drag look ------------------------------------------------------------
	const look = root.querySelector( '.bm-look' );
	let lookTouch = null, lx = 0, ly = 0;
	look.addEventListener( 'touchstart', ( e ) => {

		if ( lookTouch !== null ) return;
		const t = e.changedTouches[ 0 ];
		lookTouch = t.identifier;
		lx = t.clientX; ly = t.clientY;
		e.preventDefault();

	}, { passive: false } );
	look.addEventListener( 'touchmove', ( e ) => {

		const t = touchById( e.touches, lookTouch );
		if ( ! t ) return;
		input.look.x += ( t.clientX - lx ) * 1.05;
		input.look.y += ( t.clientY - ly ) * 1.05;
		lx = t.clientX; ly = t.clientY;
		e.preventDefault();

	}, { passive: false } );
	const endLookTouch = ( e ) => {

		if ( lookTouch === null || touchById( e.touches, lookTouch ) ) return;
		lookTouch = null;
		e.preventDefault();

	};
	look.addEventListener( 'touchend', endLookTouch, { passive: false } );
	look.addEventListener( 'touchcancel', endLookTouch, { passive: false } );

	let lookPointer = null;
	look.addEventListener( 'pointerdown', ( e ) => {

		if ( e.pointerType === 'touch' ) return;
		lookPointer = e.pointerId;
		lx = e.clientX; ly = e.clientY;
		look.setPointerCapture?.( e.pointerId );
		e.preventDefault();

	} );
	look.addEventListener( 'pointermove', ( e ) => {

		if ( e.pointerId !== lookPointer ) return;
		input.look.x += ( e.clientX - lx ) * 1.05;
		input.look.y += ( e.clientY - ly ) * 1.05;
		lx = e.clientX; ly = e.clientY;

	} );
	const endLookPointer = ( e ) => { if ( e.pointerId === lookPointer ) lookPointer = null; };
	look.addEventListener( 'pointerup', endLookPointer );
	look.addEventListener( 'pointercancel', endLookPointer );

	// ----- action buttons ------------------------------------------------------------------
	for ( const b of root.querySelectorAll( 'button[data-key]' ) ) {

		const code = b.dataset.key;
		const press = ( e ) => {

			down( code );
			b.classList.add( 'is-on' );
			e.preventDefault();

		};
		const release = ( e ) => {

			up( code );
			b.classList.remove( 'is-on' );
			e && e.preventDefault();

		};
		b.addEventListener( 'touchstart', press, { passive: false } );
		b.addEventListener( 'touchend', release, { passive: false } );
		b.addEventListener( 'touchcancel', release, { passive: false } );
		b.addEventListener( 'pointerdown', ( e ) => { if ( e.pointerType !== 'touch' ) press( e ); } );
		b.addEventListener( 'pointerup', ( e ) => { if ( e.pointerType !== 'touch' ) release( e ); } );
		b.addEventListener( 'pointercancel', ( e ) => { if ( e.pointerType !== 'touch' ) release( e ); } );

	}

	window.addEventListener( 'blur', () => {

		resetStick();
		for ( const code of [ 'KeyE', 'Space', 'KeyC', 'KeyV' ] ) up( code );

	} );

}