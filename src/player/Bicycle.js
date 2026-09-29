import { Group, Mesh, Vector3 } from '../engine/index.js';
import { prepare, mergePrepared, box, cylinder, torus, rod, mat4 } from '../world/boat/GeoKit.js';
import { createPropMaterial, PAT } from '../game/GameMaterials.js';

const UP = new Vector3( 0, 1, 0 );
const TMP = new Vector3();
const TARGET = new Vector3();
const CAM = new Vector3();

function buildBicycleGeometry() {
	const P = [];
	const add = ( g, o ) => P.push( prepare( g, o ) );
	const V = ( x, y, z ) => new Vector3( x, y, z );
	const dark = { color: 0x182326, rough: 0.48, metal: 0.78 };
	const frame = { color: 0x274e58, rough: 0.34, metal: 0.84 };
	const rubber = { color: 0x111515, rough: 0.92, pattern: PAT.rusty };
	const chrome = { color: 0xaebfc2, rough: 0.2, metal: 1 };

	// +Z is forward. Wheels are deliberately dense enough to read as a real bicycle at gameplay range.
	for ( const z of [ - 0.57, 0.57 ] ) {
		add( torus( 0.34, 0.035, 8, 24 ), { ...rubber, matrix: mat4( 0, 0.36, z, 0, Math.PI / 2, 0 ) } );
		add( cylinder( 0.045, 0.045, 0.06, 12 ), { ...chrome, matrix: mat4( 0, 0.36, z, 0, 0, Math.PI / 2 ) } );
		for ( let i = 0; i < 8; i ++ ) {
			const a = i / 8 * Math.PI * 2;
			add( rod( V( 0, 0.36, z ), V( 0, 0.36 + Math.sin( a ) * 0.29, z + Math.cos( a ) * 0.29 ), 0.004, 5 ), chrome );
		}
	}

	// Diamond frame + fork.
	const rear = V( 0, 0.36, - 0.57 ), crank = V( 0, 0.35, - 0.05 ), seat = V( 0, 0.82, - 0.2 );
	const headLow = V( 0, 0.48, 0.4 ), headHigh = V( 0, 0.82, 0.34 ), front = V( 0, 0.36, 0.57 );
	for ( const [ a, b ] of [ [ rear, crank ], [ rear, seat ], [ crank, seat ], [ crank, headLow ], [ seat, headHigh ], [ headLow, headHigh ] ] ) add( rod( a, b, 0.027, 8 ), frame );
	add( rod( headLow, front, 0.022, 8 ), chrome );
	add( rod( headHigh, front, 0.022, 8 ), chrome );

	// Seat, stem, handlebar, crank and pedals.
	add( box( 0.18, 0.055, 0.29 ), { ...dark, matrix: mat4( 0, 0.88, - 0.23, 0, 0, 0.06 ) } );
	add( rod( V( 0, 0.8, - 0.2 ), V( 0, 0.94, - 0.2 ), 0.018, 7 ), chrome );
	add( rod( headHigh, V( 0, 0.98, 0.34 ), 0.018, 7 ), chrome );
	add( rod( V( - 0.23, 0.98, 0.34 ), V( 0.23, 0.98, 0.34 ), 0.016, 7 ), dark );
	add( cylinder( 0.085, 0.085, 0.035, 18 ), { ...chrome, matrix: mat4( 0, 0.35, - 0.05, 0, 0, Math.PI / 2 ) } );
	add( rod( V( - 0.15, 0.35, - 0.05 ), V( 0.15, 0.35, - 0.05 ), 0.012, 6 ), dark );
	for ( const x of [ - 0.19, 0.19 ] ) add( box( 0.11, 0.018, 0.055 ), { ...dark, matrix: mat4( x, 0.35, - 0.05 ) } );

	// Small rear rack and reflector; starter-bike utility rather than racing-bike fantasy.
	add( box( 0.28, 0.025, 0.38 ), { ...chrome, matrix: mat4( 0, 0.73, - 0.54 ) } );
	add( box( 0.09, 0.07, 0.025 ), { color: 0xd63a2d, rough: 0.3, matrix: mat4( 0, 0.69, - 0.75 ) } );
	return mergePrepared( P );
}

export class Bicycle {
	constructor( app ) {
		this.app = app;
		this.player = app.player;
		this.input = app.input;
		this.state = app.game?.state;
		this.group = new Group();
		this.group.name = 'StarterBicycle';
		const mat = createPropMaterial( 'starterBicycle' );
		const mesh = new Mesh( buildBicycleGeometry(), mat );
		mesh.castShadow = true;
		mesh.receiveShadow = true;
		this.group.add( mesh );
		app.scene.add( this.group );

		this.speed = 0;
		this.yaw = this.player.yaw || 0;
		this.orbitYaw = 0;
		this.orbitPitch = 0.26;
		this.orbitDist = 5.2;
		this.riding = false;
		this._wasE = false;

		const parked = this.state?.vehicles?.bicycle?.parked;
		if ( parked && Number.isFinite( parked.x ) && Number.isFinite( parked.z ) ) {
			this.group.position.set( parked.x, parked.y || 0, parked.z );
			this.yaw = Number.isFinite( parked.yaw ) ? parked.yaw : this.yaw;
		} else {
			// Starter bike sits beside the player's starting residence, not on the main walking line.
			this.group.position.copy( this.player.position );
			const right = TMP.set( Math.cos( this.player.yaw ), 0, - Math.sin( this.player.yaw ) );
			this.group.position.addScaledVector( right, 1.65 );
			this.group.position.z -= 0.65;
		}
		this.snapToGround();
		this.group.rotation.y = this.yaw;

		this.originalUpdate = this.player.update.bind( this.player );
		this.player.update = ( dt ) => this.updatePlayer( dt );
		app.bicycle = this;
	}

	owned() { return !! this.state?.vehicles?.bicycle?.owned; }

	distanceToPlayer() {
		const p = this.player.position, b = this.group.position;
		return Math.hypot( p.x - b.x, p.z - b.z );
	}

	snapToGround() {
		const p = this.group.position;
		let y = this.app.terrainData?.heightAt?.( p.x, p.z ) ?? p.y;
		if ( this.app.colliders?.groundHeightAt ) y = Math.max( y, this.app.colliders.groundHeightAt( p.x, p.z, p.y + 5 ) );
		p.y = Number.isFinite( y ) ? y + 0.02 : p.y;
	}

	updatePlayer( dt ) {
		const p = this.player;
		if ( this.riding || p.mode === 'bike' ) {
			this.riding = true;
			p.mode = 'bike';
			this.updateRide( dt );
			return;
		}

		this.originalUpdate( dt );
		if ( ! this.owned() || p.mode !== 'walk' || p.busy ) return;
		if ( this.distanceToPlayer() < 1.7 ) {
			p.prompt = { key: 'E', text: 'Ride bicycle' };
			if ( this.input.hit( 'KeyE' ) ) this.mount();
		}
	}

	mount() {
		if ( ! this.owned() ) return false;
		this.riding = true;
		this.player.mode = 'bike';
		this.player.velocity.set( 0, 0, 0 );
		this.speed = 0;
		this.orbitYaw = 0;
		this.player.position.copy( this.group.position );
		return true;
	}

	dismount() {
		const p = this.player;
		this.riding = false;
		p.mode = 'walk';
		p.velocity.set( 0, 0, 0 );
		const side = TMP.set( Math.cos( this.yaw ), 0, - Math.sin( this.yaw ) );
		p.position.copy( this.group.position ).addScaledVector( side, 0.85 );
		let y = this.app.terrainData?.heightAt?.( p.position.x, p.position.z ) ?? p.position.y;
		if ( this.app.colliders?.groundHeightAt ) y = Math.max( y, this.app.colliders.groundHeightAt( p.position.x, p.position.z, p.position.y + 4 ) );
		p.position.y = y;
		p.yaw = this.yaw;
		this.persistParking();
	}

	persistParking() {
		if ( ! this.state?.vehicles?.bicycle ) return;
		const b = this.group.position;
		this.state.vehicles.bicycle.parked = { x: b.x, y: b.y, z: b.z, yaw: this.yaw };
		this.state.save();
		this.state.emit();
	}

	updateRide( dt ) {
		const inp = this.input, p = this.player;
		const look = inp.consumeLook();
		this.orbitYaw -= look.x * 0.0022;
		this.orbitPitch = Math.max( - 0.08, Math.min( 0.72, this.orbitPitch - look.y * 0.0022 ) );

		const pedaling = inp.down( 'KeyW' );
		const braking = inp.down( 'KeyS' );
		const sprint = inp.down( 'ShiftLeft' ) || inp.down( 'ShiftRight' );
		const targetMax = sprint ? 9.2 : 6.2;
		if ( pedaling ) this.speed += ( targetMax - this.speed ) * ( 1 - Math.exp( - dt * 2.25 ) );
		else this.speed *= Math.exp( - dt * 0.85 );
		if ( braking ) {
			if ( this.speed > 0.35 ) this.speed = Math.max( 0, this.speed - dt * 8.5 );
			else this.speed = Math.max( - 1.6, this.speed - dt * 1.8 );
		}
		if ( Math.abs( this.speed ) < 0.025 ) this.speed = 0;

		const steer = ( inp.down( 'KeyA' ) ? 1 : 0 ) - ( inp.down( 'KeyD' ) ? 1 : 0 );
		const turnAuthority = Math.min( 1, Math.abs( this.speed ) / 2.0 );
		this.yaw += steer * dt * 1.35 * turnAuthority * ( this.speed >= 0 ? 1 : - 1 );

		const forward = TMP.set( - Math.sin( this.yaw ), 0, - Math.cos( this.yaw ) );
		const next = this.group.position.clone().addScaledVector( forward, this.speed * dt );
		if ( this.app.colliders?.resolveCapsule ) this.app.colliders.resolveCapsule( next, 0.38, 1.15, 0.26 );
		this.group.position.copy( next );
		this.snapToGround();
		this.group.rotation.y = this.yaw;

		p.position.copy( this.group.position );
		p.yaw = this.yaw;
		p.velocity.copy( forward ).multiplyScalar( this.speed );
		p.prompt = { key: 'E', text: 'Dismount bicycle' };
		if ( inp.hit( 'KeyE' ) ) { this.dismount(); return; }

		// Stable third-person bicycle camera. Mouse/right-thumb orbit is explicit and independent of steering.
		TARGET.copy( this.group.position ); TARGET.y += 1.05;
		const viewYaw = this.yaw + this.orbitYaw;
		const cp = Math.cos( this.orbitPitch ), sp = Math.sin( this.orbitPitch );
		CAM.set(
			TARGET.x + Math.sin( viewYaw ) * this.orbitDist * cp,
			TARGET.y + 1.2 + sp * this.orbitDist,
			TARGET.z + Math.cos( viewYaw ) * this.orbitDist * cp,
		);
		const alpha = 1 - Math.exp( - dt * 8 );
		p.camera.position.lerp( CAM, alpha );
		p.camera.lookAt( TARGET );
	}
}
