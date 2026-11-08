import assert from 'node:assert/strict';
import {installRenderCompileQueue} from '../src/core/RenderCompileQueue.js';
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const tick=()=>new Promise(r=>setTimeout(r,0));
function fixture(){const lost=deferred(),calls=[];const device={lost:lost.promise,createRenderPipelineAsync(desc){assert.equal(this,device);const d=deferred();calls.push({desc,...d});return d.promise;}};return {device,lost,calls};}
const f=fixture(),q=installRenderCompileQueue(f.device,2),descs=Array.from({length:140},(_,i)=>({label:'pipeline '+i}));
const jobs=descs.map(d=>f.device.createRenderPipelineAsync(d));
assert.equal(f.calls.length,2);
for(let i=0;i<140;i++){assert.equal(f.calls[i].desc,descs[i]);f.calls[i].resolve(descs[i]);await tick();assert.ok(q.stats.active<=2);}
assert.deepEqual(await Promise.all(jobs),descs);assert.equal(q.stats.completed,140);assert.equal(q.stats.peakActive,2);assert.equal(q.stats.queued,0);q.throwIfFailed();
const g=fixture(),s=installRenderCompileQueue(g.device,2),err=Object.assign(new Error(''),{name:'GPUPipelineError',reason:'validation'});
const failed=Promise.allSettled([g.device.createRenderPipelineAsync({label:'bad'}),g.device.createRenderPipelineAsync({label:'active'}),g.device.createRenderPipelineAsync({label:'queued'})]);
g.calls[0].reject(err);const results=await failed;assert.ok(results.every(r=>r.status==='rejected'));assert.equal(results[0].reason,err);assert.equal(g.calls.length,2);assert.equal(s.stats.cancelled,1);assert.throws(()=>s.throwIfFailed(),/bad.*validation/);await assert.rejects(g.device.createRenderPipelineAsync({label:'later'}));
const h=fixture(),v=installRenderCompileQueue(h.device,1);const lossJobs=Promise.allSettled([h.device.createRenderPipelineAsync({}),h.device.createRenderPipelineAsync({})]);h.lost.resolve({reason:'destroyed',message:''});assert.ok((await lossJobs).every(r=>r.status==='rejected'));assert.equal(h.calls.length,1);assert.throws(()=>v.throwIfFailed(),/Device lost/);
console.log('Render compile queue: 140 jobs, cap, identity, native failure and device-loss cancellation pass (unit doubles, not GPU validation).');
