import { BoxGeometry, Group, Mesh, SphereGeometry, Vector3 } from '../engine/index.js';
import { Material } from '../engine/render/Material.js';
import { MarthaShopInterior } from './MarthaShopInterior.js';
import { CHANDLERY } from './Chandlery.js';
import { STAND } from './FishStand.js';

const FIRST_DAY = 'martha-first-delivery';
const ENTRANCE_X = 0.72;
const DOOR_W = 1.32;
const DOOR_H = 2.05;
const Y = new Vector3( 0, 1, 0 );

function localToWorld( shop, x, y, z ) {
	const p = new Vector3( x, y, z ).applyAxisAngle( Y, shop.yaw );
	p.x += shop.x;
	p.y += shop.baseY;
	p.z += shop.z;
	return p;
}

function firstDayAvailable( app ) {
	const state = app.game?.state;
	if ( ! state ) return false;
	if ( typeof state.hasMission === 'function' ) return !! state.hasMission( FIRST_DAY, 'available' );
	return !! state.missions?.available?.includes?.( FIRST_DAY );
}

function repairMartha( app ) {
	if ( ! app.game?.chandlery || ! app.player || ! app.colliders ) return null;

	const shop = app.marthaShop || new MarthaShopInterior( app );
	const vendor = app.game.chandlery.vendor;

	// FIRST DAY must never be soft-locked by the clock. Once the opening conversation has happened,
	// normal Bait & Tackle opening hours resume.
	if ( ! shop.__firstDayHoursRepair ) {
		shop.__firstDayHoursRepair = true;
		const normalOpenHours = shop.isOpenHours.bind( shop );
		shop.isOpenHours = () => firstDayAvailable( app ) || normalOpenHours();
	}

	// The production GLB's visible entrance is on the right-hand side of the facade. Move the
	// interactive door/collider to that opening instead of leaving an invisible centred doorway.
	if ( shop.doorPivot ) shop.doorPivot.position.x = ENTRANCE_X - DOOR_W * 0.5;
	if ( shop.doorCollider ) {
		shop.doorCollider.center.copy( localToWorld( CHANDLERY, ENTRANCE_X, DOOR_H * 0.5 + 0.04, CHANDLERY.depth * 0.5 ) );
		shop.doorCollider.top = shop.doorCollider.center.y + shop.doorCollider.half.y;
		shop.doorCollider.bottom = shop.doorCollider.center.y - shop.doorCollider.half.y;
	}

	if ( ! shop.__entranceProbeRepair ) {
		shop.__entranceProbeRepair = true;
		shop.nearDoor = ( world ) => {
			const p = shop.localPoint( world );
			return Math.hypot( p.x - ENTRANCE_X, p.z - CHANDLERY.depth * 0.5 ) < 1.45;
		};
	}

	// Remove the obsolete centred front returns and the visual-polish service counter collider.
	// They overlap the walk-in doorway even though the rendered Meshy shop has a proper entrance.
	for ( const box of app.colliders.boxes || [] ) {
		if ( box.tag === 'chandleryFront' || box.tag === 'martha-bait-tackle-identity-counter' ) box.solid = false;
	}

	// Rebuild only the two small facade sections around the actual doorway.
	if ( ! app.__marthaFrontWallRepair ) {
		const half = CHANDLERY.width * 0.5;
		const leftEdge = ENTRANCE_X - DOOR_W * 0.5;
		const rightEdge = ENTRANCE_X + DOOR_W * 0.5;
		const addSegment = ( a, b ) => {
			const width = b - a;
			if ( width <= 0.03 ) return;
			const centerX = ( a + b ) * 0.5;
			app.colliders.addBox(
				localToWorld( CHANDLERY, centerX, 1.18, CHANDLERY.depth * 0.5 ),
				new Vector3( width * 0.5, 1.16, 0.08 ),
				CHANDLERY.yaw,
				{ tag: 'marthaFrontRepair' },
			);
		};
		addSegment( - half, leftEdge );
		addSegment( rightEdge, half );
		app.__marthaFrontWallRepair = true;
	}

	// Put Martha close enough to the front checkout that she is visible through the doorway and is
	// comfortably reachable by the mobile interaction radius once the player walks inside.
	const marthaPos = localToWorld( CHANDLERY, 0.78, 0.06, -0.18 );
	vendor.position.copy( marthaPos );
	vendor.group.position.copy( marthaPos );

	// On FIRST DAY the door opens automatically as the player approaches. ACT remains reserved for
	// the actual conversation, so the opening mission is reliable on touch controls.
	if ( ! shop.__firstDayAutoDoorRepair ) {
		shop.__firstDayAutoDoorRepair = true;
		const baseUpdate = shop.update.bind( shop );
		shop.update = ( dt ) => {
			if ( firstDayAvailable( app ) && app.player?.mode === 'walk' && shop.nearDoor( app.player.position ) ) shop.openDoor();
			baseUpdate( dt );
		};
	}

	return shop;
}

function makeJoeFishDisplay( app ) {
	if ( app.__joeVisibleFishDisplay || ! app.scene || ! app.game?.stand ) return app.__joeVisibleFishDisplay;

	// Keep Joe visibly stocked even when the production Fish Market GLB covers the original stall.
	// This intentionally uses only tiny shared primitive meshes. The previous repair allocated a
	// second full FishProps GPU batch on top of CatchDisplay; that extra allocation is not justified on
	// iPhone and could contribute to WebGPU device-loss under the deferred waterfront load.
	const root = new Group();
	root.name = 'JoeVisibleFishTable';
	root.position.set( STAND.x, STAND.baseY, STAND.z );
	root.rotation.y = STAND.yaw;
	app.scene.add( root );

	const tableMat = new Material( {
		name: 'joe-visible-fish-table', color: 0x315d67, roughness: 0.72, metalness: 0.08,
		underwaterLighting: 'lite', localLightsCheap: true, receiveShadows: true,
	} );
	const iceMat = new Material( {
		name: 'joe-visible-fish-ice', color: 0xe8f6f4, roughness: 0.22, metalness: 0.02,
		underwaterLighting: 'lite', localLightsCheap: true, receiveShadows: true,
	} );
	const fishMats = [
		new Material( { name: 'joe-fish-silver', color: 0x8fb2b8, roughness: 0.26, metalness: 0.10, underwaterLighting: 'lite', localLightsCheap: true, receiveShadows: true } ),
		new Material( { name: 'joe-fish-red', color: 0xb65b4f, roughness: 0.28, metalness: 0.08, underwaterLighting: 'lite', localLightsCheap: true, receiveShadows: true } ),
		new Material( { name: 'joe-fish-gold', color: 0xc9ad56, roughness: 0.30, metalness: 0.08, underwaterLighting: 'lite', localLightsCheap: true, receiveShadows: true } ),
	];

	const frontZ = STAND.depth * 0.5 + 0.46;
	const table = new Mesh( new BoxGeometry( 2.72, 0.17, 0.78 ), tableMat );
	table.position.set( 0, 0.96, frontZ );
	table.castShadow = true;
	table.receiveShadow = true;
	root.add( table );
	const ice = new Mesh( new BoxGeometry( 2.52, 0.075, 0.66 ), iceMat );
	ice.position.set( 0, 1.085, frontZ );
	ice.castShadow = false;
	ice.receiveShadow = true;
	root.add( ice );

	const bodyGeo = new SphereGeometry( 1, 8, 6 );
	const tailGeo = new BoxGeometry( 1, 1, 1 );
	const xs = [ -0.94, -0.47, 0, 0.47, 0.94 ];
	const fish = [];
	for ( let i = 0; i < xs.length; i ++ ) {
		const g = new Group();
		g.name = `JoeMarketFish${ i + 1 }`;
		g.position.set( xs[ i ], 1.17 + ( i % 2 ) * 0.015, frontZ + ( i % 2 ? 0.045 : -0.035 ) );
		g.rotation.y = i % 2 ? 0.10 : -0.10;
		const mat = fishMats[ i % fishMats.length ];
		const body = new Mesh( bodyGeo, mat );
		body.scale.set( 0.085 + ( i % 3 ) * 0.008, 0.06, 0.20 + ( i % 2 ) * 0.025 );
		body.castShadow = false;
		body.receiveShadow = true;
		g.add( body );
		const tail = new Mesh( tailGeo, mat );
		tail.position.z = -0.245 - ( i % 2 ) * 0.02;
		tail.scale.set( 0.13, 0.025, 0.13 );
		tail.rotation.y = Math.PI * 0.25;
		tail.castShadow = false;
		tail.receiveShadow = true;
		g.add( tail );
		root.add( g );
		fish.push( g );
	}

	app.__joeVisibleFishDisplay = { root, fish };
	return app.__joeVisibleFishDisplay;
}

function tuneShopLights( app ) {
	for ( const source of app.localLights?.sources || [] ) {
		if ( ! source.position ) continue;
		const dm = Math.hypot( source.position.x - CHANDLERY.x, source.position.z - CHANDLERY.z );
		const dj = Math.hypot( source.position.x - STAND.x, source.position.z - STAND.z );
		if ( Math.min( dm, dj ) > 8 ) continue;
		if ( source.kind === 'harbour-shop' ) {
			source.intensity = Math.min( Number( source.intensity || 0 ), 8.5 );
			source.range = Math.min( Number( source.range || 0 ), 9.5 );
		} else if ( source.kind === 'lantern' ) {
			source.intensity = Math.min( Number( source.intensity || 0 ), 3.8 );
			source.range = Math.min( Number( source.range || 0 ), 8.5 );
		}
	}
}

export function installWaterfrontRepair( app ) {
	if ( ! app || app.__waterfrontRepair ) return app?.__waterfrontRepair;
	const marthaShop = repairMartha( app );
	const joeDisplay = makeJoeFishDisplay( app );
	tuneShopLights( app );
	const state = app.__waterfrontRepair = { marthaShop, joeDisplay, firstDayAvailable: () => firstDayAvailable( app ) };
	if ( typeof window !== 'undefined' ) window.__waterfrontRepair = state;
	return state;
}
