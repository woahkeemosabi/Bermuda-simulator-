import { App } from '../App.js';
import { GPU } from '../engine/gpu/GPU.js';

const RECENT_KEY = 'bermudaGPUDebugRecent';
const RECOVERY_KEY = 'bermudaGPUDebugRecoveryRecent';
const ASSET_RE = /\.(?:glb|gltf|bin|ktx2|png|jpe?g|webp|hdr|exr)(?:[?#]|$)/i;

let installed = false;
let appRef = null;

function isMobileFastStart( qs ) {

	if ( typeof navigator === 'undefined' || typeof screen === 'undefined' ) return false;
	const mobileDevice = /iPhone|iPad|iPod|Android/i.test( navigator.userAgent ) ||
		( navigator.maxTouchPoints > 1 && Math.min( screen.width, screen.height ) < 1024 );
	return mobileDevice && ! qs.has( 'desktop' );

}

function storageRead( key, fallback = [] ) {

	try {

		const value = JSON.parse( sessionStorage.getItem( key ) || 'null' );
		return Array.isArray( value ) ? value : fallback;

	} catch ( _ ) {

		return fallback;

	}

}

function storageWrite( key, value ) {

	try { sessionStorage.setItem( key, JSON.stringify( value ) ); } catch ( _ ) {}

}

function extent3( size ) {

	if ( Array.isArray( size ) ) return [ Number( size[ 0 ] || 1 ), Number( size[ 1 ] || 1 ), Number( size[ 2 ] || 1 ) ];
	if ( typeof size === 'number' ) return [ size, 1, 1 ];
	return [ Number( size?.width || 1 ), Number( size?.height || 1 ), Number( size?.depthOrArrayLayers || 1 ) ];

}

function textureBytes( desc ) {

	const format = String( desc?.format || 'rgba8unorm' );
	const [ width, height, depth ] = extent3( desc?.size );
	const mips = Math.max( 1, Number( desc?.mipLevelCount || 1 ) );
	const samples = Math.max( 1, Number( desc?.sampleCount || 1 ) );
	const is3D = desc?.dimension === '3d';
	const bytesPerPixel = {
		r8unorm: 1, r8uint: 1, r8sint: 1,
		rg8unorm: 2, rg8uint: 2, rg8sint: 2,
		r16float: 2, r16uint: 2, r16sint: 2,
		rgba8unorm: 4, 'rgba8unorm-srgb': 4, rgba8uint: 4, rgba8sint: 4,
		bgra8unorm: 4, 'bgra8unorm-srgb': 4, rgb10a2unorm: 4, rg11b10ufloat: 4,
		rg16float: 4, rg16uint: 4, rg16sint: 4, r32float: 4, r32uint: 4, r32sint: 4,
		rgba16float: 8, rgba16uint: 8, rgba16sint: 8, rg32float: 8, rg32uint: 8, rg32sint: 8,
		rgba32float: 16, rgba32uint: 16, rgba32sint: 16,
		depth32float: 4, depth24plus: 4, 'depth24plus-stencil8': 4, 'depth32float-stencil8': 8,
	}[ format ];

	let total = 0;
	for ( let mip = 0; mip < mips; mip ++ ) {

		const w = Math.max( 1, width >> mip );
		const h = Math.max( 1, height >> mip );
		const d = is3D ? Math.max( 1, depth >> mip ) : depth;
		if ( bytesPerPixel ) {

			total += w * h * d * bytesPerPixel * samples;
			continue;

		}
		// WebGPU block-compressed formats. This is an estimate, but it is much closer than treating
		// compressed assets as uncompressed RGBA.
		const blockBytes = /^(?:bc1|bc4|etc2-rgb8|etc2-rgb8a1)/.test( format ) ? 8 :
			/^(?:bc2|bc3|bc5|bc6|bc7|etc2-rgba8|eac-rg11)/.test( format ) ? 16 : 0;
		if ( blockBytes ) total += Math.ceil( w / 4 ) * Math.ceil( h / 4 ) * d * blockBytes * samples;
		else total += w * h * d * 4 * samples;

	}
	return total;

}

function shortAssetName( input ) {

	let value = '';
	try { value = typeof input === 'string' ? input : input?.url || String( input || '' ); } catch ( _ ) {}
	try {

		const u = new URL( value, location.href );
		const parts = u.pathname.split( '/' ).filter( Boolean );
		return parts.slice( - 3 ).join( '/' ) || u.pathname || value;

	} catch ( _ ) {

		return value.slice( - 96 );

	}

}

function createTracker( recoveryReload ) {

	const previous = storageRead( RECENT_KEY );
	if ( recoveryReload && previous.length ) storageWrite( RECOVERY_KEY, previous );
	const recoveryRecent = recoveryReload ? storageRead( RECOVERY_KEY ) : [];
	let recent = previous.slice( - 10 );
	const seen = new Set( recent.map( ( e ) => `${ e.kind }:${ e.name }` ) );
	const buffers = new Map();
	const textures = new Map();
	const frameTimes = [];

	const first = ( kind, name ) => {

		name = String( name || 'unnamed' ).replace( /\s+/g, ' ' ).slice( 0, 96 );
		const key = `${ kind }:${ name }`;
		if ( seen.has( key ) ) return;
		seen.add( key );
		recent.push( { ts: Date.now(), kind, name } );
		recent = recent.slice( - 10 );
		storageWrite( RECENT_KEY, recent );

	};

	const track = ( map, resource, bytes, kind, name ) => {

		if ( ! resource || map.has( resource ) ) return;
		map.set( resource, Math.max( 0, Number( bytes ) || 0 ) );
		first( kind, name );
		if ( typeof resource.destroy === 'function' ) {

			try {

				const destroy = resource.destroy.bind( resource );
				resource.destroy = () => {

					map.delete( resource );
					return destroy();

				};

			} catch ( _ ) { /* Safari host objects may not allow an own destroy property. */ }

		}

	};

	return {
		first,
		trackBuffer: ( resource, desc ) => track( buffers, resource, Number( desc?.size || 0 ), 'buffer', desc?.label || `${ Number( desc?.size || 0 ) } bytes` ),
		trackTexture: ( resource, desc ) => track( textures, resource, textureBytes( desc ), 'texture', desc?.label || desc?.format || 'texture' ),
		frame() {

			const now = performance.now();
			frameTimes.push( now );
			while ( frameTimes.length && frameTimes[ 0 ] < now - 1000 ) frameTimes.shift();

		},
		fps: () => frameTimes.length,
		memoryBytes: () => [ ...buffers.values(), ...textures.values() ].reduce( ( sum, n ) => sum + n, 0 ),
		recent: () => recent,
		recoveryRecent: () => recoveryRecent,
	};

}

function instrumentPassPrototype( tracker, ctorName, kind ) {

	const proto = globalThis[ ctorName ]?.prototype;
	if ( ! proto || typeof proto.setPipeline !== 'function' || proto.setPipeline.__bermudaDebugWrapped ) return;
	try {

		const original = proto.setPipeline;
		const wrapped = function( pipeline ) {

			tracker.first( kind, pipeline?.label || 'unlabelled pipeline' );
			return original.call( this, pipeline );

		};
		wrapped.__bermudaDebugWrapped = true;
		proto.setPipeline = wrapped;

	} catch ( _ ) { /* Instrumentation is diagnostic only; never break WebGPU if a prototype is sealed. */ }

}

function instrumentDevice( tracker ) {

	const device = GPU.device;
	if ( ! device || device.__bermudaDebugWrapped ) return;
	try { device.__bermudaDebugWrapped = true; } catch ( _ ) {}

	for ( const [ method, track ] of [
		[ 'createBuffer', tracker.trackBuffer ],
		[ 'createTexture', tracker.trackTexture ],
	] ) {

		try {

			const original = device[ method ].bind( device );
			device[ method ] = ( desc ) => {

				const resource = original( desc );
				track( resource, desc || {} );
				return resource;

			};

		} catch ( _ ) { /* Keep running if Safari exposes a non-writable WebGPU method. */ }

	}

	instrumentPassPrototype( tracker, 'GPURenderPassEncoder', 'draw' );
	instrumentPassPrototype( tracker, 'GPUComputePassEncoder', 'dispatch' );

}

function installFetchTracing( tracker ) {

	if ( typeof window.fetch !== 'function' || window.fetch.__bermudaDebugWrapped ) return;
	const original = window.fetch.bind( window );
	const wrapped = ( input, init ) => {

		const name = shortAssetName( input );
		if ( ASSET_RE.test( name ) ) tracker.first( 'asset', name );
		return original( input, init );

	};
	wrapped.__bermudaDebugWrapped = true;
	window.fetch = wrapped;

}

function applyDiagnosticSwitches( app, qs, tracker ) {

	appRef = app;
	tracker?.first( 'system', 'App init complete' );

	if ( qs.has( 'noShadows' ) && app.shadows ) {

		app.shadows.enabled = false;
		tracker?.first( 'system', 'noShadows active' );

	}

	if ( qs.has( 'noPost' ) && app.post ) {

		const post = app.post;
		post.aaMode = 'none';
		if ( post.params?.bloom ) post.params.bloom.value = 0;
		if ( post.autoExposure?.enabled ) post.autoExposure.enabled.value = 0;
		const build = post._build.bind( post );
		post._build = function() {

			build();
			this.aaMode = 'none';
			if ( this.params?.bloom ) this.params.bloom.value = 0;
			if ( Array.isArray( this._bloomPasses ) ) this._bloomPasses.length = 0;
			if ( this.autoExposure?.enabled ) this.autoExposure.enabled.value = 0;
			if ( this.meterKernel ) this.meterKernel.dispatch = () => {};

		};
		tracker?.first( 'system', 'noPost active (TAAU/bloom/exposure skipped)' );

	}

}

function fmtEvent( event ) {

	const d = new Date( event.ts );
	const time = `${ String( d.getHours() ).padStart( 2, '0' ) }:${ String( d.getMinutes() ).padStart( 2, '0' ) }:${ String( d.getSeconds() ).padStart( 2, '0' ) }.${ String( d.getMilliseconds() ).padStart( 3, '0' ) }`;
	return `${ time } ${ event.kind}: ${ event.name }`;

}

function installPanel( tracker, qs ) {

	const create = () => {

		if ( document.getElementById( 'bm-gpu-debug' ) || ! document.body ) return;
		const el = document.createElement( 'pre' );
		el.id = 'bm-gpu-debug';
		el.style.cssText = [
			'position:fixed', 'left:6px', 'top:max(6px,env(safe-area-inset-top))', 'z-index:2147483647',
			'margin:0', 'padding:7px 8px', 'max-width:calc(100vw - 12px)', 'max-height:48vh', 'overflow:hidden',
			'box-sizing:border-box', 'white-space:pre-wrap', 'word-break:break-word', 'pointer-events:none',
			'background:rgba(0,0,0,.72)', 'color:#d9fff8', 'border:1px solid rgba(120,255,231,.35)',
			'border-radius:6px', 'font:10px/1.25 ui-monospace,SFMono-Regular,Menlo,monospace',
		].join( ';' );
		document.body.appendChild( el );

		const render = () => {

			let lastError = 'none';
			try { lastError = sessionStorage.getItem( 'bermudaLastGPUError' ) || 'none'; } catch ( _ ) {}
			const liveQs = new URLSearchParams( location.search );
			const scale = Number( appRef?.post?.scale ?? liveQs.get( 'scale' ) ?? 1 );
			const memoryMB = tracker.memoryBytes() / ( 1024 * 1024 );
			const lines = [
				'BERMUDA GPU DEBUG',
				`lastGPUError: ${ lastError }`,
				`gpuStall: ${ String( window.__bermudaGPUStall || 'none' ) }`,
				`gpuSafe: ${ liveQs.get( 'gpuSafe' ) || '0' }   scale: ${ Number.isFinite( scale ) ? scale.toFixed( 2 ) : '?' }`,
				`fps: ${ tracker.fps() }   gpu-est: ${ memoryMB.toFixed( 1 ) } MB   compiling: ${ GPU._pending?.size || 0 }`,
				`switches: noPost=${ qs.has( 'noPost' ) ? 1 : 0 } noShadows=${ qs.has( 'noShadows' ) ? 1 : 0 }`,
			];
			if ( qs.has( 'simpleWater' ) ) lines.push( 'simpleWater: unsupported (no existing cheap water path)' );
			const recovery = tracker.recoveryRecent();
			if ( recovery.length ) {

				lines.push( '--- pre-recovery last 10 ---' );
				for ( const event of recovery.slice( - 10 ) ) lines.push( fmtEvent( event ) );

			}
			lines.push( '--- current last 10 ---' );
			for ( const event of tracker.recent().slice( - 10 ) ) lines.push( fmtEvent( event ) );
			el.textContent = lines.join( '\n' );

		};
		render();
		window.__bermudaGPUDebugTimer = setInterval( render, 250 );

	};

	if ( document.body ) create();
	else document.addEventListener( 'DOMContentLoaded', create, { once: true } );

}

export function installMobileGPUDiagnostics() {

	if ( installed || typeof window === 'undefined' || typeof document === 'undefined' ) return;
	const qs = new URLSearchParams( location.search );
	if ( ! isMobileFastStart( qs ) ) return;
	const debug = qs.has( 'debug' );
	const hasSwitch = qs.has( 'noPost' ) || qs.has( 'noShadows' ) || qs.has( 'simpleWater' );
	if ( ! debug && ! hasSwitch ) return;
	installed = true;

	const recoveryReload = qs.get( 'recoveryReason' ) === 'gpu-recovery' || Number( qs.get( 'gpuRecovery' ) || 0 ) > 0;
	const tracker = debug ? createTracker( recoveryReload ) : null;
	if ( tracker ) {

		window.__bermudaGPUDiagnostics = tracker;
		installFetchTracing( tracker );
		const gpuAsync = GPU._async.bind( GPU );
		GPU._async = function( desc, kind ) {

			tracker.first( 'pipeline', `${ kind }: ${ desc?.label || 'unlabelled' }` );
			return gpuAsync( desc, kind );

		};
		const gpuInit = GPU.init.bind( GPU );
		GPU.init = async function( ...args ) {

			const result = await gpuInit( ...args );
			instrumentDevice( tracker );
			const submit = GPU.submit.bind( GPU );
			GPU.submit = function() {

				const hadWork = !! GPU.encoder;
				const value = submit();
				if ( hadWork ) tracker.frame();
				return value;

			};
			return result;

		};
		installPanel( tracker, qs );

	}

	const appInit = App.prototype.init;
	App.prototype.init = async function( ...args ) {

		const result = await appInit.apply( this, args );
		applyDiagnosticSwitches( this, qs, tracker );
		return result;

	};

}
