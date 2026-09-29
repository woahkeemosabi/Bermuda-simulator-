import { Group, Mesh, Vector3 } from '../engine/index.js';
import { prepare, mergePrepared, box, cylinder, rod, torus, mat4 } from '../world/boat/GeoKit.js';
import { createPropMaterial, PAT } from './GameMaterials.js';
import { UPGRADES, nextLevel } from './Gear.js';

const Y = new Vector3( 0, 1, 0 );
const TMP = new Vector3();

function interiorGeometry() {
	const P = [];
	const add = ( g, o ) => P.push( prepare( g, o ) );
	const wood = ( color ) => ( { color, rough: 0.86, pattern: PAT.woodX } );
	const white = { color: 0xeeeade, rough: 0.88 };
	const metal = { color: 0x8d9aa0, rough: 0.28, metal: 0.9 };
	const dark = { color: 0x1a2629, rough: 0.58, metal: 0.25 };
	const blue = { color: 0x164c64, rough: 0.35, metal: 0.2 };
	const V = ( x, y, z ) => new Vector3( x, y, z );

	// Interior floor/ceiling and painted back/side wall skins. Front stays open as the door/service face.
	add( box( 3.28, 0.055, 2.28 ), { ...wood( 0xa98c68 ), matrix: mat4( 0, 0.03, - 0.02 ) } );
	add( box( 3.28, 2.25, 0.055 ), { ...white, matrix: mat4( 0, 1.15, - 1.12 ) } );
	for ( const sx of [ - 1, 1 ] ) add( box( 0.055, 2.25, 2.28 ), { ...white, matrix: mat4( sx * 1.62, 1.15, - 0.02 ) } );

	// Back-wall rod rack.
	for ( let i = 0; i < 5; i ++ ) {
		const x = - 1.25 + i * 0.28;
		add( rod( V( x, 0.3, - 1.05 ), V( x + 0.08, 2.02, - 1.05 ), 0.014, 7 ), { color: i % 2 ? 0x273237 : 0x345261, rough: 0.42, metal: 0.55 } );
		add( cylinder( 0.042, 0.042, 0.06, 12 ), { ...metal, matrix: mat4( x + 0.055, 0.63, - 1.03, Math.PI / 2, 0, 0 ) } );
	}

	// Reel/glass-style counter and line spools.
	add( box( 1.05, 0.82, 0.42 ), { ...wood( 0x6f5844 ), matrix: mat4( - 0.9, 0.41, - 0.35 ) } );
	add( box( 1.0, 0.03, 0.38 ), { color: 0xb9d7dc, rough: 0.1, metal: 0.05, matrix: mat4( - 0.9, 0.84, - 0.35 ) } );
	for ( let i = 0; i < 3; i ++ ) add( cylinder( 0.07, 0.07, 0.055, 16 ), { ...metal, matrix: mat4( - 1.15 + i * 0.24, 0.89, - 0.35 ) } );
	for ( let i = 0; i < 4; i ++ ) add( cylinder( 0.055, 0.055, 0.075, 14 ), { color: [ 0xe6e0cd, 0x2c87a9, 0xddbd34, 0x476b51 ][ i ], rough: 0.55, matrix: mat4( - 1.28 + i * 0.2, 1.03, - 0.58, Math.PI / 2, 0, 0 ) } );

	// Bait freezer / cooler.
	add( box( 0.85, 0.68, 0.62 ), { color: 0xe2e8e6, rough: 0.34, matrix: mat4( 1.14, 0.34, - 0.72 ) } );
	add( box( 0.79, 0.055, 0.56 ), { color: 0xaed3dc, rough: 0.15, matrix: mat4( 1.14, 0.71, - 0.72 ) } );

	// Marine-electronics shelf: fish finder, GPS and VHF.
	add( box( 1.05, 0.08, 0.34 ), { ...wood( 0x765d47 ), matrix: mat4( 0.65, 1.18, - 1.03 ) } );
	for ( const [ x, w, h, color ] of [ [ 0.28, 0.3, 0.24, 0x0d4b67 ], [ 0.66, 0.24, 0.2, 0x163d47 ], [ 1.02, 0.22, 0.28, 0x22292d ] ] ) {
		add( box( w, h, 0.12 ), { ...dark, matrix: mat4( x, 1.35, - 0.94 ) } );
		add( box( w * 0.75, h * 0.62, 0.01 ), { color, rough: 0.08, matrix: mat4( x, 1.36, - 0.875 ) } );
	}

	// Boat-upgrade / utility shelf: deck lights, fuel cans, rope and ice chest.
	add( box( 1.0, 0.07, 0.36 ), { ...wood( 0x765d47 ), matrix: mat4( 1.0, 0.78, 0.2 ) } );
	for ( const x of [ 0.72, 1.02 ] ) add( box( 0.18, 0.3, 0.23 ), { color: 0xb93427, rough: 0.56, pattern: PAT.rusty, matrix: mat4( x, 0.95, 0.19 ) } );
	add( box( 0.36, 0.18, 0.27 ), { color: 0xe6eeee, rough: 0.3, matrix: mat4( 1.32, 0.91, 0.19 ) } );
	for ( let i = 0; i < 3; i ++ ) add( torus( 0.15 - i * 0.014, 0.014, 6, 18 ), { color: 0xc8ac7c, rough: 0.9, pattern: PAT.cloth, matrix: mat4( 0.56, 0.83 + i * 0.025, 0.2, Math.PI / 2, 0, 0 ) } );

	// Checkout counter beside Martha; leaves a clear aisle from the front entrance.
	add( box( 0.8, 0.9, 0.48 ), { ...wood( 0x654c3b ), matrix: mat4( 0.94, 0.45, - 0.18 ) } );
	add( box( 0.84, 0.055, 0.52 ), { ...wood( 0x8c6b50 ), matrix: mat4( 0.94, 0.93, - 0.18 ) } );
	add( box( 0.22, 0.11, 0.18 ), { ...dark, matrix: mat4( 0.8, 1.02, - 0.18 ) } );
	add( box( 0.16, 0.07, 0.13 ), { ...blue, matrix: mat4( 0.8, 1.08, - 0.12 ) } );

	return mergePrepared( P );
}

const PRODUCTS = [
	{ key: 'rod', label: 'ROD WALL', desc: 'Longer casting rods', local: [ - 1.05, 0, - 0.72 ] },
	{ key: 'reel', label: 'REEL CASE', desc: 'Smoother, stronger reels', local: [ - 0.9, 0, - 0.18 ] },
	{ key: 'line', label: 'LINE + TACKLE', desc: 'Heavier fishing line', local: [ - 1.2, 0, - 0.55 ] },
	{ key: 'fishFinder', label: 'FISH FINDER', desc: 'Depth + fish detection on boat HUD', local: [ 0.3, 0, - 0.78 ], boat: true },
	{ key: 'lights', label: 'DECK LIGHTS', desc: 'Night-fishing floodlights', local: [ 0.8, 0, 0.28 ], boat: true },
	{ key: 'hold', label: 'ICE CHEST', desc: 'Increase catch capacity', local: [ 1.3, 0, 0.25 ] },
	{ key: 'fuel', label: 'FUEL TANK', desc: 'Increase boat range', local: [ 1.05, 0, 0.4 ], boat: true },
	{ key: 'engine', label: 'ENGINE PARTS', desc: 'Boat speed and response', local: [ 0.55, 0, 0.38 ], boat: true },
];

export class MarthaShopInterior {
	constructor( app ) {
		this.app = app;
		this.game = app.game;
		this.state = app.game.state;
		this.player = app.player;
		this.chandlery = app.game.chandlery;
		this.group = new Group();
		this.group.name = 'MarthaShopInterior';
		const mesh = new Mesh( interiorGeometry(), createPropMaterial( 'marthaShopInterior' ) );
		mesh.castShadow = true; mesh.receiveShadow = true;
		this.group.add( mesh );
		this.chandlery.group.add( this.group );

		this.originalUpdate = this.player.update.bind( this.player );
		this.player.update = ( dt ) => {
			this.originalUpdate( dt );
			this.update();
		};
		app.marthaShop = this;
	}

	worldPoint( local ) {
		return TMP.set( local[ 0 ], local[ 1 ], local[ 2 ] )
			.applyAxisAngle( Y, this.chandlery.group.rotation.y )
			.add( this.chandlery.group.position );
	}

	update() {
		const p = this.player;
		if ( p.mode !== 'walk' || p.busy ) return;
		// First-story conversation owns the interaction while Martha is offering the delivery.
		if ( this.app.progression?.missionAvailable?.() && this.chandlery.vendor.inRange( p.position ) ) return;

		let best = null, bestD = 1.05;
		for ( const product of PRODUCTS ) {
			const w = this.worldPoint( product.local ).clone();
			const d = Math.hypot( w.x - p.position.x, w.z - p.position.z );
			if ( d < bestD ) { bestD = d; best = product; }
		}
		if ( ! best ) return;

		const next = nextLevel( this.state.upgrades, best.key );
		if ( ! next ) {
			p.prompt = { key: 'E', text: `${ best.label } · owned / maxed` };
			return;
		}
		const ownsBoat = this.state.boats?.owned?.length > 0;
		const locked = best.boat && ! ownsBoat;
		p.prompt = { key: 'E', text: locked
			? `${ best.label } · $${ next.cost } · ${ best.desc } · requires your own boat`
			: `${ best.label } · $${ next.cost } · ${ best.desc } · buy` };
		if ( ! this.app.input.hit( 'KeyE' ) ) return;
		if ( locked ) { this.game.toast( 'You need to own a boat before fitting that upgrade.', 2200 ); return; }
		if ( this.state.money < next.cost ) { this.game.toast( `Need $${ next.cost - this.state.money } more`, 1800 ); return; }
		this.game.buy( best.key );
	}
}
