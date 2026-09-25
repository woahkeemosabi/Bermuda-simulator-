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
		this.renderScale = 1;
		this.clock = new Timer();
		this.frame = 0;
		this.onResize = [];

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

	}

	setRenderScale( s ) {

		this.renderScale = s;
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
		this.canvas.width = Math.max( 1, Math.floor( w * dpr ) );
		this.canvas.height = Math.max( 1, Math.floor( h * dpr ) );
		this.canvas.style.width = w + 'px';
		this.canvas.style.height = h + 'px';
		this.camera.aspect = w / h;
		this.camera.updateProjectionMatrix();
		FrameUniforms.fields.outputResolution.value.set( this.canvas.width, this.canvas.height );
		for ( const f of this.onResize ) f( w, h );

	}

	// the canvas texture of this frame (render target of the final post pass)
	currentTexture() {

		return GPU.context.getCurrentTexture();

	}

	start( update ) {

		const loop = ( t ) => {

			// Schedule first so one thrown frame cannot kill the animation loop.
			this._raf = requestAnimationFrame( loop );

			try {

				this.clock.update( t );
				let dt = this.clock.getDelta();
				if ( dt > 0.1 ) dt = 0.1;
				this.frame ++;
				update( dt, this.clock.getElapsed() );

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
