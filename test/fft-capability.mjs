// Native Dawn/SwiftShader capability regression. Not an iPhone performance test.
import './headless.mjs';
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
const root=process.env.SOURCE_DIR||new URL('../src/',import.meta.url).pathname;
const {GPU}=await import(root+'/engine/gpu/GPU.js');
const {OceanFFT}=await import(root+'/ocean/OceanFFT.js');
const {readTexture}=await import(root+'/engine/gpu/Readback.js');
const limit=Number(process.env.STORAGE_LIMIT||4),errors=[];
await GPU.init({headless:true,requiredLimits:{maxStorageTexturesPerShaderStage:limit}});
GPU.device.addEventListener('uncapturederror',e=>errors.push(e.error.message));
GPU.device.pushErrorScope('validation');
const result={environment:'Dawn / SwiftShader software Vulkan',storageLimit:limit,source:process.env.SOURCE_SHA||'candidate',frameMs:[],errors};
try{
 const fft=new OceanFFT(null);await GPU.pipelinesReady();
 for(let i=0;i<8;i++){
  const start=performance.now();GPU.beginFrame();fft.update(1/60);GPU.submit();await GPU.queue.onSubmittedWorkDone();
  result.frameMs.push(performance.now()-start);
 }
 for(const texture of [fft.displacementTexture,fft.derivativeTexture]){
  for(let layer=0;layer<fft.cascades;layer++)for(const mip of [0,4,8]){
   const r=await readTexture(texture,{mip,layer});const values=new Uint16Array(r.data);
   assert.ok(values.length);assert.ok(values.every(v=>(v&0x7c00)!==0x7c00),'finite half-floats');
  }
 }
 const validation=await GPU.device.popErrorScope();if(validation)errors.push(validation.message);
 assert.deepEqual(errors,[]);result.passed=true;
}catch(e){result.passed=false;result.failure=e.message;const validation=await GPU.device.popErrorScope().catch(()=>null);if(validation)errors.push(validation.message);}
if(process.argv[2])writeFileSync(process.argv[2],JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));process.exit(result.passed?0:1);
