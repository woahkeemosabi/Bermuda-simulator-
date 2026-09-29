// Contextual mobile controls for RELIC's transformable mobility modes.
// The existing stable touch layer owns pointer handling; buttons added inside its action rail inherit
// that handler automatically through data-key, so we do not create a second gesture system.

export function installRelicMobileModes( app ) {

	if ( typeof document === 'undefined' || typeof window === 'undefined' || app?.__relicMobileModesInstalled ) return;
	if ( app ) app.__relicMobileModesInstalled = true;

	let timer = 0;
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
			modeButton.textContent = 'MODE';
			actions.appendChild( modeButton );

		}

		const up = root.querySelector( '[data-role="up"]' );
		const down = root.querySelector( '[data-role="dive"]' );
		const player = app?.player;
		const relic = player?.relic || app?.relic001?.group?.userData?.vehicle || null;
		const active = player?.mode === 'relic' && !! relic;
		const relicMode = relic?.driveMode || 'ROAD';

		modeButton.style.setProperty( 'display', active ? 'block' : 'none', 'important' );
		modeButton.textContent = relicMode === 'SUB' ? 'SUB' : relicMode;
		modeButton.title = active ? `RELIC ${ relicMode } mode` : '';

		if ( active && relicMode !== 'ROAD' ) {

			up?.style.setProperty( 'display', 'block', 'important' );
			down?.style.setProperty( 'display', 'block', 'important' );
			if ( up ) up.textContent = 'RISE';
			if ( down ) down.textContent = 'DESC';

		} else if ( active ) {

			up?.style.setProperty( 'display', 'none', 'important' );
			down?.style.setProperty( 'display', 'none', 'important' );

		} else {

			up?.style.removeProperty( 'display' );
			down?.style.removeProperty( 'display' );
			if ( up ) up.textContent = 'UP';
			if ( down ) down.textContent = 'DIVE';

		}

	};

	refresh();
	timer = window.setInterval( refresh, 80 );
	window.addEventListener( 'pagehide', () => timer && clearInterval( timer ), { once: true } );

}
