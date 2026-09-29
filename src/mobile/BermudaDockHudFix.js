import { BoxGeometry, Group, Mesh, Vector3 } from '../engine/index.js';
import { Material } from '../engine/render/Material.js';
import { FISH_MARKET } from '../world/bermuda/HarbourLayout.js';

const STYLE_ID = 'bermuda-dock-hud-fix-style';

function addStyle() {
	if ( typeof document === 'undefined' || document.getElementById( STYLE_ID ) ) return;
	const style = document.createElement( 'style' );
	style.id = STYLE_ID;
	style.textContent = `
		/* The clock is world time, not a countdown. Label both fields explicitly on mobile. */
		body.bm-mobile .gm-clock-time::before{content:'TIME ';font-family:var(--tw-font);font-size:9px;letter-spacing:.08em;color:var(--tw-ink-3);font-weight:700}
		body.bm-mobile .gm-weather::before{content:'WEATHER ';font-size:9px;letter-spacing:.06em;color:var(--tw-ink-3);font-weight:700}
		body.bm-mobile .gm-clock{gap:8px!important;align-items:center}
		body.bm-mobile .gm-clock-time,body.bm-mobile .gm-weather{white-space:nowrap}

		/* Wallet is always visible instead of being hidden by BermudaMobileStable. */
		body.bm-mobile .gm-wallet-floating{display:flex!important;position:absolute!important;top:10px!important;right:max(14px,env(safe-area-inset-right))!important;z-index:82;
			align-items:center;gap:6px;padding:7px 11px;border-radius:999px;background:rgba(5,22,31,.68);border:1px solid rgba(139,243,234,.28);
			box-shadow:0 8px 24px rgba(0,0,0,.18);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);font-size:12px!important;color:#fff!important}
		body.bm-mobile .gm-wallet-floating::before{content:'WALLET';font:700 9px var(--tw-font);letter-spacing:.08em;color:rgba(220,245,242,.72)}

		/* Never let the minimap occupy the same touch zone as ACT or the contextual action grid. */
		@media (max-width:700px){
			body.bm-mobile .gm-map{width:92px!important;height:92px!important;right:max(14px,env(safe-area-inset-right))!important;
				bottom:var(--bm-map-safe-bottom,248px)!important;opacity:.9!important}
		}
	`;
	document.head.appendChild( style );
}

function localToWorld( s, lx, lz, out ) {
	const c = Math.cos( s.yaw ), n = Math.sin( s.yaw );
	out.set( s.x + lx * c + lz * n, s.baseY, s.z - lx * n + lz * c );
	return out;
}

function relocateJoe( app ) {
	const vendor = app.game?.stand?.vendor;
	if ( ! vendor || vendor.__bermudaDockRelocated ) return;
	vendor.__bermudaDockRelocated = true;

	// Keep Joe behind the service counter instead of standing in the pedestrian lane.
	const p = localToWorld( FISH_MARKET, 0.18, - 0.18, new Vector3() );
	p.y += 0.06;
	vendor.position.copy( p );
	vendor.group.position.copy( p );
	vendor.radius = 2.9;
}

function addMarketStock( app ) {
	const stand = app.game?.stand;
	if ( ! stand?.group || stand.group.getObjectByName( 'BermudaFishMarketStock' ) ) return;

	const root = new Group();
	root.name = 'BermudaFishMarketStock';
	stand.group.add( root );
	const wood = new Material( { name: 'fish-market-crate', color: 0x8f6d43, roughness: 0.92, receiveShadows: true } );
	const cooler = new Material( { name: 'fish-market-cooler', color: 0x2e72a5, roughness: 0.5, receiveShadows: true } );
	const lid = new Material( { name: 'fish-market-cooler-lid', color: 0xe7eef0, roughness: 0.44, receiveShadows: true } );

	const box = ( name, material, x, y, z, sx, sy, sz ) => {
		const mesh = new Mesh( new BoxGeometry( 1, 1, 1 ), material );
		mesh.name = name;
		mesh.position.set( x, y, z );
		mesh.scale.set( sx, sy, sz );
		mesh.receiveShadow = true;
		root.add( mesh );
		return mesh;
	};

	// Actual stock stays inside the stall footprint and does not add collision to the walkway.
	box( 'fish-market-crate-a', wood, -0.92, 0.28, -0.48, 0.58, 0.50, 0.52 );
	box( 'fish-market-crate-b', wood, -0.92, 0.66, -0.48, 0.54, 0.24, 0.48 );
	box( 'fish-market-cooler', cooler, 0.78, 0.32, -0.36, 0.76, 0.50, 0.48 );
	box( 'fish-market-cooler-lid', lid, 0.78, 0.59, -0.36, 0.78, 0.06, 0.50 );
}

export function installBermudaDockHudFix( app ) {
	if ( ! app || app.__bermudaDockHudFix ) return app?.__bermudaDockHudFix;
	addStyle();

	let timer = 0;
	const sync = () => {
		if ( typeof document === 'undefined' ) return;

		// GameHUD already owns the live money value. Reparent that exact node so its updates continue
		// automatically while making it visible as a dedicated wallet pill on mobile.
		const money = document.querySelector( '.gm-money' );
		const hud = app.ui?.ui?.hud || app.ui?.ui?.root;
		if ( money && hud && ! money.classList.contains( 'gm-wallet-floating' ) ) {
			money.classList.add( 'gm-wallet-floating' );
			hud.appendChild( money );
			money.title = 'Wallet balance';
		}

		const clock = document.querySelector( '.gm-clock' );
		if ( clock ) clock.title = 'Game-world time of day and current weather';

		const map = document.querySelector( '.gm-map' );
		const actions = document.querySelector( '#bm-touch-stable .bm-actions' );
		if ( map && actions && typeof window !== 'undefined' ) {
			const r = actions.getBoundingClientRect();
			if ( r.height > 0 ) {
				// Keep a real gap above the highest visible action button, regardless of which contextual
				// buttons are currently hidden or shown.
				const bottom = Math.max( 224, Math.ceil( window.innerHeight - r.top + 18 ) );
				map.style.setProperty( '--bm-map-safe-bottom', `${ bottom }px` );
			}
		}

		relocateJoe( app );
		addMarketStock( app );
	};

	sync();
	if ( typeof window !== 'undefined' ) {
		timer = window.setInterval( sync, 250 );
		window.addEventListener( 'resize', sync, { passive: true } );
		window.addEventListener( 'pagehide', () => timer && window.clearInterval( timer ), { once: true } );
	}

	const state = app.__bermudaDockHudFix = { sync };
	if ( typeof window !== 'undefined' ) window.__bermudaDockHudFix = state;
	return state;
}
