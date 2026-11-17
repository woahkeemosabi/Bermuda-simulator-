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

assert.match(f('../src/engine/render/MeshRenderer.js'),/iosStableDrawOrder/);
assert.match(f('../src/mobile/WorldRenderGate.js'),/queue did not finish/);

// All high-end effects remain instantiated, but their mobile GPU workloads are bounded.
assert.match(f('../src/App.js'),/gpuCapacity: mobileLite \? COASTAL_MOBILE.sprayGPU : 32768/);
assert.match(f('../src/App.js'),/res: mobileLite \? COASTAL_MOBILE.shore : 768/);
assert.match(f('../src/ocean/WakeSim.js'),/MOBILE_WAKE \? 256 : 512/);
assert.match(f('../src/ocean/Caustics.js'),/mobile \? 256 : 512/);
assert.match(f('../src/sky/SkyProClouds.js'),/MOBILE_CLOUDS \? 128 : 256/);
assert.doesNotMatch(f('../src/main.js'),/if \( ! this\.__bermudaMobileReady \) return/);

// Underwater compute bake does not need the cloud panorama, view or shadow bindings;
// leaving them in exceeds 16 sampled textures on baseline WebGPU adapters.
// Full cloud shading remains present in the scene's underwater material hooks.
const uwLighting = f('../src/ocean/UnderwaterLighting.js');
const uwBakeDeps = uwLighting.split('const deps =')[1]?.split('const C3 =')[0] || '';
const uwHookDeps = uwLighting.split('const hookDeps =')[1]?.split('const direct =')[0] || '';
assert.ok(uwBakeDeps.includes('caustics && caustics.module'));
assert.ok(!uwBakeDeps.includes('clouds && clouds.module'));
assert.ok(uwHookDeps.includes('clouds && clouds.module'));
