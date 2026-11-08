// Test observer transparency with explicit unit doubles. This is NOT GPU validation.
import assert from 'node:assert/strict';
import { observeNativeGPU } from '../src/qa/NativeGPUTrace.js';
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => { resolve=a; reject=b; }); return {promise,resolve,reject}; };
let clock=10;
const loss=deferred(), render=deferred(), compute=deferred(), waits=[], submissions=[], descriptors=[];
const syncObject={nativePipeline:true}, nativeError=Object.assign(new Error(''),{name:'GPUPipelineError',reason:'internal'});
const queue={
 submit(...args){ assert.equal(this,queue); submissions.push(args); if(args[0]==='throw')throw nativeError; return 'native-submit-result'; },
 onSubmittedWorkDone(){ assert.equal(this,queue); const d=deferred(); waits.push(d); return d.promise; },
};
const device={queue,lost:loss.promise,
 createRenderPipelineAsync(desc){assert.equal(this,device);descriptors.push(desc);return render.promise;},
 createComputePipelineAsync(desc){assert.equal(this,device);descriptors.push(desc);return compute.promise;},
 createRenderPipeline(desc){assert.equal(this,device);descriptors.push(desc);return syncObject;},
 createComputePipeline(){throw nativeError;},
};
const trace=observeNativeGPU(device,{now:()=>clock,limit:3});
const rd={label:'water',fragment:{entryPoint:'main'}},cd={label:'fft'};
assert.equal(device.createRenderPipelineAsync(rd),render.promise,'native promise identity');
assert.equal(device.createComputePipelineAsync(cd),compute.promise);
assert.equal(descriptors[0],rd,'descriptor is not cloned or mutated');
assert.equal(descriptors[1],cd);
assert.equal(trace.pipelineCounts.peakAsyncPending,2);
render.resolve(syncObject);compute.reject(nativeError);await Promise.resolve();
assert.equal(trace.pipelineCounts.asyncPending,0);
assert.equal(trace.pipelineCounts.resolved,1);
assert.equal(trace.pipelineCounts.rejected,1);
assert.equal(trace.pipelines[1].error.reason,'internal');
assert.equal(trace.pipelines[1].error.name,'GPUPipelineError');
assert.equal(trace.pipelines[1].error.message,'');
assert.equal(device.createRenderPipeline(rd),syncObject,'native result identity');
assert.equal(trace.pipelines.at(-1).status,'returned','sync return is not validation success');
assert.throws(()=>device.createComputePipeline(cd),e=>e===nativeError,'same native exception');
assert.equal(trace.pipelineCounts.syncThrows,1);
assert.equal(trace.droppedPipelineRecords,1);
assert.equal(trace.pipelines.length,3);

const commands=[{nativeCommandBuffer:true}];
assert.equal(queue.submit(commands),'native-submit-result');
assert.equal(submissions[0][0],commands,'command buffer sequence passed unchanged');
assert.equal(waits.length,1,'first submission samples a nonblocking fence');
clock=2010;queue.submit(commands);
assert.equal(waits.length,1,'one sampled fence in flight even beyond interval');
waits[0].resolve();await Promise.resolve();
assert.equal(trace.queue.completedThroughSubmit,1,'completion belongs to captured serial, not latest submit');
clock=2011;queue.submit(commands);
assert.equal(waits.length,2);
const applicationWait=queue.onSubmittedWorkDone();
assert.equal(applicationWait,waits[2].promise,'native application wait identity');
waits[2].resolve();await Promise.resolve();
assert.equal(trace.queue.completedThroughSubmit,3);
waits[1].reject(nativeError);await Promise.resolve();
assert.equal(trace.queue.rejectedWaits,1);
assert.equal(trace.queue.pendingWaits,0);
assert.equal(trace.queueEvents.at(-2).error.reason,'internal');
assert.throws(()=>queue.submit('throw'),e=>e===nativeError);
assert.equal(trace.queue.submits,3,'throwing submit not counted as returned');
assert.equal(trace.droppedQueueRecords,1);
loss.resolve({reason:'destroyed',message:''});await Promise.resolve();
clock=4011;queue.submit(commands);
assert.equal(waits.length,3,'no sampled fences after observed loss');
assert.equal(trace.lost.reason,'destroyed');

const locked={queue:{},lost:new Promise(()=>{})};
Object.defineProperty(locked,'createRenderPipeline',{value:()=>syncObject,configurable:false});
const unavailable=observeNativeGPU(locked);
assert.equal(locked.createRenderPipeline(),syncObject);
assert.equal(unavailable.hooks.createRenderPipeline.name,'TypeError','unavailable hooks reported without breaking native object');
console.log('Native observer identity, errors, concurrency, queue serials and bounded records pass (unit doubles only; no GPU claim).');
