// Final presentation repair for the Meshy skinned characters. The gameplay controller remains
// authoritative; this only removes animation root-motion conflicts and smooths visual feet/yaw.

const ROOT_RE = /root|hips|pelvis/i;
const LOCOMOTION = new Set( [ 'walk', 'run', 'swim' ] );

function damp( current, target, speed, dt ) {
	return current + ( target - current ) * ( 1 - Math.exp( - speed * dt ) );
}

function dampAngle( current, target, speed, dt ) {
	let delta = ( target - current + Math.PI ) % ( Math.PI * 2 ) - Math.PI;
	if ( delta < - Math.PI ) delta += Math.PI * 2;
	return current + delta * ( 1 - Math.exp( - speed * dt ) );
}

function stripLocomotionRootMotion( model ) {
	if ( ! model?.clips || model.__bermudaRootMotionStripped ) return;
	for ( const [ name, clip ] of model.clips ) {
		if ( ! LOCOMOTION.has( name ) || ! Array.isArray( clip.channels ) ) continue;
		clip.channels = clip.channels.filter( ( channel ) => {
			if ( channel.path !== 'translation' ) return true;
			const nodeName = model.gltf?.nodes?.[ channel.node ]?.name || '';
			return ! ROOT_RE.test( nodeName );
		} );
	}
	model.__bermudaRootMotionStripped = true;
}

function stabilizeModel( model, { npc = false } = {} ) {
	if ( ! model || model.__bermudaMotionStable ) return;
	model.__bermudaMotionStable = true;
	stripLocomotionRootMotion( model );

	const realUpdate = model.update.bind( model );
	const visual = {
		ready: false,
		y: 0,
		yaw: 0,
		rawX: 0,
		rawZ: 0,
	};

	model.update = ( dt ) => {
		const group = model.group;
		const rawX = group.position.x, rawY = group.position.y, rawZ = group.position.z, rawYaw = group.rotation.y;
		if ( ! visual.ready ) {
			visual.ready = true;
			visual.y = rawY;
			visual.yaw = rawYaw;
			visual.rawX = rawX;
			visual.rawZ = rawZ;
		}

		const frameDt = Math.max( 1 / 240, Math.min( 0.05, Number( dt ) || 1 / 60 ) );
		const planarSpeed = Math.hypot( rawX - visual.rawX, rawZ - visual.rawZ ) / frameDt;
		visual.rawX = rawX; visual.rawZ = rawZ;

		// Terrain/collider height can change by a few centimetres frame-to-frame at road edges. Smooth
		// only the rendered body's vertical placement; never delay gameplay X/Z movement.
		visual.y = damp( visual.y, rawY, npc ? 11 : 18, frameDt );
		visual.yaw = dampAngle( visual.yaw, rawYaw, npc ? 7.5 : 13, frameDt );
		group.position.y = visual.y;
		group.rotation.y = visual.yaw;

		// Production walk clips previously kept stepping while the sinusoidal NPC route almost stopped
		// at its turnarounds. Freeze the locomotion timeline when the body is effectively stationary,
		// then resume cadence from actual travel speed. This removes the obvious foot skating.
		const layer = model.layers?.find( ( item ) => item.target === 1 );
		if ( layer && ( layer.clip?.name === 'walk' || layer.clip?.name === 'run' ) ) {
			if ( planarSpeed < 0.10 ) layer.speed = 0;
			else if ( npc && layer.clip.name === 'walk' ) layer.speed = Math.max( 0.58, Math.min( 1.18, planarSpeed / 1.45 ) );
		}

		realUpdate( frameDt );
	};
}

export class CharacterMotionStability {
	constructor( app ) {
		this.app = app;
		this.done = false;
		this.tries = 0;
		this.timer = setInterval( () => this.tryInstall(), 250 );
		this.tryInstall();
	}

	tryInstall() {
		if ( this.done ) return;
		this.tries ++;
		const chars = this.app.__productionMeshyCharacters || this.app.__productionMeshyAssets?.characters;
		if ( ! chars?.playerModel ) {
			if ( this.tries > 240 ) clearInterval( this.timer );
			return;
		}

		stabilizeModel( chars.playerModel, { npc: false } );
		for ( const mover of chars.movers || [] ) stabilizeModel( mover.model, { npc: true } );

		// Do not let retired procedural people reappear because another visual pass toggled visibility.
		const retireLegacy = () => {
			const fallback = this.app.__referenceArticulatedCharacters;
			if ( fallback?.playerRig?.root ) fallback.playerRig.root.scale.setScalar( 0.0001 );
			for ( const walker of fallback?.walkers || [] ) walker.rig.root.scale.setScalar( 0.0001 );
		};
		retireLegacy();
		this.app.__characterMotionStable = { characters: chars, retireLegacy };
		this.done = true;
		clearInterval( this.timer );
	}
}
