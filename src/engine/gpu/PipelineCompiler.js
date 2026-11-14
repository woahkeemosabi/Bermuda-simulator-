// Bounded asynchronous compilation. A rejected pipeline never becomes "ready".
export class PipelineCompiler {
 constructor(device, concurrency=2) { this.device=device;this.concurrency=concurrency;this.active=0;this.pending=new Set();this.queue=[];this.failures=[]; }
 request(desc,kind) {
  const h={desc,kind,label:desc.label,pipeline:null,state:'queued',failed:false};
  h.promise=new Promise(resolve=>h.resolve=resolve);
  this.pending.add(h);this.queue.push(h);queueMicrotask(()=>this.pump());return h;
 }
 finish(h,pipeline,error) {
  h.pipeline=pipeline;h.error=error;h.failed=!!error;h.state=error?'failed':'ready';h.desc=null;
  if(error)this.failures.push(error);
  this.pending.delete(h);h.resolve();
 }
 pump() {
  while(this.active<this.concurrency&&this.queue.length) {
   const h=this.queue.shift();if(h.state!=='queued')continue;
   h.state='compiling';this.active++;
   Promise.resolve().then(()=>this.device[h.kind==='render'?'createRenderPipelineAsync':'createComputePipelineAsync'](h.desc))
    .then(p=>this.finish(h,p,null),e=>this.finish(h,null,new Error(`Pipeline ${h.label}: ${e.message}`,{cause:e})))
    .finally(()=>{this.active--;this.pump();});
  }
 }
 ready(h) {
  if(h.error)throw h.error;if(h.pipeline)return h.pipeline;
  if(h.state==='compiling')throw new Error(`Pipeline still compiling: ${h.label}`);
  // Constructor-time one-off bakes can run before the asynchronous task starts.
  try { const p=this.device[h.kind==='render'?'createRenderPipeline':'createComputePipeline'](h.desc);this.finish(h,p,null);return p; }
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
