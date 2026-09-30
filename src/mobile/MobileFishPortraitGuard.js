import { GPU } from '../engine/webgpu.js';
import { FishPortrait } from '../game/FishPortrait.js';

let installed = false;

function safeLevel() {
	if ( typeof location === 'undefined' ) return 0;
	return Math.max( 0, Number( new URLSearchParams( location.search ).get( 'gpuSafe' ) || 0 ) );
}

function fallbackPalette( species ) {
	const map = {
		silverside: [ '#d9e7e7', '#8db7c6', '#f6fbfb' ],
		mullet: [ '#9aa8a7', '#53656c', '#d7e0dc' ],
		needlefish: [ '#789fa0', '#3b6368', '#d7e7de' ],
		sergeant: [ '#e4d15d', '#222d3c', '#f5e893' ],
		grunt: [ '#d6c45e', '#3b79a5', '#f0df89' ],
		yellowtail: [ '#e6e8dd', '#e4c532', '#ffffff' ],
		chromis: [ '#3d8ec7', '#1d4e8a', '#76c4ea' ],
		tang: [ '#2c79b9', '#1d426f', '#59a7dc' ],
		wrasse: [ '#d9855b', '#7d8d5f', '#f0b58c' ],
		parrot: [ '#36a997', '#df5d68', '#78d6bd' ],
		angel: [ '#315d99', '#f1ca45', '#6ca3dc' ],
		jack: [ '#aeb8b7', '#5a6c70', '#e2e7e4' ],
		barracuda: [ '#869998', '#405d60', '#c7d4cf' ],
		grouper: [ '#8a6f55', '#4f4236', '#b79a76' ],
		redSnapper: [ '#d46c62', '#8f3940', '#f1a39a' ],
		tuna: [ '#586d7d', '#233b52', '#a9c1c7' ],
		mahi: [ '#57b98d', '#237b8c', '#e0c84b' ],
		wahoo: [ '#738b92', '#304d61', '#bad0d2' ],
		yellowfin: [ '#61788c', '#2c435d', '#e8d74b' ],
		blackGrouper: [ '#514d44', '#262a29', '#91836d' ],
		redHind: [ '#b66b5a', '#6d3e39', '#d99b82' ],
		laneSnapper: [ '#d99a82', '#ae5f59', '#f0c25a' ],
		tarpon: [ '#aebfc4', '#667b84', '#e8f2ef' ],
	};
	return map[ species ] || [ '#b6c8c7', '#52717b', '#eef5ef' ];
}

function drawFallbackFish( canvas, species ) {
	if ( ! canvas ) return;
	const cssW = Math.max( 280, canvas.clientWidth || 420 );
	const cssH = Math.max( 130, canvas.clientHeight || Math.round( cssW * 0.42 ) );
	const w = Math.min( 520, Math.round( cssW ) );
	const h = Math.max( 130, Math.round( w * cssH / cssW ) );
	canvas.width = w;
	canvas.height = h;
	const ctx = canvas.getContext( '2d' );
	if ( ! ctx ) return;
	ctx.clearRect( 0, 0, w, h );
	const [ body, accent, light ] = fallbackPalette( species );
	const cx = w * 0.50, cy = h * 0.53, len = w * 0.62, bh = h * 0.42;
	ctx.save();
	ctx.translate( cx, cy );

	// tail
	ctx.fillStyle = accent;
	ctx.beginPath();
	ctx.moveTo( - len * 0.47, 0 );
	ctx.lineTo( - len * 0.68, - bh * 0.55 );
	ctx.quadraticCurveTo( - len * 0.60, 0, - len * 0.68, bh * 0.55 );
	ctx.closePath();
	ctx.fill();

	// body
	const grad = ctx.createLinearGradient( 0, - bh * 0.5, 0, bh * 0.5 );
	grad.addColorStop( 0, light );
	grad.addColorStop( 0.46, body );
	grad.addColorStop( 1, accent );
	ctx.fillStyle = grad;
	ctx.beginPath();
	ctx.moveTo( - len * 0.48, 0 );
	ctx.bezierCurveTo( - len * 0.28, - bh * 0.62, len * 0.30, - bh * 0.56, len * 0.49, - bh * 0.08 );
	ctx.bezierCurveTo( len * 0.54, bh * 0.06, len * 0.28, bh * 0.58, - len * 0.48, 0 );
	ctx.closePath();
	ctx.fill();

	// species markings; these are deliberately lightweight 2D recovery visuals, not extra WebGPU work.
	ctx.save();
	ctx.clip();
	ctx.globalAlpha = 0.72;
	ctx.lineCap = 'round';
	if ( species === 'grunt' || species === 'yellowtail' || species === 'laneSnapper' ) {
		ctx.strokeStyle = species === 'grunt' ? '#387ab0' : '#d7b828';
		ctx.lineWidth = Math.max( 2, h * 0.018 );
		for ( let y = - bh * 0.30; y <= bh * 0.30; y += bh * 0.15 ) {
			ctx.beginPath(); ctx.moveTo( - len * 0.35, y ); ctx.quadraticCurveTo( 0, y - bh * 0.07, len * 0.37, y ); ctx.stroke();
		}
	} else if ( species === 'sergeant' ) {
		ctx.fillStyle = '#25364b';
		for ( let x = - len * 0.24; x <= len * 0.28; x += len * 0.13 ) ctx.fillRect( x, - bh * 0.48, len * 0.045, bh );
	} else if ( species === 'silverside' || species === 'mullet' || species === 'tarpon' ) {
		ctx.fillStyle = 'rgba(255,255,255,.55)';
		ctx.fillRect( - len * 0.38, - bh * 0.05, len * 0.76, bh * 0.10 );
	} else if ( species === 'mahi' || species === 'parrot' ) {
		ctx.fillStyle = 'rgba(238,215,71,.55)';
		for ( let i = 0; i < 9; i ++ ) {
			const x = - len * 0.30 + i * len * 0.075;
			ctx.beginPath(); ctx.arc( x, Math.sin( i * 1.7 ) * bh * 0.18, h * 0.018, 0, Math.PI * 2 ); ctx.fill();
		}
	}
	ctx.restore();

	// dorsal and lower fins
	ctx.globalAlpha = 0.9;
	ctx.fillStyle = accent;
	ctx.beginPath();
	ctx.moveTo( - len * 0.08, - bh * 0.42 ); ctx.lineTo( len * 0.10, - bh * 0.75 ); ctx.lineTo( len * 0.24, - bh * 0.37 ); ctx.closePath(); ctx.fill();
	ctx.beginPath();
	ctx.moveTo( - len * 0.02, bh * 0.38 ); ctx.lineTo( len * 0.12, bh * 0.62 ); ctx.lineTo( len * 0.22, bh * 0.32 ); ctx.closePath(); ctx.fill();

	// eye / gill
	ctx.globalAlpha = 1;
	ctx.fillStyle = '#111820';
	ctx.beginPath(); ctx.arc( len * 0.35, - bh * 0.12, Math.max( 3, h * 0.026 ), 0, Math.PI * 2 ); ctx.fill();
	ctx.fillStyle = '#f5fbf8';
	ctx.beginPath(); ctx.arc( len * 0.355, - bh * 0.13, Math.max( 1, h * 0.008 ), 0, Math.PI * 2 ); ctx.fill();
	ctx.strokeStyle = 'rgba(20,35,40,.40)';
	ctx.lineWidth = Math.max( 1, h * 0.008 );
	ctx.beginPath(); ctx.arc( len * 0.25, 0, bh * 0.20, - Math.PI * 0.55, Math.PI * 0.55 ); ctx.stroke();
	ctx.restore();
}

export function installMobileFishPortraitGuard() {
	if ( installed ) return window.__mobileFishPortraitGuard;
	installed = true;

	const safe = safeLevel();
	const originalAttach = FishPortrait.prototype.attach;
	const originalShow = FishPortrait.prototype.show;

	// Inventory thumbnails use an HDR render, downsample pass and GPU readback. Phones do not need
	// that extra allocation while the main WebGPU world is resident.
	FishPortrait.prototype.thumbnail = function() { return Promise.resolve( null ); };
	FishPortrait.prototype.thumbUrl = function() { return null; };

	if ( safe >= 2 ) {
		// Deep recovery mode avoids a second WebGPU renderer entirely, but never leaves the catch stage
		// blank. Draw a lightweight species-specific 2D fish into the same canvas instead.
		FishPortrait.prototype.attach = function( canvas ) {
			this.live = null;
			this.canvas = canvas || null;
			this.context = null;
			this._mobileFallback2D = true;
			return !! canvas;
		};
		FishPortrait.prototype.show = function( species, kg ) {
			this.live = null;
			this._mobileFallbackSpecies = species;
			drawFallbackFish( this.canvas, species );
			return true;
		};
		FishPortrait.prototype.update = function() {
			if ( this._mobileFallback2D && this.canvas && this._mobileFallbackSpecies ) drawFallbackFish( this.canvas, this._mobileFallbackSpecies );
		};
	} else {
		FishPortrait.prototype.attach = function( canvas ) {
			this._mobileFallback2D = false;
			return originalAttach.call( this, canvas );
		};
		FishPortrait.prototype.show = function( species, kg ) {
			return originalShow.call( this, species, kg );
		};
		FishPortrait.prototype.update = function( dt ) {
			if ( ! GPU.device ) return;
			const lv = this.live;
			if ( ! lv || ! this.context || ! this.canvas ) return;

			lv.t += dt;
			const c = this.canvas;
			const cssW = Math.max( 2, c.clientWidth || 2 );
			const cssH = Math.max( 2, c.clientHeight || Math.round( cssW * 0.48 ) );
			// Normal Mobile High keeps the real fish at 640px. First-stage recovery keeps the same real
			// procedural fish, but caps the secondary renderer to 384px rather than suppressing it.
			const cap = safe >= 1 ? 384 : 640;
			const cw = Math.max( 2, Math.min( cap, Math.round( cssW ) ) );
			const ch = Math.max( 2, Math.round( cw * cssH / cssW ) );
			if ( c.width !== cw || c.height !== ch ) {
				c.width = cw;
				c.height = ch;
			}

			if ( this.exposure?.fields?.ss ) this.exposure.fields.ss.value = 1;
			const T = this._target( 'live', cw, ch );
			const tr = this._liveTransform( lv.t );
			const L = this._place( lv.species, lv.kg, tr );
			this.light.sweep = - 1.1 + ( ( lv.t * 0.32 ) % 2.6 );
			this._frame( L, T.w, T.h, 0.78 );
			this._draw( T );
			if ( ! this.present ) this.present = this._pass( this.format, () => this.targets.live.hdr );
			this.present.render( { colorViews: [ this.context.getCurrentTexture().createView() ], clear: [ 0, 0, 0, 0 ] } );
		};
	}

	const state = {
		installed: true,
		safeLevel: safe,
		livePortrait: safe < 2,
		fallback2D: safe >= 2,
		maxWidth: safe >= 2 ? 520 : safe >= 1 ? 384 : 640,
	};
	if ( typeof window !== 'undefined' ) window.__mobileFishPortraitGuard = state;
	return state;
}
