import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const code=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const app=code('../src/App.js'),env=code('../src/sky/Environment.js'),audit=code('../src/mobile/GpuAudit.js');
assert.match(app,/qs\.get\( 'envtest' \) === 'freeze'/);
assert.match(app,/new Environment\(/);
assert.match(env,/this\.freezeAfterPrime && this\.primed && this\.step < 0 && !force/);
assert.match(env,/this\.progressivePrime && !this\.primed && !force/);
assert.match(env,/this\.disablePrime && !force/);
assert.match(app,/mobileLite && envTest !== 'full' \? 64 : 128/);
assert.match(env,/this\.refreshCount\+\+/);
assert.match(env,/this\.faceKernels\[ i \]\.dispatch/);
assert.match(env,/this\.shKernels\[ 1 - this\.front \]\.dispatch/);
assert.match(audit,/Reflection experiment/);
for(const required of ['OceanFFT','Spray','Breakers','WakeSim','Wildlife','Caustics'])
 assert.ok(app.includes('new '+required+'('),required+' must be retained');
console.log('Reflection-refresh A/B test retains the initial full-quality environment and all ocean systems.');
