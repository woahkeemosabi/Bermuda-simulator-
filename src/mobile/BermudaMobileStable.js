// Stable Bermuda mobile controls.
// Navigation is kept independent from gameplay actions so one cannot freeze the other.

export function installStableMobileControls( app ) {

	if ( ! app || ! app.input || document.getElementById( 'bm-touch-stable' ) ) return;
	const input = app.input;
	input.enabled = true;
	document.body.classList.add( 'bm-mobile' );

	const style = document.createElement( 'style' );
	style.textContent = `
		html,body,#app,#app canvas{touch-action:none!important;overscroll-behavior:none}
		#bm-touch-stable{position:fixed;inset:0;z-index:70;pointer-events:none;user-select:none;-webkit-user-select:none;font-family:system-ui,-apple-system,sans-serif}
		#bm-touch-stable .bm-stick{position:absolute;left:24px;bottom:max(24px,env(safe-area-inset-bottom));width:126px;height:126px;border-radius:50%;border:1px solid rgba(137,245,235,.45);background:rgba(5,22,31,.31);box-shadow:inset 0 0 26px rgba(66,238,221,.08),0 8px 28px rgba(0,0,0,.18);backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px);opacity:.9;pointer-events:auto;touch-action:none}
		#bm-touch-stable .bm-nub{position:absolute;left:50%;top:50%;width:52px;height:52px;margin:-26px;border-radius:50%;background:rgba(119,240,228,.86);border:1px solid rgba(255,255,255,.78);box-shadow:0 4px 18px rgba(0,0,0,.25);transform:translate(0,0);transition:transform 70ms linear;pointer-events:none}
		#bm-touch-stable .bm-stick.is-active .bm-nub{transition:none}
		#bm-touch-stable .bm-actions{position:absolute;right:max(16px,env(safe-area-inset-right));bottom:max(28px,env(safe-area-inset-bottom));display:grid;grid-template-columns:58px 58px;gap:10px;pointer-events:auto}
		#bm-touch-stable button{width:58px;height:58px;border-radius:50%;border:1px solid rgba(139,243,234,.5);background:rgba(5,22,31,.58);color:#eaffff;font-weight:750;font-size:10px;letter-spacing:.08em;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);touch-action:none;-webkit-tap-highlight-color:transparent;padding:0 3px}
		#bm-touch-stable button:active,#bm-touch-stable button.is-on{background:rgba(74,225,211,.78);color:#041619}
		#bm-touch-stable button.is-muted{opacity:.42}
		body.bm-mobile .gm-guide,body.bm-mobile .gm-coach{display:none!important}
		body.bm-mobile .tw-rail,body.bm-mobile .tw-panel,body.bm-mobile .tw-help,body.bm-mobile .tw-stats,body.bm-mobile .gm-purse{display:none!important}
		@media (max-width:700px){body.bm-mobile .gm-map{width:102px;height:102px;right:15px;bottom:230px;opacity:.84}}
	`;
	document.head.appendChild( style );

	const root = document.createElement( 'div' );
	root.id = 'bm-touch-stable';
	root.innerHTML = `
		<div class="bm-stick"><div class="bm-nub"></div></div>
		<div class="bm-actions">
			<button type="button" data-key="KeyE">ACT</button>
			<button type="button" data-key="Space">UP</button>
			<button type="button" data-key="KeyC">DIVE</button>
			<button type="button" data-key="KeyV">CAM</button>
			<button type="button" data-key="KeyR">ROD</button>
			<button type="button" data-fish="1" class="is-muted">FISH</button>
		</div>`;
	document.body.appendChild( root );

	const stick = root.querySelector( '.bm-stick' );
	const nub = root.querySelector( '.bm-nub' );
	const fishBtn = root.querySelector( '[data-fish]' );
	const moveCodes = [ 'KeyW', 'KeyA', 'KeyS', 'KeyD' ];

	let audioStarted = false;
	const unlockAudio = () => {

		if ( audioStarted ) return;
		audioStarted = true;
		try {

			const r = app.audio?.resume?.();
			r?.catch?.( () => { audioStarted = false; } );

		} catch ( e ) {

			audioStarted = false;

		}

	};

	const down = ( code ) => {

		input.enabled = true;
		if ( ! input.keys.has( code ) ) input.pressed.add( code );
		input.keys.add( code );

	};
	const up = ( code ) => input.keys.delete( code );
	const clearMove = () => moveCodes.forEach( up );

	const fishDescriptor = () => {

		const game = app.game, rod = game && game.rod;
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

	const fishTimer = setInterval( () => {

		const d = fishDescriptor();
		fishBtn.textContent = d.label;
		fishBtn.classList.toggle( 'is-muted', d.kind === 'none' );

	}, 100 );

	let movePointer = null, moveX = 0, moveY = 0;
	let lookPointer = null, lookX = 0, lookY = 0;
	const actionPointers = new Map();

	const stickGeometry = () => {

		const r = stick.getBoundingClientRect();
		return { x: r.left + r.width * 0.5, y: r.top + r.height * 0.5, hit: Math.max( r.width, r.height ) * 0.64 };

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

	const buttonAt = ( x, y ) => document.elementFromPoint( x, y )?.closest?.( '#bm-touch-stable button' ) || null;
	const startOverlayAt = ( x, y ) => document.elementFromPoint( x, y )?.closest?.( '.tw-start-cta,.tw-start' ) || null;

	const onPointerDown = ( e ) => {

		if ( e.pointerType === 'mouse' && e.button !== 0 ) return;
		unlockAudio();
		const btn = buttonAt( e.clientX, e.clientY );
		if ( btn ) {

			const d = btn.dataset.fish ? fishDescriptor() : { kind: 'key', code: btn.dataset.key };
			const active = beginAction( d );
			actionPointers.set( e.pointerId, { active, btn } );
			btn.classList.add( 'is-on' );
			try { btn.setPointerCapture?.( e.pointerId ); } catch ( err ) {}
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
			e.preventDefault();
			return;

		}

		if ( lookPointer === null ) {

			lookPointer = e.pointerId;
			lookX = e.clientX;
			lookY = e.clientY;
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

	document.addEventListener( 'pointerdown', onPointerDown, { passive: false, capture: true } );
	document.addEventListener( 'pointermove', onPointerMove, { passive: false, capture: true } );
	document.addEventListener( 'pointerup', onPointerUp, { passive: false, capture: true } );
	document.addEventListener( 'pointercancel', onPointerUp, { passive: false, capture: true } );

	window.addEventListener( 'blur', () => {

		resetMove();
		lookPointer = null;
		for ( const { active, btn } of actionPointers.values() ) {

			endAction( active );
			btn.classList.remove( 'is-on' );

		}
		actionPointers.clear();
		input.mouseDown = false;
		input.rightDown = false;

	} );

	window.addEventListener( 'pagehide', () => clearInterval( fishTimer ), { once: true } );

}
