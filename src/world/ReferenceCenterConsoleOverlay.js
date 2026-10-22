// The original procedural Downeast lobster boat is the authoritative playable boat.
//
// A previous reference-matching pass hid its wheelhouse, working deck gear, traps, hauler,
// radar, helm and running gear and drew a generic centre-console/T-top shell on top of the
// physics hull. That changed the identity of the player's boat and also replaced its collider
// layout. Keep this compatibility export because ReferenceVerticalSlicePass still imports it,
// but deliberately perform no visual, interaction or collision mutations.
export function installReferenceCenterConsoleOverlay( app ) {

	if ( app ) app.__bermudaReferenceCenterConsole = null;
	if ( typeof window !== 'undefined' ) window.__bermudaReferenceCenterConsole = null;
	return null;

}
