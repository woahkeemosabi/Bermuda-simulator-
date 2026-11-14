import { withDeadline } from '../engine/gpu/PipelineCompiler.js';
import { GPU } from '../engine/gpu/GPU.js';
import { assessFramePixels } from './FrameHealth.js';

// Keep the original WebGPU effects and terrain. Inspect the HDR scene, not Safari's
// presentation surface; never request a COPY_SRC swapchain or repeatedly retry dead devices.
const POINTS=[[.24,.25],[.50,.25],[.76,.25],[.24,.57],[.50,.57],[.76,.57],[.24,.80],[.50,.80],[.76,.80]];
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const message=e=>String(e?.message||e);

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
async function captureSceneFrame(app){
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
  const data=await withDeadline(result,6000,'GPU scene sample');
  await withDeadline(GPU.queue.onSubmittedWorkDone(),6000,'GPU queue did not finish startup frame');
  if(GPU.fatalError)throw GPU.fatalError;
  return data;
 } finally {
  settled=true;
  if(GPU.encoder){
   // A failed frame's incomplete encoder must not be reused.
   GPU.encoder=null;GPU._submitHooks=[];
  }
  // Never retry with a poisoned GPU device. If no submit happened, drop the hook.
  if(!submitted&&rejectPending)GPU._submitHooks=[];
  try{if(buffer.mapState==='mapped')buffer.unmap();}catch(_){}
  buffer.destroy();
 }
}
export async function verifyMobileWorld(app,onProgress=()=>{}){
 if(!app?.terrain?.mesh||!app.ocean||!app.post||!app.sceneRenderer?.sceneRT)
  throw new Error('Terrain, ocean or WebGPU render target missing.');
 validateSpawn(app);
 const status=window.__bermudaWorldGate={status:'checking',tries:0,last:null};
 let consecutive=0;
 try {
  for(let attempt=0;attempt<24;attempt++) {
   if(GPU.fatalError)throw GPU.fatalError;
   onProgress(attempt);
   await withDeadline(GPU.pipelinesReady(),120000,'Shader compilation');
   GPU.device.pushErrorScope('validation');GPU.device.pushErrorScope('out-of-memory');
   let data,frameError;
   try {data=await captureSceneFrame(app);} catch(e){frameError=e;}
   const errors=await withDeadline(Promise.all([GPU.device.popErrorScope(),GPU.device.popErrorScope()]),6000,'GPU validation');
   if(frameError)throw frameError;
   const error=errors.find(Boolean);if(error)throw new Error(error.message);
   status.tries=attempt+1;status.last=data;
   const atmosphereReady=app.atmosphere.mobileMode!=='staged'||app.atmosphere.mobileInitStage>=3;
   const ready=data.valid&&atmosphereReady&&app.atmosphere._svValid&&app.query.cpuValid&&GPU._pending.size===0&&app.engine.meshRenderer.stats.draws>0;
   consecutive=ready?consecutive+1:0;
   if(consecutive>=3){status.status='ready';status.completedFrames=consecutive;return data;}
   await sleep(50);
  }
  throw new Error('Bermuda world did not produce three complete GPU frames.');
 } catch(e){status.status='failed';status.error=message(e);throw e;}
}
