// Finish the first few real world frames before exposing mobile controls. This
// primes staggered atmosphere/ocean work and first-use scene pipelines without
// creating a second GPU device or issuing concurrent frame submissions.
export const MOBILE_STARTUP_PRELOAD_FRAMES = 6;
// Full graphics iPhone QA: 30 real frames, spaced two seconds apart, give
// large pipeline, atmosphere and reflection jobs a full minute to settle.
export const MOBILE_FULL_PRELOAD_FRAMES = 30;
export const MOBILE_FULL_PRELOAD_WAIT_MS = 2000;

const pause = ms => new Promise( resolve => setTimeout( resolve, ms ) );

async function withTimeout( promise, ms, message ) {

	let timer;
	try {
		return await Promise.race( [
			Promise.resolve( promise ),
			new Promise( ( _, reject ) => {
				timer = setTimeout( () => reject( new Error( message ) ), ms );
			} ),
		] );
	} finally {
		clearTimeout( timer );
	}

}

export async function preloadMobileStartup( {
	frame,
	queueDone,
	pipelinesReady,
	checkDevice,
	onProgress = () => {},
	onQueueAck = () => {},
	frameCount = MOBILE_STARTUP_PRELOAD_FRAMES,
	frameWaitMs = 130,
	wait = pause,
} ) {

	for ( let i = 0; i < frameCount; i ++ ) {
		checkDevice();
		const step = i + 1;
		const status = frameWaitMs >= 1000
			? `Preparing full-quality Bermuda · ${Math.ceil((frameCount - i) * frameWaitMs / 1000)}s remaining`
			: step <= 2 ? 'Preparing the ocean and sky…' :
				step <= 4 ? 'Preparing the island…' : 'Finishing the 3D world…';
		onProgress( step, frameCount, status );
		// Keep the loader responsive and avoid bursting GPU work into Safari.
		await wait( frameWaitMs );
		checkDevice();
		frame( 1 / 60 );
		await withTimeout( queueDone(), 6500, 'GPU did not finish a preload frame' );
		onQueueAck();
		checkDevice();
		if ( step % 3 === 0 ) {
			// Shader compilation may be asynchronous. A bounded wait avoids a
			// permanent loading screen when Safari holds a pending pipeline.
			await Promise.race( [ pipelinesReady(), wait( 2500 ) ] );
			checkDevice();
		}
	}

}
