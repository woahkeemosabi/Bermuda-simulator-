import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GPU } from '../src/engine/gpu/GPU.js';
import { qualifyAdapter } from '../scripts/tidewater-gpu-gate.mjs';
// Test doubles exercise request construction only; they are NOT GPU validation.
const observed=JSON.parse(readFileSync(new URL('../docs/qa/tidewater-original-20261028/evidence/iphone-runtime-20261029.json',import.meta.url)));
for(const uniformLimit of [44,16,14,13,12]) {
 let requested;
 const adapter={limits:{...observed.adapter.limits,maxUniformBuffersPerShaderStage:uniformLimit},features:new Set(observed.adapter.features),
  requestDevice:async d=>{requested=d;return {limits:d.requiredLimits,features:new Set(d.requiredFeatures),lost:new Promise(()=>{}),queue:{},addEventListener(){},createSampler(){return {};}};}};
 Object.defineProperty(globalThis,'navigator',{value:{gpu:{requestAdapter:async()=>adapter}},configurable:true});
 await GPU.init({headless:true});
 assert.equal(requested.requiredLimits.maxUniformBuffersPerShaderStage,uniformLimit);
 assert.equal(requested.requiredLimits.maxStorageTexturesPerShaderStage,8);
 assert.equal(requested.requiredLimits.maxSampledTexturesPerShaderStage,32);
 assert.equal(qualifyAdapter({...observed.adapter,limits:adapter.limits}).status,uniformLimit>=14?'CAPABILITY_GATE_PASSED':'BLOCKED_UNSUITABLE_ENVIRONMENT');
}
console.log('Native request descriptor includes uniform limit, preserves 8/32 texture requests and respects reported adapter ceiling; test doubles only.');
