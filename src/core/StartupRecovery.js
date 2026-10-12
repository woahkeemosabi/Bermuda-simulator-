// Recovery is a normal reload; never erase game saves or the installed offline package.
export function recoveryURL( href, mobile, safe = false ) {

	const url = new URL( href );
	for ( const key of [ 'gpuRecovery', 'recoveryReason', 'gpuSafe', 'desktop', 'scale', 'G', 'noVeg', 'noSim', 'noHaze', 'noCaustics', 'noRefraction', 'noClouds' ] ) url.searchParams.delete( key );
	url.searchParams.set( 'launch', 'online' );
	if ( safe ) url.searchParams.set( 'quality', mobile ? 'mobile-safe' : 'performance' );
	return url.href;

}

export function startupFailureHelp( message ) {

	if ( /WebGPU.*not available|No WebGPU adapter|graphics adapter/i.test( message ) ) return 'This browser could not open a WebGPU graphics device. On a computer, check that browser graphics acceleration is enabled. On a phone, open the link directly in Safari or Chrome. Retry after closing other graphics-heavy tabs.';
	if ( /device lost|destroyed|out of memory|GPU queue|createBuffer/i.test( message ) ) return 'The graphics device stopped during loading. Close other game tabs and try reduced graphics. Your saved game is kept.';
	if ( /fetch|network|GLB:|download|module|timeout|timed out/i.test( message ) ) return 'A required file or graphics step did not finish. Retry online with a stable connection, or try reduced graphics. Your saved game is kept.';
	return 'Startup stopped. Retry online or try reduced graphics. If it happens again, send a screenshot of the error shown here.';

}

export function showStartupRecovery( error, { mobile = false } = {} ) {

	const message = String( error?.message || error || 'Unknown startup error' );
	let panel = document.getElementById( 'startup-recovery' );
	if ( panel ) return;
	panel = document.createElement( 'div' );
	panel.id = 'startup-recovery';
	panel.setAttribute( 'role', 'alert' );
	panel.style.cssText = 'position:fixed;bottom:max(20px,env(safe-area-inset-bottom));left:50%;transform:translateX(-50%);width:min(520px,calc(100vw - 32px));box-sizing:border-box;z-index:10000;padding:16px;border:1px solid #75cbbb;border-radius:16px;background:#071d28;color:#efffff;font:14px/1.45 system-ui;box-shadow:0 10px 40px #0008';
	const help = document.createElement( 'p' );
	help.style.margin = '0 0 12px';
	help.textContent = startupFailureHelp( message );
	panel.appendChild( help );
	const details = document.createElement( 'small' );
	details.style.cssText = 'display:block;margin-bottom:12px;overflow-wrap:anywhere;color:#bce1dd';
	details.textContent = message;
	panel.appendChild( details );
	for ( const [ label, safe ] of [ [ 'Retry online', false ], [ 'Try reduced graphics', true ] ] ) {

		const link = document.createElement( 'a' );
		link.href = recoveryURL( location.href, mobile, safe );
		link.textContent = label;
		link.style.cssText = 'display:inline-block;margin:0 8px 4px 0;padding:10px 12px;border-radius:9px;background:#94eddf;color:#09262c;text-decoration:none;font-weight:700';
		panel.appendChild( link );

	}
	document.body.appendChild( panel );

}
