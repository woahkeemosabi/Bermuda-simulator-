import './CloudPublicConfig.js';
import './LegacyProgressionMigration.js';
import { CloudAccount } from './CloudAccount.js';
import './CloudAccountAuthCompat.js';
import './CloudAccountSyncCompat.js';
import { MissionDirector } from './MissionDirector.js';
import { LifeProgression } from './LifeProgression.js';
import { RelationshipSystem } from './RelationshipSystem.js';
import { VehiclePersistence } from './VehiclePersistence.js';
import { PropertySystem } from './PropertySystem.js';
import { MarthaShopInterior } from './MarthaShopInterior.js';
import { BoatOwnership } from './BoatOwnership.js';
import { BoatUpgradeVisuals } from './BoatUpgradeVisuals.js';
import { Bicycle } from '../player/Bicycle.js';

// main.js creates the App asynchronously and exposes it as window.__app once core gameplay systems
// exist. This small bootstrap keeps progression/account concerns out of App.js and never blocks startup.
if ( typeof window !== 'undefined' ) {
	let tries = 0;
	const timer = setInterval( async () => {
		tries ++;
		const app = window.__app;
		if ( app?.game?.state && app?.player ) {
			clearInterval( timer );

			try {
				if ( ! app.bicycle ) app.bicycle = new Bicycle( app );
			} catch ( error ) {
				console.warn( 'starter bicycle unavailable; continuing on foot', error );
			}

			try {
				if ( ! app.vehiclePersistence ) app.vehiclePersistence = new VehiclePersistence( app );
			} catch ( error ) {
				console.warn( 'vehicle persistence unavailable; current-session vehicles remain usable', error );
			}

			try {
				if ( ! app.missionDirector ) app.missionDirector = new MissionDirector( app );
				if ( ! app.progression ) app.progression = new LifeProgression( app );
			} catch ( error ) {
				console.warn( 'life progression unavailable; existing gameplay remains active', error );
			}

			try {
				if ( ! app.relationshipSystem ) app.relationshipSystem = new RelationshipSystem( app );
			} catch ( error ) {
				console.warn( 'relationship progression unavailable; mission state remains intact', error );
			}

			try {
				if ( ! app.marthaShop ) app.marthaShop = new MarthaShopInterior( app );
			} catch ( error ) {
				console.warn( 'Martha shop interior unavailable; vendor menu remains usable', error );
			}

			try {
				if ( ! app.boatOwnership ) app.boatOwnership = new BoatOwnership( app );
				if ( ! app.boatUpgradeVisuals ) app.boatUpgradeVisuals = new BoatUpgradeVisuals( app );
			} catch ( error ) {
				console.warn( 'boat progression visuals unavailable; existing boat controller remains active', error );
			}

			try {
				if ( ! app.propertySystem ) app.propertySystem = new PropertySystem( app );
			} catch ( error ) {
				console.warn( 'property progression unavailable; the rest of the life loop remains active', error );
			}

			// Accounts are optional: local save remains authoritative until a backend is configured.
			try {
				const account = new CloudAccount( app.game );
				app.account = account;
				window.__bermudaAccount = account;
				await account.init();
			} catch ( error ) {
				console.warn( 'Bermuda cloud account unavailable; continuing with local save', error );
			}
		} else if ( tries > 300 ) clearInterval( timer );
	}, 250 );
}
