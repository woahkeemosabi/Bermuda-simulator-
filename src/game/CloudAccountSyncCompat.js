import { CloudAccount } from './CloudAccount.js';

const META_PREFIX = 'bermuda.cloud.sync.v1.';

function store() {
	try { return typeof localStorage !== 'undefined' ? localStorage : null; }
	catch ( e ) { return null; }
}

function metaKey( userId ) { return META_PREFIX + userId; }
function readMeta( userId ) {
	const s = store();
	if ( ! s || ! userId ) return null;
	try { return JSON.parse( s.getItem( metaKey( userId ) ) || 'null' ); }
	catch ( e ) { return null; }
}
function writeMeta( userId, value ) {
	const s = store();
	if ( ! s || ! userId ) return;
	try { s.setItem( metaKey( userId ), JSON.stringify( value ) ); }
	catch ( e ) { /* optional */ }
}

function isMeaningfulLocal( state ) {
	if ( ! state ) return false;
	if ( state.money !== 75 || state.bankBalance > 0 ) return true;
	if ( state.inventory?.length || Object.keys( state.log || {} ).length ) return true;
	if ( state.missions?.active?.length || state.missions?.completed?.length ) return true;
	if ( state.vehicles?.bicycle?.parked || state.vehicles?.scooter?.owned || state.vehicles?.cars?.length || state.vehicles?.relic?.discovered ) return true;
	if ( state.boats?.owned?.length || state.properties?.owned?.length ) return true;
	if ( Object.values( state.reputation || {} ).some( ( v ) => Number( v ) > 0 ) ) return true;
	if ( Object.keys( state.storyFlags || {} ).length || state.discoveries?.length ) return true;
	return false;
}

function remoteStampOf( remote ) {
	return Number( remote?.payload?.clientUpdatedAt || Date.parse( remote?.updated_at || '' ) || 0 );
}

const basePushSave = CloudAccount.prototype.pushSave;
CloudAccount.prototype.pushSave = async function() {
	const ok = await basePushSave.call( this );
	if ( ok && this.user?.id ) writeMeta( this.user.id, { lastSync: Date.now(), source: 'push' } );
	return ok;
};

CloudAccount.prototype.reconcileSave = async function() {
	if ( ! this.user || ! this.state ) return;
	const rows = await this.request( `/rest/v1/player_saves?user_id=eq.${ encodeURIComponent( this.user.id ) }&select=payload,updated_at,revision&limit=1` );
	const remote = Array.isArray( rows ) ? rows[ 0 ] || null : null;
	if ( ! remote?.payload ) {
		await this.pushSave();
		return;
	}

	const meta = readMeta( this.user.id );
	const remoteStamp = remoteStampOf( remote );
	const localMeaningful = isMeaningfulLocal( this.state );

	// First time this browser links to this account:
	// - meaningful guest progression migrates UP to the account;
	// - a pristine starter save yields to the existing cloud save.
	if ( ! meta ) {
		if ( localMeaningful ) {
			await this.pushSave();
			return;
		}
		this._applyingRemote = true;
		try {
			if ( this.state.fromJSON( remote.payload ) ) {
				this.state.save();
				this.state.emit();
			}
		} finally { this._applyingRemote = false; }
		writeMeta( this.user.id, { lastSync: remoteStamp || Date.now(), source: 'pull' } );
		this.lastSync = new Date().toISOString();
		return;
	}

	// Returning device: compare the last successful sync with the server's timestamp. A server change
	// after our last sync came from another device and must be pulled; otherwise this device can push.
	if ( remoteStamp > Number( meta.lastSync || 0 ) + 1000 ) {
		this._applyingRemote = true;
		try {
			if ( this.state.fromJSON( remote.payload ) ) {
				this.state.save();
				this.state.emit();
			}
		} finally { this._applyingRemote = false; }
		writeMeta( this.user.id, { lastSync: remoteStamp, source: 'pull' } );
		this.lastSync = new Date().toISOString();
	} else await this.pushSave();
};
