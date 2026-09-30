import { BoxGeometry, Group, Matrix4, Mesh, Vector3 } from '../engine/index.js';
import { Material } from '../engine/render/Material.js';
import { MarthaShopInterior } from './MarthaShopInterior.js';
import { CHANDLERY } from './Chandlery.js';
import { STAND } from './FishStand.js';
import { FishProps } from '../world/fish/FishProps.js';
import { FISH } from './FishTable.js';

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

	// A dedicated exterior ice table keeps the catch visible even when the richer Fish Market GLB
	// replaces the original procedural stall. The old display sat behind the replacement facade.
	const root = new Group();
	root.name = 'JoeVisibleFishTable';
	root.position.set( STAND.x, STAND.baseY, STAND.z );
	root.rotation.y = STAND.yaw;
	app.scene.add( root );

	const tableMat = new Material( {
		name: 'joe-visible-fish-table', color: 0x315d67, roughness: 0.72, metalness: 0.08,
		underwaterLighting: 'lite', localLightsCheap: false, receiveShadows: true,
	} );
	const iceMat = new Material( {
		name: 'joe-visible-fish-ice', color: 0xe8f6f4, roughness: 0.22, metalness: 0.02,
		underwaterLighting: 'lite', localLightsCheap: false, receiveShadows: true,
	} );
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

	const props = new FishProps();
	const species = [ 'jack', 'redSnapper', 'yellowtail', 'grunt', 'mullet' ];
	const lengths = [ 0.38, 0.35, 0.31, 0.28, 0.34 ];
	const xs = [ -0.92, -0.46, 0, 0.46, 0.92 ];
	const base = new Matrix4().makeRotationY( STAND.yaw ).setPosition( STAND.x, STAND.baseY, STAND.z );
	for ( let i = 0; i < species.length; i ++ ) {
		const id = species[ i ];
		const L = lengths[ i ];
		const model = FISH[ id ].model;
		const rest = FishProps.restHeight( model, L );
		const local = new Matrix4().makeRotationY( i % 2 ? 0.10 : -0.10 ).setPosition(
			xs[ i ], 1.13 + rest + ( i % 2 ) * 0.008, frontZ + ( i % 2 ? 0.055 : -0.035 ),
		);
		const frame = new Matrix4().multiplyMatrices( base, local );
		props.add( 'whole', model, frame, i % 2 ? 'sideFlip' : 'side', L, { cloudy: 0.36, wet: 0.92 } );
	}
	const fishMesh = props.build();
	fishMesh.name = 'JoeVisibleMarketFish';
	app.scene.add( fishMesh );

	app.__joeVisibleFishDisplay = { root, props, mesh: fishMesh };
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
