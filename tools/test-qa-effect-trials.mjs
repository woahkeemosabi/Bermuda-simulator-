import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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

// Opt-in MarineSnow shader compatibility A/B: the default still uses the
// original surface-query shader; ?snowCompat=1 removes only that dependency.
// The FFT sampler remains used for particle motion and waterline clipping.
const mainSource = readFileSync(new URL('../_qa/fftcore/src/main.js', import.meta.url), 'utf8');
const appSource = readFileSync(new URL('../_qa/fftcore/src/App.js', import.meta.url), 'utf8');
const snowSource = readFileSync(new URL('../_qa/fftcore/src/fx/MarineSnow.js', import.meta.url), 'utf8');
const cloudSource = readFileSync(new URL('../_qa/fftcore/src/sky/SkyProClouds.js', import.meta.url), 'utf8');
const skySource = readFileSync(new URL('../_qa/fftcore/src/sky/Sky.js', import.meta.url), 'utf8');
const waterSource = readFileSync(new URL('../_qa/fftcore/src/ocean/WaterMaterial.js', import.meta.url), 'utf8');
const engineSource = readFileSync(new URL('../_qa/fftcore/src/engine/Engine.js', import.meta.url), 'utf8');
const vendorSource = readFileSync(new URL('../_qa/fftcore/src/game/Vendor.js', import.meta.url), 'utf8');
const beachBlockoutSource = readFileSync(new URL('../_qa/fftcore/src/world/BermudaBlockout.js', import.meta.url), 'utf8');
const waterfrontUpgradeSource = readFileSync(new URL('../_qa/fftcore/src/world/ReferenceWorldUpgrade.js', import.meta.url), 'utf8');
const gameSource = readFileSync(new URL('../_qa/fftcore/src/game/Game.js', import.meta.url), 'utf8');
const productionSource = readFileSync(new URL('../_qa/fftcore/src/world/ProductionMeshyAssets.js', import.meta.url), 'utf8');
const skinSource = readFileSync(new URL('../_qa/fftcore/src/engine/render/Skinning.js', import.meta.url), 'utf8');
const reportSource = readFileSync(new URL('../_qa/fftcore/src/mobile/GpuAudit.js', import.meta.url), 'utf8');
assert.match(appSource, /query: mobileLite && qs\.get\('snowCompat'\) === '1' \? null : this\.query/);
assert.match(appSource, /__bermudaQASnowCompatibility = 'fft-sea-level-waterline'/);
assert.match(snowSource, /if \( query && query\.module \) modules\.push\( query\.module \);/);
assert.match(snowSource, /frame\.seaLevel \+ sway\.y - p\.y/);
assert.match(reportSource, /QA MarineSnow profile/);
assert.match(appSource, /if \(!mobileLite\) scene\.add\( this\.marineSnow\.mesh \);/);
assert.match(appSource, /if \(!mobileLite\) scene\.add\( this\.airMotes\.mesh \);/);
assert.match(appSource, /__bermudaQASnowCompatibility = 'disabled-qa'/);
assert.match(appSource, /__bermudaQAAirMotesProfile = 'disabled-qa'/);
assert.match(reportSource, /QA AirMotes profile/);
const noticesSource = readFileSync(new URL('../_qa/fftcore/src/game/HarbourNotices.js', import.meta.url), 'utf8');
assert.match(vendorSource, /QA_VENDOR_FOCUS \? Math\.min\(this\.radius, 3\.0\) : 14/);
assert.match(vendorSource, /__bermudaQAVendorLoadBusy = true/);
assert.match(vendorSource, /__bermudaQAVendorLoadBusy = false/);
assert.match(noticesSource, /s\.emissive = ink \* 0\.78/);
assert.match(noticesSource, /side: 'double'/);
assert.match(noticesSource, /#e2d5b8/);
assert.match(reportSource, /QA vendor load strategy original GLBs early 14m serialized/);
assert.match(reportSource, /QA harbour notices contrast emissive-0\.78 two-face/);
assert.match(reportSource, /QA cloud instance/);
assert.match(mainSource, /__bermudaQAGameplay = \{ startedAt: performance\.now\(\), submissions: 0 \}/);
assert.match(reportSource, /qaGameplaySubmissions/);
assert.match(reportSource, /QA gameplay FPS last 15s/);
assert.match(appSource, /qs\.get\('fx'\) === 'coastal-seven' && qs\.get\('cloudBudget'\) === 'lattice'/);
assert.match(appSource, /mobileAlwaysIncrementalPanorama = true/);
assert.match(cloudSource, /this\.panoWarm && ! this\.mobileAlwaysIncrementalPanorama/);
assert.match(cloudSource, /if \( this\.mobileAlwaysIncrementalPanorama \) this\.panoWarm = false/);
assert.match(reportSource, /QA cloud panorama budget/);
assert.match(reportSource, /QA performance/);
assert.match(reportSource, /QA CPU frame p50\/p95/);
assert.match(reportSource, /QA submit-to-queue-ack wall p50\/p95/);
assert.match(reportSource, /NOT GPU timestamp/);
assert.match(reportSource, /QA CPU stages p95/);
assert.match(reportSource, /QA independent simulation budget/);
assert.match(appSource, /qs\.get\('shadowBudget'\) === 'half'/);
assert.match(appSource, /this\.shadows\.periods = \[2,4,8\]/);
assert.match(appSource, /this\.shadows\.render\( this\.scene, this\.engine\.meshRenderer, qaShadowIndices \)/);
assert.match(appSource, /__bermudaQAShadowBudget\.passes \+= qaShadowIndices\.length/);
assert.match(reportSource, /QA shadow cadence/);
assert.match(reportSource, /QA vendor GPU residency/);
assert.match(reportSource, /QA visible RAF interval p50\/p95/);
assert.match(reportSource, /QA actual frame interval p50\/p95/);
assert.match(reportSource, /QA surf crest cadence/);
assert.match(reportSource, /QA Kelvin wake A\/B/);
assert.match(reportSource, /QA boat wake state/);
assert.match(reportSource, /QA startup instant-prime 4 frames \/ 0ms spacing \/ no forced 60s/);
assert.match(reportSource, /QA sky overcast mobile cloud black-tile fallback/);
assert.match(reportSource, /QA night airborne spray/);
assert.match(mainSource, /frameCount: 4/);
assert.match(mainSource, /frameWaitMs: 0/);
assert.doesNotMatch(mainSource, /minimumMs: 60000/);
assert.doesNotMatch(mainSource, /Finishing 60-second FFT/);
assert.match(mainSource, /Core scene primed; optional audio loading continues/);
assert.match(mainSource, /void qaAudioReady\.catch/);
assert.match(mainSource, /await verifyMobileWorld\(/);
assert.match(mainSource, /await preloadMobileStartup\(/);
assert.match(appSource, /const nightNoAirborne = G\.night\.value > 0\.32/);
assert.match(appSource, /this\.spray\.mesh\.visible = !nightNoAirborne/);
assert.match(appSource, /this\.airMotes\.mesh\.visible = false/);
assert.match(appSource, /G\.cameraUnderwater\.value < 0\.5/);
assert.match(appSource, /__bermudaQANightSpray/);
assert.match(appSource, /this\.fft\.update\( dt \)/);
assert.match(cloudSource, /let ambientCloudFloor = \( skyAmbient \* 0\.22/);
assert.match(cloudSource, /cloudRadiance = max\( cloudRadiance, ambientCloudFloor \)/);
assert.match(cloudSource, /var cloudRadiance = mix\( m\.color, moonCloud, nocturnal \)/);
assert.doesNotMatch(cloudSource, /let cloudRadiance = mix\( m\.color, moonCloud, nocturnal \);\s*[\s\S]*?cloudRadiance = max/);
assert.match(reportSource, /QA shader repair Clouds Panorama mutable radiance/);
assert.match(cloudSource, /let empty = raw\.a <= 0\.0001/);
assert.match(cloudSource, /let s = select\( raw, vec4f\( 0\.0, 0\.0, 0\.0, 1\.0 \), empty \)/);

assert.match(appSource, /qs\.get\('wakeBudget'\) === 'off'/);
assert.match(appSource, /window\.__bermudaQAWakeAudit =/);
assert.match(appSource, /this\.surface\.wake = null/);
assert.match(appSource, /const wakeAudit = window\.__bermudaQAWakeAudit/);
assert.match(appSource, /wakeAudit\.simFrames\+\+/);
assert.match(appSource, /this\.boatSpray\.update\( dt \)/);
assert.match(appSource, /this\.mobileWake\.update\( dt \)/);
assert.match(appSource, /this\.fft\.update\( dt \)/);

assert.match(mainSource, /qaPerfQuery\.get\('surfBudget'\)==='half'/);
assert.match(mainSource, /mode:'breakers >=67ms \(A\/B only\)'/);
assert.match(appSource, /__bermudaQASurfBudget\.allow\(\)/);
assert.match(appSource, /if\(window\.__bermudaQAPerf\) window\.__bermudaQAPerf\.mark\('frame-end'\)/);
assert.match(appSource, /this\.spray\.update\(\)/);
assert.match(appSource, /this\.fft\.update\( dt \)/);
assert.match(engineSource, /qaPerf\.push\('visibleRafInterval'/);
assert.match(engineSource, /qaPerf\.push\('renderInterval'/);

assert.match(reportSource, /__bermudaVendorStreamStats\?\.releases/);
assert.match(vendorSource, /streamTexturesWhenFar\( position, dt \)/);
assert.match(gameSource, /v\.streamTexturesWhenFar\( p\.position, dt \)/);

assert.match(mainSource, /qaPerfMode === 'profile' \|\| qaPerfMode === '60'/);
assert.match(mainSource, /qaPerfMode==='60'\) \{ app\.engine\.mobileGpuTargetIntervalMs=16/);
assert.match(mainSource, /__bermudaMobilePaceMs=16/);
assert.match(mainSource, /__bermudaQAPerf=qa/);
assert.match(mainSource, /qaPerfQuery\.get\('simBudget'\)==='balanced'/);
assert.match(mainSource, /allow\(key,intervalMs,dt=0\)/);
assert.match(mainSource, /this\.usedDelta\[key\]=this\.delta\[key\]/);
assert.match(engineSource, /this\._gpuInFlight \) \{/);
assert.match(engineSource, /this\.mobileGpuTargetIntervalMs \|\| 42/);
assert.match(engineSource, /qaPerf\.skippedInFlight\+\+/);
assert.match(engineSource, /qaPerf\.skippedPacing\+\+/);
assert.match(engineSource, /qaPerf\.push\('cpuFrame'/);
assert.match(engineSource, /qaPerf\.push\('submitAckWall'/);
assert.match(engineSource, /GPU\.queue\.onSubmittedWorkDone\(\)\.then/);
assert.match(appSource, /__bermudaQAPerf\.mark\('logic'\)/);
assert.match(appSource, /__bermudaQAPerf\.mark\('ocean'\)/);
assert.match(appSource, /__bermudaQAPerf\.mark\('world'\)/);
assert.match(appSource, /__bermudaQAPerf\.mark\('render'\)/);
assert.match(appSource, /__bermudaQAPerf\.mark\('post'\)/);
assert.match(appSource, /__bermudaQAPerf\.mark\('frame-end'\)/);
assert.match(appSource, /__bermudaQASimBudget\.allow\('caustics',67\)/);
assert.match(appSource, /__bermudaQASimBudget\.allow\('shore',67\)/);
assert.match(appSource, /__bermudaQASimBudget\.allow\('clouds',100,dt\)/);
assert.match(appSource, /__bermudaQASimBudget\.usedDelta\.clouds : dt/);
assert.match(appSource, /this\.fft\.update\( dt \)/);

assert.match(reportSource, /QA source revision coastal-v32-vendors-board/);
assert.match(reportSource, /QA vendor texture load/);
assert.match(reportSource, /QA vendor GLBs/);
assert.match(vendorSource, /get\('vendorLoad'\) === 'focus'/);
assert.match(vendorSource, /get\('fx'\) === 'coastal-seven'/);
assert.match(vendorSource, /gltf\.__bermudaTextureRole = this\.kind === 'buyer' \? 'joe' : 'martha'/);
assert.match(vendorSource, /QA_VENDOR_FOCUS \? Math\.min\(this\.radius, 3\.0\) : 6/);
assert.match(vendorSource, /if \(dx \* dx \+ dz \* dz < radius \* radius\)/);
assert.match(vendorSource, /SkinnedModel\.create\( gltf \)/);
assert.match(gameSource, /this\.vendors = \[ this\.stand\.vendor, this\.chandlery\.vendor \]/);
assert.doesNotMatch(productionSource, /QA_NPC_PROXIMITY/);
assert.match(skinSource, /g\.__bermudaTextureRole \? 'char\.'/);
assert.match(reportSource, /QA night visual/);
for (const shader of [cloudSource, skySource, waterSource]) {
  assert.match(shader, /QA_NIGHT_VISUAL/);
  assert.match(shader, /get\('nightVisual'\) === '1'/);
  assert.match(shader, /get\('fx'\) === 'coastal-seven'/);
}
assert.match(skySource, /let duskSun = atmosphereParams\.sunDir\.y/);
assert.match(skySource, /horizon \* \( vec3f/);
assert.match(cloudSource, /let moonCloud = min\( m\.color/);
assert.match(cloudSource, /textureStore\( scPano, texel, vec4f\( cloudRadiance/);
assert.match(cloudSource, /: `textureStore\( scPano, texel, vec4f\( m\.color/);
assert.match(waterSource, /if \( dbg == 0 && in\.front \)/);
assert.match(waterSource, /r\.color = vec4f\( res, 1\.0 \)/);
assert.match(reportSource, /QA resolution budget/);
assert.match(reportSource, /QA light bake/);
assert.match(appSource, /qs\.get\('lightBake'\) === 'prime'/);
assert.match(appSource, /one-time-terrain-plus-bounce/);
assert.match(appSource, /if \(completedBakes > 0\) return false/);
assert.match(appSource, /if \(baked\) completedBakes\+\+/);
assert.match(engineSource, /get\('resCap'\) === '462'/);
assert.match(engineSource, /get\('fx'\) === 'coastal-seven'/);
assert.match(engineSource, /462 \/ Math\.max\(1, w\), 817 \/ Math\.max\(1, h\)/);
assert.match(engineSource, /window\.__bermudaQAResolutionBudget = 'max-462x817'/);
assert.match(engineSource, /this\.canvas\.style\.width = w \+ 'px'/);
assert.match(engineSource, /this\.camera\.aspect = w \/ h/);


// Beach screenshot regression: keep the landing and shop colliders but do
// not recreate the three massive grey asphalt slabs or their invisible
// collisions on either side of the public waterfront.
assert.match(reportSource, /QA source revision coastal-v32-vendors-board/);
assert.match(reportSource, /QA beach road removed central-plus-two-extensions-and-footway/);
assert.doesNotMatch(beachBlockoutSource, /box\(M\.asphalt,-68,1\.43,-49\.2,34,\.18,5/);
assert.doesNotMatch(beachBlockoutSource, /'bermuda-road',true/);
assert.doesNotMatch(waterfrontUpgradeSource, /bermuda-road-extension/);
assert.doesNotMatch(waterfrontUpgradeSource, /bermuda-footway/);
assert.doesNotMatch(waterfrontUpgradeSource, /const roadY = 1\.43/);
assert.match(beachBlockoutSource, /bermuda-landing',true/);
assert.match(beachBlockoutSource, /bermuda-shop-apron',true/);
assert.doesNotMatch(beachBlockoutSource, /bermuda-approach-ramp',true/);
assert.match(beachBlockoutSource, /bermuda-beach-pier-step',true/);
assert.match(beachBlockoutSource, /const stairZ0=-50\.1,stairZ1=-47\.0/);
assert.match(beachBlockoutSource, /terrain\.heightAt\(-65,-50\.1\)/);
assert.match(beachBlockoutSource, /Math\.ceil\(Math\.abs\(pierTop-beachTop\)\/\.18\)/);
assert.match(beachBlockoutSource, /visualKey='beach-pier-stairs'/);
assert.doesNotMatch(beachBlockoutSource, /bermuda-outer-step/);
assert.doesNotMatch(beachBlockoutSource, /bermuda-outer-step-landing/);
assert.doesNotMatch(beachBlockoutSource, /dock-brand-signs/);
assert.doesNotMatch(beachBlockoutSource, /BermudaSimulatorSign/);
assert.doesNotMatch(beachBlockoutSource, /bermudaDockSign/);
assert.doesNotMatch(beachBlockoutSource, /makeSign\(/);
assert.match(reportSource, /QA dock access landward-beach-to-pier/);
assert.match(reportSource, /QA added signs NONE/);
assert.match(reportSource, /QA pier material pale-concrete shader-free/);
assert.match(reportSource, /QA pier deck 7 concrete expansion joints/);
assert.match(beachBlockoutSource, /concrete:makeMaterial\('weathered-pier-concrete',0xc9ceca,\.98\)/);
assert.doesNotMatch(beachBlockoutSource, /makePierConcrete/);
assert.doesNotMatch(beachBlockoutSource, /mat\.surface=/);
assert.match(beachBlockoutSource, /const joints=new InstancedMesh\(GEO.box,M.joint,7\)/);
assert.match(beachBlockoutSource, /visualKey='pier-coping'/);
assert.doesNotMatch(beachBlockoutSource, /const planks=/);
assert.doesNotMatch(beachBlockoutSource, /M\.wood/);
assert.doesNotMatch(beachBlockoutSource, /dock-wood/);
assert.match(beachBlockoutSource, /box\(M.concrete,-65,\.55,-30,5\.2,\.9,34/);
assert.match(beachBlockoutSource, /box\(M.concrete,-64,\.58,-14\.5,5\.4,\.96,4\.8/);
assert.match(waterfrontUpgradeSource, /app\.bermudaReferenceUpgrade = \{ group, materials: M \}/);

const unknown = run('all-at-once');
assert.equal(unknown.selected,'baseline');
assert.equal(unknown.url.searchParams.has('fx'),false);
for(const flag of flags) assert.equal(unknown.url.searchParams.get(flag),'1');
console.log('QA effects: default + singles + coastal-six + coastal-seven; opt-in MarineSnow source regression passed');
