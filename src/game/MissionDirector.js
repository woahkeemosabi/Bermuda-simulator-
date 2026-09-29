// Reusable mission registry/director for Bermuda life progression.
// Mission-specific world interactions (parcel meshes, tow lines, dive targets, etc.) stay in their
// own systems; state transitions, rewards, unlocks and objective copy are centralized here.

export const MISSIONS = Object.freeze( {
	'martha-first-delivery': Object.freeze( {
		id: 'martha-first-delivery',
		title: 'First Day',
		availableObjective: 'Speak to Martha at Bait & Tackle',
		activeObjective: 'Take Martha\'s box to Joe at the fish market',
		rewards: Object.freeze( {
			money: 65,
			reputation: Object.freeze( { Martha: 5, Joe: 5 } ),
			storyFlags: Object.freeze( { metMartha: true, metJoe: true } ),
		} ),
		unlocks: Object.freeze( [ 'martha-fishing-intro' ] ),
	} ),
	'martha-fishing-intro': Object.freeze( {
		id: 'martha-fishing-intro',
		title: 'Proper Money',
		availableObjective: 'Martha says there is money in bringing back legal fish',
		activeObjective: 'Catch legal fish or lobster and sell the catch to Joe',
		rewards: Object.freeze( {} ),
		unlocks: Object.freeze( [] ),
	} ),
	'storm-mooring-check': Object.freeze( {
		id: 'storm-mooring-check',
		title: 'Loose Weather',
		availableObjective: 'Talk to Joe before the storm gets worse',
		activeObjective: 'Secure your boat: return to the berth or drop anchor',
		rewards: Object.freeze( {
			money: 180,
			reputation: Object.freeze( { Joe: 3, marineCommunity: 2 } ),
			storyFlags: Object.freeze( { completedStormMooring: true } ),
		} ),
		unlocks: Object.freeze( [] ),
	} ),
} );

export class MissionDirector {
	constructor( app ) {
		this.app = app;
		this.game = app.game;
		this.state = app.game.state;
		app.missionDirector = this;
	}

	definition( id ) { return MISSIONS[ id ] || null; }
	available( id ) { return !! this.state.hasMission?.( id, 'available' ); }
	active( id ) { return !! this.state.hasMission?.( id, 'active' ); }
	completed( id ) { return !! this.state.hasMission?.( id, 'completed' ); }

	accept( id, { storyFlags = null, toast = true } = {} ) {
		const def = this.definition( id );
		if ( ! def || ! this.available( id ) ) return false;
		if ( ! this.state.activateMission( id ) ) return false;
		if ( storyFlags ) Object.assign( this.state.storyFlags, storyFlags );
		this.state.save(); this.state.emit();
		if ( toast ) this.game.toast( `${ def.title } · started`, 1900 );
		return true;
	}

	complete( id, { extraMoney = 0, extraReputation = null, storyFlags = null, toast = true } = {} ) {
		const def = this.definition( id );
		if ( ! def || ! this.active( id ) ) return false;
		if ( ! this.state.completeMission( id ) ) return false;

		const reward = def.rewards || {};
		const money = Math.max( 0, Number( reward.money || 0 ) + Number( extraMoney || 0 ) );
		if ( money ) this.state.addMoney( money );
		for ( const [ person, amount ] of Object.entries( reward.reputation || {} ) ) this.state.addReputation( person, Number( amount ) || 0 );
		for ( const [ person, amount ] of Object.entries( extraReputation || {} ) ) this.state.addReputation( person, Number( amount ) || 0 );
		Object.assign( this.state.storyFlags, reward.storyFlags || {}, storyFlags || {} );
		for ( const next of def.unlocks || [] ) this.state.unlockMission( next );
		this.state.save(); this.state.emit();

		if ( toast ) {
			const bits = [ `${ def.title } complete` ];
			if ( money ) bits.push( `+$${ Math.round( money ) }` );
			for ( const [ person, amount ] of Object.entries( reward.reputation || {} ) ) if ( amount ) bits.push( `${ person } +${ amount }` );
			this.game.toast( bits.join( ' · ' ), 3600 );
		}
		return true;
	}

	unlock( id ) {
		if ( ! this.definition( id ) ) return false;
		return this.state.unlockMission( id );
	}

	current() {
		for ( const id of this.state.missions?.active || [] ) {
			const def = this.definition( id );
			if ( def ) return { id, def, bucket: 'active' };
		}
		for ( const id of this.state.missions?.available || [] ) {
			const def = this.definition( id );
			if ( def ) return { id, def, bucket: 'available' };
		}
		return null;
	}

	objective() {
		const current = this.current();
		if ( ! current ) return null;
		return {
			id: current.id,
			title: current.def.title,
			bucket: current.bucket,
			text: current.bucket === 'active' ? current.def.activeObjective : current.def.availableObjective,
		};
	}
}
