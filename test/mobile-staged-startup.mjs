import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const app=source('../src/App.js'), main=source('../src/main.js');
const gate=source('../src/mobile/WorldRenderGate.js'), audit=source('../src/mobile/GpuAudit.js');
const clouds=source('../src/sky/Clouds.js');
const shader=source('../src/engine/gpu/Shader.js');
const chandlery=source('../src/game/Chandlery.js');
const meshRenderer=source('../src/engine/render/MeshRenderer.js');
const village=source('../src/world/Village.js');
const gpu=source('../src/engine/gpu/GPU.js');
const water=source('../src/ocean/WaterMaterial.js');
const seaDetail=source('../src/ocean/SeaDetail.js');
const waterSurface=source('../src/ocean/WaterSurface.js');
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
assert.ok(!mobile.slice(0,mobile.indexOf('GPU.submit();')).includes('__bermudaHighSeaOnly'),
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
assert.match(gate,/timeoutMs=20000/);
assert.match(gpu,/timeoutMs:mobileAdapter\?18000:6500/);
assert.match(audit,/GPU adapter shader budgets/);
assert.match(audit,/Pipelines /);
assert.match(clouds,/const mobileRebuildSlots =/);
assert.match(clouds,/k < mobileRebuildSlots\(\)/);
assert.match(clouds,/if \( this\.startupTraceHold \) \{/);
assert.match(app,/this\.clouds\.startupTraceHold=true/);
assert.match(app,/Mobile cloud panorama upload/);
assert.match(app,/async primeMobileCloudHistory\(/);
assert.match(app,/async primeMobileSimulation\(/);
assert.match(app,/Prime '\+label\+' GPU work/);
assert.match(app,/this\._mobileSimulationVerifiedFrameSkips=3/);
assert.match(app,/const simPreprimed = this\.mobileLite/);
assert.match(app,/const mobileAux = n => !this\.mobileLite \|\| GPU\.frame%3===n/);
assert.match(app,/!simPreprimed && mobileAux\(1\) && this\.caustics/);
assert.match(app,/!simPreprimed && mobileAux\(2\) && this\.shoreSim/);
assert.match(app,/!simPreprimed && mobileAux\(0\)/);
assert.match(main,/await app\.primeMobileSimulation\(/);
assert.ok(main.indexOf('await app.primeMobileSimulation')<main.indexOf('await verifyMobileWorldNoReadback'));

assert.match(app,/clouds\.startupTraceHold = false/);
assert.match(app,/Mobile cloud view slot/);
assert.match(main,/await app\.primeMobileCloudHistory\(/);
assert.ok(main.indexOf('await verifyMobileWorldNoReadback')<main.indexOf('await app.primeMobileCloudHistory'),
 'Prepare full cloud view history only after first three valid scene frames');
assert.ok(main.indexOf('await app.primeMobileCloudHistory')<main.indexOf('const holdMs = 60000'),
 'Complete staged cloud readiness before Explore unlock');
assert.match(clouds,/this\.ready = this\._generateNoiseMobile\(\)/);
assert.match(clouds,/for \(const \[name,dispatch\] of jobs\)/);
assert.match(clouds,/GPU\.submit\(\);\s*await withDeadline\(GPU\.whenIdle\(\),20000,'Cloud noise '/);
assert.match(app,/Generating cloud textures in batches/);
assert.match(shader,/stageOf\[ k \] = 'unused'/);
assert.match(shader,/const textureLimit = GPU\.limits\?\.maxSampledTexturesPerShaderStage/);
assert.match(shader,/requires '\+over\.length\+'\/'\+textureLimit/);
assert.match(shader,/st === 'unused' \) l\.visibility = 0/);
assert.match(chandlery,/hiddenInSeaOnly = !!globalThis\.__bermudaHighSeaOnly/);
assert.match(chandlery,/maxSampledTexturesPerShaderStage \?\? 16 \) < 24/);
assert.match(chandlery,/if \( hiddenInSeaOnly \) \{\s*this\.ready = Promise\.resolve\(\)/);
assert.match(app,/mr\.skipHiddenWhenPrecompiling=!!window\.__bermudaHighSeaOnly/);
assert.match(app,/mr\.skipHiddenWhenPrecompiling=false/);
assert.match(meshRenderer,/const includeHidden = all && !this\.skipHiddenWhenPrecompiling/);
assert.match(meshRenderer,/if \( ! o\.visible && ! includeHidden \) return/);
assert.match(village,/this\._textures = null/);
assert.match(village,/this\._materials = null/);
assert.match(village,/get textures\(\)/);
assert.match(village,/get materials\(\)/);
assert.match(app,/environment: this\.environment/);
assert.match(app,/this\.recoveryMode \|\| limitedWaterBindings/);
assert.match(water,/compactSky = !!this\.environment/);
assert.match(water,/maxSampledTexturesPerShaderStage \?\? 16 \) <= 16/);
assert.match(water,/name: 'mobileWaterSkyCube'/);
assert.match(water,/fn skyReflectionRadiance\( dir: vec3f \)/);
assert.match(water,/const directCloudShadow = CL && !compactSky/);
assert.match(water,/CL: directCloudShadow, HULL, REFL/);
assert.match(water,/const depthHalf = !!this\.sceneDepthHalfTexture && !compactSky/);
assert.match(water,/compactSky \? this\.skyCubeModule : sky && sky\.module/);
assert.match(seaDetail,/get compatibleModule\(\)/);
assert.match(seaDetail,/maxSampledTexturesPerShaderStage \?\? 16 \) <= 16/);
assert.match(seaDetail,/name: 'seaDetailProceduralMobile'/);
assert.match(seaDetail,/fn seaDetailSample\( xz: vec2f \) -> SeaDetailSample/);
assert.match(waterSurface,/DT && this\.detail\.compatibleModule/);


assert.ok(village.indexOf('new VillageTextures()') > village.indexOf('get textures()'),
 'A scene with zero village geometry must not allocate its texture atlas in the constructor');

assert.ok(chandlery.indexOf('limitedGPU') < chandlery.indexOf('loadStallAssets().then'),
 'Do not load an unsupported scanned-stall shader on low-texture adapters');

console.log('Mobile first-submit staged shader startup, device-loss abort and diagnostics PASS');
