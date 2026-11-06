import assert from 'node:assert/strict';
import { GPU_TRACE_CASES, getGpuTraceCase, configureGpuTraceUrl, nextGpuTraceUrl } from '../src/mobile/GpuTraceCases.js';
import { getFftCoreVisualProfile } from '../src/mobile/Mobile75Config.js';
import { gpuAudit, gpuStage, gpuCompute, gpuDispatch, gpuRender, gpuSubmit, gpuQueueAck, gpuTexture, gpuBuffer, gpuDetailedReport } from '../src/mobile/GpuAudit.js';

for ( const test of GPU_TRACE_CASES ) {
	const url = configureGpuTraceUrl( new URL( 'https://example.test/?gpuTrace=1&traceCase=' + test.id ) );
	assert.equal( url.searchParams.has( 'freezeFFT' ), false, `${ test.id } must keep original FFT animating` );
	assert.equal( url.searchParams.get( 'G' ), '12', 'normal GPU trace must use mobile 75% scene budget' );
	assert.equal( url.searchParams.get( 'traceCase' ), test.id );
	for ( const [ key, value ] of Object.entries( test.flags || {} ) ) assert.equal( url.searchParams.get( key ), value );
}
const high = configureGpuTraceUrl( new URL( 'https://example.test/?gpuTrace=1&traceHighRes=1&traceCase=full' ) );
assert.equal( high.searchParams.get( 'G' ), '24', 'high-stress trace must be explicitly requested' );
assert.equal( getGpuTraceCase('fftcore').flags.noWake, '1' );
assert.equal( getGpuTraceCase('fftcore').flags.noShadows, '1' );
assert.deepEqual( getFftCoreVisualProfile('balanced'), { renderScale: 0.90, sceneScale: 0.90 } );
assert.deepEqual( getFftCoreVisualProfile('crisp'), { renderScale: 1.00, sceneScale: 1.00 } );
assert.equal( getFftCoreVisualProfile(''), null );
assert.equal( getFftCoreVisualProfile('unknown'), null );
let current = new URL( 'https://example.test/?gpuTrace=1&traceCase=full' );
for ( let i = 1; i < GPU_TRACE_CASES.length; i ++ ) {
	current = nextGpuTraceUrl( current );
	assert.equal( getGpuTraceCase( current.searchParams.get( 'traceCase' ) ).id, GPU_TRACE_CASES[ i ].id );
}
assert.equal( getGpuTraceCase( 'bad-id' ).id, 'full' );

// Enable the read-only in-memory tracer in Node to validate the event timeline.
gpuAudit.traceEnabled = true;
gpuStage( 'Frame begin', 18 );
gpuCompute( 'FFT butterfly' );
gpuDispatch( 'FFT butterfly', [ 8, 8, 1 ] );
gpuRender( 'water + transparent' );
gpuSubmit( 18 );
assert.equal( gpuAudit.pendingSubmissions.length, 1 );
assert.ok( gpuAudit.pendingSubmissions[ 0 ].commands.some( e => e.kind === 'dispatch' ) );
gpuQueueAck( 18 );
assert.equal( gpuAudit.pendingSubmissions.length, 0 );
assert.ok( gpuAudit.lastQueueLatencyMs >= 0 );
assert.ok( gpuAudit.peakQueueLatencyMs >= gpuAudit.lastQueueLatencyMs );
gpuTexture( 'create', 7, 'waterTexture', 256, 256, 'rgba16float', 524288 );
assert.equal( gpuAudit.trackedTextureBytes, 524288 );
gpuTexture( 'destroy', 7, 'waterTexture' );
assert.equal( gpuAudit.trackedTextureBytes, 0 );
gpuTexture( 'create', 8, 'terrainHeights', 2048, 2048, 'r32float', 16777216 );
gpuBuffer( 'create', 9, 'oceanSpectrum', 8388608 );
assert.equal( gpuAudit.trackedBufferBytes, 8388608 );
assert.match( gpuDetailedReport(), /TOP RESIDENT GPU TEXTURES[\s\S]*terrainHeights/ );
assert.match( gpuDetailedReport(), /TOP RESIDENT STORAGE BUFFERS[\s\S]*oceanSpectrum/ );
gpuTexture( 'destroy', 8, 'terrainHeights' );
gpuBuffer( 'destroy', 9, 'oceanSpectrum' );
assert.equal( gpuAudit.trackedBufferBytes, 0 );
assert.match( gpuDetailedReport(), /FFT butterfly/ );
console.log( 'GPU trace cases, submit-to-ack timeline and memory accounting pass.' );
