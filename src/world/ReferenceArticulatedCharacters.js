import { BoxGeometry, CylinderGeometry, Group, Mesh, SphereGeometry } from '../engine/index.js';
import { Material } from '../engine/render/Material.js';

function mat( name, color, roughness = 0.88 ) {
	return new Material( {
		name: `bermuda-articulated-${ name }`, color, roughness, metalness: 0,
		underwaterLighting: 'lite', localLightsCheap: true, receiveShadows: true,
	} );
}

function add( parent, geo, material, p, s, name = '' ) {
	const m = new Mesh( geo, material );
	m.name = name;
	m.position.set( ...p );
	m.scale.set( ...s );
	m.castShadow = false;
	m.receiveShadow = true;
	parent.add( m );
	return m;
}

function makeRig( G, M, outfit ) {
	const root = new Group();
	const pose = new Group();
	pose.position.y = 0.90;
	root.add( pose );

	add( pose, G.cyl, outfit.shirt, [ 0, 0.38, 0 ], [ 0.25, 0.36, 0.21 ], 'torso' );
	add( pose, G.sphere, outfit.skin, [ 0, 0.94, 0 ], [ 0.17, 0.21, 0.17 ], 'head' );
	add( pose, G.box, outfit.hair, [ 0, 1.08, -0.01 ], [ 0.18, 0.055, 0.17 ], 'hair' );
	add( pose, G.box, outfit.pants, [ 0, 0.04, 0 ], [ 0.39, 0.18, 0.22 ], 'hips' );

	const makeLeg = ( x, side ) => {
		const hip = new Group(); hip.position.set( x, -0.04, 0 ); pose.add( hip );
		add( hip, G.cyl, outfit.pants, [ 0, -0.21, 0 ], [ 0.095, 0.23, 0.095 ], `thigh-${ side }` );
		const knee = new Group(); knee.position.set( 0, -0.43, 0 ); hip.add( knee );
		add( knee, G.sphere, outfit.pants, [ 0, 0, 0 ], [ 0.105, 0.09, 0.105 ], `knee-${ side }` );
		add( knee, G.cyl, outfit.pants, [ 0, -0.21, 0 ], [ 0.082, 0.23, 0.082 ], `shin-${ side }` );
		add( knee, G.box, outfit.shoe, [ 0, -0.45, 0.08 ], [ 0.15, 0.075, 0.25 ], `shoe-${ side }` );
		return { hip, knee };
	};

	const makeArm = ( x, side ) => {
		const shoulder = new Group(); shoulder.position.set( x, 0.61, 0 ); pose.add( shoulder );
		add( shoulder, G.sphere, outfit.shirt, [ 0, 0, 0 ], [ 0.105, 0.105, 0.105 ], `shoulder-${ side }` );
		add( shoulder, G.cyl, outfit.skin, [ 0, -0.18, 0 ], [ 0.068, 0.20, 0.068 ], `upper-arm-${ side }` );
		const elbow = new Group(); elbow.position.set( 0, -0.37, 0 ); shoulder.add( elbow );
		add( elbow, G.sphere, outfit.skin, [ 0, 0, 0 ], [ 0.075, 0.07, 0.075 ], `elbow-${ side }` );
		add( elbow, G.cyl, outfit.skin, [ 0, -0.17, 0 ], [ 0.060, 0.19, 0.060 ], `forearm-${ side }` );
		add( elbow, G.sphere, outfit.skin, [ 0, -0.36, 0 ], [ 0.070, 0.085, 0.060 ], `hand-${ side }` );
		return { shoulder, elbow };
	};

	const leftLeg = makeLeg( -0.13, 'l' );
	const rightLeg = makeLeg( 0.13, 'r' );
	const leftArm = makeArm( -0.31, 'l' );
	const rightArm = makeArm( 0.31, 'r' );
	root.scale.setScalar( 0.86 );
	return { root, pose, leftLeg, rightLeg, leftArm, rightArm };
}

function animateWalk( rig, speed, t ) {
	const k = Math.min( 1, speed / 2.8 );
	const phase = t * ( 7.0 + Math.min( 4.5, speed ) );
	const s = Math.sin( phase ), c = Math.cos( phase );
	const stride = 0.70 * k;
	rig.leftLeg.hip.rotation.x = s * stride;
	rig.rightLeg.hip.rotation.x = -s * stride;
	rig.leftLeg.knee.rotation.x = Math.max( 0, -s ) * 0.75 * k;
	rig.rightLeg.knee.rotation.x = Math.max( 0, s ) * 0.75 * k;
	rig.leftArm.shoulder.rotation.x = -s * 0.58 * k;
	rig.rightArm.shoulder.rotation.x = s * 0.58 * k;
	rig.leftArm.elbow.rotation.x = 0.12 + Math.max( 0, s ) * 0.48 * k;
	rig.rightArm.elbow.rotation.x = 0.12 + Math.max( 0, -s ) * 0.48 * k;
	rig.leftArm.shoulder.rotation.z = -0.04;
	rig.rightArm.shoulder.rotation.z = 0.04;
	rig.pose.rotation.x += ( Math.min( 0.08, speed * 0.012 ) - rig.pose.rotation.x ) * 0.18;
	rig.pose.rotation.z = c * 0.022 * k;
	rig.pose.position.y = 0.90 + Math.abs( Math.sin( phase ) ) * 0.035 * k;
}

function animateSwim( rig, speed, t ) {
	const k = Math.max( 0.35, Math.min( 1, speed / 1.8 ) );
	const phase = t * 5.0;
	const s = Math.sin( phase ), c = Math.cos( phase );
	rig.leftArm.shoulder.rotation.x = -0.55 + s * 1.05;
	rig.rightArm.shoulder.rotation.x = -0.55 - s * 1.05;
	rig.leftArm.shoulder.rotation.z = -0.38 + c * 0.20;
	rig.rightArm.shoulder.rotation.z = 0.38 - c * 0.20;
	rig.leftArm.elbow.rotation.x = 0.45 + Math.max( 0, -s ) * 1.05;
	rig.rightArm.elbow.rotation.x = 0.45 + Math.max( 0, s ) * 1.05;
	const kick = Math.sin( phase * 1.65 ) * 0.28 * k;
	rig.leftLeg.hip.rotation.x = kick;
	rig.rightLeg.hip.rotation.x = -kick;
	rig.leftLeg.knee.rotation.x = Math.max( 0, -kick ) * 0.55;
	rig.rightLeg.knee.rotation.x = Math.max( 0, kick ) * 0.55;
	rig.pose.rotation.x += ( -1.28 - rig.pose.rotation.x ) * 0.22;
	rig.pose.rotation.z = Math.sin( phase * 0.5 ) * 0.12;
	rig.pose.position.y += ( 0.04 - rig.pose.position.y ) * 0.20;
}

export function installReferenceArticulatedCharacters( app ) {
	if ( ! app?.scene || app.__referenceArticulatedCharacters ) return app?.__referenceArticulatedCharacters;

	const root = new Group();
	root.name = 'ReferenceArticulatedCharacters';
	app.scene.add( root );
	const G = {
		box: new BoxGeometry( 1, 1, 1 ),
		cyl: new CylinderGeometry( 1, 1, 1, 12 ),
		sphere: new SphereGeometry( 1, 12, 10 ),
	};
	const common = {
		skin: mat( 'skin', 0x8b5a43 ), hair: mat( 'hair', 0x16120f, 0.97 ), shoe: mat( 'shoe', 0x111417, 0.96 ),
	};
	const playerOutfit = { ...common, shirt: mat( 'player-white-shirt', 0xe8e7e0, 0.90 ), pants: mat( 'player-tan-pants', 0xb5aa88, 0.93 ) };
	const npcOutfits = [
		{ ...common, shirt: mat( 'npc-coral-shirt', 0xa96059 ), pants: mat( 'npc-dark-pants', 0x283038 ) },
		{ ...common, shirt: mat( 'npc-blue-shirt', 0x4b7288 ), pants: mat( 'npc-khaki', 0x8c866e ) },
		{ ...common, shirt: mat( 'npc-teal-shirt', 0x4e7775 ), pants: mat( 'npc-navy', 0x242b36 ) },
	];

	const playerRig = makeRig( G, common, playerOutfit );
	playerRig.root.name = 'ReferenceArticulatedPlayer';
	playerRig.root.visible = false;
	root.add( playerRig.root );

	const oldPlayer = app.bermudaReferenceFinal?.playerPresentation?.avatar?.root;
	if ( oldPlayer ) oldPlayer.scale.setScalar( 0.0001 );
	for ( const w of app.bermudaReferenceFinal?.walkers || [] ) w.root.scale.setScalar( 0.0001 );

	const walkers = [
		{ rig: makeRig( G, common, npcOutfits[ 0 ] ), x0: -101, z0: -56.2, range: 7.0, rate: 0.62, phase: 0.1 },
		{ rig: makeRig( G, common, npcOutfits[ 1 ] ), x0: -51, z0: -55.9, range: 6.0, rate: 0.74, phase: 1.9 },
		{ rig: makeRig( G, common, npcOutfits[ 2 ] ), x0: -30, z0: -56.0, range: 4.8, rate: 0.56, phase: 3.2 },
	];
	for ( const w of walkers ) { w.rig.root.name = 'ReferenceArticulatedNPC'; root.add( w.rig.root ); }

	const groundAt = ( x, z ) => {
		const terrain = app.terrainData.heightAt( x, z );
		const coll = app.colliders?.groundHeightAt( x, z, 30 ) ?? - Infinity;
		return Math.max( terrain, Number.isFinite( coll ) ? coll : terrain );
	};

	let raf = 0;
	const tick = ( now ) => {
		const t = now * 0.001;
		const player = app.player;
		const presentation = player?.__bermudaReferencePresentation;
		const third = presentation?.thirdPerson !== false;
		const footMode = player && ( player.mode === 'walk' || player.mode === 'swim' );
		const speed = footMode ? Math.hypot( player.velocity.x, player.velocity.y, player.velocity.z ) : 0;
		const camDistance = footMode ? app.camera.position.distanceTo( player.position ) : 0;
		const movingPose = player?.mode === 'swim' || speed > 0.18;

		// The segmented rig is a last-resort fallback only. As soon as the production character stream
		// claims presentation, never show this body again while GLBs/animation clips finish loading.
		// An empty third-person body for a brief moment is preferable to the visibly broken stick swimmer.
		const productionClaimed = !! app.__productionMeshyAssets || !! app.__productionMeshyCharacters;
		const showPlayer = !! footMode && third && movingPose && camDistance > 1.55 && ! productionClaimed;
		playerRig.root.visible = showPlayer;
		if ( showPlayer ) {
			playerRig.root.position.copy( player.position );
			playerRig.root.rotation.y = player.yaw + Math.PI;
			if ( player.mode === 'swim' ) animateSwim( playerRig, speed, t );
			else animateWalk( playerRig, speed, t );
		}
		app.__articulatedReferencePlayerVisible = showPlayer;

		for ( const w of walkers ) {
			const a = t * w.rate + w.phase;
			const x = w.x0 + Math.sin( a ) * w.range;
			w.rig.root.position.set( x, groundAt( x, w.z0 ), w.z0 );
			w.rig.root.rotation.y = Math.cos( a ) >= 0 ? -Math.PI * 0.5 : Math.PI * 0.5;
			animateWalk( w.rig, 1.6, t + w.phase );
		}
		raf = requestAnimationFrame( tick );
	};
	raf = requestAnimationFrame( tick );
	if ( typeof window !== 'undefined' ) window.addEventListener( 'pagehide', () => raf && cancelAnimationFrame( raf ), { once: true } );

	const state = app.__referenceArticulatedCharacters = { root, playerRig, walkers };
	if ( typeof window !== 'undefined' ) window.__referenceArticulatedCharacters = state;
	return state;
}
