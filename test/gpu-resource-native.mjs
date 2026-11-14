import './headless.mjs';
import assert from 'node:assert/strict';
import {GPU} from '../src/engine/gpu/GPU.js';
import {Texture} from '../src/engine/gpu/Texture.js';
import {ComputeMips} from '../src/ocean/ComputeMips.js';
import {readTexture,Readback} from '../src/engine/gpu/Readback.js';
await GPU.init({headless:true,requiredLimits:{maxStorageTexturesPerShaderStage:4}});
const errors=[];GPU.device.addEventListener('uncapturederror',e=>errors.push(e.error.message));
// Every mip and every cube face retains the source value on baseline-limit devices.
for(const res of [32,64,128,256,512]){
 const t=new Texture({width:res,height:res,dimension:'cube',format:'rgba16float',mips:true,usage:['sample','storage','copySrc','copyDst'],data:new Uint16Array(res*res*4*6).fill(0x3800)});
 const m=new ComputeMips(t);await GPU.pipelinesReady();m.dispatch();GPU.submit();await GPU.whenIdle();
 for(let layer=0;layer<6;layer++)for(let mip=1;mip<t.mipLevelCount;mip++){
  const r=await readTexture(t,{layer,mip});assert.ok(new Uint16Array(r.data).every(x=>x===0x3800));
 }
 t.destroy();
}
const before=GPU.resources.textures.bytes;
for(let i=0;i<100;i++){
 const t=new Texture({width:16,height:16,format:'rgba8unorm',usage:['render']});
 const p=GPU.getEncoder().beginRenderPass({colorAttachments:[{view:t.view(),loadOp:'clear',storeOp:'store',clearValue:[1,0,0,1]}]});p.end();
 t.destroy();GPU.submit();await GPU.whenIdle();
}
assert.equal(GPU.resources.textures.bytes,before);
const source=GPU.device.createBuffer({size:16,usage:GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST});
const rb=new Readback({byteLength:16,ring:1});let aborted=0;rb.onError=()=>aborted++;
assert.equal(rb.request(source),true);GPU.abortFrame();assert.equal(aborted,1);
assert.equal(rb.request(source),true);GPU.submit();await GPU.whenIdle();await new Promise(r=>setTimeout(r,50));assert.ok(rb.latest);
source.destroy();assert.deepEqual(errors,[]);console.log('Passed: all cube mips, 100 texture retirements, aborted/readmitted readback; zero validation errors');process.exit(0);
