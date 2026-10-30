import assert from 'node:assert/strict';
import { qualifyAdapter } from '../scripts/tidewater-gpu-gate.mjs';
// Synthetic classifier unit inputs only. NEVER represented as GPU execution.
const fixture=(vendor,storage=8,sampled=32,uniforms=14)=>({available:true,info:{vendor},isFallbackAdapter:false,
  limits:{maxStorageTexturesPerShaderStage:storage,maxSampledTexturesPerShaderStage:sampled,maxUniformBuffersPerShaderStage:uniforms}});
for(const input of [{available:false},fixture('nvidia',4),fixture('intel',8,16),fixture('apple',8,21),fixture('apple',8,32,12),fixture('apple',8,32,13),fixture('google SwiftShader'),fixture(''),
  {...fixture('nvidia'),isFallbackAdapter:true}])assert.equal(qualifyAdapter(input).status,'BLOCKED_UNSUITABLE_ENVIRONMENT');
assert.equal(qualifyAdapter(fixture('apple',5)).status,'CAPABILITY_GATE_PASSED');
assert.equal(qualifyAdapter(fixture('apple',5)).preferredStorageLimitMet,false);
assert.equal(qualifyAdapter(fixture('AMD')).preferredStorageLimitMet,true);
assert.equal(qualifyAdapter(fixture('AMD')).gameplayValidated,false);
console.log('Capability classifier passed; synthetic unit inputs only, no GPU execution.');
