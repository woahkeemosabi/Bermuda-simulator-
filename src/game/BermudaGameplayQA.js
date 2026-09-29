import * as THREE from '../engine/index.js';
import { Material } from '../engine/render/Material.js';

// Focused Bermuda Simulator gameplay QA fixes that sit on top of the existing boat/player systems.
// BoatController remains authoritative for physics; this layer adds visible feedback and mobile-friendly
// world behaviour without replacing the underlying simulation.

const _bow = new THREE.Vector3();
const _target = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _up = new THREE.Vector3( 0, 1, 0 );
const _q = new THREE.Quaternion();

function nightAt( hours ) {

	return hours >= 18.35 || hours < 6.15;

}

function makeAnchorVisual( app, boat ) {

	if ( ! app.scene || ! app.terrainData ) return null;
	const metal = new Material( {
		name: 'bermuda-anchor-metal', color: 0x3f4b50, roughness: 0.34, metalness: 0.88,
		underwaterLighting: 'full', localLightsCheap: false, receiveShadows: true,
	} );
	const rodeMat = new Material( {
		name: 'bermuda-anchor-rode', color: 0x87979a, roughness: 0.58, metalness: 0.62,
		underwaterLighting: 'full', localLightsCheap: false, receiveShadows: true,
	} );
	const root = new THREE.Group();
	root.name = 'BERMUDA_BOAT_ANCHOR';
	root.visible = false;

	const shank = new THREE.Mesh( new THREE.CylinderGeometry( 0.07, 0.08, 1.15, 10 ), metal );
	shank.position.y = 0.55;
	root.add( shank );
	const stock = new THREE.Mesh( new THREE.CylinderGeometry( 0.055, 0.055, 1.05, 10 ), metal );
	stock.rotation.z = Math.PI * 0.5;
	stock.position.y = 0.92;
	root.add( stock );
	const crown = new THREE.Mesh( new THREE.CylinderGeometry( 0.08, 0.09, 0.72, 10 ), metal );
	crown.rotation.z = Math.PI * 0.5;
	crown.position.y = 0.08;
	root.add( crown );
	for ( const s of [ - 1, 1 ] ) {

		const fluke = new THREE.Mesh( new THREE.BoxGeometry( 0.48, 0.08, 0.36 ), metal );
		fluke.position.set( s * 0.38, 0.05, 0.11 );
		fluke.rotation.y = s * 0.28;
		root.add( fluke );

	}
	root.scale.setScalar( 0.82 );
	app.scene.add( root );

	const rode = new THREE.Mesh( new THREE.CylinderGeometry( 0.026, 0.026, 1, 8 ), rodeMat );
	rode.name = 'BERMUDA_ANCHOR_RODE';
	rode.visible = false;
	app.scene.add( rode );

	const floorAt = ( x, z ) => {

		let h = app.terrainData.heightAt( x, z );
		const reef = app.reef?.floorHeightAt?.( x, z );
		if ( Number.isFinite( reef ) ) h = Math.max( h, reef );
		return h;

	};
	const bowPoint = () => boat.toWorld( new THREE.Vector3( 0, 0.62, 3.72 ), _bow );
	const lineBetween = ( a, b ) => {

		_dir.copy( b ).sub( a );
		const len = _dir.length();
		if ( len < 0.06 ) { rode.visible = false; return; }
		rode.visible = true;
		rode.position.copy( a ).add( b ).multiplyScalar( 0.5 );
		rode.scale.set( 1, len, 1 );
		_q.setFromUnitVectors( _up, _dir.multiplyScalar( 1 / len ) );
		rode.quaternion.copy( _q );

	};

	const state = { phase: 'stowed', wasAnchored: false, floorY: 0, dropX: 0, dropZ: 0 };
	const beginDrop = () => {

		const bow = bowPoint();
		boat.forward( _dir ).setY( 0 ).normalize();
		state.dropX = bow.x + _dir.x * 1.25;
		state.dropZ = bow.z + _dir.z * 1.25;
		state.floorY = floorAt( state.dropX, state.dropZ ) + 0.11;
		root.position.copy( bow );
		root.rotation.set( 0, boat.getYaw(), 0.08 );
		root.visible = true;
		state.phase = 'dropping';

	};
	const beginRaise = () => {

		if ( state.phase === 'stowed' ) return;
		state.phase = 'raising';

	};
	const stow = () => {

		state.phase = 'stowed';
		root.visible = false;
		rode.visible = false;

	};
	const update = ( dt ) => {

		if ( boat.anchored && ! state.wasAnchored ) beginDrop();
		if ( ! boat.anchored && state.wasAnchored ) beginRaise();
		state.wasAnchored = !! boat.anchored;

		if ( state.phase === 'dropping' ) {

			const bow = bowPoint();
			root.position.x += ( state.dropX - root.position.x ) * ( 1 - Math.exp( - dt * 2.1 ) );
			root.position.z += ( state.dropZ - root.position.z ) * ( 1 - Math.exp( - dt * 2.1 ) );
			root.position.y = Math.max( state.floorY, root.position.y - dt * 4.6 );
			lineBetween( bow, root.position.clone().add( _target.set( 0, 0.86, 0 ) ) );
			if ( root.position.y <= state.floorY + 0.02 ) {

				root.position.y = state.floorY;
				root.rotation.z = 1.28;
				state.phase = 'set';

			}

		} else if ( state.phase === 'set' ) {

			lineBetween( bowPoint(), root.position.clone().add( _target.set( 0, 0.86, 0 ) ) );

		} else if ( state.phase === 'raising' ) {

			const bow = bowPoint();
			_target.copy( bow ).sub( root.position );
			const d = _target.length();
			if ( d > 35 ) { stow(); return; }
			if ( d < 0.36 ) { stow(); return; }
			root.position.addScaledVector( _target, Math.min( 1, dt * 6.2 / Math.max( d, 0.001 ) ) );
			root.rotation.z += ( 0.08 - root.rotation.z ) * ( 1 - Math.exp( - dt * 5 ) );
			lineBetween( bow, root.position.clone().add( _target.set( 0, 0.86, 0 ) ) );

		}

	};

	return { root, rode, state, update, stow };

}

function addBoatUnderwaterLights( app, boat ) {

	if ( ! app.localLights || ! app.boat?.group || app.__bermudaUnderwaterLights ) return [];
	const obj = app.boat.group;
	const lights = [];
	for ( const x of [ - 0.72, 0.72 ] ) {

		const local = new THREE.Vector3( x, - 0.42, - 2.95 );
		const localDir = new THREE.Vector3( x * 0.08, - 0.42, - 0.9 ).normalize();
		const src = {
			position: new THREE.Vector3(), color: new THREE.Color( 0.62, 0.9, 1.0 ), intensity: 13.5, range: 19,
			kind: 'boatUnderwater', dir: new THREE.Vector3(), cosInner: 0.84, cosOuter: 0.34, scale: 1,
			update() {

				obj.updateWorldMatrix( true, false );
				this.position.copy( local ).applyMatrix4( obj.matrixWorld );
				this.dir.copy( localDir ).transformDirection( obj.matrixWorld );

			},
		};
		src.update();
		app.localLights.add( src );
		lights.push( src );

	}
	app.__bermudaUnderwaterLights = lights;
	return lights;

}

export function installBermudaGameplayQA( app ) {

	if ( ! app || app.__bermudaGameplayQAInstalled ) return;
	app.__bermudaGameplayQAInstalled = true;

	const boat = app.boatCtl;
	if ( ! boat ) return;

	// The old default was an ~8 minute full day. Use a much slower ~100 minute cycle so daylight,
	// sunset, night and dawn are long enough to matter in gameplay. ?fasttime keeps the old QA pace.
	const fastTime = typeof location !== 'undefined' && new URLSearchParams( location.search ).has( 'fasttime' );
	if ( ! fastTime && app.settings ) {

		app.settings.timeSpeed = 0.004;
		app._timeSpeed = 0.004;

	}

	boat.setAnchorState = ( on ) => {

		if ( on ) {

			if ( boat.anchored ) return true;
			return boat.toggleAnchor();

		}
		if ( ! boat.anchored ) return false;
		return boat.raiseAnchor();

	};

	const baseReset = boat.reset.bind( boat );
	boat.reset = ( ...args ) => {

		boat.anchored = false;
		const result = baseReset( ...args );
		boat.anchorPosition.copy( boat.position );
		boat.anchorHeading = boat.getYaw();
		return result;

	};

	const baseToggleAnchor = boat.toggleAnchor.bind( boat );
	boat.toggleAnchor = () => {

		const result = baseToggleAnchor();
		if ( app.game?.toast ) {

			app.game.toast(
				boat.anchored
					? 'Anchor dropping · boat will remain here while you swim or dive'
					: 'Anchor raising · ready to get underway when it is aboard',
				boat.anchored ? 3200 : 2400
			);

		}
		return result;

	};

	const baseRaiseAnchor = boat.raiseAnchor.bind( boat );
	boat.raiseAnchor = () => {

		const input = app.input;
		const throttleHeld = !! ( input && ( input.down( 'KeyW' ) || input.down( 'KeyS' ) ) );
		const anchorControlHeld = !! ( input && input.down( 'KeyK' ) );
		if ( boat.anchored && throttleHeld && ! anchorControlHeld ) {

			if ( app.game?.toast ) {

				const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
				if ( ! boat.__anchorReminderAt || now - boat.__anchorReminderAt > 1800 ) {

					boat.__anchorReminderAt = now;
					app.game.toast( 'Anchor is down · use ANCHOR to raise it', 1700 );

				}

			}
			return false;

		}
		return baseRaiseAnchor();

	};

	addBoatUnderwaterLights( app, boat );
	const anchorVisual = typeof document !== 'undefined' ? makeAnchorVisual( app, boat ) : null;

	// Night diving: automatically switch the existing physical flashlight on once when entering a
	// dark dive, then respect manual LIGHT/L toggles until the player leaves the water.
	let wasNightDive = false;
	let autoLightOwned = false;
	let last = typeof performance !== 'undefined' ? performance.now() : Date.now();
	let raf = 0;
	const tick = ( now ) => {

		const dt = Math.min( 0.05, Math.max( 0, ( now - last ) / 1000 ) );
		last = now;
		anchorVisual?.update( dt );

		const p = app.player;
		const darkDive = !! p && p.mode === 'swim' && ( p.diveDepth || 0 ) > 0.18 && nightAt( app.settings?.timeOfDay ?? 12 );
		const fl = app.localLights?.flashlight;
		if ( fl ) {

			if ( darkDive ) {

				fl.intensity = 92;
				fl.range = 38;
				fl.color.setRGB( 0.7, 0.9, 1.0 );
			} else {

				fl.intensity = 55;
				fl.range = 30;
				fl.color.setRGB( 1.0, 0.71, 0.49 );
			}
			if ( darkDive && ! wasNightDive && ! fl.on ) {

				app.localLights.toggleFlashlight( true );
				autoLightOwned = true;
			}
			if ( ! darkDive && wasNightDive && autoLightOwned ) {

				if ( fl.on ) app.localLights.toggleFlashlight( false );
				autoLightOwned = false;
			}

		}
		wasNightDive = darkDive;
		if ( typeof requestAnimationFrame !== 'undefined' ) raf = requestAnimationFrame( tick );

	};
	if ( typeof requestAnimationFrame !== 'undefined' ) raf = requestAnimationFrame( tick );
	if ( typeof window !== 'undefined' ) window.addEventListener( 'pagehide', () => raf && cancelAnimationFrame( raf ), { once: true } );

	if ( typeof window !== 'undefined' ) {

		window.__bermudaGameplayQA = {
			boat,
			anchorVisual,
			get anchored() { return boat.anchored; },
			get boatPosition() { return { x: boat.position.x, y: boat.position.y, z: boat.position.z }; },
			get dayLengthMinutes() { return app.settings?.timeSpeed ? 24 / app.settings.timeSpeed / 60 : Infinity; },
		};

	}

}
