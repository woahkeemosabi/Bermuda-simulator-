// Native Dawn/SwiftShader capability regression. Not an iPhone performance test.
import './headless.mjs';
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
const root=process.env.SOURCE_DIR||new URL('../src/',import.meta.url).pathname;
const {GPU}=await import(root+'/engine/gpu/GPU.js');
const {OceanFFT}=await import(root+'/ocean/OceanFFT.js');
const {readTexture}=await import(root+'/engine/gpu/Readback.js');
const {Profiler}=await import(root+'/core/Profiler.js');
const limit=Number(process.env.STORAGE_LIMIT||4),errors=[];
await GPU.init({headless:true,requiredLimits:{maxStorageTexturesPerShaderStage:limit}});
GPU.device.addEventListener('uncapturederror',e=>errors.push(e.error.message));
GPU.device.pushErrorScope('validation');
const result={environment:'Dawn / software Vulkan ('+(process.env.VK_ICD_FILENAMES?.split('/').at(-1)||'ICD unspecified')+')',storageLimit:limit,source:process.env.SOURCE_SHA||'candidate',frameMs:[],errors};
try{
 const profiler=process.env.PROFILE?new Profiler(null,{enabled:true}):null;
 const fft=new OceanFFT(null);await GPU.pipelinesReady();
 if(profiler)GPU.frame=30;
 for(let i=0;i<8;i++){
  const start=performance.now();GPU.beginFrame();fft.update(1/60);GPU.submit();await (GPU.whenIdle?GPU.whenIdle():GPU.queue.onSubmittedWorkDone());
  result.frameMs.push(performance.now()-start);
 }
 for(const texture of [fft.displacementTexture,fft.derivativeTexture]){
  for(let layer=0;layer<fft.cascades;layer++)for(const mip of [0,4,8]){
   const r=await readTexture(texture,{mip,layer});const values=new Uint16Array(r.data);
   assert.ok(values.length);if(mip===0)assert.ok(values.some(v=>v!==0),'nonzero ocean');assert.ok(values.every(v=>(v&0x7c00)!==0x7c00),'finite half-floats');
  }
 }
 await new Promise(r=>setImmediate(r));
 result.profile=profiler?.result;result.resources=GPU.resources;
 if(profiler){assert.ok(profiler.result.items.some(p=>p.name==='Ocean FFT'));assert.ok(profiler.result.items.every(p=>Number.isFinite(p.ms)));}
 const validation=await GPU.device.popErrorScope();if(validation)errors.push(validation.message);
 assert.deepEqual(errors,[]);result.passed=true;
}catch(e){result.passed=false;result.failure=e.message;const validation=await GPU.device.popErrorScope().catch(()=>null);if(validation)errors.push(validation.message);}
if(process.argv[2])writeFileSync(process.argv[2],JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));process.exit(result.passed?0:1);
