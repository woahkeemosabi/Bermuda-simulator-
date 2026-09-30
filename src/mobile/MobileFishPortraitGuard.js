import { GPU } from '../engine/webgpu.js';
import { FishPortrait } from '../game/FishPortrait.js';

let installed = false;

function safeLevel() {
	if ( typeof location === 'undefined' ) return 0;
	return Math.max( 0, Number( new URLSearchParams( location.search ).get( 'gpuSafe' ) || 0 ) );
}

export function installMobileFishPortraitGuard() {
	if ( installed ) return window.__mobileFishPortraitGuard;
	installed = true;

	const safe = safeLevel();
	const originalAttach = FishPortrait.prototype.attach;
	const originalUpdate = FishPortrait.prototype.update;

	// Inventory thumbnails use an HDR render, downsample pass and GPU readback. Phones do not need
	// that extra allocation while the main WebGPU world is resident.
	FishPortrait.prototype.thumbnail = function() { return Promise.resolve( null ); };
	FishPortrait.prototype.thumbUrl = function() { return null; };

	if ( safe >= 1 ) {
		// Recovery/safe mode keeps the catch card text and statistics but never allocates a second
		// WebGPU render target/renderer for the fish portrait.
		FishPortrait.prototype.attach = function() {
			this.live = null;
			return false;
		};
		FishPortrait.prototype.update = function() {};
	} else {
		FishPortrait.prototype.attach = function( canvas ) {
			return originalAttach.call( this, canvas );
		};
		FishPortrait.prototype.update = function( dt ) {
			if ( ! GPU.device ) return;
			const lv = this.live;
			if ( ! lv || ! this.context || ! this.canvas ) return;

			lv.t += dt;
			const c = this.canvas;
			// The desktop portrait renders at DPR<=2 and then supersamples 2x again. On an iPhone that can
			// create a transient rgba16float + depth32 target tens of MB in size at the instant a fish is
			// landed. Render at CSS-pixel resolution and 1x supersampling instead; the catch card remains
			// sharp at phone size while the temporary GPU footprint drops by roughly an order of magnitude.
			const cssW = Math.max( 2, c.clientWidth || 2 );
			const cssH = Math.max( 2, c.clientHeight || Math.round( cssW * 0.48 ) );
			const cw = Math.max( 2, Math.min( 640, Math.round( cssW ) ) );
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

	const state = { installed:true, safeLevel:safe, livePortrait:safe < 1, maxWidth:safe < 1 ? 640 : 0 };
	if ( typeof window !== 'undefined' ) window.__mobileFishPortraitGuard = state;
	return state;
}
