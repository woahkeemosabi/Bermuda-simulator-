import { CloudAccount } from './CloudAccount.js';

// main.js creates the App asynchronously and exposes it as window.__app once core gameplay systems
// exist. This small bootstrap keeps account/cloud concerns out of App.js and never blocks startup.
if ( typeof window !== 'undefined' ) {
	let tries = 0;
	const timer = setInterval( async () => {
		tries ++;
		const app = window.__app;
		if ( app?.game?.state ) {
			clearInterval( timer );
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
