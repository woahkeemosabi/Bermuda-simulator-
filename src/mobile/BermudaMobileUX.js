// Bermuda Simulator mobile UX layer.
// Pointer Events are the single source of truth for mobile controls.

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

	try {

		const seen = JSON.parse( localStorage.getItem( 'tidewater.guide' ) || '{}' ) || {};
		seen.intro = true;
		localStorage.setItem( 'tidewater.guide', JSON.stringify( seen ) );

	} catch ( e ) { /* private webviews may block storage */ }

	let attempts = 0;
	const timer = setInterval( () => {

		attempts ++;
		const guide = app.game && app.game.guide;
		if ( ! guide ) {

			if ( attempts > 200 ) clearInterval( timer );
			return;

		}

		guide._wait = - 1;
		guide.seen = guide.seen || {};
		guide.seen.intro = true;
		guide.close && guide.close();
		guide.update = () => {};
		guide.tip = () => {};
		guide.replay = () => {};
		guide.el && guide.el.remove();
		guide.coach && guide.coach.remove();
		clearInterval( timer );

	}, 40 );

}

export function installMobileControls( app ) {

	if ( ! app || ! app.input || document.getElementById( 'bm-touch' ) ) return;
	const input = app.input;
	input.enabled = true;
	const qs = new URLSearchParams( location.search );
	const devUI = qs.has( 'dev' );
	const navDebug = qs.has( 'navdebug' );
	document.body.classList.add( 'bm-mobile' );
	tuneMobileImage( app );
	disableLegacyMobileGuide( app );

	const style = document.createElement( 'style' );
	style.textContent = `
		html,body,#app,#app canvas{touch-action:none!important;overscroll-behavior:none}
		#bm-touch{position:fixed;inset:0;z-index:60;pointer-events:none;user-select:none;-webkit-user-select:none;font-family:system-ui,-apple-system,sans-serif}
		#bm-touch .bm-stick{position:absolute;left:24px;bottom:max(24px,env(safe-area-inset-bottom));width:126px;height:126px;border-radius:50%;border:1px solid rgba(137,245,235,.45);background:rgba(5,22,31,.31);box-shadow:inset 0 0 26px rgba(66,238,221,.08),0 8px 28px rgba(0,0,0,.18);backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px);opacity:.9}
		#bm-touch .bm-nub{position:absolute;left:50%;top:50%;width:52px;height:52px;margin:-26px;border-radius:50%;background:rgba(119,240,228,.86);border:1px solid rgba(255,255,255,.78);box-shadow:0 4px 18px rgba(0,0,0,.25);transform:translate(0,0);transition:transform 70ms linear}
		#bm-touch .bm-stick.is-active .bm-nub{transition:none}
		#bm-touch .bm-actions{position:absolute;right:max(16px,env(safe-area-inset-right));bottom:max(28px,env(safe-area-inset-bottom));display:grid;grid-template-columns:58px 58px;gap:10px;pointer-events:auto}
		#bm-touch button{width:58px;height:58px;border-radius:50%;border:1px solid rgba(139,243,234,.5);background:rgba(5,22,31,.58);color:#eaffff;font-weight:750;font-size:10px;letter-spacing:.08em;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);touch-action:none;-webkit-tap-highlight-color:transparent}
		#bm-touch button:active,#bm-touch button.is-on{background:rgba(74,225,211,.78);color:#041619}
		.tw-start-keys[hidden]{display:none!important}
		body.bm-mobile .gm-guide,body.bm-mobile .gm-coach{display:none!important}
		${ devUI ? '' : 'body.bm-mobile .tw-rail,body.bm-mobile .tw-panel,body.bm-mobile .tw-help,body.bm-mobile .tw-stats,body.bm-mobile .gm-purse{display:none!important}' }
		@media (max-width:700px){body.bm-mobile .gm-map{width:102px;height:102px;right:15px;bottom:166px;opacity:.84}}
		#bm-navdebug{position:fixed;left:8px;top:72px;z-index:1000;min-width:190px;padding:8px 10px;border-radius:8px;background:rgba(0,0,0,.78);color:#8fffe9;font:11px/1.35 ui-monospace,SFMono-Regular,Menlo,monospace;pointer-events:none;white-space:pre}
	`;
	document.head.appendChild( style );

	const root = document.createElement( 'div' );
	root.id = 'bm-touch';
	root.innerHTML = `
		<div class="bm-stick"><div class="bm-nub"></div></div>
		<div class="bm-actions">
			<button type="button" data-key="KeyE">ACT</button>
			<button type="button" data-key="Space">UP</button>
			<button type="button" data-key="KeyC">DIVE</button>
			<button type="button" data-key="KeyV">CAM</button>
		</div>`;
	document.body.appendChild( root );

	const stick = root.querySelector( '.bm-stick' );
	const nub = root.querySelector( '.bm-nub' );
	const moveCodes = [ 'KeyW', 'KeyA', 'KeyS', 'KeyD' ];
	const down = ( code ) => {

		input.enabled = true;
		if ( ! input.keys.has( code ) ) input.pressed.add( code );
		input.keys.add( code );

	};
	const up = ( code ) => input.keys.delete( code );
	const clearMove = () => moveCodes.forEach( up );

	let movePointer = null, moveX = 0, moveY = 0;
	let lookPointer = null, lookX = 0, lookY = 0;
	const actionPointers = new Map();
	let lastEvent = 'none';

	const stickGeometry = () => {

		const r = stick.getBoundingClientRect();
		return {
			x: r.left + r.width * 0.5,
			y: r.top + r.height * 0.5,
			hit: Math.max( r.width, r.height ) * 0.64,
		};

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

		movePointer = null;
		clearMove();
		stick.classList.remove( 'is-active' );
		nub.style.transform = 'translate(0,0)';

	};

	const buttonAt = ( x, y ) => document.elementFromPoint( x, y )?.closest?.( '#bm-touch button[data-key]' ) || null;
	const startOverlayAt = ( x, y ) => document.elementFromPoint( x, y )?.closest?.( '.tw-start-cta,.tw-start' ) || null;

	// Movement and camera look are deliberately separate on mobile:
	// - movement starts only on the fixed visible joystick
	// - every other gameplay drag is camera look
	// This prevents a left/right camera swipe from relocating the joystick and stealing the gesture.
	const onPointerDown = ( e ) => {

		if ( e.pointerType === 'mouse' && e.button !== 0 ) return;
		lastEvent = `down ${ e.pointerType } #${ e.pointerId }`;
		const btn = buttonAt( e.clientX, e.clientY );
		if ( btn ) {

			const code = btn.dataset.key;
			actionPointers.set( e.pointerId, { code, btn } );
			down( code );
			btn.classList.add( 'is-on' );
			btn.setPointerCapture?.( e.pointerId );
			e.preventDefault();
			return;

		}
		if ( startOverlayAt( e.clientX, e.clientY ) ) return;

		const sg = stickGeometry();
		const onStick = Math.hypot( e.clientX - sg.x, e.clientY - sg.y ) <= sg.hit;
		if ( movePointer === null && onStick ) {

			movePointer = e.pointerId;
			moveX = sg.x;
			moveY = sg.y;
			stick.classList.add( 'is-active' );
			updateMove( e.clientX, e.clientY );
			document.documentElement.setPointerCapture?.( e.pointerId );
			e.preventDefault();
			return;

		}

		if ( lookPointer === null ) {

			lookPointer = e.pointerId;
			lookX = e.clientX; lookY = e.clientY;
			document.documentElement.setPointerCapture?.( e.pointerId );
			e.preventDefault();

		}

	};

	const onPointerMove = ( e ) => {

		if ( e.pointerId === movePointer ) {

			lastEvent = `move stick #${ e.pointerId }`;
			updateMove( e.clientX, e.clientY );
			e.preventDefault();
			return;

		}
		if ( e.pointerId === lookPointer ) {

			lastEvent = `move look #${ e.pointerId }`;
			input.enabled = true;
			// Clamp large webview deltas and use a lower sensitivity for smoother camera pans.
			const dx = Math.max( - 32, Math.min( 32, e.clientX - lookX ) );
			const dy = Math.max( - 32, Math.min( 32, e.clientY - lookY ) );
			input.look.x += dx * 0.72;
			input.look.y += dy * 0.72;
			lookX = e.clientX; lookY = e.clientY;
			e.preventDefault();

		}

	};

	const onPointerUp = ( e ) => {

		lastEvent = `up ${ e.pointerType } #${ e.pointerId }`;
		if ( e.pointerId === movePointer ) resetMove();
		if ( e.pointerId === lookPointer ) lookPointer = null;
		const a = actionPointers.get( e.pointerId );
		if ( a ) {

			up( a.code );
			a.btn.classList.remove( 'is-on' );
			actionPointers.delete( e.pointerId );

		}

	};

	document.addEventListener( 'pointerdown', onPointerDown, { passive: false, capture: true } );
	document.addEventListener( 'pointermove', onPointerMove, { passive: false, capture: true } );
	document.addEventListener( 'pointerup', onPointerUp, { passive: false, capture: true } );
	document.addEventListener( 'pointercancel', onPointerUp, { passive: false, capture: true } );

	window.addEventListener( 'blur', () => {

		resetMove();
		lookPointer = null;
		for ( const { code, btn } of actionPointers.values() ) {

			up( code );
			btn.classList.remove( 'is-on' );

		}
		actionPointers.clear();

	} );

	if ( navDebug ) {

		const dbg = document.createElement( 'div' );
		dbg.id = 'bm-navdebug';
		document.body.appendChild( dbg );
		setInterval( () => {

			const p = app.player;
			const keys = moveCodes.filter( ( k ) => input.keys.has( k ) ).map( ( k ) => k.slice( 3 ) ).join( '' ) || '-';
			dbg.textContent = [
				`event ${ lastEvent }`,
				`input ${ input.enabled ? 'ON' : 'OFF' } keys ${ keys }`,
				`movePtr ${ movePointer ?? '-' } lookPtr ${ lookPointer ?? '-' }`,
				`mode ${ p?.mode || '-' } freeCam ${ app.freeCam ? 'Y' : 'N' }`,
				`pos ${ p ? `${ p.position.x.toFixed( 2 ) }, ${ p.position.z.toFixed( 2 ) }` : '-' }`,
				`vel ${ p ? `${ p.velocity.x.toFixed( 2 ) }, ${ p.velocity.z.toFixed( 2 ) }` : '-' }`,
			].join( '\n' );

		}, 100 );

	}

}
