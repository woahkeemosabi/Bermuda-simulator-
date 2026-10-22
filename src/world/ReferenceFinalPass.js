import {
	BoxGeometry, Color, CylinderGeometry, Group, Mesh, SphereGeometry, TorusGeometry, Vector3,
} from '../engine/index.js';
import { Material } from '../engine/render/Material.js';

const _fwd = new Vector3();
const _eye = new Vector3();
const _target = new Vector3();
const _ray = new Vector3();
const _world = new Vector3();
const _worldDir = new Vector3();

function mat( name, color, roughness = 0.88, metalness = 0, extra = {} ) {
	return new Material( {
		name: `bermuda-final-${ name }`, color, roughness, metalness,
		underwaterLighting: 'lite', localLightsCheap: true, receiveShadows: true,
		...extra,
	} );
}

function mesh( parent, geo, material, position, scale, rotation = null, name = '' ) {
	const m = new Mesh( geo, material );
	m.name = name;
	m.position.set( position[ 0 ], position[ 1 ], position[ 2 ] );
	m.scale.set( scale[ 0 ], scale[ 1 ], scale[ 2 ] );
	if ( rotation ) m.rotation.set( rotation[ 0 ], rotation[ 1 ], rotation[ 2 ] );
	m.castShadow = false;
	m.receiveShadow = true;
	parent.add( m );
	return m;
}

function makeHuman( materials, geometry, shirt = materials.shirt ) {
	const root = new Group();
	const body = new Group();
	root.add( body );

	mesh( body, geometry.cyl, shirt, [ 0, 1.15, 0 ], [ 0.28, 0.56, 0.24 ], null, 'torso' );
	mesh( body, geometry.sphere, materials.skin, [ 0, 1.78, 0 ], [ 0.19, 0.22, 0.19 ], null, 'head' );
	mesh( body, geometry.box, materials.hair, [ 0, 1.93, -0.01 ], [ 0.20, 0.07, 0.19 ], null, 'hair' );
	mesh( body, geometry.box, materials.pants, [ 0, 0.86, 0 ], [ 0.46, 0.24, 0.25 ], null, 'hips' );

	const legL = new Group(), legR = new Group(), armL = new Group(), armR = new Group();
	legL.position.set( -0.14, 0.79, 0 ); legR.position.set( 0.14, 0.79, 0 );
	armL.position.set( -0.34, 1.45, 0 ); armR.position.set( 0.34, 1.45, 0 );
	body.add( legL, legR, armL, armR );
	mesh( legL, geometry.cyl, materials.pants, [ 0, -0.38, 0 ], [ 0.105, 0.42, 0.105 ] );
	mesh( legR, geometry.cyl, materials.pants, [ 0, -0.38, 0 ], [ 0.105, 0.42, 0.105 ] );
	mesh( legL, geometry.box, materials.shoe, [ 0, -0.81, 0.08 ], [ 0.18, 0.10, 0.31 ] );
	mesh( legR, geometry.box, materials.shoe, [ 0, -0.81, 0.08 ], [ 0.18, 0.10, 0.31 ] );
	mesh( armL, geometry.cyl, materials.skin, [ 0, -0.30, 0 ], [ 0.075, 0.34, 0.075 ] );
	mesh( armR, geometry.cyl, materials.skin, [ 0, -0.30, 0 ], [ 0.075, 0.34, 0.075 ] );

	return { root, body, legL, legR, armL, armR };
}

function animateHuman( human, speed, t, swim = false ) {
	const moving = Math.min( 1, speed / 3.2 );
	const cadence = swim ? 4.2 : 7.5 + Math.min( 5, speed );
	const swing = Math.sin( t * cadence ) * ( swim ? 0.30 : 0.66 ) * moving;
	human.legL.rotation.x = swing;
	human.legR.rotation.x = - swing;
	human.armL.rotation.x = - swing * 0.72;
	human.armR.rotation.x = swing * 0.72;
	human.body.position.y = Math.abs( Math.sin( t * cadence ) ) * 0.025 * moving;
	human.body.rotation.x += ( ( swim ? -1.18 : 0 ) - human.body.rotation.x ) * 0.18;
	if ( swim ) {
		human.armL.rotation.z = -0.35;
		human.armR.rotation.z = 0.35;
	} else {
		human.armL.rotation.z *= 0.82;
		human.armR.rotation.z *= 0.82;
	}
}

function installPlayerPresentation( app, root, materials, geometry ) {
	const player = app.player;
	if ( ! player || player.__bermudaReferencePresentation ) return null;

	const avatar = makeHuman( materials, geometry, materials.playerShirt );
	avatar.root.name = 'BermudaPlayerAvatar';
	avatar.root.visible = false;
	root.add( avatar.root );

	const state = {
		thirdPerson: true,
		avatar,
		cameraReady: false,
	};
	player.__bermudaReferencePresentation = state;

	const baseUpdate = player.update.bind( player );
	player.update = ( dt ) => {
		const before = player.mode;
		if ( ( before === 'walk' || before === 'swim' ) && app.input.hit( 'KeyV' ) ) {
			state.thirdPerson = ! state.thirdPerson;
			state.cameraReady = false;
			app.game?.toast?.( state.thirdPerson ? 'Third-person camera' : 'First-person camera', 1200 );
		}

		baseUpdate( dt );
		const active = player.mode === 'walk' || player.mode === 'swim';
		if ( typeof document !== 'undefined' ) document.body.classList.toggle( 'bm-ref-cam-context', active );
		avatar.root.visible = active && state.thirdPerson;
		if ( ! active || ! state.thirdPerson ) {
			state.cameraReady = false;
			return;
		}

		const swim = player.mode === 'swim';
		const speed = Math.hypot( player.velocity.x, player.velocity.y, player.velocity.z );
		avatar.root.position.copy( player.position );
		avatar.root.rotation.y = player.yaw + Math.PI;
		animateHuman( avatar, speed, performance.now() * 0.001, swim );

		_fwd.set( - Math.sin( player.yaw ), 0, - Math.cos( player.yaw ) ).normalize();
		_target.copy( player.position );
		_target.y += swim ? 0.48 : 1.18;
		_target.y -= player.pitch * ( swim ? 0.65 : 0.92 );
		const dist = swim ? 4.15 : 5.25;
		const height = swim ? 1.15 : 2.15;
		_eye.copy( _target ).addScaledVector( _fwd, - dist );
		_eye.y += height - player.pitch * 1.45;

		if ( app.colliders?.raycast ) {
			_ray.copy( _eye ).sub( _target );
			const rayDist = _ray.length();
			if ( rayDist > 0.1 ) {
				_ray.multiplyScalar( 1 / rayDist );
				const clear = app.colliders.raycast( _target, _ray, rayDist );
				if ( clear < rayDist ) _eye.copy( _target ).addScaledVector( _ray, Math.max( 1.35, clear - 0.25 ) );
			}
		}

		if ( ! state.cameraReady ) {
			app.camera.position.copy( _eye );
			state.cameraReady = true;
		} else app.camera.position.lerp( _eye, 1 - Math.exp( - dt * 8.0 ) );
		app.camera.lookAt( _target );
	};

	if ( typeof document !== 'undefined' ) {
		const style = document.createElement( 'style' );
		style.id = 'bermuda-reference-cam-style';
		style.textContent = `
			body.bm-ref-cam-context #bm-touch-stable button[data-role="cam"].bm-hidden{display:block!important}
		`;
		document.head.appendChild( style );
	}

	return state;
}

function makeWalker( root, materials, geometry, x0, z0, range, speed, phase, shirt ) {
	const human = makeHuman( materials, geometry, shirt );
	human.root.name = 'BermudaMovingPedestrian';
	root.add( human.root );
	return { ...human, x0, z0, range, speed, phase };
}

function makeHarbourSkiff( root, materials, geometry, phase, rx, rz, speed, stripe ) {
	const g = new Group();
	g.name = 'BermudaHarbourTrafficBoat';
	root.add( g );

	mesh( g, geometry.box, materials.boatHull, [ 0, 0.12, 0 ], [ 1.55, 0.34, 4.6 ], [ 0.03, 0, 0 ] );
	mesh( g, geometry.box, stripe, [ 0, 0.32, 0.18 ], [ 1.62, 0.12, 3.9 ] );
	mesh( g, geometry.box, materials.boatWhite, [ 0, 0.54, -0.10 ], [ 1.18, 0.12, 2.55 ] );
	mesh( g, geometry.box, materials.console, [ 0, 1.03, 0.35 ], [ 0.82, 0.82, 0.58 ], [ -0.06, 0, 0 ] );
	mesh( g, geometry.box, materials.glass, [ 0, 1.48, 0.54 ], [ 0.92, 0.32, 0.08 ], [ -0.12, 0, 0 ] );
	mesh( g, geometry.box, materials.dark, [ 0, 0.72, -1.18 ], [ 1.04, 0.40, 0.62 ] );
	mesh( g, geometry.box, materials.dark, [ 0, 0.30, -2.48 ], [ 0.52, 0.66, 0.34 ], [ 0.05, 0, 0 ] );

	const wake = new Group();
	wake.position.set( 0, 0.02, -2.7 );
	g.add( wake );
	const l = mesh( wake, geometry.box, materials.wake, [ -0.72, 0, -2.0 ], [ 0.18, 0.025, 4.8 ], [ 0, 0.22, 0 ] );
	const r = mesh( wake, geometry.box, materials.wake, [ 0.72, 0, -2.0 ], [ 0.18, 0.025, 4.8 ], [ 0, -0.22, 0 ] );
	l.castShadow = r.castShadow = false;

	return { group: g, phase, rx, rz, speed, wake };
}

function addDynamicLight( app, object, localPosition, color, range, intensityFn, localDir = null ) {
	if ( ! app.localLights || ! object ) return null;
	const src = {
		position: new Vector3(), color: new Color( color ), intensity: 0, range,
		kind: 'referenceDynamic', dir: localDir ? new Vector3() : undefined,
		cosInner: localDir ? 0.90 : undefined, cosOuter: localDir ? 0.45 : undefined,
		update() {
			object.updateWorldMatrix( true, false );
			this.position.copy( localPosition ).applyMatrix4( object.matrixWorld );
			if ( localDir ) this.dir.copy( localDir ).transformDirection( object.matrixWorld );
			this.intensity = intensityFn();
		},
	};
	src.update();
	app.localLights.add( src );
	return src;
}

function installRelicFX( app, root, materials, geometry ) {
	const vehicle = app.relic001?.group;
	if ( ! vehicle || app.__bermudaRelicReferenceFX ) return app.__bermudaRelicReferenceFX;

	const fx = new Group();
	fx.name = 'RELIC_REFERENCE_FX';
	vehicle.add( fx );
	const thrusters = [];
	for ( const z of [ -1.28, 1.24 ] ) for ( const x of [ -0.72, 0.72 ] ) {
		const glow = mesh( fx, geometry.sphere, materials.relicGlow, [ x, 0.16, z ], [ 0.24, 0.055, 0.24 ], null, 'relic-vector-glow' );
		thrusters.push( glow );
	}

	const bubbles = [];
	for ( let i = 0; i < 14; i ++ ) {
		const b = mesh( root, geometry.sphere, materials.bubble, [ 0, -50, 0 ], [ 0.05, 0.05, 0.05 ], null, 'relic-bubble' );
		b.visible = false;
		bubbles.push( { mesh: b, phase: i / 14 } );
	}

	const splash = mesh( root, geometry.torus, materials.splash, [ 0, 0.04, 0 ], [ 0.25, 0.25, 0.25 ], [ Math.PI * 0.5, 0, 0 ], 'relic-water-entry-ring' );
	splash.visible = false;
	let splashAge = 99;
	let lastMode = vehicle.userData.relicMode || 'ROAD';

	addDynamicLight(
		app, vehicle, new Vector3( 0, 0.67, 2.45 ), 0x9feeff, 36,
		() => {
			const mode = vehicle.userData.relicMode || 'ROAD';
			const h = app.settings?.timeOfDay ?? 12;
			const night = h >= 18.35 || h < 6.15;
			return mode === 'SUB' ? 72 : night ? 28 : 6;
		},
		new Vector3( 0, -0.05, 1 ),
	);
	addDynamicLight(
		app, vehicle, new Vector3( 0, 0.18, -0.1 ), 0x70eaff, 14,
		() => {
			const mode = vehicle.userData.relicMode || 'ROAD';
			return mode === 'AIR' ? 38 : mode === 'HOVER' ? 26 : mode === 'SUB' ? 18 : 0;
		},
	);

	const update = ( dt, t ) => {
		const mode = vehicle.userData.relicMode || 'ROAD';
		const active = mode !== 'ROAD';
		for ( let i = 0; i < thrusters.length; i ++ ) {
			const g = thrusters[ i ];
			g.visible = active;
			const pulse = 1 + Math.sin( t * 13 + i * 1.7 ) * 0.18;
			const base = mode === 'AIR' ? 1.35 : mode === 'SUB' ? 0.90 : 1.08;
			g.scale.set( 0.24 * pulse * base, 0.055, 0.24 * pulse * base );
		}

		if ( mode !== lastMode && ( mode === 'SUB' || lastMode === 'SUB' ) ) {
			splashAge = 0;
			splash.visible = true;
			splash.position.set( vehicle.position.x, 0.04, vehicle.position.z );
			splash.scale.setScalar( 0.45 );
		}
		lastMode = mode;
		if ( splashAge < 1.25 ) {
			splashAge += dt;
			const s = 0.45 + splashAge * 3.8;
			splash.scale.setScalar( s );
			if ( splashAge >= 1.25 ) splash.visible = false;
		}

		const sub = mode === 'SUB';
		const yaw = app.relic?.yaw ?? vehicle.rotation.y;
		const speed = Math.abs( app.relic?.speed || 0 );
		for ( let i = 0; i < bubbles.length; i ++ ) {
			const b = bubbles[ i ];
			b.mesh.visible = sub;
			if ( ! sub ) continue;
			const age = ( t * ( 0.34 + speed * 0.01 ) + b.phase ) % 1;
			const trail = 1.1 + age * ( 3.2 + speed * 0.10 );
			const side = Math.sin( i * 2.17 + t * 2.2 ) * 0.45 * age;
			const backX = - Math.sin( yaw ) * trail;
			const backZ = - Math.cos( yaw ) * trail;
			const sideX = Math.cos( yaw ) * side;
			const sideZ = - Math.sin( yaw ) * side;
			b.mesh.position.set(
				vehicle.position.x + backX + sideX,
				vehicle.position.y + 0.25 + age * 1.55,
				vehicle.position.z + backZ + sideZ,
			);
			const size = 0.035 + age * 0.075;
			b.mesh.scale.setScalar( size );
		}
	};

	app.__bermudaRelicReferenceFX = { group: fx, thrusters, bubbles, splash, update };
	return app.__bermudaRelicReferenceFX;
}

export function installReferenceFinalPass( app ) {
	if ( ! app?.scene || ! app?.terrainData || app.bermudaReferenceFinal ) return app?.bermudaReferenceFinal;

	const root = new Group();
	root.name = 'BermudaReferenceFinalPass';
	app.scene.add( root );

	const geometry = {
		box: new BoxGeometry( 1, 1, 1 ),
		cyl: new CylinderGeometry( 1, 1, 1, 10 ),
		sphere: new SphereGeometry( 1, 10, 8 ),
		torus: new TorusGeometry( 1, 0.075, 8, 28 ),
	};
	const materials = {
		skin: mat( 'skin', 0x9b6a52, 0.86 ),
		hair: mat( 'hair', 0x171411, 0.98 ),
		shirt: mat( 'shirt', 0x4b797a, 0.92 ),
		playerShirt: mat( 'player-shirt', 0xe3ddd0, 0.91 ),
		shirtCoral: mat( 'shirt-coral', 0xb96e66, 0.93 ),
		shirtBlue: mat( 'shirt-blue', 0x4c718b, 0.92 ),
		pants: mat( 'pants', 0x252d33, 0.96 ),
		shoe: mat( 'shoe', 0x121619, 0.98 ),
		boatHull: mat( 'traffic-hull', 0x273d48, 0.52, 0.08 ),
		boatWhite: mat( 'traffic-white', 0xefeee8, 0.72 ),
		boatTeal: mat( 'traffic-teal', 0x2e8c8b, 0.62, 0.05 ),
		boatBlue: mat( 'traffic-blue', 0x4b7d9a, 0.62, 0.05 ),
		boatCoral: mat( 'traffic-coral', 0xaa665c, 0.64, 0.04 ),
		console: mat( 'traffic-console', 0xdedbd2, 0.78 ),
		glass: mat( 'traffic-glass', 0x173b4b, 0.18, 0.16, { transparent: true, opacity: 0.72, depthWrite: false } ),
		dark: mat( 'traffic-dark', 0x202a30, 0.80 ),
		wake: mat( 'traffic-wake', 0xe8fbff, 0.90, 0, { transparent: true, opacity: 0.46, depthWrite: false } ),
		relicGlow: mat( 'relic-glow', 0x6de7ef, 0.08, 0.18, { emissive: 0x9fffff } ),
		bubble: mat( 'relic-bubble', 0xb9f4ff, 0.18, 0, { transparent: true, opacity: 0.58, depthWrite: false } ),
		splash: mat( 'relic-splash', 0xe9fbff, 0.72, 0, { transparent: true, opacity: 0.62, depthWrite: false } ),
	};

	const groundAt = ( x, z ) => {
		const terrain = app.terrainData.heightAt( x, z );
		const collider = app.colliders?.groundHeightAt( x, z, 30 ) ?? - Infinity;
		return Math.max( terrain, Number.isFinite( collider ) ? collider : terrain );
	};

	const walkers = [
		makeWalker( root, materials, geometry, -102, -56.2, 7.2, 0.62, 0.1, materials.shirtCoral ),
		makeWalker( root, materials, geometry, -51, -55.9, 6.0, 0.74, 1.9, materials.shirtBlue ),
		makeWalker( root, materials, geometry, -30, -56.0, 4.8, 0.56, 3.2, materials.shirt ),
	];

	const boats = [
		makeHarbourSkiff( root, materials, geometry, 0.3, 38, 24, 0.060, materials.boatTeal ),
		makeHarbourSkiff( root, materials, geometry, 2.5, 50, 34, 0.043, materials.boatBlue ),
		makeHarbourSkiff( root, materials, geometry, 4.6, 61, 43, 0.034, materials.boatCoral ),
	];

	for ( const b of boats ) addDynamicLight(
		app, b.group, new Vector3( 0, 1.42, 0.85 ), 0xf7f5dd, 12,
		() => {
			const h = app.settings?.timeOfDay ?? 12;
			return h >= 18.2 || h < 6.2 ? 7 : 0;
		},
	);

	const playerPresentation = installPlayerPresentation( app, root, materials, geometry );
	const relicFX = installRelicFX( app, root, materials, geometry );

	let last = performance.now();
	let raf = 0;
	const tick = ( now ) => {
		const dt = Math.min( 0.05, Math.max( 0.001, ( now - last ) / 1000 ) );
		last = now;
		const t = now * 0.001;

		for ( const w of walkers ) {
			const s = Math.sin( t * w.speed + w.phase );
			const c = Math.cos( t * w.speed + w.phase );
			const x = w.x0 + s * w.range;
			w.root.position.set( x, groundAt( x, w.z0 ), w.z0 );
			w.root.rotation.y = c >= 0 ? - Math.PI * 0.5 : Math.PI * 0.5;
			animateHuman( w, 1.6, t + w.phase, false );
		}

		const harbourX = -64, harbourZ = 18;
		for ( let i = 0; i < boats.length; i ++ ) {
			const b = boats[ i ];
			const a = t * b.speed + b.phase;
			const x = harbourX + Math.cos( a ) * b.rx;
			const z = harbourZ + Math.sin( a ) * b.rz;
			const dx = - Math.sin( a ) * b.rx;
			const dz = Math.cos( a ) * b.rz;
			b.group.position.set( x, 0.10 + Math.sin( t * 1.65 + i ) * 0.045, z );
			b.group.rotation.y = Math.atan2( dx, dz );
			b.group.rotation.z = Math.sin( t * 1.45 + i * 0.7 ) * 0.018;
			b.group.rotation.x = Math.sin( t * 1.25 + i * 1.1 ) * 0.012;
		}

		relicFX?.update( dt, t );

		// Reference presentation should remain readable through dusk/night without flattening daylight.
		// This is a restrained exposure adaptation, not an arcade night-vision effect.
		if ( app.settings && ! app.qs?.has?.( 'manualExposure' ) ) {
			const h = app.settings.timeOfDay ?? 12;
			const night = h >= 19.0 || h < 5.5;
			const twilight = ( h >= 17.5 && h < 19.0 ) || ( h >= 5.5 && h < 7.0 );
			let target = night ? 0.88 : twilight ? 0.80 : 0.72;
			if ( app.settings.weatherMode === 'overcast' ) target += 0.035;
			if ( app.settings.weatherMode === 'storm' ) target += 0.065;
			app.settings.exposure += ( target - app.settings.exposure ) * ( 1 - Math.exp( - dt * 0.45 ) );
		}

		raf = requestAnimationFrame( tick );
	};
	raf = requestAnimationFrame( tick );
	if ( typeof window !== 'undefined' ) window.addEventListener( 'pagehide', () => raf && cancelAnimationFrame( raf ), { once: true } );

	const state = app.bermudaReferenceFinal = { root, walkers, boats, playerPresentation, relicFX };
	if ( typeof window !== 'undefined' ) window.__bermudaReferenceFinal = state;
	return state;
}
