// Read-only GPU lifecycle diagnostic. No GPU allocations and no remote telemetry.
const now=()=>typeof performance!=='undefined'?performance.now():Date.now();
const began=now();
export const gpuAudit={
 stage:'boot',stageAt:0,frame:0,submits:0,lastCompute:'',lastError:'',
 reason:'',deviceMessage:'',errors:[],version:'GPU lifecycle trace 5',
 explicitDestroyCall:false,destroyCallStack:'',destroyHook:'not installed',
 queueAckFrame:0,queueAckAt:0,queueStall:'',
 currentFrameComputeCount:0,currentFrameComputes:[],
 lastSubmittedComputeCount:0,lastSubmittedComputes:[],lastSubmitAt:0,
 submitHistory:[],sinceComputeCount:0,sinceRenderCount:0,
 currentFrameRenderCount:0,currentFrameRenders:[],lastSubmittedRenderCount:0,lastSubmittedRenders:[]
};
if(typeof window!=='undefined')window.__bermudaGpuAudit=gpuAudit;
export function gpuStage(stage,frame){
 if(stage==='Frame begin'){
  gpuAudit.currentFrameComputeCount=0;
  gpuAudit.currentFrameComputes=[];
  gpuAudit.currentFrameRenderCount=0;
  gpuAudit.currentFrameRenders=[];
  gpuAudit.sinceComputeCount=0;
  gpuAudit.sinceRenderCount=0;
 }
 gpuAudit.stage=stage;gpuAudit.stageAt=Math.round(now()-began);
 if(Number.isFinite(frame))gpuAudit.frame=frame;
}
export function gpuCompute(name){
 const a=gpuAudit,label=String(name||'unnamed compute').slice(0,60);
 a.currentFrameComputeCount++;
 a.currentFrameComputes.push(label);
 if(a.currentFrameComputes.length>12)a.currentFrameComputes.shift();
 a.lastCompute=label;
}
export function gpuRender(label){
 const a=gpuAudit;
 a.currentFrameRenderCount++;
 a.currentFrameRenders.push(String(label||'render').slice(0,60));
 if(a.currentFrameRenders.length>16)a.currentFrameRenders.shift();
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
 // Preserve the individual submission boundaries for split-startup diagnostics.
 // Historic currentFrame* values remain cumulative for compatibility.
 a.submitHistory.push({frame,at:a.lastSubmitAt,computeDelta:a.currentFrameComputeCount-a.sinceComputeCount,
  renderDelta:a.currentFrameRenderCount-a.sinceRenderCount,computes:a.currentFrameComputes.slice(-8),
  renders:a.currentFrameRenders.slice(-10)});
 if(a.submitHistory.length>8)a.submitHistory.shift();
 a.sinceComputeCount=a.currentFrameComputeCount;
 a.sinceRenderCount=a.currentFrameRenderCount;
 gpuStage('GPU submit',frame);
 a.lastCompute=a.lastSubmittedComputeCount?
  a.lastSubmittedComputes.join(', '):'no compute passes recorded';
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
}
export function gpuQueueStall(message){gpuAudit.queueStall=String(message||'').slice(0,150);}
export function gpuError(kind,message,reason=''){
 const a=gpuAudit,msg=String(message||'').slice(0,300);
 if(msg)a.lastError=msg;
 if(kind==='lost'){a.reason=String(reason||'unknown');a.deviceMessage=msg;}
 a.errors.push(kind+': '+(msg||reason||'no browser details'));
 if(a.errors.length>4)a.errors.shift();
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
  'Last queue completion frame '+a.queueAckFrame+' @'+a.queueAckAt+'ms'+(a.queueStall?' | Stall '+a.queueStall:''),
  'GPUDevice.destroy() hook '+a.destroyHook+' | Called from JS '+(a.explicitDestroyCall?'YES':'NO'),
  ...(a.destroyCallStack?['Destroy caller '+a.destroyCallStack]:[]),
  'Scene '+(scene?scene.width+'x'+scene.height:'unavailable')+
   ' | Canvas '+(engine?engine.width+'x'+engine.height:'unavailable'),
  'Post '+(app?.post?.isCompatibility?'single-pass mobile':'desktop'),
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
