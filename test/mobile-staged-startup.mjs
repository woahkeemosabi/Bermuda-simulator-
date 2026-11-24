import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const app=source('../src/App.js'), main=source('../src/main.js');
const gate=source('../src/mobile/WorldRenderGate.js'), audit=source('../src/mobile/GpuAudit.js');
const clouds=source('../src/sky/Clouds.js');
const shader=source('../src/engine/gpu/Shader.js');
const chandlery=source('../src/game/Chandlery.js');
// The iPhone startup must flush constructor-time compute before allocating and
// compiling the post/shadow/refraction/water shader families, not only in
// optional full-coast or recovery modes.
const mobile=app.slice(app.indexOf('async precompile(onMobileStage'));
const order=[
 'Mobile startup: submitting initial compute',
 'GPU.submit();',
 "GPU.whenIdle(),8000,'Mobile initial compute submit'",
 'Post-processing and compute foundations',
 'Preparing screen targets',
 'Shadow pipelines',
 'Refraction pipelines',
 'Coastal water and terrain',
 'Mobile startup: vegetation upload'
];
let last=-1;
for (const label of order) {
 const index=mobile.indexOf(label);
 assert.ok(index>last,'Mobile GPU stage is missing/out of order: '+label);
 last=index;
}
assert.ok(!mobile.slice(0,mobile.indexOf('Mobile startup: vegetation upload')).includes('__bermudaHighSeaOnly'),
 'The initial submit must apply to both iPhone mobile modes');
assert.match(app,/await withDeadline\(GPU\.pipelinesReady\(\),60000,'Mobile shader stage '/);
assert.match(app,/await new Promise\(resolve => setTimeout\(resolve,0\)\)/);
assert.match(main,/app\.precompile\(\(label, fraction\) =>/);
assert.match(main,/const holdMs = 60000/);
assert.match(main,/const mobilePreloadStartedAt = performance\.now\(\)/);
assert.match(main,/const holdStart = mobilePreloadStartedAt/);
assert.ok(main.indexOf('await app.precompile')<main.indexOf('const holdMs = 60000'),
 'World verification must precede the 60s gameplay unlock gate');
assert.match(gate,/Promise\.race\(\[promise,lost\]\)/);
assert.match(gate,/GPU\.device\.lost\.then/);
assert.match(audit,/GPU adapter shader budgets/);
assert.match(audit,/Pipelines /);
assert.match(clouds,/const mobileRebuildSlots =/);
assert.match(clouds,/k < mobileRebuildSlots\(\)/);
assert.match(clouds,/this\.ready = this\._generateNoiseMobile\(\)/);
assert.match(clouds,/for \(const \[name,dispatch\] of jobs\)/);
assert.match(clouds,/GPU\.submit\(\);\s*await withDeadline\(GPU\.whenIdle\(\),20000,'Cloud noise '/);
assert.match(app,/Generating cloud textures in batches/);
assert.match(shader,/stageOf\[ k \] = 'unused'/);
assert.match(shader,/st === 'unused' \) l\.visibility = 0/);
assert.match(chandlery,/hiddenInSeaOnly = !!globalThis\.__bermudaHighSeaOnly/);
assert.match(chandlery,/maxSampledTexturesPerShaderStage \?\? 16 \) < 24/);
assert.match(chandlery,/if \( hiddenInSeaOnly \) \{\s*this\.ready = Promise\.resolve\(\)/);
assert.ok(chandlery.indexOf('limitedGPU') < chandlery.indexOf('loadStallAssets().then'),
 'Do not load an unsupported scanned-stall shader on low-texture adapters');

console.log('Mobile first-submit staged shader startup, device-loss abort and diagnostics PASS');
