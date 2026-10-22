import { Group, Mesh, Vector3 } from '../engine/index.js';
import { prepare, mergePrepared, box, cylinder, rod, mat4 } from '../world/boat/GeoKit.js';
import { createPropMaterial } from './GameMaterials.js';
import { HOUSE } from '../world/boat/Wheelhouse.js';

function makeMesh( name, parts ) {
	const P = [];
	const add = ( g, o ) => P.push( prepare( g, o ) );
	parts( add );
	const mesh = new Mesh( mergePrepared( P ), createPropMaterial( name ) );
	mesh.castShadow = true;
	mesh.receiveShadow = true;
	const group = new Group(); group.name = name; group.add( mesh );
	return group;
}

export class BoatUpgradeVisuals {
	constructor( app ) {
		this.app = app;
		this.state = app.game.state;
		this.root = new Group();
		this.root.name = 'OwnedBoatUpgradeVisuals';
		app.boat.group.add( this.root );

		this.finder = makeMesh( 'BoatFishFinderVisual', ( add ) => {
			add( box( 0.32, 0.24, 0.11 ), { color: 0x151c20, rough: 0.42, metal: 0.25, matrix: mat4( HOUSE.helmX - 0.24, 1.49, HOUSE.dash.zTop - 0.08, - 0.08 ) } );
			add( box( 0.25, 0.16, 0.01 ), { color: 0x0e8eb0, rough: 0.08, matrix: mat4( HOUSE.helmX - 0.24, 1.5, HOUSE.dash.zTop - 0.135, - 0.08 ) } );
		} );
		this.root.add( this.finder );

		this.hold1 = makeMesh( 'BoatIceChestVisual', ( add ) => {
			add( box( 0.82, 0.46, 0.56 ), { color: 0xe8efed, rough: 0.34, matrix: mat4( 0.82, 0.36, - 1.75 ) } );
			add( box( 0.76, 0.055, 0.5 ), { color: 0xb9dce0, rough: 0.16, matrix: mat4( 0.82, 0.62, - 1.75 ) } );
		} );
		this.root.add( this.hold1 );

		this.hold2 = makeMesh( 'BoatFishHoldVisual', ( add ) => {
			add( box( 1.22, 0.52, 0.72 ), { color: 0xe7ece9, rough: 0.3, matrix: mat4( 0.62, 0.38, - 1.68 ) } );
			add( box( 1.12, 0.06, 0.62 ), { color: 0xbedde0, rough: 0.13, matrix: mat4( 0.62, 0.68, - 1.68 ) } );
		} );
		this.root.add( this.hold2 );

		this.fuel1 = makeMesh( 'BoatFuelUpgradeVisual', ( add ) => {
			add( cylinder( 0.08, 0.08, 0.045, 18 ), { color: 0x9da8ab, rough: 0.25, metal: 0.9, matrix: mat4( - 0.82, 0.73, - 1.66 ) } );
			add( box( 0.24, 0.1, 0.16 ), { color: 0x26343a, rough: 0.5, metal: 0.35, matrix: mat4( - 0.82, 0.69, - 1.66 ) } );
		} );
		this.root.add( this.fuel1 );

		this.fuel2 = makeMesh( 'BoatLongRangeFuelVisual', ( add ) => {
			add( box( 0.7, 0.28, 0.44 ), { color: 0x8b9699, rough: 0.36, metal: 0.72, matrix: mat4( - 0.88, 0.25, - 1.62 ) } );
			add( cylinder( 0.055, 0.055, 0.08, 14 ), { color: 0xc7cdd0, rough: 0.24, metal: 0.85, matrix: mat4( - 0.72, 0.43, - 1.62 ) } );
		} );
		this.root.add( this.fuel2 );

		this.engine1 = makeMesh( 'BoatRebuiltEngineCue', ( add ) => {
			add( cylinder( 0.075, 0.075, 0.52, 16 ), { color: 0x454d50, rough: 0.42, metal: 0.8, matrix: mat4( 0.95, 1.98, - 0.72 ) } );
			add( cylinder( 0.1, 0.075, 0.12, 16 ), { color: 0x303639, rough: 0.45, metal: 0.75, matrix: mat4( 0.95, 2.29, - 0.72 ) } );
		} );
		this.root.add( this.engine1 );

		this.engine2 = makeMesh( 'BoatTurboEngineCue', ( add ) => {
			add( cylinder( 0.12, 0.09, 0.18, 18 ), { color: 0x68757a, rough: 0.26, metal: 0.95, matrix: mat4( 0.95, 2.36, - 0.72 ) } );
			add( rod( new Vector3( 0.95, 2.38, - 0.72 ), new Vector3( 1.22, 2.34, - 0.58 ), 0.035, 9 ), { color: 0x8e999c, rough: 0.24, metal: 1 } );
		} );
		this.root.add( this.engine2 );

		this.lightHardware = makeMesh( 'BoatDeckLightHardware', ( add ) => {
			for ( const x of [ - 0.78, 0.78 ] ) {
				add( box( 0.26, 0.12, 0.09 ), { color: 0x20292c, rough: 0.42, metal: 0.4, matrix: mat4( x, HOUSE.roofUnderY - 0.08, - 0.94 ) } );
				add( box( 0.2, 0.075, 0.01 ), { color: 0xf5e3aa, rough: 0.12, matrix: mat4( x, HOUSE.roofUnderY - 0.08, - 0.99 ) } );
			}
		} );
		this.root.add( this.lightHardware );

		this.unsubscribe = this.state.onChange( () => this.refresh() );
		this.refresh();
		app.boatUpgradeVisuals = this;
	}

	refresh() {
		const u = this.state.upgrades || {};
		const owns = !! this.state.boats?.owned?.length;
		this.root.visible = owns;
		this.finder.visible = owns && ( u.fishFinder | 0 ) > 0;
		this.hold1.visible = owns && ( u.hold | 0 ) === 1;
		this.hold2.visible = owns && ( u.hold | 0 ) >= 2;
		this.fuel1.visible = owns && ( u.fuel | 0 ) >= 1;
		this.fuel2.visible = owns && ( u.fuel | 0 ) >= 2;
		this.engine1.visible = owns && ( u.engine | 0 ) >= 1;
		this.engine2.visible = owns && ( u.engine | 0 ) >= 2;
		this.lightHardware.visible = owns && ( u.lights | 0 ) > 0;
	}
}
