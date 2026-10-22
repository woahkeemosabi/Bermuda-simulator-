import { Mesh, Vector3 } from '../engine/index.js';
import { WORLD } from './WorldLayout.js';
import { prepare, mergePrepared, sphere, rod, mat4 } from './boat/GeoKit.js';

const TAU = Math.PI * 2;
const BODY = 0x6a3525;
const SHELL = 0xa65a32;
const DARK = 0x2f211b;
const CREAM = 0xe2c78f;
const SPOT = 0xf0dfb4;

function improvedLobsterGeometry() {
	const parts = [];
	const add = ( geo, color, rough = 0.58, matrix = null ) => parts.push( prepare( geo, { color, rough, matrix } ) );

	// Broad spiny carapace and a visibly segmented abdomen. Geometry is shared by every animal.
	add( sphere( 0.235, 22, 12 ), BODY, 0.48, mat4( 0, 0.155, 0.08, 0, 0, 0, 1.08, 0.50, 1.25 ) );
	for ( let i = 0; i < 5; i ++ ) {
		const z = -0.15 - i * 0.115, r = 0.175 - i * 0.016;
		add( sphere( r, 16, 8 ), i % 2 ? BODY : SHELL, 0.56, mat4( 0, 0.12 - i * 0.003, z, 0, 0, 0, 1.06, 0.42, 0.72 ) );
	}

	// Five-lobed tail fan.
	for ( let i = -2; i <= 2; i ++ ) {
		add( sphere( 0.11, 10, 6 ), SHELL, 0.62,
			mat4( i * 0.078, 0.095, -0.76 - Math.abs( i ) * 0.018, 0, 0, i * 0.08, 0.75, 0.20, 1.18 ) );
	}

	// Banded antennae are the key Caribbean-spiny-lobster silhouette cue.
	for ( const s of [ -1, 1 ] ) {
		let a = new Vector3( s * 0.11, 0.23, 0.31 );
		for ( let k = 0; k < 5; k ++ ) {
			const t0 = k / 5, t1 = ( k + 1 ) / 5;
			const b = new Vector3(
				s * ( 0.11 + 0.38 * t1 ),
				0.23 + 0.18 * Math.sin( t1 * Math.PI * 0.72 ),
				0.31 + 0.87 * t1
			);
			add( rod( a, b, 0.014 - k * 0.0015, 7, 0.011 - k * 0.0014 ), k % 2 ? DARK : CREAM, 0.52 );
			a = b;
		}
	}

	// Eye stalks / eyes.
	for ( const s of [ -1, 1 ] ) {
		add( rod( new Vector3( s * 0.105, 0.22, 0.27 ), new Vector3( s * 0.122, 0.27, 0.37 ), 0.018, 7, 0.012 ), DARK, 0.58 );
		add( sphere( 0.028, 8, 6 ), 0x0d0b09, 0.28, mat4( s * 0.124, 0.272, 0.375 ) );
	}

	// Five walking-leg pairs with visible knee articulation; no oversized claws (spiny lobster).
	for ( const s of [ -1, 1 ] ) for ( let j = 0; j < 5; j ++ ) {
		const z = 0.20 - j * 0.15;
		const hip = new Vector3( s * 0.16, 0.14, z );
		const knee = new Vector3( s * ( 0.31 + j * 0.014 ), 0.085, z + ( j < 2 ? 0.045 : -0.012 ) );
		const foot = new Vector3( s * ( 0.43 + j * 0.018 ), 0.012, z + 0.095 );
		add( rod( hip, knee, 0.019 - j * 0.0014, 7, 0.012 ), DARK, 0.64 );
		add( rod( knee, foot, 0.012, 6, 0.004 ), BODY, 0.68 );
	}

	// Small swimmerets under the abdomen make the side view less toy-like.
	for ( const s of [ -1, 1 ] ) for ( let j = 0; j < 4; j ++ ) {
		const z = -0.18 - j * 0.12;
		add( rod( new Vector3( s * 0.08, 0.095, z ), new Vector3( s * 0.18, 0.045, z - 0.045 ), 0.008, 5, 0.003 ), CREAM, 0.72 );
	}

	// Carapace spines and readable cream spots/banding at gameplay distance.
	for ( const [ x, y, z, dx, dz ] of [
		[ -0.14, 0.29, 0.10, -0.08, 0.03 ], [ 0.14, 0.29, 0.10, 0.08, 0.03 ],
		[ -0.16, 0.25, -0.02, -0.08, -0.01 ], [ 0.16, 0.25, -0.02, 0.08, -0.01 ],
		[ -0.10, 0.30, 0.22, -0.05, 0.06 ], [ 0.10, 0.30, 0.22, 0.05, 0.06 ],
	] ) add( rod( new Vector3( x, y, z ), new Vector3( x + dx, y + 0.078, z + dz ), 0.012, 6, 0.0015 ), CREAM, 0.52 );
	for ( const [ x, z, s ] of [ [ -0.13, 0.08, 1 ], [ 0.13, 0.08, 1 ], [ -0.08, -0.05, 0.8 ], [ 0.08, -0.05, 0.8 ] ] ) {
		add( sphere( 0.022, 7, 5 ), SPOT, 0.58, mat4( x, 0.285, z, 0, 0, 0, s, 0.45, s ) );
	}
	return mergePrepared( parts );
}

function floorAt( app, x, z ) {
	let y = app.terrainData?.heightAt?.( x, z );
	const reef = app.reef?.floorHeightAt?.( x, z );
	if ( Number.isFinite( reef ) ) y = Number.isFinite( y ) ? Math.max( y, reef ) : reef;
	return Number.isFinite( y ) ? y : -100;
}

function marineCandidates( app ) {
	const out = [];
	const push = ( x, z, label ) => {
		const y = floorAt( app, x, z );
		if ( y < -1.25 && y > -17 ) out.push( { x, z, y, depth: -y, label } );
	};
	const D = WORLD.boatDock.position, R = WORLD.reef.center;

	// Active dive corridor: harbour exit -> patch reef -> reef centre.
	for ( let i = 0; i < 14; i ++ ) {
		const t = ( i + 1 ) / 15;
		const bx = D.x + ( R.x - D.x ) * t;
		const bz = D.z + ( R.z - D.z ) * t;
		for ( const side of [ -1, 1 ] ) push( bx + side * ( 5 + ( i % 3 ) * 3 ), bz + Math.sin( i * 1.7 ) * 5, i < 5 ? 'harbour-edge' : i < 10 ? 'patch-reef' : 'reef-slope' );
	}

	// Reef rings produce distinct shallow / mid / deeper habitat choices.
	for ( const radius of [ 13, 24, 38, 54 ] ) for ( let i = 0; i < 12; i ++ ) {
		const a = i / 12 * TAU + radius * 0.017;
		push( R.x + Math.cos( a ) * radius, R.z + Math.sin( a ) * radius, radius < 20 ? 'reef-flat' : radius < 42 ? 'coral-heads' : 'drop-off' );
	}

	// Real coral anchors are preferred lobster ledges when available.
	for ( const a of app.reef?.anchors || [] ) {
		const x = Array.isArray( a ) ? a[ 0 ] : a?.x;
		const z = Array.isArray( a ) ? a[ 1 ] : a?.z;
		if ( Number.isFinite( x ) && Number.isFinite( z ) && Math.hypot( x - R.x, z - R.z ) < 70 ) push( x, z, 'coral-ledge' );
	}
	return out;
}

function improveLobsters( app, candidates, ultra ) {
	const lobsters = app.game?.lobsters;
	if ( ! lobsters?.items?.length || lobsters.__referenceDensityUpgraded ) return lobsters;
	lobsters.__referenceDensityUpgraded = true;

	const geometry = improvedLobsterGeometry();
	lobsters.geometry = geometry;
	for ( const l of lobsters.items ) l.mesh.geometry = geometry;

	const habitat = candidates.filter( c => c.depth >= 2.0 && c.depth <= 14.5 );
	const target = ultra ? 58 : 42;
	for ( let i = lobsters.items.length; i < target && habitat.length; i ++ ) {
		const h = habitat[ ( i * 7 + 3 ) % habitat.length ];
		const a = i * 2.399963;
		const radius = 0.6 + ( i % 5 ) * 0.43;
		const x = h.x + Math.cos( a ) * radius, z = h.z + Math.sin( a ) * radius;
		if ( ! lobsters.valid( x, z ) ) continue;
		const size = 0.60 + ( ( i * 37 ) % 19 ) / 100;
		const mesh = new Mesh( geometry, lobsters.material );
		mesh.name = `spiny-lobster-${ i }`;
		mesh.scale.setScalar( size );
		lobsters.group.add( mesh );
		const yaw = ( i * 1.61803398875 ) % TAU;
		lobsters.items.push( {
			id: lobsters.items.length, mesh, x, z, homeX: x, homeZ: z, yaw, targetYaw: yaw,
			size, bodyCm: 31 + ( i * 7 ) % 20, kg: Math.round( ( 0.8 + ( i % 13 ) * 0.13 ) * 100 ) / 100,
			active: true, respawn: 0, flee: 0, think: ( i % 7 ) * 0.41, habitat: h.label,
		} );
	}

	// Re-home the whole population around coral heads/ledges instead of near-uniform reef spacing.
	for ( let i = 0; i < lobsters.items.length && habitat.length; i ++ ) {
		const l = lobsters.items[ i ];
		const h = habitat[ ( i * 11 + ( i % 3 ) * 5 ) % habitat.length ];
		const a = i * 2.17, r = 0.45 + ( i % 6 ) * 0.48;
		const x = h.x + Math.cos( a ) * r, z = h.z + Math.sin( a ) * r;
		if ( ! lobsters.valid( x, z ) ) continue;
		l.x = l.homeX = x; l.z = l.homeZ = z; l.habitat = h.label;
		l.mesh.position.set( x, lobsters.floorAt( x, z ) + 0.045 * l.size, z );
	}
	lobsters.drawDistance = ultra ? 68 : Math.max( lobsters.drawDistance || 42, 48 );
	return lobsters;
}

function concentrateFishSchools( app, candidates, ultra ) {
	const fish = app.reef?.fish;
	if ( ! fish?.groups?.length || fish.__referenceDensityZoned ) return fish;
	fish.__referenceDensityZoned = true;
	const preferred = new Set( [ 'silverside', 'chromis', 'grunt', 'yellowtail', 'tang', 'wrasse', 'parrot', 'grouper', 'jack', 'tarpon', 'mullet', 'needlefish' ] );
	const limit = ultra ? 24 : 14;
	let moved = 0;

	for ( let gi = 0; gi < fish.groups.length && moved < limit; gi ++ ) {
		const g = fish.groups[ gi ];
		if ( ! preferred.has( g.sp?.model ) || g.__referenceRehomed ) continue;
		const band = g.sp.band || [ 1.2, 20 ];
		const valid = candidates.filter( c => c.depth >= band[ 0 ] && c.depth <= band[ 1 ] );
		if ( ! valid.length ) continue;
		const c = valid[ ( gi * 7 + moved * 3 ) % valid.length ];
		const dx = c.x - g.home.x, dz = c.z - g.home.z;
		g.home.x += dx; g.home.z += dz;
		g.goal.x += dx; g.goal.z += dz;
		g.center.x += dx; g.center.z += dz;
		if ( g.zone ) { g.zone.x = c.x; g.zone.z = c.z; g.zone.r = Math.min( g.zone.r || 12, g.sp.mode === 'school' ? 12 : 8 ); }
		for ( let i = g.offset; i < g.offset + g.count; i ++ ) {
			const k = i * 3;
			fish.pos[ k ] += dx; fish.pos[ k + 2 ] += dz;
			if ( fish.prev ) { fish.prev[ k ] += dx; fish.prev[ k + 2 ] += dz; }
		}
		g.__referenceRehomed = c.label;
		moved ++;
	}
	return fish;
}

export function installReferenceMarineDensityPass( app ) {
	if ( ! app || app.__referenceMarineDensityPass ) return app?.__referenceMarineDensityPass;
	const params = typeof location !== 'undefined' ? new URLSearchParams( location.search ) : null;
	const ultra = !! params?.has( 'desktop' );
	const candidates = marineCandidates( app );
	const lobsters = improveLobsters( app, candidates, ultra );
	const fish = concentrateFishSchools( app, candidates, ultra );
	const state = app.__referenceMarineDensityPass = {
		candidates: candidates.length,
		lobsters,
		fish,
		get lobsterCount() { return lobsters?.items?.length || 0; },
		get zonedSchools() { return fish?.groups?.filter?.( g => g.__referenceRehomed ).length || 0; },
	};
	if ( typeof window !== 'undefined' ) window.__referenceMarineDensityPass = state;
	return state;
}
