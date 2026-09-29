import { FISH, fishValue, fishLengthCm } from './FishTable.js';
import { defaultUpgrades, gearStats, nextLevel, UPGRADES, FUEL_PRICE } from './Gear.js';

const SAVE_KEY = 'tidewater.save.v1';
const SAVE_VERSION = 2;

function defaultProgression() {

	return {
		bankBalance: 0,
		reputation: {
			Martha: 0,
			Joe: 0,
			fishermen: 0,
			marineCommunity: 0,
		},
		equipment: {
			rod: 'basic',
			cooler: 'small',
			divingMask: 'basic',
		},
		vehicles: {
			bicycle: { owned: true, id: 'starter-bicycle', parked: null },
			scooter: { owned: false, id: null, parked: null },
			cars: [],
			relic: { owned: false, discovered: false, parked: null },
		},
		boats: {
			owned: [],
			activeBoat: null,
			upgrades: {},
		},
		properties: {
			owned: [],
			home: null,
			garage: null,
			marinaBerth: null,
		},
		missions: {
			available: [ 'martha-first-delivery' ],
			active: [],
			completed: [],
		},
		relationships: {
			Martha: { status: 'Known', points: 0 },
			Joe: { status: 'Known', points: 0 },
		},
		discoveries: [],
		storyFlags: {},
		world: {
			time: null,
			weather: null,
		},
	};

}

function clone( value ) {

	return JSON.parse( JSON.stringify( value ) );

}

function mergeProgression( source = {} ) {

	const d = defaultProgression();
	const vehicles = source.vehicles || {};
	const boats = source.boats || {};
	const properties = source.properties || {};
	const missions = source.missions || {};
	const relationships = source.relationships || {};
	return {
		bankBalance: Number.isFinite( source.bankBalance ) ? source.bankBalance : d.bankBalance,
		reputation: { ...d.reputation, ...( source.reputation || {} ) },
		equipment: { ...d.equipment, ...( source.equipment || {} ) },
		vehicles: {
			...d.vehicles,
			...vehicles,
			bicycle: { ...d.vehicles.bicycle, ...( vehicles.bicycle || {} ) },
			scooter: { ...d.vehicles.scooter, ...( vehicles.scooter || {} ) },
			relic: { ...d.vehicles.relic, ...( vehicles.relic || {} ) },
			cars: Array.isArray( vehicles.cars ) ? vehicles.cars : [],
		},
		boats: {
			...d.boats,
			...boats,
			owned: Array.isArray( boats.owned ) ? boats.owned : [],
			upgrades: { ...d.boats.upgrades, ...( boats.upgrades || {} ) },
		},
		properties: {
			...d.properties,
			...properties,
			owned: Array.isArray( properties.owned ) ? properties.owned : [],
		},
		missions: {
			available: Array.isArray( missions.available ) ? missions.available : [ ...d.missions.available ],
			active: Array.isArray( missions.active ) ? missions.active : [],
			completed: Array.isArray( missions.completed ) ? missions.completed : [],
		},
		relationships: {
			Martha: { ...d.relationships.Martha, ...( relationships.Martha || {} ) },
			Joe: { ...d.relationships.Joe, ...( relationships.Joe || {} ) },
			...relationships,
		},
		discoveries: Array.isArray( source.discoveries ) ? source.discoveries : [],
		storyFlags: { ...( source.storyFlags || {} ) },
		world: { ...d.world, ...( source.world || {} ) },
	};

}

// Player life state. The original fishing economy remains intact, while progression/ownership
// data is layered on top and saved through the same guarded localStorage path.
export class GameState {

	constructor( storage = safeStorage() ) {

		this.storage = storage;
		this.money = 75;
		this.inventory = []; // caught fish / lobster entries
		this.log = {};
		this.lastCatch = null;
		this.upgrades = defaultUpgrades();
		this.fuel = null;
		this._nextId = 1;
		this.listeners = new Set();
		Object.assign( this, clone( defaultProgression() ) );

	}

	get stats() { return gearStats( this.upgrades ); }

	get holdKg() {

		let kg = 0;
		for ( const f of this.inventory ) kg += f.kg;
		return kg;

	}

	get holdValue() {

		let v = 0;
		for ( const f of this.inventory ) v += f.value;
		return v;

	}

	fits( kg ) { return this.holdKg + kg <= this.stats.holdKg + 1e-6; }

	addFish( species, kg, timeOfDay = 12, cmOverride = null ) {

		kg = Math.round( kg * 100 ) / 100;
		const cm = Number.isFinite( cmOverride ) ? Math.round( cmOverride ) : Math.round( fishLengthCm( species, kg ) );
		const logEntry = this.log[ species ] || ( this.log[ species ] = { count: 0, bestKg: 0 } );
		const newSpecies = logEntry.count === 0;
		const prevBestKg = logEntry.bestKg, prevBestCm = logEntry.bestCm ?? ( prevBestKg > 0 ? Math.round( fishLengthCm( species, prevBestKg ) ) : 0 );
		const record = ! newSpecies && kg > prevBestKg;
		logEntry.count ++;
		if ( kg > prevBestKg ) {

			logEntry.bestKg = kg;
			logEntry.bestCm = cm;

		}

		const rule = FISH[ species ];
		const legalSize = ( ! rule.minKg || kg >= rule.minKg ) && ( ! rule.minCm || cm >= rule.minCm );
		const protectedSpecies = !! rule.protected;
		const value = protectedSpecies || ! legalSize ? 0 : fishValue( species, kg );
		const kept = ! protectedSpecies && legalSize && this.fits( kg );
		this.lastCatch = { species, kg, cm, value, newSpecies, record, prevBestKg, prevBestCm, kept, protectedSpecies, legalSize };
		if ( ! kept ) {

			this.save(); this.emit(); return null;

		}

		const f = { id: this._nextId ++, species, kg, cm, value, caughtAt: timeOfDay, record };
		this.inventory.push( f );
		this.save(); this.emit();
		return f;

	}

	sell( ids = null ) {

		const keep = [], sold = [];
		for ( const f of this.inventory ) ( ids === null || ids.includes( f.id ) ? sold : keep ).push( f );
		let total = 0;
		for ( const f of sold ) total += f.value;
		this.inventory = keep;
		this.money += total;
		this.save(); this.emit();
		return { total, count: sold.length };

	}

	release( id ) {

		this.inventory = this.inventory.filter( ( f ) => f.id !== id );
		this.save(); this.emit();

	}

	addMoney( amount ) {

		if ( ! Number.isFinite( amount ) || amount === 0 ) return this.money;
		this.money = Math.max( 0, this.money + amount );
		this.save(); this.emit();
		return this.money;

	}

	spend( amount ) {

		if ( ! Number.isFinite( amount ) || amount < 0 || amount > this.money ) return false;
		this.money -= amount;
		this.save(); this.emit();
		return true;

	}

	deposit( amount ) {

		amount = Math.max( 0, Math.min( this.money, Number( amount ) || 0 ) );
		if ( amount <= 0 ) return 0;
		this.money -= amount;
		this.bankBalance += amount;
		this.save(); this.emit();
		return amount;

	}

	withdraw( amount ) {

		amount = Math.max( 0, Math.min( this.bankBalance, Number( amount ) || 0 ) );
		if ( amount <= 0 ) return 0;
		this.bankBalance -= amount;
		this.money += amount;
		this.save(); this.emit();
		return amount;

	}

	addReputation( person, amount ) {

		if ( ! person || ! Number.isFinite( amount ) ) return 0;
		this.reputation[ person ] = ( this.reputation[ person ] || 0 ) + amount;
		if ( this.relationships[ person ] ) {

			this.relationships[ person ].points = ( this.relationships[ person ].points || 0 ) + amount;
			const points = this.relationships[ person ].points;
			this.relationships[ person ].status = points >= 50 ? 'Trusted' : points >= 20 ? 'Respected' : points >= 5 ? 'Known' : 'New';

		}
		this.save(); this.emit();
		return this.reputation[ person ];

	}

	hasMission( id, bucket = 'active' ) { return this.missions[ bucket ]?.includes( id ) || false; }

	activateMission( id ) {

		if ( this.hasMission( id, 'completed' ) || this.hasMission( id, 'active' ) ) return false;
		this.missions.available = this.missions.available.filter( ( m ) => m !== id );
		this.missions.active.push( id );
		this.save(); this.emit();
		return true;

	}

	completeMission( id ) {

		if ( ! this.hasMission( id, 'active' ) ) return false;
		this.missions.active = this.missions.active.filter( ( m ) => m !== id );
		if ( ! this.missions.completed.includes( id ) ) this.missions.completed.push( id );
		this.save(); this.emit();
		return true;

	}

	unlockMission( id ) {

		if ( this.hasMission( id, 'available' ) || this.hasMission( id, 'active' ) || this.hasMission( id, 'completed' ) ) return false;
		this.missions.available.push( id );
		this.save(); this.emit();
		return true;

	}

	ownsVehicle( kind ) {

		if ( kind === 'car' ) return this.vehicles.cars.length > 0;
		return !! this.vehicles[ kind ]?.owned;

	}

	ownBoat( boat ) {

		if ( ! boat?.id || this.boats.owned.some( ( b ) => b.id === boat.id ) ) return false;
		this.boats.owned.push( { ...boat } );
		if ( ! this.boats.activeBoat ) this.boats.activeBoat = boat.id;
		this.save(); this.emit();
		return true;

	}

	buy( key ) {

		if ( ! UPGRADES[ key ] ) return null;
		const next = nextLevel( this.upgrades, key );
		if ( ! next || next.cost > this.money ) return null;
		this.money -= next.cost;
		this.upgrades[ key ] = next.index;
		if ( key === 'fuel' ) this.fuel = null;
		this.save(); this.emit();
		return next;

	}

	get fuelL() { return this.fuel === null ? this.stats.fuelL : Math.min( this.fuel, this.stats.fuelL ); }

	burn( litres ) {

		this.fuel = Math.max( 0, this.fuelL - litres );
		return this.fuel;

	}

	refuelCost() { return Math.ceil( ( this.stats.fuelL - this.fuelL ) * FUEL_PRICE ); }

	refuel() {

		const missing = this.stats.fuelL - this.fuelL;
		const litres = Math.min( missing, Math.floor( this.money / FUEL_PRICE ) );
		if ( litres <= 0 ) return 0;
		this.money -= Math.ceil( litres * FUEL_PRICE );
		this.fuel = this.fuelL + litres;
		if ( this.fuel >= this.stats.fuelL - 1e-3 ) this.fuel = null;
		this.save(); this.emit();
		return litres;

	}

	onChange( fn ) { this.listeners.add( fn ); return () => this.listeners.delete( fn ); }
	emit() { for ( const fn of this.listeners ) fn( this ); }

	toJSON() {

		return {
			v: SAVE_VERSION,
			money: this.money,
			inventory: this.inventory,
			log: this.log,
			upgrades: this.upgrades,
			fuel: this.fuel,
			nextId: this._nextId,
			bankBalance: this.bankBalance,
			reputation: this.reputation,
			equipment: this.equipment,
			vehicles: this.vehicles,
			boats: this.boats,
			properties: this.properties,
			missions: this.missions,
			relationships: this.relationships,
			discoveries: this.discoveries,
			storyFlags: this.storyFlags,
			world: this.world,
		};

	}

	fromJSON( d ) {

		if ( ! d || ( d.v !== 1 && d.v !== SAVE_VERSION ) ) return false;
		// v1 values are migrated verbatim; only new progression fields receive defaults.
		this.money = Number.isFinite( d.money ) ? d.money : ( d.v === 1 ? 0 : 75 );
		this.inventory = Array.isArray( d.inventory ) ? d.inventory.filter( ( f ) => f && FISH[ f.species ] && Number.isFinite( f.kg ) ) : [];
		for ( const f of this.inventory ) if ( ! Number.isFinite( f.cm ) ) f.cm = Math.round( fishLengthCm( f.species, f.kg ) );
		this.log = d.log && typeof d.log === 'object' ? d.log : {};
		for ( const [ k, v ] of Object.entries( this.log ) ) if ( FISH[ k ] && v && v.bestKg > 0 && ! Number.isFinite( v.bestCm ) ) v.bestCm = Math.round( fishLengthCm( k, v.bestKg ) );
		this.upgrades = { ...defaultUpgrades(), ...( d.upgrades || {} ) };
		this.fuel = Number.isFinite( d.fuel ) ? d.fuel : null;
		this._nextId = Math.max( d.nextId | 0, ...this.inventory.map( ( f ) => f.id + 1 ), 1 );
		const p = mergeProgression( d.v === 1 ? {} : d );
		Object.assign( this, p );
		return true;

	}

	save() {

		if ( ! this.storage ) return;
		try { this.storage.setItem( SAVE_KEY, JSON.stringify( this.toJSON() ) ); }
		catch ( e ) { /* storage full or blocked: keep playing */ }

	}

	load() {

		if ( ! this.storage ) return false;
		try {

			const raw = this.storage.getItem( SAVE_KEY );
			return raw ? this.fromJSON( JSON.parse( raw ) ) : false;

		} catch ( e ) { return false; }

	}

	reset() {

		this.money = 75;
		this.inventory = [];
		this.log = {};
		this.upgrades = defaultUpgrades();
		this.fuel = null;
		this._nextId = 1;
		Object.assign( this, clone( defaultProgression() ) );
		this.save(); this.emit();

	}

}

function safeStorage() {

	try { return typeof localStorage !== 'undefined' ? localStorage : null; }
	catch ( e ) { return null; }

}
