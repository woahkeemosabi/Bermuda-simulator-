import { GPU } from './gpu/GPU.js';
import { PerspectiveCamera } from './scene/Camera.js';
import { Scene } from './scene/Scene.js';
import { Timer } from './math/Timer.js';
import { MeshRenderer } from './render/MeshRenderer.js';
import { FrameUniforms } from './render/Frame.js';

// Canvas, device, main camera / scene and the frame loop.
export class Engine {

	constructor( container ) {

		this.container = container;
		const params = typeof location !== 'undefined' ? new URLSearchParams( location.search ) : null;
		this.composeMode = !! ( params && params.has( 'compose' ) );
		this.benchmarkMode = !! ( params && params.has( 'benchmark' ) );
		// Mobile Safari continuously changes innerHeight while its browser chrome expands/collapses.
		// Reallocating every HDR/depth/history target for those toolbar-only resizes causes a large
		// transient WebGPU memory spike. The high-quality phone profile locks the backing buffer until
		// the viewport width/orientation actually changes; CSS still follows the live visual viewport.
		this.stableMobileViewport = !! ( params && params.has( 'stableViewport' ) );
		this.mobileFrameCap = Math.max( 0, Number( params?.get( 'mobileFps' ) || 0 ) );
		this._stableBufferWidth = 0;
		this._stableBufferHeight = 0;
		this._stableOrientation = '';
		this._mobileFrameLast = 0;
		// Compose mode is deliberately a low-load development view. The app's mobile post scale still
		// applies inside this output size, so ?compose=1&gpuSafe=2 lands at roughly 58% effective linear
		// resolution while keeping the CSS/camera viewport unchanged for layout decisions.
		this.renderScale = this.composeMode ? 0.8 : 1;
		this.clock = new Timer();
		this.frame = 0;
		this.onResize = [];
		this._composeLast = 0;
		this._benchmarkLast = 0;
		this._benchmarkSamples = [];

	}

	async init() {

		const canvas = document.createElement( 'canvas' );
		canvas.tabIndex = 0;
		this.container.appendChild( canvas );
		this.canvas = canvas;
		this.domElement = canvas;
		await GPU.init( { canvas } );
		this.meshRenderer = new MeshRenderer();
		this.meshRenderer.syncPipelines = false; // compile in the background (App.precompile waits for them)
		this.camera = new PerspectiveCamera( 62, window.innerWidth / window.innerHeight, 0.06, 60000 );
		this.scene = new Scene();
		window.addEventListener( 'resize', () => this.resize() );
		this.resize();

		if ( this.benchmarkMode && typeof window !== 'undefined' ) {

			window.__bermudaBenchmark = {
				active: true,
				samples: this._benchmarkSamples,
				latest: null,
				note: 'Renderer totals include every mesh pass accumulated during the sampled frame; use as a relative Tidewater/Bermuda workload baseline.'
			};

		}

	}

	setRenderScale( s ) {

		this.renderScale = s;
		// A deliberate render-scale change must be allowed to resize the locked backing buffer.
		if ( this.stableMobileViewport ) {
			this._stableBufferWidth = 0;
			this._stableBufferHeight = 0;
		}
		this.resize();

	}

	// output (canvas) size in pixels
	get width() {

		return this.canvas.width;

	}

	get height() {

		return this.canvas.height;

	}

	resize() {

		const w = window.innerWidth, h = window.innerHeight;
		const dpr = this.renderScale;
		let bufferW = Math.max( 1, Math.floor( w * dpr ) );
		let bufferH = Math.max( 1, Math.floor( h * dpr ) );

		if ( this.stableMobileViewport ) {

			const orientation = w >= h ? 'landscape' : 'portrait';
			const first = ! this._stableBufferWidth || ! this._stableBufferHeight;
			const orientationChanged = !! this._stableOrientation && orientation !== this._stableOrientation;
			// Safari toolbar animation is almost entirely height-only. A meaningful width change means
			// rotation, split view or an actual layout change and is therefore safe to reallocate once.
			const widthChanged = this._stableBufferWidth && Math.abs( bufferW - this._stableBufferWidth ) > 24;
			if ( first || orientationChanged || widthChanged ) {

				this._stableBufferWidth = bufferW;
				this._stableBufferHeight = bufferH;
				this._stableOrientation = orientation;

			} else {

				bufferW = this._stableBufferWidth;
				bufferH = this._stableBufferHeight;

			}

		}

		// The previous mobile fix locked the canvas dimensions, but still fired every GPU resize
		// listener for Safari's height-only toolbar animation. Those listeners can resize HDR/depth/
		// history targets even when the canvas backing store is unchanged, recreating the exact memory
		// spike the stable viewport is meant to prevent. Track the actual backing-store change and only
		// notify GPU-sized listeners when a real reallocation is required.
		const backingChanged = this.canvas.width !== bufferW || this.canvas.height !== bufferH;
		if ( this.canvas.width !== bufferW ) this.canvas.width = bufferW;
		if ( this.canvas.height !== bufferH ) this.canvas.height = bufferH;
		this.canvas.style.width = w + 'px';
		this.canvas.style.height = h + 'px';
		this.camera.aspect = w / h;
		this.camera.updateProjectionMatrix();
		FrameUniforms.fields.outputResolution.value.set( this.canvas.width, this.canvas.height );
		if ( ! this.stableMobileViewport || backingChanged ) {

			for ( const f of this.onResize ) f( w, h );

		}

	}

	// output a low-frequency, read-only workload sample without touching gameplay or render decisions
	_sampleBenchmark( t ) {

		if ( ! this.benchmarkMode || ! this.meshRenderer || t - this._benchmarkLast < 1000 ) return;
		this._benchmarkLast = t;
		const stats = this.meshRenderer.stats || {};
		const sample = {
			time: Math.round( t ),
			frame: this.frame,
			draws: stats.draws || 0,
			triangles: stats.triangles || 0,
			pipelines: stats.pipelines || 0,
			width: this.width,
			height: this.height,
			compose: this.composeMode
		};
		this._benchmarkSamples.push( sample );
		if ( this._benchmarkSamples.length > 120 ) this._benchmarkSamples.shift();
		window.__bermudaBenchmark.latest = sample;

	}

	// output (canvas) texture of this frame (render target of the final post pass)
	currentTexture() {

		return GPU.context.getCurrentTexture();

	}

	start( update ) {

		const loop = ( t ) => {

			// Schedule first so one thrown frame cannot kill the animation loop.
			this._raf = requestAnimationFrame( loop );

			try {

				// World composition does not need 60 fps. Capping the heavy WebGPU frame to ~30 fps cuts
				// sustained iPhone GPU pressure substantially while touch/DOM events continue at full rate.
				if ( this.composeMode && this._composeLast && t - this._composeLast < 31 ) return;
				if ( this.composeMode ) this._composeLast = t;

				// High-fidelity mobile keeps the same render detail but can cap presentation frequency. This
				// lowers sustained GPU/thermal pressure without reducing water, geometry, lighting or texture
				// quality. 30 fps also maps cleanly to Safari's 60 Hz rAF cadence.
				if ( this.mobileFrameCap > 0 ) {

					const interval = 1000 / this.mobileFrameCap;
					if ( this._mobileFrameLast && t - this._mobileFrameLast < interval - 1 ) return;
					this._mobileFrameLast = t;

				}

				this.clock.update( t );
				let dt = this.clock.getDelta();
				if ( dt > 0.1 ) dt = 0.1;
				this.frame ++;
				update( dt, this.clock.getElapsed() );
				this._sampleBenchmark( t );

			} catch ( e ) {

				this.lastFrameError = e;
				window.__bermudaFrameError = e;
				window.__bermudaFrameErrorCount = ( window.__bermudaFrameErrorCount || 0 ) + 1;

				// IMPORTANT: App._frame() creates a WebGPU command encoder at the start of every
				// frame and normally clears it in GPU.submit(). If anything throws before submit,
				// leaving that half-recorded encoder around poisons every following frame on Safari.
				// Drop the incomplete frame and any readback hooks so the next RAF starts clean.
				GPU.encoder = null;
				GPU._submitHooks = [];

				const now = performance.now();
				if ( ! this._lastFrameErrorLog || now - this._lastFrameErrorLog > 1000 ) {

					console.error( 'Bermuda frame recovered after error:', e );
					this._lastFrameErrorLog = now;

				}

			}

		};

		this._raf = requestAnimationFrame( loop );

	}

	stop() {

		cancelAnimationFrame( this._raf );

	}

}
