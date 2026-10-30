// Startup-only submission pacing. Iteration encodes the next stage only after the
// previous stage's native queue fence resolves and the device is still healthy.
export async function runStartupStages(stages, { ready, submit, done, check, mark = () => {} }) {
 check();
 const iterator = stages[Symbol.iterator]();
 try {
  while (true) {
   // Wait BEFORE encoding: a canvas currentTexture must not be held across an
   // asynchronous pipeline wait between encoding and submit.
   await ready();
   check();
   const next = iterator.next();
   if (next.done) break;
   const stage = next.value;
   mark('startup-stage-submit', {stage});
   submit();
   await done();
   check();
   mark('startup-stage-complete', {stage});
   mark('startup-stage-pipelines-wait', {stage});
  }
 } finally {
  iterator.return?.(); // Restore generator state (e.g. reflection priming) on loss.
 }
 check();
}
