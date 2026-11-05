// The catch-card uses a separate GPU canvas. On mobile, never render that
// canvas and the entire ocean/world in the same queue submission.
export function isMobileCatchModal( app ) {
	return Boolean( app?.mobileLite && app?.game?.hud?.catchOpen );
}

export function isolateMobilePortraitFrame( app ) {
	return Boolean( app?.mobileLite &&
		( app?.game?.hud?.catchOpen || app?.game?.hud?.portrait?.renderedThisFrame ) );
}
