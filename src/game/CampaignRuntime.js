import { BoatOwnership } from './BoatOwnership.js';
import { IslandMissionSystem } from './IslandMissionSystem.js';
import { DynamicIslandEvents } from './DynamicIslandEvents.js';
import { PropertySystem } from './PropertySystem.js';
import { LateCampaignSystem } from './LateCampaignSystem.js';

function sceneHasNamedNode( root, name ) {
	if ( ! root ) return false;
	if ( root.name === name ) return true;
	for ( const child of root.children || [] ) if ( sceneHasNamedNode( child, name ) ) return true;
	return false;
}

function guardMeshyFallbackVisibility( app, system ) {
	if ( ! system || system.__meshyVisibilityGuard ) return;
	const original = system.syncWorldVisibility.bind( system );
	system.syncWorldVisibility = () => {
		original();
		// A successful lazy Meshy load must replace—not overlap—the procedural safety geometry.
		// The loader names the replacement nodes deterministically, so this remains correct across
		// reloads without making the campaign dependent on the optional asset request succeeding.
		if ( system.component && sceneHasNamedNode( app.scene, 'CampaignMeshy-blue-hole-component' ) ) system.component.visible = false;
		if ( system.door && sceneHasNamedNode( app.scene, 'CampaignMeshy-limestone-door' ) ) system.door.visible = false;
	};
	system.__meshyVisibilityGuard = true;
}

// The individual campaign systems existed as independent modules, but only FIRST DAY's
// LifeProgression was connected to the production startup graph. Install every main-campaign
// gameplay system once, in sequence, so Missions 2–15 can actually advance in the deployed game.
export function installCampaignRuntime( app ) {
	if ( ! app?.game?.state || ! app.player || ! app.missionDirector ) return null;
	if ( app.campaignRuntime ) return app.campaignRuntime;

	if ( ! app.boatOwnership ) new BoatOwnership( app );
	if ( ! app.islandMissions ) new IslandMissionSystem( app );
	if ( ! app.dynamicIslandEvents ) new DynamicIslandEvents( app );
	if ( ! app.propertySystem ) new PropertySystem( app );
	if ( ! app.lateCampaign ) new LateCampaignSystem( app );
	guardMeshyFallbackVisibility( app, app.lateCampaign );

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
