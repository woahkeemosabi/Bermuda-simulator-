import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const mips = readFileSync(new URL('../src/ocean/ComputeMips.js', import.meta.url), 'utf8');
const ocean = readFileSync(new URL('../src/ocean/OceanFFT.js', import.meta.url), 'utf8');

// Adapter baseline in WebGPU: four writable storage textures per shader stage.
// Each mip must still exist and be generated in dependency order.
assert.match(mips, /const top = Math\.min\( 4, levels - 1 \)/);
assert.match(mips, /if \( levels > 5 \)/);
assert.match(mips, /bindings: \{ src4: src\( 4 \), out5: out\( 5 \) \}/);
assert.match(mips, /this\.kernelC\.dispatch/);
assert.ok(mips.indexOf('this.kernelA.dispatch') < mips.indexOf('this.kernelC.dispatch'));
assert.ok(mips.indexOf('this.kernelC.dispatch') < mips.indexOf('this.kernelB.dispatch'));

for (const res of [32, 64, 128, 256, 512]) {
  const levels = 1 + Math.log2(res);
  const A = Array.from({length: Math.min(4, levels - 1)}, (_, i) => i + 1);
  const C = levels > 5 ? [5] : [];
  const B = levels > 6 && (res >> 5) > 1
    ? Array.from({length: levels - 6}, (_, i) => i + 6)
    : [];
  assert.ok(A.length <= 4 && B.length <= 4 && C.length <= 1,
    'writable storage texture binding limit at '+res);
  assert.deepEqual([...A, ...C, ...B],
    Array.from({length: levels - 1}, (_, i) => i + 1),
    'every mip level generated at '+res);
}

const oceanA = ocean.match(/const mipA = \( tex, t \) => new ComputeKernel\( \{([\s\S]*?)const mipC/);
assert.ok(oceanA, 'Ocean Mips A followed by C');
assert.doesNotMatch(oceanA[1], /out5:\s*level\( tex, 5 \)/);
for (const i of [1,2,3,4]) assert.match(oceanA[1], new RegExp('out'+i+': level\\( tex, '+i+' \\)'));
assert.match(ocean, /label: 'Ocean Mips C'/);
assert.match(ocean, /bindings: \{ mipMid: rw\( this\.mipMid \), out5: level\( tex, 5 \) \}/);
assert.match(ocean, /this\.mipKernelsC = \[ mipC\( this\.displacementTexture, 0 \), mipC\( this\.derivativeTexture, 1 \) \]/);
assert.match(ocean, /out6: level\( tex, 6 \), out7: level\( tex, 7 \), out8: level\( tex, 8 \)/);
const a = ocean.indexOf('for ( const k of this.mipKernelsA )');
const c = ocean.indexOf('for ( const k of this.mipKernelsC )');
const b = ocean.indexOf('for ( const k of this.mipKernelsB )');
assert.ok(a >= 0 && a < c && c < b, 'ocean mip ordering A -> C -> B');
assert.match(ocean, /this\.cascades = options\.cascades \?\? 4/);
assert.match(ocean, /export const FFT_SIZE = 256/);

console.log('PASS: four writable textures max per mip kernel, all levels retained, 256x256 four-cascade FFT preserved');
