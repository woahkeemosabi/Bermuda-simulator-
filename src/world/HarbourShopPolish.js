// The Bermuda-specific facade/sign layer has been retired.
// Joe and Martha now use Tidewater's own stall presentations without a second kiosk shell,
// pixel sign, awning, service-counter collider or duplicate shop light layered over them.
export function installHarbourShopPolish( app ) {
	if ( ! app ) return null;
	if ( app.harbourShopPolish ) return app.harbourShopPolish;
	const state = { disabled: true, reason: 'tidewater-storefront-restore' };
	app.harbourShopPolish = state;
	if ( typeof window !== 'undefined' ) window.__harbourShopPolish = state;
	return state;
}
