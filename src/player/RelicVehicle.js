import * as THREE from '../engine/index.js';

const _dir = new THREE.Vector3();
const _right = new THREE.Vector3();
const _next = new THREE.Vector3();
const _eye = new THREE.Vector3();
const _target = new THREE.Vector3();
const _orbit = new THREE.Vector3();
const _euler = new THREE.Euler( 0, 0, 0, 'YXZ' );

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
		this.viewYaw = 0;
		this.viewPitch = - 0.08;
		this.cameraReady = false;
		this.bodyCollider = this.colliders?.boxes?.find( b => b.tag === 'relic-001' ) || null;
		if ( this.bodyCollider ) this.bodyCollider.solid = true;
		this.syncBodyCollider();
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

	syncBodyCollider() {

		const b = this.bodyCollider;
		if ( ! b ) return;
		b.center.set( this.position.x, this.position.y + 0.76, this.position.z );
		b.rotY = this.yaw;
		b.cos = Math.cos( this.yaw );
		b.sin = Math.sin( this.yaw );
		b.top = b.center.y + b.half.y;
		b.bottom = b.center.y - b.half.y;

	}

	enter( player ) {

		if ( this.occupied ) return false;
		this.occupied = true;
		this.player = player;
		player.mode = 'relic';
		player.velocity.set( 0, 0, 0 );
		this.viewYaw = 0;
		this.viewPitch = - 0.08;
		player.yaw = this.yaw + Math.PI;
		player.pitch = this.viewPitch;
		this.speed = 0;
		this.cameraReady = false;
		this.syncBodyCollider();
		if ( this.bodyCollider ) this.bodyCollider.solid = false;
		return true;

	}

	exit( player ) {

		if ( ! this.occupied ) return false;
		_dir.set( Math.sin( this.yaw ), 0, Math.cos( this.yaw ) );
		_right.set( Math.cos( this.yaw ), 0, - Math.sin( this.yaw ) );
		const x = this.position.x + _right.x * 2.45, z = this.position.z + _right.z * 2.45;
		player.position.set( x, this.groundAt( x, z ), z );
		player.mode = 'walk';
		player.grounded = true;
		player.velocity.set( 0, 0, 0 );
		player.yaw = this.yaw + Math.PI;
		player.pitch = - 0.05;
		player._camY = null;
		this.occupied = false;
		this.player = null;
		this.speed = 0;
		this.cameraReady = false;
		this.syncBodyCollider();
		if ( this.bodyCollider ) this.bodyCollider.solid = true;
		return true;

	}

	update( dt, player ) {

		const inp = player.input;
		const look = inp.consumeLook();
		this.viewYaw = THREE.MathUtils.clamp( this.viewYaw - look.x * 0.0025, - 1.35, 1.35 );
		this.viewPitch = THREE.MathUtils.clamp( this.viewPitch - look.y * 0.0022, - 0.42, 0.48 );
		if ( this.cameraMode === 'third' && Math.abs( look.x ) < 0.05 && Math.abs( this.speed ) > 1.5 ) {

			this.viewYaw *= Math.exp( - dt * 1.45 );

		}
		if ( inp.hit( 'KeyV' ) ) {

			this.cameraMode = this.cameraMode === 'first' ? 'third' : 'first';
			this.viewYaw = 0;
			this.viewPitch = this.cameraMode === 'first' ? - 0.04 : - 0.08;
			this.cameraReady = false;

		}
		if ( inp.hit( 'KeyE' ) ) {

			this.exit( player );
			return;

		}

		const forward = inp.down( 'KeyW' );
		const reverse = inp.down( 'KeyS' );
		const fast = inp.down( 'ShiftLeft' ) || inp.down( 'ShiftRight' );
		// RELIC should read like the hero hypercar rather than a slow utility cart. Keep normal road
		// speed controllable, with RUN/Shift opening a faster pursuit pace.
		const target = forward ? ( fast ? 24 : 13 ) : reverse ? - 5.5 : 0;
		const accel = target === 0 ? 4.2 : ( Math.sign( target ) !== Math.sign( this.speed || target ) ? 5.2 : 2.2 );
		this.speed += ( target - this.speed ) * ( 1 - Math.exp( - dt * accel ) );
		let steer = 0;
		if ( inp.down( 'KeyA' ) ) steer += 1;
		if ( inp.down( 'KeyD' ) ) steer -= 1;
		this.steer += ( steer - this.steer ) * ( 1 - Math.exp( - dt * 8 ) );
		const speedAbs = Math.abs( this.speed );
		const steerGain = THREE.MathUtils.lerp( 0.72, 0.34, THREE.MathUtils.clamp( speedAbs / 24, 0, 1 ) );
		const turn = this.steer * steerGain * dt * Math.sign( this.speed || 1 );
		this.yaw += turn;

		_dir.set( Math.sin( this.yaw ), 0, Math.cos( this.yaw ) );
		_next.copy( this.position ).addScaledVector( _dir, this.speed * dt );
		const desiredX = _next.x, desiredZ = _next.z;
		const hit = this.colliders?.resolveCapsule ? this.colliders.resolveCapsule( _next, 1.08, 1.55, 0.18 ) : false;
		if ( hit && Math.hypot( _next.x - desiredX, _next.z - desiredZ ) > 0.02 ) this.speed *= 0.32;
		_next.y = this.groundAt( _next.x, _next.z ) + 0.02;
		this.position.copy( _next );
		this.group.rotation.y = this.yaw;
		this.group.userData.speed = this.speed;
		this.syncBodyCollider();

		player.position.set( this.position.x, this.position.y, this.position.z );
		this.updateCamera( player, dt );

	}

	updateCamera( player, dt ) {

		const camera = player.camera;
		const p = this.position;
		_dir.set( Math.sin( this.yaw ), 0, Math.cos( this.yaw ) );
		_right.set( Math.cos( this.yaw ), 0, - Math.sin( this.yaw ) );

		if ( this.cameraMode === 'first' ) {

			// Driver-eye position beneath the smoked canopy. Orientation is relative to the CAR heading,
			// so turning the vehicle no longer leaves the cockpit camera facing the old road direction.
			_eye.set( p.x + _dir.x * 0.24 - _right.x * 0.18, p.y + 1.32, p.z + _dir.z * 0.24 - _right.z * 0.18 );
			camera.position.copy( _eye );
			player.yaw = this.yaw + Math.PI + this.viewYaw;
			player.pitch = this.viewPitch;
			camera.quaternion.setFromEuler( _euler.set( this.viewPitch, player.yaw, 0 ) );

		} else {

			// Speed-sensitive chase framing: further/lower at road speed, with a small look-ahead so the
			// player sees where the car is going rather than staring at the rear bumper.
			const orbitYaw = this.yaw + this.viewYaw;
			_orbit.set( Math.sin( orbitYaw ), 0, Math.cos( orbitYaw ) );
			const speedAbs = Math.abs( this.speed );
			const dist = 7.2 + Math.min( 4.2, speedAbs * 0.18 );
			const height = 2.65 + Math.min( 0.85, speedAbs * 0.035 ) + this.viewPitch * 2.2;
			_eye.set( p.x - _orbit.x * dist, p.y + height, p.z - _orbit.z * dist );
			_target.set( p.x + _dir.x * ( 1.5 + speedAbs * 0.08 ), p.y + 0.95, p.z + _dir.z * ( 1.5 + speedAbs * 0.08 ) );

			// Do not let the chase camera sit behind a wall/prop. Pull it toward the target when a solid
			// collider blocks the line of sight.
			const ray = _eye.clone().sub( _target );
			const rayDist = ray.length();
			if ( rayDist > 0.1 && this.colliders?.raycast ) {

				ray.multiplyScalar( 1 / rayDist );
				const clear = this.colliders.raycast( _target, ray, rayDist );
				if ( clear < rayDist ) _eye.copy( _target ).addScaledVector( ray, Math.max( 1.8, clear - 0.35 ) );

			}

			if ( ! this.cameraReady ) {

				camera.position.copy( _eye );
				this.cameraReady = true;

			} else camera.position.lerp( _eye, 1 - Math.exp( - dt * 7.5 ) );
			camera.lookAt( _target );
			player.yaw = this.yaw + Math.PI + this.viewYaw;
			player.pitch = this.viewPitch;

		}

	}

}
