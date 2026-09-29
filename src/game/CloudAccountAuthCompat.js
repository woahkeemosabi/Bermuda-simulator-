import { CloudAccount } from './CloudAccount.js';

// supabase-js sends emailRedirectTo as the /otp redirect_to query parameter, while the REST body
// contains email/create_user/data/security metadata. Keep our zero-dependency browser client aligned
// with that wire format so GitHub Pages can use Magic Links without adding another runtime package.
CloudAccount.prototype.signInWithEmail = async function( email ) {
	if ( ! this.configured ) throw new Error( 'Cloud save is not configured yet.' );
	email = String( email || '' ).trim();
	if ( ! /.+@.+\..+/.test( email ) ) throw new Error( 'Enter a valid email address.' );
	const redirect = typeof location !== 'undefined' ? location.origin + location.pathname + location.search : '';
	const path = '/auth/v1/otp' + ( redirect ? `?redirect_to=${ encodeURIComponent( redirect ) }` : '' );
	await this.request( path, {
		method: 'POST',
		auth: false,
		body: { email, data: {}, create_user: true, gotrue_meta_security: {} },
	} );
	this.status = 'email-sent';
	this.render( `Sign-in link sent to ${ email }` );
	return true;
};
