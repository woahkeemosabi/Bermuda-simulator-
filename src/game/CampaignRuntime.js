import { BoatOwnership } from './BoatOwnership.js';
import { IslandMissionSystem } from './IslandMissionSystem.js';
import { DynamicIslandEvents } from './DynamicIslandEvents.js';
import { PropertySystem } from './PropertySystem.js';
import { LateCampaignSystem } from './LateCampaignSystem.js';

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
