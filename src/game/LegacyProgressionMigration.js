import { GameState } from './GameState.js';

const WORKBOAT = Object.freeze( { id: 'lobster-workboat', name: 'Downeast Lobster Boat', legacy: true } );
const baseFromJSON = GameState.prototype.fromJSON;

function hasLegacyProgress( d ) {
	if ( Number.isFinite( d?.money ) && d.money !== 75 ) return true;
	if ( Array.isArray( d?.inventory ) && d.inventory.length ) return true;
	if ( d?.log && Object.keys( d.log ).length ) return true;
	if ( d?.upgrades && Object.values( d.upgrades ).some( ( v ) => Number( v ) > 0 ) ) return true;
	return false;
}

GameState.prototype.fromJSON = function( d ) {
	const ok = baseFromJSON.call( this, d );
	if ( ! ok ) return false;

	// Before progression existed, the lobster boat was freely usable. Preserve that entitlement for
	// old saves instead of suddenly locking a long-running player out of a boat they already used.
	const noBoat = ! this.boats?.owned?.length;
	const v1 = d?.v === 1;
	const earlyV2Legacy = d?.v === 2 && noBoat && hasLegacyProgress( d ) &&
		! d?.missions?.active?.length && ! d?.missions?.completed?.length;
	if ( noBoat && ( v1 || earlyV2Legacy ) ) {
		this.boats.owned.push( { ...WORKBOAT } );
		this.boats.activeBoat = WORKBOAT.id;
		this.storyFlags.legacyBoatGrandfathered = true;
	}
	return true;
};
