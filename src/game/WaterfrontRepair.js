import { Vector3 } from '../engine/index.js';
import { CHANDLERY } from './Chandlery.js';
import { MarthaShopInterior } from './MarthaShopInterior.js';
import { UPGRADES, nextLevel } from './Gear.js';

const Y = new Vector3( 0, 1, 0 );
const MARTHA_PRODUCTS = [
	[ 'ROD WALL', 'rod' ],
	[ 'REEL CASE', 'reel' ],
	[ 'LINE + TACKLE', 'line' ],
	[ 'FISH FINDER', 'fishFinder' ],
	[ 'DECK LIGHTS', 'lights' ],
	[ 'ICE CHEST', 'hold' ],
	[ 'FUEL TANK', 'fuel' ],
	[ 'ENGINE PARTS', 'engine' ],
];

function worldPoint( chandlery, x, y, z ) {
	return new Vector3( x, y, z )
		.applyAxisAngle( Y, chandlery.group.rotation.y )
		.add( chandlery.group.position );
}

function removeBrokenAmbientWalkers( app ) {
	const finalWalkers = app.bermudaReferenceFinal?.walkers;
	if ( Array.isArray( finalWalkers ) ) {
		for ( const walker of finalWalkers ) walker?.root?.parent?.remove?.( walker.root );
		finalWalkers.length = 0;
	}

	const articulatedWalkers = app.__referenceArticulatedCharacters?.walkers;
	if ( Array.isArray( articulatedWalkers ) ) {
		for ( const walker of articulatedWalkers ) walker?.rig?.root?.parent?.remove?.( walker.rig.root );
		articulatedWalkers.length = 0;
	}
}

function suppressLegacyMarthaList( app ) {
	const game = app.game;
	if ( ! game || game.__physicalMarthaVendorFlow || typeof game.updateVendors !== 'function' ) return;
	game.__physicalMarthaVendorFlow = true;
	const legacyUpdateVendors = game.updateVendors.bind( game );
	game.updateVendors = ( input, player ) => {
		const all = game.vendors;
		game.vendors = all.filter( ( vendor ) => vendor !== game.chandlery?.vendor );
		try {
			return legacyUpdateVendors( input, player );
		} finally {
			game.vendors = all;
		}
	};
}

function upgradeEffect( key, next ) {
	if ( key === 'rod' ) return `Casts up to ${ next.castM } m.`;
	if ( key === 'reel' ) return `Faster retrieve speed: ${ next.reelSpeed.toFixed( 1 ) }×.`;
	if ( key === 'line' ) return `Handles fish up to ${ next.lineKg } kg.`;
	if ( key === 'hold' ) return `Raises catch capacity to ${ next.holdKg } kg.`;
	if ( key === 'fuel' ) return `Raises boat fuel capacity to ${ next.fuelL } L.`;
	if ( key === 'engine' ) return `Raises boat thrust and top speed to ${ Math.round( next.speedMul * 100 ) }% of base.`;
	if ( key === 'fishFinder' ) return 'Adds depth and nearby-fish detection to the boat HUD.';
	if ( key === 'lights' ) return 'Adds deck floodlights for night fishing.';
	return '';
}

function installMarthaMobilePurchaseCard( app ) {
	if ( typeof document === 'undefined' || typeof window === 'undefined' ) return null;
	if ( document.getElementById( 'bm-martha-purchase-card' ) ) return document.getElementById( 'bm-martha-purchase-card' );
	const mobile = /iPhone|iPad|iPod|Android/i.test( navigator.userAgent ) || navigator.maxTouchPoints > 1;
	if ( ! mobile ) return null;

	const style = document.createElement( 'style' );
	style.id = 'bm-martha-purchase-card-style';
	style.textContent = `
		#bm-martha-purchase-card{position:fixed;right:max(16px,env(safe-area-inset-right));bottom:164px;z-index:72;width:min(300px,calc(100vw - 32px));box-sizing:border-box;padding:11px 13px;border-radius:14px;background:rgba(4,20,29,.90);border:1px solid rgba(126,239,229,.36);box-shadow:0 12px 34px rgba(0,0,0,.30);backdrop-filter:blur(9px);-webkit-backdrop-filter:blur(9px);color:#eaffff;font:500 12px/1.4 system-ui,-apple-system,sans-serif;pointer-events:none;opacity:0;transform:translateY(7px);transition:opacity .14s ease,transform .14s ease}
		#bm-martha-purchase-card.is-on{opacity:1;transform:none}
		#bm-martha-purchase-card strong{display:block;margin-bottom:2px;color:#86f2e7;font-size:12px;letter-spacing:.04em}
		#bm-martha-purchase-card .bm-price{color:#ffd27a;font-weight:750}
		#bm-martha-purchase-card .bm-lock{display:block;margin-top:4px;color:#ffb2a8;font-weight:700}
	`;
	document.head.appendChild( style );

	const card = document.createElement( 'div' );
	card.id = 'bm-martha-purchase-card';
	card.setAttribute( 'aria-live', 'polite' );
	document.body.appendChild( card );

	const refresh = () => {
		const prompt = String( app.player?.prompt?.text || '' );
		const match = MARTHA_PRODUCTS.find( ( [ label ] ) => prompt.includes( label ) );
		if ( ! match ) {
			card.classList.remove( 'is-on' );
			return;
		}
		const [ label, key ] = match;
		const track = UPGRADES[ key ];
		const current = track?.levels?.[ app.game?.state?.upgrades?.[ key ] | 0 ];
		const next = nextLevel( app.game.state.upgrades, key );
		if ( ! next ) {
			card.innerHTML = `<strong>${ label }</strong>${ track?.name || label } · ${ current?.label || 'Owned' }<span class="bm-lock">Owned / maximum upgrade</span>`;
			card.classList.add( 'is-on' );
			return;
		}
		const locked = /requires your own boat/i.test( prompt );
		card.innerHTML = `<strong>${ label } · ${ next.label }</strong>${ upgradeEffect( key, next ) }<br><span class="bm-price">$${ next.cost }</span>${ locked ? '<span class="bm-lock">Requires your own boat</span>' : '' }`;
		card.classList.add( 'is-on' );
	};
	const timer = window.setInterval( refresh, 120 );
	refresh();
	window.addEventListener( 'pagehide', () => window.clearInterval( timer ), { once: true } );
	return card;
}

function installOpenAirMarthaInterior( app ) {
	const game = app.game;
	const chandlery = game?.chandlery;
	if ( ! chandlery ) return null;

	const shop = app.marthaShop || new MarthaShopInterior( app );
	shop.isOpenHours = () => true;
	shop.doorOpen = true;
	shop.doorTarget = - Math.PI * 0.48;
	shop.doorHoldUntil = Infinity;
	if ( shop.doorCollider ) shop.doorCollider.solid = false;
	shop.doorPivot?.parent?.remove?.( shop.doorPivot );
	shop.openSign?.parent?.remove?.( shop.openSign );
	shop.closedSign?.parent?.remove?.( shop.closedSign );

	const martha = chandlery.vendor;
	const mp = worldPoint( chandlery, 0.92, 0.06, - 0.52 );
	martha.position.copy( mp );
	martha.group.position.copy( mp );
	martha.yaw = chandlery.group.rotation.y;
	martha.group.rotation.y = martha.yaw;
	martha.radius = 2.35;
	shop.vendorRadius = 2.35;

	if ( app.colliders && ! app.__marthaInteriorColliders ) {
		const w = CHANDLERY.width, d = CHANDLERY.depth, yaw = chandlery.group.rotation.y;
		const made = [];
		made.push( app.colliders.addBox(
			worldPoint( chandlery, 0, 0.03, 0 ),
			new Vector3( w / 2 - 0.05, 0.04, d / 2 - 0.05 ), yaw,
			{ tag: 'marthaShopFloor', walkable: true, solid: false },
		) );
		made.push( app.colliders.addBox(
			worldPoint( chandlery, 0, 1.12, - d / 2 + 0.04 ),
			new Vector3( w / 2, 1.12, 0.07 ), yaw,
			{ tag: 'marthaShopBack' },
		) );
		for ( const side of [ - 1, 1 ] ) made.push( app.colliders.addBox(
			worldPoint( chandlery, side * ( w / 2 - 0.04 ), 1.12, 0 ),
			new Vector3( 0.07, 1.12, d / 2 ), yaw,
			{ tag: 'marthaShopSide' },
		) );
		app.__marthaInteriorColliders = made;
	}

	return shop;
}

export function installWaterfrontRepair( app ) {
	if ( ! app ) return null;
	if ( app.__waterfrontRepair ) return app.__waterfrontRepair;

	removeBrokenAmbientWalkers( app );
	const marthaShop = installOpenAirMarthaInterior( app );
	suppressLegacyMarthaList( app );
	const marthaPurchaseCard = installMarthaMobilePurchaseCard( app );

	// Keep the startup path deliberately conservative on iPhone. The broad mobile-polish package is
	// still quarantined; this purchase card is a tiny isolated DOM-only fix and does not wrap the game
	// loop, renderer, audio, player movement or WebGPU startup path.
	const state = {
		ready: true,
		marthaShop,
		marthaPurchaseCard,
		mobilePolish: null,
		legacyMarthaList: false,
		ambientWalkers: false,
		storefront: 'tidewater',
	};
	app.__waterfrontRepair = state;
	if ( typeof window !== 'undefined' ) window.__waterfrontRepair = state;
	return state;
}
