import { CloudAccount } from './CloudAccount.js';
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

			// Stage 2 progression: the starter bicycle is a real owned/persistent world object.
			try {
				if ( ! app.bicycle ) app.bicycle = new Bicycle( app );
			} catch ( error ) {
				console.warn( 'starter bicycle unavailable; continuing on foot', error );
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
