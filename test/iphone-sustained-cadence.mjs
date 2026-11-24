import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CoastalCadence } from '../src/mobile/CoastalProfile.js';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const app = read('../src/App.js'), atmosphere = read('../src/sky/Atmosphere.js');

// Regression: the sea-only iPhone mode used to FORCE full atmosphere,
// which recomputed SkyView >1600 times in ~130 seconds.
assert.match(app, /this\.atmosphere\.mobileMode = mobileLite\s*\?/);
assert.doesNotMatch(app, /\(window\.__bermudaHighSeaOnly && mobileLite\)\s*\?\s*'full'/);
assert.match(atmosphere, /this\.mobileMode === 'staged' && this\._svValid/);
assert.match(atmosphere, /this\._mobileSkyTimer = 5/);

// The startup LUTs must be primed in their dependency order, each through a
// separate acknowledged queue submission, BEFORE verifying any world frames.
const boot = app.slice(app.indexOf('async primeMobileSimulation('));
const stages = ["'atmosphere transmittance'", "'atmosphere multiple scattering'",
  "'atmosphere SkyView'", "'FFT ocean'"];
let last = -1;
for (const stage of stages) {
  const pos = boot.indexOf(stage);
  assert.ok(pos > last, 'Missing or out-of-order mobile startup stage '+stage);
  last = pos;
}
assert.match(boot, /this\.updateSun\(\);/);
assert.match(boot, /this\.atmosphere\._svValid/);
assert.match(boot, /this\.atmosphere\.mobileInitStage < 3/);

// Full clouds must NEVER bypass the cadence on a sea-only iPhone. They are
// staggered away from caustic/surf phases and keep their correct elapsed dt.
assert.doesNotMatch(app, /window\.__bermudaHighSeaOnly\s*\|\|\s*!cadence\s*\|\|\s*cadence\.allow\('clouds'/);
assert.match(app, /cadence\.allowWhen\('clouds',250,dt,cloudPhaseAllowed\)/);
assert.match(app, /const cloudPhaseAllowed = mobileAux\(0\)/);
assert.match(app, /this\.clouds\.update\(this\.mobileLite && cadence \? cadence\.usedDelta\.clouds : dt/);

// Simulate 1600 mobile frames under a 20 ms per frame clock. Cloud compute
// should execute ~4x/sec, not 1600x, while conserving animation time.
let ms = 0, count = 0, delivered = 0;
const cadence = new CoastalCadence(() => ms);
for (let frame=0; frame<1600; frame++) {
  const eligible = frame % 3 === 0;
  if (cadence.allowWhen('clouds',250,0.02,eligible)) {
    count++;
    delivered += cadence.usedDelta.clouds;
    assert.equal(frame % 3,0);
  }
  ms += 20;
}
assert.ok(count>=95 && count<=125, 'Unexpected cloud budget '+count);
const remainder = cadence.delta.clouds || 0;
assert.ok(Math.abs(delivered+remainder-32) < 1e-7, 'Cloud wind evolution time was lost');

// Preserve legacy allow() semantics for caustic/shore cadence users.
let now=0;
const legacy=new CoastalCadence(()=>now);
assert.equal(legacy.allow('shore',100,0.02),true);
now=25;
assert.equal(legacy.allow('shore',100,0.02),false);
now=125;
assert.equal(legacy.allow('shore',100,0.02),true);
assert.ok(Math.abs(legacy.usedDelta.shore-0.04)<1e-8);
console.log('iPhone long-session atmosphere/cloud compute pacing PASS');
