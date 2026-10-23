const STYLE_ID = 'bm-screenshot-hud-style';

const ICONS = {
	wallet: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238cf4e9' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M3.5 7.2h15.4a1.9 1.9 0 0 1 1.9 1.9v8.1a1.9 1.9 0 0 1-1.9 1.9H5.4a2.2 2.2 0 0 1-2.2-2.2V6.1a2.2 2.2 0 0 1 1.6-2.1l11-2.7v5.9'/%3E%3Cpath d='M16 11h4.8v4H16a2 2 0 1 1 0-4Z'/%3E%3Ccircle cx='17.2' cy='13' r='.55' fill='%238cf4e9' stroke='none'/%3E%3C/svg%3E")`,
	bag: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23eaffff' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6.3 8.3h11.4l1.2 12H5.1l1.2-12Z'/%3E%3Cpath d='M8.7 8.3V6.5a3.3 3.3 0 0 1 6.6 0v1.8'/%3E%3C/svg%3E")`,
	clock: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23eaffff' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='12' r='8.7'/%3E%3Cpath d='M12 7.2v5.2l3.4 2'/%3E%3C/svg%3E")`,
	hand: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23ffffff' stroke-width='1.75' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M7.8 11V6.1a1.35 1.35 0 0 1 2.7 0V10M10.5 10V4.8a1.35 1.35 0 0 1 2.7 0V10M13.2 10V5.5a1.35 1.35 0 0 1 2.7 0v5M15.9 10V7.2a1.35 1.35 0 1 1 2.7 0v6.1c0 4.2-2.7 7.1-6.8 7.1-3.1 0-4.6-1.5-5.7-3.4L4 13.4a1.5 1.5 0 0 1 2.5-1.6l1.3 1.5V11Z'/%3E%3C/svg%3E")`,
	up: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23ffffff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6.5 14.5 5.5-6 5.5 6'/%3E%3C/svg%3E")`,
	camera: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23ffffff' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M4 8.2h3l1.4-2.1h7.2L17 8.2h3a1.5 1.5 0 0 1 1.5 1.5v8.1A1.5 1.5 0 0 1 20 19.3H4a1.5 1.5 0 0 1-1.5-1.5V9.7A1.5 1.5 0 0 1 4 8.2Z'/%3E%3Ccircle cx='12' cy='13.5' r='3.4'/%3E%3C/svg%3E")`,
	rod: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23ffffff' stroke-width='1.7' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M5 20 18.5 4.5M7.8 17.2l2.5 2.4M11.1 13.9l2.5 2.4M14.4 10.6l2.5 2.4'/%3E%3Cpath d='M18.5 4.5c2.3 2 2.3 5.3.2 7.4-1.1 1.1-1.3 2.7-.4 3.6.8.8 2.1.6 2.8-.2'/%3E%3C/svg%3E")`,
	run: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23ffffff' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='13.8' cy='4.8' r='1.8'/%3E%3Cpath d='m11.3 9.2 2.8 2.2 3.3.3M11.3 9.2 8.8 13l-3.5 1.4M11.3 9.2l2-2 3 1.3M8.8 13l2.4 2.2-1.1 4.6M11.2 15.2l4.1 1.2 2.7 3.1'/%3E%3C/svg%3E")`,
	anchor: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23ffffff' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='5' r='2.3'/%3E%3Cpath d='M12 7.3v12M6.2 10.5H17.8M4.2 14.8c.8 3.1 3.7 5.2 7.8 5.2s7-2.1 7.8-5.2M4.2 14.8l-1.4 2.3M19.8 14.8l1.4 2.3'/%3E%3C/svg%3E")`,
	light: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23ffffff' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m8 4 8 3-2 5-8-3 2-5ZM11 10l-2.8 9M6.4 14.5h5.3M15.5 8.8l5.3 2M16.7 5.9l4.2-1.3M14.3 3.7 16.5 1'/%3E%3C/svg%3E")`,
	fish: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23ffffff' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M3 12c3.1-4.2 7.3-6.2 11.4-4.7 2 .7 3.7 2.2 5.1 4.7-1.4 2.5-3.1 4-5.1 4.7C10.3 18.2 6.1 16.2 3 12Z'/%3E%3Cpath d='m19.5 12 3-3v6l-3-3ZM7.5 9.4l-1.7-2M7.5 14.6l-1.7 2'/%3E%3Ccircle cx='15.1' cy='10.7' r='.55' fill='%23fff' stroke='none'/%3E%3C/svg%3E")`,
	sun: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23ffd95e' stroke-width='1.8' stroke-linecap='round'%3E%3Ccircle cx='12' cy='12' r='4.2' fill='%23ffd95e' fill-opacity='.22'/%3E%3Cpath d='M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4'/%3E%3C/svg%3E")`,
	cloud: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23dcefff' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6.3 18h11.1a4.1 4.1 0 0 0 .5-8.2A6.1 6.1 0 0 0 6.4 8.1 5 5 0 0 0 6.3 18Z'/%3E%3C/svg%3E")`,
	storm: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23dcefff' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6.2 15.6h11.3a4 4 0 0 0 .4-8 6 6 0 0 0-11.4-1.5 4.8 4.8 0 0 0-.3 9.5Z'/%3E%3Cpath d='m12.8 14.2-2.1 4h2.1l-1.4 3.2 4-4.8h-2.3l1.4-2.4' stroke='%23ffd95e'/%3E%3C/svg%3E")`,
};

function mobileHardware() {
	if ( typeof navigator === 'undefined' ) return false;
	return /iPhone|iPad|iPod|Android/i.test( navigator.userAgent ) || navigator.maxTouchPoints > 1;
}

function installStyle() {
	if ( typeof document === 'undefined' || document.getElementById( STYLE_ID ) ) return;
	const style = document.createElement( 'style' );
	style.id = STYLE_ID;
	style.textContent = `
		#bm-wallet-live{position:fixed;top:max(12px,env(safe-area-inset-top));right:max(18px,env(safe-area-inset-right));z-index:96;display:flex;align-items:center;gap:8px;padding:8px 13px;border-radius:18px;background:rgba(7,39,60,.82);border:1px solid rgba(139,243,234,.35);box-shadow:0 7px 22px rgba(0,0,0,.22);backdrop-filter:blur(9px);-webkit-backdrop-filter:blur(9px);color:#fff;font:700 15px/1 system-ui,-apple-system,sans-serif;letter-spacing:.01em;pointer-events:none}
		#bm-wallet-live .bm-wallet-icon{display:block;width:23px;height:18px;flex:0 0 23px;background:${ ICONS.wallet } center/contain no-repeat}
		#bm-wallet-live .bm-wallet-value{min-width:50px;text-align:right}
		body.bm-mobile .gm-money{display:none!important}
		body.bm-mobile .gm-cooler::before{content:''!important;display:inline-block!important;width:18px;height:18px;flex:0 0 18px;background:${ ICONS.bag } center/contain no-repeat!important}
		body.bm-mobile .gm-clock-time::before{content:''!important;display:inline-block!important;width:16px;height:16px;margin-right:5px;vertical-align:-3px;background:${ ICONS.clock } center/contain no-repeat!important}
		body.bm-mobile .gm-weather::before{content:''!important;display:inline-block!important;width:18px;height:18px;margin-right:5px;vertical-align:-4px;background:var(--bm-weather-icon,${ ICONS.sun }) center/contain no-repeat!important}
		#bm-touch-stable button{display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;gap:1px!important;font-size:9px!important;line-height:1!important;letter-spacing:.06em!important}
		#bm-touch-stable button::before{content:'';display:block;width:22px;height:22px;flex:0 0 22px;background-position:center;background-repeat:no-repeat;background-size:contain;opacity:.96}
		#bm-touch-stable button[data-role='context']::before{background-image:${ ICONS.hand }}
		#bm-touch-stable button[data-role='up']::before{background-image:${ ICONS.up }}
		#bm-touch-stable button[data-role='cam']::before{background-image:${ ICONS.camera }}
		#bm-touch-stable button[data-role='rod']::before{background-image:${ ICONS.rod }}
		#bm-touch-stable button[data-role='run']::before{background-image:${ ICONS.run }}
		#bm-touch-stable button[data-role='anchor']::before{background-image:${ ICONS.anchor }}
		#bm-touch-stable button[data-role='light']::before{background-image:${ ICONS.light }}
		#bm-touch-stable button[data-role='fish']::before{background-image:${ ICONS.fish }}
		#bm-touch-stable button[data-role='dive']::before{background-image:${ ICONS.up };transform:rotate(180deg)}
		@media(max-width:700px){body.bm-mobile .gm-map{width:96px!important;height:96px!important;right:max(14px,env(safe-area-inset-right))!important;bottom:188px!important;opacity:.94!important}}
	`;
	document.head.appendChild( style );
}

function ensureWallet( app ) {
	let el = document.getElementById( 'bm-wallet-live' );
	if ( ! el ) {
		el = document.createElement( 'div' );
		el.id = 'bm-wallet-live';
		el.innerHTML = '<span class="bm-wallet-icon" aria-hidden="true"></span><span class="bm-wallet-value">$0</span>';
		document.body.appendChild( el );
	}
	const value = el.querySelector( '.bm-wallet-value' );
	if ( value ) value.textContent = `$${ Math.round( Number( app.game?.state?.money || 0 ) ).toLocaleString() }`;
}

function syncWeatherIcon() {
	const el = document.querySelector( '.gm-weather' );
	if ( ! el ) return;
	const text = String( el.textContent || '' ).toLowerCase();
	const icon = /storm|rain|thunder/.test( text ) ? ICONS.storm : /cloud|overcast/.test( text ) ? ICONS.cloud : ICONS.sun;
	el.style.setProperty( '--bm-weather-icon', icon );
}

export function installMobileScreenshotHUD( app ) {
	if ( ! app || ! mobileHardware() || typeof document === 'undefined' || app.__mobileScreenshotHUD ) return app?.__mobileScreenshotHUD || null;
	installStyle();

	const sync = () => {
		ensureWallet( app );
		syncWeatherIcon();
	};
	sync();
	const timer = window.setInterval( sync, 180 );
	window.addEventListener( 'pagehide', () => window.clearInterval( timer ), { once:true } );

	const state = app.__mobileScreenshotHUD = { sync, wallet:true, actionIcons:true };
	window.__mobileScreenshotHUD = state;
	return state;
}
