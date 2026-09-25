export function installBoatReset( app ) {

	if ( ! app || document.getElementById( 'bm-reset-boat' ) ) return;

	const style = document.createElement( 'style' );
	style.textContent = `
		#bm-reset-boat{
			position:fixed;
			right:max(14px,env(safe-area-inset-right));
			top:max(168px,calc(env(safe-area-inset-top) + 150px));
			z-index:76;
			border:1px solid rgba(139,243,234,.42);
			border-radius:999px;
			background:rgba(5,22,31,.58);
			color:#eaffff;
			padding:8px 12px;
			font:750 10px/1 system-ui,-apple-system,sans-serif;
			letter-spacing:.08em;
			backdrop-filter:blur(8px);
			-webkit-backdrop-filter:blur(8px);
			touch-action:none;
			-webkit-tap-highlight-color:transparent;
		}
		#bm-reset-boat:active{background:rgba(74,225,211,.78);color:#041619}
	`;
	document.head.appendChild( style );

	const btn = document.createElement( 'button' );
	btn.id = 'bm-reset-boat';
	btn.type = 'button';
	btn.textContent = '↻ RESET BOAT';
	document.body.appendChild( btn );

	const reset = ( e ) => {

		e.preventDefault();
		e.stopPropagation();
		app.input.keys.clear();
		app.input.pressed.clear();
		app.input.mouseDown = false;
		app.input.rightDown = false;
		app.boatCtl?.reset?.();

	};

	btn.addEventListener( 'pointerdown', reset, { passive: false } );

}
