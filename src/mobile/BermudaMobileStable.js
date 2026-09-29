// Stable Bermuda mobile controls.
// V3: floating movement pad + independent look + contextual action buttons.

export function installStableMobileControls( app ) {

	if ( ! app || ! app.input || document.getElementById( 'bm-touch-stable' ) ) return;
	const input = app.input;
	input.enabled = true;
	document.body.classList.add( 'bm-mobile' );

	const style = document.createElement( 'style' );
	style.textContent = `
		html,body,#app,#app canvas{touch-action:none!important;overscroll-behavior:none}
		#bm-touch-stable{position:fixed;inset:0;z-index:70;pointer-events:none;user-select:none;-webkit-user-select:none;font-family:system-ui,-apple-system,sans-serif}
		#bm-touch-stable .bm-stick{position:absolute;left:0;top:0;width:132px;height:132px;border-radius:50%;border:1px solid rgba(137,245,235,.45);background:rgba(5,22,31,.28);box-shadow:inset 0 0 28px rgba(66,238,221,.09),0 8px 28px rgba(0,0,0,.18);backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px);opacity:0;transform:scale(.9);transition:opacity 90ms ease,transform 90ms ease;pointer-events:none}
		#bm-touch-stable .bm-stick.is-active{opacity:.92;transform:scale(1)}
		#bm-touch-stable .bm-nub{position:absolute;left:50%;top:50%;width:52px;height:52px;margin:-26px;border-radius:50%;background:rgba(119,240,228,.9);border:1px solid rgba(255,255,255,.8);box-shadow:0 4px 18px rgba(0,0,0,.25);transform:translate(0,0)}
		#bm-touch-stable .bm-actions{position:absolute;right:max(16px,env(safe-area-inset-right));bottom:max(28px,env(safe-area-inset-bottom));display:grid;grid-template-columns:58px 58px;gap:10px;pointer-events:auto;align-items:end;justify-items:end}
		#bm-touch-stable button{width:58px;height:58px;border-radius:50%;border:1px solid rgba(139,243,234,.5);background:rgba(5,22,31,.58);color:#eaffff;font-weight:750;font-size:10px;letter-spacing:.08em;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);touch-action:none;-webkit-tap-highlight-color:transparent;padding:0 3px;transition:opacity .14s,transform .14s}
		#bm-touch-stable button:active,#bm-touch-stable button.is-on{background:rgba(74,225,211,.78);color:#041619}
		#bm-touch-stable button.is-muted{opacity:.42}
		#bm-touch-stable button.bm-hidden{display:none!important}
		body.bm-mobile .gm-guide,body.bm-mobile .gm-coach{display:none!important}
		body.bm-mobile .tw-rail,body.bm-mobile .tw-panel,body.bm-mobile .tw-help,body.bm-mobile .tw-stats{display:none!important}
		body.bm-mobile .gm-purse{display:flex!important;left:14px;right:14px;top:54px;width:auto;max-width:calc(100vw - 28px);gap:7px;padding:6px 9px;border-radius:12px;flex-wrap:wrap;font-size:11px;pointer-events:none}
		body.bm-mobile .gm-money{display:none!important}
		body.bm-mobile .gm-cooler{gap:5px}
		body.bm-mobile .gm-cooler-label{display:none}
		body.bm-mobile .gm-cooler-bar{width:38px;height:4px}
		body.bm-mobile .gm-gauge{gap:5px}
		body.bm-mobile .gm-dive-depth{font-size:10px;opacity:.82}
		body.bm-mobile .tw-depth{display:none!important}
		body.bm-mobile .tw-start{background:radial-gradient(90% 55% at 50% 18%,rgba(40,132,181,.96),rgba(9,52,76,.98) 62%,#04151f 100%)!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}
		body.bm-mobile .tw-start-inner{background:rgba(3,22,32,.34);border:1px solid rgba(150,242,234,.18);border-radius:24px;padding:24px 22px;box-shadow:0 22px 70px rgba(0,0,0,.28)}
		@media (max-width:700px){body.bm-mobile .gm-map{width:96px;height:96px;right:14px;bottom:188px;opacity:.82}}
	`;
	document.head.appendChild( style );

	const root = document.createElement( 'div' );
	root.id = 'bm-touch-stable';
	root.innerHTML = `
		<div class="bm-stick"><div class="bm-nub"></div></div>
		<div class="bm-actions">
			<button type="button" data-role="context" data-key="KeyE">ACT</button>
			<button type="button" data-role="up" data-key="Space">UP</button>
			<button type="button" data-role="dive" data-key="KeyC">DIVE</button>
			<button type="button" data-role="cam" data-key="KeyV">CAM</button>
			<button type="button" data-role="rod" data-key="KeyR">ROD</button>
			<button type="button" data-role="run" data-key="ShiftLeft">RUN</button>
			<button type="button" data-role="anchor" data-key="KeyK">ANCH</button>
			<button type="button" data-role="light" data-key="KeyL">LIGHT</button>
			<button type="button" data-role="fish" data-fish="1" class="is-muted">FISH</button>
		</div>`;
	document.body.appendChild( root );

	const stick = root.querySelector( '.bm-stick' );
	const nub = root.querySelector( '.bm-nub' );
	const buttons = Object.fromEntries( [ ... root.querySelectorAll( '[data-role]' ) ].map( ( b ) => [ b.dataset.role, b ] ) );
	const fishBtn = buttons.fish;
	const moveCodes = [ 'KeyW', 'KeyA', 'KeyS', 'KeyD' ];
	const MOVE_ZONE = 0.48;
	const MOVE_RADIUS = 88;
	const NUB_TRAVEL = 40;
	const DEAD_ZONE = 0.06;

	const down = ( code ) => {

		input.enabled = true;
		if ( ! input.keys.has( code ) ) input.pressed.add( code );
		input.keys.add( code );

	};
	const up = ( code ) => input.keys.delete( code );
	const clearMove = () => moveCodes.forEach( up );
	const visible = ( btn, on ) => btn?.classList.toggle( 'bm-hidden', ! on );
	const isNight = () => {

		const h = app.settings?.timeOfDay ?? 12;
		return h >= 18.35 || h < 6.15;

	};

	const fishDescriptor = () => {

		const game = app.game, rod = game && game.rod, p = app.player;
		if ( p && p.mode === 'swim' && ( p.diveDepth || 0 ) > 0.35 ) return { kind: 'lmb', label: 'SPEAR' };
		if ( ! game || ! rod || ! rod.equipped ) return { kind: 'none', label: 'FISH' };
		if ( rod.state === 'floating' ) {

			if ( game.bite && game.bite.phase === 'take' ) return { kind: 'lmb', label: 'STRIKE' };
			return { kind: 'rmb', label: 'REEL' };

		}
		if ( rod.state === 'fighting' ) return { kind: 'lmb', label: 'REEL' };
		if ( rod.state === 'flying' || rod.state === 'retrieving' ) return { kind: 'rmb', label: 'REEL' };
		if ( rod.state === 'idle' || rod.state === 'windup' ) return { kind: 'lmb', label: 'CAST' };
		return { kind: 'none', label: 'FISH' };

	};

	const beginAction = ( descriptor ) => {

		if ( descriptor.kind === 'key' ) down( descriptor.code );
		else if ( descriptor.kind === 'lmb' ) input.mouseDown = true;
		else if ( descriptor.kind === 'rmb' ) input.rightDown = true;
		return descriptor;

	};
	const endAction = ( descriptor ) => {

		if ( ! descriptor ) return;
		if ( descriptor.kind === 'key' ) up( descriptor.code );
		else if ( descriptor.kind === 'lmb' ) input.mouseDown = false;
		else if ( descriptor.kind === 'rmb' ) input.rightDown = false;

	};

	const contextLabel = () => {

		const p = app.player;
		if ( p?.mode === 'relic' ) return 'EXIT';
		const text = String( p?.prompt?.text || '' );
		if ( /board/i.test( text ) ) return 'BOARD';
		if ( /helm|wheel/i.test( text ) ) return 'DRIVE';
		if ( /leave|ashore|stand up|jump overboard/i.test( text ) ) return 'EXIT';
		if ( /grab/i.test( text ) ) return 'GRAB';
		if ( /talk/i.test( text ) ) return 'TALK';
		return 'ACT';

	};

	const refreshButtons = () => {

		const p = app.player;
		if ( ! p ) return;
		const mode = p.mode;
		const prompt = p.prompt;
		const fish = fishDescriptor();
		const underwater = mode === 'swim' && ( p.diveDepth || 0 ) > 0.18;

		buttons.context.textContent = contextLabel();
		visible( buttons.context, mode === 'relic' || !! prompt );
		visible( buttons.up, mode === 'walk' || mode === 'swim' || mode === 'deck' );
		visible( buttons.dive, mode === 'swim' );
		visible( buttons.cam, mode === 'boat' || mode === 'relic' );
		visible( buttons.rod, !! app.game?.canFish && mode !== 'swim' );
		visible( buttons.run, mode === 'walk' || mode === 'deck' || mode === 'relic' );
		visible( buttons.anchor, mode === 'boat' );
		visible( buttons.light, underwater && isNight() );
		visible( buttons.fish, fish.kind !== 'none' );

		buttons.anchor.textContent = app.boatCtl?.anchored ? 'UP ANCH' : 'ANCH';
		buttons.light.classList.toggle( 'is-on', !! app.localLights?.flashlight?.on );
		fishBtn.textContent = fish.label;
		fishBtn.classList.toggle( 'is-muted', fish.kind === 'none' );

	};
	const uiTimer = setInterval( refreshButtons, 100 );
	refreshButtons();

	let movePointer = null, moveX = 0, moveY = 0;
	let lookPointer = null, lookX = 0, lookY = 0;
	let steerX = 0;
	let controlRAF = 0;
	const actionPointers = new Map();

	const oneThumbLookMode = () => {

		const m = app.player?.mode;
		return m === 'walk' || m === 'swim' || m === 'deck';

	};

	const shapeAxis = ( v ) => {

		const a = Math.abs( v );
		if ( a <= DEAD_ZONE ) return 0;
		const n = Math.min( 1, ( a - DEAD_ZONE ) / ( 1 - DEAD_ZONE ) );
		return Math.sign( v ) * Math.pow( n, 0.78 );

	};

	const placeStick = ( x, y ) => {

		stick.style.left = `${ x - 66 }px`;
		stick.style.top = `${ y - 66 }px`;
		stick.classList.add( 'is-active' );

	};

	const updateMove = ( x, y ) => {

		let rawX = ( x - moveX ) / MOVE_RADIUS;
		let rawY = ( y - moveY ) / MOVE_RADIUS;
		const len = Math.hypot( rawX, rawY );
		if ( len > 1 ) { rawX /= len; rawY /= len; }
		nub.style.transform = `translate(${ rawX * NUB_TRAVEL }px,${ rawY * NUB_TRAVEL }px)`;

		const dx = shapeAxis( rawX );
		const dy = shapeAxis( rawY );
		clearMove();
		if ( dy < 0 ) down( 'KeyW' );
		if ( dy > 0 ) down( 'KeyS' );

		if ( oneThumbLookMode() ) {

			steerX = dx;

		} else {

			steerX = 0;
			if ( dx < 0 ) down( 'KeyA' );
			if ( dx > 0 ) down( 'KeyD' );

		}

	};

	const resetMove = () => {

		movePointer = null;
		steerX = 0;
		clearMove();
		stick.classList.remove( 'is-active' );
		nub.style.transform = 'translate(0,0)';

	};

	const driveSingleThumbLook = () => {

		if ( movePointer !== null && steerX !== 0 && oneThumbLookMode() ) input.look.x += steerX * 9.2;
		controlRAF = requestAnimationFrame( driveSingleThumbLook );

	};
	controlRAF = requestAnimationFrame( driveSingleThumbLook );

	const buttonAt = ( x, y ) => document.elementFromPoint( x, y )?.closest?.( '#bm-touch-stable button:not(.bm-hidden)' ) || null;
	const startOverlayAt = ( x, y ) => document.elementFromPoint( x, y )?.closest?.( '.tw-start-cta,.tw-start' ) || null;
	const inMoveZone = ( x ) => x <= window.innerWidth * MOVE_ZONE;

	const onPointerDown = ( e ) => {

		if ( e.pointerType === 'mouse' && e.button !== 0 ) return;
		const btn = buttonAt( e.clientX, e.clientY );
		if ( btn ) {

			const d = btn.dataset.fish ? fishDescriptor() : { kind: 'key', code: btn.dataset.key };
			const active = beginAction( d );
			actionPointers.set( e.pointerId, { active, btn } );
			btn.classList.add( 'is-on' );
			btn.setPointerCapture?.( e.pointerId );
			e.preventDefault();
			return;

		}
		if ( startOverlayAt( e.clientX, e.clientY ) ) return;

		if ( movePointer === null && inMoveZone( e.clientX ) ) {

			movePointer = e.pointerId;
			moveX = e.clientX;
			moveY = e.clientY;
			placeStick( moveX, moveY );
			updateMove( e.clientX, e.clientY );
			document.documentElement.setPointerCapture?.( e.pointerId );
			e.preventDefault();
			return;

		}

		if ( lookPointer === null ) {

			lookPointer = e.pointerId;
			lookX = e.clientX;
			lookY = e.clientY;
			document.documentElement.setPointerCapture?.( e.pointerId );
			e.preventDefault();

		}

	};

	const onPointerMove = ( e ) => {

		if ( e.pointerId === movePointer ) {

			updateMove( e.clientX, e.clientY );
			e.preventDefault();
			return;

		}
		if ( e.pointerId === lookPointer ) {

			const dx = Math.max( - 32, Math.min( 32, e.clientX - lookX ) );
			const dy = Math.max( - 32, Math.min( 32, e.clientY - lookY ) );
			input.look.x += dx * 0.72;
			input.look.y += dy * 0.72;
			lookX = e.clientX;
			lookY = e.clientY;
			e.preventDefault();

		}

	};

	const onPointerUp = ( e ) => {

		if ( e.pointerId === movePointer ) resetMove();
		if ( e.pointerId === lookPointer ) lookPointer = null;
		const a = actionPointers.get( e.pointerId );
		if ( a ) {

			endAction( a.active );
			a.btn.classList.remove( 'is-on' );
			actionPointers.delete( e.pointerId );

		}

	};

	const resetAllControls = () => {

		resetMove();
		lookPointer = null;
		for ( const { active, btn } of actionPointers.values() ) {

			endAction( active );
			btn.classList.remove( 'is-on' );

		}
		actionPointers.clear();
		input.mouseDown = false;
		input.rightDown = false;

	};

	document.addEventListener( 'pointerdown', onPointerDown, { passive: false, capture: true } );
	document.addEventListener( 'pointermove', onPointerMove, { passive: false, capture: true } );
	document.addEventListener( 'pointerup', onPointerUp, { passive: false, capture: true } );
	document.addEventListener( 'pointercancel', onPointerUp, { passive: false, capture: true } );
	document.addEventListener( 'lostpointercapture', onPointerUp, { passive: false, capture: true } );

	window.addEventListener( 'blur', resetAllControls );
	window.addEventListener( 'orientationchange', resetAllControls );
	document.addEventListener( 'visibilitychange', () => {

		if ( document.hidden ) resetAllControls();

	} );

	window.addEventListener( 'pagehide', () => {

		resetAllControls();
		clearInterval( uiTimer );
		cancelAnimationFrame( controlRAF );

	}, { once: true } );

}
