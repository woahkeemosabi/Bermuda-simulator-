import { withDeadline } from '../engine/gpu/PipelineCompiler.js';
import { GPU } from '../engine/gpu/GPU.js';
import { gpuStage } from './GpuAudit.js';
import { assessFramePixels } from './FrameHealth.js';

// Keep the original WebGPU effects and terrain. Inspect the HDR scene, not Safari's
// presentation surface; never request a COPY_SRC swapchain or repeatedly retry dead devices.
const POINTS=[[.24,.25],[.50,.25],[.76,.25],[.24,.57],[.50,.57],[.76,.57],[.24,.80],[.50,.80],[.76,.80]];
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const message=e=>String(e?.message||e);
// Device-loss is an explicit terminal event, not a shader-validation timeout.
async function waitForLiveGPU(promise, timeoutMs, label) {
 const lost=GPU.device.lost.then(info=>{
  throw GPU.fatalError||new Error('WebGPU device lost ('+(info?.reason||'unknown')+'): '+(info?.message||'Browser supplied no details'));
 });
 return withDeadline(Promise.race([promise,lost]),timeoutMs,label);
}

export function validateSpawn(app){
 const p=app?.player,t=app?.terrainData,c=app?.colliders;
 if(!p||!t||!app.camera) throw new Error('Player, camera or terrain missing.');
 if(p.mode!=='walk')return;
 const s=app.bermudaBlockout?.start||{x:-63.4,z:-20,yaw:Math.PI};
 if(!Number.isFinite(p.position.x)||!Number.isFinite(p.position.z)){
  p.position.x=s.x;p.position.z=s.z;p.yaw=s.yaw;
 }
 const y=t.heightAt(p.position.x,p.position.z),cy=c?.groundHeightAt?.(p.position.x,p.position.z,50);
 const ground=Math.max(Number.isFinite(y)?y:-Infinity,Number.isFinite(cy)?cy:-Infinity);
 if(!Number.isFinite(ground))throw new Error('Spawn is outside valid ground.');
 // Player position is foot height; adding eye height here would make the player float.
 if(!Number.isFinite(p.position.y)||p.position.y<ground-.5||p.position.y>ground+40){
  p.position.y=ground+.03;p.velocity?.set(0,0,0);p.grounded=true;
  p.camInit=false;p._camY=null;
 }
}

function decodeHalf(h){
 const e=(h>>10)&31,m=h&1023;
 const v=e===0?m/16777216:e===31?0:(1+m/1024)*2**(e-15);
 return Math.max(0,Math.min(255,Math.round((h&32768?-1:1)*v*255)));
}
async function captureSceneFrame(app,timeoutMs){
 if(GPU.fatalError)throw GPU.fatalError;
 const buffer=GPU.device.createBuffer({label:'bermuda-scene-samples',
  size:POINTS.length*256,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});
 let submitted=false,settled=false,rejectPending=null;
 const result=new Promise((resolve,reject)=>{
  rejectPending=reject;
  GPU.onSubmit(enc=>{
   const target=app.sceneRenderer.sceneRT;
   const tex=target.texture.getGPU(),w=target.width,h=target.height;
   POINTS.forEach(([x,y],i)=>enc.copyTextureToBuffer({
    texture:tex,origin:{x:Math.min(w-1,Math.floor(w*x)),y:Math.min(h-1,Math.floor(h*y)),z:0}},
    {buffer,offset:256*i,bytesPerRow:256,rowsPerImage:1},
    {width:1,height:1,depthOrArrayLayers:1}));
  },()=>{
   submitted=true;
   buffer.mapAsync(GPUMapMode.READ).then(()=>{
    if(settled)return;
    const bytes=new Uint8Array(buffer.getMappedRange());
    const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
    const samples=POINTS.map((_,i)=>[0,2,4].map(n=>
      decodeHalf(view.getUint16(i*256+n,true))));
    settled=true;resolve({...assessFramePixels(samples),samples,source:'hdr-scene'});
   }).catch(e=>{if(!settled){settled=true;reject(e);}});
  });
 });
 result.catch(()=>{});
 try{
  app.frame(1/60);
  const data=await withDeadline(result,timeoutMs,'GPU scene sample');
  await withDeadline(GPU.whenIdle(),timeoutMs,'GPU queue did not finish startup frame');
  if(GPU.fatalError)throw GPU.fatalError;
  return data;
 } finally {
  settled=true;
  if(GPU.encoder){
   // A failed frame's incomplete encoder must not be reused.
   GPU.abortFrame();
  }
  // Never retry with a poisoned GPU device. If no submit happened, drop the hook.
  if(!submitted&&rejectPending)GPU.abortFrame();
  try{if(buffer.mapState==='mapped')buffer.unmap();}catch(_){}
  buffer.destroy();
 }
}
// The first full WebGPU scene on a software/baseline mobile adapter may
// legitimately take more than eight seconds while shader resource heaps warm.
// The GPU queue still acknowledges successful completion; don't label it a
// crash just before its acknowledgement arrives. Device-loss races remain live.
export async function verifyMobileWorld(app,onProgress=()=>{},{timeoutMs=20000,readback=true}={}){
 if(!app?.terrain?.mesh||!app.ocean||!app.post||!app.sceneRenderer?.sceneRT)
  throw new Error('Terrain, ocean or WebGPU render target missing.');
 validateSpawn(app);
 const status=window.__bermudaWorldGate={status:'checking',tries:0,last:null};
 try {
  return await verifyCompletedFrames({
   prepare:()=>waitForLiveGPU(GPU.pipelinesReady(),120000,'Shader compilation'),
   onProgress,
   frame:async()=>{
   if(GPU.fatalError)throw GPU.fatalError;
   GPU.device.pushErrorScope('validation');GPU.device.pushErrorScope('out-of-memory');
   let data,frameError;
   try {
    if(readback)data=await captureSceneFrame(app,timeoutMs);
    else {
     const sequence=GPU.submissions.sequence;app.frame(1/60);
     if(GPU.submissions.sequence!==sequence+1)throw new Error('Startup frame was not submitted');
     await waitForLiveGPU(GPU.whenIdle(),timeoutMs,'GPU startup frame');
     if(GPU.fatalError)throw GPU.fatalError;
     data={valid:true,queueCompleted:true,source:'queue-completion; pixels not inspected'};
    }
   } catch(e){GPU.abortFrame(e);frameError=e;}
   const errors=await waitForLiveGPU(Promise.all([GPU.device.popErrorScope(),GPU.device.popErrorScope()]),timeoutMs,'GPU validation');
   if(frameError)throw frameError;
   const error=errors.find(Boolean);if(error)throw new Error(error.message);
   return data;
   },
   isReady:()=>{
    const atmosphereReady=app.atmosphere.mobileMode!=='staged'||app.atmosphere.mobileInitStage>=3;
    // Safari can complete rendered GPU frames while optional CPU water-query
    // readback remains invalid (notably when water-query overlap is skipped).
    // Do not reject a healthy frame for an unrelated asynchronous probe.
    // The frame() gate above already verifies submission, queue completion
    // and GPU validation/out-of-memory scopes on every attempt.
    return atmosphereReady&&app.engine.meshRenderer.stats.draws>0;
   },status
  });
 } catch(e){status.status='failed';status.error=message(e);throw e;}
}

export async function verifyCompletedFrames({prepare,frame,isReady,status={},onProgress=()=>{},maxFrames=64}) {
 let consecutive=0;
 for(let attempt=0;attempt<maxFrames;attempt++){
  const n=attempt+1;
  gpuStage('Verification '+n+': compiling pipelines');
  onProgress(attempt);
  await prepare();
  if(GPU.fatalError)throw GPU.fatalError;
  gpuStage('Verification '+n+': encoding and submitting frame');
  const data=await frame();
  status.tries=n;status.last=data;
  gpuStage('Verification '+n+': GPU queue completed');
  if(GPU.fatalError)throw GPU.fatalError;
  consecutive=data.valid&&isReady()?consecutive+1:0;
  if(consecutive>=3){status.status='ready';status.completedFrames=consecutive;gpuStage('Verification complete: three GPU frames');return data;}
  // Do not enqueue another full cloud/ocean/render frame immediately after
  // the previous completion. Give mobile Safari a full scheduling turn to
  // retire GPU resources and process device-loss notifications.
  gpuStage('Verification '+n+': cooling GPU before next frame');
  await sleep(250);
  if(GPU.fatalError)throw GPU.fatalError;
 }
 throw new Error('Bermuda world did not produce three complete GPU frames.');
}

export function verifyMobileWorldNoReadback(app,onProgress,options={}) { return verifyMobileWorld(app,onProgress,{...options,readback:false}); }
