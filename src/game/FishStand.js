import { addDockShopFixtures } from './DockShopFixtures.js';
import { FISH_MARKET } from '../world/bermuda/HarbourLayout.js';
import { Group, Mesh, Vector3, BoxGeometry, Matrix4, Quaternion } from '../engine/index.js';
import { mergeGeometries } from '../engine/geometry/BufferGeometryUtils.js';
import { prepare, mergePrepared, box, cylinder, sphere, rod, mat4 } from '../world/boat/GeoKit.js';
import { createPropMaterial, PAT } from './GameMaterials.js';
import { Vendor } from './Vendor.js';
import { FishProps } from '../world/fish/FishProps.js';
import { FISH } from './FishTable.js';

// Fish market relocated to the Bermuda harbour, immediately beside the hero dock.
export const STAND = FISH_MARKET;

const STALL_FLOOR = 0.06;
const ICE_TOP = 1.27;

export class FishStand {

	constructor( { scene, terrain, colliders } ) {

		const y = STAND.baseY;
		this.material = createPropMaterial( 'fishStand' );
		this.group = new Group();
		this.group.name = 'FishStand';
		this.group.position.set( STAND.x, y, STAND.z );
		this.group.rotation.y = STAND.yaw;
		scene.add( this.group );
		// Put a lightweight procedural market on screen immediately so the selling point is never
		// invisible while the richer stall asset downloads on mobile. Replace it only after success.
		const fallback = new Mesh( buildStall(), this.material );
		fallback.name = 'FishStandFallback';
		fallback.castShadow = true;
		this.group.add( fallback );
        this.fallback = fallback;
        addDockShopFixtures(this.group, STAND, true);
		this.ready = Promise.resolve();

		// Joe works behind the market service opening rather than occupying the dock lane.
		const local = new Vector3( 0.45, 0, 0.52 ).applyAxisAngle( new Vector3( 0, 1, 0 ), STAND.yaw );
		this.vendor = new Vendor( {
			name: 'Joe · Fish buyer', kind: 'buyer',
			position: new Vector3( STAND.x + local.x, y + STALL_FLOOR, STAND.z + local.z ),
			yaw: STAND.yaw, radius: 3.2,
			greeting: 'Let\'s see what you caught. Fair prices, cash.',
			idle: 'Nothing to sell? The grunts are biting off the dock.',
			material: this.material,
			character: { url: ( ( import.meta.env && import.meta.env.BASE_URL ) || '/' ) + 'models/characters/joe.glb', idle: 'idle_neutral_01', talk: 'gestic_talk_relaxed_01', greet: 'wave_01' },
		} );
		scene.add( this.vendor.group );

		if ( colliders ) {

			colliders.addBox( new Vector3( STAND.x, y + 1.2, STAND.z ), new Vector3( STAND.width / 2, 1.2, STAND.depth / 2 ), STAND.yaw, { tag: 'fishStand' } );
		}

	}

	iceFish() {

		const out = [];
		const list = [ [ 'jack', 0.36 ], [ 'redSnapper', 0.34 ], [ 'yellowtail', 0.3 ], [ 'grunt', 0.26 ], [ 'mullet', 0.33 ] ];
		const base = new Matrix4().makeRotationY( STAND.yaw ).setPosition( STAND.x, this.group.position.y, STAND.z );
		list.forEach( ( [ species, L ], i ) => {

			const rest = FishProps.restHeight( FISH[ species ].model, L );
			const local = new Matrix4().makeRotationY( ( i % 2 ? 0.12 : - 0.1 ) ).setPosition( - 0.55 + ( i % 2 ? 0.04 : - 0.04 ), ICE_TOP + rest + 0.006 * i, 0.7 + i * 0.085 );
			out.push( { species, frame: new Matrix4().multiplyMatrices( base, local ), L, pose: i % 2 ? 'sideFlip' : 'side' } );

		} );
		return out;

	}

	update( dt, player ) { this.vendor.update( dt, player ); }

}

function buildStall() {
	const P = [];
	const add = ( g, o ) => P.push( prepare( g, o ) );
	const WOOD = ( c = 0x8a7a66 ) => ( { color: c, rough: 0.9, pattern: PAT.wood } );
	const WOODX = ( c = 0x8a7a66 ) => ( { color: c, rough: 0.9, pattern: PAT.woodX } );
	const TIN = { color: 0x8c9296, rough: 0.55, metal: 0.7, pattern: PAT.rusty };
	const V = ( x, y, z ) => new Vector3( x, y, z );
	let seed = 7; const rnd = () => ( ( seed = ( seed * 16807 ) % 2147483647 ) / 2147483647 ); const jit = ( a ) => ( rnd() - 0.5 ) * a;
	for ( const [ x, z, hgt ] of [ [ - 1.25, 0.75, 2.45 ], [ 1.25, 0.75, 2.42 ], [ - 1.25, - 0.75, 2.12 ], [ 1.25, - 0.75, 2.15 ] ] ) add( box( 0.1, hgt, 0.1 ), { ...WOOD( 0x7d6c58 ), matrix: mat4( x, hgt / 2, z, jit( 0.03 ), 0, jit( 0.03 ) ) } );
	let yy = 0.12; for ( let i = 0; i < 7; i ++ ) { const w = 0.12 + rnd() * 0.04; if ( i !== 1 ) add( box( 2.56 + jit( 0.05 ), w - 0.012, 0.025 ), { ...WOODX( [ 0x8e7e68, 0x7a6b58, 0x9a8c78, 0x6f624f ][ i % 4 ] ), matrix: mat4( jit( 0.03 ), yy + w / 2, 0.8, 0, jit( 0.02 ), jit( 0.015 ) ) } ); yy += w; }
	for ( let i = 0; i < 4; i ++ ) add( box( 2.7, 0.045, 0.15 ), { ...WOODX( i % 2 ? 0x9b8b74 : 0x8d7d68 ), matrix: mat4( jit( 0.02 ), 1.02, 0.66 + i * 0.155, 0, jit( 0.015 ), 0 ) } );
	add( box( 2.5, 0.035, 0.3 ), { ...WOODX( 0x7a6b58 ), matrix: mat4( 0, 0.7, - 0.63 ) } );
	for ( let i = 0; i < 9; i ++ ) add( box( 2.52, 0.04, 0.165 + jit( 0.01 ) ), { ...WOODX( [ 0x7a6b58, 0x6f624f, 0x857562 ][ i % 3 ] ), matrix: mat4( jit( 0.02 ), STALL_FLOOR - 0.02, - 0.7 + i * 0.172, 0, jit( 0.02 ), 0 ) } );
	for ( const s of [ - 1, 1 ] ) for ( let i = 0; i < 11; i ++ ) add( box( 0.022, 1.0 + jit( 0.06 ), 0.13 ), { ...WOOD( [ 0x857562, 0x77684f, 0x928470 ][ i % 3 ] ), matrix: mat4( s * 1.3, 0.52, - 0.72 + i * 0.145, 0, 0, jit( 0.02 ) ) } );
	for ( let i = 0; i < 18; i ++ ) add( box( 0.135, 2.05 + jit( 0.05 ), 0.022 ), { ...WOOD( [ 0x7f6f5b, 0x8a7a64, 0x6d604e ][ i % 3 ] ), matrix: mat4( - 1.25 + i * 0.147, 1.03, - 0.8, jit( 0.01 ), 0, 0 ) } );
	for ( const x of [ - 1.25, 0, 1.25 ] ) add( box( 0.07, 0.09, 2.0 ), { ...WOOD( 0x6d604e ), matrix: mat4( x, 2.33, 0, - 0.16 ) } );
	for ( let i = 0; i < 4; i ++ ) add( corrugated( 0.8, 2.1, 9 ), { ...TIN, matrix: mat4( - 1.14 + i * 0.76, 2.4 + ( i === 3 ? 0.03 : 0 ), 0.04, - 0.16 + ( i === 3 ? 0.03 : 0 ), jit( 0.02 ), jit( 0.02 ) ) } );
	add( box( 0.9, 0.22, 0.5 ), { color: 0x2f6f8f, rough: 0.5, matrix: mat4( - 0.55, 1.15, 0.85 ) } );
	add( box( 0.84, 0.03, 0.44 ), { color: 0xe7eef0, rough: 0.15, matrix: mat4( - 0.55, 1.255, 0.85 ) } );
	add( rod( V( 0.6, 2.25, 0.62 ), V( 0.6, 1.75, 0.62 ), 0.006, 4 ), { color: 0x555a5c, rough: 0.4, metal: 1 } );
	add( cylinder( 0.1, 0.1, 0.05, 18 ), { color: 0xc9c2b0, rough: 0.5, metal: 0.4, pattern: PAT.rusty, matrix: mat4( 0.6, 1.66, 0.62, Math.PI / 2, 0, 0 ) } );
	add( cylinder( 0.14, 0.11, 0.05, 16 ), { color: 0xa9b0b3, rough: 0.35, metal: 1, matrix: mat4( 0.6, 1.45, 0.62 ) } );
	for ( let i = 0; i < 5; i ++ ) add( sphere( 0.06, 10, 8 ), { color: [ 0xe2552a, 0xf2c230, 0xe8e2d0, 0x2f8f6f, 0xe2552a ][ i ], rough: 0.5, matrix: mat4( - 1.1 + i * 0.5, 2.05 + jit( 0.1 ), 0.95 ) } );
	return mergePrepared( P );
}

function corrugated( w, d, ribs ) {
	const g = new BoxGeometry( w, 0.025, d );
	return g;
}
