import { Group, Mesh, Vector3 } from '../engine/index.js';
import { prepare, mergePrepared, box, rod, mat4 } from '../world/boat/GeoKit.js';
import { createPropMaterial, PAT } from './GameMaterials.js';
import { WORLD } from '../world/WorldLayout.js';

const BOAT_ID = 'lobster-workboat';
const PRICE = 3200;
const MISSION = 'main-first-boat';

function signGeometry() {
	const P = [];
	const add = ( g, o ) => P.push( prepare( g, o ) );
	const wood = { color: 0x6f543d, rough: 0.9, pattern: PAT.woodX };
	const board = { color: 0xe9e4d4, rough: 0.84 };
	add( rod( new Vector3( - 0.34, 0, 0 ), new Vector3( - 0.34, 1.25, 0 ), 0.035, 7 ), wood );
	add( rod( new Vector3( 0.34, 0, 0 ), new Vector3( 0.34, 1.25, 0 ), 0.035, 7 ), wood );
	add( box( 0.92, 0.54, 0.055 ), { ...board, matrix: mat4( 0, 1.05, 0 ) } );
	add( box( 0.66, 0.045, 0.012 ), { color: 0x1c5963, rough: 0.5, matrix: mat4( 0, 1.16, 0.035 ) } );
	add( box( 0.48, 0.045, 0.012 ), { color: 0x1c5963, rough: 0.5, matrix: mat4( 0, 1.02, 0.035 ) } );
	add( box( 0.58, 0.045, 0.012 ), { color: 0xc89b3c, rough: 0.5, matrix: mat4( 0, 0.88, 0.035 ) } );
	return mergePrepared( P );
}

export class BoatOwnership {
	constructor( app ) {
		this.app = app;
		this.player = app.player;
		this.state = app.game.state;
		this.game = app.game;
		this.input = app.input;
		this._realNearBoat = this.player.nearBoat.bind( this.player );
		this.player.nearBoat = () => this.ownsBoat() && this._realNearBoat();

		this.sign = new Group();
		this.sign.name = 'StarterBoatSaleSign';
		const mesh = new Mesh( signGeometry(), createPropMaterial( 'starterBoatSaleSign' ) );
		mesh.castShadow = true;
		this.sign.add( mesh );
		const dock = WORLD.boatDock.position;
		this.sign.position.set( dock.x + 3.2, dock.y || 1.0, dock.z + 1.0 );
		this.sign.rotation.y = WORLD.boatDock.heading || 0;
		app.scene.add( this.sign );

		this.originalUpdate = this.player.update.bind( this.player );
		this.player.update = ( dt ) => {
			this.originalUpdate( dt );
			this.update();
		};
		app.boatOwnership = this;
		this.refresh();
	}

	ownsBoat() {
		return !! this.state.boats?.owned?.some( ( b ) => b.id === BOAT_ID );
	}

	refresh() { if ( this.sign ) this.sign.visible = ! this.ownsBoat(); }

	ensureStarterBoatAtBerth() {
		if ( this.ownsBoat() ) return;
		const boat = this.player?.boat;
		if ( ! boat ) return;

		const dock = WORLD.boatDock.position;
		const dx = boat.position.x - dock.x;
		const dy = boat.position.y - dock.y;
		const dz = boat.position.z - dock.z;
		const away = Math.hypot( dx, dy, dz ) > 0.75;
		const wrongState = ! boat.moored || boat.anchored;

		if ( away || wrongState ) {
			// The sale boat is harbour inventory until purchased. It cannot inherit a world-save
			// position or drift into the traffic field before ownership transfers to the player.
			if ( typeof boat.reset === 'function' ) boat.reset();
			else {
				boat.position.copy( dock );
				boat.velocity?.set?.( 0, 0, 0 );
				boat.angular?.set?.( 0, 0, 0 );
				boat.moored = true;
				boat.anchored = false;
			}
			boat.apply?.();
		}
	}

	update() {
		this.ensureStarterBoatAtBerth();
		this.refresh();
		if ( this.ownsBoat() ) {
			// Migration: an older save may already own the boat before the mission became formal.
			const d = this.app.missionDirector;
			if ( d?.available?.( MISSION ) ) d.accept( MISSION, { toast: false } );
			if ( d?.active?.( MISSION ) ) d.complete( MISSION, { toast: false } );
			return;
		}
		const p = this.player;
		if ( p.mode !== 'walk' || p.busy || ! this._realNearBoat() ) return;
		p.prompt = { key: 'E', text: `Downeast lobster boat · $${ PRICE.toLocaleString() } · buy` };
		if ( ! this.input.hit( 'KeyE' ) ) return;
		if ( this.state.money < PRICE ) {
			this.game.toast( `Boat costs $${ PRICE.toLocaleString() } · you need $${ ( PRICE - this.state.money ).toLocaleString() } more`, 2600 );
			return;
		}

		const d = this.app.missionDirector;
		if ( d?.available?.( MISSION ) ) d.accept( MISSION, { toast: false } );
		if ( ! this.state.spend( PRICE ) ) return;
		this.state.ownBoat( { id: BOAT_ID, name: 'Downeast Lobster Boat', purchasedAt: Date.now() } );
		this.state.storyFlags.firstBoatPurchased = true;

		if ( d?.active?.( MISSION ) ) d.complete( MISSION, { toast: false } );
		else this.state.addReputation( 'Joe', 5 );

		this.state.save(); this.state.emit();
		this.refresh();
		this.game.toast( 'The First Boat · Downeast Lobster Boat is yours', 3400 );
	}
}
