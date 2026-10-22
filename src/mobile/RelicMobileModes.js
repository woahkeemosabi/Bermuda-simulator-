// Contextual mobile controls for RELIC's transformable mobility modes.
// RELIC is installed before the stable touch layer, so this module owns the three transform inputs
// directly. That avoids a subtle race where BermudaMobileStable visually hid Space/C with bm-hidden
// while an inline rule made the same buttons appear on screen: they looked tappable but its hit-test
// rejected them. These handlers map the visible controls straight to the same keyboard state the
// vehicle controller already consumes.

export function installRelicMobileModes( app ) {

	if ( typeof document === 'undefined' || typeof window === 'undefined' || app?.__relicMobileModesInstalled ) return;
	if ( app ) app.__relicMobileModesInstalled = true;
	const input = app?.input;
	const activePointers = new Map();

	const relicForPlayer = () => app?.player?.relic || app?.relic001?.group?.userData?.vehicle || app?.relic || null;
	const pressKey = ( code ) => {
		if ( ! input || ! code ) return;
		input.enabled = true;
		if ( ! input.keys.has( code ) ) input.pressed.add( code );
		input.keys.add( code );
	};
	const releaseKey = ( code ) => {
		if ( input && code ) input.keys.delete( code );
	};

	const transformRole = ( target ) => {
		const button = target?.closest?.( '#bm-touch-stable button' );
		if ( ! button ) return null;
		const role = button.dataset.role;
		if ( role === 'relic-mode' ) return { button, code: 'KeyG' };
		if ( role === 'up' ) return { button, code: 'Space' };
		if ( role === 'dive' ) return { button, code: 'KeyC' };
		return null;
	};

	const onPointerDown = ( event ) => {
		if ( app?.player?.mode !== 'relic' || ! relicForPlayer() ) return;
		const action = transformRole( event.target );
		if ( ! action ) return;
		pressKey( action.code );
		action.button.classList.add( 'is-on' );
		activePointers.set( event.pointerId, action );
		action.button.setPointerCapture?.( event.pointerId );
		event.preventDefault();
		event.stopImmediatePropagation();
	};
	const onPointerUp = ( event ) => {
		const action = activePointers.get( event.pointerId );
		if ( ! action ) return;
		releaseKey( action.code );
		action.button?.classList.remove( 'is-on' );
		activePointers.delete( event.pointerId );
		event.preventDefault();
		event.stopImmediatePropagation();
	};

	// Registered before BermudaMobileStable's handlers, so RELIC transform controls cannot be swallowed
	// by that layer's contextual visibility test.
	document.addEventListener( 'pointerdown', onPointerDown, { capture: true, passive: false } );
	document.addEventListener( 'pointerup', onPointerUp, { capture: true, passive: false } );
	document.addEventListener( 'pointercancel', onPointerUp, { capture: true, passive: false } );

	let timer = 0;
	const setButton = ( button, show, label ) => {
		if ( ! button ) return;
		if ( label ) button.textContent = label;
		if ( show ) {
			button.classList.remove( 'bm-hidden' );
			button.style.setProperty( 'display', 'block', 'important' );
		} else {
			button.style.setProperty( 'display', 'none', 'important' );
		}
	};
	const restoreButton = ( button, label ) => {
		if ( ! button ) return;
		button.style.removeProperty( 'display' );
		if ( label ) button.textContent = label;
	};

	const refresh = () => {

		const root = document.getElementById( 'bm-touch-stable' );
		if ( ! root ) return;
		const actions = root.querySelector( '.bm-actions' );
		if ( ! actions ) return;

		let modeButton = root.querySelector( '[data-role="relic-mode"]' );
		if ( ! modeButton ) {
			modeButton = document.createElement( 'button' );
			modeButton.type = 'button';
			modeButton.dataset.role = 'relic-mode';
			modeButton.dataset.key = 'KeyG';
			modeButton.textContent = 'HOVER';
			actions.appendChild( modeButton );
		}

		const up = root.querySelector( '[data-role="up"]' );
		const down = root.querySelector( '[data-role="dive"]' );
		const run = root.querySelector( '[data-role="run"]' );
		const player = app?.player;
		const relic = relicForPlayer();
		const active = player?.mode === 'relic' && !! relic;
		const mode = relic?.driveMode || 'ROAD';

		if ( ! active ) {
			setButton( modeButton, false, 'HOVER' );
			restoreButton( up, 'UP' );
			restoreButton( down, 'DIVE' );
			if ( run ) run.textContent = 'RUN';
			return;
		}

		modeButton.classList.remove( 'bm-hidden' );
		modeButton.style.setProperty( 'display', 'block', 'important' );
		if ( run ) run.textContent = 'BOOST';

		if ( mode === 'ROAD' ) {
			modeButton.textContent = 'HOVER';
			setButton( up, false, 'FLY' );
			setButton( down, false, 'SUB' );
		} else if ( mode === 'HOVER' ) {
			const water = relic.waterSurfaceAt?.() ?? 0;
			const ground = relic.groundAt?.( relic.position.x, relic.position.z ) ?? water;
			modeButton.textContent = ground >= water - 0.35 ? 'ROAD' : 'MODE';
			setButton( up, true, 'FLY' );
			setButton( down, true, 'SUB' );
		} else if ( mode === 'AIR' ) {
			modeButton.textContent = 'HOVER';
			setButton( up, true, 'RISE' );
			setButton( down, true, 'DESC' );
		} else { // SUB
			modeButton.textContent = 'HOVER';
			setButton( up, true, 'RISE' );
			setButton( down, true, 'DESC' );
		}

		modeButton.title = `RELIC ${ mode } mode`;
	};

	refresh();
	timer = window.setInterval( refresh, 60 );
	window.addEventListener( 'pagehide', () => {
		if ( timer ) clearInterval( timer );
		for ( const action of activePointers.values() ) releaseKey( action.code );
		activePointers.clear();
		document.removeEventListener( 'pointerdown', onPointerDown, true );
		document.removeEventListener( 'pointerup', onPointerUp, true );
		document.removeEventListener( 'pointercancel', onPointerUp, true );
	}, { once: true } );

}
