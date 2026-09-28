import { addDockShopFixtures } from './DockShopFixtures.js';
import { BAIT_TACKLE } from '../world/bermuda/HarbourLayout.js';
import { Group, Mesh, Vector3, Matrix4 } from '../engine/index.js';
import { prepare, mergePrepared, box, cylinder, sphere, rod, torus, mat4 } from '../world/boat/GeoKit.js';
import { createPropMaterial, PAT } from './GameMaterials.js';
import { Vendor } from './Vendor.js';

// The dock-side trader sells gear, bait and fuel. Meshy visual loads during startup.
export const CHANDLERY = BAIT_TACKLE;

export class Chandlery {

	constructor( { scene, terrain, colliders, material = null } ) {

		const y = CHANDLERY.baseY;
		this.material = material || createPropMaterial( 'chandlery' );
		this.group = new Group();
		this.group.name = 'Chandlery';
		this.group.position.set( CHANDLERY.x, y, CHANDLERY.z );
		this.group.rotation.y = CHANDLERY.yaw;
		scene.add( this.group );
		const fallback = new Mesh( buildTable(), this.material );
        this.group.add( fallback );
        this.fallback = fallback;
        addDockShopFixtures(this.group, CHANDLERY, false);
        this.ready = Promise.resolve();

		// Martha works behind the tackle-shop service opening, keeping the dock lane clear.
		// Martha stays inside but stands directly behind the service opening.
		const local = new Vector3( 0.4, 0, 0.84 ).applyAxisAngle( new Vector3( 0, 1, 0 ), CHANDLERY.yaw );
		const vx = CHANDLERY.x + local.x, vz = CHANDLERY.z + local.z;
		this.vendor = new Vendor( {
			name: 'Martha · Bait & Tackle',
			kind: 'shop',
			position: new Vector3( vx, CHANDLERY.baseY + 0.06, vz ),
			yaw: CHANDLERY.yaw,
			radius: 3.0,
			greeting: 'Bait, line, reels, upgrades and diesel. What do you need?',
			material: this.material,
			// realistic character (Rocketbox, MIT): the stand-in shows until it has loaded
			character: { url: ( ( import.meta.env && import.meta.env.BASE_URL ) || '/' ) + 'models/characters/marta.glb', idle: 'idle_neutral_01', talk: 'gestic_talk_neutral_01', greet: 'wave_01', yaw: Math.PI },
			look: { shirt: 0x8a3b32, trousers: 0x2f3b4a, apron: 0x3d5a4a, hat: 0x2c3a44, hair: 0x3a2c22, skin: 0x7a5236 },
		} );
		scene.add( this.vendor.group );
		if ( colliders ) {

			colliders.addBox( new Vector3( CHANDLERY.x, y + 1.2, CHANDLERY.z ), new Vector3( CHANDLERY.width / 2, 1.2, CHANDLERY.depth / 2 ), CHANDLERY.yaw, { tag: 'chandlery' } );
		}

	}

	update( dt, player ) {

		this.vendor.update( dt, player );

	}

}

function buildTable() {

	const P = [];
	const add = ( g, o ) => P.push( prepare( g, o ) );
	let seed = 11;
	const rnd = () => ( ( seed = ( seed * 16807 ) % 2147483647 ) / 2147483647 );
	const jit = ( a ) => ( rnd() - 0.5 ) * a;
	const WOODX = ( c ) => ( { color: c, rough: 0.9, pattern: PAT.woodX } );
	const WOOD = ( c ) => ( { color: c, rough: 0.9, pattern: PAT.wood } );
	const V = ( x, y, z ) => new Vector3( x, y, z );
	// trestles and a top of three boards
	for ( const x of [ - 0.75, 0.75 ] ) for ( const s of [ - 1, 1 ] ) add( box( 0.06, 0.95, 0.06 ), { ...WOOD( 0x7a6b58 ), matrix: mat4( x, 0.43, s * 0.22, s * 0.28, 0, 0 ) } );
	for ( let i = 0; i < 3; i ++ ) add( box( 2.0, 0.035, 0.26 ), { ...WOODX( [ 0x8e7e68, 0x7d6d5a, 0x958670 ][ i ] ), matrix: mat4( jit( 0.02 ), 0.9, - 0.27 + i * 0.27, 0, jit( 0.02 ), 0 ) } );
	// tackle box (open), spools of line, two reels
	add( box( 0.5, 0.18, 0.3 ), { color: 0x2f6a4a, rough: 0.5, pattern: PAT.rusty, matrix: mat4( - 0.55, 1.01, 0.02 ) } );
	add( box( 0.5, 0.02, 0.3 ), { color: 0x2f6a4a, rough: 0.5, matrix: mat4( - 0.55, 1.2, - 0.16, - 1.2, 0, 0 ) } );
	for ( let i = 0; i < 4; i ++ ) add( cylinder( 0.045, 0.045, 0.05, 14 ), { color: [ 0xd8d4c8, 0x3aa0c8, 0xe0c040, 0xd8d4c8 ][ i ], rough: 0.5, matrix: mat4( 0.05 + i * 0.11, 0.945, 0.12, Math.PI / 2, 0, 0 ) } );
	for ( let i = 0; i < 2; i ++ ) {

		add( cylinder( 0.04, 0.04, 0.05, 16 ), { color: 0x7d8a90, rough: 0.3, metal: 1, matrix: mat4( 0.6 + i * 0.2, 0.96, - 0.1 ) } );
		add( rod( V( 0.6 + i * 0.2, 0.99, - 0.1 ), V( 0.64 + i * 0.2, 0.99, - 0.14 ), 0.004, 5 ), { color: 0x333333, rough: 0.4, metal: 1 } );

	}

	// jerrycans of diesel, a coil of rope and a stack of floats by the table
	for ( let i = 0; i < 3; i ++ ) add( box( 0.18, 0.34, 0.3 ), { color: i === 1 ? 0x1f5a2a : 0xb2261c, rough: 0.55, pattern: PAT.rusty, matrix: mat4( 1.25 + jit( 0.05 ), 0.17, - 0.2 + i * 0.22, 0, jit( 0.4 ), 0 ) } );
	for ( let i = 0; i < 4; i ++ ) add( torus( 0.2 - i * 0.012, 0.018, 6, 20 ), { color: 0xc9b48a, rough: 0.9, pattern: PAT.cloth, matrix: mat4( - 1.3, 0.02 + i * 0.035, 0.2, Math.PI / 2, 0, 0 ) } );
	for ( let i = 0; i < 3; i ++ ) add( sphere( 0.09, 10, 8 ), { color: [ 0xe2552a, 0xe8e2d0, 0xf2c230 ][ i ], rough: 0.5, matrix: mat4( - 1.1 + i * 0.12, 0.09, - 0.3 ) } );
	// a painted board leaning on the table (the price list)
	add( box( 0.7, 0.5, 0.025 ), { color: 0x2a302c, rough: 0.9, matrix: mat4( 0, 0.5, 0.33, - 0.2, 0, 0 ) } );
	add( box( 0.76, 0.56, 0.02 ), { ...WOODX( 0x7a6b58 ), matrix: mat4( 0, 0.5, 0.315, - 0.2, 0, 0 ) } );
	return mergePrepared( P );

}

