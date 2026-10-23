// Read-only GPU lifecycle diagnostic. No GPU allocations and no remote telemetry.
const now=()=>typeof performance!=='undefined'?performance.now():Date.now();
const began=now();
export const gpuAudit={
 stage:'boot',stageAt:0,frame:0,submits:0,lastCompute:'',lastError:'',
 reason:'',deviceMessage:'',errors:[],version:'GPU lifecycle trace 2',
 currentFrameComputeCount:0,currentFrameComputes:[],
 lastSubmittedComputeCount:0,lastSubmittedComputes:[],lastSubmitAt:0
};
if(typeof window!=='undefined')window.__bermudaGpuAudit=gpuAudit;
export function gpuStage(stage,frame){
 if(stage==='Frame begin'){
  gpuAudit.currentFrameComputeCount=0;
  gpuAudit.currentFrameComputes=[];
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
export function gpuSubmit(frame){
 const a=gpuAudit;
 a.submits++;
 // Capture the compute dispatches BEFORE moving to the next frame. Previously
 // this information was replaced with "none this submit" on every submission.
 a.lastSubmittedComputeCount=a.currentFrameComputeCount;
 a.lastSubmittedComputes=a.currentFrameComputes.slice(-8);
 a.lastSubmitAt=Math.round(now()-began);
 gpuStage('GPU submit',frame);
 a.lastCompute=a.lastSubmittedComputeCount?
  a.lastSubmittedComputes.join(', '):'no compute passes recorded';
}
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
  'Scene '+(scene?scene.width+'x'+scene.height:'unavailable')+
   ' | Canvas '+(engine?engine.width+'x'+engine.height:'unavailable'),
  'Post '+(app?.post?.isCompatibility?'single-pass mobile':'desktop'),
  'Cloud experiment '+(typeof window!=='undefined'?(window.__bermudaCloudExperiment||'unknown'):'not browser'),
  'Reflection experiment '+(typeof window!=='undefined'?(window.__bermudaEnvExperiment||'unknown'):'not browser')+
  ' | Refreshes '+(app?.environment?.refreshCount??'unavailable')+
  ' | Prime '+(app?.environment?.progressivePrime?'progressive':'one-shot')+
  ' | Step '+(app?.environment?.step??'unavailable'),
  'Loss reason '+(a.reason||'not reported'),
  'Browser device-loss message '+(a.deviceMessage||'none provided'),
  'Last reported error '+(a.lastError||'none'),
  'Recent '+a.errors.join(' | ')
 ].join('\n');
}
