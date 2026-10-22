import { GPU } from '../engine/gpu/GPU.js';
import { assessFramePixels } from './FrameHealth.js';

// Mobile visual gating samples nine real GPU pixels from the rendered output.
// These samples are captured before submission/presentation, not after the canvas is recycled.
const POINTS=[[.25,.28],[.50,.30],[.75,.28],[.25,.57],[.50,.58],[.75,.57],
 [.25,.78],[.50,.78],[.75,.78]];
const wait = ms => new Promise(resolve=>setTimeout(resolve,ms));
const errorText = e => String(e?.message||e);

export function validateSpawn(app) {
  const p=app?.player, t=app?.terrainData, c=app?.colliders;
  if(!p||!t||!app.camera) throw new Error('Player, camera or terrain missing.');
  if(p.mode!=='walk') return;
  const s=app.bermudaBlockout?.start||{x:-63.4,z:-20,yaw:Math.PI};
  if(!Number.isFinite(p.position.x)||!Number.isFinite(p.position.z)){
    p.position.x=s.x;p.position.z=s.z;p.yaw=s.yaw;
  }
  const height=t.heightAt(p.position.x,p.position.z);
  const obstacle=c?.groundHeightAt?.(p.position.x,p.position.z,50);
  const ground=Math.max(Number.isFinite(height)?height:-Infinity,Number.isFinite(obstacle)?obstacle:-Infinity);
  if(!Number.isFinite(ground)) throw new Error('Spawn is outside valid ground.');
  // The Player class stores the feet; its camera method adds the eye height separately.
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

async function captureFrame(app){
  const buffer=GPU.device.createBuffer({label:'bermuda-frame-health',size:POINTS.length*256,
    usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});
  let settled=false, useCanvas=false;
  let resolve, reject;
  const ready=new Promise((a,b)=>{resolve=a;reject=b;});
  GPU.onSubmit((enc)=>{
    useCanvas=!!GPU.canvasReadbackEnabled;
    const scene=app.sceneRenderer.sceneRT;
    const tex=useCanvas?GPU.context.getCurrentTexture():scene.texture.getGPU();
    const w=useCanvas?GPU.canvas.width:scene.width;
    const h=useCanvas?GPU.canvas.height:scene.height;
    POINTS.forEach(([x,y],i)=>enc.copyTextureToBuffer({
      texture:tex,origin:{x:Math.max(0,Math.min(w-1,Math.floor(w*x))),
        y:Math.max(0,Math.min(h-1,Math.floor(h*y))),z:0}},
      {buffer,offset:i*256,bytesPerRow:256,rowsPerImage:1},
      {width:1,height:1,depthOrArrayLayers:1}));
  },()=>{
    buffer.mapAsync(GPUMapMode.READ).then(()=>{
      if(settled)return;
      const bytes=new Uint8Array(buffer.getMappedRange());
      const data=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
      const samples=POINTS.map((_,i)=>{
        const k=i*256;
        return useCanvas?[bytes[k],bytes[k+1],bytes[k+2]]:
          [0,2,4].map(n=>decodeHalf(data.getUint16(k+n,true)));
      });
      settled=true;resolve({...assessFramePixels(samples),
        source:useCanvas?'final-canvas':'hdr-scene',samples});
    }).catch(e=>{if(!settled){settled=true;reject(e);}});
  });
  try{
    app.frame(1/60);
    // Timer only bounds an actual GPU readback; it never pretends a frame rendered.
    return await Promise.race([ready,wait(12000).then(()=>{
      if(!settled)throw new Error('GPU frame readback timed out');return null;
    })]);
  }finally{
    settled=true;
    // An exception before submit leaves an abandoned encoder and submit hook.
    if(GPU.encoder){GPU.encoder=null;GPU._submitHooks=[];}
    if(buffer.mapState==='mapped')buffer.unmap();
    buffer.destroy();
  }
}

export async function verifyMobileWorld(app,onProgress=()=>{}){
  if(!app?.terrain?.mesh||!app?.ocean||!app?.post||!app?.sceneRenderer?.sceneRT)
    throw new Error('World terrain, ocean or rendering passes were not initialized.');
  validateSpawn(app);
  window.__bermudaWorldGate={status:'checking',tries:0,last:null};
  let last=null;
  for(let attempt=0;attempt<5;attempt++){
    if(window.__bermudaGpuLost)throw new Error('WebGPU device lost: '+window.__bermudaGpuLost);
    onProgress(attempt);
    // Async pipelines may be pending even after App.init. Previous mobile boot capped
    // compilation at 6.5s, allowing the HUD to appear over undrawn geometry.
    await Promise.race([GPU.pipelinesReady(),wait(8500)]);
    try{last=await captureFrame(app);}
    catch(e){
      last={valid:false,reason:'render-exception',error:errorText(e)};
      console.warn('Mobile startup render gate:',last);
    }
    window.__bermudaWorldGate.tries=attempt+1;
    window.__bermudaWorldGate.last=last;
    if(last?.valid){
      window.__bermudaWorldGate.status='ready';
      return last;
    }
    if(attempt===2){
      // Presentation-only recovery. NO spray, water, wildlife, geometry or lighting removed.
      app.post.aaMode='fxaa';
      app.setRenderScale(Math.max(.6,app.settings.renderScale-.1));
      window.__bermudaWorldGate.status='presentation-retry';
    }
    await wait(220);
  }
  window.__bermudaWorldGate.status='failed';
  throw new Error('3D world rendering failed ('+(last?.error||last?.reason||'unknown')+
    '). Tap Retry. Simulation assets have not been removed.');
}
