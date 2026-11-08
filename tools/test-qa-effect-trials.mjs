import assert from 'node:assert/strict';
import { configureGpuTraceUrl } from '../_qa/fftcore/src/mobile/GpuTraceCases.js';
import { configureQAEffectTrial, QA_EFFECT_TRIALS } from '../_qa/fftcore/src/mobile/QAEffectTrial.js';

// Isolated test: normalization first, then one-effect switch, exactly as src/main.js.
const flags = ['noClouds','noSim','noSpray','noCaustics','noHaze','noWake','noBreakers','noShadows'];
function run(fx) {
  const url = new URL('https://localhost/qa/fftcore/?gpuTrace=1&traceCase=fftcore&qualityTest=crisp');
  if (fx) url.searchParams.set('fx', fx);
  configureGpuTraceUrl(url);
  const selected = configureQAEffectTrial(url);
  return { url, selected };
}
const baseline=run('');
assert.equal(baseline.selected,'baseline');
for(const flag of flags) assert.equal(baseline.url.searchParams.get(flag),'1','baseline '+flag);
assert.equal(baseline.url.searchParams.get('envtest'),'skip');
assert.equal(baseline.url.searchParams.get('G'),'12');
assert.equal(baseline.url.searchParams.get('traceCase'),'fftcore');
for (const [fx, opts] of Object.entries(QA_EFFECT_TRIALS)) {
  const {url, selected} = run(fx);
  assert.equal(selected,fx);
  for(const flag of flags) {
    const expected=flag===opts.disableFlag?null:'1';
    assert.equal(url.searchParams.get(flag),expected,fx+': '+flag);
  }
  assert.equal(url.searchParams.get('G'),'12',fx+': no changes to grid');
  assert.equal(url.searchParams.get('qualityTest'),'crisp',fx+': image scale held');
  assert.equal(url.searchParams.get('envtest'),fx==='reflections'?'freeze':'skip',fx+': reflection isolation');
  if(fx==='clouds') assert.equal(url.searchParams.get('cloudtest'),'panorama');
}
const unknown = run('all-at-once');
assert.equal(unknown.selected,'baseline');
assert.equal(unknown.url.searchParams.has('fx'),false);
for(const flag of flags) assert.equal(unknown.url.searchParams.get(flag),'1');
console.log('QA effect tests passed: unchanged default + '+Object.keys(QA_EFFECT_TRIALS).length+' single-effect cases');
