// Read-only diagnostic state. No GPU allocations, no remote telemetry.
const now=()=>typeof performance!=='undefined'?performance.now():Date.now();
const began=now();
export const gpuAudit={stage:'boot',stageAt:0,frame:0,submits:0,lastCompute:'',lastError:'',
  reason:'',deviceMessage:'',errors:[],version:'GPU lifecycle trace 1'};
if(typeof window!=='undefined')window.__bermudaGpuAudit=gpuAudit;
export function gpuStage(stage,frame){
 gpuAudit.stage=stage;gpuAudit.stageAt=Math.round(now()-began);
 if(Number.isFinite(frame))gpuAudit.frame=frame;
}
export function gpuCompute(name){gpuAudit.lastCompute=String(name||'').slice(0,70);}
export function gpuSubmit(frame){gpuAudit.submits++;gpuStage('GPU submit',frame);}
export function gpuError(kind,message,reason=''){
 const msg=String(message||'').slice(0,300);gpuAudit.lastError=msg;
 if(kind==='lost'){gpuAudit.reason=String(reason||'unknown');gpuAudit.deviceMessage=msg;}
 gpuAudit.errors.push(kind+': '+msg);
 if(gpuAudit.errors.length>3)gpuAudit.errors.shift();
}
export function gpuReport(app,attempt=0){
 const a=gpuAudit,scene=app?.sceneRenderer,engine=app?.engine;
 return [
  a.version+' | retry '+attempt,
  'Elapsed '+Math.round((now()-began)/1000)+'s | Frame '+a.frame+' | Submits '+a.submits,
  'Last stage '+a.stage+' @'+a.stageAt+'ms | Compute '+(a.lastCompute||'none'),
  'Scene '+(scene?scene.width+'x'+scene.height:'unavailable')+
   ' | Canvas '+(engine?engine.width+'x'+engine.height:'unavailable'),
  'Post '+(app?.post?.isCompatibility?'single-pass mobile':'desktop'),
  'Cloud experiment '+(typeof window!=='undefined'?(window.__bermudaCloudExperiment||'unknown'):'not browser'),
  'Loss reason '+(a.reason||'not reported'),
  'Last error '+(a.deviceMessage||a.lastError||'none'),
  'Recent '+a.errors.join(' | ')
 ].join('\n');
}
