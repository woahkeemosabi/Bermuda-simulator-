import assert from 'node:assert/strict';
import { MOBILE_75, MOBILE_SHARP_85, configureMobile75Url, configureMobileSharp85Url } from '../src/mobile/Mobile75Config.js';

const url = new URL( 'https://example.test/?freezeFFT=1&noSim=1&noCaustics=1&noSpray=1&noClouds=1&noHaze=1&missions=boat' );
configureMobile75Url( url );
for ( const key of [ 'freezeFFT', 'noSim', 'noCaustics', 'noSpray', 'noClouds', 'noHaze' ] )
	assert.equal( url.searchParams.has( key ), false, `${ key } must not disable the 75% visual preset` );
assert.equal( url.searchParams.get( 'missions' ), 'boat', 'preserve gameplay state' );
assert.equal( MOBILE_75.renderScale, 0.75, 'restore the last iPhone-confirmed playable output size' );
assert.equal( Number( url.searchParams.get( 'scale' ) ), 0.75, 'restore the last iPhone-confirmed playable internal scene size' );
assert.equal( url.searchParams.get( 'cloudtest' ), 'panorama' );
assert.equal( 'oceanCascades' in MOBILE_75, false, 'original FFT cascades must remain unchanged' );
assert.equal( 'oceanSizes' in MOBILE_75, false, 'original FFT frequencies must remain unchanged' );
const sharp = new URL( 'https://example.test/?missions=boat&envtest=skip' );
configureMobile75Url( sharp );
configureMobileSharp85Url( sharp );
assert.equal( MOBILE_SHARP_85.renderScale, 0.85 );
assert.equal( Number( sharp.searchParams.get( 'scale' ) ), 0.85 );
assert.equal( sharp.searchParams.get( 'envtest' ), 'skip' );
assert.equal( sharp.searchParams.get( 'missions' ), 'boat' );
assert.equal( Number( url.searchParams.get( 'scale' ) ), 0.75, 'baseline remains unchanged' );
console.log( 'Mobile 75% baseline and opt-in 85% sharp test OK' );
