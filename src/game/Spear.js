import { Group, Mesh, Vector3 } from '../engine/index.js';
import { prepare, mergePrepared, box, cylinder, rod, torus, mat4 } from '../world/boat/GeoKit.js';
import { createPropMaterial } from './GameMaterials.js';

// First-person speargun for underwater hunting. The root copies the camera transform each frame,
// so the model is a view-space prop while still participating in the normal world render / water
// lighting. Local -Z is forward, matching the camera's view direction.

const _rest = new Vector3( 0.29, - 0.29, - 0.73 );

function gunGeometry() {

	const parts = [];
	const add = ( geometry, color, rough = 0.5, metal = 0, matrix = null ) => {

		parts.push( prepare( geometry, { color, rough, metal, matrix } ) );

	};

	// Teak-style stock and butt.
	add( box( 0.075, 0.105, 0.88 ), 0x6f4326, 0.56, 0, mat4( 0, - 0.015, - 0.58 ) );
	add( box( 0.11, 0.13, 0.18 ), 0x57331f, 0.6, 0, mat4( 0, - 0.02, - 0.06 ) );

	// Pistol grip, swept slightly back.
	add( box( 0.082, 0.27, 0.105 ), 0x1c2224, 0.72, 0, mat4( 0, - 0.17, - 0.31, - 0.22, 0, 0 ) );
	add( torus( 0.055, 0.012, 7, 15, Math.PI * 1.12 ), 0x171b1d, 0.45, 0.05, mat4( 0, - 0.1, - 0.43, Math.PI / 2, 0, Math.PI * 0.45, 1, 1, 1 ) );

	// Barrel rail / muzzle hardware.
	add( cylinder( 0.018, 0.018, 1.13, 10, 1, false ), 0x313a3f, 0.27, 0.78, mat4( 0, 0.055, - 0.67, Math.PI / 2, 0, 0 ) );
	add( cylinder( 0.045, 0.045, 0.09, 12, 1, false ), 0x252d31, 0.32, 0.65, mat4( 0, 0.05, - 1.23, Math.PI / 2, 0, 0 ) );

	// Trigger and safety hardware.
	add( box( 0.016, 0.075, 0.018 ), 0xc6c9c6, 0.23, 0.9, mat4( 0, - 0.08, - 0.38, - 0.35, 0, 0 ) );
	add( cylinder( 0.012, 0.012, 0.095, 8, 1, false ), 0x9fa8aa, 0.24, 0.9, mat4( 0, 0.072, - 0.28, 0, 0, Math.PI / 2 ) );

	// Twin latex bands run from the muzzle to the wishbone anchor.
	for ( const s of [ - 1, 1 ] ) {

		add( rod( new Vector3( s * 0.027, 0.075, - 1.24 ), new Vector3( s * 0.036, 0.065, - 0.63 ), 0.012, 8, 0.01 ), 0x181814, 0.84, 0 );

	}

	return mergePrepared( parts );

}

function shaftGeometry() {

	const parts = [];
	parts.push( prepare( cylinder( 0.0062, 0.0062, 1.72, 8, 1, false ), { color: 0xb8c2c6, rough: 0.18, metal: 0.95, matrix: mat4( 0, 0, - 0.87, Math.PI / 2, 0, 0 ) } ) );
	// Tapered-looking point made from two short narrow sections.
	parts.push( prepare( cylinder( 0.001, 0.0062, 0.11, 8, 1, false ), { color: 0xd7dfe1, rough: 0.15, metal: 0.95, matrix: mat4( 0, 0, - 1.78, Math.PI / 2, 0, 0 ) } ) );
	// Small flopper barb beside the tip.
	parts.push( prepare( rod( new Vector3( 0.006, 0, - 1.67 ), new Vector3( 0.05, 0.005, - 1.54 ), 0.0032, 6, 0.0015 ), { color: 0xaeb9bd, rough: 0.2, metal: 0.9 } ) );
	return mergePrepared( parts );

}

export class Spear {

	constructor( { scene, camera } ) {

		this.camera = camera;
		this.root = new Group();
		this.root.name = 'FirstPersonSpeargun';
		scene.add( this.root );

		this.material = createPropMaterial( 'speargun' );
		this.body = new Mesh( gunGeometry(), this.material );
		this.shaft = new Mesh( shaftGeometry(), this.material );
		this.root.add( this.body );
		this.root.add( this.shaft );

		this.visible = false;
		this.shotT = 0;
		this.swayT = 0;
		this.kick = 0;
		this.root.visible = false;

	}

	fire() {

		// Instant gameplay hit detection is handled by Game.fireSpear(); this supplies the visual
		// launch / recoil so the action has a readable first-person physical response.
		this.shotT = 0.34;
		this.kick = 1;

	}

	update( dt, { visible = false, moving = 0 } = {} ) {

		this.visible = visible;
		this.root.visible = visible;
		if ( ! visible ) {

			this.shotT = 0;
			this.kick = 0;
			return;

		}

		this.swayT += dt * ( 1.35 + Math.min( 1, moving ) * 1.5 );
		this.root.position.copy( this.camera.position );
		this.root.quaternion.copy( this.camera.quaternion );

		const swayX = Math.sin( this.swayT * 1.7 ) * 0.008;
		const swayY = Math.sin( this.swayT * 2.15 + 0.8 ) * 0.006;
		this.body.position.set( _rest.x + swayX, _rest.y + swayY, _rest.z + this.kick * 0.055 );

		if ( this.shotT > 0 ) {

			this.shotT = Math.max( 0, this.shotT - dt );
			const u = 1 - this.shotT / 0.34;
			// Shaft snaps forward in the first third, hangs at extension briefly, then visually reloads.
			let travel;
			if ( u < 0.28 ) travel = u / 0.28;
			else if ( u < 0.56 ) travel = 1;
			else travel = Math.max( 0, 1 - ( u - 0.56 ) / 0.44 );
			this.shaft.position.set( _rest.x + swayX, _rest.y + swayY + 0.052, _rest.z - travel * 1.05 );
			this.kick += ( 0 - this.kick ) * Math.min( 1, dt * 9 );

		} else {

			this.shaft.position.set( _rest.x + swayX, _rest.y + swayY + 0.052, _rest.z );
			this.kick += ( 0 - this.kick ) * Math.min( 1, dt * 12 );

		}

	}

}
