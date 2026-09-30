import { BoxGeometry, CylinderGeometry, InstancedMesh, Matrix4, Mesh, Vector3 } from '../engine/index.js';
import { Material } from '../engine/render/Material.js';
import { G } from '../core/Globals.js';
import { FISH_MARKET } from '../world/bermuda/HarbourLayout.js';

const FONT = {
	A:['01110','10001','10001','11111','10001','10001','10001'],
	E:['11111','10000','10000','11110','10000','10000','11111'],
	F:['11111','10000','10000','11110','10000','10000','10000'],
	H:['10001','10001','10001','11111','10001','10001','10001'],
	I:['11111','00100','00100','00100','00100','00100','11111'],
	J:['00111','00010','00010','00010','10010','10010','01100'],
	K:['10001','10010','10100','11000','10100','10010','10001'],
	M:['10001','11011','10101','10101','10001','10001','10001'],
	O:['01110','10001','10001','10001','10001','10001','01110'],
	R:['11110','10001','10001','11110','10100','10010','10001'],
	S:['01111','10000','10000','01110','00001','00001','11110'],
	T:['11111','00100','00100','00100','00100','00100','00100'],
	"'":['00100','00100','00000','00000','00000','00000','00000'],
};

const clamp01 = v => Math.max( 0, Math.min( 1, Number( v ) || 0 ) );

function localToWorld( s, lx, lz, out ) {
	const c = Math.cos( s.yaw ), n = Math.sin( s.yaw );
	out.set( s.x + lx * c + lz * n, s.baseY, s.z - lx * n + lz * c );
	return out;
}

function clearJoeFace( app ) {
	const vendor = app.game?.stand?.vendor;
	if ( ! vendor ) return false;
	vendor.__mobileFaceClear = true;

	// Keep Joe behind the Tidewater counter, but move him sideways out from under the nearby patio
	// canopy in the mobile reference corridor. Reapply this briefly during startup because the older
	// dock HUD repair performs one late Joe relocation of its own.
	const p = localToWorld( FISH_MARKET, 0.56, 0.12, new Vector3() );
	p.y += 0.06;
	vendor.position.copy( p );
	vendor.group.position.copy( p );
	vendor.radius = 3.1;
	return true;
}

function addJoeSign( app ) {
	const group = app.game?.stand?.group;
	if ( ! group || group.getObjectByName?.( 'JoeFishMarketSign' ) ) return !! group;

	const board = new Mesh(
		new BoxGeometry( 2.36, 0.48, 0.055 ),
		new Material( { name:'joe-sign-board', color:0x244b57, roughness:0.82, emissive:0x071316, receiveShadows:false } ),
	);
	board.name = 'JoeFishMarketSign';
	board.position.set( 0, 2.54, 0.96 );
	group.add( board );

	const typeMat = new Material( { name:'joe-sign-type', color:0xf8f3df, roughness:0.55, emissive:0x514d3a, receiveShadows:false } );
	const px = 0.018, gap = 0.004, cell = px + gap, placements = [];
	const lines = [ "JOE'S", 'FISH MARKET' ];
	for ( let row = 0; row < lines.length; row ++ ) {
		const chars = [ ...lines[ row ] ];
		const width = Math.max( 0, chars.length * 6 - 1 ) * cell;
		const x0 = - width * 0.5, y0 = row === 0 ? 2.60 : 2.45;
		for ( let ci = 0; ci < chars.length; ci ++ ) {
			const ch = chars[ ci ];
			if ( ch === ' ' ) continue;
			const glyph = FONT[ ch ];
			if ( ! glyph ) continue;
			for ( let gy = 0; gy < glyph.length; gy ++ ) {
				for ( let gx = 0; gx < glyph[ gy ].length; gx ++ ) {
					if ( glyph[ gy ][ gx ] !== '1' ) continue;
					placements.push( [ x0 + ( ci * 6 + gx ) * cell, y0 + ( 3 - gy ) * cell, 0.992 ] );
				}
			}
		}
	}
	const dots = new InstancedMesh( new BoxGeometry( px, px, 0.018 ), typeMat, placements.length );
	dots.name = 'JoeFishMarketSignType';
	const m = new Matrix4();
	placements.forEach( ( p, i ) => { m.makeTranslation( p[ 0 ], p[ 1 ], p[ 2 ] ); dots.setMatrixAt( i, m ); } );
	dots.instanceMatrix.needsUpdate = true;
	dots.computeBoundingSphere();
	group.add( dots );
	return true;
}

function installPersistentLampGlow( app ) {
	const lightState = app.__mobileReferenceStreetLights;
	if ( ! lightState?.lamps?.length || app.__mobilePersistentLampGlow ) return app.__mobilePersistentLampGlow;

	// The real local-light system intentionally evaluates only the nearest lights. Keep those physical
	// lights, but add always-visible emissive bulbs and faint baked-style pools so lamps no longer look
	// switched off until the camera gets close.
	const bulbs = lightState.meshes?.[ 2 ];
	if ( bulbs?.material?.emissive ) bulbs.material.emissive.setRGB( 1.0, 0.42, 0.12 );

	const poolMat = new Material( {
		name:'mobile-streetlight-baked-pool', color:0xffb56a, emissive:0xff8f40,
		lit:false, transparent:true, opacity:0.02, depthWrite:false, receiveShadows:false, side:'double',
	} );
	const poolGeo = new CylinderGeometry( 1, 1, 0.012, 20 );
	const pools = new InstancedMesh( poolGeo, poolMat, lightState.lamps.length );
	pools.name = 'MobileStreetLightBakedPools';
	const m = new Matrix4();
	for ( let i = 0; i < lightState.lamps.length; i ++ ) {
		const l = lightState.lamps[ i ];
		m.makeScale( 3.5, 1, 3.5 );
		m.setPosition( l.x, l.ground + 0.035, l.z );
		pools.setMatrixAt( i, m );
	}
	pools.instanceMatrix.needsUpdate = true;
	pools.computeBoundingSphere();
	pools.castShadow = false;
	pools.receiveShadow = false;
	app.scene.add( pools );
	app.__mobilePersistentLampGlow = { pools, material: poolMat };
	return app.__mobilePersistentLampGlow;
}

function installMoonAmbient( app ) {
	if ( app.__mobileMoonAmbient ) return app.__mobileMoonAmbient;
	const baseExposure = Number( app.settings?.exposure ?? 0.72 );
	const baseReadback = typeof app.applyAtmosphereReadback === 'function' ? app.applyAtmosphereReadback.bind( app ) : null;

	if ( baseReadback ) {
		app.applyAtmosphereReadback = ( ...args ) => {
			const result = baseReadback( ...args );
			const night = clamp01( G.night.value );
			if ( night > 0.001 ) {
				const storm = app.settings?.weatherMode === 'storm';
				const key = ( storm ? 0.18 : 0.23 ) * night;
				const sun = G.sunColor.value;
				sun.r = Math.max( sun.r, key * 0.48 );
				sun.g = Math.max( sun.g, key * 0.62 );
				sun.b = Math.max( sun.b, key );

				const amb = ( storm ? 0.028 : 0.038 ) * night;
				const sky = G.skyIrradiance.value;
				sky.r += amb * 0.55;
				sky.g += amb * 0.70;
				sky.b += amb;

				const horizon = G.horizonColor.value;
				horizon.r = Math.max( horizon.r, 0.012 * night );
				horizon.g = Math.max( horizon.g, 0.020 * night );
				horizon.b = Math.max( horizon.b, 0.038 * night );
			}
			return result;
		};
	}

	let timer = 0;
	const sync = () => {
		const night = clamp01( G.night.value );
		if ( app.settings ) app.settings.exposure = baseExposure + 0.13 * night;
		if ( app.__mobilePersistentLampGlow?.material ) app.__mobilePersistentLampGlow.material.opacity = 0.02 + 0.12 * night;
	};
	sync();
	if ( typeof window !== 'undefined' ) {
		timer = window.setInterval( sync, 120 );
		window.addEventListener( 'pagehide', () => timer && window.clearInterval( timer ), { once:true } );
	}
	app.__mobileMoonAmbient = { baseExposure, sync };
	return app.__mobileMoonAmbient;
}

export function installMobileNightJoePolish( app ) {
	if ( ! app || app.__mobileNightJoePolish ) return app?.__mobileNightJoePolish;
	const state = app.__mobileNightJoePolish = {
		joe:false, sign:false, glow:null, moon:null,
	};

	const install = () => {
		state.joe = clearJoeFace( app ) || state.joe;
		state.sign = addJoeSign( app ) || state.sign;
		state.glow = installPersistentLampGlow( app ) || state.glow;
		state.moon = installMoonAmbient( app ) || state.moon;
		return state.joe && state.sign && !! state.glow && !! state.moon;
	};
	install();
	if ( ! install() && typeof window !== 'undefined' ) {
		let attempts = 0;
		const timer = window.setInterval( () => {
			attempts ++;
			if ( install() || attempts > 40 ) window.clearInterval( timer );
		}, 250 );
		window.addEventListener( 'pagehide', () => window.clearInterval( timer ), { once:true } );
	}

	// DockHudFix has one legacy delayed Joe placement. For the first five seconds, re-assert this final
	// mobile position so whichever module initializes last cannot put the canopy back over his face.
	if ( typeof window !== 'undefined' ) {
		let settles = 0;
		const settleJoe = window.setInterval( () => {
			clearJoeFace( app );
			if ( ++ settles >= 20 ) window.clearInterval( settleJoe );
		}, 250 );
		window.addEventListener( 'pagehide', () => window.clearInterval( settleJoe ), { once:true } );
	}
	if ( typeof window !== 'undefined' ) window.__mobileNightJoePolish = state;
	return state;
}
