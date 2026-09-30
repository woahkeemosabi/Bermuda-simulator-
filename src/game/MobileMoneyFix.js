export function installMobileMoneyFix() {
	if ( typeof document === 'undefined' || window.__mobileMoneyFixInstalled ) return;
	window.__mobileMoneyFixInstalled = true;

	let attempts = 0;
	const apply = () => {
		attempts ++;
		const money = document.querySelector( '.gm-money' );
		if ( money ) {
			money.style.setProperty( 'display', 'flex', 'important' );
			money.style.setProperty( 'align-items', 'center', 'important' );
			money.style.setProperty( 'gap', '5px', 'important' );
			money.style.setProperty( 'font-weight', '800', 'important' );
			if ( ! money.querySelector( '.bm-money-icon' ) ) {
				const icon = document.createElement( 'span' );
				icon.className = 'bm-money-icon';
				icon.textContent = '💵';
				icon.setAttribute( 'aria-hidden', 'true' );
				money.prepend( icon );
			}
			return true;
		}
		return attempts > 60;
	};

	if ( apply() ) return;
	const timer = setInterval( () => {
		if ( apply() ) clearInterval( timer );
	}, 200 );
	window.addEventListener( 'pagehide', () => clearInterval( timer ), { once: true } );
}
