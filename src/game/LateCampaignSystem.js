import { BoxGeometry, Color, Group, Mesh, SphereGeometry, Vector3 } from '../engine/index.js';
import { Material } from '../engine/render/Material.js';
import { RELIC_POS } from '../world/Relic001.js';
import { RELIC_STORY } from '../world/RelicStory.js';
import { loadStaticAsset, placeStaticAsset } from '../world/bermuda/StaticAsset.js';

const M = Object.freeze( {
	BLACK: 'main-black-car',
	BLUE: 'main-blue-hole',
	SIGNAL: 'main-strange-signal',
	DOOR: 'main-limestone-door',
	FINAL: 'main-road-was-never-the-test',
} );

const FACILITY = Object.freeze( {
	x: 480,
	y: 32,
	z: -480,
	entryZ: -454,
	bayZ: -492,
	exitZ: -446,
	width: 15,
	depth: 58,
} );

const CAMPAIGN_ASSET_BASE = ( ( import.meta.env && import.meta.env.BASE_URL ) || '/' ) + 'models/bermuda/campaign/mobile/';
const TMP = new Vector3();

function mobileHardware() {
	if ( typeof navigator === 'undefined' ) return false;
	return /iPhone|iPad|iPod|Android/i.test( navigator.userAgent ) ||
		( navigator.maxTouchPoints > 1 && typeof screen !== 'undefined' && Math.min( screen.width, screen.height ) < 1024 );
}

function gpuSafeLevel() {
	try { return Math.max( 0, Number( new URLSearchParams( location.search ).get( 'gpuSafe' ) || 0 ) ); }
	catch ( _ ) { return 0; }
}

function mat( name, color, roughness = 0.75, metalness = 0, emissive = 0x000000 ) {
	return new Material( {
		name: `campaign-${ name }`, color, roughness, metalness, emissive,
		underwaterLighting: 'lite', localLightsCheap: true, receiveShadows: true,
	} );
}

function addBox( group, material, size, position, name ) {
	const mesh = new Mesh( new BoxGeometry( size[ 0 ], size[ 1 ], size[ 2 ] ), material );
	mesh.name = name;
	mesh.position.set( position[ 0 ], position[ 1 ], position[ 2 ] );
	mesh.castShadow = true;
	mesh.receiveShadow = true;
	group.add( mesh );
	return mesh;
}

function horizontalDistance( a, b ) {
	return Math.hypot( a.x - b.x, a.z - b.z );
}

export class LateCampaignSystem {
	constructor( app ) {
		this.app = app;
		this.game = app.game;
		this.state = app.game.state;
		this.player = app.player;
		this.input = app.input;
		this.director = app.missionDirector;
		this.joe = app.game?.stand?.vendor || null;
		this.assetLoads = new Map();
		this.finalPlaced = false;
		this.finalDriveOrigin = null;
		this.lastSignalStep = -1;
		this.buildMissionWorld();

		const originalUpdate = this.player.update.bind( this.player );
		this.player.update = ( dt ) => {
			originalUpdate( dt );
			this.update( dt );
		};
		app.lateCampaign = this;
	}

	available( id ) { return !! this.director?.available?.( id ); }
	active( id ) { return !! this.director?.active?.( id ); }
	completed( id ) { return !! this.director?.completed?.( id ); }
	night() {
		const h = ( Number( this.app.settings?.timeOfDay || 0 ) + 24 ) % 24;
		return h >= 19.5 || h < 5.5;
	}
	consumeAct() { this.input?.pressed?.delete?.( 'KeyE' ); }
	setFlag( key, value = true ) {
		this.state.storyFlags[ key ] = value;
		this.state.save(); this.state.emit();
	}
	nearJoe() { return !! this.joe?.inRange?.( this.player.position ); }

	buildMissionWorld() {
		const dark = mat( 'graphite', 0x090c11, 0.2, 0.82 );
		const rubber = mat( 'track-rubber', 0x151515, 0.96, 0.02 );
		const alloy = mat( 'artifact-alloy', 0x29323b, 0.27, 0.82 );
		const amber = mat( 'artifact-amber', 0x4c2208, 0.24, 0.48, 0xff6a16 );
		const limestone = mat( 'facility-limestone', 0xd8d3c7, 0.94, 0.01 );
		const red = mat( 'red-room-light', 0x3c070a, 0.32, 0.3, 0xff1827 );

		// Mission 11: tyre marks / residue left after the Black Car encounter.
		this.tracks = new Group();
		this.tracks.name = 'CampaignBlackCarTracks';
		const tx = RELIC_POS.x + 5.8, tz = RELIC_POS.z + 1.4;
		const ty = this.app.terrainData.heightAt( tx, tz ) + 0.025;
		for ( const side of [ -0.72, 0.72 ] ) {
			const strip = addBox( this.tracks, rubber, [ 0.12, 0.025, 3.6 ], [ side, 0, 0 ], 'black-car-track' );
			strip.rotation.y = -0.12;
		}
		addBox( this.tracks, amber, [ 0.16, 0.055, 0.32 ], [ 0.05, 0.045, -0.35 ], 'black-car-residue' );
		this.tracks.position.set( tx, ty, tz );
		this.app.scene.add( this.tracks );

		// Mission 12: recoverable artificial component. Procedural geometry is the guaranteed fallback;
		// a Meshy GLB can replace it lazily when the mission becomes active.
		this.component = new Group();
		this.component.name = 'CampaignBlueHoleComponent';
		addBox( this.component, alloy, [ 0.82, 0.34, 0.48 ], [ 0, 0, 0 ], 'component-core' );
		addBox( this.component, dark, [ 0.18, 0.52, 0.58 ], [ -0.32, 0.02, 0 ], 'component-fin-a' );
		addBox( this.component, dark, [ 0.18, 0.52, 0.58 ], [ 0.32, 0.02, 0 ], 'component-fin-b' );
		addBox( this.component, amber, [ 0.04, 0.20, 0.50 ], [ 0.08, 0.06, 0.25 ], 'component-amber-slit' );
		const blueFloor = this.app.terrainData.heightAt( RELIC_STORY.submersion.x, RELIC_STORY.submersion.z );
		this.component.position.set( RELIC_STORY.submersion.x, Math.min( -1.9, blueFloor + 0.9 ), RELIC_STORY.submersion.z );
		this.component.rotation.y = 0.42;
		this.app.scene.add( this.component );

		// Mission 13: sequential underwater signal pings leading toward the covert tunnel.
		this.signalPoints = [
			{ x: -88.5, z: 10.0 },
			{ x: -92.3, z: 12.3 },
			{ x: RELIC_STORY.underwaterTunnel.x, z: RELIC_STORY.underwaterTunnel.z },
		].map( ( p ) => ( { ...p, y: Math.min( -1.4, this.app.terrainData.heightAt( p.x, p.z ) + 1.5 ) } ) );
		this.signalGroup = new Group();
		this.signalGroup.name = 'CampaignSignalPings';
		this.signalMarkers = this.signalPoints.map( ( p, i ) => {
			const m = new Mesh( new SphereGeometry( i === 2 ? 0.22 : 0.16, 8, 6 ), amber );
			m.name = `strange-signal-${ i + 1 }`;
			m.position.set( p.x, p.y, p.z );
			m.castShadow = false;
			this.signalGroup.add( m );
			return m;
		} );
		this.app.scene.add( this.signalGroup );

		// Mission 14: a physical engineered slab behind the existing limestone throat.
		this.door = new Group();
		this.door.name = 'CampaignLimestoneDoor';
		addBox( this.door, dark, [ 3.5, 3.7, 0.24 ], [ 0, 0, 0 ], 'limestone-door-panel' );
		addBox( this.door, amber, [ 0.055, 2.7, 0.035 ], [ 0, 0, 0.14 ], 'limestone-door-needle' );
		const tunnelY = this.app.relicStory?.tunnel?.position?.y ?? Math.min( -1.8, this.app.terrainData.heightAt( RELIC_STORY.underwaterTunnel.x, RELIC_STORY.underwaterTunnel.z ) + 2.35 );
		this.door.position.set( RELIC_STORY.underwaterTunnel.x, tunnelY, RELIC_STORY.underwaterTunnel.z + 0.62 );
		this.app.scene.add( this.door );

		// Mission 15: small, isolated Red Room test facility. It is deliberately far from the island so
		// no exterior-world geometry is duplicated. Colliders make the ROAD test real, not a cutscene.
		this.facility = new Group();
		this.facility.name = 'CampaignRedRoomFacility';
		this.facility.position.set( FACILITY.x, FACILITY.y, FACILITY.z );
		addBox( this.facility, dark, [ FACILITY.width, 0.14, FACILITY.depth ], [ 0, 0, 0 ], 'red-room-floor' );
		addBox( this.facility, limestone, [ 0.24, 4.8, FACILITY.depth ], [ -FACILITY.width / 2, 2.4, 0 ], 'red-room-wall-left' );
		addBox( this.facility, limestone, [ 0.24, 4.8, FACILITY.depth ], [ FACILITY.width / 2, 2.4, 0 ], 'red-room-wall-right' );
		addBox( this.facility, dark, [ FACILITY.width, 0.12, 18 ], [ 0, 4.8, -19 ], 'red-room-ceiling' );
		for ( const x of [ -5.4, -3.6, -1.8, 0, 1.8, 3.6, 5.4 ] ) {
			addBox( this.facility, red, [ 0.10, 0.08, 10.5 ], [ x, 4.70, -18.0 ], `red-room-strip-${ x }` );
		}
		addBox( this.facility, dark, [ 6.8, 0.32, 9.0 ], [ 0, 0.22, -16.0 ], 'relic-bay-plinth' );
		addBox( this.facility, red, [ 6.2, 0.05, 8.2 ], [ 0, 0.41, -16.0 ], 'relic-bay-glow' );
		addBox( this.facility, limestone, [ FACILITY.width, 4.8, 0.32 ], [ 0, 2.4, -FACILITY.depth / 2 ], 'red-room-back-wall' );
		this.app.scene.add( this.facility );

		const c = this.app.colliders;
		if ( c ) {
			c.addBox( new Vector3( FACILITY.x, FACILITY.y + 0.06, FACILITY.z ), new Vector3( FACILITY.width / 2, 0.07, FACILITY.depth / 2 ), 0, { walkable: true, solid: false, tag: 'relic-facility-floor' } );
			c.addBox( new Vector3( FACILITY.x - FACILITY.width / 2, FACILITY.y + 2.4, FACILITY.z ), new Vector3( 0.12, 2.4, FACILITY.depth / 2 ), 0, { tag: 'relic-facility-wall' } );
			c.addBox( new Vector3( FACILITY.x + FACILITY.width / 2, FACILITY.y + 2.4, FACILITY.z ), new Vector3( 0.12, 2.4, FACILITY.depth / 2 ), 0, { tag: 'relic-facility-wall' } );
			c.addBox( new Vector3( FACILITY.x, FACILITY.y + 2.4, FACILITY.z - FACILITY.depth / 2 ), new Vector3( FACILITY.width / 2, 2.4, 0.16 ), 0, { tag: 'relic-facility-wall' } );
		}
		if ( this.app.localLights ) {
			for ( const z of [ -495, -487, -478 ] ) this.app.localLights.add( {
				position: new Vector3( FACILITY.x, FACILITY.y + 3.8, z ),
				color: new Color( 1.0, 0.06, 0.09 ), intensity: 4.2, range: 10, kind: 'relicRedRoom', scale: 1,
			} );
		}

		this.syncWorldVisibility();
	}

	syncWorldVisibility() {
		const flags = this.state.storyFlags || {};
		this.tracks.visible = this.active( M.BLACK ) && !! flags.blackCarWitnessed && ! this.completed( M.BLACK );
		this.component.visible = this.active( M.BLUE ) && ! this.completed( M.BLUE ) && ! flags.blueHoleComponentRecovered;
		const signalActive = this.active( M.SIGNAL ) && ! this.completed( M.SIGNAL );
		this.signalGroup.visible = signalActive;
		const step = Math.max( 0, Math.min( 2, Number( flags.strangeSignalStep || 0 ) ) );
		this.signalMarkers.forEach( ( marker, i ) => marker.visible = signalActive && i === step );
		this.door.visible = ( this.available( M.DOOR ) || this.active( M.DOOR ) ) && ! flags.limestoneDoorActivated;
		const facilityStory = !! flags.insideHiddenFacility || this.available( M.FINAL ) || this.active( M.FINAL ) || this.completed( M.FINAL );
		this.facility.visible = facilityStory;
	}

	async ensureAsset( key ) {
		if ( this.assetLoads.has( key ) ) return this.assetLoads.get( key );
		if ( mobileHardware() && gpuSafeLevel() >= 2 ) return null;
		const config = {
			'blue-hole-component': { fallback: this.component, position: this.component.position.clone(), yaw: this.component.rotation.y, scale: 0.62, maxTriangles: 9000 },
			'limestone-door': { fallback: this.door, position: this.door.position.clone(), yaw: 0, scale: 1.0, maxTriangles: 12000 },
			'red-room-console': { fallback: null, position: new Vector3( FACILITY.x + 4.9, FACILITY.y + 0.1, FACILITY.z - 18.5 ), yaw: -Math.PI / 2, scale: 0.9, maxTriangles: 9000 },
		}[ key ];
		if ( ! config ) return null;
		const promise = ( async () => {
			try {
				const asset = await loadStaticAsset( `${ CAMPAIGN_ASSET_BASE }bermuda-${ key }.glb`, { id: `campaign-${ key }`, maxTriangles: config.maxTriangles, maxTextureSize: 1024 } );
				const node = placeStaticAsset( asset, [ { x: config.position.x, y: config.position.y, z: config.position.z, yaw: config.yaw, scale: config.scale } ] );
				node.name = `CampaignMeshy-${ key }`;
				this.app.scene.add( node );
				if ( config.fallback ) config.fallback.visible = false;
				return { asset, node };
			} catch ( error ) {
				console.warn( `Optional Meshy campaign asset ${ key } unavailable; using procedural fallback.`, error );
				return null;
			}
		} )();
		this.assetLoads.set( key, promise );
		return promise;
	}

	objective( text, kicker = 'CURRENT JOB' ) {
		const el = this.app.progression?.objectiveEl;
		if ( ! el ) return;
		el.style.display = '';
		el.innerHTML = `<span class="bm-objective-kicker">${ kicker }</span>${ text }`;
	}

	updateBlackCar() {
		const p = this.player;
		const carPos = this.app.relic001?.group?.position || TMP.set( RELIC_POS.x, 0, RELIC_POS.z );
		if ( this.available( M.BLACK ) ) {
			if ( this.night() && horizontalDistance( p.position, carPos ) < 11 && p.mode === 'walk' && ! p.busy ) {
				p.prompt = { key: 'E', text: 'Investigate the black car sighting' };
				if ( this.input.hit( 'KeyE' ) && this.director.accept( M.BLACK, { toast: false } ) ) {
					this.consumeAct();
					this.game.toast( 'A black machine is sitting silent on the coastal road.', 3200 );
				}
			}
			return;
		}
		if ( ! this.active( M.BLACK ) ) return;
		if ( ! this.night() ) {
			this.objective( 'Return to the coastal road after dark' );
			return;
		}
		if ( ! this.state.storyFlags.blackCarWitnessed ) {
			this.objective( 'Get close enough to witness the black vehicle without entering it' );
			if ( p.mode === 'walk' && ! p.busy && horizontalDistance( p.position, carPos ) < 5.6 ) {
				p.prompt = { key: 'E', text: 'Observe the black vehicle' };
				if ( this.input.hit( 'KeyE' ) ) {
					this.consumeAct();
					this.setFlag( 'blackCarWitnessed', true );
					this.game.toast( 'The machine goes silent. Fresh tracks lead away from the verge.', 3600 );
				}
			}
			return;
		}
		this.objective( 'Inspect the fresh tracks and amber residue beside the coastal road' );
		if ( p.mode === 'walk' && ! p.busy && horizontalDistance( p.position, this.tracks.position ) < 2.7 ) {
			p.prompt = { key: 'E', text: 'Inspect the tracks' };
			if ( this.input.hit( 'KeyE' ) ) {
				this.consumeAct();
				this.director.complete( M.BLACK, { storyFlags: { relicTrackResidueFound: true }, toast: true } );
			}
		}
	}

	updateBlueHole() {
		const p = this.player;
		if ( this.available( M.BLUE ) ) {
			if ( p.mode === 'walk' && ! p.busy && this.nearJoe() ) {
				p.prompt = { key: 'E', text: 'Joe · Blue Hole recovery job' };
				if ( this.input.hit( 'KeyE' ) && this.director.accept( M.BLUE, { toast: false } ) ) {
					this.consumeAct();
					this.game.toast( 'Joe: “Something metallic is wedged down in that limestone pocket.”', 3900 );
				}
			}
			return;
		}
		if ( ! this.active( M.BLUE ) ) return;
		void this.ensureAsset( 'blue-hole-component' );
		this.objective( 'Dive the Blue Hole and recover the artificial component' );
		if ( p.mode === 'swim' && horizontalDistance( p.position, this.component.position ) < 2.5 && Math.abs( p.position.y - this.component.position.y ) < 4.5 ) {
			p.prompt = { key: 'E', text: 'Recover artificial component' };
			if ( this.input.hit( 'KeyE' ) ) {
				this.consumeAct();
				this.setFlag( 'blueHoleComponentInInventory', true );
				this.director.complete( M.BLUE, { toast: true } );
				this.game.toast( 'The component is warm despite the cold water. An amber pulse flickers once.', 3600 );
			}
		}
	}

	updateSignal() {
		const p = this.player;
		if ( this.available( M.SIGNAL ) ) {
			if ( this.night() && this.director.accept( M.SIGNAL, { toast: false } ) ) {
				this.game.toast( 'The recovered component wakes after dark — three faint pulses answer from the reef.', 4100 );
			}
			return;
		}
		if ( ! this.active( M.SIGNAL ) ) return;
		if ( ! this.night() ) {
			this.objective( 'Wait until after dark for the recovered component to respond' );
			return;
		}
		let step = Math.max( 0, Math.min( 2, Number( this.state.storyFlags.strangeSignalStep || 0 ) ) );
		const target = this.signalPoints[ step ];
		this.objective( step < 2 ? `Follow the underwater signal · pulse ${ step + 1 } / 3` : 'Inspect the source of the signal inside the limestone throat' );
		if ( p.mode !== 'swim' || horizontalDistance( p.position, target ) > ( step === 2 ? 3.2 : 4.4 ) ) return;
		if ( step < 2 ) {
			step ++;
			this.state.storyFlags.strangeSignalStep = step;
			this.state.save(); this.state.emit();
			this.game.toast( `Signal locked · ${ step + 1 } / 3`, 1800 );
			return;
		}
		p.prompt = { key: 'E', text: 'Inspect signal source' };
		if ( this.input.hit( 'KeyE' ) ) {
			this.consumeAct();
			this.director.complete( M.SIGNAL, { storyFlags: { strangeSignalStep: 3 }, toast: true } );
			this.game.toast( 'The signal is coming from behind the limestone.', 3000 );
		}
	}

	enterFacility() {
		const p = this.player;
		p.mode = 'walk';
		p.position.set( FACILITY.x, FACILITY.y + 0.12, FACILITY.entryZ );
		p.velocity.set( 0, 0, 0 );
		p.grounded = true;
		p.yaw = Math.PI;
		p.pitch = -0.04;
		p._camY = null;
		this.state.storyFlags.insideHiddenFacility = true;
		this.state.save(); this.state.emit();
	}

	updateDoor() {
		const p = this.player;
		const tunnel = this.door.position;
		if ( this.available( M.DOOR ) ) {
			if ( p.mode === 'swim' && horizontalDistance( p.position, tunnel ) < 5.8 ) {
				p.prompt = { key: 'E', text: 'Investigate the limestone anomaly' };
				if ( this.input.hit( 'KeyE' ) && this.director.accept( M.DOOR, { toast: false } ) ) {
					this.consumeAct();
					this.game.toast( 'Sonar returns a straight edge where solid limestone should be.', 3400 );
				}
			}
			return;
		}
		if ( ! this.active( M.DOOR ) ) return;
		void this.ensureAsset( 'limestone-door' );
		if ( ! this.state.storyFlags.limestoneDoorActivated ) {
			this.objective( 'Use sonar at the submerged limestone door' );
			if ( p.mode === 'swim' && horizontalDistance( p.position, tunnel ) < 3.7 ) {
				p.prompt = { key: 'E', text: 'Open limestone door' };
				if ( this.input.hit( 'KeyE' ) ) {
					this.consumeAct();
					this.setFlag( 'limestoneDoorActivated', true );
					this.game.toast( 'Stone dust lifts. A pressure seal releases behind the reef.', 3400 );
				}
			}
			return;
		}
		this.objective( 'Enter the hidden facility through the opened limestone door' );
		if ( p.mode === 'swim' && horizontalDistance( p.position, tunnel ) < 4.2 ) {
			p.prompt = { key: 'E', text: 'Enter hidden facility' };
			if ( this.input.hit( 'KeyE' ) ) {
				this.consumeAct();
				this.enterFacility();
				this.director.complete( M.DOOR, { toast: true } );
				this.game.toast( 'A dry corridor opens beneath the island. Red light spills from deeper inside.', 4100 );
			}
		}
	}

	positionRelicInFacility() {
		const relic = this.app.relic;
		if ( ! relic || this.finalPlaced || relic.occupied ) return false;
		relic.position.set( FACILITY.x, FACILITY.y + 0.03, FACILITY.bayZ );
		relic.yaw = 0;
		relic.group.rotation.y = 0;
		relic.speed = 0;
		relic.verticalSpeed = 0;
		relic.setDriveMode?.( 'ROAD', false );
		relic.syncBodyCollider?.();
		this.finalPlaced = true;
		return true;
	}

	finishCampaign() {
		if ( ! this.active( M.FINAL ) ) return;
		const completed = this.director.complete( M.FINAL, { storyFlags: { relicFinalRoadTestComplete: true }, toast: true } );
		if ( ! completed ) return;
		this.state.vehicles.relic.owned = true;
		this.state.vehicles.relic.discovered = true;
		this.state.storyFlags.insideHiddenFacility = false;
		this.state.save(); this.state.emit();

		// The facility ROAD test ends at a transition gate. Put the owned RELIC onto the real coastal
		// road while keeping the player in the cockpit so the campaign resolves directly into free roam.
		const relic = this.app.relic;
		if ( relic ) {
			const x = RELIC_STORY.road.x, z = RELIC_STORY.road.z + 5.0;
			relic.position.set( x, this.app.terrainData.heightAt( x, z ) + 0.03, z );
			relic.yaw = Math.PI * 0.5;
			relic.group.rotation.y = relic.yaw;
			relic.speed = 0;
			relic.verticalSpeed = 0;
			relic.setDriveMode?.( 'ROAD', false );
			relic.syncBodyCollider?.();
		}
		this.game.toast( 'V1 CAMPAIGN COMPLETE · RELIC 001 is yours', 5200 );
	}

	updateFinal() {
		const p = this.player;
		const inside = !! this.state.storyFlags.insideHiddenFacility ||
			horizontalDistance( p.position, { x: FACILITY.x, z: FACILITY.z } ) < 45;
		if ( this.available( M.FINAL ) ) {
			if ( ! inside ) return;
			this.objective( 'Follow the red light into the Red Room', 'FINAL MISSION' );
			if ( p.mode === 'walk' && ! p.busy && Math.abs( p.position.z - ( FACILITY.z - 8 ) ) < 12 ) {
				p.prompt = { key: 'E', text: 'Enter the Red Room' };
				if ( this.input.hit( 'KeyE' ) && this.director.accept( M.FINAL, { toast: false } ) ) {
					this.consumeAct();
					this.positionRelicInFacility();
					void this.ensureAsset( 'red-room-console' );
					this.game.toast( 'RELIC 001 wakes as you enter. ROAD mode is waiting.', 3900 );
				}
			}
			return;
		}
		if ( ! this.active( M.FINAL ) ) return;
		this.positionRelicInFacility();
		void this.ensureAsset( 'red-room-console' );

		const relic = this.app.relic;
		if ( p.mode !== 'relic' || ! relic?.occupied ) {
			this.objective( 'Enter RELIC 001 in the Red Room', 'FINAL MISSION' );
			return;
		}
		if ( ! this.state.storyFlags.relicFinalDriveStarted ) {
			this.state.storyFlags.relicFinalDriveStarted = true;
			this.state.save(); this.state.emit();
			this.finalDriveOrigin = relic.position.clone();
			this.game.toast( 'ROAD TEST · follow the corridor to the exit gate', 3000 );
		}
		if ( ! this.finalDriveOrigin ) this.finalDriveOrigin = new Vector3( FACILITY.x, FACILITY.y, FACILITY.bayZ );
		this.objective( 'ROAD DRIVE · reach the facility exit gate', 'FINAL MISSION' );
		const travelled = horizontalDistance( relic.position, this.finalDriveOrigin );
		if ( relic.driveMode === 'ROAD' && ( relic.position.z >= FACILITY.exitZ || travelled >= 38 ) ) this.finishCampaign();
	}

	update() {
		this.syncWorldVisibility();
		this.updateBlackCar();
		this.updateBlueHole();
		this.updateSignal();
		this.updateDoor();
		this.updateFinal();
	}
}

export { FACILITY as RELIC_FACILITY };
