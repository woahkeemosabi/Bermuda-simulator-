import { Group, Mesh, Vector3 } from '../engine/index.js';
import { prepare, mergePrepared, box, cylinder, rod, torus, sphere, mat4 } from '../world/boat/GeoKit.js';
import { createPropMaterial } from './GameMaterials.js';
import { standard } from '../materials/Materials.js';

// First-person speargun for underwater hunting. The root copies the camera transform each frame,
// so the model is a view-space prop while still participating in the normal world render / water
// lighting. Local -Z is forward, matching the camera's view direction.

const _rest = new Vector3( 0.29, - 0.29, - 0.73 );
const _fx = new Vector3();
// UNDERWATER_POLISH_V1: physical grab hands, impact kick and world-space bubble bursts.

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

function gloveGeometry() {

	const parts = [];
	const add = ( geometry, matrix = null, color = 0x11191d ) => parts.push( prepare( geometry, { color, rough: 0.82, metal: 0, matrix } ) );
	// Neoprene palm / cuff and four readable fingers. They are deliberately compact so they do not
	// obscure the target when they surge forward for a lobster grab.
	add( box( 0.12, 0.045, 0.17 ), mat4( 0, 0, - 0.03 ) );
	add( box( 0.105, 0.052, 0.105 ), mat4( 0, 0, 0.1 ), 0x172126 );
	for ( let i = 0; i < 4; i ++ ) {

		const x = ( i - 1.5 ) * 0.027;
		add( rod( new Vector3( x, 0, - 0.08 ), new Vector3( x * 1.06, 0.002, - 0.205 - Math.abs( i - 1.5 ) * 0.008 ), 0.012, 7, 0.009 ) );

	}
	add( rod( new Vector3( 0.055, - 0.004, 0.01 ), new Vector3( 0.105, - 0.006, - 0.085 ), 0.014, 7, 0.01 ), null, 0x172126 );
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

		const gloveGeo = gloveGeometry();
		this.handL = new Mesh( gloveGeo, this.material );
		this.handR = new Mesh( gloveGeo, this.material );
		this.handL.visible = this.handR.visible = false;
		this.root.add( this.handL );
		this.root.add( this.handR );

		// A tiny pooled world-space bubble effect makes spear impacts and close-range grabs readable
		// without allocating meshes during gameplay. The pool lives outside the camera-following root.
		this.fxRoot = new Group();
		this.fxRoot.name = 'UnderwaterHuntFX';
		scene.add( this.fxRoot );
		this.bubbleMaterial = standard( { color: 0xc8f4ff, roughness: 0.12, metalness: 0, transparent: true, opacity: 0.46, depthWrite: false } );
		const bubbleGeo = sphere( 1, 8, 6 );
		this.bubbles = [];
		for ( let i = 0; i < 18; i ++ ) {

			const mesh = new Mesh( bubbleGeo, this.bubbleMaterial );
			mesh.visible = false;
			this.fxRoot.add( mesh );
			this.bubbles.push( { mesh, velocity: new Vector3(), life: 0, age: 0, size: 0.03 } );

		}
		this._bubbleCursor = 0;
		this.visible = false;
		this.shotT = 0;
		this.grabT = 0;
		this.impactT = 0;
		this.swayT = 0;
		this.kick = 0;
		this.root.visible = false;

	}

	fire() {

		// Instant gameplay hit detection is handled by Game.fireSpear(); this supplies the visual
		// launch / recoil so the action has a readable first-person physical response.
		this.shotT = 0.34;
		this.kick = 1;
		_fx.set( _rest.x, _rest.y + 0.055, _rest.z - 1.2 ).applyQuaternion( this.camera.quaternion ).add( this.camera.position );
		this.burst( _fx, 4, 0.45 );

	}

	burst( position, count = 8, strength = 1 ) {

		if ( ! position ) return;
		for ( let i = 0; i < count; i ++ ) {

			const b = this.bubbles[ this._bubbleCursor ++ % this.bubbles.length ];
			const a = Math.random() * Math.PI * 2, r = Math.random() * 0.08 * strength;
			b.mesh.position.set( position.x + Math.cos( a ) * r, position.y + ( Math.random() - 0.5 ) * 0.06, position.z + Math.sin( a ) * r );
			b.velocity.set( ( Math.random() - 0.5 ) * 0.16 * strength, 0.16 + Math.random() * 0.34 * strength, ( Math.random() - 0.5 ) * 0.16 * strength );
			b.life = 0.48 + Math.random() * 0.5;
			b.age = 0;
			b.size = 0.012 + Math.random() * 0.025 * strength;
			b.mesh.scale.setScalar( b.size );
			b.mesh.visible = true;

		}

	}

	impact( position, strength = 1 ) {

		this.impactT = 0.24;
		this.kick = Math.max( this.kick, 1.35 );
		this.burst( position, 11, strength );

	}

	grab( position = null ) {

		this.grabT = 0.72;
		this.shotT = 0;
		if ( position ) this.burst( position, 6, 0.7 );

	}

	updateBubbles( dt ) {

		for ( const b of this.bubbles ) {

			if ( b.life <= 0 ) continue;
			b.age += dt;
			b.life -= dt;
			if ( b.life <= 0 ) { b.mesh.visible = false; continue; }
			b.mesh.position.addScaledVector( b.velocity, dt );
			b.velocity.y += dt * 0.12;
			b.velocity.x *= Math.max( 0, 1 - dt * 0.8 );
			b.velocity.z *= Math.max( 0, 1 - dt * 0.8 );
			b.mesh.scale.setScalar( b.size * ( 1 + b.age * 0.32 ) );

		}

	}

	update( dt, { visible = false, moving = 0 } = {} ) {

		this.updateBubbles( dt );
		this.visible = visible;
		this.root.visible = visible;
		if ( ! visible ) {

			this.shotT = 0;
			this.grabT = 0;
			this.impactT = 0;
			this.kick = 0;
			this.handL.visible = this.handR.visible = false;
			return;

		}

		this.swayT += dt * ( 1.35 + Math.min( 1, moving ) * 1.5 );
		this.root.position.copy( this.camera.position );
		this.root.quaternion.copy( this.camera.quaternion );
		this.impactT = Math.max( 0, this.impactT - dt );

		const swayX = Math.sin( this.swayT * 1.7 ) * 0.008;
		const swayY = Math.sin( this.swayT * 2.15 + 0.8 ) * 0.006;
		const impactShake = this.impactT > 0 ? Math.sin( this.impactT * 92 ) * 0.012 * ( this.impactT / 0.24 ) : 0;

		if ( this.grabT > 0 ) {

			this.grabT = Math.max( 0, this.grabT - dt );
			const u = 1 - this.grabT / 0.72;
			const reach = Math.sin( Math.min( 1, u ) * Math.PI );
			const close = Math.sin( Math.min( 1, u ) * Math.PI * 2 ) * 0.025;
			this.handL.visible = this.handR.visible = true;
			this.handL.position.set( - 0.17 + close, - 0.2 + swayY, - 0.52 - reach * 0.78 );
			this.handR.position.set( 0.17 - close, - 0.2 + swayY, - 0.52 - reach * 0.78 );
			this.handL.rotation.set( - 0.16, - 0.12, - 0.16 );
			this.handR.rotation.set( - 0.16, 0.12, 0.16 );
			// Drop the gun out of the sight line while both hands reach for the animal.
			this.body.position.set( _rest.x + 0.18, _rest.y - reach * 0.42, _rest.z + reach * 0.12 );
			this.shaft.position.set( _rest.x + 0.18, _rest.y + 0.052 - reach * 0.42, _rest.z + reach * 0.12 );
			return;

		}

		this.handL.visible = this.handR.visible = false;
		this.body.position.set( _rest.x + swayX + impactShake, _rest.y + swayY, _rest.z + this.kick * 0.055 );

		if ( this.shotT > 0 ) {

			this.shotT = Math.max( 0, this.shotT - dt );
			const u = 1 - this.shotT / 0.34;
			// Shaft snaps forward in the first third, hangs at extension briefly, then visually reloads.
			let travel;
			if ( u < 0.28 ) travel = u / 0.28;
			else if ( u < 0.56 ) travel = 1;
			else travel = Math.max( 0, 1 - ( u - 0.56 ) / 0.44 );
			this.shaft.position.set( _rest.x + swayX + impactShake, _rest.y + swayY + 0.052, _rest.z - travel * 1.05 );
			this.kick += ( 0 - this.kick ) * Math.min( 1, dt * 9 );

		} else {

			this.shaft.position.set( _rest.x + swayX + impactShake, _rest.y + swayY + 0.052, _rest.z );
			this.kick += ( 0 - this.kick ) * Math.min( 1, dt * 12 );

		}

	}

}
