import test from 'node:test';
import assert from 'node:assert/strict';
import {PipelineCompiler,withDeadline} from '../src/engine/gpu/PipelineCompiler.js';
import {FramePacer,summarizeFrames} from '../src/mobile/FramePacing.js';
const tick=()=>new Promise(r=>setImmediate(r));
test('60 Hz pacing no longer rounds 42 ms to three display ticks',()=>{
 let old=0,last=-Infinity,current=0;const pacer=new FramePacer();
 for(let i=0;i<600;i++){const t=i*1000/60;if(t-last>=42){old++;last=t;}if(pacer.take(t))current++;}
 assert.equal(old,200);assert.equal(current,600);
});
test('40 FPS pacing accumulates fractional display intervals',()=>{
 const p=new FramePacer(40);let count=0;for(let i=0;i<600;i++)if(p.take(i*1000/60))count++;
 assert.equal(count,400);
});
test('FPS uses real elapsed intervals including stalls',()=>{
 const result=summarizeFrames([...Array(99).fill(20),200]);
 assert.equal(result.onePercentLowFPS,5);assert.equal(result.averageFPS,100000/2180);
});
test('timeout rejects rather than unlocking the world',async()=>{
 await assert.rejects(withDeadline(new Promise(()=>{}),5,'Shader compilation'),/world remains locked/);
});
test('compiler bounds concurrency and avoids duplicate in-flight sync compilation',async()=>{
 let active=0,peak=0,sync=0;const release=[];
 const compiler=new PipelineCompiler({createComputePipelineAsync:()=>{active++;peak=Math.max(peak,active);return new Promise(r=>release.push(()=>{active--;r({});}));},createComputePipeline:()=>{sync++;return{};}},2);
 const handles=Array.from({length:5},(_,i)=>compiler.request({label:String(i)},'compute'));
 await tick();assert.equal(active,2);assert.throws(()=>compiler.ready(handles[0]),/still compiling/);assert.equal(sync,0);
 while(compiler.pending.size){release.splice(0).forEach(f=>f());await tick();}
 await compiler.readyAll();assert.equal(peak,2);
});
test('compile errors propagate through startup',async()=>{
 const compiler=new PipelineCompiler({createComputePipelineAsync:async()=>{throw new Error('invalid WGSL');}});
 compiler.request({label:'broken'},'compute');await assert.rejects(compiler.readyAll(),/broken.*invalid WGSL/);
});
test('constructor bake compiles once before async pump',async()=>{
 let sync=0,async=0;
 const compiler=new PipelineCompiler({createComputePipeline:()=>{sync++;return{};},createComputePipelineAsync:()=>{async++;return{};}});
 const h=compiler.request({label:'bake'},'compute');compiler.ready(h);await compiler.readyAll();await tick();assert.equal(sync,1);assert.equal(async,0);
});

test('aborting a frame releases readback reservations and retired resources once',async()=>{
 const {GPU}=await import('../src/engine/gpu/GPU.js');
 let destroys=0,aborts=0;
 GPU.encoder={};GPU.retire({destroy(){destroys++;}});
 GPU.onSubmit(null,()=>assert.fail('not submitted'),()=>aborts++);
 assert.equal(destroys,0);GPU.abortFrame();GPU.abortFrame();
 assert.equal(destroys,1);assert.equal(aborts,1);assert.equal(GPU.encoder,null);
});
test('retirement occurs after submit when earlier commands reference a resource',async()=>{
 const {GPU}=await import('../src/engine/gpu/GPU.js');const events=[];
 GPU.submissions={submit(){events.push('submit');}};GPU.encoder={finish(){return{};}};
 GPU.retire({destroy(){events.push('destroy');}});GPU.submit();
 assert.deepEqual(events,['submit','destroy']);
});
import {SubmissionManager,textureBytes,installLedger} from '../src/engine/gpu/ResourceBudget.js';
import {ResolutionBudget} from '../src/mobile/ResolutionBudget.js';
test('two submissions maximum, one acknowledgement per submission',async()=>{
 const acks=[];let calls=0;
 const m=new SubmissionManager({submit(){},onSubmittedWorkDone(){calls++;return new Promise(r=>acks.push(r));}},{maxInFlight:2});
 m.submit([],1);m.submit([],2);assert.equal(m.available,false);assert.throws(()=>m.submit([],3),/capacity/);assert.equal(calls,2);
 acks.forEach(r=>r());await m.done();assert.equal(m.pending.size,0);assert.equal(m.available,true);
});
test('device loss rejects waiters and recovery does not reuse a dead queue',async()=>{
 const m=new SubmissionManager({submit(){},onSubmittedWorkDone(){return new Promise(()=>{});}});
 const p=m.submit([],1);m.fail(new Error('device lost'));await assert.rejects(p,/device lost/);assert.throws(()=>m.submit([],2),/device lost/);
});
test('background time is excluded from queue watchdog',()=>{
 let now=0;const m=new SubmissionManager({submit(){},onSubmittedWorkDone(){return new Promise(()=>{});}},{now:()=>now});
 m.submit([],1);m.setHidden(true);now=100000;m.checkHealth();m.setHidden(false);m.checkHealth();now+=7000;assert.throws(()=>m.checkHealth(),/did not complete/);
});
test('memory estimates account for layers, mips and idempotent destruction',()=>{
 assert.equal(textureBytes({size:[4,4,2],format:'rgba16float',mipLevelCount:3}),336);
 const d={createBuffer(){return {destroy(){}};},createTexture(){return {destroy(){}};}},ledger=installLedger(d);
 const b=d.createBuffer({size:128});assert.equal(ledger.buffers.bytes,128);b.destroy();b.destroy();assert.equal(ledger.buffers.bytes,0);assert.equal(ledger.buffers.destroyed,1);
});
test('dynamic resolution uses hysteresis and waits for an idle queue',()=>{
 const b=new ResolutionBudget(),sample={now:0,frameMs:30,bytes:0,scale:1,idle:true};
 assert.equal(b.sample(sample),1);assert.equal(b.sample(sample),1);assert.equal(b.sample(sample),.95);
 assert.equal(b.sample({...sample,scale:.95,now:1000}),.95);assert.equal(b.sample({...sample,scale:.95,now:20000,idle:false}),.95);
});
import {verifyCompletedFrames} from '../src/mobile/WorldRenderGate.js';
test('world readiness requires three consecutive valid completed frames',async()=>{
 let calls=0;const status={};
 await verifyCompletedFrames({prepare:async()=>{},frame:async()=>({valid:++calls!==2}),isReady:()=>true,status});
 assert.equal(calls,5);assert.equal(status.status,'ready');assert.equal(status.completedFrames,3);
});
test('black or incomplete frames never declare the world ready',async()=>{
 for(const valid of [true,false])await assert.rejects(verifyCompletedFrames({prepare:async()=>{},frame:async()=>({valid}),isReady:()=>false,maxFrames:3}),/three complete/);
});
test('GPU errors stop verification immediately without retries',async()=>{
 let calls=0;await assert.rejects(verifyCompletedFrames({prepare:async()=>{},frame:async()=>{calls++;throw new Error('device lost');},isReady:()=>true}),/device lost/);assert.equal(calls,1);
});
test('terminal startup failure cancels queued compilation without launching more work',async()=>{
 let calls=0,finish;
 const compiler=new PipelineCompiler({createComputePipelineAsync(){calls++;return new Promise(r=>finish=r);}},1);
 const first=compiler.request({label:'first'},'compute');compiler.request({label:'queued'},'compute');await tick();
 compiler.cancel(new Error('startup failed'));await assert.rejects(compiler.readyAll(),/startup failed/);
 finish({});await tick();assert.equal(calls,1);assert.equal(first.pipeline,null);assert.throws(()=>compiler.request({},'compute'),/startup failed/);
});
test('shader module creation is deferred and shares the compiler concurrency bound',async()=>{
 let modules=0;const releases=[];
 const c=new PipelineCompiler({createComputePipelineAsync:()=>new Promise(r=>releases.push(r))},2);
 for(let i=0;i<10;i++)c.request(()=>{modules++;return {label:String(i)};},'compute',String(i));
 assert.equal(modules,0);await tick();assert.equal(modules,2);
 while(c.pending.size){releases.splice(0).forEach(r=>r({}));await tick();}
 assert.equal(modules,10);await c.readyAll();
});
