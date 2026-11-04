import assert from 'node:assert/strict';
import { preloadMobileStartup, MOBILE_STARTUP_PRELOAD_FRAMES } from '../src/mobile/MobileStartupPreload.js';

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
