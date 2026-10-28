import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=fs.readFileSync(new URL('../src/ocean/ComputeMips.js',import.meta.url),'utf8');
assert.match(source,/const top = Math\.min\( 4, levels - 1 \)/,'kernel A must bind at most four writable mip textures');
assert.match(source,/if \( levels > 5 \)/,'level 5 requires its own compute kernel');
assert.match(source,/bindings: \{ src4: src\( 4 \), out5: out\( 5 \) \}/,'level 5 reads level 4 and writes level 5');
assert.match(source,/this\.kernelC\.dispatch/,'the level 5 pass must execute');
assert.match(source,/this\.kernelB\.dispatch/,'remaining mips must still execute');
assert.ok(source.indexOf('this.kernelA.dispatch')<source.indexOf('this.kernelC.dispatch'),'A before C');
assert.ok(source.indexOf('this.kernelC.dispatch')<source.indexOf('this.kernelB.dispatch'),'C before B');
console.log('ComputeMips binding-limit and dispatch-order source checks passed');

const ocean=fs.readFileSync(new URL('../src/ocean/OceanFFT.js',import.meta.url),'utf8');
assert.doesNotMatch(ocean,/out4: level\( tex, 4 \), out5: level\( tex, 5 \)/,'Ocean Mips A cannot bind five storage textures');
assert.match(ocean,/label: 'Ocean Mips C'/,'Ocean mip 5 must have its own kernel');
assert.match(ocean,/this\.mipKernelsC = \[/,'both ocean textures must generate mip 5');
assert.ok(ocean.indexOf('for ( const k of this.mipKernelsA )')<ocean.indexOf('for ( const k of this.mipKernelsC )'),'Ocean A before C');
assert.ok(ocean.indexOf('for ( const k of this.mipKernelsC )')<ocean.indexOf('for ( const k of this.mipKernelsB )'),'Ocean C before B');
console.log('Ocean FFT storage-binding regression checks passed');
