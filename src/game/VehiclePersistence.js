// Shared ownership/parking persistence for current and future road vehicles. The starter bicycle
// already writes its parked pose directly; this layer gives scooter/cars/RELIC the same state API
// without changing their controllers or prematurely locking RELIC behind its later story campaign.

function finitePose( pose ) {
	return pose && Number.isFinite( pose.x ) && Number.isFinite( pose.z );
}

function poseOf( object, yaw = null ) {
	const p = object?.position || object?.group?.position;
	if ( ! p ) return null;
	const rotY = Number.isFinite( yaw ) ? yaw : ( object?.rotation?.y ?? object?.group?.rotation?.y ?? 0 );
	return { x: p.x, y: p.y, z: p.z, yaw: Number( rotY ) || 0, savedAt: Date.now() };
}

export class VehiclePersistence {
	constructor( app ) {
		this.app = app;
		this.state = app.game.state;
		this.installStateAPI();
		this.attachRelic();
		this.installLifecycleSave();
		app.vehiclePersistence = this;
	}

	installStateAPI() {
		const s = this.state;
		if ( typeof s.ownVehicle !== 'function' ) {
			s.ownVehicle = ( kind, vehicle = {} ) => {
				if ( kind === 'bicycle' || kind === 'scooter' || kind === 'relic' ) {
					const current = s.vehicles[ kind ] || {};
					s.vehicles[ kind ] = { ...current, ...vehicle, owned: true };
				} else if ( kind === 'car' ) {
					if ( ! vehicle.id ) return false;
					const i = s.vehicles.cars.findIndex( ( v ) => v.id === vehicle.id );
					if ( i >= 0 ) s.vehicles.cars[ i ] = { ...s.vehicles.cars[ i ], ...vehicle, owned: true };
					else s.vehicles.cars.push( { ...vehicle, owned: true, parked: vehicle.parked || null } );
				} else return false;
				s.save(); s.emit();
				return true;
			};
		}

		if ( typeof s.parkVehicle !== 'function' ) {
			s.parkVehicle = ( kind, parked, id = null ) => {
				if ( ! finitePose( parked ) ) return false;
				if ( kind === 'car' ) {
					const car = s.vehicles.cars.find( ( v ) => v.id === id );
					if ( ! car?.owned ) return false;
					car.parked = { ...parked };
				} else {
					const vehicle = s.vehicles[ kind ];
					if ( ! vehicle?.owned ) return false;
					vehicle.parked = { ...parked };
				}
				s.save(); s.emit();
				return true;
			};
		}
	}

	attachRelic() {
		const relic = this.app.relic;
		if ( ! relic ) return;
		this.relic = relic;
		const record = this.state.vehicles?.relic;

		// Only restore a persisted RELIC pose once the progression state says the player actually owns
		// it. Until then the existing showcase/story placement is preserved for development and mystery.
		if ( record?.owned && finitePose( record.parked ) ) {
			relic.position.set( record.parked.x, record.parked.y || relic.position.y, record.parked.z );
			relic.yaw = Number.isFinite( record.parked.yaw ) ? record.parked.yaw : relic.yaw;
			relic.group.rotation.y = relic.yaw;
			relic.syncBodyCollider?.();
		}

		const realExit = relic.exit.bind( relic );
		relic.exit = ( player ) => {
			const ok = realExit( player );
			if ( ok && this.state.vehicles?.relic?.owned ) this.persistRelic();
			return ok;
		};
	}

	persistRelic() {
		if ( ! this.relic || ! this.state.vehicles?.relic?.owned ) return false;
		const pose = poseOf( this.relic, this.relic.yaw );
		if ( ! pose ) return false;
		return this.state.parkVehicle( 'relic', pose );
	}

	persistBicycleSnapshot() {
		const bike = this.app.bicycle;
		if ( ! bike || ! this.state.vehicles?.bicycle?.owned ) return false;
		const pose = poseOf( bike.group, bike.yaw );
		if ( ! pose ) return false;
		// pagehide snapshots the last location even if Safari is closed while the player is riding.
		this.state.vehicles.bicycle.parked = pose;
		return true;
	}

	installLifecycleSave() {
		if ( typeof window === 'undefined' ) return;
		const persist = () => {
			this.persistBicycleSnapshot();
			if ( this.state.vehicles?.relic?.owned && this.relic && ! this.relic.occupied ) {
				const pose = poseOf( this.relic, this.relic.yaw );
				if ( pose ) this.state.vehicles.relic.parked = pose;
			}
			this.state.save();
		};
		window.addEventListener( 'pagehide', persist );
		document?.addEventListener?.( 'visibilitychange', () => {
			if ( document.visibilityState === 'hidden' ) persist();
		} );
	}
}
