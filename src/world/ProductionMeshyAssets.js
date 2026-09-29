import { Matrix4, Quaternion, Vector3 } from '../engine/index.js';
import { loadGLB } from '../engine/loaders/GLTF.js';
import { SkinnedModel } from '../engine/render/Skinning.js';
import { loadStaticAsset, placeStaticAsset } from './bermuda/StaticAsset.js';

const BASE = ((import.meta.env && import.meta.env.BASE_URL) || '/') + 'models/bermuda/';
const HERO = BASE + 'hero/';
const CHARACTERS = BASE + 'characters/';
const Y_AXIS = new Vector3( 0, 1, 0 );

function isMobileHardware() {
	if ( typeof navigator === 'undefined' ) return false;
	return /iPhone|iPad|iPod|Android/i.test( navigator.userAgent ) ||
		( navigator.maxTouchPoints > 1 && typeof screen !== 'undefined' && Math.min( screen.width, screen.height ) < 1024 );
}

function useMobileAssetTier() {
	if ( typeof location === 'undefined' ) return isMobileHardware();
	const params = new URLSearchParams( location.search );
	// ?desktop keeps the high-quality Bermuda WORLD path. On real phone hardware we still use the
	// efficient hero GLBs to avoid a second wave of 4K texture uploads freezing Safari. Developers
	// can explicitly force the large hero GLBs with ?assetDesktop when profiling.
	if ( params.has( 'assetDesktop' ) ) return false;
	return isMobileHardware();
}

function groundAt( app, x, z ) {
	const terrain = app.terrainData?.heightAt?.( x, z );
	const collider = app.colliders?.groundHeightAt?.( x, z, 30 );
	const y = Math.max( Number.isFinite( terrain ) ? terrain : -Infinity, Number.isFinite( collider ) ? collider : -Infinity );
	return Number.isFinite( y ) ? y : 0;
}

function tuneStaticMaterials( asset, kind ) {
	for ( const material of asset.materials.values() ) {
		if ( kind === 'relic' ) {
			material.roughness = Math.min( material.roughness, 0.22 );
			material.metalness = Math.max( material.metalness, 0.78 );
			material.localLightsCheap = false;
			material.receiveShadows = true;
			material.underwaterLighting = 'lite';
		} else {
			material.roughness = Math.max( 0.46, Math.min( material.roughness, 0.64 ) );
			material.metalness = Math.min( material.metalness, 0.08 );
			material.localLightsCheap = true;
			material.underwaterLighting = 'full';
		}
	}
}

function hideLegacyRelicRenderLayers( app ) {
	if ( app.__referenceRelicHeroShell?.root ) app.__referenceRelicHeroShell.root.visible = false;
	if ( app.__referenceExactVideoPass?.relic?.root ) app.__referenceExactVideoPass.relic.root.visible = false;

	const visual = app.__referenceRelicVisualClosure?.root;
	visual?.traverse?.( ( object ) => {
		if ( /haunch|side-sculpt|canopy-rail|hood-v-crease|nose-crease|diffuser-fin/.test( object.name || '' ) ) object.visible = false;
	} );

	app.relic001?.group?.traverse?.( ( object ) => {
		if ( object.name === 'relic-tire' || object.name === 'relic-rim' || object.name === 'relic-brake-disc' ) object.visible = false;
	} );
}

async function installProductionRelic( app, mobile ) {
	if ( ! app.relic001?.group ) throw new Error( 'RELIC gameplay object is not ready.' );
	const tier = mobile ? 'mobile' : 'desktop';
	const asset = await loadStaticAsset( HERO + tier + '/relic-001.glb', {
		id: 'production-relic-001',
		maxTriangles: mobile ? 220000 : 420000,
		maxTextureSize: mobile ? 2048 : 4096,
	} );
	tuneStaticMaterials( asset, 'relic' );

	const horizontalLongest = Math.max( asset.size.x, asset.size.z );
	const scale = 4.90 / Math.max( 0.01, horizontalLongest );
	const yaw = asset.size.x > asset.size.z ? Math.PI * 0.5 : 0;
	const node = placeStaticAsset( asset, [ { x: 0, y: 0.18, z: 0, yaw, scale } ] );
	node.name = 'MeshyProductionRELIC001';
	app.relic001.group.add( node );
	hideLegacyRelicRenderLayers( app );

	const state = { asset, node, scale, tier };
	app.__productionMeshyRelic = state;
	return state;
}

async function installProductionLobsters( app, mobile ) {
	const lobsters = app.game?.lobsters;
	if ( ! lobsters?.items?.length ) throw new Error( 'Lobster gameplay system is not ready.' );
	const tier = mobile ? 'mobile' : 'desktop';
	const asset = await loadStaticAsset( HERO + tier + '/bermuda-spiny-lobster.glb', {
		id: 'production-spiny-lobster',
		maxTriangles: mobile ? 150000 : 280000,
		maxTextureSize: mobile ? 2048 : 4096,
	} );
	tuneStaticMaterials( asset, 'lobster' );

	const horizontalLongest = Math.max( asset.size.x, asset.size.z );
	const baseScale = 0.92 / Math.max( 0.01, horizontalLongest );
	const modelYaw = asset.size.x > asset.size.z ? Math.PI * 0.5 : 0;
	const placements = lobsters.items.map( ( l ) => ( {
		x: l.x,
		y: lobsters.floorAt( l.x, l.z ) + 0.015,
		z: l.z,
		yaw: l.yaw + modelYaw,
		scale: baseScale * ( 0.92 + l.size * 0.15 ),
	} ) );
	const node = placeStaticAsset( asset, placements );
	node.name = 'MeshyProductionSpinyLobsters';
	app.scene.add( node );
	const instanceMeshes = node.children.filter( ( child ) => child.isInstancedMesh );
	if ( ! instanceMeshes.length ) throw new Error( 'Production lobster asset did not produce instanced meshes.' );

	const matrix = new Matrix4();
	const position = new Vector3();
	const rotation = new Quaternion();
	const scale = new Vector3();
	const originalUpdate = lobsters.update.bind( lobsters );

	const sync = () => {
		for ( let i = 0; i < lobsters.items.length; i ++ ) {
			const l = lobsters.items[ i ];
			const gameplayVisible = !! l.active && l.mesh.visible !== false;
			const s = gameplayVisible ? baseScale * ( 0.92 + l.size * 0.15 ) : 0.00001;
			position.set( l.x, lobsters.floorAt( l.x, l.z ) + 0.015, l.z );
			rotation.setFromAxisAngle( Y_AXIS, l.yaw + modelYaw );
			scale.setScalar( s );
			matrix.compose( position, rotation, scale );
			for ( const mesh of instanceMeshes ) mesh.setMatrixAt( i, matrix );
			l.mesh.visible = false;
		}
		for ( const mesh of instanceMeshes ) mesh.instanceMatrix.needsUpdate = true;
	};

	lobsters.update = ( dt, player, camera ) => {
		for ( const l of lobsters.items ) if ( l.active ) l.mesh.visible = true;
		originalUpdate( dt, player, camera );
		sync();
	};
	sync();

	const state = { asset, node, instanceMeshes, baseScale, tier };
	app.__productionMeshyLobsters = state;
	return state;
}

function remapAnimation( base, source, name ) {
	const animation = source.animations?.[ 0 ];
	if ( ! animation ) return null;
	const byName = new Map( base.nodes.map( ( node, index ) => [ node.name, index ] ) );
	const channels = [];
	for ( const channel of animation.channels ) {
		const sourceName = source.nodes[ channel.node ]?.name;
		const target = byName.get( sourceName );
		if ( target === undefined ) continue;
		// Gameplay owns locomotion and character dimensions. Bone-scale animation is unnecessary for
		// walk/run/swim and was able to make clothing/body meshes balloon on the retargeted character.
		if ( channel.path === 'scale' ) continue;
		if ( channel.path === 'translation' && /root|hips|pelvis/i.test( sourceName || '' ) ) continue;
		channels.push( { ...channel, node: target } );
	}
	return channels.length ? { name, duration: animation.duration, channels } : null;
}

function bindCharacterClips( base, walk, run, swim = null ) {
	const clips = [
		remapAnimation( base, walk, 'walk' ),
		remapAnimation( base, run, 'run' ),
		swim ? remapAnimation( base, swim, 'swim' ) : null,
	].filter( Boolean );
	base.animations = [ ...( base.animations || [] ).filter( ( a ) => ! [ 'walk', 'run', 'swim' ].includes( a.name ) ), ...clips ];
	return clips;
}

function characterHeight( gltf ) {
	let min = Infinity, max = -Infinity;
	for ( const mesh of gltf.meshes || [] ) for ( const primitive of mesh ) {
		const p = primitive.attributes.POSITION;
		if ( ! p ) continue;
		for ( let i = 1; i < p.array.length; i += 3 ) {
			min = Math.min( min, p.array[ i ] );
			max = Math.max( max, p.array[ i ] );
		}
	}
	return Number.isFinite( min ) && Number.isFinite( max ) ? Math.max( 0.01, max - min ) : 1.78;
}

async function loadCharacterSource( prefix, includeSwim = false ) {
	const [ base, walk, run, swim ] = await Promise.all( [
		loadGLB( CHARACTERS + prefix + '-rigged.glb' ),
		loadGLB( CHARACTERS + prefix + '-walk.glb' ),
		loadGLB( CHARACTERS + prefix + '-run.glb' ),
		includeSwim ? loadGLB( CHARACTERS + prefix + '-swim.glb' ) : Promise.resolve( null ),
	] );
	const clips = bindCharacterClips( base, walk, run, swim );
	const expected = includeSwim ? 3 : 2;
	if ( clips.length < expected ) throw new Error( prefix + ': production character animation clips could not be mapped to the rig.' );
	return { gltf: base, height: characterHeight( base ) };
}

async function createCharacter( source, targetHeight ) {
	const model = await SkinnedModel.create( source.gltf, {
		materials: () => ( { roughness: 0.78, metalness: 0 } ),
	} );
	for ( const material of model.materials ) {
		material.underwaterLighting = 'lite';
		material.localLightsCheap = true;
		material.receiveShadows = true;
	}
	model.group.scale.setScalar( targetHeight / source.height );
	model.group.visible = false;
	return model;
}

function playCharacter( model, name, speed ) {
	if ( ! model.clips.has( name ) ) return;
	if ( model.current !== name ) model.play( name, { fade: 0.20, loop: true, speed } );
	const layer = model.layers.find( ( l ) => l.target === 1 );
	if ( layer ) layer.speed = speed;
}

async function installProductionCharacters( app, constrained ) {
	const [ maleSource, femaleSource ] = await Promise.all( [
		loadCharacterSource( 'bermuda-player-male', true ),
		loadCharacterSource( 'bermuda-npc-female' ),
	] );
	const playerModel = await createCharacter( maleSource, 1.78 );
	playerModel.group.name = 'MeshyProductionPlayer';
	app.scene.add( playerModel.group );

	// Real phone hardware gets one high-quality moving NPC even when ?desktop is active. This avoids
	// constructing a second copy of the male skinned model/textures merely for a background walker.
	const routes = constrained ? [
		{ source: femaleSource, height: 1.70, x0: -51, z0: -55.9, range: 5.6, rate: 0.58, phase: 1.9 },
	] : [
		{ source: femaleSource, height: 1.70, x0: -51, z0: -55.9, range: 5.8, rate: 0.58, phase: 1.9 },
		{ source: maleSource, height: 1.78, x0: -99, z0: -56.2, range: 6.8, rate: 0.50, phase: 0.2 },
	];
	const movers = [];
	for ( const route of routes ) {
		const model = await createCharacter( route.source, route.height );
		model.group.name = 'MeshyProductionNPC';
		app.scene.add( model.group );
		movers.push( { ...route, model } );
	}

	let raf = 0;
	let last = 0;
	const tick = ( now ) => {
		const dt = last ? Math.min( 0.05, ( now - last ) / 1000 ) : 1 / 60;
		last = now;
		const player = app.player;
		const presentation = player?.__bermudaReferencePresentation;
		const third = presentation?.thirdPerson !== false;
		const walking = player?.mode === 'walk';
		const swimming = player?.mode === 'swim';
		const playerActive = walking || swimming;
		const camDistance = playerActive ? app.camera.position.distanceTo( player.position ) : 0;
		const speed = swimming
			? Math.hypot( player.velocity.x, player.velocity.y, player.velocity.z )
			: walking ? Math.hypot( player.velocity.x, player.velocity.z ) : 0;
		const showPlayer = !! playerActive && third && camDistance > 1.75;
		playerModel.group.visible = showPlayer;
		if ( showPlayer ) {
			playerModel.group.position.copy( player.position );
			playerModel.group.rotation.y = player.yaw + Math.PI;
			if ( swimming ) {
				const cadence = speed < 0.12 ? 0.62 : Math.max( 0.70, Math.min( 1.40, speed / 2.15 ) );
				playCharacter( playerModel, 'swim', cadence );
			} else {
				const running = speed > 3.15;
				playCharacter( playerModel, running ? 'run' : 'walk', running ? Math.max( 0.75, speed / 4.7 ) : speed < 0.12 ? 0 : Math.max( 0.55, speed / 2.1 ) );
			}
			playerModel.update( dt );
		} else playerModel.hold();

		const fallback = app.__referenceArticulatedCharacters?.playerRig?.root;
		if ( fallback && ( swimming || showPlayer ) ) fallback.scale.setScalar( 0.0001 );
		const staticIdle = app.__exactReferenceCharacters?.playerModel;
		if ( staticIdle && showPlayer ) staticIdle.visible = false;

		for ( let i = 0; i < movers.length; i ++ ) {
			const mover = movers[ i ];
			const a = now * 0.001 * mover.rate + mover.phase;
			const x = mover.x0 + Math.sin( a ) * mover.range;
			const velocity = Math.abs( Math.cos( a ) * mover.range * mover.rate );
			mover.model.group.position.set( x, groundAt( app, x, mover.z0 ), mover.z0 );
			mover.model.group.rotation.y = Math.cos( a ) >= 0 ? - Math.PI * 0.5 : Math.PI * 0.5;
			mover.model.group.visible = true;
			const running = velocity > 2.7;
			playCharacter( mover.model, running ? 'run' : 'walk', running ? Math.max( 0.75, velocity / 4.5 ) : Math.max( 0.35, velocity / 1.65 ) );
			mover.model.update( dt );
		}

		for ( const walker of app.__referenceArticulatedCharacters?.walkers || [] ) walker.rig.root.scale.setScalar( 0.0001 );
		raf = requestAnimationFrame( tick );
	};
	if ( typeof requestAnimationFrame === 'function' ) raf = requestAnimationFrame( tick );
	if ( typeof window !== 'undefined' ) window.addEventListener( 'pagehide', () => raf && cancelAnimationFrame( raf ), { once: true } );

	const state = { playerModel, movers, maleSource, femaleSource };
	app.__productionMeshyCharacters = state;
	return state;
}

function breathe( ms ) {
	return new Promise( ( resolve ) => setTimeout( resolve, ms ) );
}

export function installProductionMeshyAssets( app ) {
	if ( ! app?.scene ) return Promise.resolve( null );
	if ( app.__productionMeshyAssetsPromise ) return app.__productionMeshyAssetsPromise;
	app.__productionMeshyAssetsPromise = ( async () => {
		const hardwareMobile = isMobileHardware();
		const mobileAssets = useMobileAssetTier();
		const state = app.__productionMeshyAssets = {
			mobile: mobileAssets,
			hardwareMobile,
			relic: null,
			lobsters: null,
			characters: null,
			loaded: [],
			errors: [],
		};
		if ( typeof window !== 'undefined' ) window.__productionMeshyAssets = state;

		// Character visibility is the first user-facing problem when the replacement pass is late, so
		// load the real rig first. Hero meshes follow one at a time with breathing room between GPU
		// uploads on iPhone. This keeps ?desktop world quality while avoiding the previous asset spike.
		for ( const [ id, install ] of [
			[ 'characters', () => installProductionCharacters( app, hardwareMobile ) ],
			[ 'lobsters', () => installProductionLobsters( app, mobileAssets ) ],
			[ 'relic', () => installProductionRelic( app, mobileAssets ) ],
		] ) {
			if ( hardwareMobile && state.loaded.length ) await breathe( id === 'relic' ? 2400 : 1400 );
			try {
				state[ id ] = await install();
				state.loaded.push( id );
			} catch ( error ) {
				state.errors.push( { id, message: String( error?.message || error ) } );
				console.warn( `Production Meshy ${ id } integration failed; keeping validated fallback.`, error );
			}
		}
		state.ready = state.loaded.length === 3;
		return state;
	} )();
	return app.__productionMeshyAssetsPromise;
}