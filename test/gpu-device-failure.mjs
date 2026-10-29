import assert from 'node:assert/strict';
import { observeDeviceLoss } from '../src/core/GpuDeviceFailure.js';
// Synthetic promise lifecycle regression only; no GPU execution.
let lose;const device={lost:new Promise(r=>{lose=r;})};let notices=0;
const guard=observeDeviceLoss(device,()=>notices++);
assert.equal(await guard.wait(Promise.resolve('ready')),'ready');
const workFailure=new Error('Pipeline failed');
await assert.rejects(guard.wait(Promise.reject(workFailure)),e=>e===workFailure);
const hung=guard.wait(new Promise(()=>{}));
lose({reason:'destroyed',message:''});
await assert.rejects(hung,{name:'GPUDeviceLostError',message:/Browser provided no device-loss details/});
assert.equal(notices,1);
assert.throws(()=>guard.throwIfLost(),{name:'GPUDeviceLostError'});
await assert.rejects(guard.wait(Promise.resolve('late success')),{name:'GPUDeviceLostError'});
console.log('Device loss interrupts pending startup and rejects late success; synthetic lifecycle test only.');
