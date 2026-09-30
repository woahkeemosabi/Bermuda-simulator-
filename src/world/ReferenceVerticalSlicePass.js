import { Group, Vector3 } from '../engine/index.js';
import { placeStaticAsset } from './bermuda/StaticAsset.js';
import { installReferenceStreetLifeModels } from './ReferenceStreetLifeModels.js';
import { HOUSE } from './boat/Wheelhouse.js';

const WORLD_SAVE_KEY = 'bermuda.world.v1';
const _forward = new Vector3();
const _eye = new Vector3();
const _target = new Vector3();

function safeStorage() {
	try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch ( _ ) { return null; }
}

function installWorldPersistence( app ) {
	if ( app.__bermudaWorldPersistence ) return app.__bermudaWorldPersistence;
	const storage = safeStorage();
	let restored = false;
	let lastSave = 0;

	const restore = () => {
		if ( restored || ! storage || ! app.player?.boat || ! app.relic ) return false;
		restored = true;
		try {
			const qs = typeof location !== 'undefined' ? new URLSearchParams( location.search ) : null;
			if ( qs?.get( 'resetWorld' ) === '1' ) { storage.removeItem( WORLD_SAVE_KEY ); return true; }
			const raw = storage.getItem( WORLD_SAVE_KEY );
			if ( ! raw ) return true;
			const d = JSON.parse( raw );
			if ( ! d || d.v !== 1 ) return true;
			const b = app.player.boat;
			if ( Array.isArray( d.boat?.p ) && d.boat.p.length === 3 ) b.position.set( ...d.boat.p );
			if ( Array.isArray( d.boat?.q ) && d.boat.q.length === 4 ) b.quaternion.set( ...d.boat.q );
			b.anchored = !! d.boat?.anchored;
			b.moored = !! d.boat?.moored;
			if ( Array.isArray( d.boat?.anchor ) && d.boat.anchor.length === 3 ) b.anchorPosition.set( ...d.boat.anchor );
			if ( Number.isFinite( d.boat?.anchorHeading ) ) b.anchorHeading = d.boat.anchorHeading;
			b.velocity.set( 0, 0, 0 ); b.angular.set( 0, 0, 0 ); b.throttle = 0; b.apply();

			const r = app.relic;
			if ( d.relic?.mode && r.setDriveMode ) r.setDriveMode( d.relic.mode, false );
			if ( Array.isArray( d.relic?.p ) && d.relic.p.length === 3 ) r.position.set( ...d.relic.p );
			if ( Number.isFinite( d.relic?.yaw ) ) { r.yaw = d.relic.yaw; r.group.rotation.y = r.yaw; }
			r.speed = 0; r.verticalSpeed = 0; r.syncBodyCollider?.(); r.group.updateMatrixWorld?.( true );

			if ( Number.isFinite( d.timeOfDay ) ) app.settings.timeOfDay = d.timeOfDay;
			if ( typeof d.weatherMode === 'string' ) app.settings.weatherMode = d.weatherMode;
			app.updateSun?.();
		} catch ( error ) { console.warn( 'Bermuda world-state restore skipped.', error ); }
		return true;
	};

	const save = () => {
		if ( ! storage || ! restored || ! app.player?.boat || ! app.relic ) return;
		const b = app.player.boat, r = app.relic;
		try {
			storage.setItem( WORLD_SAVE_KEY, JSON.stringify( {
				v: 1,
				boat: {
					p: b.position.toArray(), q: b.quaternion.toArray(), anchored: !! b.anchored, moored: !! b.moored,
					anchor: b.anchorPosition?.toArray?.() || b.position.toArray(), anchorHeading: b.anchorHeading,
				},
				relic: { p: r.position.toArray(), yaw: r.yaw, mode: r.driveMode },
				timeOfDay: app.settings.timeOfDay, weatherMode: app.settings.weatherMode,
			} ) );
		} catch ( _ ) { /* storage may be blocked; gameplay continues */ }
	};

	const tick = ( now ) => {
		restore();
		if ( restored && now - lastSave > 2000 ) { lastSave = now; save(); }
		requestAnimationFrame( tick );
	};
	requestAnimationFrame( tick );
	if ( typeof window !== 'undefined' ) window.addEventListener( 'pagehide', save );
	const state = app.__bermudaWorldPersistence = { restore, save, key: WORLD_SAVE_KEY };
	return state;
}

function installBoatReferencePresentation( app, assets ) {
	if ( app.__disableVisiblePlayer ) return null;
	if ( app.__bermudaBoatReferencePresentation || ! assets?.maleAsset || ! app.player?.boat?.model?.group ) return app.__bermudaBoatReferencePresentation;
	const player = app.player;
	const boat = player.boat;
	const asset = assets.maleAsset;
	const scale = 1.78 / Math.max( 0.01, asset.size.y );
	const root = new Group();
	root.name = 'ReferenceBoatCharacters';
	app.scene.add( root );

	const deckAvatar = placeStaticAsset( asset, [ { x: 0, y: 0, z: 0, yaw: 0, scale } ] );
	deckAvatar.name = 'ReferenceDeckPlayer';
	root.add( deckAvatar );

	const helmAvatar = placeStaticAsset( asset, [ { x: 0, y: 0, z: 0, yaw: 0, scale } ] );
	helmAvatar.name = 'ReferenceHelmPlayer';
	boat.model.group.add( helmAvatar );
	const deckY = boat.model.lines?.deckY ?? 0.72;
	helmAvatar.position.set( HOUSE.helmX, deckY - 0.08, HOUSE.seatZ );
	helmAvatar.rotation.y = Math.PI;
	helmAvatar.rotation.x = -0.05;

	const baseDeck = player.updateDeck.bind( player );
	player.updateDeck = ( dt ) => {
		baseDeck( dt );
		if ( player.mode !== 'deck' || player.__bermudaReferencePresentation?.thirdPerson === false ) return;
		_target.copy( player.position ); _target.y += 1.08;
		_forward.set( - Math.sin( player.yaw ), 0, - Math.cos( player.yaw ) ).normalize();
		_eye.copy( _target ).addScaledVector( _forward, -4.7 ); _eye.y += 1.85;
		if ( ! player.camInit ) { player.camPos.copy( _eye ); player.camInit = true; }
		else player.camPos.lerp( _eye, 1 - Math.exp( - dt * 8 ) );
		app.camera.position.copy( player.camPos ); app.camera.lookAt( _target );
	};

	let lastMode = player.mode;
	const tick = () => {
		const third = player.__bermudaReferencePresentation?.thirdPerson !== false;
		deckAvatar.visible = ! app.__disableVisiblePlayer && player.mode === 'deck' && third;
		if ( deckAvatar.visible ) {
			deckAvatar.position.copy( player.position );
			deckAvatar.rotation.y = player.yaw + Math.PI;
			const speed = Math.hypot( player.deckVel?.x || 0, player.deckVel?.z || 0 );
			deckAvatar.position.y += Math.abs( Math.sin( performance.now() * 0.008 ) ) * Math.min( 0.025, speed * 0.012 );
		}
		helmAvatar.visible = ! app.__disableVisiblePlayer && player.mode === 'boat' && player.camMode === 'third';
		if ( player.mode !== lastMode ) {
			if ( player.mode === 'deck' ) player.camInit = false;
			if ( player.mode === 'boat' && player.camMode === 'third' ) {
				player.orbitDist = 9.2;
				player.orbitPitch = 0.24;
				player.camInit = false;
			}
			lastMode = player.mode;
		}
		requestAnimationFrame( tick );
	};
	requestAnimationFrame( tick );

	const state = app.__bermudaBoatReferencePresentation = { root, deckAvatar, helmAvatar };
	return state;
}

export function installReferenceVerticalSlicePass( app ) {
	if ( ! app || app.__bermudaVerticalSlicePass ) return app?.__bermudaVerticalSlicePass;
	const state = app.__bermudaVerticalSlicePass = { boatPresentation: null, persistence: null };
	state.persistence = installWorldPersistence( app );
	if ( ! app.__disableVisiblePlayer ) {
		void installReferenceStreetLifeModels( app ).then( assets => {
			state.boatPresentation = installBoatReferencePresentation( app, assets );
		} ).catch( error => console.warn( 'Reference boat-character pass kept existing fallback.', error ) );
	}
	if ( typeof window !== 'undefined' ) window.__bermudaVerticalSlicePass = state;
	return state;
}
