import assert from 'node:assert/strict';
import { configureGpuTraceUrl } from '../_qa/fftcore/src/mobile/GpuTraceCases.js';
import { configureQAEffectTrial, QA_EFFECT_TRIALS, QA_EFFECT_STACKS } from '../_qa/fftcore/src/mobile/QAEffectTrial.js';

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
// The user has separately tested all six effects on an iPhone; combine only
// these six in one locked URL while preserving FFT, quality and cloud isolation.
const combined = run('coastal-six');
assert.equal(combined.selected, 'coastal-six');
assert.deepEqual(QA_EFFECT_STACKS['coastal-six'].disableFlags,
  ['noCaustics','noShadows','noSim','noBreakers','noSpray','noWake']);
for (const flag of flags) {
  const expected = QA_EFFECT_STACKS['coastal-six'].disableFlags.includes(flag) ? null : '1';
  assert.equal(combined.url.searchParams.get(flag), expected, 'coastal-six: '+flag);
}
assert.equal(combined.url.searchParams.get('noClouds'), '1', 'clouds remain disabled');
assert.equal(combined.url.searchParams.get('noHaze'), '1', 'haze remains disabled');
assert.equal(combined.url.searchParams.get('envtest'), 'skip', 'reflections unchanged');
assert.equal(combined.url.searchParams.get('G'), '12', 'FFT grid unchanged');
assert.equal(combined.url.searchParams.get('qualityTest'), 'crisp', 'visual baseline unchanged');
assert.equal(combined.url.searchParams.get('traceCase'), 'fftcore');
assert.equal(combined.url.searchParams.get('fx'), 'coastal-six');
const forcedCloud = new URL('https://localhost/qa/fftcore/?fx=coastal-six&cloudtest=panorama');
configureGpuTraceUrl(forcedCloud);
configureQAEffectTrial(forcedCloud);
assert.equal(forcedCloud.searchParams.get('noClouds'), '1');
assert.equal(forcedCloud.searchParams.has('cloudtest'), false);

// Coastal-seven preserves all six passes and adds ONLY panorama clouds.
const withClouds = run('coastal-seven');
assert.equal(withClouds.selected, 'coastal-seven');
assert.deepEqual(QA_EFFECT_STACKS['coastal-seven'].disableFlags,
  ['noCaustics','noShadows','noSim','noBreakers','noSpray','noWake','noClouds']);
for (const flag of flags) {
  const expected = QA_EFFECT_STACKS['coastal-seven'].disableFlags.includes(flag) ? null : '1';
  assert.equal(withClouds.url.searchParams.get(flag), expected, 'coastal-seven: '+flag);
}
assert.equal(withClouds.url.searchParams.get('cloudtest'), 'panorama', 'clouds use panorama-only mode');
assert.equal(withClouds.url.searchParams.get('noHaze'), '1', 'haze still isolated');
assert.equal(withClouds.url.searchParams.get('envtest'), 'skip', 'reflection bake remains off');
assert.equal(withClouds.url.searchParams.get('G'), '12', 'FFT workload unchanged');
assert.equal(withClouds.url.searchParams.get('qualityTest'), 'crisp', 'same render quality');
assert.equal(withClouds.url.searchParams.get('fx'), 'coastal-seven', 'seven-effect preset selected');
// A URL requesting full clouds cannot override the conservative panorama mode.
const forcedFullCloud = new URL('https://localhost/qa/fftcore/?fx=coastal-seven&cloudtest=full');
configureGpuTraceUrl(forcedFullCloud);
configureQAEffectTrial(forcedFullCloud);
assert.equal(forcedFullCloud.searchParams.get('cloudtest'), 'panorama');
assert.equal(forcedFullCloud.searchParams.has('noClouds'), false);

const unknown = run('all-at-once');
assert.equal(unknown.selected,'baseline');
assert.equal(unknown.url.searchParams.has('fx'),false);
for(const flag of flags) assert.equal(unknown.url.searchParams.get(flag),'1');
console.log('QA effect tests passed: unchanged default + '+Object.keys(QA_EFFECT_TRIALS).length+' single-effect cases + coastal-six (clouds off) + coastal-seven (panorama clouds)');
