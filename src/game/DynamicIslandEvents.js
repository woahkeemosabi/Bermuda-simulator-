const STORM_JOB = 'storm-mooring-check';
const VALID_WEATHER = new Set(['clear', 'overcast', 'storm']);

export class DynamicIslandEvents {
	constructor(app) {
		this.app = app;
		this.game = app.game;
		this.state = app.game.state;
		this.player = app.player;
		this.input = app.input;
		this.joe = app.game?.stand?.vendor || null;
		this.martha = app.game?.chandlery?.vendor || null;
		this.lastWeather = app.settings.weatherMode;
		this.saveClock = 0;
		this.restoreWorldState();

		const originalUpdate = this.player.update.bind(this.player);
		this.player.update = (dt) => {
			originalUpdate(dt);
			this.update(dt);
		};
		app.dynamicIslandEvents = this;
	}

	restoreWorldState() {
		const world = this.state.world || {};
		if (Number.isFinite(world.time)) this.app.settings.timeOfDay = ((world.time % 24) + 24) % 24;
		if (VALID_WEATHER.has(world.weather)) {
			this.app.settings.weatherMode = world.weather;
			this.lastWeather = world.weather;
		}
	}

	ownsBoat() { return (this.state.boats?.owned?.length || 0) > 0; }
	available() { return !!this.state.hasMission?.(STORM_JOB, 'available'); }
	active() { return !!this.state.hasMission?.(STORM_JOB, 'active'); }
	completed() { return !!this.state.hasMission?.(STORM_JOB, 'completed'); }

	onWeatherChanged(next) {
		if (next === 'storm') {
			this.state.storyFlags.lastStormStartedAt = Date.now();
			if (this.ownsBoat() && !this.available() && !this.active()) {
				// Dynamic jobs can recur across later storms after completion, but not repeatedly in the same
				// storm. Reset the completed marker only when enough real time has passed since the prior job.
				const last = Number(this.state.storyFlags.lastStormMooringCompletedAt || 0);
				if (!this.completed() || Date.now() - last > 30 * 60 * 1000) {
					if (this.completed()) this.state.missions.completed = this.state.missions.completed.filter((id) => id !== STORM_JOB);
					this.state.unlockMission?.(STORM_JOB);
					this.game.toast('Weather turning nasty · Joe may need help securing boats', 3300);
				}
			}
		}
		this.state.world.weather = next;
		this.state.save(); this.state.emit();
	}

	updateDialogue(weather, hour) {
		if (this.joe) {
			if (weather === 'storm') this.joe.greeting = 'Weather turning nasty. Secure anything that can move before it gets worse.';
			else if (hour < 7 || hour >= 20) this.joe.greeting = 'Harbour is quiet this time of night. Mind the navigation lights.';
			else this.joe.greeting = 'Bring me legal fish or lobster and I’ll give you a fair price.';
		}
		if (this.martha) {
			if (weather === 'storm') this.martha.greeting = 'Storm coming through. Get what you need and don’t stay offshore too long.';
			else this.martha.greeting = 'Have a look around. Rods, reels, marine gear and diesel are on the shelves.';
		}
	}

	acceptStormJob() {
		if (!this.available()) return false;
		const director = this.app.missionDirector;
		const ok = director?.accept?.(STORM_JOB, { storyFlags: { stormMooringAccepted: true }, toast: false }) ?? this.state.activateMission?.(STORM_JOB);
		if (!ok) return false;
		this.game.toast('Joe: “Secure your boat. Berth it or get the anchor down before the squall hits.”', 4200);
		return true;
	}

	completeStormJob() {
		if (!this.active()) return false;
		const director = this.app.missionDirector;
		const ok = director?.complete?.(STORM_JOB, { storyFlags: { stormMooringAccepted: false }, toast: false }) ?? this.state.completeMission?.(STORM_JOB);
		if (!ok) return false;
		this.state.storyFlags.lastStormMooringCompletedAt = Date.now();
		this.state.save(); this.state.emit();
		this.game.toast('Boat secured · +$180 · Joe +3', 3200);
		return true;
	}

	update(dt) {
		const weather = this.app.settings.weatherMode || 'clear';
		const hour = Number(this.app.settings.timeOfDay || 0);
		if (weather !== this.lastWeather) {
			this.lastWeather = weather;
			this.onWeatherChanged(weather);
		}
		this.updateDialogue(weather, hour);

		// Persist the living island state without hammering localStorage every frame.
		this.saveClock += dt;
		if (this.saveClock >= 5) {
			this.saveClock = 0;
			this.state.world.time = hour;
			this.state.world.weather = weather;
			this.state.save();
		}

		if (this.player.mode !== 'walk' || this.player.busy) return;
		if (weather === 'storm' && this.available() && this.joe?.inRange?.(this.player.position)) {
			this.player.prompt = { key: 'E', text: 'Joe · storm mooring job' };
			if (this.input.hit('KeyE')) this.acceptStormJob();
			return;
		}

		if (this.active()) {
			const ctl = this.app.boatCtl;
			if (ctl?.anchored || ctl?.moored) this.completeStormJob();
		}
	}
}
