import { Vector3 } from '../engine/index.js';

const _target = new Vector3();
const _stable = new Vector3();

function installCameraClosure( app ) {
	const player = app.player;
	if ( ! player || player.__referenceClosureCamera ) return player?.__referenceClosureCamera;

	const state = {
		ready: false,
		lastMode: null,
		stable: _stable.clone(),
	};
	const baseUpdate = player.update.bind( player );

	player.update = ( dt ) => {
		baseUpdate( dt );
		const presentation = player.__bermudaReferencePresentation;
		const footThird = ( player.mode === 'walk' || player.mode === 'swim' ) && presentation?.thirdPerson !== false;
		const vehicleThird = player.mode === 'boat' ? player.camMode === 'third' : player.mode === 'relic' ? player.relic?.cameraMode !== 'first' : false;
		const third = footThird || vehicleThird;

		if ( player.mode !== state.lastMode || ! third ) {
			state.ready = false;
			state.lastMode = player.mode;
			return;
		}

		// All third-person systems may calculate their own desired view, but this final layer prevents
		// one-frame mouse/trackpad spikes, collision snaps and mode handoffs from throwing the camera.
		const desired = app.camera.position;
		if ( ! state.ready ) {
			state.stable.copy( desired );
			state.ready = true;
		} else {
			const dx = desired.x - state.stable.x;
			const dy = desired.y - state.stable.y;
			const dz = desired.z - state.stable.z;
			const jump = Math.hypot( dx, dy, dz );
			const maxStep = player.mode === 'relic' ? 2.6 : player.mode === 'boat' ? 2.0 : 1.25;
			if ( jump > maxStep ) {
				const s = maxStep / jump;
				state.stable.x += dx * s;
				state.stable.y += dy * s;
				state.stable.z += dz * s;
			} else {
				const response = player.mode === 'relic' ? 12 : player.mode === 'boat' ? 10 : 9;
				state.stable.lerp( desired, 1 - Math.exp( - dt * response ) );
			}
		}
		app.camera.position.copy( state.stable );

		// Rebuild a stable look target after smoothing so camera orientation cannot point past the player.
		if ( footThird ) {
			_target.copy( player.position );
			_target.y += player.mode === 'swim' ? 0.48 : 1.18;
			_target.y -= player.pitch * ( player.mode === 'swim' ? 0.55 : 0.78 );
			app.camera.lookAt( _target );
		}
	};

	player.__referenceClosureCamera = state;
	return state;
}

function installCharacterClosure( app ) {
	if ( app.__referenceCharacterClosure ) return app.__referenceCharacterClosure;
	const state = app.__referenceCharacterClosure = { raf: 0, lastT: 0 };
	const walkerState = new WeakMap();

	const tick = ( now ) => {
		const t = now * 0.001;
		const dt = state.lastT ? Math.min( 0.05, t - state.lastT ) : 1 / 60;
		state.lastT = t;
		const articulated = app.__referenceArticulatedCharacters;
		const player = app.player;
		const presentation = player?.__bermudaReferencePresentation;
		const third = presentation?.thirdPerson !== false;
		const playerRig = articulated?.playerRig;

		// First person must never render an external head/body into the near plane.
		if ( playerRig ) {
			const foot = player?.mode === 'walk' || player?.mode === 'swim';
			const dist = foot ? app.camera.position.distanceTo( player.position ) : Infinity;
			if ( ! third || dist < 1.8 ) playerRig.root.visible = false;
			if ( player?.mode === 'swim' && playerRig.root.visible ) {
				const speed = Math.hypot( player.velocity.x, player.velocity.y, player.velocity.z );
				const effort = Math.min( 1, speed / 2.4 );
				const phase = t * ( 4.6 + effort * 1.6 );
				// Freestyle with body roll and a softer kick instead of a rigid standing pose tipped forward.
				playerRig.pose.rotation.z = Math.sin( phase * 0.5 ) * 0.16 * effort;
				playerRig.leftArm.shoulder.rotation.z = -0.48 + Math.cos( phase ) * 0.18;
				playerRig.rightArm.shoulder.rotation.z = 0.48 - Math.cos( phase ) * 0.18;
				playerRig.leftArm.elbow.rotation.x = 0.38 + Math.max( 0, -Math.sin( phase ) ) * 1.18;
				playerRig.rightArm.elbow.rotation.x = 0.38 + Math.max( 0, Math.sin( phase ) ) * 1.18;
				const flutter = Math.sin( phase * 1.8 ) * 0.24 * ( 0.35 + 0.65 * effort );
				playerRig.leftLeg.hip.rotation.x = flutter;
				playerRig.rightLeg.hip.rotation.x = -flutter;
				playerRig.leftLeg.knee.rotation.x = 0.08 + Math.max( 0, -flutter ) * 0.65;
				playerRig.rightLeg.knee.rotation.x = 0.08 + Math.max( 0, flutter ) * 0.65;
			}
		}

		const staticPlayer = app.__exactReferenceCharacters?.playerModel;
		if ( staticPlayer && ( ! third || ( player && app.camera.position.distanceTo( player.position ) < 1.8 ) ) ) staticPlayer.visible = false;

		// Tie pedestrian gait to actual distance travelled so limbs slow at route turnarounds instead of
		// walking at full cadence while the body barely moves (the obvious foot-sliding defect).
		for ( const w of articulated?.walkers || [] ) {
			let s = walkerState.get( w );
			if ( ! s ) {
				s = { x: w.rig.root.position.x, z: w.rig.root.position.z, phase: Math.random() * Math.PI * 2 };
				walkerState.set( w, s );
			}
			const x = w.rig.root.position.x, z = w.rig.root.position.z;
			const speed = Math.min( 2.2, Math.hypot( x - s.x, z - s.z ) / Math.max( dt, 1e-3 ) );
			s.x = x; s.z = z;
			s.phase += speed * dt * 4.8;
			const k = Math.min( 1, speed / 1.55 );
			const swing = Math.sin( s.phase ) * 0.62 * k;
			w.rig.leftLeg.hip.rotation.x = swing;
			w.rig.rightLeg.hip.rotation.x = -swing;
			w.rig.leftLeg.knee.rotation.x = Math.max( 0, -swing ) * 0.82;
			w.rig.rightLeg.knee.rotation.x = Math.max( 0, swing ) * 0.82;
			w.rig.leftArm.shoulder.rotation.x = -swing * 0.72;
			w.rig.rightArm.shoulder.rotation.x = swing * 0.72;
			w.rig.leftArm.elbow.rotation.x = 0.12 + Math.max( 0, swing ) * 0.45;
			w.rig.rightArm.elbow.rotation.x = 0.12 + Math.max( 0, -swing ) * 0.45;
			w.rig.pose.position.y = 0.90 + Math.abs( Math.sin( s.phase ) ) * 0.026 * k;
		}

		state.raf = requestAnimationFrame( tick );
	};
	state.raf = requestAnimationFrame( tick );
	if ( typeof window !== 'undefined' ) window.addEventListener( 'pagehide', () => state.raf && cancelAnimationFrame( state.raf ), { once: true } );
	return state;
}

function installRelicClosure( app ) {
	const relic = app.player?.relic || app.relic001?.group?.userData?.vehicle || app.relic;
	if ( ! relic || relic.__referenceClosure ) return relic?.__referenceClosure;

	const state = relic.__referenceClosure = { lastMode: relic.driveMode };
	const baseSetMode = relic.setDriveMode.bind( relic );
	relic.setDriveMode = ( next, announce = true ) => {
		const ok = baseSetMode( next, announce );
		if ( ok ) {
			relic.cameraReady = false;
			state.lastMode = relic.driveMode;
			// A deliberate mode change should never inherit stale vertical momentum from the previous mode.
			if ( relic.driveMode === 'HOVER' || relic.driveMode === 'ROAD' ) relic.verticalSpeed = 0;
		}
		return ok;
	};

	// Make the transform controls self-explanatory and suppress impossible SUB input over shallow land.
	if ( typeof window !== 'undefined' ) {
		let timer = 0;
		const refresh = () => {
			const root = document.getElementById( 'bm-touch-stable' );
			if ( ! root || app.player?.mode !== 'relic' ) return;
			const mode = relic.driveMode;
			const down = root.querySelector( '[data-role="dive"]' );
			const up = root.querySelector( '[data-role="up"]' );
			if ( mode === 'HOVER' && down ) {
				const water = relic.waterSurfaceAt?.() ?? 0;
				const floor = relic.seaFloorAt?.( relic.position.x, relic.position.z ) ?? 0;
				const deep = floor <= water - 1.8;
				down.textContent = deep ? 'SUB' : 'SHALLOW';
				down.classList.toggle( 'is-muted', ! deep );
			}
			if ( ( mode === 'AIR' || mode === 'SUB' ) && up ) up.textContent = 'RISE';
		};
		timer = window.setInterval( refresh, 120 );
		window.addEventListener( 'pagehide', () => timer && clearInterval( timer ), { once: true } );
	}
	return state;
}

function installHudClosure() {
	if ( typeof document === 'undefined' || document.getElementById( 'reference-closure-style' ) ) return;
	const style = document.createElement( 'style' );
	style.id = 'reference-closure-style';
	style.textContent = `
		body.bm-mobile .gm-wallet-floating{font-variant-numeric:tabular-nums;min-width:84px;justify-content:center}
		body.bm-mobile .gm-clock-time,body.bm-mobile .gm-weather{font-variant-numeric:tabular-nums}
		body.bm-mobile #bm-touch-stable .bm-actions{z-index:74}
		body.bm-mobile .gm-map{z-index:73}
	`;
	document.head.appendChild( style );
}

export function installReferenceClosurePass( app ) {
	if ( ! app || app.__referenceClosurePass ) return app?.__referenceClosurePass;
	installHudClosure();
	const state = app.__referenceClosurePass = {
		camera: installCameraClosure( app ),
		characters: installCharacterClosure( app ),
		relic: installRelicClosure( app ),
	};
	if ( typeof window !== 'undefined' ) window.__referenceClosurePass = state;
	return state;
}
