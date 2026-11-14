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
