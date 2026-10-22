import { BoatOwnership } from './BoatOwnership.js';
import { IslandMissionSystem } from './IslandMissionSystem.js';
import { DynamicIslandEvents } from './DynamicIslandEvents.js';
import { PropertySystem } from './PropertySystem.js';
import { LateCampaignSystem } from './LateCampaignSystem.js';

function recoveredMobileGPU() {
	if ( typeof navigator === 'undefined' ) return false;
	const mobile = /iPhone|iPad|iPod|Android/i.test( navigator.userAgent ) ||
		( navigator.maxTouchPoints > 1 && typeof screen !== 'undefined' && Math.min( screen.width, screen.height ) < 1024 );
	if ( ! mobile ) return false;
	try { return Number( new URLSearchParams( location.search ).get( 'gpuSafe' ) || 0 ) > 0; }
	catch ( _ ) { return false; }
}

function guardMeshyFallbackVisibility( system ) {
	if ( ! system || system.__meshyVisibilityGuard ) return;
	const nodes = new Map();
	const failed = new Set();
	const originalEnsure = system.ensureAsset.bind( system );
	const originalSync = system.syncWorldVisibility.bind( system );

	// Never retry optional Meshy props on an iPhone session that has already entered GPU recovery.
	// The procedural mission geometry remains authoritative in that case.
	system.ensureAsset = async ( key ) => {
		if ( recoveredMobileGPU() ) return null;
		if ( nodes.has( key ) ) return { node: nodes.get( key ) };
		if ( failed.has( key ) ) return null;
		const result = await originalEnsure( key );
		if ( result?.node ) nodes.set( key, result.node );
		else failed.add( key );
		return result;
	};

	system.syncWorldVisibility = () => {
		originalSync();
		const flags = system.state?.storyFlags || {};

		const componentNode = nodes.get( 'blue-hole-component' );
		if ( componentNode ) {
			const visible = system.active( 'main-blue-hole' ) && ! system.completed( 'main-blue-hole' ) && ! flags.blueHoleComponentRecovered;
			componentNode.visible = visible;
			if ( system.component ) system.component.visible = false;
		}

		const doorNode = nodes.get( 'limestone-door' );
		if ( doorNode ) {
			const visible = ( system.available( 'main-limestone-door' ) || system.active( 'main-limestone-door' ) ) && ! flags.limestoneDoorActivated;
			doorNode.visible = visible;
			if ( system.door ) system.door.visible = false;
		}

		const consoleNode = nodes.get( 'red-room-console' );
		if ( consoleNode ) {
			consoleNode.visible = !! flags.insideHiddenFacility || system.available( 'main-road-was-never-the-test' ) || system.active( 'main-road-was-never-the-test' ) || system.completed( 'main-road-was-never-the-test' );
		}
	};

	system.__meshyVisibilityGuard = { nodes, failed };
}

// Install the complete campaign once. These systems are deliberately idempotent so normal startup,
// QA mission links and save migration cannot create duplicate wrappers or duplicate rewards.
export function installCampaignRuntime( app ) {
	if ( ! app?.game?.state || ! app.player || ! app.missionDirector ) return null;
	if ( app.campaignRuntime ) return app.campaignRuntime;

	if ( ! app.boatOwnership ) new BoatOwnership( app );
	if ( ! app.islandMissions ) new IslandMissionSystem( app );
	if ( ! app.dynamicIslandEvents ) new DynamicIslandEvents( app );
	if ( ! app.propertySystem ) new PropertySystem( app );
	if ( ! app.lateCampaign ) new LateCampaignSystem( app );
	guardMeshyFallbackVisibility( app.lateCampaign );

	app.campaignRuntime = {
		boatOwnership: app.boatOwnership,
		islandMissions: app.islandMissions,
		dynamicIslandEvents: app.dynamicIslandEvents,
		propertySystem: app.propertySystem,
		lateCampaign: app.lateCampaign,
	};
	if ( typeof window !== 'undefined' ) window.__bermudaCampaignRuntime = app.campaignRuntime;
	return app.campaignRuntime;
}
