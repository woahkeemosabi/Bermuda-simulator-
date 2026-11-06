import assert from 'node:assert/strict';
import { preloadMobileStartup, MOBILE_STARTUP_PRELOAD_FRAMES, MOBILE_FULL_PRELOAD_FRAMES, MOBILE_FULL_PRELOAD_WAIT_MS } from '../src/mobile/MobileStartupPreload.js';

const events = [];
let pending = false;
const progress = [];
await preloadMobileStartup( {
	frame: () => {
		assert.equal( pending, false, 'no overlapping frame submissions' );
		pending = true;
		events.push( 'frame' );
	},
	queueDone: async () => {
		assert.equal( pending, true );
		events.push( 'complete' );
		pending = false;
	},
	pipelinesReady: async () => events.push( 'pipelines' ),
	checkDevice: () => {},
	onProgress: ( i, total, stage ) => progress.push( [ i, total, stage ] ),
	onQueueAck: () => events.push( 'ack' ),
	wait: async () => {},
} );
assert.equal( MOBILE_STARTUP_PRELOAD_FRAMES, 6 );
assert.equal( events.filter( x => x === 'frame' ).length, 6 );
assert.equal( events.filter( x => x === 'complete' ).length, 6 );
assert.equal( events.filter( x => x === 'ack' ).length, 6 );
assert.equal( events.filter( x => x === 'pipelines' ).length, 2 );
assert.deepEqual( progress.map( p => p[ 0 ] ), [ 1, 2, 3, 4, 5, 6 ] );
assert.ok( progress.every( p => p[ 1 ] === 6 && p[ 2 ].length > 0 ) );

let frames = 0;
await assert.rejects( preloadMobileStartup( {
	frame: () => frames ++,
	queueDone: async () => {},
	pipelinesReady: async () => {},
	checkDevice: () => { if ( frames >= 2 ) throw new Error( 'device lost' ); },
	wait: async () => {},
} ), /device lost/ );
assert.equal( frames, 2, 'preloader stops submitting on device loss' );

console.log( 'mobile startup preload stages and device-loss stop verified' );

let fullFrames = 0, waitedMs = 0, fullProgress = [];
await preloadMobileStartup({
	frame: () => fullFrames++,
	queueDone: async () => {},
	pipelinesReady: async () => {},
	checkDevice: () => {},
	onProgress: (step,total,status) => fullProgress.push({step,total,status}),
	frameCount: MOBILE_FULL_PRELOAD_FRAMES,
	frameWaitMs: MOBILE_FULL_PRELOAD_WAIT_MS,
	wait: async ms => { waitedMs += ms; },
});
assert.equal(MOBILE_FULL_PRELOAD_FRAMES, 30);
assert.equal(MOBILE_FULL_PRELOAD_WAIT_MS, 2000);
assert.equal(fullFrames, 30, 'full graphics must warm 30 real scene frames');
assert.ok(waitedMs >= 60000, 'full graphics must wait at least 60 seconds before Explore');
assert.match(fullProgress[0].status, /60s remaining/);
assert.match(fullProgress.at(-1).status, /2s remaining/);
