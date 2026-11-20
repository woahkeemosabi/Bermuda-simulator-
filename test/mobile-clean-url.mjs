import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const main = read('../src/main.js');
const app = read('../src/App.js');
const gate = read('../src/mobile/WorldRenderGate.js');
const clouds = read('../src/sky/Clouds.js');
const shader = read('../src/engine/gpu/Shader.js');
// The address bar must never be rewritten for internal mobile graphics settings.
assert.doesNotMatch(main, /history\.replaceState\(/);
assert.match(main, /window\.__bermudaBootSearch = url\.search/);
assert.match(app, /window\.__bermudaBootSearch/);
// Full coastal rendering is standard; a sea-only profile is explicit.
assert.match(main, /get\('highSeaOnly'\) === '1'/);
assert.doesNotMatch(main, /get\('highSeaOnly'\) !== '0'/);
// As soon as WebGPU reports a loss, verification aborts rather than timing out.
assert.match(gate, /GPU\.device\.lost\.then/);
assert.match(gate, /Promise\.race\(\[work,lost\]\)/);
assert.match(gate, /awaitGpuOrLoss\(Promise\.all\(\[GPU\.device\.popErrorScope/);
assert.match(app, /new ShoreSim\(/);
assert.match(app, /new Caustics\(/);
assert.match(app, /new MobilePostFX\(/);
// Mobile raymarch work is bounded while the complete clouds converge over time.
assert.match(clouds, /const mobileCloudBudget =/);
assert.match(clouds, /k < mobileCloudBudget\(\)/);
// WGSL bindings unreachable from both entry points must not consume texture slots.
assert.match(shader, /stageOf\[ k \] = 'unused'/);
assert.match(shader, /st === 'unused' \) l\.visibility = 0/);
console.log('Clean mobile URL, coastal defaults, and GPU-loss race assertions passed');
