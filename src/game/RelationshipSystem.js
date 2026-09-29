// Small-island relationship progression. Reputation is earned through actual dealings with Martha
// and Joe rather than a generic XP bar. Existing GameState relationship fields remain authoritative.

const MILESTONES = Object.freeze( {
	Martha: { respected: 20, trusted: 50 },
	Joe: { respected: 20, trusted: 50 },
} );

function money( n ) { return '$' + Math.max( 0, Math.round( Number( n ) || 0 ) ).toLocaleString(); }

export class RelationshipSystem {
	constructor( app ) {
		this.app = app;
		this.game = app.game;
		this.state = app.game.state;
		this.player = app.player;
		this.martha = app.game?.chandlery?.vendor || null;
		this.joe = app.game?.stand?.vendor || null;
		this._lastTier = {
			Martha: this.tier( 'Martha' ),
			Joe: this.tier( 'Joe' ),
		};
		this.patchEconomy();
		this.mountUI();
		this.unsubscribe = this.state.onChange( () => this.refresh() );

		const originalUpdate = this.player.update.bind( this.player );
		this.player.update = ( dt ) => {
			originalUpdate( dt );
			this.update();
		};

		this.refresh( true );
		app.relationshipSystem = this;
	}

	points( person ) {
		const a = Number( this.state.reputation?.[ person ] || 0 );
		const b = Number( this.state.relationships?.[ person ]?.points || 0 );
		return Math.max( 0, a, b );
	}

	hasMet( person ) {
		if ( this.points( person ) > 0 ) return true;
		return person === 'Martha' ? !! this.state.storyFlags?.metMartha : !! this.state.storyFlags?.metJoe;
	}

	tier( person ) {
		const p = this.points( person );
		if ( ! this.hasMet( person ) ) return 'Not met';
		if ( p >= MILESTONES[ person ].trusted ) return 'Trusted';
		if ( p >= MILESTONES[ person ].respected ) return 'Respected';
		return 'Known';
	}

	nextMilestone( person ) {
		const p = this.points( person );
		const m = MILESTONES[ person ];
		if ( p < m.respected ) return { label: 'Respected', points: m.respected };
		if ( p < m.trusted ) return { label: 'Trusted', points: m.trusted };
		return null;
	}

	award( person, amount, reason = '' ) {
		amount = Math.max( 0, Math.floor( Number( amount ) || 0 ) );
		if ( ! amount ) return 0;
		const before = this.tier( person );
		const total = this.state.addReputation( person, amount );
		const after = this.tier( person );
		if ( before !== after ) this.game.toast( `${ person } · ${ after }`, 3000 );
		else if ( reason ) this.game.toast( `${ person } +${ amount } · ${ reason }`, 1800 );
		this.applyMilestones();
		return total;
	}

	patchEconomy() {
		if ( this.state.__bermudaRelationshipEconomy ) return;
		this.state.__bermudaRelationshipEconomy = true;

		// Joe relationship rises with total landed value, not number of transactions. Carrying the
		// remainder prevents repeatedly selling one tiny fish at a time from farming reputation.
		const realSell = this.state.sell.bind( this.state );
		this.state.sell = ( ids = null ) => {
			const result = realSell( ids );
			if ( result?.count && result.total > 0 ) {
				const f = this.state.storyFlags;
				f.joeFishSalesValue = Number( f.joeFishSalesValue || 0 ) + result.total;
				const pool = Number( f.joeFishRepRemainder || 0 ) + result.total;
				const earned = Math.floor( pool / 120 );
				f.joeFishRepRemainder = pool - earned * 120;
				if ( earned > 0 ) this.award( 'Joe', earned );
				else this.state.save();
			}
			return result;
		};

		// Martha remembers meaningful shop business as well. Reputation accrues from cumulative spend,
		// so buying upgrades at different times still contributes without making cheap purchases farmable.
		const realBuy = this.state.buy.bind( this.state );
		this.state.buy = ( key ) => {
			const result = realBuy( key );
			if ( result?.cost > 0 ) {
				const f = this.state.storyFlags;
				f.marthaShopSpend = Number( f.marthaShopSpend || 0 ) + result.cost;
				const pool = Number( f.marthaShopRepRemainder || 0 ) + result.cost;
				const earned = Math.floor( pool / 180 );
				f.marthaShopRepRemainder = pool - earned * 180;
				if ( earned > 0 ) this.award( 'Martha', earned );
				else this.state.save();
			}
			return result;
		};
	}

	applyMilestones() {
		const flags = this.state.storyFlags;
		let dirty = false;
		for ( const person of [ 'Martha', 'Joe' ] ) {
			const p = this.points( person );
			const tier = this.tier( person );
			if ( this.state.relationships?.[ person ] && this.state.relationships[ person ].status !== tier ) {
				this.state.relationships[ person ].status = tier;
				dirty = true;
			}
			const lower = person.toLowerCase();
			if ( p >= 20 && ! flags[ `${ lower }Respected` ] ) { flags[ `${ lower }Respected` ] = true; dirty = true; }
			if ( p >= 50 && ! flags[ `${ lower }Trusted` ] ) { flags[ `${ lower }Trusted` ] = true; dirty = true; }
		}
		// These flags are consumed by later contract/special-order stages; they do not fabricate a
		// mission before that mission exists.
		if ( flags.joeRespected && ! flags.marineContractsEligible ) { flags.marineContractsEligible = true; dirty = true; }
		if ( flags.joeTrusted && ! flags.salvageContractsEligible ) { flags.salvageContractsEligible = true; dirty = true; }
		if ( flags.marthaRespected && ! flags.marthaSpecialOrdersEligible ) { flags.marthaSpecialOrdersEligible = true; dirty = true; }
		if ( dirty ) this.state.save();
	}

	refresh( quiet = false ) {
		this.applyMilestones();
		for ( const person of [ 'Martha', 'Joe' ] ) {
			const tier = this.tier( person );
			if ( ! quiet && tier !== this._lastTier[ person ] ) this.game.toast( `${ person } · ${ tier }`, 3000 );
			this._lastTier[ person ] = tier;
		}
		this.updateGreetings();
	}

	updateGreetings() {
		if ( this.martha ) {
			const t = this.tier( 'Martha' );
			this.martha.greeting = t === 'Trusted'
				? 'Good to see you. If the island needs something found, I know who to call.'
				: t === 'Respected'
					? 'You have been putting the work in. I can keep an eye out for better gear.'
					: 'Bait, line, reels, upgrades and diesel. What do you need?';
		}
		if ( this.joe ) {
			const t = this.tier( 'Joe' );
			this.joe.greeting = t === 'Trusted'
				? 'You know these waters now. I have proper marine work when you are ready.'
				: t === 'Respected'
					? 'Good haul. People around the harbour are starting to know your name.'
					: 'Bring me legal fish and lobster and I will pay a fair price.';
		}
	}

	mountUI() {
		if ( typeof document === 'undefined' || document.getElementById( 'bm-relationship' ) ) return;
		const style = document.createElement( 'style' );
		style.textContent = `#bm-relationship{position:fixed;left:50%;bottom:max(120px,calc(env(safe-area-inset-bottom) + 92px));transform:translateX(-50%);z-index:67;display:none;min-width:180px;padding:8px 12px;border-radius:12px;background:rgba(5,22,31,.76);border:1px solid rgba(130,235,224,.25);backdrop-filter:blur(9px);-webkit-backdrop-filter:blur(9px);color:#eaffff;text-align:center;font:600 11px/1.35 system-ui,-apple-system,sans-serif;pointer-events:none}.bm-rel-name{font-size:12px}.bm-rel-tier{color:#86e6dc;margin-left:5px}.bm-rel-next{font-size:9px;opacity:.67;margin-top:2px;letter-spacing:.04em}`;
		document.head.appendChild( style );
		this.el = document.createElement( 'div' );
		this.el.id = 'bm-relationship';
		document.body.appendChild( this.el );
	}

	update() {
		if ( ! this.el || this.player.mode !== 'walk' ) { if ( this.el ) this.el.style.display = 'none'; return; }
		let person = null;
		if ( this.martha?.inRange( this.player.position ) ) person = 'Martha';
		else if ( this.joe?.inRange( this.player.position ) ) person = 'Joe';
		if ( ! person ) { this.el.style.display = 'none'; return; }
		const points = this.points( person );
		const tier = this.tier( person );
		const next = this.nextMilestone( person );
		this.el.style.display = '';
		this.el.innerHTML = `<div><span class="bm-rel-name">${ person }</span><span class="bm-rel-tier">${ tier }</span></div><div class="bm-rel-next">${ next ? `${ points } / ${ next.points } · ${ next.label }` : `${ points } · island trust established` }</div>`;
	}
}
