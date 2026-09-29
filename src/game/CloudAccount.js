// Optional Supabase-backed account + cloud-save layer.
// The simulator always remains playable as a guest. When no backend is configured this module is a
// no-op over the existing local GameState save. Supabase's anon key is a public client credential;
// row-level security in supabase/schema.sql is what protects each player's data.

const SESSION_KEY = 'bermuda.cloud.session.v1';
const SYNC_DEBOUNCE_MS = 1200;

function backendConfig() {
	const injected = typeof window !== 'undefined' ? window.__BERMUDA_SUPABASE__ : null;
	const url = injected?.url || import.meta.env?.VITE_SUPABASE_URL || '';
	const anonKey = injected?.anonKey || import.meta.env?.VITE_SUPABASE_ANON_KEY || '';
	return { url: String( url || '' ).replace( /\/$/, '' ), anonKey: String( anonKey || '' ) };
}

function storage() {
	try { return typeof localStorage !== 'undefined' ? localStorage : null; }
	catch ( e ) { return null; }
}

function nowISO() { return new Date().toISOString(); }

export class CloudAccount {
	constructor( game ) {
		this.game = game;
		this.state = game?.state || null;
		this.config = backendConfig();
		this.configured = !! ( this.config.url && this.config.anonKey );
		this.session = null;
		this.user = null;
		this.profile = null;
		this.status = this.configured ? 'guest' : 'local-only';
		this.lastSync = null;
		this._syncTimer = null;
		this._syncing = false;
		this._applyingRemote = false;
		this._unsubscribe = null;
		this.ui = null;
	}

	async init() {
		if ( typeof document !== 'undefined' ) this.mountUI();
		if ( ! this.configured ) { this.render(); return this; }

		this.restoreSession();
		await this.consumeAuthCallback();
		if ( this.session?.access_token ) {
			const ok = await this.refreshIfNeeded();
			if ( ok ) await this.finishSignedIn();
		}
		if ( this.state?.onChange ) this._unsubscribe = this.state.onChange( () => {
			if ( ! this._applyingRemote && this.user ) this.scheduleSync();
		} );
		this.render();
		return this;
	}

	destroy() {
		if ( this._unsubscribe ) this._unsubscribe();
		if ( this._syncTimer ) clearTimeout( this._syncTimer );
	}

	restoreSession() {
		const s = storage();
		if ( ! s ) return;
		try {
			const value = JSON.parse( s.getItem( SESSION_KEY ) || 'null' );
			if ( value?.access_token && value?.refresh_token ) this.session = value;
		} catch ( e ) { /* malformed/blocked session => guest */ }
	}

	persistSession() {
		const s = storage();
		if ( ! s ) return;
		try {
			if ( this.session ) s.setItem( SESSION_KEY, JSON.stringify( this.session ) );
			else s.removeItem( SESSION_KEY );
		} catch ( e ) { /* local storage is optional */ }
	}

	async consumeAuthCallback() {
		if ( typeof location === 'undefined' ) return;
		const hash = new URLSearchParams( location.hash.replace( /^#/, '' ) );
		const access = hash.get( 'access_token' );
		const refresh = hash.get( 'refresh_token' );
		if ( ! access || ! refresh ) return;
		this.session = {
			access_token: access,
			refresh_token: refresh,
			expires_at: Math.floor( Date.now() / 1000 ) + Number( hash.get( 'expires_in' ) || 3600 ),
			token_type: hash.get( 'token_type' ) || 'bearer',
		};
		this.persistSession();
		// Remove tokens from the address bar immediately.
		history.replaceState( null, '', location.pathname + location.search );
	}

	async refreshIfNeeded() {
		if ( ! this.session ) return false;
		const now = Math.floor( Date.now() / 1000 );
		if ( ( this.session.expires_at || 0 ) > now + 90 ) return true;
		try {
			const r = await this.request( '/auth/v1/token?grant_type=refresh_token', {
				method: 'POST', auth: false,
				body: { refresh_token: this.session.refresh_token },
			} );
			this.session = {
				access_token: r.access_token,
				refresh_token: r.refresh_token || this.session.refresh_token,
				expires_at: now + Number( r.expires_in || 3600 ),
				token_type: r.token_type || 'bearer',
			};
			this.persistSession();
			return true;
		} catch ( e ) {
			this.clearSession();
			return false;
		}
	}

	async finishSignedIn() {
		try {
			this.user = await this.request( '/auth/v1/user' );
			this.status = 'signed-in';
			await this.loadProfile();
			await this.reconcileSave();
		} catch ( e ) {
			console.warn( 'cloud account restore failed', e );
			this.clearSession();
		}
		this.render();
	}

	clearSession() {
		this.session = null;
		this.user = null;
		this.profile = null;
		this.status = this.configured ? 'guest' : 'local-only';
		this.persistSession();
		this.render();
	}

	async signInWithEmail( email ) {
		if ( ! this.configured ) throw new Error( 'Cloud save is not configured yet.' );
		email = String( email || '' ).trim();
		if ( ! /.+@.+\..+/.test( email ) ) throw new Error( 'Enter a valid email address.' );
		const redirect = typeof location !== 'undefined' ? location.origin + location.pathname + location.search : undefined;
		await this.request( '/auth/v1/otp', {
			method: 'POST', auth: false,
			body: { email, create_user: true, options: redirect ? { email_redirect_to: redirect } : undefined },
		} );
		this.status = 'email-sent';
		this.render( `Sign-in link sent to ${ email }` );
		return true;
	}

	async signOut() {
		try { if ( this.session?.access_token ) await this.request( '/auth/v1/logout', { method: 'POST' } ); }
		catch ( e ) { /* local sign-out still succeeds */ }
		this.clearSession();
	}

	async loadProfile() {
		if ( ! this.user ) return null;
		const rows = await this.request( `/rest/v1/player_profiles?user_id=eq.${ encodeURIComponent( this.user.id ) }&select=user_id,username,display_name&limit=1` );
		this.profile = Array.isArray( rows ) ? rows[ 0 ] || null : null;
		return this.profile;
	}

	async setUsername( username ) {
		if ( ! this.user ) throw new Error( 'Sign in first.' );
		username = String( username || '' ).trim().replace( /\s+/g, '_' );
		if ( ! /^[A-Za-z0-9_]{3,24}$/.test( username ) ) throw new Error( 'Username must be 3–24 letters, numbers or underscores.' );
		await this.request( '/rest/v1/player_profiles?on_conflict=user_id', {
			method: 'POST',
			prefer: 'resolution=merge-duplicates,return=representation',
			body: [ { user_id: this.user.id, username, display_name: username, updated_at: nowISO() } ],
		} );
		await this.loadProfile();
		this.render();
		return this.profile;
	}

	async reconcileSave() {
		if ( ! this.user || ! this.state ) return;
		const rows = await this.request( `/rest/v1/player_saves?user_id=eq.${ encodeURIComponent( this.user.id ) }&select=payload,updated_at,revision&limit=1` );
		const remote = Array.isArray( rows ) ? rows[ 0 ] || null : null;
		if ( ! remote?.payload ) {
			await this.pushSave();
			return;
		}

		// Existing local progress wins on the first account-link operation unless the remote save is
		// clearly newer. Cloud payloads carry a clientUpdatedAt marker; older payloads fall back to DB time.
		const localPayload = this.state.toJSON();
		const localStamp = Number( localPayload.clientUpdatedAt || 0 );
		const remoteStamp = Number( remote.payload.clientUpdatedAt || Date.parse( remote.updated_at ) || 0 );
		if ( remoteStamp > localStamp ) {
			this._applyingRemote = true;
			try {
				if ( this.state.fromJSON( remote.payload ) ) {
					this.state.save();
					this.state.emit();
				}
			} finally { this._applyingRemote = false; }
			this.lastSync = nowISO();
		} else await this.pushSave();
	}

	scheduleSync() {
		if ( ! this.user ) return;
		if ( this._syncTimer ) clearTimeout( this._syncTimer );
		this._syncTimer = setTimeout( () => { this._syncTimer = null; this.pushSave(); }, SYNC_DEBOUNCE_MS );
	}

	async pushSave() {
		if ( ! this.user || ! this.state || this._syncing ) return false;
		this._syncing = true;
		try {
			await this.refreshIfNeeded();
			if ( ! this.user || ! this.session ) return false;
			const payload = { ...this.state.toJSON(), clientUpdatedAt: Date.now() };
			await this.request( '/rest/v1/player_saves?on_conflict=user_id', {
				method: 'POST',
				prefer: 'resolution=merge-duplicates,return=minimal',
				body: [ { user_id: this.user.id, payload, updated_at: nowISO() } ],
			} );
			this.lastSync = nowISO();
			this.status = 'signed-in';
			this.render();
			return true;
		} catch ( e ) {
			console.warn( 'cloud save failed; local save remains authoritative', e );
			this.status = 'sync-error';
			this.render();
			return false;
		} finally { this._syncing = false; }
	}

	async request( path, { method = 'GET', body = null, auth = true, prefer = null } = {} ) {
		if ( ! this.configured ) throw new Error( 'Cloud backend not configured.' );
		const headers = { apikey: this.config.anonKey };
		if ( body !== null ) headers[ 'Content-Type' ] = 'application/json';
		if ( auth && this.session?.access_token ) headers.Authorization = `Bearer ${ this.session.access_token }`;
		if ( prefer ) headers.Prefer = prefer;
		const res = await fetch( this.config.url + path, { method, headers, body: body === null ? undefined : JSON.stringify( body ) } );
		if ( ! res.ok ) {
			let msg = `${ res.status } ${ res.statusText }`;
			try { const d = await res.json(); msg = d.msg || d.message || d.error_description || d.error || msg; } catch ( e ) { /* textless */ }
			throw new Error( msg );
		}
		if ( res.status === 204 ) return null;
		const text = await res.text();
		return text ? JSON.parse( text ) : null;
	}

	mountUI() {
		if ( this.ui || ! document.body ) return;
		const style = document.createElement( 'style' );
		style.textContent = `
.bm-account-btn{position:fixed;top:max(12px,env(safe-area-inset-top));right:14px;z-index:9000;border:1px solid rgba(143,235,226,.35);background:rgba(6,24,32,.78);backdrop-filter:blur(12px);color:#eafcf9;border-radius:18px;padding:8px 12px;font:600 11px/1 system-ui;letter-spacing:.08em;text-transform:uppercase}.bm-account-modal{position:fixed;inset:0;z-index:11000;display:none;align-items:center;justify-content:center;background:rgba(0,8,13,.68);padding:18px}.bm-account-modal.open{display:flex}.bm-account-card{width:min(420px,100%);background:#0d1c23;color:#eef8f7;border:1px solid rgba(130,230,220,.28);border-radius:20px;padding:22px;font:14px/1.45 system-ui;box-shadow:0 24px 80px #0008}.bm-account-card h2{margin:0 0 8px;font-size:21px}.bm-account-card p{opacity:.78;margin:6px 0 14px}.bm-account-card input{box-sizing:border-box;width:100%;margin:6px 0 10px;padding:12px;border-radius:12px;border:1px solid #ffffff28;background:#071116;color:#fff;font:inherit}.bm-account-row{display:flex;gap:8px;flex-wrap:wrap}.bm-account-card button{border:0;border-radius:12px;padding:11px 14px;background:#78dfd4;color:#08201f;font-weight:700}.bm-account-card button.secondary{background:#ffffff12;color:#fff}.bm-account-note{min-height:20px;color:#9fe7df;font-size:12px;margin-top:10px}.bm-account-meta{font-size:12px;opacity:.7}`;
		document.head.appendChild( style );

		const btn = document.createElement( 'button' ); btn.className = 'bm-account-btn'; btn.textContent = 'LOCAL SAVE';
		const modal = document.createElement( 'div' ); modal.className = 'bm-account-modal';
		modal.innerHTML = `<div class="bm-account-card"><h2>Bermuda Account</h2><p class="bm-account-summary">Keep playing as a guest or sign in to sync your life across devices.</p><div class="bm-account-guest"><input class="bm-account-email" type="email" inputmode="email" autocomplete="email" placeholder="Email address"><div class="bm-account-row"><button class="bm-account-send">Send sign-in link</button><button class="bm-account-close secondary">Continue as guest</button></div></div><div class="bm-account-signed" hidden><div class="bm-account-meta"></div><input class="bm-account-name" maxlength="24" placeholder="Choose display username"><div class="bm-account-row"><button class="bm-account-username">Save username</button><button class="bm-account-sync secondary">Sync now</button><button class="bm-account-signout secondary">Sign out</button></div></div><div class="bm-account-note"></div></div>`;
		document.body.append( btn, modal );
		const q = ( s ) => modal.querySelector( s );
		btn.addEventListener( 'click', () => modal.classList.add( 'open' ) );
		q( '.bm-account-close' ).addEventListener( 'click', () => modal.classList.remove( 'open' ) );
		modal.addEventListener( 'click', ( e ) => { if ( e.target === modal ) modal.classList.remove( 'open' ); } );
		q( '.bm-account-send' ).addEventListener( 'click', async () => {
			try { await this.signInWithEmail( q( '.bm-account-email' ).value ); }
			catch ( e ) { this.render( e.message ); }
		} );
		q( '.bm-account-username' ).addEventListener( 'click', async () => {
			try { await this.setUsername( q( '.bm-account-name' ).value ); this.render( 'Username saved.' ); }
			catch ( e ) { this.render( e.message ); }
		} );
		q( '.bm-account-sync' ).addEventListener( 'click', async () => { await this.pushSave(); this.render( 'Cloud save synced.' ); } );
		q( '.bm-account-signout' ).addEventListener( 'click', () => this.signOut() );
		this.ui = { btn, modal, q };
		this.render();
	}

	render( note = '' ) {
		if ( ! this.ui ) return;
		const { btn, q } = this.ui;
		const signed = !! this.user;
		q( '.bm-account-guest' ).hidden = signed;
		q( '.bm-account-signed' ).hidden = ! signed;
		if ( ! this.configured ) {
			btn.textContent = 'LOCAL SAVE';
			q( '.bm-account-summary' ).textContent = 'Guest saves are active on this device. Cloud accounts will appear here when the backend is connected.';
			q( '.bm-account-send' ).disabled = true;
		} else if ( signed ) {
			const name = this.profile?.display_name || this.profile?.username || this.user.email?.split( '@' )[ 0 ] || 'PLAYER';
			btn.textContent = name;
			q( '.bm-account-meta' ).textContent = `${ this.user.email || '' } · ${ this.lastSync ? 'cloud save active' : 'signed in' }`;
			q( '.bm-account-name' ).value = this.profile?.username || '';
		} else {
			btn.textContent = this.status === 'email-sent' ? 'CHECK EMAIL' : 'GUEST';
			q( '.bm-account-summary' ).textContent = 'Guest progress stays on this device. Sign in by email to link it to a cloud account.';
			q( '.bm-account-send' ).disabled = false;
		}
		q( '.bm-account-note' ).textContent = note || ( this.status === 'sync-error' ? 'Cloud sync failed. Your local save is safe and will retry later.' : '' );
	}
}
