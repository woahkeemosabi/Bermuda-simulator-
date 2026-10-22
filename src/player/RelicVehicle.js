import * as THREE from '../engine/index.js';

const _dir = new THREE.Vector3();
const _right = new THREE.Vector3();
const _next = new THREE.Vector3();
const _eye = new THREE.Vector3();
const _target = new THREE.Vector3();
const _orbit = new THREE.Vector3();
const _euler = new THREE.Euler( 0, 0, 0, 'YXZ' );

const MODE = Object.freeze( { ROAD: 'ROAD', HOVER: 'HOVER', AIR: 'AIR', SUB: 'SUB' } );

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
		this.verticalSpeed = 0;
		this.driveMode = MODE.ROAD;
		this.occupied = false;
		this.cameraMode = 'third';
		this.viewYaw = 0;
		this.viewPitch = - 0.08;
		this.cameraReady = false;
		this.bodyCollider = this.colliders?.boxes?.find( b => b.tag === 'relic-001' ) || null;
		this.tires = ( this.group.children || [] ).filter( c => c.name === 'relic-tire' );
		this.rims = ( this.group.children || [] ).filter( c => c.name === 'relic-rim' );
		this.brakes = ( this.group.children || [] ).filter( c => c.name === 'relic-brake-disc' );
		this.liftChambers = ( this.group.children || [] ).filter( c => c.name === 'relic-aerolift-chamber' );
		if ( this.bodyCollider ) this.bodyCollider.solid = true;
		this.syncBodyCollider();
		this.applyModeVisuals( 1 );
		this.group.userData.vehicle = this;
		this.group.userData.relicMode = this.driveMode;

	}

	near( p, radius = 4.2 ) {

		return Math.hypot( this.position.x - p.x, this.position.z - p.z ) < radius;

	}

	groundAt( x, z ) {

		const terrain = this.terrain?.heightAt( x, z ) ?? 0;
		const collider = this.colliders?.groundHeightAt( x, z, 50 ) ?? - Infinity;
		return Math.max( terrain, Number.isFinite( collider ) ? collider : - Infinity );

	}

	seaFloorAt( x, z ) {

		return this.terrain?.heightAt( x, z ) ?? - 20;

	}

	waterSurfaceAt() {

		// Bermuda's ocean mean level is zero; wave motion is deliberately not used as the control
		// reference so hover/submersion transitions do not bob violently with individual wave crests.
		return 0;

	}

	toast( text, ms = 1800 ) {

		this.app.game?.toast?.( text, ms );

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

	setDriveMode( next, announce = true ) {

		if ( next === this.driveMode ) return true;
		const floor = this.seaFloorAt( this.position.x, this.position.z );
		const water = this.waterSurfaceAt();

		if ( next === MODE.SUB && floor > water - 1.8 ) {

			if ( announce ) this.toast( 'SUBMERSION requires deeper water' );
			return false;

		}
		if ( next === MODE.ROAD ) {

			const g = this.groundAt( this.position.x, this.position.z );
			if ( g < water - 0.35 ) {

				if ( announce ) this.toast( 'ROAD mode requires solid ground' );
				return false;

			}
			this.position.y = g + 0.02;
			this.verticalSpeed = 0;

		}
		if ( next === MODE.HOVER ) {

			const support = Math.max( this.groundAt( this.position.x, this.position.z ), water );
			this.position.y = Math.max( this.position.y, support + 0.82 );
			this.verticalSpeed = 0;

		}
		if ( next === MODE.SUB ) {

			this.position.y = THREE.MathUtils.clamp( this.position.y, floor + 1.05, water - 0.72 );
			if ( this.position.y > water - 0.72 ) this.position.y = water - 0.72;
			this.verticalSpeed = - 0.8;

		}

		this.driveMode = next;
		this.group.userData.relicMode = next;
		this.cameraReady = false;
		if ( announce ) {

			const label = next === MODE.SUB ? 'SUBMERSION' : next;
			this.toast( `RELIC · ${ label } MODE`, 1700 );

		}
		return true;

	}

	cycleMode() {

		if ( this.driveMode === MODE.ROAD ) return this.setDriveMode( MODE.HOVER );
		if ( this.driveMode === MODE.HOVER ) {

			const g = this.groundAt( this.position.x, this.position.z );
			if ( g >= this.waterSurfaceAt() - 0.35 ) return this.setDriveMode( MODE.ROAD );
			return this.setDriveMode( MODE.SUB );

		}
		return this.setDriveMode( MODE.HOVER );

	}

	applyModeVisuals( dt ) {

		const vectorMode = this.driveMode !== MODE.ROAD;
		const k = dt >= 1 ? 1 : 1 - Math.exp( - dt * 8.5 );
		const tireX = vectorMode ? Math.PI * 0.5 : 0;
		const tireY = vectorMode ? 0 : Math.PI * 0.5;
		const diskZ = vectorMode ? 0 : Math.PI * 0.5;

		for ( const tire of this.tires ) {

			tire.rotation.x += ( tireX - tire.rotation.x ) * k;
			tire.rotation.y += ( tireY - tire.rotation.y ) * k;
			tire.rotation.z += ( 0 - tire.rotation.z ) * k;

		}
		for ( const disk of [ ...this.rims, ...this.brakes ] ) {

			disk.rotation.x += ( 0 - disk.rotation.x ) * k;
			disk.rotation.y += ( 0 - disk.rotation.y ) * k;
			disk.rotation.z += ( diskZ - disk.rotation.z ) * k;

		}
		for ( const chamber of this.liftChambers ) {

			const pulse = vectorMode ? 1.0 + Math.sin( performance?.now?.() * 0.008 || 0 ) * 0.045 : 1;
			chamber.scale.y += ( ( vectorMode ? 0.075 : 0.050 ) - chamber.scale.y ) * k;
			chamber.scale.x = chamber.scale.z = 0.28 * pulse;

		}

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
		this.verticalSpeed = 0;
		this.cameraReady = false;
		this.syncBodyCollider();
		if ( this.bodyCollider ) this.bodyCollider.solid = false;
		this.toast( 'RELIC online · MODE toggles road / hover · RISE enters flight', 3000 );
		return true;

	}

	exit( player ) {

		if ( ! this.occupied ) return false;
		const g = this.groundAt( this.position.x, this.position.z );
		if ( this.driveMode === MODE.AIR || this.driveMode === MODE.SUB || g < this.waterSurfaceAt() - 0.35 || this.position.y - g > 1.6 ) {

			this.toast( 'Return RELIC to the road or a safe hover before exiting', 2200 );
			return false;

		}
		if ( this.driveMode !== MODE.ROAD ) this.setDriveMode( MODE.ROAD, false );
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
		this.verticalSpeed = 0;
		this.cameraReady = false;
		this.syncBodyCollider();
		if ( this.bodyCollider ) this.bodyCollider.solid = true;
		return true;

	}

	update( dt, player ) {

		const inp = player.input;
		const look = inp.consumeLook();
		this.viewYaw = THREE.MathUtils.clamp( this.viewYaw - look.x * 0.0025, - 1.35, 1.35 );
		this.viewPitch = THREE.MathUtils.clamp( this.viewPitch - look.y * 0.0022, - 0.55, 0.55 );
		if ( this.cameraMode === 'third' && Math.abs( look.x ) < 0.05 && Math.abs( this.speed ) > 1.5 ) this.viewYaw *= Math.exp( - dt * 1.45 );

		if ( inp.hit( 'KeyV' ) ) {

			this.cameraMode = this.cameraMode === 'first' ? 'third' : 'first';
			this.viewYaw = 0;
			this.viewPitch = this.cameraMode === 'first' ? - 0.04 : - 0.08;
			this.cameraReady = false;

		}
		if ( inp.hit( 'KeyG' ) ) this.cycleMode();
		if ( inp.hit( 'KeyE' ) ) {

			this.exit( player );
			return;

		}

		const forward = inp.down( 'KeyW' );
		const reverse = inp.down( 'KeyS' );
		const fast = inp.down( 'ShiftLeft' ) || inp.down( 'ShiftRight' );
		const rise = inp.down( 'Space' );
		const descend = inp.down( 'KeyC' ) || inp.down( 'ControlLeft' );

		if ( this.driveMode === MODE.HOVER && rise ) this.setDriveMode( MODE.AIR );
		if ( this.driveMode === MODE.HOVER && descend ) this.setDriveMode( MODE.SUB );

		const modeSpeed = this.driveMode === MODE.ROAD ? ( fast ? 24 : 13 ) :
			this.driveMode === MODE.HOVER ? ( fast ? 30 : 18 ) :
			this.driveMode === MODE.AIR ? ( fast ? 42 : 26 ) : ( fast ? 20 : 12 );
		const reverseSpeed = this.driveMode === MODE.SUB ? - 6 : - 7;
		const target = forward ? modeSpeed : reverse ? reverseSpeed : 0;
		const accel = target === 0 ? 4.2 : ( Math.sign( target ) !== Math.sign( this.speed || target ) ? 5.2 : 2.5 );
		this.speed += ( target - this.speed ) * ( 1 - Math.exp( - dt * accel ) );

		let steer = 0;
		if ( inp.down( 'KeyA' ) ) steer += 1;
		if ( inp.down( 'KeyD' ) ) steer -= 1;
		this.steer += ( steer - this.steer ) * ( 1 - Math.exp( - dt * 8 ) );
		const speedAbs = Math.abs( this.speed );
		const maxRef = this.driveMode === MODE.AIR ? 42 : this.driveMode === MODE.HOVER ? 30 : 24;
		const steerGain = THREE.MathUtils.lerp( 0.80, 0.30, THREE.MathUtils.clamp( speedAbs / maxRef, 0, 1 ) );
		this.yaw += this.steer * steerGain * dt * Math.sign( this.speed || 1 );

		_dir.set( Math.sin( this.yaw ), 0, Math.cos( this.yaw ) );
		_next.copy( this.position ).addScaledVector( _dir, this.speed * dt );
		const water = this.waterSurfaceAt();
		const floor = this.seaFloorAt( _next.x, _next.z );

		if ( this.driveMode === MODE.ROAD ) {

			const desiredX = _next.x, desiredZ = _next.z;
			const hit = this.colliders?.resolveCapsule ? this.colliders.resolveCapsule( _next, 1.08, 1.55, 0.18 ) : false;
			if ( hit && Math.hypot( _next.x - desiredX, _next.z - desiredZ ) > 0.02 ) this.speed *= 0.32;
			_next.y = this.groundAt( _next.x, _next.z ) + 0.02;
			this.verticalSpeed = 0;

		} else if ( this.driveMode === MODE.HOVER ) {

			const support = Math.max( this.groundAt( _next.x, _next.z ), water );
			const targetY = support + 0.82;
			_next.y = this.position.y + ( targetY - this.position.y ) * ( 1 - Math.exp( - dt * 7 ) );
			this.verticalSpeed = 0;

		} else if ( this.driveMode === MODE.AIR ) {

			const verticalTarget = rise ? ( fast ? 11 : 7 ) : descend ? - ( fast ? 11 : 7 ) : 0;
			this.verticalSpeed += ( verticalTarget - this.verticalSpeed ) * ( 1 - Math.exp( - dt * 4.5 ) );
			_next.y += this.verticalSpeed * dt;
			const minAir = Math.max( this.groundAt( _next.x, _next.z ) + 0.72, floor < water - 1.8 ? water + 0.45 : - Infinity );
			_next.y = THREE.MathUtils.clamp( _next.y, minAir, 90 );
			if ( descend && floor < water - 1.8 && _next.y <= water + 0.55 ) {

				this.position.copy( _next );
				this.setDriveMode( MODE.SUB );
				_next.copy( this.position );

			}

		} else {

			if ( floor > water - 1.8 ) {

				this.setDriveMode( MODE.HOVER );
				_next.y = Math.max( this.groundAt( _next.x, _next.z ), water ) + 0.82;

			} else {

				const verticalTarget = rise ? ( fast ? 6 : 3.8 ) : descend ? - ( fast ? 6 : 3.8 ) : 0;
				this.verticalSpeed += ( verticalTarget - this.verticalSpeed ) * ( 1 - Math.exp( - dt * 4.5 ) );
				_next.y += this.verticalSpeed * dt;
				_next.y = THREE.MathUtils.clamp( _next.y, floor + 1.05, water - 0.72 );
				if ( rise && _next.y >= water - 0.78 ) {

					this.position.copy( _next );
					this.setDriveMode( MODE.HOVER );
					_next.copy( this.position );

				}

			}

		}

		this.position.copy( _next );
		const vectorMode = this.driveMode !== MODE.ROAD;
		const bankTarget = vectorMode ? THREE.MathUtils.clamp( - this.steer * ( 0.08 + speedAbs * 0.003 ), -0.22, 0.22 ) : 0;
		const pitchTarget = this.driveMode === MODE.AIR ? THREE.MathUtils.clamp( - this.verticalSpeed * 0.012, -0.13, 0.13 ) : 0;
		this.group.rotation.y = this.yaw;
		this.group.rotation.z += ( bankTarget - this.group.rotation.z ) * ( 1 - Math.exp( - dt * 5 ) );
		this.group.rotation.x += ( pitchTarget - this.group.rotation.x ) * ( 1 - Math.exp( - dt * 5 ) );
		this.group.userData.speed = this.speed;
		this.group.userData.relicMode = this.driveMode;
		this.applyModeVisuals( dt );
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

			_eye.set( p.x + _dir.x * 0.24 - _right.x * 0.18, p.y + 1.32, p.z + _dir.z * 0.24 - _right.z * 0.18 );
			camera.position.copy( _eye );
			player.yaw = this.yaw + Math.PI + this.viewYaw;
			player.pitch = this.viewPitch;
			camera.quaternion.setFromEuler( _euler.set( this.viewPitch, player.yaw, 0 ) );

		} else {

			const orbitYaw = this.yaw + this.viewYaw;
			_orbit.set( Math.sin( orbitYaw ), 0, Math.cos( orbitYaw ) );
			const speedAbs = Math.abs( this.speed );
			const modeExtra = this.driveMode === MODE.AIR ? 2.4 : this.driveMode === MODE.SUB ? 1.2 : 0;
			const dist = 7.2 + modeExtra + Math.min( 5.0, speedAbs * 0.16 );
			const height = 2.65 + ( this.driveMode === MODE.AIR ? 1.1 : 0 ) + Math.min( 1.0, speedAbs * 0.03 ) + this.viewPitch * 2.2;
			_eye.set( p.x - _orbit.x * dist, p.y + height, p.z - _orbit.z * dist );
			_target.set( p.x + _dir.x * ( 1.5 + speedAbs * 0.08 ), p.y + ( this.driveMode === MODE.SUB ? 0.55 : 0.95 ), p.z + _dir.z * ( 1.5 + speedAbs * 0.08 ) );

			if ( this.driveMode === MODE.ROAD || this.driveMode === MODE.HOVER ) {

				const ray = _eye.clone().sub( _target );
				const rayDist = ray.length();
				if ( rayDist > 0.1 && this.colliders?.raycast ) {

					ray.multiplyScalar( 1 / rayDist );
					const clear = this.colliders.raycast( _target, ray, rayDist );
					if ( clear < rayDist ) _eye.copy( _target ).addScaledVector( ray, Math.max( 1.8, clear - 0.35 ) );

				}

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

export { MODE as RELIC_MODES };
