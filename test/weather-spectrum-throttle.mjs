import assert from 'node:assert/strict';

// App's weather controller should never regenerate all four FFT H0 spectra
// just because the wind changes by a fraction of a metre/second each frame.
globalThis.location = { search: '' };
const { App } = await import( '../src/App.js' );
const game = Object.create( App.prototype );
let spectrumRebuilds = 0;
game.settings = { weatherMode: 'clear', weatherTimer: 0 };
game.fft = {
	local: { windSpeed: 2 },
	choppiness: { value: 0 },
	updateSpectrumUniforms() { spectrumRebuilds ++; },
};
game.shore = { amplitude: { value: 0 } };

for ( let i = 0; i < 162; i ++ ) game.updateWeather( 0.1 );
assert.ok( spectrumRebuilds > 0 && spectrumRebuilds < 15, `expected throttled H0 rebuilds, got ${ spectrumRebuilds }` );
assert.ok( Math.abs( game.fft.local.windSpeed - 5.2 ) < 0.01, 'wind must still settle at original clear-weather target' );

const afterClear = spectrumRebuilds;
game.settings.weatherMode = 'storm';
for ( let i = 0; i < 162; i ++ ) game.updateWeather( 0.1 );
assert.ok( spectrumRebuilds > afterClear, 'a real weather change must regenerate the spectrum' );
assert.ok( spectrumRebuilds - afterClear < 25, 'storm must not regenerate H0 every frame' );
assert.ok( Math.abs( game.fft.local.windSpeed - 14 ) < 0.01, 'storm wind must still settle at original target' );
console.log( `FFT spectra rebuild ${ afterClear } times in 162 clear frames and ${ spectrumRebuilds - afterClear } times in 162 storm frames (FFT animation still runs each frame).` );
