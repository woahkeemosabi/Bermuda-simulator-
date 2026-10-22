import { Group, Mesh, Vector3, Color } from '../engine/index.js';
import { prepare, mergePrepared, cylinder, mat4 } from '../world/boat/GeoKit.js';
import { createPropMaterial } from './GameMaterials.js';

const STORM_JOB = 'storm-mooring-check';
const RIDE_OUT_SECONDS = 18;
const VALID_WEATHER = new Set( [ 'clear', 'overcast', 'storm' ] );
const NIGHT_LIGHTS = [
	{ x: - 103, y: 2.7, z: - 67, intensity: 3.5, range: 13 },
	{ x: - 88, y: 2.8, z: - 63, intensity: 3.4, range: 13 },
	{ x: - 72, y: 2.9, z: - 70, intensity: 3.6, range: 14 },
	{ x: - 56, y: 2.8, z: - 64, intensity: 3.5, range: 13 },
	{ x: - 40, y: 2.7, z: - 68, intensity: 3.4, range: 13 },
	{ x: - 25, y: 2.8, z: - 73, intensity: 3.3, range: 12 },
];
const HOUSE_LIGHTS = [
	{ x: - 97, y: 2.0, z: - 78 }, { x: - 80, y: 2.1, z: - 69 },
	{ x: - 61, y: 2.0, z: - 73 }, { x: - 46, y: 2.0, z: - 87 },
	{ x: - 32, y: 2.0, z: - 82 }, { x: - 20, y: 2.0, z: - 77 },
];

function dayPhase( hour ) {
	hour = ( Number( hour ) + 24 ) % 24;
	if ( hour >= 5.2 && hour < 7 ) return 'dawn';
	if ( hour >= 7 && hour < 18.3 ) return 'day';
	if ( hour >= 18.3 && hour < 20.2 ) return 'dusk';
	return 'night';
}

function nightAmount( hour ) {
	hour = ( Number( hour ) + 24 ) % 24;
	if ( hour >= 20 || hour < 5.5 ) return 1;
	if ( hour >= 18 ) return Math.min( 1, ( hour - 18 ) / 2 );
	if ( hour < 7 ) return Math.max( 0, ( 7 - hour ) / 1.5 );
	return 0;
}

function umbrellaGeometry() {
	const P = [];
	const add = ( g, o ) => P.push( prepare( g, o ) );
	add( cylinder( 0.10, 0.64, 0.23, 18 ), { color: 0x8f2635, rough: 0.72, matrix: mat4( 0, 1.70, 0 ) } );
	add( cylinder( 0.018, 0.018, 1.32, 8 ), { color: 0x263238, rough: 0.34, metal: 0.72, matrix: mat4( 0.18, 1.04, 0 ) } );
	add( cylinder( 0.035, 0.035, 0.16, 8 ), { color: 0x2f3437, rough: 0.46, metal: 0.5, matrix: mat4( 0.18, 0.35, 0, 0, 0, 0.18 ) } );
	return mergePrepared( P );
}

export class DynamicIslandEvents {
	constructor( app ) {
		this.app = app;
		this.game = app.game;
		this.state = app.game.state;
		this.player = app.player;
		this.input = app.input;
		this.joe = app.game?.stand?.vendor || null;
		this.martha = app.game?.chandlery?.vendor || null;
		this.lastWeather = app.settings.weatherMode;
		this.lastPhase = dayPhase( app.settings.timeOfDay );
		this.saveClock = 0;
		this.restoreWorldState();
		this.lastPhase = dayPhase( app.settings.timeOfDay );
		this.buildAmbientReactions();
		this.installNightLights();

		const originalUpdate = this.player.update.bind( this.player );
		this.player.update = ( dt ) => {
			originalUpdate( dt );
			this.update( dt );
		};
		app.dynamicIslandEvents = this;
	}

	restoreWorldState() {
		const world = this.state.world || {};
		if ( Number.isFinite( world.time ) ) this.app.settings.timeOfDay = ( ( world.time % 24 ) + 24 ) % 24;
		if ( VALID_WEATHER.has( world.weather ) ) {
			this.app.settings.weatherMode = world.weather;
			this.lastWeather = world.weather;
		}
	}

	buildAmbientReactions() {
		this.weatherProps = new Group();
		this.weatherProps.name = 'DynamicIslandWeatherProps';
		this.app.scene.add( this.weatherProps );
		if ( this.joe?.group ) {
			this.joeUmbrella = new Mesh( umbrellaGeometry(), createPropMaterial( 'joeStormUmbrella' ) );
			this.joeUmbrella.castShadow = true;
			this.joeUmbrella.position.set( 0.22, 0.02, - 0.10 );
			this.joeUmbrella.visible = false;
			this.joe.group.add( this.joeUmbrella );
		}
	}

	installNightLights() {
		this.dynamicLights = [];
		if ( ! this.app.localLights ) return;
		for ( const p of NIGHT_LIGHTS ) {
			const src = {
				position: new Vector3( p.x, p.y, p.z ),
				color: new Color( 1.0, 0.70, 0.38 ), intensity: p.intensity, range: p.range,
				kind: 'islandStreet', scale: 0,
			};
			this.dynamicLights.push( src );
			this.app.localLights.add( src );
		}
		for ( const p of HOUSE_LIGHTS ) {
			const src = {
				position: new Vector3( p.x, p.y, p.z ),
				color: new Color( 1.0, 0.58, 0.30 ), intensity: 2.2, range: 8,
				kind: 'houseWindow', scale: 0,
			};
			this.dynamicLights.push( src );
			this.app.localLights.add( src );
		}
	}

	ownsBoat() { return ( this.state.boats?.owned?.length || 0 ) > 0; }
	available() { return !! this.state.hasMission?.( STORM_JOB, 'available' ); }
	active() { return !! this.state.hasMission?.( STORM_JOB, 'active' ); }
	completed() { return !! this.state.hasMission?.( STORM_JOB, 'completed' ); }

	onWeatherChanged( next ) {
		if ( next === 'storm' ) {
			this.state.storyFlags.lastStormStartedAt = Date.now();
			const campaignReady = !! this.app.missionDirector?.completed?.( 'martha-reef-table' );
			const wasCompleted = this.completed();
			if ( this.ownsBoat() && ( campaignReady || wasCompleted ) && ! this.available() && ! this.active() ) {
				const last = Number( this.state.storyFlags.lastStormMooringCompletedAt || 0 );
				if ( ! wasCompleted || Date.now() - last > 30 * 60 * 1000 ) {
					if ( wasCompleted ) this.state.missions.completed = this.state.missions.completed.filter( ( id ) => id !== STORM_JOB );
					this.state.unlockMission?.( STORM_JOB );
					this.game.toast( 'Weather turning nasty · Joe may need help securing boats', 3300 );
				}
			}
		} else if ( next === 'overcast' ) {
			this.game.toast( 'Cloud cover building · the water and fish activity are changing', 2400 );
		}
		this.state.world.weather = next;
		this.state.save(); this.state.emit();
	}

	onPhaseChanged( phase ) {
		if ( phase === 'dusk' ) this.game.toast( 'Dusk settling in · street and house lights coming on', 2200 );
		else if ( phase === 'night' ) this.game.toast( 'Night on the island · navigation lights are now essential', 2200 );
		else if ( phase === 'dawn' ) this.game.toast( 'Dawn breaking over the harbour', 1800 );
		this.state.storyFlags.lastDayPhase = phase;
	}

	updateDialogue( weather, hour ) {
		this.app.relationshipSystem?.updateGreetings?.();
		if ( this.joe ) {
			if ( weather === 'storm' ) this.joe.greeting = 'Weather turning nasty. Secure anything that can move before it gets worse.';
			else if ( hour < 7 || hour >= 20 ) this.joe.greeting = 'Harbour is quiet this time of night. Mind the navigation lights.';
			else if ( weather === 'overcast' ) this.joe.greeting = 'Clouds are in. Fish usually move differently when the light drops.';
		}
		if ( this.martha ) {
			if ( weather === 'storm' ) this.martha.greeting = 'Storm coming through. Get what you need and don’t stay offshore too long.';
			else if ( weather === 'overcast' ) this.martha.greeting = 'Keep an eye on the sky if you’re heading offshore.';
		}
	}

	applyAmbientState( weather, hour ) {
		const night = nightAmount( hour );
		for ( const light of this.dynamicLights || [] ) light.scale = night;
		if ( this.joeUmbrella ) this.joeUmbrella.visible = weather === 'storm';
		const bite = this.game.bite;
		if ( bite && bite.phase === 'wait' && ! bite._islandWeatherAdjusted ) {
			const factor = weather === 'storm' ? 0.68 : weather === 'overcast' ? 0.82 : 1;
			if ( Number.isFinite( bite.t ) ) bite.t = Math.max( 1.5, bite.t * factor );
			bite._islandWeatherAdjusted = true;
		}
	}

	acceptStormJob() {
		if ( ! this.available() ) return false;
		const director = this.app.missionDirector;
		const ok = director?.accept?.( STORM_JOB, {
			storyFlags: { stormMooringAccepted: true, stormBoatSecured: false, stormRideOutSeconds: 0 },
			toast: false,
		} ) ?? this.state.activateMission?.( STORM_JOB );
		if ( ! ok ) return false;
		this.app.settings.weatherMode = 'storm';
		this.app.settings.weatherTimer = 0;
		this.state.world.weather = 'storm';
		this.state.save(); this.state.emit();
		this.game.toast( `Joe: “Secure your boat and ride out the squall. Hold her safe for ${ RIDE_OUT_SECONDS } seconds.”`, 4600 );
		return true;
	}

	completeStormJob() {
		if ( ! this.active() ) return false;
		const director = this.app.missionDirector;
		const ok = director?.complete?.( STORM_JOB, {
			extraMoney: 820,
			storyFlags: {
				stormMooringAccepted: false,
				stormBoatSecured: false,
				stormRideOutSeconds: 0,
				weatherUnlocked: true,
			},
			toast: false,
		} ) ?? this.state.completeMission?.( STORM_JOB );
		if ( ! ok ) return false;
		this.state.storyFlags.lastStormMooringCompletedAt = Date.now();
		this.app.settings.weatherMode = 'overcast';
		this.app.settings.weatherTimer = 0;
		this.state.world.weather = 'overcast';
		this.state.save(); this.state.emit();
		this.game.toast( 'Loose Weather complete · +$1,000 · Weather unlocked', 3800 );
		return true;
	}

	updateActiveStormJob( dt, weather ) {
		if ( ! this.active() ) return false;
		// The campaign squall must stay active long enough to be a playable event instead of naturally
		// cycling away while the player is still trying to secure the boat.
		if ( weather !== 'storm' ) {
			this.app.settings.weatherMode = 'storm';
			this.app.settings.weatherTimer = 0;
			this.state.world.weather = 'storm';
		}

		const ctl = this.app.boatCtl;
		const secured = !! ( ctl?.anchored || ctl?.moored );
		const flags = this.state.storyFlags;
		if ( ! secured ) {
			if ( flags.stormBoatSecured || Number( flags.stormRideOutSeconds || 0 ) > 0 ) {
				flags.stormBoatSecured = false;
				flags.stormRideOutSeconds = 0;
				this.game.toast( 'Boat unsecured · get the anchor down or return to the berth', 2600 );
			}
			return true;
		}

		if ( ! flags.stormBoatSecured ) {
			flags.stormBoatSecured = true;
			flags.stormRideOutSeconds = 0;
			this.game.toast( `Boat secured · ride out the squall · ${ RIDE_OUT_SECONDS }s`, 2800 );
		}
		flags.stormRideOutSeconds = Math.min( RIDE_OUT_SECONDS, Number( flags.stormRideOutSeconds || 0 ) + Math.max( 0, dt ) );
		if ( flags.stormRideOutSeconds >= RIDE_OUT_SECONDS ) this.completeStormJob();
		return true;
	}

	update( dt ) {
		const weather = this.app.settings.weatherMode || 'clear';
		const hour = Number( this.app.settings.timeOfDay || 0 );
		const phase = dayPhase( hour );
		if ( weather !== this.lastWeather ) {
			const previous = this.lastWeather;
			this.lastWeather = weather;
			if ( previous === 'storm' && weather !== 'storm' ) this.game.toast( 'Squall easing · harbour activity returning to normal', 2400 );
			this.onWeatherChanged( weather );
		}
		if ( phase !== this.lastPhase ) {
			this.lastPhase = phase;
			this.onPhaseChanged( phase );
		}
		this.updateDialogue( weather, hour );
		this.applyAmbientState( weather, hour );

		this.saveClock += dt;
		if ( this.saveClock >= 5 ) {
			this.saveClock = 0;
			this.state.world.time = hour;
			this.state.world.weather = this.app.settings.weatherMode || weather;
			this.state.save();
		}

		// Mission 7 must work while the player is aboard the boat. The old code checked this only after
		// requiring walk mode, which meant anchoring from the helm could never finish until disembarking.
		if ( this.active() ) this.updateActiveStormJob( dt, weather );

		if ( this.player.mode !== 'walk' || this.player.busy ) return;
		if ( weather === 'storm' && this.available() && this.joe?.inRange?.( this.player.position ) ) {
			this.player.prompt = { key: 'E', text: 'Joe · storm mooring job' };
			if ( this.input.hit( 'KeyE' ) ) this.acceptStormJob();
		}
	}
}
