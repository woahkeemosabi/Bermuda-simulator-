// Bermuda mobile adapter for the original Tidewater control model.
//
// IMPORTANT: this layer does not move the player, steer the camera, alter yaw/pitch or wrap
// Player.update(). It only translates touch input into the same Input state Tidewater consumes:
//   left thumb  -> W/A/S/D
//   right drag  -> Input.look
//   buttons     -> normal keyboard/mouse actions
// Player.js remains authoritative for locomotion and camera behaviour.

export function installStableMobileControls( app ) {

	if ( ! app || ! app.input || typeof document === 'undefined' || document.getElementById( 'bm-touch-stable' ) ) return null;
	const input = app.input;
	input.enabled = true;
	document.body.classList.add( 'bm-mobile', 'bm-tidewater-controls' );

	const style = document.createElement( 'style' );
	style.id = 'bm-tidewater-touch-style';
	style.textContent = `
		html,body,#app,#app canvas{touch-action:none!important;overscroll-behavior:none}
		#bm-touch-stable{position:fixed;inset:0;z-index:70;pointer-events:none;user-select:none;-webkit-user-select:none;font-family:system-ui,-apple-system,sans-serif}
		#bm-touch-stable .bm-stick{position:absolute;left:0;top:0;width:128px;height:128px;border-radius:50%;border:1px solid rgba(137,245,235,.40);background:rgba(5,22,31,.24);box-shadow:inset 0 0 26px rgba(66,238,221,.08),0 8px 28px rgba(0,0,0,.16);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);opacity:0;transform:scale(.92);transition:opacity 80ms ease,transform 80ms ease;pointer-events:none}
		#bm-touch-stable .bm-stick.is-active{opacity:.88;transform:scale(1)}
		#bm-touch-stable .bm-nub{position:absolute;left:50%;top:50%;width:48px;height:48px;margin:-24px;border-radius:50%;background:rgba(119,240,228,.88);border:1px solid rgba(255,255,255,.75);box-shadow:0 4px 18px rgba(0,0,0,.24);transform:translate(0,0)}
		#bm-touch-stable .bm-actions{position:absolute;right:max(16px,env(safe-area-inset-right));bottom:max(28px,env(safe-area-inset-bottom));display:grid;grid-template-columns:58px 58px;gap:10px;pointer-events:auto;align-items:end;justify-items:end}
		#bm-touch-stable button{width:58px;height:58px;border-radius:50%;border:1px solid rgba(139,243,234,.5);background:rgba(5,22,31,.58);color:#eaffff;font-weight:750;font-size:10px;letter-spacing:.08em;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);touch-action:none;-webkit-tap-highlight-color:transparent;padding:0 3px}
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
	const buttons = Object.fromEntries( [ ...root.querySelectorAll( '[data-role]' ) ].map( ( b ) => [ b.dataset.role, b ] ) );
	const moveCodes = [ 'KeyW', 'KeyA', 'KeyS', 'KeyD' ];
	const actionPointers = new Map();
	const MOVE_ZONE = 0.48;
	const MOVE_RADIUS = 86;
	const NUB_TRAVEL = 39;
	const DEAD = 0.18;
	const LOOK_SCALE = 0.78;

	const keyDown = ( code ) => {
		if ( ! code ) return;
		if ( ! input.keys.has( code ) ) input.pressed.add( code );
		input.keys.add( code );
	};
	const keyUp = ( code ) => code && input.keys.delete( code );
	const clearMove = () => moveCodes.forEach( keyUp );
	const visible = ( btn, show ) => btn?.classList.toggle( 'bm-hidden', ! show );

	const isNight = () => {
		const h = app.settings?.timeOfDay ?? 12;
		return h >= 18.35 || h < 6.15;
	};

	const fishDescriptor = () => {
		const game = app.game, rod = game?.rod, p = app.player;
		if ( p?.mode === 'swim' && ( p.diveDepth || 0 ) > 0.35 ) return { kind: 'lmb', label: 'SPEAR' };
		if ( ! game || ! rod || ! rod.equipped ) return { kind: 'none', label: 'FISH' };
		if ( rod.state === 'floating' ) return game.bite?.phase === 'take' ? { kind: 'lmb', label: 'STRIKE' } : { kind: 'rmb', label: 'REEL' };
		if ( rod.state === 'fighting' ) return { kind: 'lmb', label: 'REEL' };
		if ( rod.state === 'flying' || rod.state === 'retrieving' ) return { kind: 'rmb', label: 'REEL' };
		if ( rod.state === 'idle' || rod.state === 'windup' ) return { kind: 'lmb', label: 'CAST' };
		return { kind: 'none', label: 'FISH' };
	};

	const beginAction = ( descriptor ) => {
		if ( descriptor.kind === 'key' ) keyDown( descriptor.code );
		else if ( descriptor.kind === 'lmb' ) input.mouseDown = true;
		else if ( descriptor.kind === 'rmb' ) input.rightDown = true;
		return descriptor;
	};
	const endAction = ( descriptor ) => {
		if ( ! descriptor ) return;
		if ( descriptor.kind === 'key' ) keyUp( descriptor.code );
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
		const fish = fishDescriptor();
		const underwater = mode === 'swim' && ( p.diveDepth || 0 ) > 0.18;
		buttons.context.textContent = contextLabel();
		visible( buttons.context, mode === 'relic' || !! p.prompt );
		visible( buttons.up, mode === 'walk' || mode === 'swim' || mode === 'deck' );
		visible( buttons.dive, mode === 'swim' );
		// Tidewater camera switching belongs to vehicles. There is no on-foot third-person body now.
		visible( buttons.cam, mode === 'boat' || mode === 'relic' );
		visible( buttons.rod, !! app.game?.canFish && mode !== 'swim' );
		visible( buttons.run, mode === 'walk' || mode === 'deck' || mode === 'relic' );
		visible( buttons.anchor, mode === 'boat' );
		visible( buttons.light, underwater && isNight() );
		visible( buttons.fish, fish.kind !== 'none' );
		buttons.anchor.textContent = app.boatCtl?.anchored ? 'UP ANCH' : 'ANCH';
		buttons.light.classList.toggle( 'is-on', !! app.localLights?.flashlight?.on );
		buttons.fish.textContent = fish.label;
		buttons.fish.classList.toggle( 'is-muted', fish.kind === 'none' );
	};
	const uiTimer = setInterval( refreshButtons, 120 );
	refreshButtons();

	let moveId = null, moveOriginX = 0, moveOriginY = 0;
	let lookId = null, lookX = 0, lookY = 0;

	const placeStick = ( x, y ) => {
		stick.style.left = `${ x - 64 }px`;
		stick.style.top = `${ y - 64 }px`;
		stick.classList.add( 'is-active' );
	};

	const updateMove = ( x, y ) => {
		let dx = ( x - moveOriginX ) / MOVE_RADIUS;
		let dy = ( y - moveOriginY ) / MOVE_RADIUS;
		const len = Math.hypot( dx, dy );
		if ( len > 1 ) { dx /= len; dy /= len; }
		nub.style.transform = `translate(${ dx * NUB_TRAVEL }px,${ dy * NUB_TRAVEL }px)`;

		// Pure Tidewater digital movement. Horizontal input is STRAFE, never camera steering.
		clearMove();
		if ( dy < -DEAD ) keyDown( 'KeyW' );
		if ( dy > DEAD ) keyDown( 'KeyS' );
		if ( dx < -DEAD ) keyDown( 'KeyA' );
		if ( dx > DEAD ) keyDown( 'KeyD' );
	};

	const resetMove = () => {
		moveId = null;
		clearMove();
		stick.classList.remove( 'is-active' );
		nub.style.transform = 'translate(0,0)';
	};

	const buttonAt = ( x, y ) => document.elementFromPoint( x, y )?.closest?.( '#bm-touch-stable button:not(.bm-hidden)' ) || null;
	const onStartScreen = ( target ) => !! target?.closest?.( '.tw-start,.tw-start-cta' );

	const pointerDown = ( e ) => {
		if ( e.pointerType === 'mouse' ) return;
		const btn = buttonAt( e.clientX, e.clientY );
		if ( btn ) {
			const descriptor = btn.dataset.fish ? fishDescriptor() : { kind: 'key', code: btn.dataset.key };
			actionPointers.set( e.pointerId, { descriptor: beginAction( descriptor ), btn } );
			btn.classList.add( 'is-on' );
			e.preventDefault();
			return;
		}
		if ( onStartScreen( e.target ) ) return;

		if ( e.clientX <= innerWidth * MOVE_ZONE && moveId === null ) {
			moveId = e.pointerId;
			moveOriginX = e.clientX;
			moveOriginY = e.clientY;
			placeStick( moveOriginX, moveOriginY );
			updateMove( e.clientX, e.clientY );
			e.preventDefault();
			return;
		}

		if ( lookId === null ) {
			lookId = e.pointerId;
			lookX = e.clientX;
			lookY = e.clientY;
			e.preventDefault();
		}
	};

	const pointerMove = ( e ) => {
		if ( e.pointerId === moveId ) {
			updateMove( e.clientX, e.clientY );
			e.preventDefault();
			return;
		}
		if ( e.pointerId === lookId ) {
			const dx = e.clientX - lookX;
			const dy = e.clientY - lookY;
			lookX = e.clientX;
			lookY = e.clientY;
			// Feed Tidewater's normal look accumulator. Player/boat/relic code decides what that means.
			input.look.x += dx * LOOK_SCALE;
			input.look.y += dy * LOOK_SCALE;
			e.preventDefault();
		}
	};

	const pointerEnd = ( e ) => {
		if ( e.pointerId === moveId ) resetMove();
		if ( e.pointerId === lookId ) lookId = null;
		const action = actionPointers.get( e.pointerId );
		if ( action ) {
			endAction( action.descriptor );
			action.btn.classList.remove( 'is-on' );
			actionPointers.delete( e.pointerId );
		}
	};

	const clearAll = () => {
		resetMove();
		lookId = null;
		for ( const { descriptor, btn } of actionPointers.values() ) {
			endAction( descriptor );
			btn.classList.remove( 'is-on' );
		}
		actionPointers.clear();
		input.mouseDown = false;
		input.rightDown = false;
	};

	window.addEventListener( 'pointerdown', pointerDown, { passive: false, capture: true } );
	window.addEventListener( 'pointermove', pointerMove, { passive: false, capture: true } );
	window.addEventListener( 'pointerup', pointerEnd, { passive: false, capture: true } );
	window.addEventListener( 'pointercancel', pointerEnd, { passive: false, capture: true } );
	window.addEventListener( 'blur', clearAll );
	document.addEventListener( 'visibilitychange', () => { if ( document.hidden ) clearAll(); } );

	const state = app.__bermudaMobileControls = {
		mode: 'tidewater-adapter',
		left: 'WASD',
		right: 'look',
		clear: clearAll,
	};
	if ( typeof window !== 'undefined' ) window.__bermudaMobileControls = state;

	window.addEventListener( 'pagehide', () => {
		clearInterval( uiTimer );
		clearAll();
		window.removeEventListener( 'pointerdown', pointerDown, true );
		window.removeEventListener( 'pointermove', pointerMove, true );
		window.removeEventListener( 'pointerup', pointerEnd, true );
		window.removeEventListener( 'pointercancel', pointerEnd, true );
	}, { once: true } );

	return state;
}
