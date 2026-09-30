import { Vector3 } from '../engine/index.js';
import { CHANDLERY } from './Chandlery.js';
import { MarthaShopInterior } from './MarthaShopInterior.js';
import { installMobileCorePolish } from './MobileCorePolish.js';

const Y = new Vector3( 0, 1, 0 );

function worldPoint( chandlery, x, y, z ) {
	return new Vector3( x, y, z )
		.applyAxisAngle( Y, chandlery.group.rotation.y )
		.add( chandlery.group.position );
}

function removeBrokenAmbientWalkers( app ) {
	// Two reference passes independently created procedural pedestrians. They had no navigation mesh,
	// so they could cross walls/buildings and the segmented fallback read as a stick figure on mobile.
	// Remove them completely until production, collision-aware pedestrians replace them.
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

	// Keep Martha's Vendor object alive for her animated character and FIRST DAY mission targeting,
	// but do not let the generic Vendor HUD open the old vertical upgrade list. Joe remains unchanged.
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

function installOpenAirMarthaInterior( app ) {
	const game = app.game;
	const chandlery = game?.chandlery;
	if ( ! chandlery ) return null;

	const shop = app.marthaShop || new MarthaShopInterior( app );

	// Preserve the original Tidewater open-air chandlery as the storefront. The physical shopping
	// area sits behind it; no replacement kiosk facade, fake front wall or modal catalogue is added.
	shop.isOpenHours = () => true;
	shop.doorOpen = true;
	shop.doorTarget = - Math.PI * 0.48;
	shop.doorHoldUntil = Infinity;
	if ( shop.doorCollider ) shop.doorCollider.solid = false;
	shop.doorPivot?.parent?.remove?.( shop.doorPivot );
	shop.openSign?.parent?.remove?.( shop.openSign );
	shop.closedSign?.parent?.remove?.( shop.closedSign );

	// Martha belongs behind the physical checkout inside the shop, never standing beside the boat.
	const martha = chandlery.vendor;
	const mp = worldPoint( chandlery, 0.92, 0.06, - 0.52 );
	martha.position.copy( mp );
	martha.group.position.copy( mp );
	martha.yaw = chandlery.group.rotation.y;
	martha.group.rotation.y = martha.yaw;
	martha.radius = 2.35;
	shop.vendorRadius = 2.35;

	// The Tidewater counter remains the front-of-shop obstruction. Add only the floor and the
	// back/side boundaries needed for an actual walk-in space; the customer-facing side stays open.
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
	const mobilePolish = installMobileCorePolish( app );

	const state = {
		ready: true,
		marthaShop,
		mobilePolish,
		legacyMarthaList: false,
		ambientWalkers: false,
		storefront: 'tidewater',
	};
	app.__waterfrontRepair = state;
	if ( typeof window !== 'undefined' ) window.__waterfrontRepair = state;
	return state;
}
