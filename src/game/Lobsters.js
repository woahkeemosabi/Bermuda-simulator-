import { Group, Mesh, Vector3 } from '../engine/index.js';
import { WORLD } from '../world/WorldLayout.js';
import { mulberry32 } from '../util/Noise.js';
import { prepare, mergePrepared, sphere, rod, mat4 } from '../world/boat/GeoKit.js';
import { createPropMaterial } from './GameMaterials.js';

// Caribbean spiny lobsters living on the reef and around the pier head.
// They are real world targets rather than menu rolls: each animal has a visible mesh, a CPU
// position on the reef floor, simple bottom-crawling / flee behaviour and a short-range grab test.
// Frame: +Z is the head / antennae, +Y is up. Geometry is built at roughly adult real scale.

const TAU = Math.PI * 2;
const BODY = 0x9a3e24;
const SHELL = 0xb85c32;
const JOINT = 0x6f2e1f;
const CREAM = 0xd9b98d;
const EYE = 0x15100d;

const _dir = new Vector3();

function lobsterGeometry() {

	const parts = [];
	const add = ( g, color, rough = 0.58, matrix = null ) => parts.push( prepare( g, { color, rough, matrix } ) );

	// Carapace and segmented abdomen. The abdomen tapers back toward the tail.
	add( sphere( 0.22, 18, 11 ), BODY, 0.5, mat4( 0, 0.17, 0.08, 0, 0, 0, 1.0, 0.58, 1.45 ) );
	for ( let i = 0; i < 5; i ++ ) {

		const z = - 0.19 - i * 0.105;
		const r = 0.18 - i * 0.014;
		add( sphere( r, 14, 8 ), i % 2 ? BODY : SHELL, 0.56, mat4( 0, 0.14 - i * 0.006, z, 0, 0, 0, 1.0, 0.52, 0.62 ) );

	}

	// Tail fan: five flattened lobes.
	for ( let i = - 2; i <= 2; i ++ ) {

		const x = i * 0.075;
		const z = - 0.73 - Math.abs( i ) * 0.018;
		add( sphere( 0.105, 10, 6 ), SHELL, 0.62, mat4( x, 0.105, z, 0, 0, i * 0.08, 0.72, 0.22, 1.15 ) );

	}

	// Eyes and short eye stalks.
	for ( const s of [ - 1, 1 ] ) {

		add( rod( new Vector3( s * 0.105, 0.22, 0.27 ), new Vector3( s * 0.12, 0.265, 0.36 ), 0.018, 7, 0.014 ), JOINT, 0.55 );
		add( sphere( 0.028, 8, 6 ), EYE, 0.32, mat4( s * 0.122, 0.27, 0.37 ) );

	}

	// The defining long, banded antennae.
	for ( const s of [ - 1, 1 ] ) {

		const a = new Vector3( s * 0.11, 0.22, 0.31 );
		const b = new Vector3( s * 0.24, 0.34, 0.64 );
		const c = new Vector3( s * 0.43, 0.39, 1.08 );
		add( rod( a, b, 0.015, 7, 0.011 ), CREAM, 0.5 );
		add( rod( b, c, 0.011, 7, 0.003 ), JOINT, 0.5 );

	}

	// Five pairs of walking legs. Spiny lobsters do not have the oversized claws of true lobsters.
	for ( const s of [ - 1, 1 ] ) for ( let j = 0; j < 5; j ++ ) {

		const z = 0.2 - j * 0.15;
		const hip = new Vector3( s * 0.16, 0.14, z );
		const knee = new Vector3( s * ( 0.31 + j * 0.012 ), 0.09, z + ( j < 2 ? 0.04 : - 0.015 ) );
		const foot = new Vector3( s * ( 0.42 + j * 0.018 ), 0.015, z + 0.1 );
		add( rod( hip, knee, 0.018 - j * 0.0014, 7, 0.012 ), JOINT, 0.62 );
		add( rod( knee, foot, 0.012, 6, 0.004 ), BODY, 0.68 );

	}

	// Carapace spines, kept large enough to read at gameplay distance.
	for ( const [ x, y, z, dx, dz ] of [
		[ - 0.14, 0.29, 0.1, - 0.08, 0.03 ], [ 0.14, 0.29, 0.1, 0.08, 0.03 ],
		[ - 0.16, 0.25, - 0.02, - 0.08, - 0.01 ], [ 0.16, 0.25, - 0.02, 0.08, - 0.01 ],
		[ - 0.1, 0.3, 0.22, - 0.05, 0.06 ], [ 0.1, 0.3, 0.22, 0.05, 0.06 ],
	] ) add( rod( new Vector3( x, y, z ), new Vector3( x + dx, y + 0.075, z + dz ), 0.012, 6, 0.0015 ), CREAM, 0.5 );

	return mergePrepared( parts );

}

export class Lobsters {

	constructor( { scene, terrain, reef, count = 24, seed = 20260928 } ) {

		this.terrain = terrain;
		this.reef = reef;
		this.rng = mulberry32( seed );
		this.group = new Group();
		this.group.name = 'SpinyLobsters';
		scene.add( this.group );
		this.geometry = lobsterGeometry();
		this.material = createPropMaterial( 'spinyLobster' );
		this.items = [];
		this.time = 0;
		this.place( count );

	}

	floorAt( x, z ) {

		if ( this.reef && this.reef.floorHeightAt ) return this.reef.floorHeightAt( x, z );
		return this.terrain.heightAt( x, z );

	}

	valid( x, z ) {

		const y = this.floorAt( x, z );
		return Number.isFinite( y ) && y < - 1.4 && y > - 15;

	}

	place( count ) {

		const candidates = [];
		// Seed several discoverable animals around the active Bermuda landing/boat dock first,
		// then fill the larger reef population. WORLD.pier is the legacy Tidewater pier and is not
		// where the current mobile player starts.
		const D = WORLD.boatDock?.position || WORLD.spawn.position;
		for ( const [ dx, dz ] of [ [ - 8, 4 ], [ 7, 3 ], [ - 6, 10 ], [ 6, 11 ], [ - 10, 16 ], [ 9, 17 ], [ 0, 22 ] ] ) {

			const x = D.x + dx, z = D.z + dz;
			if ( this.valid( x, z ) ) candidates.push( [ x, z ] );

		}

		const c = this.reef?.center || WORLD.reef.center;
		const R = Math.min( this.reef?.radius || WORLD.reef.radius, 80 );
		for ( let n = 0; n < 600 && candidates.length < count; n ++ ) {

			const a = this.rng() * TAU;
			const r = 12 + Math.sqrt( this.rng() ) * Math.max( 10, R - 12 );
			const x = c.x + Math.cos( a ) * r;
			const z = c.z + Math.sin( a ) * r;
			if ( ! this.valid( x, z ) ) continue;
			if ( candidates.some( ( p ) => Math.hypot( p[ 0 ] - x, p[ 1 ] - z ) < 4.5 ) ) continue;
			candidates.push( [ x, z ] );

		}

		for ( let i = 0; i < Math.min( count, candidates.length ); i ++ ) {

			const [ x, z ] = candidates[ i ];
			const size = 0.82 + this.rng() * 0.34;
			const mesh = new Mesh( this.geometry, this.material );
			mesh.name = `spiny-lobster-${ i }`;
			mesh.scale.setScalar( size );
			this.group.add( mesh );
			const yaw = this.rng() * TAU;
			this.items.push( {
				id: i, mesh, x, z, homeX: x, homeZ: z, yaw, targetYaw: yaw,
				size, bodyCm: Math.round( ( 44 + this.rng() * 18 ) * size ),
				kg: Math.round( ( 0.75 + this.rng() * 2.0 ) * size * 100 ) / 100,
				active: true, respawn: 0, flee: 0, think: this.rng() * 3,
			} );

		}

	}

	update( dt, player, camera ) {

		this.time += dt;
		const viewer = player?.mode === 'swim' ? player.position : camera.position;
		for ( const l of this.items ) {

			if ( ! l.active ) {

				l.respawn -= dt;
				if ( l.respawn <= 0 ) this.restore( l.id );
				continue;

			}

			const d = Math.hypot( viewer.x - l.x, viewer.z - l.z );
			if ( d < 2.7 && player?.mode === 'swim' ) {

				l.flee = 1.4;
				l.targetYaw = Math.atan2( l.x - viewer.x, l.z - viewer.z );

			}

			l.think -= dt;
			if ( l.think <= 0 && l.flee <= 0 ) {

				l.think = 1.8 + this.rng() * 3.5;
				l.targetYaw += ( this.rng() - 0.5 ) * 1.8;

			}

			let da = ( l.targetYaw - l.yaw + Math.PI ) % TAU - Math.PI;
			if ( da < - Math.PI ) da += TAU;
			l.yaw += Math.max( - dt * 2.4, Math.min( dt * 2.4, da ) );
			const speed = l.flee > 0 ? 0.72 : 0.035;
			const nx = l.x + Math.sin( l.yaw ) * speed * dt;
			const nz = l.z + Math.cos( l.yaw ) * speed * dt;
			const homeD = Math.hypot( nx - l.homeX, nz - l.homeZ );
			if ( this.valid( nx, nz ) && homeD < 5.5 ) {

				l.x = nx; l.z = nz;

			} else l.targetYaw += Math.PI * ( 0.65 + this.rng() * 0.7 );
			l.flee = Math.max( 0, l.flee - dt );
			const y = this.floorAt( l.x, l.z );
			l.mesh.position.set( l.x, y + 0.045 * l.size, l.z );
			l.mesh.rotation.set( 0, l.yaw, 0 );
			// No need to draw / submit distant individuals.
			l.mesh.visible = d < 42;

		}

	}

	// Return the lobster currently under the centre reticle, without changing world state.
	target( origin, direction, maxDist = 1.8 ) {

		let best = null, bestT = maxDist + 1;
		for ( const l of this.items ) {

			if ( ! l.active ) continue;
			_dir.set( l.x - origin.x, this.floorAt( l.x, l.z ) + 0.18 * l.size - origin.y, l.z - origin.z );
			const t = _dir.dot( direction );
			if ( t < 0.25 || t > maxDist || t >= bestT ) continue;
			const d2 = _dir.lengthSq() - t * t;
			const r = 0.22 * l.size;
			if ( d2 <= r * r ) { best = l; bestT = t; }

		}
		return best ? { id: best.id, distance: bestT, cm: best.bodyCm, kg: best.kg, position: new Vector3( best.x, this.floorAt( best.x, best.z ) + 0.18 * best.size, best.z ) } : null;

	}

	grab( origin, direction, maxDist = 1.8 ) {

		const hit = this.target( origin, direction, maxDist );
		if ( ! hit ) return null;
		const l = this.items[ hit.id ];
		l.active = false;
		l.respawn = 150 + this.rng() * 90;
		l.mesh.visible = false;
		return hit;

	}

	restore( id ) {

		const l = this.items[ id ];
		if ( ! l ) return;
		l.x = l.homeX; l.z = l.homeZ;
		l.yaw = l.targetYaw = this.rng() * TAU;
		l.flee = 0; l.think = 0;
		l.active = true;
		l.respawn = 0;
		l.mesh.visible = true;

	}

	get activeCount() {

		let n = 0;
		for ( const l of this.items ) if ( l.active ) n ++;
		return n;

	}

}
