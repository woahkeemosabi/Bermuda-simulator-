import { Group, Mesh, Vector3 } from '../engine/index.js';
import { prepare, mergePrepared, box, rod, mat4 } from '../world/boat/GeoKit.js';
import { createPropMaterial, PAT } from './GameMaterials.js';

const HOME = Object.freeze( {
	id: 'harbour-cottage',
	name: 'Harbour Cottage',
	price: 8500,
	// Existing house-d sits around (-57,-61); this door is on its harbour-facing/south side.
	exterior: Object.freeze( { x: - 57, z: - 58.2 } ),
	// Closed interior cell, separated from the streaming waterfront so the existing house GLB does
	// not need to be cut apart before interiors can become meaningful progression spaces.
	interior: Object.freeze( { x: 360, y: 34, z: - 360 } ),
} );

const ROOM = Object.freeze( { width: 7.2, depth: 5.6, height: 2.8 } );
const TMP = new Vector3();

function money( n ) { return '$' + Math.max( 0, Math.round( Number( n ) || 0 ) ).toLocaleString(); }

function saleSignGeometry() {
	const P = [];
	const add = ( g, o ) => P.push( prepare( g, o ) );
	const wood = { color: 0x76583f, rough: 0.9, pattern: PAT.woodX };
	add( rod( new Vector3( 0, 0, 0 ), new Vector3( 0, 1.25, 0 ), 0.035, 7 ), wood );
	add( box( 0.9, 0.5, 0.055 ), { color: 0xf1ead8, rough: 0.82, matrix: mat4( 0, 1.03, 0 ) } );
	add( box( 0.62, 0.045, 0.012 ), { color: 0x285d67, rough: 0.45, matrix: mat4( 0, 1.13, 0.035 ) } );
	add( box( 0.5, 0.045, 0.012 ), { color: 0xc99d42, rough: 0.45, matrix: mat4( 0, 0.99, 0.035 ) } );
	add( box( 0.7, 0.045, 0.012 ), { color: 0x285d67, rough: 0.45, matrix: mat4( 0, 0.85, 0.035 ) } );
	return mergePrepared( P );
}

function interiorGeometry() {
	const P = [];
	const add = ( g, o ) => P.push( prepare( g, o ) );
	const w = ROOM.width, d = ROOM.depth, h = ROOM.height;
	const plaster = { color: 0xf0eadf, rough: 0.93 };
	const trim = { color: 0xffffff, rough: 0.72 };
	const cedar = { color: 0x8a6548, rough: 0.86, pattern: PAT.woodX };
	const darkWood = { color: 0x5f4635, rough: 0.88, pattern: PAT.woodX };

	// Room shell.
	add( box( w, 0.1, d ), { ...cedar, matrix: mat4( 0, 0.05, 0 ) } );
	add( box( w, 0.08, d ), { ...trim, matrix: mat4( 0, h, 0 ) } );
	add( box( w, h, 0.1 ), { ...plaster, matrix: mat4( 0, h / 2, - d / 2 ) } );
	for ( const sx of [ - 1, 1 ] ) add( box( 0.1, h, d ), { ...plaster, matrix: mat4( sx * w / 2, h / 2, 0 ) } );
	add( box( w, h, 0.1 ), { ...plaster, matrix: mat4( 0, h / 2, d / 2 ) } );

	// White Bermuda-style interior trim and a framed exit door.
	add( box( 1.05, 2.18, 0.09 ), { ...darkWood, matrix: mat4( 0, 1.09, d / 2 - 0.06 ) } );
	add( box( 1.18, 0.08, 0.11 ), { ...trim, matrix: mat4( 0, 2.22, d / 2 - 0.1 ) } );
	for ( const x of [ - 0.57, 0.57 ] ) add( box( 0.08, 2.28, 0.11 ), { ...trim, matrix: mat4( x, 1.12, d / 2 - 0.1 ) } );

	// Bed + bedside table.
	add( box( 2.0, 0.42, 1.45 ), { ...darkWood, matrix: mat4( - 2.05, 0.28, - 1.28 ) } );
	add( box( 1.9, 0.28, 1.35 ), { color: 0xded9cf, rough: 0.92, pattern: PAT.cloth, matrix: mat4( - 2.05, 0.59, - 1.28 ) } );
	add( box( 0.85, 0.15, 0.5 ), { color: 0xf5f0e7, rough: 0.94, pattern: PAT.cloth, matrix: mat4( - 2.46, 0.82, - 1.28 ) } );
	add( box( 0.58, 0.62, 0.5 ), { ...cedar, matrix: mat4( - 3.0, 0.31, 0.08 ) } );

	// Wardrobe and storage chest.
	add( box( 1.35, 2.15, 0.62 ), { ...cedar, matrix: mat4( 2.72, 1.08, - 1.75 ) } );
	add( box( 0.05, 1.9, 0.64 ), { ...darkWood, matrix: mat4( 2.72, 1.05, - 1.74 ) } );
	add( box( 1.3, 0.68, 0.72 ), { ...darkWood, matrix: mat4( 2.55, 0.34, 1.55 ) } );
	add( box( 1.34, 0.09, 0.76 ), { color: 0xa47a53, rough: 0.82, pattern: PAT.woodX, matrix: mat4( 2.55, 0.72, 1.55 ) } );

	// Small desk / island map corner.
	add( box( 1.5, 0.08, 0.72 ), { ...cedar, matrix: mat4( 0.1, 0.84, - 1.95 ) } );
	for ( const x of [ - 0.58, 0.58 ] ) for ( const z of [ - 0.23, 0.23 ] ) add( box( 0.07, 0.82, 0.07 ), { ...darkWood, matrix: mat4( 0.1 + x, 0.41, - 1.95 + z ) } );
	add( box( 1.02, 0.025, 0.52 ), { color: 0xd9d2bc, rough: 0.72, matrix: mat4( 0.1, 0.9, - 1.95 ) } );

	return mergePrepared( P );
}

export class PropertySystem {
	constructor( app ) {
		this.app = app;
		this.game = app.game;
		this.state = app.game.state;
		this.player = app.player;
		this.input = app.input;
		this.insideHome = false;
		this.installStateAPI();
		this.buildExterior();
		this.buildInterior();

		const originalUpdate = this.player.update.bind( this.player );
		this.player.update = ( dt ) => {
			originalUpdate( dt );
			this.update( dt );
		};
		app.propertySystem = this;
	}

	installStateAPI() {
		const s = this.state;
		if ( ! s.properties.storage ) s.properties.storage = {};
		if ( typeof s.ownsProperty !== 'function' ) {
			s.ownsProperty = ( id ) => s.properties.owned.some( ( p ) => ( typeof p === 'string' ? p : p?.id ) === id );
		}
		if ( typeof s.ownProperty !== 'function' ) {
			s.ownProperty = ( property ) => {
				if ( ! property?.id || s.ownsProperty( property.id ) ) return false;
				s.properties.owned.push( { ...property } );
				if ( ! s.properties.home ) s.properties.home = property.id;
				if ( property.garage && ! s.properties.garage ) s.properties.garage = property.id;
				s.save(); s.emit();
				return true;
			};
		}
	}

	ownsHome() { return !! this.state.ownsProperty?.( HOME.id ); }

	buildExterior() {
		const y = this.app.terrainData?.heightAt?.( HOME.exterior.x, HOME.exterior.z ) ?? 0;
		this.exteriorY = y;
		this.door = new Group();
		this.door.name = 'HarbourCottageDoor';
		const doorMesh = new Mesh( box( 1.08, 2.05, 0.09 ), createPropMaterial( 'harbourCottageDoor' ) );
		doorMesh.position.set( HOME.exterior.x, y + 1.03, HOME.exterior.z );
		doorMesh.castShadow = true;
		this.door.add( doorMesh );
		this.app.scene.add( this.door );

		this.saleSign = new Mesh( saleSignGeometry(), createPropMaterial( 'harbourCottageSaleSign' ) );
		this.saleSign.position.set( HOME.exterior.x + 1.6, y + 0.02, HOME.exterior.z + 0.35 );
		this.saleSign.castShadow = true;
		this.app.scene.add( this.saleSign );
		this.refreshExterior();
	}

	buildInterior() {
		const c = HOME.interior;
		this.interior = new Group();
		this.interior.name = 'HarbourCottageInterior';
		const mesh = new Mesh( interiorGeometry(), createPropMaterial( 'harbourCottageInterior' ) );
		mesh.castShadow = true; mesh.receiveShadow = true;
		this.interior.add( mesh );
		this.interior.position.set( c.x, c.y, c.z );
		this.app.scene.add( this.interior );

		const colliders = this.app.colliders;
		if ( colliders ) {
			const w = ROOM.width, d = ROOM.depth, h = ROOM.height;
			colliders.addBox( new Vector3( c.x, c.y + 0.05, c.z ), new Vector3( w / 2, 0.05, d / 2 ), 0, { walkable: true, solid: false, tag: 'homeFloor' } );
			colliders.addBox( new Vector3( c.x, c.y + h / 2, c.z - d / 2 ), new Vector3( w / 2, h / 2, 0.08 ), 0, { tag: 'homeWall' } );
			colliders.addBox( new Vector3( c.x, c.y + h / 2, c.z + d / 2 ), new Vector3( w / 2, h / 2, 0.08 ), 0, { tag: 'homeWall' } );
			for ( const sx of [ - 1, 1 ] ) colliders.addBox( new Vector3( c.x + sx * w / 2, c.y + h / 2, c.z ), new Vector3( 0.08, h / 2, d / 2 ), 0, { tag: 'homeWall' } );
		}

		this.points = {
			exit: new Vector3( c.x, c.y + 0.1, c.z + ROOM.depth / 2 - 0.72 ),
			bed: new Vector3( c.x - 2.0, c.y + 0.1, c.z - 1.0 ),
			storage: new Vector3( c.x + 2.55, c.y + 0.1, c.z + 1.35 ),
			wardrobe: new Vector3( c.x + 2.5, c.y + 0.1, c.z - 1.3 ),
		};
	}

	refreshExterior() { if ( this.saleSign ) this.saleSign.visible = ! this.ownsHome(); }

	distanceXZ( a, b ) { return Math.hypot( a.x - b.x, a.z - b.z ); }

	enterHome() {
		if ( ! this.ownsHome() ) return false;
		const c = HOME.interior;
		this.insideHome = true;
		this.player.position.set( c.x, c.y + 0.11, c.z + 1.55 );
		this.player.velocity.set( 0, 0, 0 );
		this.player.yaw = Math.PI;
		this.player.pitch = - 0.04;
		this.player._camY = null;
		this.game.toast( HOME.name, 1400 );
		return true;
	}

	exitHome() {
		this.insideHome = false;
		this.player.position.set( HOME.exterior.x, this.exteriorY + 0.05, HOME.exterior.z + 1.5 );
		this.player.velocity.set( 0, 0, 0 );
		this.player.yaw = 0;
		this.player.pitch = - 0.04;
		this.player._camY = null;
		return true;
	}

	buyHome() {
		if ( this.ownsHome() ) return false;
		if ( this.state.money < HOME.price ) {
			this.game.toast( `${ HOME.name } costs ${ money( HOME.price ) } · need ${ money( HOME.price - this.state.money ) } more`, 2800 );
			return false;
		}
		if ( ! this.state.spend( HOME.price ) ) return false;
		if ( ! this.state.ownProperty( { id: HOME.id, name: HOME.name, price: HOME.price, garage: true, purchasedAt: Date.now() } ) ) {
			this.state.addMoney( HOME.price );
			return false;
		}
		this.state.storyFlags.firstHomePurchased = true;
		this.state.save(); this.state.emit();
		this.refreshExterior();
		this.game.toast( `${ HOME.name } purchased · ${ money( HOME.price ) }`, 3400 );
		return true;
	}

	sleep() {
		this.app.settings.timeOfDay = 7.0;
		this.state.world.time = 7.0;
		this.state.save(); this.state.emit();
		this.game.toast( 'Rested · 07:00 · progress saved', 2400 );
	}

	update() {
		const p = this.player;
		if ( p.mode !== 'walk' || p.busy ) return;

		if ( ! this.insideHome ) {
			const d = Math.hypot( p.position.x - HOME.exterior.x, p.position.z - HOME.exterior.z );
			if ( d > 1.7 ) return;
			if ( this.ownsHome() ) {
				p.prompt = { key: 'E', text: `Enter ${ HOME.name }` };
				if ( this.input.hit( 'KeyE' ) ) this.enterHome();
			} else {
				p.prompt = { key: 'E', text: `${ HOME.name } · ${ money( HOME.price ) } · buy` };
				if ( this.input.hit( 'KeyE' ) ) this.buyHome();
			}
			return;
		}

		const actions = [
			{ point: this.points.exit, text: 'Leave Harbour Cottage', run: () => this.exitHome() },
			{ point: this.points.bed, text: 'Sleep until morning · save progress', run: () => this.sleep() },
			{ point: this.points.storage, text: 'Home storage · equipment storage ready', run: () => this.game.toast( 'Home storage linked to your property save.', 1800 ) },
			{ point: this.points.wardrobe, text: 'Wardrobe · clothing slot', run: () => this.game.toast( 'Wardrobe registered to this home.', 1700 ) },
		];
		let best = null, bestD = 1.35;
		for ( const action of actions ) {
			const d = this.distanceXZ( p.position, action.point );
			if ( d < bestD ) { bestD = d; best = action; }
		}
		if ( best ) {
			p.prompt = { key: 'E', text: best.text };
			if ( this.input.hit( 'KeyE' ) ) best.run();
		}
	}
}
