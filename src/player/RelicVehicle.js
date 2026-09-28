import * as THREE from '../engine/index.js';

const _dir = new THREE.Vector3();
const _right = new THREE.Vector3();
const _next = new THREE.Vector3();
const _eye = new THREE.Vector3();

export class RelicVehicle {

	constructor( { app, vehicle } ) {

		this.app = app;
		this.vehicle = vehicle;
		this.group = vehicle.group;
		this.terrain = app.terrainData;
		this.colliders = app.colliders;
		this.position = this.group.position;
		this.yaw = this.group.rotation.y;
		this.speed = 0;
		this.steer = 0;
		this.occupied = false;
		this.cameraMode = 'third';
		this.bodyCollider = this.colliders?.boxes?.find( b => b.tag === 'relic-001' ) || null;
		if ( this.bodyCollider ) this.bodyCollider.solid = true;
		this.group.userData.vehicle = this;

	}

	near( p, radius = 4.2 ) {

		return Math.hypot( this.position.x - p.x, this.position.z - p.z ) < radius;

	}

	groundAt( x, z ) {

		const terrain = this.terrain?.heightAt( x, z ) ?? 0;
		const collider = this.colliders?.groundHeightAt( x, z, 50 ) ?? - Infinity;
		return Math.max( terrain, Number.isFinite( collider ) ? collider : - Infinity );

	}

	enter( player ) {

		if ( this.occupied ) return false;
		this.occupied = true;
		this.player = player;
		player.mode = 'relic';
		player.velocity.set( 0, 0, 0 );
		player.yaw = this.yaw + Math.PI;
		player.pitch = - 0.04;
		this.speed = 0;
		if ( this.bodyCollider ) this.bodyCollider.solid = false;
		return true;

	}

	exit( player ) {

		if ( ! this.occupied ) return false;
		_dir.set( Math.sin( this.yaw ), 0, Math.cos( this.yaw ) );
		_right.set( Math.cos( this.yaw ), 0, -Math.sin( this.yaw ) );
		const x = this.position.x + _right.x * 2.45, z = this.position.z + _right.z * 2.45;
		player.position.set( x, this.groundAt( x, z ), z );
		player.mode = 'walk';
		player.grounded = true;
		player.velocity.set( 0, 0, 0 );
		player.yaw = this.yaw + Math.PI;
		player._camY = null;
		this.occupied = false;
		this.player = null;
		this.speed = 0;
		if ( this.bodyCollider ) this.bodyCollider.solid = true;
		return true;

	}

	update( dt, player ) {

		const inp = player.input;
		const look = inp.consumeLook();
		player.yaw -= look.x * 0.0022;
		player.pitch = THREE.MathUtils.clamp( player.pitch - look.y * 0.0022, - 1.2, 0.8 );
		if ( inp.hit( 'KeyV' ) ) this.cameraMode = this.cameraMode === 'first' ? 'third' : 'first';
		if ( inp.hit( 'KeyE' ) ) {

			this.exit( player );
			return;

		}

		const forward = inp.down( 'KeyW' );
		const reverse = inp.down( 'KeyS' );
		const target = forward ? ( inp.down( 'ShiftLeft' ) || inp.down( 'ShiftRight' ) ? 11 : 7 ) : reverse ? - 3.5 : 0;
		const accel = target === 0 ? 3.4 : 1.8;
		this.speed += ( target - this.speed ) * ( 1 - Math.exp( -dt * accel ) );
		let steer = 0;
		if ( inp.down( 'KeyA' ) ) steer += 1;
		if ( inp.down( 'KeyD' ) ) steer -= 1;
		this.steer += ( steer - this.steer ) * ( 1 - Math.exp( -dt * 8 ) );
		const turn = this.steer * ( 0.24 + Math.min( 0.72, Math.abs( this.speed ) * 0.075 ) ) * dt * Math.sign( this.speed || 1 );
		this.yaw += turn;

		_dir.set( Math.sin( this.yaw ), 0, Math.cos( this.yaw ) );
		_next.copy( this.position ).addScaledVector( _dir, this.speed * dt );
		if ( this.colliders?.resolveCapsule ) this.colliders.resolveCapsule( _next, 1.08, 1.55, 0.18 );
		_next.y = this.groundAt( _next.x, _next.z ) + 0.02;
		this.position.copy( _next );
		this.group.rotation.y = this.yaw;
		this.group.userData.speed = this.speed;

		player.position.set( this.position.x, this.position.y, this.position.z );
		this.updateCamera( player );

	}

	updateCamera( player ) {

		const camera = player.camera;
		const p = this.position;
		_dir.set( Math.sin( this.yaw ), 0, Math.cos( this.yaw ) );
		if ( this.cameraMode === 'first' ) {

			_eye.set( p.x + _dir.x * 0.18, p.y + 1.48, p.z + _dir.z * 0.18 );
			camera.position.copy( _eye );

		} else {

			_eye.set( p.x - _dir.x * 7.8, p.y + 3.0, p.z - _dir.z * 7.8 );
			camera.position.lerp( _eye, 1 - Math.exp( - 7 * 1 / 60 ) );

		}
		camera.quaternion.setFromEuler( new THREE.Euler( player.pitch, player.yaw, 0, 'YXZ' ) );

	}

}
