import { WORLD } from '../world/WorldLayout.js';

// Small UX/performance-safe refinements layered on top of the stable mobile controls.
// Keep these separate from the input surface so presentation changes cannot break navigation.
export function installMobilePolish( app ) {

	if ( ! app || ! app.input || document.getElementById( 'bm-mobile-objective' ) ) return;

	const style = document.createElement( 'style' );
	style.textContent = `
		body.bm-mobile .tw-boat{
			left:50%!important;
			right:auto!important;
			top:112px!important;
			bottom:auto!important;
			transform:translateX(-50%) scale(.68)!important;
			transform-origin:top center!important;
			z-index:45!important;
			pointer-events:none!important;
		}
		#bm-mobile-objective{
			position:fixed;
			z-index:68;
			left:50%;
			top:max(72px,calc(env(safe-area-inset-top) + 58px));
			transform:translateX(-50%);
			max-width:min(78vw,360px);
			padding:7px 12px;
			border:1px solid rgba(129,239,230,.34);
			border-radius:999px;
			background:rgba(4,18,27,.58);
			color:#ecffff;
			font:700 11px/1.2 system-ui,-apple-system,sans-serif;
			letter-spacing:.035em;
			text-align:center;
			white-space:nowrap;
			overflow:hidden;
			text-overflow:ellipsis;
			backdrop-filter:blur(8px);
			-webkit-backdrop-filter:blur(8px);
			pointer-events:none;
			transition:opacity .18s;
		}
		body.bm-mobile.bm-driving #bm-mobile-objective{top:max(62px,calc(env(safe-area-inset-top) + 48px))}
		@media (max-width:700px){
			body.bm-mobile .tw-boat{top:116px!important;transform:translateX(-50%) scale(.62)!important}
		}
	`;
	document.head.appendChild( style );

	const objective = document.createElement( 'div' );
	objective.id = 'bm-mobile-objective';
	objective.textContent = 'BOAT • Follow the pier • ACT to board';
	document.body.appendChild( objective );

	const input = app.input;
	const moving = () => [ 'KeyW', 'KeyA', 'KeyS', 'KeyD' ].some( ( k ) => input.keys.has( k ) );

	const timer = setInterval( () => {

		const p = app.player;
		if ( ! p ) return;

		// Mobile has no dedicated sprint key. Full-stick movement should feel like a game controller,
		// so walking automatically uses the engine's existing sprint speed while the stick is engaged.
		if ( p.mode === 'walk' && moving() ) input.keys.add( 'ShiftLeft' );
		else input.keys.delete( 'ShiftLeft' );

		document.body.classList.toggle( 'bm-driving', p.mode === 'boat' );

		if ( p.mode === 'boat' ) {

			objective.textContent = 'PILOTING • Joystick drives • CAM changes view • ACT stands up';
			return;

		}
		if ( p.mode === 'deck' ) {

			objective.textContent = 'TAKE THE HELM • Walk to the wheel • ACT to drive';
			return;

		}
		if ( p.mode === 'swim' ) {

			objective.textContent = 'SWIMMING • DIVE / UP for depth • Joystick to move';
			return;

		}

		const b = WORLD.boatDock.position;
		const d = Math.hypot( p.position.x - b.x, p.position.z - b.z );
		if ( d < 8 ) objective.textContent = 'BOAT • ACT to board';
		else objective.textContent = `BOAT • ${ Math.round( d ) } m • Follow the pier • ACT to board`;

	}, 160 );

	window.addEventListener( 'pagehide', () => {

		clearInterval( timer );
		input.keys.delete( 'ShiftLeft' );

	}, { once: true } );

}
