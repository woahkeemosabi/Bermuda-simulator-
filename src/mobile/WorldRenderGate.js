import { GPU } from '../engine/gpu/GPU.js';
import { assessFramePixels } from './FrameHealth.js';

// Keep the original WebGPU effects and terrain. Inspect the HDR scene, not Safari's
// presentation surface; never request a COPY_SRC swapchain or repeatedly retry dead devices.
const POINTS=[[.24,.25],[.50,.25],[.76,.25],[.30,.57],[.70,.57],[.30,.80],[.70,.80]];
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
 try{
  app.frame(1/60);
  const data=await Promise.race([result,sleep(6000).then(()=>{
   throw new Error('GPU scene sample timed out');
  })]);
  await Promise.race([GPU.queue.onSubmittedWorkDone(),sleep(6000).then(()=>{
   throw new Error('GPU queue did not finish startup frame');
  })]);
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
 // First visible frame also requests missing materials' asynchronous pipelines.
 // One submitted frame at a time: do NOT flood the iPhone driver with retries.
 for(let attempt=0;attempt<3;attempt++){
  if(GPU.fatalError||window.__bermudaGpuLost)
   throw GPU.fatalError||new Error(window.__bermudaGpuLost);
  onProgress(attempt);
  await Promise.race([GPU.pipelinesReady(),sleep(6000)]);
  try{
   const data=await captureSceneFrame(app);
   status.tries=attempt+1;status.last=data;
   if(data.valid){status.status='ready';return data;}
  }catch(e){
   status.tries=attempt+1;
   status.last={valid:false,reason:'gpu-error',error:message(e)};
   // An encoder failure is a terminal loss of the GPU context, not a black-pixel
   // condition. A new GPUDevice needs a page reload, not another command encoder.
   if(GPU.fatalError||/command encoder|createCommandEncoder|device lost|out of memory/i.test(message(e))){
    status.status='gpu-lost';
    throw e;
   }
   if(attempt===2)throw e;
  }
  // Change only anti-aliasing/pixel scale, not spray, waves, fish, or lighting.
  if(attempt===1){
   app.post.aaMode='fxaa';
   app.setRenderScale(Math.max(.60,app.settings.renderScale-.05));
  }
  await sleep(350);
 }
 status.status='black-scene';
 throw new Error('The Bermuda world is still black after GPU verification. Retry Loading.');
}
