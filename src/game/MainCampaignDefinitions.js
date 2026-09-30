// Canonical V1 main-campaign order. Existing mission IDs are reused where systems already exist;
// only the missing ownership/story beats are declared below.

export const MAIN_CAMPAIGN_SEQUENCE = Object.freeze( [
	'martha-first-delivery',
	'martha-fishing-intro',
	'joe-spiny-business',
	'main-first-boat',
	'joe-three-waters',
	'martha-reef-table',
	'storm-mooring-check',
	'joe-after-dark',
	'marine-leave-it-living',
	'main-keys-to-cottage',
	'main-black-car',
	'main-blue-hole',
	'main-strange-signal',
	'main-limestone-door',
	'main-road-was-never-the-test',
] );

export const MAIN_CAMPAIGN_NEW_MISSIONS = Object.freeze( {
	'main-first-boat': Object.freeze( {
		id: 'main-first-boat',
		title: 'The First Boat',
		availableObjective: 'Save for the starter lobster boat and speak to Joe at the dock',
		activeObjective: 'Purchase the starter lobster boat',
		rewards: Object.freeze( {
			money: 0,
			reputation: Object.freeze( { Joe: 4, marineCommunity: 2 } ),
			storyFlags: Object.freeze( { firstBoatPurchased: true } ),
		} ),
		unlocks: Object.freeze( [ 'joe-three-waters' ] ),
	} ),
	'main-keys-to-cottage': Object.freeze( {
		id: 'main-keys-to-cottage',
		title: 'Keys to the Cottage',
		availableObjective: 'Build enough money and island reputation to buy Harbour Cottage',
		activeObjective: 'Purchase Harbour Cottage and enter your new home',
		rewards: Object.freeze( {
			money: 0,
			reputation: Object.freeze( { Martha: 3, Joe: 3, marineCommunity: 2 } ),
			storyFlags: Object.freeze( { firstHomePurchased: true, actTwoComplete: true } ),
		} ),
		unlocks: Object.freeze( [ 'main-black-car' ] ),
	} ),
	'main-black-car': Object.freeze( {
		id: 'main-black-car',
		title: 'Black Car',
		availableObjective: 'Something unusual has been seen on the coastal road after dark',
		activeObjective: 'Witness the black vehicle at night, then inspect the tracks it leaves behind',
		rewards: Object.freeze( {
			money: 0,
			reputation: Object.freeze( {} ),
			storyFlags: Object.freeze( { relicBlackCarSeen: true } ),
		} ),
		unlocks: Object.freeze( [ 'main-blue-hole' ] ),
	} ),
	'main-blue-hole': Object.freeze( {
		id: 'main-blue-hole',
		title: 'The Blue Hole',
		availableObjective: 'Joe has a recovery job near a deeper limestone pocket',
		activeObjective: 'Dive the Blue Hole and recover the artificial component embedded in the limestone',
		rewards: Object.freeze( {
			money: 375,
			reputation: Object.freeze( { Joe: 3, marineCommunity: 3 } ),
			storyFlags: Object.freeze( { blueHoleComponentRecovered: true } ),
		} ),
		unlocks: Object.freeze( [ 'main-strange-signal' ] ),
	} ),
	'main-strange-signal': Object.freeze( {
		id: 'main-strange-signal',
		title: 'Strange Signal',
		availableObjective: 'The recovered component reacts to something beneath the reef after dark',
		activeObjective: 'Follow the intermittent underwater signal and inspect its source at night',
		rewards: Object.freeze( {
			money: 250,
			reputation: Object.freeze( { marineCommunity: 2 } ),
			storyFlags: Object.freeze( { strangeSignalInspected: true } ),
		} ),
		unlocks: Object.freeze( [ 'main-limestone-door' ] ),
	} ),
	'main-limestone-door': Object.freeze( {
		id: 'main-limestone-door',
		title: 'The Limestone Door',
		availableObjective: 'The signal points toward a section of limestone that should be solid',
		activeObjective: 'Use sonar and diving to locate the submerged tunnel and enter the hidden facility',
		rewards: Object.freeze( {
			money: 0,
			reputation: Object.freeze( {} ),
			storyFlags: Object.freeze( { limestoneDoorOpened: true, hiddenFacilityDiscovered: true } ),
		} ),
		unlocks: Object.freeze( [ 'main-road-was-never-the-test' ] ),
	} ),
	'main-road-was-never-the-test': Object.freeze( {
		id: 'main-road-was-never-the-test',
		title: 'The Road Was Never the Test',
		availableObjective: 'Enter the hidden facility and follow the light into the Red Room',
		activeObjective: 'Enter RELIC 001, complete the first ROAD drive, and discover what the machine can become',
		rewards: Object.freeze( {
			money: 0,
			reputation: Object.freeze( {} ),
			storyFlags: Object.freeze( {
				relicOwned: true,
				relicRoadUnlocked: true,
				v1CampaignComplete: true,
			} ),
		} ),
		unlocks: Object.freeze( [] ),
	} ),
} );
