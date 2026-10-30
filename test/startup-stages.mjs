import assert from 'node:assert/strict';
import {runStartupStages} from '../src/core/StartupStages.js';
import {observeDeviceLoss} from '../src/core/GpuDeviceFailure.js';
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const tick=()=>new Promise(r=>setTimeout(r,0));
const log=[],fences=[];
let restored=false;
function* stages(){try{for(const s of ['fft','caustics','presentation']){log.push('encode '+s);yield s;}}finally{restored=true;}}
const work=runStartupStages(stages(),{
 ready:async()=>{log.push('ready');},submit:()=>log.push('submit'),done:()=>{const d=deferred();fences.push(d);return d.promise;},check:()=>{},mark:(name,{stage})=>log.push(name+' '+stage),
});
await tick();assert.deepEqual(log.slice(0,4),['ready','encode fft','startup-stage-submit fft','submit']);assert.equal(fences.length,1);assert.ok(!log.includes('encode caustics'));
fences[0].resolve();await tick();assert.equal(fences.length,2);assert.ok(!log.includes('encode presentation'));
fences[1].resolve();await tick();assert.equal(fences.length,3);assert.equal(restored,false);
fences[2].resolve();await work;assert.equal(restored,true);
assert.equal(log.filter(x=>x==='submit').length,3);

// A fence resolving after loss must not advance the generator or acknowledge a healthy stage.
const loss=deferred(),fence=deferred(),guard=observeDeviceLoss({lost:loss.promise});
let count=0,cleanup=false;const marks=[];
function* failing(){try{count++;yield 'first';count++;yield 'forbidden';}finally{cleanup=true;}}
const failed=runStartupStages(failing(),{ready:()=>Promise.resolve(),submit:()=>{},done:()=>guard.wait(fence.promise),check:()=>guard.throwIfLost(),mark:n=>marks.push(n)});
const rejected=assert.rejects(failed,/device lost/);await tick();loss.resolve({reason:'destroyed',message:''});fence.resolve();await rejected;
assert.equal(count,1);assert.equal(cleanup,true);assert.ok(!marks.includes('startup-stage-complete'));

// Pipeline rejection blocks encoding/submitting the next stage.
let nativeCalls=0,encodes=0;let readyCalls=0;
function* two(){encodes++;yield 'one';encodes++;yield 'two';}
await assert.rejects(runStartupStages(two(),{ready:async()=>{if(++readyCalls===2)throw new Error('pipeline rejected');},submit:()=>nativeCalls++,done:()=>Promise.resolve(),check:()=>{}}),/pipeline rejected/);
assert.equal(encodes,1);assert.equal(nativeCalls,1);
console.log('Startup staging: strict submission order, fence pacing, loss cleanup and compile failure pass (unit doubles only).');
