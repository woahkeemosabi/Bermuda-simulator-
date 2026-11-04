import assert from 'node:assert/strict';
import { MOBILE_75, configureMobile75Url } from '../src/mobile/Mobile75Config.js';

const url = new URL( 'https://example.test/?freezeFFT=1&noSim=1&noCaustics=1&noSpray=1&noClouds=1&noHaze=1&missions=boat' );
configureMobile75Url( url );
for ( const key of [ 'freezeFFT', 'noSim', 'noCaustics', 'noSpray', 'noClouds', 'noHaze' ] )
	assert.equal( url.searchParams.has( key ), false, `${ key } must not disable the 75% visual preset` );
assert.equal( url.searchParams.get( 'missions' ), 'boat', 'preserve gameplay state' );
assert.equal( MOBILE_75.renderScale, 1, 'present iPhone graphics at native CSS-pixel resolution' );
assert.equal( Number( url.searchParams.get( 'scale' ) ), 0.8, 'render the mobile scene at 80% CSS resolution for sharper graphics with GPU headroom' );
assert.equal( url.searchParams.get( 'cloudtest' ), 'panorama' );
assert.equal( 'oceanCascades' in MOBILE_75, false, 'original FFT cascades must remain unchanged' );
assert.equal( 'oceanSizes' in MOBILE_75, false, 'original FFT frequencies must remain unchanged' );
console.log( 'Mobile 75% full-effects URL + original FFT preset OK' );
