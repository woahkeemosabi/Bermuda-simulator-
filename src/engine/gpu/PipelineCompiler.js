// Bounded asynchronous compilation. A rejected pipeline never becomes "ready".
export class PipelineCompiler {
 constructor(device, concurrency=2, {now=()=>performance.now()}={}) {
  Object.assign(this,{device,concurrency,now});this.active=0;this.pending=new Set();this.queue=[];this.failures=[];
  this.counts={requested:0,completed:0,failed:0,synchronous:0};this.slowest=[];
 }
 request(desc,kind,label=desc.label) {
  if(this.cancelled)throw this.cancelled;
  const h={desc,kind,label,pipeline:null,state:'queued',failed:false,queuedAt:this.now(),startedAt:null};
  this.counts.requested++;
  h.promise=new Promise(resolve=>h.resolve=resolve);
  this.pending.add(h);this.queue.push(h);queueMicrotask(()=>this.pump());return h;
 }
 finish(h,pipeline,error) {
  if(!this.pending.has(h))return;
  h.pipeline=pipeline;h.error=error;h.failed=!!error;h.state=error?'failed':'ready';h.desc=null;
  this.counts[error?'failed':'completed']++;
  if(h.startedAt!==null){
   this.slowest.push({label:h.label,kind:h.kind,elapsedMs:this.now()-h.startedAt,waitMs:h.startedAt-h.queuedAt,failed:!!error});
   this.slowest.sort((a,b)=>b.elapsedMs-a.elapsedMs);this.slowest.length=Math.min(12,this.slowest.length);
  }
  if(error)this.failures.push(error);
  this.pending.delete(h);h.resolve();
 }
 cancel(error) {
  this.cancelled=error;this.queue=[];
  for(const h of [...this.pending])this.finish(h,null,error);
 }
 pump() {
  while(this.active<this.concurrency&&this.queue.length) {
   const h=this.queue.shift();if(h.state!=='queued')continue;
   h.state='compiling';h.startedAt=this.now();this.active++;
   Promise.resolve().then(()=>this.device[h.kind==='render'?'createRenderPipelineAsync':'createComputePipelineAsync'](this.descriptor(h)))
    .then(p=>this.finish(h,p,null),e=>this.finish(h,null,new Error(`Pipeline ${h.label}: ${e.message}`,{cause:e})))
    .finally(()=>{this.active--;this.pump();});
  }
 }
 descriptor(h) {
  if(typeof h.desc==='function')h.desc=h.desc();
  return h.desc;
 }
 diagnostics() {
  const now=this.now();
  return {...this.counts,active:this.active,queued:[...this.pending].filter(h=>h.state==='queued').length,
   compiling:[...this.pending].filter(h=>h.startedAt!==null).map(h=>({label:h.label,kind:h.kind,elapsedMs:now-h.startedAt})),
   slowest:this.slowest.map(s=>({...s})),cancelled:!!this.cancelled};
 }
 ready(h) {
  if(h.error)throw h.error;if(h.pipeline)return h.pipeline;
  if(h.state==='compiling')throw new Error(`Pipeline still compiling: ${h.label}`);
  // Constructor-time one-off bakes can run before the asynchronous task starts.
  h.startedAt=this.now();this.counts.synchronous++;
  try { const p=this.device[h.kind==='render'?'createRenderPipeline':'createComputePipeline'](this.descriptor(h));this.finish(h,p,null);return p; }
  catch(e){this.finish(h,null,e);throw e;}
 }
 async readyAll() {
  while(this.pending.size)await Promise.all([...this.pending].map(h=>h.promise));
  if(this.failures.length)throw this.failures[0];
 }
}
export async function withDeadline(promise,ms,label) {
 let timer;
 try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(`${label} timed out; world remains locked`)),ms);})]);}
 finally{clearTimeout(timer);}
}
