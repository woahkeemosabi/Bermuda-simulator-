import { SIDE_QUEST_MISSIONS } from './SideQuestDefinitions.js';
import { MAIN_CAMPAIGN_NEW_MISSIONS, MAIN_CAMPAIGN_SEQUENCE } from './MainCampaignDefinitions.js';

// Reusable mission registry/director for Bermuda life progression.
// Mission-specific world interactions stay in their own systems; state transitions, rewards,
// unlocks and objective copy are centralized here.

export { MAIN_CAMPAIGN_SEQUENCE };

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
		availableObjective: 'Talk to Martha about making money from the water',
		activeObjective: 'Catch any legal fish or lobster and sell it to Joe',
		rewards: Object.freeze( {
			money: 40,
			reputation: Object.freeze( { Martha: 2, Joe: 2 } ),
			storyFlags: Object.freeze( { fishingTradeIntroduced: true } ),
		} ),
		unlocks: Object.freeze( [ 'joe-spiny-business' ] ),
	} ),
	'joe-spiny-business': Object.freeze( {
		id: 'joe-spiny-business',
		title: 'Spiny Business',
		availableObjective: 'Joe has a lobster job at the fish market',
		activeObjective: 'Hand-catch 3 legal Caribbean spiny lobsters, then return to Joe',
		rewards: Object.freeze( {
			money: 325,
			reputation: Object.freeze( { Joe: 5, marineCommunity: 4 } ),
			storyFlags: Object.freeze( { completedSpinyBusiness: true } ),
		} ),
		unlocks: Object.freeze( [ 'main-first-boat' ] ),
	} ),
	'joe-three-waters': Object.freeze( {
		id: 'joe-three-waters',
		title: 'Three Waters',
		availableObjective: 'Joe has a challenge that will take you across the island waters',
		activeObjective: 'Land one shallows fish, one reef fish and one offshore fish, then return to Joe',
		rewards: Object.freeze( {
			money: 475,
			reputation: Object.freeze( { Joe: 6, fishermen: 5, marineCommunity: 3 } ),
			storyFlags: Object.freeze( { completedThreeWaters: true } ),
		} ),
		unlocks: Object.freeze( [ 'martha-reef-table' ] ),
	} ),
	'martha-reef-table': Object.freeze( {
		id: 'martha-reef-table',
		title: 'Reef Table',
		availableObjective: 'Martha wants a proper mixed Bermuda reef catch',
		activeObjective: 'Sell Joe a snapper, a hogfish and a red hind',
		rewards: Object.freeze( {
			money: 280,
			reputation: Object.freeze( { Martha: 4, Joe: 3, fishermen: 3 } ),
			storyFlags: Object.freeze( { completedReefTable: true } ),
		} ),
		unlocks: Object.freeze( [ 'storm-mooring-check' ] ),
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
		unlocks: Object.freeze( [ 'joe-after-dark' ] ),
	} ),
	'joe-after-dark': Object.freeze( {
		id: 'joe-after-dark',
		title: 'After Dark',
		availableObjective: 'Joe has heard tarpon moving through the harbour at night',
		activeObjective: 'Catch a tarpon after dark and return to Joe',
		rewards: Object.freeze( {
			money: 500,
			reputation: Object.freeze( { Joe: 5, fishermen: 5 } ),
			storyFlags: Object.freeze( { completedAfterDark: true } ),
		} ),
		unlocks: Object.freeze( [ 'marine-leave-it-living' ] ),
	} ),
	'marine-leave-it-living': Object.freeze( {
		id: 'marine-leave-it-living',
		title: 'Leave It Living',
		availableObjective: 'The marine community wants proof you know what must go back',
		activeObjective: 'Hook or spear a protected parrotfish or Nassau grouper and release it',
		rewards: Object.freeze( {
			money: 160,
			reputation: Object.freeze( { marineCommunity: 6, Joe: 2 } ),
			storyFlags: Object.freeze( { conservationLessonComplete: true } ),
		} ),
		unlocks: Object.freeze( [ 'main-keys-to-cottage' ] ),
	} ),
	...MAIN_CAMPAIGN_NEW_MISSIONS,
	...SIDE_QUEST_MISSIONS,
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
