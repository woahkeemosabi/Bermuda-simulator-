import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { assessFramePixels } from '../src/mobile/FrameHealth.js';
const f=p=>readFileSync(new URL(p,import.meta.url),'utf8');
assert.equal(assessFramePixels(Array(9).fill([0,0,0])).reason,'black-frame');
assert.equal(assessFramePixels([...Array(6).fill([40,50,60]),...Array(3).fill([0,0,0])]).reason,'black-lower-scene');
assert.equal(assessFramePixels(Array(9).fill([40,50,60])).valid,true);
assert.match(f('../src/main.js'),/await verifyMobileWorld/);
assert.doesNotMatch(f('../src/engine/gpu/GPU.js'),/common\|GPUTextureUsage.COPY_SRC/);
assert.match(f('../src/engine/gpu/GPU.js'),/fatalError/);
assert.match(f('../src/mobile/WorldRenderGate.js'),/GPU.onSubmit/);
assert.ok(f('../src/App.js').includes('new Spray('));
assert.ok(f('../src/App.js').includes('new Breakers('));
assert.match(f('../index.html'),/bm-loader-retry/);
console.log('Bermuda mobile render gate: real pixels, retained ocean and spray');

assert.match(f('../src/engine/Engine.js'),/mobileGpuFramePacing/);
assert.match(f('../src/mobile/WorldRenderGate.js'),/hdr-scene/);
assert.match(f('../src/main.js'),/bermudaGpuRetryLevel/);
