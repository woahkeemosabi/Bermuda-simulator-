// Host scheduling only; native shader descriptors and quality are unchanged.
// Limits async render compilation. Sync and compute compilation remain unchanged.
export function installRenderCompileQueue(device, concurrency = 2) {
 if (!Number.isInteger(concurrency) || concurrency < 1) throw new Error('Invalid compile concurrency');
 const native = device.createRenderPipelineAsync, pending = [], active = new Set();
 const stats = { concurrency, requested: 0, started: 0, completed: 0, rejected: 0, cancelled: 0, queued: 0, active: 0, peakActive: 0, failure: null };
 let fatal = null;
 const stop = (error, label = '') => {
  if (!fatal) {
   fatal = new Error('Render pipeline startup failed'+(label?' ['+label+']':'')+': '+(error?.message || error?.reason || error?.name || 'No browser details'), {cause:error});
   stats.failure = {label, name:error?.name||'', reason:error?.reason||'', message:error?.message||''};
  }
  for (const job of pending.splice(0)) { stats.cancelled++; job.reject(error); }
  stats.queued = 0;
  // Settle application waiters even when a native promise hangs after device loss.
  for (const job of active) job.reject(error);
 };
 const drain = () => {
  while (!fatal && active.size < concurrency && pending.length) {
   const job = pending.shift(); stats.queued = pending.length;
   active.add(job); stats.started++; stats.active=active.size; stats.peakActive=Math.max(stats.peakActive,stats.active);
   let promise;
   try { promise = Reflect.apply(native, job.receiver, job.args); }
   catch (error) { stats.rejected++; active.delete(job); stats.active=active.size; job.reject(error); stop(error,job.args[0]?.label); break; }
   Promise.resolve(promise).then(value => {
    stats.completed++; job.resolve(value);
   }, error => {
    stats.rejected++; job.reject(error); stop(error,job.args[0]?.label);
   }).finally(() => {active.delete(job); stats.active=active.size; drain();});
  }
 };
 Object.defineProperty(device,'createRenderPipelineAsync',{configurable:true,writable:true,value:function(...args){
  stats.requested++;
  if(fatal)return Promise.reject(fatal);
  return new Promise((resolve,reject)=>{pending.push({receiver:this,args,resolve,reject});stats.queued=pending.length;drain();});
 }});
 device.lost.then(info=>stop(Object.assign(new Error(info.message || 'Device lost'),{name:'GPUDeviceLostError',reason:info.reason})));
 return {stats,throwIfFailed(){if(fatal)throw fatal;}};
}
