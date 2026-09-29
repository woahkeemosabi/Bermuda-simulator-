export const SIDE_QUEST_MISSIONS = Object.freeze( {
	'side-ghost-line': Object.freeze( {
		id: 'side-ghost-line',
		title: 'Ghost Line',
		availableObjective: 'Martha heard about fishing line tangled over the reef',
		activeObjective: 'Dive the reef, clear the ghost line and report back to Martha',
		rewards: Object.freeze( {
			money: 240,
			reputation: Object.freeze( { Martha: 3, marineCommunity: 4 } ),
			storyFlags: Object.freeze( { clearedGhostLine: true } ),
		} ),
		unlocks: Object.freeze( [ 'side-lost-camera' ] ),
	} ),
	'side-lost-camera': Object.freeze( {
		id: 'side-lost-camera',
		title: 'Lost Camera',
		availableObjective: 'Joe knows a diver who lost a camera near the reef',
		activeObjective: 'Recover the lost camera underwater and return it to Joe',
		rewards: Object.freeze( {
			money: 300,
			reputation: Object.freeze( { Joe: 3, marineCommunity: 3 } ),
			storyFlags: Object.freeze( { recoveredLostCamera: true } ),
		} ),
		unlocks: Object.freeze( [ 'side-blue-water-call' ] ),
	} ),
	'side-blue-water-call': Object.freeze( {
		id: 'side-blue-water-call',
		title: 'Blue Water Call',
		availableObjective: 'Joe has heard mahi and wahoo are moving offshore',
		activeObjective: 'Land a mahi-mahi and a wahoo, then return to Joe',
		rewards: Object.freeze( {
			money: 420,
			reputation: Object.freeze( { Joe: 4, fishermen: 5 } ),
			storyFlags: Object.freeze( { completedBlueWaterCall: true } ),
		} ),
		unlocks: Object.freeze( [ 'side-island-table' ] ),
	} ),
	'side-island-table': Object.freeze( {
		id: 'side-island-table',
		title: 'Island Table',
		availableObjective: 'Martha wants a proper Bermuda spread for a harbour gathering',
		activeObjective: 'Bring yellowtail snapper, hogfish, red hind and spiny lobster',
		rewards: Object.freeze( {
			money: 375,
			reputation: Object.freeze( { Martha: 5, fishermen: 4, marineCommunity: 2 } ),
			storyFlags: Object.freeze( { completedIslandTable: true } ),
		} ),
		unlocks: Object.freeze( [ 'side-harbour-before-dark' ] ),
	} ),
	'side-harbour-before-dark': Object.freeze( {
		id: 'side-harbour-before-dark',
		title: 'Harbour Before Dark',
		availableObjective: 'Joe needs a reef check completed before the light goes',
		activeObjective: 'Run out to the reef marker and return to Joe before 20:00',
		rewards: Object.freeze( {
			money: 260,
			reputation: Object.freeze( { Joe: 4, marineCommunity: 3 } ),
			storyFlags: Object.freeze( { completedHarbourBeforeDark: true } ),
		} ),
		unlocks: Object.freeze( [ 'side-strange-signal' ] ),
	} ),
	'side-strange-signal': Object.freeze( {
		id: 'side-strange-signal',
		title: 'Strange Signal',
		availableObjective: 'Joe mentions an odd intermittent light below the reef after dark',
		activeObjective: 'Go out after dark, dive on the signal and inspect what is there',
		rewards: Object.freeze( {
			money: 350,
			reputation: Object.freeze( { Joe: 4, marineCommunity: 5 } ),
			storyFlags: Object.freeze( { relicSignalSeeded: true, strangeSignalInspected: true } ),
		} ),
		unlocks: Object.freeze( [] ),
	} ),
} );
