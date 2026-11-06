// Read-only GPU lifecycle diagnostic. No GPU allocations and no remote telemetry.
const now=()=>typeof performance!=='undefined'?performance.now():Date.now();
const began=now();
export const gpuAudit={
 stage:'boot',stageAt:0,frame:0,submits:0,lastCompute:'',lastError:'',
 reason:'',deviceMessage:'',errors:[],version:'GPU isolation trace 6',
 traceEnabled:typeof location!=='undefined'&&new URLSearchParams(location.search).get('gpuTrace')==='1',
 traceCase:typeof location!=='undefined'?new URLSearchParams(location.search).get('traceCase')||'full':'none',
 traceEvents:[],currentCommands:[],pendingSubmissions:[],recentSubmissions:[],
 trackedTextures:new Map(),trackedTextureBytes:0,peakTrackedTextureBytes:0,
 trackedBuffers:new Map(),trackedBufferBytes:0,peakTrackedBufferBytes:0,
 explicitDestroyCall:false,destroyCallStack:'',destroyHook:'not installed',
 queueAckFrame:0,queueAckAt:0,queueStall:'',lastQueueLatencyMs:0,peakQueueLatencyMs:0,
 currentFrameComputeCount:0,currentFrameComputes:[],
 lastSubmittedComputeCount:0,lastSubmittedComputes:[],lastSubmitAt:0,
 currentFrameRenderCount:0,currentFrameRenders:[],lastSubmittedRenderCount:0,lastSubmittedRenders:[]
};
if(typeof window!=='undefined')window.__bermudaGpuAudit=gpuAudit;
function traceEvent(kind,description){
 const a=gpuAudit;
 if(!a.traceEnabled)return;
 a.traceEvents.push({t:Math.round(now()-began),frame:a.frame,kind,description:String(description??'').slice(0,180)});
 if(a.traceEvents.length>512)a.traceEvents.shift();
}
export function gpuTraceEvent(kind,description){traceEvent(kind,description);}
export function gpuStage(stage,frame){
 if(stage==='Frame begin'){
  gpuAudit.currentFrameComputeCount=0;
  gpuAudit.currentFrameComputes=[];
  gpuAudit.currentFrameRenderCount=0;
  gpuAudit.currentFrameRenders=[];
  gpuAudit.currentCommands=[];
 }
 gpuAudit.stage=stage;gpuAudit.stageAt=Math.round(now()-began);
 if(Number.isFinite(frame))gpuAudit.frame=frame;
 traceEvent('stage',stage);
}
export function gpuCompute(name){
 const a=gpuAudit,label=String(name||'unnamed compute').slice(0,60);
 a.currentFrameComputeCount++;
 a.currentFrameComputes.push(label);
 if(a.currentFrameComputes.length>12)a.currentFrameComputes.shift();
 a.lastCompute=label;
 if(a.traceEnabled){a.currentCommands.push({kind:'compute',name:label});traceEvent('compute pass',label);}
}
// A pass may contain many dispatches. Record each shader and workgroup count,
// which the old last-8-pass ring could not distinguish.
export function gpuDispatch(label,groups){
 const a=gpuAudit;
 if(!a.traceEnabled)return;
 const name=String(label||'compute').slice(0,64);
 const dims=Array.isArray(groups)?groups.join('x'):String(groups);
 a.currentCommands.push({kind:'dispatch',name,groups:dims});
 traceEvent('dispatch',name+' '+dims);
}
export function gpuRender(label){
 const a=gpuAudit;
 a.currentFrameRenderCount++;
 a.currentFrameRenders.push(String(label||'render').slice(0,60));
 if(a.currentFrameRenders.length>16)a.currentFrameRenders.shift();
 if(a.traceEnabled){a.currentCommands.push({kind:'render',name:String(label||'render').slice(0,64)});traceEvent('render pass',label);}
}
export function gpuSubmit(frame){
 const a=gpuAudit;
 a.submits++;
 // Capture the compute dispatches BEFORE moving to the next frame. Previously
 // this information was replaced with "none this submit" on every submission.
 a.lastSubmittedComputeCount=a.currentFrameComputeCount;
 a.lastSubmittedComputes=a.currentFrameComputes.slice(-8);
 a.lastSubmittedRenderCount=a.currentFrameRenderCount;
 a.lastSubmittedRenders=a.currentFrameRenders.slice(-10);
 a.lastSubmitAt=Math.round(now()-began);
 if(a.traceEnabled){
  const item={sequence:a.submits,frame,time:a.lastSubmitAt,commands:a.currentCommands.slice(-192)};
  a.pendingSubmissions.push(item);
  a.recentSubmissions.push(item);
  if(a.recentSubmissions.length>12)a.recentSubmissions.shift();
  traceEvent('submitted',`#${item.sequence} frame ${frame}: ${item.commands.length} recorded commands`);
 }
 gpuStage('GPU submit',frame);
 a.lastCompute=a.lastSubmittedComputeCount?
  a.lastSubmittedComputes.join(', '):'no compute passes recorded';
 return a.submits;
}
export function gpuDeviceDestroyObserved(stack){
 gpuAudit.explicitDestroyCall=true;
 gpuAudit.destroyCallStack=String(stack||'no stack').slice(0,600);
 gpuError('explicit GPUDevice.destroy()',gpuAudit.destroyCallStack);
}
export function gpuDestroyHookStatus(status){gpuAudit.destroyHook=String(status).slice(0,100);}
export function gpuQueueAck(frame){
 gpuAudit.queueAckFrame=Number(frame)||0;
 gpuAudit.queueAckAt=Math.round(now()-began);
 if(gpuAudit.traceEnabled){
  const complete=gpuAudit.pendingSubmissions.filter(s=>s.frame<=frame);
  if(complete.length){
   gpuAudit.lastQueueLatencyMs=Math.max(0,gpuAudit.queueAckAt-complete[complete.length-1].time);
   gpuAudit.peakQueueLatencyMs=Math.max(gpuAudit.peakQueueLatencyMs,gpuAudit.lastQueueLatencyMs);
  }
  gpuAudit.pendingSubmissions=gpuAudit.pendingSubmissions.filter(s=>s.frame>frame);
  traceEvent('queue complete',complete.length+' submission(s), latest frame '+frame);
 }
}
export function gpuQueueStall(message){gpuAudit.queueStall=String(message||'').slice(0,150);}
export function gpuError(kind,message,reason=''){
 const a=gpuAudit,msg=String(message||'').slice(0,300);
 if(msg)a.lastError=msg;
 if(kind==='lost'){a.reason=String(reason||'unknown');a.deviceMessage=msg;}
 a.errors.push(kind+': '+(msg||reason||'no browser details'));
 if(a.errors.length>4)a.errors.shift();
 traceEvent('error:'+kind,msg||reason||'no browser details');
}
// Instrumented engine texture allocations only. The browser/driver can allocate
// additional hidden memory: this is a lower bound, not a total VRAM reading.
export function gpuTexture(action,id,label,width=0,height=0,format='',bytes=0){
 const a=gpuAudit;
 if(!a.traceEnabled)return;
 const old=a.trackedTextures.get(id);
 if(old){a.trackedTextureBytes-=old.bytes;a.trackedTextures.delete(id);}
 if(action==='create'){
  const entry={label,bytes:Math.max(0,bytes),width,height,format};
  a.trackedTextures.set(id,entry);
  a.trackedTextureBytes+=entry.bytes;
  a.peakTrackedTextureBytes=Math.max(a.peakTrackedTextureBytes,a.trackedTextureBytes);
 }
 traceEvent('texture '+action,label+' '+width+'x'+height+' '+format+' '+Math.round(bytes/1048576*100)/100+'MiB');
}
// Tracks engine storage buffers separately; mesh and driver allocations remain untracked.
export function gpuBuffer(action,id,label,bytes=0){
 const a=gpuAudit;
 if(!a.traceEnabled)return;
 const old=a.trackedBuffers.get(id);
 if(old){a.trackedBufferBytes-=old.bytes;a.trackedBuffers.delete(id);}
 if(action==='create'){
  const entry={label,bytes:Math.max(0,bytes)};
  a.trackedBuffers.set(id,entry);
  a.trackedBufferBytes+=entry.bytes;
  a.peakTrackedBufferBytes=Math.max(a.peakTrackedBufferBytes,a.trackedBufferBytes);
 }
 traceEvent('buffer '+action,label+' '+(bytes/1048576).toFixed(2)+'MiB');
}
export function gpuReport(app,attempt=0){
 const a=gpuAudit,scene=app?.sceneRenderer,engine=app?.engine;
 return [
  a.version+' | retry '+attempt,
  'Elapsed '+Math.round((now()-began)/1000)+'s | Frame '+a.frame+' | Submits '+a.submits,
  'Last stage '+a.stage+' @'+a.stageAt+'ms | Last submit '+a.lastSubmitAt+'ms',
  'Compute in last submit '+a.lastSubmittedComputeCount+' | Last kernels '+(a.lastSubmittedComputes.join(' > ')||'none recorded'),
  'Compute in current frame '+a.currentFrameComputeCount,
  'Render passes in last submit '+a.lastSubmittedRenderCount+' | Last passes '+(a.lastSubmittedRenders.join(' > ')||'none'),
  'Last queue completion frame '+a.queueAckFrame+' @'+a.queueAckAt+'ms'+
   (a.traceEnabled?' | Queue latency '+a.lastQueueLatencyMs+'ms | Peak '+a.peakQueueLatencyMs+'ms':'')+
   (a.queueStall?' | Stall '+a.queueStall:''),
  'GPUDevice.destroy() hook '+a.destroyHook+' | Called from JS '+(a.explicitDestroyCall?'YES':'NO'),
  ...(a.destroyCallStack?['Destroy caller '+a.destroyCallStack]:[]),
  'Scene '+(scene?scene.width+'x'+scene.height:'unavailable')+
   ' | Canvas '+(engine?engine.width+'x'+engine.height:'unavailable'),
  'Post '+(app?.post?.isCompatibility?'single-pass mobile':'desktop'),
  ...(a.traceEnabled?['GPU textures tracked '+(a.trackedTextureBytes/1048576).toFixed(1)+' MiB | Peak '+(a.peakTrackedTextureBytes/1048576).toFixed(1)+' MiB | Storage buffers '+(a.trackedBufferBytes/1048576).toFixed(1)+' MiB (partial engine estimate only)']:[]),
  'Vendor texture streaming '+(typeof window!=='undefined'?(JSON.stringify(window.__bermudaVendorStreamStats||'off')):'not browser'),
  'Cloud experiment '+(typeof window!=='undefined'?(window.__bermudaCloudExperiment||'unknown'):'not browser'),
  'Atmosphere '+(app?.atmosphere?.mobileMode??'unknown')+' | Initialization step '+(app?.atmosphere?.mobileInitStage??'unknown'),
  'Water query diagnostic '+(typeof location!=='undefined'?(new URLSearchParams(location.search).get('waterTest')||'normal'):'unknown')+
   ' | Held updates '+(app?.query?.diagnosticHeldUpdates??0)+
   ' | Valid initial sample '+(app?.query?.cpuValid?'YES':'NO'),
  'SkyView dispatches '+(app?.atmosphere?.skyViewDispatchCount??'unknown')+
   ' | Hold after prime '+(app?.atmosphere?.mobileHoldAfterPrime?'YES':'NO')+
   ' | Water query overlap skipped '+(app?.mobileSkyViewWaterQuerySkips??0),
  'Render isolation '+(typeof window!=='undefined'?(window.__bermudaRenderExperiment||'full'):'not browser'),
  'Reflection experiment '+(typeof window!=='undefined'?(window.__bermudaEnvExperiment||'unknown'):'not browser')+
  ' | Refreshes '+(app?.environment?.refreshCount??'unavailable')+
  ' | Prime '+(app?.environment?.progressivePrime?'progressive':'one-shot')+
  ' | Step '+(app?.environment?.step??'unavailable')+
  ' | Cube '+(app?.environment?.size??'unavailable')+'px',
  'Loss reason '+(a.reason||'not reported'),
  'Browser device-loss message '+(a.deviceMessage||'none provided'),
  'Last reported error '+(a.lastError||'none'),
  'Recent '+a.errors.join(' | ')
 ].join('\n');
}
export function gpuDetailedReport(app,attempt=0){
 const a=gpuAudit;
 const fmt=b=> (b/1048576).toFixed(1)+' MiB';
 const rankedTextures=[...a.trackedTextures.values()].sort((a,b)=>b.bytes-a.bytes).slice(0,16)
  .map(e=>`${fmt(e.bytes)} | ${e.label} (${e.width}x${e.height} ${e.format})`);
 const rankedBuffers=[...a.trackedBuffers.values()].sort((a,b)=>b.bytes-a.bytes).slice(0,12)
  .map(e=>`${fmt(e.bytes)} | ${e.label}`);
 const entries=a.traceEvents.slice(-100).map(e=>
  `${String(e.t).padStart(6,' ')}ms frame ${e.frame} ${e.kind}: ${e.description}`);
 const pending=a.pendingSubmissions.map(s=>
  `#${s.sequence} frame ${s.frame}, submitted @${s.time}ms, commands ${s.commands.length}:\n`+
  s.commands.map(c=>`  ${c.kind} ${c.name}${c.groups?' '+c.groups:''}`).join('\n'));
 return gpuReport(app,attempt)+'\n\n'+
  'DIAGNOSTIC CASE '+a.traceCase+' | Trace '+(a.traceEnabled?'ENABLED':'OFF')+'\n'+
  'Tracked engine textures '+fmt(a.trackedTextureBytes)+' | peak '+fmt(a.peakTrackedTextureBytes)+
  ' | count '+a.trackedTextures.size+' (does not include driver allocations)\n'+
  'Tracked engine storage buffers '+fmt(a.trackedBufferBytes)+' | peak '+fmt(a.peakTrackedBufferBytes)+
  ' | count '+a.trackedBuffers.size+' (excludes mesh buffers and driver allocations)\n'+
  'TOP RESIDENT GPU TEXTURES\n'+(rankedTextures.join('\n')||'none')+'\n'+
  'TOP RESIDENT STORAGE BUFFERS\n'+(rankedBuffers.join('\n')||'none')+'\n'+
  'GPU SUBMISSIONS WAITING FOR CONFIRMATION\n'+(pending.join('\n')||'none')+'\n'+
  'RECENT GPU EVENT TIMELINE (newest last)\n'+(entries.join('\n')||'none');
}
