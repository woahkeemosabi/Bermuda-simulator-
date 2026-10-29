// Opt-in diagnostics. Native descriptors, objects, promises and exceptions pass through.
// Queue fences are observations, not waits in the application's submission path.
export function observeNativeGPU(device, { now = () => performance.now(), limit = 512 } = {}) {
 const trace = {
  clock: 'performance.now (CPU callback time, not GPU execution duration)',
  hooks: {}, pipelines: [], droppedPipelineRecords: 0,
  pipelineCounts: { asyncStarted: 0, asyncPending: 0, peakAsyncPending: 0, resolved: 0, rejected: 0, syncCalls: 0, syncThrows: 0 },
  queue: { submits: 0, lastSubmitAt: null, completedThroughSubmit: 0, lastCompletionAt: null, pendingWaits: 0, rejectedWaits: 0 },
  queueEvents: [], droppedQueueRecords: 0, lost: null,
 };
 const errorInfo = e => ({ name: String(e?.name || ''), reason: String(e?.reason || ''), message: String(e?.message ?? e ?? ''), stack: String(e?.stack || '').slice(0, 1600) });
 const keep = (key, dropped, value) => { trace[key].push(value); if (trace[key].length > limit) { trace[key].shift(); trace[dropped]++; } };
 const hook = (target, name, wrap) => {
  try {
   const original = target[name];
   if (typeof original !== 'function') throw new Error('method unavailable');
   Object.defineProperty(target, name, { configurable: true, writable: true, value: wrap(original) });
   trace.hooks[name] = 'installed';
  } catch (e) { trace.hooks[name] = errorInfo(e); }
 };
 let nextPipeline = 0;
 for (const kind of ['Render', 'Compute']) for (const async of [false, true]) {
  const name = 'create' + kind + 'Pipeline' + (async ? 'Async' : '');
  hook(device, name, original => function(...args) {
   const counts = trace.pipelineCounts;
   const call = { id: ++nextPipeline, kind: kind.toLowerCase(), mode: async ? 'async' : 'sync', label: String(args[0]?.label || ''), at: now(), status: 'pending' };
   keep('pipelines', 'droppedPipelineRecords', call);
   if (async) { counts.asyncStarted++; counts.asyncPending++; counts.peakAsyncPending = Math.max(counts.peakAsyncPending, counts.asyncPending); }
   else counts.syncCalls++;
   let result;
   try { result = Reflect.apply(original, this, args); }
   catch (e) {
    call.status = 'threw'; call.finishedAt = now(); call.error = errorInfo(e);
    if (async) { counts.asyncPending--; counts.rejected++; } else counts.syncThrows++;
    throw e;
   }
   if (async) result.then(() => {
    call.status = 'resolved'; call.finishedAt = now(); counts.asyncPending--; counts.resolved++;
   }, e => {
    call.status = 'rejected'; call.finishedAt = now(); call.error = errorInfo(e); counts.asyncPending--; counts.rejected++;
   });
   else { call.status = 'returned'; call.finishedAt = now(); } // Returned does not prove validation succeeded.
   return result;
  });
 }
 const queue = device.queue, nativeDone = queue.onSubmittedWorkDone;
 let samplePending = false, lastSampleAt = -Infinity;
 const watch = (promise, source, throughSubmit, at) => {
  const event = { source, throughSubmit, at, status: 'pending' };
  keep('queueEvents', 'droppedQueueRecords', event);
  trace.queue.pendingWaits++;
  promise.then(() => {
   event.status = 'resolved'; event.finishedAt = now(); trace.queue.pendingWaits--;
   trace.queue.completedThroughSubmit = Math.max(trace.queue.completedThroughSubmit, throughSubmit);
   trace.queue.lastCompletionAt = event.finishedAt;
   if (source === 'qa-sampled-fence') samplePending = false;
  }, e => {
   event.status = 'rejected'; event.finishedAt = now(); event.error = errorInfo(e);
   trace.queue.pendingWaits--; trace.queue.rejectedWaits++;
   if (source === 'qa-sampled-fence') samplePending = false;
  });
 };
 hook(queue, 'onSubmittedWorkDone', original => function(...args) {
  const at = now(), through = trace.queue.submits;
  let promise;
  try { promise = Reflect.apply(original, this, args); }
  catch (e) { keep('queueEvents', 'droppedQueueRecords', { source: 'application', at, throughSubmit: through, status: 'threw', error: errorInfo(e) }); throw e; }
  watch(promise, 'application', through, at);
  return promise;
 });
 hook(queue, 'submit', original => function(...args) {
  let result;
  try { result = Reflect.apply(original, this, args); }
  catch (e) { keep('queueEvents', 'droppedQueueRecords', { source: 'submit', at: now(), status: 'threw', error: errorInfo(e) }); throw e; }
  trace.queue.submits++; trace.queue.lastSubmitAt = now();
  // At most one extra fence in flight, at most once per second. Never await it here.
  if (!trace.lost && !samplePending && now() - lastSampleAt >= 1000 && typeof nativeDone === 'function') {
   samplePending = true; lastSampleAt = now();
   try { watch(Reflect.apply(nativeDone, this, []), 'qa-sampled-fence', trace.queue.submits, lastSampleAt); }
   catch (e) { samplePending = false; keep('queueEvents', 'droppedQueueRecords', { source: 'qa-sampled-fence', at: now(), status: 'threw', error: errorInfo(e) }); }
  }
  return result;
 });
 device.lost.then(info => { trace.lost = { at: now(), reason: info.reason, message: info.message }; });
 return trace;
}
